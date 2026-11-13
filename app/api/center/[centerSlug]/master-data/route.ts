import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  FirestoreHttpError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';
import {
  assertMasterDataAdmin,
  assertTenantStaffMember,
  deleteBranchItem,
  deleteGradeItem,
  deleteStageItem,
  deleteSubjectItem,
  listMasterData,
  MasterDataContext,
  MasterDataServiceError,
  saveBranchItem,
  saveGradeItem,
  saveStageItem,
  saveSubjectItem,
} from '@/lib/firebase/master-data-service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

const stageInputSchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().min(1, 'اسم المرحلة التعليمية مطلوب'),
  order: z.number().int().optional(),
});

const gradeInputSchema = z.object({
  id: z.string().optional(),
  stageId: z.string().min(1, 'المرحلة التابعة مطلوبة'),
  nameAr: z.string().min(1, 'اسم الصف الدراسي مطلوب'),
  order: z.number().int().optional(),
  hasDivisions: z.boolean().optional(),
  divisions: z
    .array(
      z.object({
        id: z.string(),
        nameAr: z.string(),
      })
    )
    .optional(),
});

const subjectInputSchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().min(1, 'اسم المادة مطلوب'),
  code: z.string().optional(),
  stage: z.string().min(1, 'المرحلة التعليمية مطلوبة'),
  grade: z.string().min(1, 'الصف الدراسي مطلوب'),
});

const branchInputSchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().min(1, 'اسم الفرع مطلوب'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('saveStage'), stage: stageInputSchema }),
  z.object({ action: z.literal('deleteStage'), stageId: z.string().min(1, 'معرف المرحلة مطلوب') }),
  z.object({ action: z.literal('saveGrade'), grade: gradeInputSchema }),
  z.object({ action: z.literal('deleteGrade'), gradeId: z.string().min(1, 'معرف الصف مطلوب') }),
  z.object({ action: z.literal('saveSubject'), subject: subjectInputSchema }),
  z.object({ action: z.literal('deleteSubject'), subjectId: z.string().min(1, 'معرف المادة مطلوب') }),
  z.object({ action: z.literal('saveBranch'), branch: branchInputSchema }),
  z.object({ action: z.literal('deleteBranch'), branchId: z.string().min(1, 'معرف الفرع مطلوب') }),
]);

async function resolveContext(
  req: NextRequest,
  centerSlug: string,
  requireAdmin = false
): Promise<{ context: MasterDataContext; uid?: string }> {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);
  if (!tenant || !tenant.isActive) {
    throw new MasterDataServiceError(404, 'السنتر غير موجود أو غير مفعل');
  }

  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (bearer) {
    try {
      const verified = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      if (requireAdmin) {
        await assertMasterDataAdmin(store, verified.uid, tenant.id);
      } else {
        await assertTenantStaffMember(store, verified.uid, tenant.id);
      }
      return { context: { tenant, store, dal }, uid: verified.uid };
    } catch (err) {
      if (err instanceof FirebaseAuthError || err instanceof MasterDataServiceError) {
        throw err;
      }
      // If Firestore REST failed, fall through to in-memory DAL for demo/offline resilience
      console.warn('Firestore connection failed in master-data route, using DAL:', err);
    }
  }

  // When no bearer token is supplied or during offline/mock fallback:
  return { context: { tenant, store: null, dal } };
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof MasterDataServiceError || error instanceof FirebaseAuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (error instanceof FirestoreHttpError) {
    if ([409, 412].includes(error.status)) {
      return NextResponse.json(
        { success: false, error: 'تم تعديل البيانات بواسطة مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { success: false, error: 'خطأ في الاتصال بقاعدة بيانات Cloud Firestore' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (error instanceof Error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { success: false, error: 'حدث خطأ غير متوقع أثناء معالجة الطلب' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { context } = await resolveContext(req, resolvedParams.centerSlug, false);
    const data = await listMasterData(context);

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const body = await req.json().catch(() => null);
    const parseResult = actionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message || 'بيانات الطلب غير صالحة' },
        { status: 400 }
      );
    }

    const { context } = await resolveContext(req, resolvedParams.centerSlug, true);
    const actionData = parseResult.data;

    switch (actionData.action) {
      case 'saveStage': {
        const stage = await saveStageItem(context, actionData.stage);
        return NextResponse.json({ success: true, stage });
      }
      case 'deleteStage': {
        const result = await deleteStageItem(context, actionData.stageId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }
      case 'saveGrade': {
        const grade = await saveGradeItem(context, actionData.grade);
        return NextResponse.json({ success: true, grade });
      }
      case 'deleteGrade': {
        const result = await deleteGradeItem(context, actionData.gradeId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }
      case 'saveSubject': {
        const subject = await saveSubjectItem(context, actionData.subject);
        return NextResponse.json({ success: true, subject });
      }
      case 'deleteSubject': {
        const result = await deleteSubjectItem(context, actionData.subjectId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }
      case 'saveBranch': {
        const branch = await saveBranchItem(context, actionData.branch);
        return NextResponse.json({ success: true, branch });
      }
      case 'deleteBranch': {
        const result = await deleteBranchItem(context, actionData.branchId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}
