import type { IDataProvider } from '@/lib/dal';
import { MockDataProvider } from '@/lib/dal/mock-data';
import type { Classroom, Group, Tenant } from '@/lib/dal/types';
import { buildClassroom, buildGroup, GroupScheduleError, mergeManagedGroups, type ClassroomInput, type GroupInput } from '@/lib/timetable/group-schedule';
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
  const rows = await store.queryCollection<Classroom>(roomCollection, [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }]);
  return rows.map(row => row.data);
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
  const revisionPath = `${revisionCollection}/${tenantId}`;
  const revision = await store.getDocument(revisionPath);
  if (revision.exists && !revision.updateTime) throw new GroupScheduleError(503, 'تعذّر التحقق من إصدار الجدول');

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
    groups: mergeManagedGroups(base, managed), ...catalog, classrooms: [...classrooms, ...rooms], teachers: [...teacherRefs.values()],
  });
  await store.commit([
    {
      type: 'set', documentPath: revisionPath, data: { tenantId, updatedAt: new Date().toISOString() },
      currentDocument: revision.exists ? { updateTime: revision.updateTime } : { exists: false },
    },
    {
      type: 'set', documentPath: `${collection}/${tenantId}~${group.id}`, data: { ...group },
      currentDocument: { exists: managed.some(item => item.id === group.id) },
    },
  ]);
  return group;
}

export async function saveManagedClassroom(context: GroupContext, input: ClassroomInput) {
  const { tenant, store, dal } = context;
  const [catalog, rooms, seeded] = await Promise.all([
    listMasterData(context), listManagedClassrooms(store, tenant.id), dal.getClassrooms(tenant.id),
  ]);
  const room = buildClassroom(tenant.id, input, catalog.branches, [...seeded, ...rooms]);
  const nameKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${room.branchId}:${room.nameAr.toLocaleLowerCase('ar')}`));
  const stableId = Array.from(new Uint8Array(nameKey), byte => byte.toString(16).padStart(2, '0')).join('');
  await store.commit([{
    type: 'set', documentPath: `${roomCollection}/${tenant.id}~${stableId}`, data: { ...room },
    currentDocument: { exists: false },
  }]);
  return room;
}

export async function loadGroupProvider(store: ILessonScoreStore, tenant: Tenant) {
  const dal = new MockDataProvider();
  const [groups, catalog, rooms] = await Promise.all([
    listManagedGroups(store, tenant.id), listMasterData({ store, dal, tenant }), listManagedClassrooms(store, tenant.id),
  ]);
  dal.setManagedGroups(tenant.id, groups);
  dal.setMasterData(tenant.id, catalog);
  dal.setManagedClassrooms(tenant.id, rooms);
  return dal;
}
