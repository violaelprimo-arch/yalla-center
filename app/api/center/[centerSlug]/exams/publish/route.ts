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

export async function POST(
  request: NextRequest,
  { params }: { params: { centerSlug: string } | Promise<{ centerSlug: string }> }
) {
  try {
    const { centerSlug } = await Promise.resolve(params);
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
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لنشر الامتحان' }, { status: 401 });
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

    const { examId } = body;
    if (!examId) {
      return NextResponse.json({ error: 'examId is required' }, { status: 400 });
    }

    if (actorRole === 'STUDENT') {
      return NextResponse.json(
        { error: 'Forbidden: لا يُسمح للطلاب بنشر الامتحانات' },
        { status: 403 }
      );
    }

    const exam = await dal.publishExam(examId, actorId, actorRole);
    return NextResponse.json({ success: true, exam }, { status: 200 });
  } catch (error: any) {
    if (error instanceof CenterOperationsError || error instanceof FirebaseAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error.message?.includes('Forbidden') ? 403 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to publish exam' },
      { status }
    );
  }
}
