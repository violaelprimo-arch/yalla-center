import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { UserRole } from '@/lib/dal/types';
import {
  authorizeStaffMember,
  CenterOperationsError,
} from '@/lib/firebase/center-operations-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { centerSlug: string; examId: string } | Promise<{ centerSlug: string; examId: string }> }
) {
  try {
    const { centerSlug, examId } = await Promise.resolve(params);
    const bearer =
      extractBearerToken(request.headers.get('authorization')) ||
      request.cookies.get('yc_token')?.value ||
      '';
    const dal = getDataProvider(bearer || undefined);
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
    }

    if (isCloudProductionMode()) {
      if (!bearer) {
        return NextResponse.json({ error: 'سجّل الدخول لعرض الامتحان' }, { status: 401 });
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      await authorizeStaffMember(store, uid, tenant.id);
    }

    const data = await dal.getExamById(examId);
    if (!data) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      exam: data.exam,
      questions: data.questions,
    });
  } catch (error: any) {
    if (error instanceof CenterOperationsError || error instanceof FirebaseAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { centerSlug: string; examId: string } | Promise<{ centerSlug: string; examId: string }> }
) {
  try {
    const { centerSlug, examId } = await Promise.resolve(params);
    const bearer =
      extractBearerToken(request.headers.get('authorization')) ||
      request.cookies.get('yc_token')?.value ||
      '';
    const dal = getDataProvider(bearer || undefined);
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
    }

    const body = await request.json();
    let actorId: string;
    let actorRole: UserRole;

    if (isCloudProductionMode()) {
      if (!bearer) {
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لتعديل الامتحان' }, { status: 401 });
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      const staff = await authorizeStaffMember(store, uid, tenant.id, [
        'CENTER_ADMIN',
        'BRANCH_MANAGER',
        'TEACHER',
        'PLATFORM_OWNER',
      ]);
      actorId = uid;
      actorRole = staff.role;
    } else {
      actorId = body.actorId || 'user-admin-001';
      actorRole = (body.actorRole || 'CENTER_ADMIN') as UserRole;
    }

    const result = await dal.updateExamMetadata({
      tenantId: tenant.id,
      examId,
      updates: body.updates || {},
      actorId,
      actorRole,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, exam: result.exam });
  } catch (error: any) {
    if (error instanceof CenterOperationsError || error instanceof FirebaseAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
