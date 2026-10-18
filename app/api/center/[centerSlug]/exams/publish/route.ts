import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { UserRole } from '@/lib/dal/types';

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
    const { examId, actorId = 'user-admin-001', actorRole = 'CENTER_ADMIN' as UserRole } = body;

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
    const status = error.message?.includes('Forbidden') ? 403 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to publish exam' },
      { status }
    );
  }
}
