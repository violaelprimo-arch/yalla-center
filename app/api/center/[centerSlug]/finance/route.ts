import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { Expense, Invoice, Payment } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
  listFirestoreExpenses,
  listFirestoreInvoices,
  listFirestorePayments,
  listFirestoreShifts,
  recordFirestoreExpense,
  recordFirestorePayment,
  saveFirestoreInvoice,
  saveFirestoreShift,
} from '@/lib/firebase/center-operations-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function resolveAuth(req: NextRequest, centerSlug: string, allowedRoles?: string[]) {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);
  if (!tenant?.isActive) throw new CenterOperationsError(404, 'السنتر غير موجود أو غير نشط');

  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (!bearer) throw new CenterOperationsError(401, 'سجّل الدخول للمتابعة');

  const { uid } = await verifyFirebaseIdToken(bearer);
  const store = await createServerFirestoreStore({ callerIdToken: bearer });
  const staff = await authorizeStaffMember(store, uid, tenant.id, allowedRoles);
  return { tenant, store, staff };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'invoices';
    const { tenant, store } = await resolveAuth(req, centerSlug);

    if (type === 'invoices') {
      const data = await listFirestoreInvoices(store, tenant.id, {
        studentId: searchParams.get('studentId') || undefined,
        status: searchParams.get('status') || undefined,
      });
      return reply({ success: true, data });
    }

    if (type === 'payments') {
      const data = await listFirestorePayments(store, tenant.id, {
        studentId: searchParams.get('studentId') || undefined,
        invoiceId: searchParams.get('invoiceId') || undefined,
        shiftId: searchParams.get('shiftId') || undefined,
      });
      return reply({ success: true, data });
    }

    if (type === 'expenses') {
      const data = await listFirestoreExpenses(store, tenant.id);
      return reply({ success: true, data });
    }

    if (type === 'shifts') {
      const data = await listFirestoreShifts(store, tenant.id, {
        cashierUserId: searchParams.get('cashierUserId') || undefined,
        status: (searchParams.get('status') as 'open' | 'closed') || undefined,
      });
      return reply({ success: true, data });
    }

    return reply({ success: false, error: 'نوع المعاملة المالية غير معروف' }, 400);
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحميل البيانات المالية';
    return reply({ success: false, error: message }, 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'invoice';
    const { tenant, store, staff } = await resolveAuth(req, centerSlug, [
      'ACCOUNTANT',
      'CENTER_ADMIN',
      'RECEPTIONIST',
      'PLATFORM_OWNER',
    ]);

    const body = await req.json();

    if (type === 'invoice') {
      const invoice = await saveFirestoreInvoice(store, tenant.id, {
        ...body,
        id: body.id || `inv-${Date.now()}`,
      } as Invoice);
      return reply({ success: true, data: invoice, message: 'تم حفظ الفاتورة سحابياً' });
    }

    if (type === 'payment') {
      const payment = await recordFirestorePayment(store, tenant.id, {
        ...body,
        id: body.id || `pay-${Date.now()}`,
        cashierUserId: body.cashierUserId || staff.uid,
      } as Payment);
      return reply({ success: true, data: payment, message: 'تم تسجيل سند القبض سحابياً' });
    }

    if (type === 'expense') {
      const expense = await recordFirestoreExpense(store, tenant.id, {
        ...body,
        id: body.id || `exp-${Date.now()}`,
        createdByUserId: body.createdByUserId || staff.uid,
      } as Expense);
      return reply({ success: true, data: expense, message: 'تم تسجيل المصروف سحابياً' });
    }

    if (type === 'shift') {
      const shift = await saveFirestoreShift(store, tenant.id, {
        ...body,
        id: body.id || `shift-${Date.now()}`,
      });
      return reply({ success: true, data: shift, message: 'تم حفظ بيانات الوردية سحابياً' });
    }

    return reply({ success: false, error: 'نوع المعاملة المالية غير محدد' }, 400);
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر حفظ المعاملة المالية';
    return reply({ success: false, error: message }, 500);
  }
}
