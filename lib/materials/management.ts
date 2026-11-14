import { z } from 'zod';
import type { IDataProvider } from '@/lib/dal';
import type { MasterData } from '@/lib/dal/master-data';
import type { Material } from '@/lib/dal/types';
import { parseGoogleDriveInput } from './drive';

const materialIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/, 'المعرّف غير صالح');
const requiredText = (message: string) => z.string().trim().min(1, message);
export const materialDetailsSchema = z.object({
  title: requiredText('عنوان المذكرة مطلوب').max(300),
  description: z.string().trim().max(4000).optional(),
  stage: materialIdSchema,
  grade: materialIdSchema,
  subjectId: materialIdSchema,
  unitName: requiredText('اسم الوحدة مطلوب').max(200),
  lessonName: requiredText('اسم الدرس مطلوب').max(200),
  category: z.enum(['lecture_notes', 'summary', 'exercises', 'exam_bank', 'formula_sheet']).optional(),
  googleDriveUrlOrId: z.string().trim().max(2000).optional(),
});

export const createMaterialSchema = materialDetailsSchema.extend({
  title: materialDetailsSchema.shape.title.optional(),
  teacherId: materialIdSchema.optional(),
  autoIndex: z.boolean().optional(),
  fileUrl: z.string().trim().max(2000).optional(),
  textContentIndexed: z.string().max(100000).optional(),
});
export const updateMaterialSchema = z.object({
  id: materialIdSchema,
  updatedAt: z.string().max(40).optional(),
  details: materialDetailsSchema,
});
export const deleteMaterialSchema = updateMaterialSchema.omit({ details: true });

export type MaterialDetails = z.infer<typeof materialDetailsSchema>;
export type MaterialMutation =
  | { action: 'create'; input: z.infer<typeof createMaterialSchema> }
  | ({ action: 'update' } & z.infer<typeof updateMaterialSchema>)
  | ({ action: 'delete' } & z.infer<typeof deleteMaterialSchema>);

export class MaterialError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const materialConflict = 'تم تعديل المذكرة أثناء العمل. حدّث القائمة وحاول مرة أخرى.';

export function canManageMaterials(role: string) {
  return role === 'CENTER_ADMIN' || role === 'PLATFORM_OWNER';
}

function validateClassification(catalog: MasterData, fields: Pick<Material, 'stage' | 'grade' | 'subjectId'>, existing?: Material) {
  const { stage, grade, subjectId } = fields;
  if (existing?.stage === stage && existing.grade === grade && existing.subjectId === subjectId) return;
  if (!catalog.stages.some(item => item.id === stage && item.grades.some(row => row.id === grade)) ||
      !catalog.subjects.some(item => item.id === subjectId && item.stage === stage && item.grade === grade)) {
    throw new MaterialError(400, 'اختر مادة دراسية تابعة للمرحلة والصف المحددين');
  }
}

function driveMetadata(input: string | undefined) {
  if (!input) return undefined;
  const drive = parseGoogleDriveInput(input);
  if (!drive) throw new MaterialError(400, 'رابط Google Drive غير صالح');
  return drive;
}

export async function changeMaterial(dal: IDataProvider, tenantId: string, catalog: MasterData, actorId: string, mutation: MaterialMutation) {
  if (mutation.action === 'create') {
    const { googleDriveUrlOrId, title, autoIndex, teacherId, fileUrl, ...fields } = mutation.input;
    validateClassification(catalog, fields);
    const drive = driveMetadata(googleDriveUrlOrId);
    return dal.createMaterial({
      ...fields, tenantId, teacherId: teacherId ?? actorId,
      title: title ?? (drive ? `مستند دراسي Google Drive - ${drive.fileId.slice(0, 8)}` : 'مذكرة دراسية جديدة'),
      fileUrl: drive?.webViewLink ?? fileUrl ?? '/materials/document.pdf',
      googleDriveFileId: drive?.fileId, fileType: drive?.suggestedFileType, indexImmediately: autoIndex !== false,
    });
  }

  const existing = await dal.getMaterialById(tenantId, mutation.id);
  if (!existing) {
    if (mutation.action === 'delete') return null;
    throw new MaterialError(404, 'المذكرة غير موجودة');
  }
  if (mutation.updatedAt !== existing.updatedAt) throw new MaterialError(409, materialConflict);
  if (mutation.action === 'delete') {
    await dal.deleteMaterial(tenantId, mutation.id);
    return null;
  }

  const { googleDriveUrlOrId, ...fields } = mutation.details;
  validateClassification(catalog, fields, existing);
  const drive = driveMetadata(googleDriveUrlOrId);
  if (googleDriveUrlOrId === undefined || drive?.fileId === existing.googleDriveFileId) {
    return dal.updateMaterial(tenantId, existing.id, fields);
  }
  const fileUrl = drive?.webViewLink ?? (existing.fileUrl.startsWith('/') ? existing.fileUrl : '');
  return dal.updateMaterial(tenantId, existing.id, { ...fields, fileUrl, fileType: drive?.suggestedFileType ?? existing.fileType });
}
