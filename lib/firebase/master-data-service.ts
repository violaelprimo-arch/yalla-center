import type { IDataProvider } from '@/lib/dal';
import type {
  Branch,
  BranchInput,
  EducationalGrade,
  EducationalGradeInput,
  EducationalStage,
  EducationalStageInput,
  Subject,
  SubjectInput,
  Tenant,
} from '@/lib/dal/types';
import { buildDefaultStages, INITIAL_SEEDED_DATA } from '@/lib/dal/mock-data';
import type { FirestoreWriteOperation } from './firestore-rest';
import type { ILessonScoreStore, StaffMembershipRecord } from './server';

export class MasterDataServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'MasterDataServiceError';
  }
}

export interface MasterDataContext {
  tenant: Tenant;
  store: ILessonScoreStore | null;
  dal: IDataProvider;
}

export function stageDocPath(tenantId: string, stageId: string): string {
  return `master_stages/${tenantId}~${stageId}`;
}

export function subjectDocPath(tenantId: string, subjectId: string): string {
  return `master_subjects/${tenantId}~${subjectId}`;
}

export function branchDocPath(tenantId: string, branchId: string): string {
  return `master_branches/${tenantId}~${branchId}`;
}

export async function assertMasterDataAdmin(
  store: ILessonScoreStore | null,
  uid: string,
  tenantId: string
): Promise<void> {
  if (!store) {
    // In DAL/mock mode without active Firestore store, allow operation
    return;
  }
  const membership = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (
    membership.exists &&
    membership.data.isActive &&
    (membership.data.role === 'PLATFORM_OWNER' ||
      (membership.data.tenantId === tenantId && membership.data.role === 'CENTER_ADMIN'))
  ) {
    return;
  }
  throw new MasterDataServiceError(403, 'صلاحية مدير السنتر مطلوبة لتعديل البيانات الأساسية');
}

export async function assertTenantStaffMember(
  store: ILessonScoreStore | null,
  uid: string,
  tenantId: string
): Promise<void> {
  if (!store) return;
  const membership = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (
    membership.exists &&
    membership.data.isActive &&
    (membership.data.role === 'PLATFORM_OWNER' || membership.data.tenantId === tenantId)
  ) {
    return;
  }
  throw new MasterDataServiceError(403, 'غير مصرح بالوصول إلى بيانات هذا السنتر');
}

/**
 * Idempotent initialization of master data in Cloud Firestore.
 * If stages/subjects/branches do not exist in Firestore for this tenant,
 * writes the default seeds with stable IDs without overwriting existing data.
 */
