import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { validateExamPreflightInput } from '@/lib/exams/preflight';

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
      subject,
      grade,
      teacherId,
      groupId,
      sessionId,
      durationMinutes,
      sourceText: rawSourceText,
      sourceDocumentIds,
      questionCounts,
    } = body;

    let combinedText = rawSourceText || '';
    let docItems: Array<{ id: string; title: string; isIndexed: boolean; wordCount: number }> = [];

    if (sourceDocumentIds && Array.isArray(sourceDocumentIds) && sourceDocumentIds.length > 0) {
      const allMaterials = await dal.getMaterials(tenant.id);
      const selected = allMaterials.filter((m) => sourceDocumentIds.includes(m.id));

      docItems = selected.map((m) => ({
        id: m.id,
        title: m.title,
        isIndexed: m.indexStatus === 'indexed',
        wordCount: m.wordCount,
      }));

      // Combine text if rawSourceText wasn't supplied directly
      if (!combinedText) {
        combinedText = selected
          .map((m) => m.textContentIndexed || '')
          .filter(Boolean)
          .join('\n\n');
      }
    }

    // Run unified preflight validation gate
    const preflight = validateExamPreflightInput({
      rawText: combinedText,
      documents: docItems.length > 0 ? docItems : undefined,
    });

    if (!preflight.allowed) {
      return NextResponse.json(
        {
          error: preflight.errorCode,
          message: preflight.messageArabic,
          totalWordCount: preflight.totalWordCount,
          unindexedDocTitles: preflight.unindexedDocTitles,
        },
        { status: preflight.httpStatus } // HTTP 422
      );
    }

    // Call Grounded AI Exam Generator
    const generated = await dal.generateAiExam({
      tenantId: tenant.id,
      teacherId: teacherId || 'user-teacher-phys',
      groupId,
      sessionId,
      title: title || `اختبار دوري مؤصل - ${subject || 'الفيزياء'}`,
      subject: subject || 'الفيزياء',
      grade: grade || 'الصف الثالث الثانوي',
      durationMinutes: durationMinutes || 30,
      sourceText: combinedText,
      sourceDocumentIds,
      questionCounts,
    });

    return NextResponse.json(
      {
        success: true,
        exam: generated.exam,
        questions: generated.questions,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      {
        error: error.code || 'GENERATION_FAILED',
        message: error.message || 'فشل توليد الامتحان',
      },
      { status }
    );
  }
}
