import { NextRequest, NextResponse } from 'next/server';
import {
  deleteLessonGrade,
  getSessionExamsAndGrades,
  mapServiceErrorToHttp,
  resolveAuthorizedStaffActor,
  saveExamTotalMarks,
  upsertLessonGrade,
} from '@/lib/firebase/lesson-scores-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

async function authenticateRequest(request: NextRequest, centerSlug: string) {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    throw new FirebaseAuthError(
      401,
      'يلزم تسجيل الدخول بحساب Firebase موثق لعرض أو تعديل درجات الحصة'
    );
  }
  const verifiedToken = await verifyFirebaseIdToken(token);
  const store = await createServerFirestoreStore({ callerIdToken: token });
  const actor = await resolveAuthorizedStaffActor({
    centerSlug,
    verifiedToken,
    store,
  });
  return { actor, store };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const { centerSlug } = await Promise.resolve(context.params);
    const sessionId = new URL(request.url).searchParams.get('sessionId')?.trim() || '';
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_SESSION_ID', message: 'معرف الحصة مطلوب' },
        { status: 400 }
      );
    }

    const { actor, store } = await authenticateRequest(request, centerSlug);
    const data = await getSessionExamsAndGrades({ actor, sessionId, store });

    return NextResponse.json({
      success: true,
      actor: {
        uid: actor.staff.uid,
        role: actor.staff.role,
        displayName: actor.staff.displayName,
        email: actor.staff.email,
      },
      ...data,
    });
  } catch (err) {
    const mapped = mapServiceErrorToHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const { centerSlug } = await Promise.resolve(context.params);
    const body = (await request.json()) as {
      sessionId?: string;
      examId?: string;
      title?: string;
      totalMarks?: string | number;
      expectedVersion?: number;
    };

    if (!body.sessionId || body.totalMarks === undefined || body.totalMarks === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FIELDS',
          message: 'معرف الحصة والدرجة النهائية للاختبار مطلوبان',
        },
        { status: 400 }
      );
    }

    const { actor, store } = await authenticateRequest(request, centerSlug);
    const result = await saveExamTotalMarks({
      actor,
      sessionId: body.sessionId,
      examId: body.examId,
      title: body.title,
      totalMarksInput: body.totalMarks,
      expectedVersion: body.expectedVersion,
      store,
    });

    return NextResponse.json({ success: true, exam: result.exam });
  } catch (err) {
    const mapped = mapServiceErrorToHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const { centerSlug } = await Promise.resolve(context.params);
    const body = (await request.json()) as {
      sessionId?: string;
      examId?: string;
      studentIdOrCode?: string;
      score?: string | number;
      source?: 'panel' | 'feed' | 'card';
      expectedVersion?: number;
    };

    if (
      !body.sessionId ||
      !body.examId ||
      !body.studentIdOrCode ||
      body.score === undefined ||
      body.score === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FIELDS',
          message: 'بيانات الحصة والاختبار والطالب والدرجة مطلوبة',
        },
        { status: 400 }
      );
    }

    const { actor, store } = await authenticateRequest(request, centerSlug);
    const result = await upsertLessonGrade({
      actor,
      sessionId: body.sessionId,
      examId: body.examId,
      studentIdOrCode: body.studentIdOrCode,
      scoreInput: body.score,
      source: body.source ?? 'panel',
      expectedVersion: body.expectedVersion,
      store,
    });

    return NextResponse.json({
      success: true,
      grade: result.grade,
      exam: result.exam,
      audit: result.audit,
    });
  } catch (err) {
    const mapped = mapServiceErrorToHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const { centerSlug } = await Promise.resolve(context.params);
    const body = (await request.json()) as {
      sessionId?: string;
      examId?: string;
      studentId?: string;
      source?: 'panel' | 'feed' | 'card';
    };

    if (!body.sessionId || !body.examId || !body.studentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FIELDS',
          message: 'معرف الحصة والاختبار والطالب مطلوبون للحذف',
        },
        { status: 400 }
      );
    }

    const { actor, store } = await authenticateRequest(request, centerSlug);
    const result = await deleteLessonGrade({
      actor,
      sessionId: body.sessionId,
      examId: body.examId,
      studentId: body.studentId,
      source: body.source ?? 'card',
      store,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const mapped = mapServiceErrorToHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
