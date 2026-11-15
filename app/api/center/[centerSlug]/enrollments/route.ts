import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { Enrollment } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
  deleteFirestoreEnrollment,
  listFirestoreEnrollments,
  saveFirestoreEnrollment,
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

    const enrollments = await listFirestoreEnrollments(store, tenant.id, {
      studentId: searchParams.get('studentId') || undefined,
      groupId: searchParams.get('groupId') || undefined,
    });

    return reply({ success: true, data: enrollments });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحميل الاشتراكات';
    return reply({ success: false, error: message }, 500);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { tenant, store } = await resolveAuth(req, centerSlug, [
      'CENTER_ADMIN',
      'RECEPTIONIST',
      'BRANCH_MANAGER',
      'PLATFORM_OWNER',
    ]);

    const body = (await req.json()) as Enrollment;
    if (!body?.studentId || !body?.groupId) {
      return reply({ success: false, error: 'معرف الطالب والمجموعة مطلوبان' }, 400);
    }

    const enrollmentId = body.id || `enr-${Date.now()}`;
    const enrollment = await saveFirestoreEnrollment(store, tenant.id, {
      ...body,
      id: enrollmentId,
    });

    return reply({ success: true, data: enrollment, message: 'تم حفظ تسجيل الطالب في المجموعة سحابياً' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تسجيل الطالب في المجموعة';
    return reply({ success: false, error: message }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const { searchParams } = new URL(req.url);
    const enrollmentId = searchParams.get('id');
    if (!enrollmentId) return reply({ success: false, error: 'معرف الاشتراك مطلوب' }, 400);

    const { tenant, store } = await resolveAuth(req, centerSlug, ['CENTER_ADMIN', 'PLATFORM_OWNER']);
    await deleteFirestoreEnrollment(store, tenant.id, enrollmentId);

    return reply({ success: true, message: 'تم إلغاء الاشتراك سحابياً' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر إلغاء الاشتراك';
    return reply({ success: false, error: message }, 500);
  }
}
