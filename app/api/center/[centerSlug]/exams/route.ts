import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { ExamStatus } from '@/lib/dal/types';
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

    if (isCloudProductionMode()) {
      if (!bearer) {
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لعرض الامتحانات' }, { status: 401 });
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      await authorizeStaffMember(store, uid, tenant.id);
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId') || undefined;
    const teacherId = searchParams.get('teacherId') || undefined;
    const status = (searchParams.get('status') as ExamStatus) || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;

    const exams = await dal.getExams(tenant.id, {
      groupId,
      teacherId,
      status,
      subjectId,
    });

    return NextResponse.json({
      success: true,
      exams,
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

    if (isCloudProductionMode()) {
      if (!bearer) {
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لإنشاء امتحان' }, { status: 401 });
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      await authorizeStaffMember(store, uid, tenant.id, [
        'CENTER_ADMIN',
        'BRANCH_MANAGER',
        'TEACHER',
        'PLATFORM_OWNER',
      ]);
    }

    const body = await request.json();
    const {
      title,
      teacherId,
      groupId,
      subjectId,
      durationMinutes,
      sourceDocumentIds,
      questions,
    } = body;

    if (!title || !sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      return NextResponse.json(
        { error: 'يجب تحديد عنوان الامتحان والمستندات المصدرية' },
        { status: 400 }
      );
    }

    const created = await dal.createExamDraft({
      tenantId: tenant.id,
      groupId: groupId || '',
      subjectId,
      teacherId: teacherId || '',
      title,
      durationMinutes: durationMinutes || 30,
      sourceDocumentIds,
      questions: questions || [],
    });

    return NextResponse.json(
      {
        success: true,
        exam: created.exam,
        questions: created.questions,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof CenterOperationsError || error instanceof FirebaseAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create exam' },
      { status: 400 }
    );
  }
}
