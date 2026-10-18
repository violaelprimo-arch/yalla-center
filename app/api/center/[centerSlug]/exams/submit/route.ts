import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';

export async function POST(
  request: NextRequest,
  { params }: { params: { centerSlug: string } }
) {
  try {
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(params.centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: error.message || 'Failed to submit exam' },
      { status: 400 }
    );
  }
}
