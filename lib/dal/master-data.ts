import { z } from 'zod';
import type { IDataProvider } from './index';
import type { Branch, EducationalStage, Subject } from './types';
import { MockDataProvider } from './mock-data';

export interface MasterData {
  stages: EducationalStage[];
  subjects: Subject[];
  branches: Branch[];
}

export const emptyMasterData: MasterData = { stages: [], subjects: [], branches: [] };

export const masterDataConflict = 'تم تعديل البيانات أثناء الحفظ. حدّث القائمة وحاول مرة أخرى.';

export class MasterDataError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const catalogRevisionId = '__catalog_revision';

export function masterDataStorageKey(tenantId: string) {
  return `yc-master-data-v1:${tenantId}`;
}

const id = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, 'المعرّف غير صالح')
  .refine(value => value !== catalogRevisionId, 'المعرّف غير صالح');
const name = (message: string) => z.string().trim().min(1, message);
const order = z.number().int().optional();

export const masterDataActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('saveStage'),
    stage: z.object({ id: id.optional(), nameAr: name('اسم المرحلة التعليمية مطلوب'), order }),
  }),
  z.object({ action: z.literal('deleteStage'), stageId: id }),
  z.object({
    action: z.literal('saveGrade'),
    grade: z.object({
      id: id.optional(),
      stageId: id,
      nameAr: name('اسم الصف الدراسي مطلوب'),
      order,
      hasDivisions: z.boolean().optional(),
      divisions: z.array(z.object({ id, nameAr: name('اسم الشعبة مطلوب') })).optional(),
    }),
  }),
  z.object({ action: z.literal('deleteGrade'), gradeId: id }),
  z.object({
    action: z.literal('saveSubject'),
    subject: z.object({
      id: id.optional(),
      nameAr: name('اسم المادة مطلوب'),
      code: z.string().optional(),
      stage: id,
      grade: id,
    }),
  }),
  z.object({
    action: z.literal('saveSubjectMultiGrade'),
    subject: z.object({
      id: id.optional(),
      nameAr: name('اسم المادة مطلوب'),
      code: z.string().optional(),
      grades: z.array(z.object({
        stage: id,
        grade: id,
      })).min(1, 'اختر صفًا دراسيًا واحدًا على الأقل'),
    }),
  }),
  z.object({ action: z.literal('deleteSubject'), subjectId: id }),
  z.object({
    action: z.literal('saveBranch'),
    branch: z.object({
      id: id.optional(),
      nameAr: name('اسم الفرع مطلوب'),
      address: z.string().optional(),
      phone: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  z.object({ action: z.literal('deleteBranch'), branchId: id }),
]);

export type MasterDataAction = z.infer<typeof masterDataActionSchema>;

export async function readMasterData(dal: IDataProvider, tenantId: string): Promise<MasterData> {
  const [stages, subjects, branches] = await Promise.all([
    dal.getStages(tenantId),
    dal.getSubjects(tenantId),
    dal.getBranches(tenantId),
  ]);
  return { stages, subjects, branches };
}

function checkDeletion(result: { success: boolean; error?: string }) {
  if (!result.success) throw new MasterDataError(400, result.error ?? 'تعذّر حذف البيانات');
  return {};
}

async function editCatalog(dal: MockDataProvider, tenantId: string, input: MasterDataAction) {
  switch (input.action) {
    case 'saveStage':
      return { stage: await dal.saveStage(tenantId, input.stage) };
    case 'deleteStage':
      return checkDeletion(await dal.deleteStage(tenantId, input.stageId));
    case 'saveGrade': {
      const { id: gradeId, stageId } = input.grade;
      const original = dal.stages.find(stage => stage.tenantId === tenantId &&
        stage.grades.some(grade => grade.id === gradeId));
      if (original && original.id !== stageId) {
        throw new MasterDataError(400, 'الصف الدراسي مرتبط بمرحلة أخرى');
      }
      return { grade: await dal.saveGrade(tenantId, input.grade) };
    }
    case 'deleteGrade':
      return checkDeletion(await dal.deleteGrade(tenantId, input.gradeId));
    case 'saveSubject': {
      const { stage, grade } = input.subject;
      if (!dal.stages.some(item => item.tenantId === tenantId && item.id === stage && item.grades.some(row => row.id === grade))) {
        throw new MasterDataError(400, 'اختر صفًا دراسيًا تابعًا للمرحلة المحددة');
      }
      return { subject: await dal.saveSubject(tenantId, input.subject) };
    }
    case 'saveSubjectMultiGrade': {
      const { nameAr, code, grades } = input.subject;
      for (const item of grades) {
        if (!dal.stages.some(st => st.tenantId === tenantId && st.id === item.stage && st.grades.some(row => row.id === item.grade))) {
          throw new MasterDataError(400, 'أحد الصفوف الدراسية غير تابع للمرحلة المحددة');
        }
      }
      const targetNameAr = nameAr.trim();
      const existingMatching = dal.subjects.filter(s =>
        s.tenantId === tenantId &&
        (s.id === input.subject.id || s.nameAr.trim().toLowerCase() === targetNameAr.toLowerCase())
      );

      const saved = [];
      for (const { stage, grade } of grades) {
        const found = existingMatching.find(s => s.stage === stage && s.grade === grade);
        if (found) {
          found.nameAr = targetNameAr;
          if (code !== undefined) found.code = code;
          saved.push(found);
        } else {
          const newSubj = await dal.saveSubject(tenantId, {
            nameAr: targetNameAr,
            code: code || '',
            stage,
            grade,
          });
          saved.push(newSubj);
        }
      }
      return { subjects: saved };
    }
    case 'deleteSubject':
      return checkDeletion(await dal.deleteSubject(tenantId, input.subjectId));
    case 'saveBranch':
      return { branch: await dal.saveBranch(tenantId, input.branch) };
    case 'deleteBranch':
      return checkDeletion(await dal.deleteBranch(tenantId, input.branchId));
  }
}

export async function changeMasterData(
  dal: IDataProvider,
  tenantId: string,
  catalog: MasterData,
  input: MasterDataAction,
  currentMaterials?: Awaited<ReturnType<IDataProvider['getMaterials']>>,
) {
  const editor = new MockDataProvider({ useOperationalFixtures: false });
  editor.setMasterData(tenantId, catalog);
  if (input.action.startsWith('delete')) {
    [editor.users, editor.groups, editor.classrooms, editor.materials, editor.exams] = await Promise.all([
      dal.getUsers(tenantId, { role: 'STUDENT' }),
      dal.getGroups(tenantId),
      dal.getClassrooms(tenantId),
      currentMaterials ?? dal.getMaterials(tenantId),
      dal.getExams(tenantId),
    ]);
  }

  let result: Awaited<ReturnType<typeof editCatalog>>;
  try {
    result = await editCatalog(editor, tenantId, input);
  } catch (cause) {
    if (cause instanceof MasterDataError) throw cause;
    if (cause instanceof Error) throw new MasterDataError(400, cause.message);
    throw cause;
  }
  return { data: await readMasterData(editor, tenantId), result };
}
