import type { IDataProvider } from '@/lib/dal';
import {
  catalogRevisionId,
  changeMasterData,
  MasterDataError,
  readMasterData,
  type MasterData,
  type MasterDataAction,
} from '@/lib/dal/master-data';
import type { Tenant } from '@/lib/dal/types';
import type { FirestoreWriteOperation, StructuredFilter } from './firestore-rest';
import type { ILessonScoreStore, StaffMembershipRecord } from './server';

export interface MasterDataContext {
  tenant: Tenant;
  store: ILessonScoreStore;
  dal: IDataProvider;
}

export async function authorizeMasterData(
  store: ILessonScoreStore,
  uid: string,
  tenantId: string,
  requireAdmin: boolean
) {
  const membership = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (membership.exists && membership.data.isActive) {
    const { role, tenantId: memberTenantId } = membership.data;
    const canEdit = role === 'PLATFORM_OWNER' || (memberTenantId === tenantId && role === 'CENTER_ADMIN');
    if (canEdit || (!requireAdmin && memberTenantId === tenantId)) {
      return canEdit;
    }
  }
  throw new MasterDataError(403, requireAdmin
    ? 'صلاحية مدير السنتر مطلوبة لتعديل البيانات الأساسية'
    : 'غير مصرح بالوصول إلى بيانات هذا السنتر');
}

async function readCatalog({ tenant, store, dal }: MasterDataContext) {
  const tenantId = tenant.id;
  const revisionId = `${tenantId}~${catalogRevisionId}`;
  // Read the revision first so every write is guarded against concurrent catalog changes.
  const filter: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  const stages = await store.queryCollection<MasterData['stages'][number]>('master_stages', filter);
  const revision = stages.find(row => row.id === revisionId);
  const [subjects, branches] = await Promise.all([
    store.queryCollection<MasterData['subjects'][number]>('master_subjects', filter),
    store.queryCollection<MasterData['branches'][number]>('master_branches', filter),
  ]);

  const stored: MasterData = {
    stages: stages.filter(row => row.id !== revisionId)
      .map(row => row.data).sort((a, b) => a.order - b.order),
    subjects: subjects.map(row => row.data),
    branches: branches.map(row => row.data),
  };
  const data = revision || stored.stages.length ? stored : {
    ...await readMasterData(dal, tenantId),
    ...(stored.subjects.length ? { subjects: stored.subjects } : {}),
    ...(stored.branches.length ? { branches: stored.branches } : {}),
  };
  return { data, stored, revision, revisionPath: `master_stages/${revisionId}` };
}

export async function listMasterData(context: MasterDataContext): Promise<MasterData> {
  return (await readCatalog(context)).data;
}

function catalogWrites<T extends { id: string }>(
  path: string,
  previous: T[],
  next: T[],
): FirestoreWriteOperation[] {
  const existing = new Map(previous.map(record => [record.id, record]));
  const writes: FirestoreWriteOperation[] = [];
  for (const record of next) {
    if (JSON.stringify(existing.get(record.id)) !== JSON.stringify(record)) {
      writes.push({
        type: 'set',
        documentPath: path + record.id,
        data: { ...record },
        currentDocument: { exists: existing.has(record.id) },
      });
    }
    existing.delete(record.id);
  }
  for (const id of existing.keys()) {
    writes.push({ type: 'delete', documentPath: path + id, currentDocument: { exists: true } });
  }
  return writes;
}

export async function saveMasterData(context: MasterDataContext, input: MasterDataAction, scheduleWrite?: FirestoreWriteOperation) {
  const { tenant, dal, store } = context;
  const { data, stored, revision, revisionPath } = await readCatalog(context);
  const change = await changeMasterData(dal, tenant.id, data, input);
  const writes = [
    ...catalogWrites(`master_stages/${tenant.id}~`, stored.stages, change.data.stages),
    ...catalogWrites(`master_subjects/${tenant.id}~`, stored.subjects, change.data.subjects),
    ...catalogWrites(`master_branches/${tenant.id}~`, stored.branches, change.data.branches),
  ];

  if (revision && !revision.updateTime) {
    throw new MasterDataError(503, 'تعذّر التحقق من إصدار البيانات الأساسية');
  }
  await store.commit([
    ...(scheduleWrite ? [scheduleWrite] : []),
    {
      type: 'set',
      documentPath: revisionPath,
      data: { tenantId: tenant.id, nameAr: '', updatedAt: new Date().toISOString() },
      currentDocument: revision ? { updateTime: revision.updateTime } : { exists: false },
    },
    ...writes,
  ]);

  return change;
}
