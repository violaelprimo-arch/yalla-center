import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { ExamStatus } from '@/lib/dal/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { centerSlug: string } }
) {
  try {
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(params.centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

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
      teacherId: teacherId || 'user-teacher-phys',
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
    return NextResponse.json(
      { error: error.message || 'Failed to create exam' },
      { status: 400 }
    );
  }
}
