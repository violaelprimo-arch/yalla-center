import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { UserRole } from '@/lib/dal/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { centerSlug: string; examId: string } }
) {
  try {
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(params.centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
    }

    const data = await dal.getExamById(params.examId);
    if (!data) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      exam: data.exam,
      questions: data.questions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { centerSlug: string; examId: string } }
) {
  try {
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(params.centerSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Center not found' }, { status: 404 });
    }

    const body = await request.json();
    const { updates, actorId = 'user-admin-001', actorRole = 'CENTER_ADMIN' as UserRole } = body;

    const result = await dal.updateExamMetadata({
      tenantId: tenant.id,
      examId: params.examId,
      updates: updates || {},
      actorId,
      actorRole,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, exam: result.exam });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
