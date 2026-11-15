import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { Attendance } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
  listFirestoreAttendance,
  recordFirestoreAttendance,
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
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return reply({ success: false, error: 'معرف الحصة مطلوب' }, 400);

    const { tenant, store } = await resolveAuth(req, centerSlug);
    const attendance = await listFirestoreAttendance(store, tenant.id, sessionId);

    return reply({ success: true, data: attendance });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحميل سجلات الحضور';
    return reply({ success: false, error: message }, 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { tenant, store, staff } = await resolveAuth(req, centerSlug, [
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'TEACHER',
      'PLATFORM_OWNER',
    ]);

    const body = (await req.json()) as Attendance;
    if (!body?.sessionId || !body?.studentId) {
      return reply({ success: false, error: 'معرف الحصة والطالب مطلوبان' }, 400);
    }

    const record = await recordFirestoreAttendance(store, tenant.id, {
      ...body,
      cashierUserId: body.cashierUserId || staff.uid,
    });

    return reply({ success: true, data: record, message: 'تم حفظ تسجيل الحضور سحابياً' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تسجيل الحضور';
    return reply({ success: false, error: message }, 500);
  }
}
