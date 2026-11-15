import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { User } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
  listFirestoreStudents,
  saveFirestoreStudent,
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

    const students = await listFirestoreStudents(store, tenant.id, {
      stage: searchParams.get('stage') || undefined,
      grade: searchParams.get('grade') || undefined,
      division: searchParams.get('division') || undefined,
      search: searchParams.get('search') || undefined,
    });

    return reply({ success: true, data: students });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر تحميل بيانات الطلاب';
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
      'PLATFORM_OWNER',
    ]);

    const body = (await req.json()) as User;
    if (!body?.fullName?.trim() || !body?.stage || !body?.grade) {
      return reply({ success: false, error: 'اسم الطالب والمرحلة والصف حقول مطلوبة' }, 400);
    }

    const studentId = body.id || `std-${Date.now()}`;
    const student = await saveFirestoreStudent(store, tenant.id, {
      ...body,
      id: studentId,
      studentCode: body.studentCode || `STD-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    return reply({ success: true, data: student, message: 'تم حفظ بيانات الطالب في السحابة بنجاح' });
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر حفظ بيانات الطالب';
    return reply({ success: false, error: message }, 500);
  }
}
