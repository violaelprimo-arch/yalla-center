import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { extractBearerToken, FirebaseAuthError, verifyFirebaseIdToken } from '@/lib/firebase/server';

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

    if (isCloudProductionMode()) {
      if (!bearer) {
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لتسليم الامتحان' }, { status: 401 });
      }
      await verifyFirebaseIdToken(bearer);
    }

    const body = await request.json();
    const { examId, studentId, answers } = body;

    if (!examId || !studentId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'معرّف الامتحان، معرّف الطالب، وقائمة الإجابات مطلوبة' },
        { status: 400 }
      );
    }

    const result = await dal.submitExam(examId, studentId, answers);

    return NextResponse.json({
      success: true,
      submission: result.submission,
      score: result.score,
      percentage: result.percentage,
    });
  } catch (error: any) {
    if (error instanceof FirebaseAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to submit exam' },
      { status: 400 }
    );
  }
}
