import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { CreateMaterialInput, DocumentCategory, MaterialIndexStatus } from '@/lib/dal/types';

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
    const stage = searchParams.get('stage') || undefined;
    const grade = searchParams.get('grade') || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;
    const indexStatus = (searchParams.get('indexStatus') as MaterialIndexStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const materials = await dal.getMaterials(tenant.id, {
      stage,
      grade,
      subjectId,
      indexStatus,
      search,
    });

    const stats = await dal.getMaterialsStats(tenant.id);

    return NextResponse.json({
      success: true,
      materials,
      stats,
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
      googleDriveUrlOrId,
      title,
      teacherId,
      stage,
      grade,
      subjectId,
      unitName,
      lessonName,
      category,
      autoIndex,
      fileUrl,
      textContentIndexed,
    } = body;

    if (!stage || !grade || !subjectId || !unitName || !lessonName) {
      return NextResponse.json(
        { error: 'جميع حقول التصنيف الأكاديمي مطلوبة (المرحلة، الصف، المادة، الوحدة، الدرس)' },
        { status: 400 }
      );
    }

    // Google Drive linking flow
    if (googleDriveUrlOrId) {
      const material = await dal.linkGoogleDriveDocument(tenant.id, {
        googleDriveUrlOrId,
        teacherId: teacherId || 'user-teacher-phys',
        stage,
        grade,
        subjectId,
        unitName,
        lessonName,
        title,
        category: category as DocumentCategory,
        autoIndex: autoIndex !== false,
      });

      return NextResponse.json({ success: true, material }, { status: 201 });
    }

    // Direct file creation flow
    const materialInput: CreateMaterialInput = {
      tenantId: tenant.id,
      teacherId: teacherId || 'user-teacher-phys',
      stage,
      grade,
      subjectId,
      unitName,
      lessonName,
      title: title || 'مذكرة دراسية جديدة',
      category: category as DocumentCategory,
      fileUrl: fileUrl || '/materials/document.pdf',
      textContentIndexed,
      indexImmediately: autoIndex !== false,
    };

    const material = await dal.createMaterial(materialInput);
    return NextResponse.json({ success: true, material }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create material' },
      { status: 400 }
    );
  }
}
