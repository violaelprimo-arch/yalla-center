import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { Session } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
  listFirestoreSessions,
  saveFirestoreSession,
  updateFirestoreSessionStatus,
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
    const { tenant, store } = await resolveAuth(req, centerSlug);

    const sessions = await listFirestoreSessions(store, tenant.id, {
      date: searchParams.get('date') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      teacherId: searchParams.get('teacherId') || undefined,
    });

    return reply({ success: true, data: sessions });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحميل الحصص';
    return reply({ success: false, error: message }, 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { tenant, store } = await resolveAuth(req, centerSlug, [
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'TEACHER',
      'PLATFORM_OWNER',
    ]);

    const body = (await req.json()) as Session;
    if (!body?.groupId || !body?.sessionDate || !body?.startTime || !body?.endTime) {
      return reply({ success: false, error: 'بيانات الحصة الأساسية مطلوبة' }, 400);
    }

    const sessionId = body.id || `sess-${Date.now()}`;
    const session = await saveFirestoreSession(store, tenant.id, {
      ...body,
      id: sessionId,
      status: body.status || 'scheduled',
    });

    return reply({ success: true, data: session, message: 'تم حفظ الحصة في السحابة بنجاح' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر حفظ الحصة';
    return reply({ success: false, error: message }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { tenant, store } = await resolveAuth(req, centerSlug, [
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'TEACHER',
      'PLATFORM_OWNER',
    ]);

    const body = await req.json();
    const { sessionId, status, cancellationReason } = body;
    if (!sessionId || !status) {
      return reply({ success: false, error: 'معرف الحصة والحالة مطلوبان' }, 400);
    }

    await updateFirestoreSessionStatus(store, tenant.id, sessionId, status, cancellationReason);
    return reply({ success: true, message: 'تم تحديث حالة الحصة سحابياً' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحديث حالة الحصة';
    return reply({ success: false, error: message }, 500);
  }
}