export async function ensureMasterDataSeeded(
  store: ILessonScoreStore,
  tenant: Tenant,
  dal: IDataProvider
): Promise<void> {
  const existingStages = await store.queryCollection<EducationalStage>('master_stages', [
    { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
  ]);

  if (existingStages.length === 0) {
    const defaultStages = buildDefaultStages(tenant.id);
    const writes: FirestoreWriteOperation[] = defaultStages.map((stage) => ({
      type: 'set',
      documentPath: stageDocPath(tenant.id, stage.id),
      data: {
        ...stage,
        tenantId: tenant.id,
        createdAt: new Date().toISOString(),
      },
    }));

    // Default branches
    const dalBranches = await dal.getBranches(tenant.id);
    const branchesToSeed =
      dalBranches.length > 0
        ? dalBranches
        : INITIAL_SEEDED_DATA.branches.filter((b) => b.tenantId === tenant.id);

    for (const branch of branchesToSeed) {
      writes.push({
        type: 'set',
        documentPath: branchDocPath(tenant.id, branch.id),
        data: {
          ...branch,
          tenantId: tenant.id,
        },
      });
    }

    // Default subjects
    const dalSubjects = await dal.getSubjects(tenant.id);
    const subjectsToSeed =
      dalSubjects.length > 0
        ? dalSubjects
        : INITIAL_SEEDED_DATA.subjects.filter((s) => s.tenantId === tenant.id);

    for (const subj of subjectsToSeed) {
      writes.push({
        type: 'set',
        documentPath: subjectDocPath(tenant.id, subj.id),
        data: {
          ...subj,
          tenantId: tenant.id,
        },
      });
    }

    if (writes.length > 0) {
      await store.commit(writes);
    }
  }
}

export async function listMasterData({ tenant, store, dal }: MasterDataContext): Promise<{
  stages: EducationalStage[];
  subjects: Subject[];
  branches: Branch[];
}> {
  if (store) {
    try {
      await ensureMasterDataSeeded(store, tenant, dal);

      const [stagesRows, subjectsRows, branchesRows] = await Promise.all([
        store.queryCollection<EducationalStage>('master_stages', [
          { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
        ]),
        store.queryCollection<Subject>('master_subjects', [
          { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
        ]),
        store.queryCollection<Branch>('master_branches', [
          { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
        ]),
      ]);

      const stages = stagesRows.map((r) => r.data).sort((a, b) => (a.order || 0) - (b.order || 0));
      const subjects = subjectsRows.map((r) => r.data);
      const branches = branchesRows.map((r) => r.data);

      return { stages, subjects, branches };
    } catch (error) {
      console.warn('Failed to read master data from Firestore, falling back to DAL:', error);
    }
  }

  // Fallback to DAL
  const [stages, subjects, branches] = await Promise.all([
    dal.getStages(tenant.id),
    dal.getSubjects(tenant.id),
    dal.getBranches(tenant.id),
  ]);

  return { stages, subjects, branches };
}

export async function saveStageItem(
  { tenant, store, dal }: MasterDataContext,
  input: EducationalStageInput
): Promise<EducationalStage> {
  const stage = await dal.saveStage(tenant.id, input);

  if (store) {
    try {
      await store.commit([
        {
          type: 'set',
          documentPath: stageDocPath(tenant.id, stage.id),
          data: {
            ...stage,
            updatedAt: new Date().toISOString(),
          },
        },
      ]);
    } catch (error) {
      console.warn('Failed to commit stage to Firestore:', error);
    }
  }

  return stage;
}

export async function deleteStageItem(
  { tenant, store, dal }: MasterDataContext,
  stageId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await dal.deleteStage(tenant.id, stageId);
  if (!result.success) {
    return result;
  }

  if (store) {
    try {
      await store.commit([
        {
          type: 'delete',
          documentPath: stageDocPath(tenant.id, stageId),
        },
      ]);
    } catch (error) {
      console.warn('Failed to delete stage from Firestore:', error);
    }
  }

  return { success: true };
}

export async function saveGradeItem(
  { tenant, store, dal }: MasterDataContext,
  input: EducationalGradeInput
): Promise<EducationalGrade> {
  const grade = await dal.saveGrade(tenant.id, input);

  if (store) {
    try {
      const stage = (await dal.getStages(tenant.id)).find((s) => s.id === input.stageId);
      if (stage) {
        await store.commit([
          {
            type: 'set',
            documentPath: stageDocPath(tenant.id, stage.id),
            data: {
              ...stage,
              updatedAt: new Date().toISOString(),
            },
          },
        ]);
      }
    } catch (error) {
      console.warn('Failed to commit updated stage grades to Firestore:', error);
    }
  }

  return grade;
}

export async function deleteGradeItem(
  { tenant, store, dal }: MasterDataContext,
  gradeId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await dal.deleteGrade(tenant.id, gradeId);
  if (!result.success) {
    return result;
  }

  if (store) {
    try {
      const stages = await dal.getStages(tenant.id);
      for (const stage of stages) {
        await store.commit([
          {
            type: 'set',
            documentPath: stageDocPath(tenant.id, stage.id),
            data: {
              ...stage,
              updatedAt: new Date().toISOString(),
            },
          },
        ]);
      }
    } catch (error) {
      console.warn('Failed to commit updated stage grades to Firestore after grade deletion:', error);
    }
  }

  return { success: true };
}

export async function saveSubjectItem(
  { tenant, store, dal }: MasterDataContext,
  input: SubjectInput
): Promise<Subject> {
  const subject = await dal.saveSubject(tenant.id, input);

  if (store) {
    try {
      await store.commit([
        {
          type: 'set',
          documentPath: subjectDocPath(tenant.id, subject.id),
          data: {
            ...subject,
            updatedAt: new Date().toISOString(),
          },
        },
      ]);
    } catch (error) {
      console.warn('Failed to commit subject to Firestore:', error);
    }
  }

  return subject;
}

export async function deleteSubjectItem(
  { tenant, store, dal }: MasterDataContext,
  subjectId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await dal.deleteSubject(tenant.id, subjectId);
  if (!result.success) {
    return result;
  }

  if (store) {
    try {
      await store.commit([
        {
          type: 'delete',
          documentPath: subjectDocPath(tenant.id, subjectId),
        },
      ]);
    } catch (error) {
      console.warn('Failed to delete subject from Firestore:', error);
    }
  }

  return { success: true };
}

export async function saveBranchItem(
  { tenant, store, dal }: MasterDataContext,
  input: BranchInput
): Promise<Branch> {
  const branch = await dal.saveBranch(tenant.id, input);

  if (store) {
    try {
      await store.commit([
        {
          type: 'set',
          documentPath: branchDocPath(tenant.id, branch.id),
          data: {
            ...branch,
            updatedAt: new Date().toISOString(),
          },
        },
      ]);
    } catch (error) {
      console.warn('Failed to commit branch to Firestore:', error);
    }
  }

  return branch;
}

export async function deleteBranchItem(
  { tenant, store, dal }: MasterDataContext,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await dal.deleteBranch(tenant.id, branchId);
  if (!result.success) {
    return result;
  }

  if (store) {
    try {
      await store.commit([
        {
          type: 'delete',
          documentPath: branchDocPath(tenant.id, branchId),
        },
      ]);
    } catch (error) {
      console.warn('Failed to delete branch from Firestore:', error);
    }
  }

  return { success: true };
}
