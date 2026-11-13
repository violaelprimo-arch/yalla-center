import type { IDataProvider } from '@/lib/dal';
import { createCenterDataProvider } from '@/lib/dal/factory';
import type { Classroom, Group, Tenant } from '@/lib/dal/types';
import {
  archiveClassroom, archiveGroup, buildClassroom, buildGroup, groupConflictMessage, GroupScheduleError,
  mergeManagedRecords, type ClassroomInput, type GroupInput,
} from '@/lib/timetable/group-schedule';
import type { FirestoreWriteOperation } from './firestore-rest';
import { listMasterData } from './master-data-service';
import type { ILessonScoreStore, StaffMembershipRecord } from './server';

interface GroupContext {
  tenant: Tenant;
  dal: IDataProvider;
  store: ILessonScoreStore;
}

const collection = 'center_groups';
const roomCollection = 'center_classrooms';
const revisionCollection = 'center_group_revisions';

export async function listManagedGroups(store: ILessonScoreStore, tenantId: string): Promise<Group[]> {
  const rows = await store.queryCollection<Group>(collection, [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }]);
  return rows.map(row => row.data);
}

export async function listManagedClassrooms(store: ILessonScoreStore, tenantId: string): Promise<Classroom[]> {
  const rows = await classroomDocuments(store, tenantId);
  return rows.map(row => row.data);
}

function classroomDocuments(store: ILessonScoreStore, tenantId: string) {
  return store.queryCollection<Classroom>(roomCollection, [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }]);
}

export async function groupRevisionWrite(store: ILessonScoreStore, tenantId: string): Promise<FirestoreWriteOperation> {
  const documentPath = `${revisionCollection}/${tenantId}`;
  const revision = await store.getDocument(documentPath);
  if (revision.exists && !revision.updateTime) throw new GroupScheduleError(503, 'تعذّر التحقق من إصدار الجدول');
  return {
    type: 'set', documentPath, data: { tenantId, updatedAt: new Date().toISOString() },
    currentDocument: revision.exists ? { updateTime: revision.updateTime } : { exists: false },
  };
}

export async function groupStaff(store: ILessonScoreStore, tenant: Tenant, uid: string) {
  const member = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (member.exists && member.data.isActive &&
    ['CENTER_ADMIN', 'PLATFORM_OWNER', 'ACCOUNTANT', 'BRANCH_MANAGER', 'RECEPTIONIST', 'TEACHER'].includes(member.data.role) &&
    (member.data.role === 'PLATFORM_OWNER' || member.data.tenantId === tenant.id)) return member.data;
  throw new GroupScheduleError(403, 'صلاحية الوصول لمجموعات هذا السنتر مطلوبة');
}

export async function saveManagedGroup(context: GroupContext, input: GroupInput) {
  const { tenant, store, dal } = context;
  const tenantId = tenant.id;
  const revision = await groupRevisionWrite(store, tenantId);

  const [managed, base, catalog, classrooms, rooms, users, profiles] = await Promise.all([
    listManagedGroups(store, tenantId),
    dal.getGroups(tenantId),
    listMasterData(context),
    dal.getClassrooms(tenantId),
    listManagedClassrooms(store, tenantId),
    dal.getUsers(tenantId, { role: 'TEACHER' }),
    store.queryCollection<{ id: string; fullName: string; active: boolean }>('teacher_profiles', [
      { fieldPath: 'tenantId', op: 'EQUAL', value: tenantId },
    ]),
  ]);
  const teacherRefs = new Map(users.map(user => [user.id, { id: user.id, fullName: user.fullName, isActive: user.isActive }]));
  for (const { data: profile } of profiles) teacherRefs.set(profile.id, {
    id: profile.id, fullName: profile.fullName, isActive: profile.active,
  });
  const group = buildGroup(tenantId, input, {
    groups: mergeManagedRecords(base, managed), ...catalog, classrooms: mergeManagedRecords(classrooms, rooms),
    teachers: [...teacherRefs.values()],
  });
  await store.commit([
    revision,
    {
      type: 'set', documentPath: `${collection}/${tenantId}~${group.id}`, data: { ...group },
      currentDocument: { exists: managed.some(item => item.id === group.id) },
    },
  ]);
  return group;
}

export async function archiveManagedGroups(context: GroupContext, selection: { id: string; version: number }[]) {
  const { tenant, store, dal } = context;
  const revision = await groupRevisionWrite(store, tenant.id);
  const [base, managed] = await Promise.all([dal.getGroups(tenant.id), listManagedGroups(store, tenant.id)]);
  const all = new Map(mergeManagedRecords(base, managed).map(group => [group.id, group]));
  const managedIds = new Set(managed.map(group => group.id));
  const archived = selection.map(({ id, version }) => {
    const group = all.get(id);
    if (group?.archivedAt) return group;
    if (!group?.isActive || (group.version ?? 0) !== version) throw new GroupScheduleError(409, groupConflictMessage);
    return archiveGroup(group);
  });
  await store.commit([revision, ...archived.map((group): FirestoreWriteOperation => ({
    type: 'set', documentPath: `${collection}/${tenant.id}~${group.id}`, data: { ...group },
    currentDocument: { exists: managedIds.has(group.id) },
  }))]);
  return archived;
}

export async function saveManagedClassroom(context: GroupContext, input: ClassroomInput) {
  const { tenant, store, dal } = context;
  const revision = await groupRevisionWrite(store, tenant.id);
  const [catalog, documents, seeded] = await Promise.all([
    listMasterData(context), classroomDocuments(store, tenant.id), dal.getClassrooms(tenant.id),
  ]);
  const room = buildClassroom(tenant.id, input, catalog.branches, mergeManagedRecords(seeded, documents.map(row => row.data)));
  const existing = documents.find(row => row.data.id === room.id);
  await store.commit([revision, classroomWrite(room, existing?.id)]);
  return room;
}

function classroomWrite(room: Classroom, existingPathId?: string): FirestoreWriteOperation {
  return {
    type: 'set', documentPath: `${roomCollection}/${existingPathId ?? `${room.tenantId}~${room.id}`}`,
    data: { ...room }, currentDocument: { exists: Boolean(existingPathId) },
  };
}

export async function archiveManagedClassroom(context: GroupContext, input: { id: string; branchId: string }) {
  const { tenant, store, dal } = context;
  const revision = await groupRevisionWrite(store, tenant.id);
  const [documents, seeded, groups, managed] = await Promise.all([
    classroomDocuments(store, tenant.id), dal.getClassrooms(tenant.id, input.branchId),
    dal.getGroups(tenant.id), listManagedGroups(store, tenant.id),
  ]);
  const existing = documents.find(row => row.data.id === input.id);
  const room = existing?.data ?? seeded.find(item => item.id === input.id);
  if (!room || room.branchId !== input.branchId) throw new GroupScheduleError(404, 'القاعة غير موجودة في هذا الفرع');
  if (room.archivedAt) return room;
  const archived = archiveClassroom(room, mergeManagedRecords(groups, managed));
  await store.commit([revision, classroomWrite(archived, existing?.id)]);
  return archived;
}

export async function loadGroupProvider(store: ILessonScoreStore, tenant: Tenant) {
  const dal = createCenterDataProvider();
  const [groups, catalog, rooms] = await Promise.all([
    listManagedGroups(store, tenant.id), listMasterData({ store, dal, tenant }), listManagedClassrooms(store, tenant.id),
  ]);
  dal.setManagedGroups(tenant.id, groups);
  dal.setMasterData(tenant.id, catalog);
  dal.setManagedClassrooms(tenant.id, rooms);
  return dal;
}
