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
    const { rawText, sourceDocumentIds } = body;

    let documents;
    if (sourceDocumentIds && Array.isArray(sourceDocumentIds) && sourceDocumentIds.length > 0) {
      const allMaterials = await dal.getMaterials(tenant.id);
      documents = allMaterials
        .filter((m) => sourceDocumentIds.includes(m.id))
        .map((m) => ({
          id: m.id,
          title: m.title,
          isIndexed: m.indexStatus === 'indexed',
          wordCount: m.wordCount,
        }));
    }

    const validation = validateExamPreflightInput({ rawText, documents });

    if (!validation.allowed) {
      return NextResponse.json(
        {
          error: validation.errorCode,
          message: validation.messageArabic,
          totalWordCount: validation.totalWordCount,
          unindexedDocTitles: validation.unindexedDocTitles,
        },
        { status: validation.httpStatus }
      );
    }

    return NextResponse.json({
      success: true,
      allowed: true,
      totalWordCount: validation.totalWordCount,
      message: validation.messageArabic,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
