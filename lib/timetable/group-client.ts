'use client';

import { useEffect, useRef, useState } from 'react';
import type { Classroom, Group, Tenant, UserRole } from '@/lib/dal/types';
import type { MasterData } from '@/lib/dal/master-data';
import { getDataProvider } from '@/lib/dal/factory';
import type { FirebaseAuthSessionState } from '@/lib/firebase/client';
import { readDemoTeacherProfiles } from '@/lib/teachers/client';
import {
  archiveClassroom, archiveGroup, buildClassroom, buildGroup, classroomInputSchema, groupConflictMessage,
  mergeManagedRecords, type ClassroomInput, type GroupInput,
} from './group-schedule';

function parseSavedGroups(raw: string | null, tenantId: string): Group[] {
  const snapshot = raw === null ? [] : JSON.parse(raw);
  const records = Array.isArray(snapshot) ? snapshot : snapshot?.groups;
  if (!Array.isArray(records) || !records.every(row => row && row.tenantId === tenantId &&
    typeof row.id === 'string' && ((Array.isArray(row.weeklySlots) && row.weeklySlots.length && row.pricing) ||
      (typeof row.archivedAt === 'string' && row.isActive === false)))) {
    throw new Error('تعذّر قراءة المجموعات المحفوظة في هذا المتصفح');
  }
  return records;
}

function parseSavedClassrooms(raw: string | null, tenantId: string): Classroom[] {
  const rooms = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(rooms) || !rooms.every(room => room?.tenantId === tenantId && typeof room.id === 'string' &&
    classroomInputSchema.safeParse(room).success)) {
    throw new Error('تعذّر قراءة القاعات المحفوظة في هذا المتصفح');
  }
  return rooms;
}

function writeDemoData(key: string, data: object, label: string) {
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error(`تعذّر حفظ ${label} في هذا المتصفح. تحقّق من مساحة التخزين وإعدادات المتصفح.`);
  }
}

function loadDemoGroups(key: string, tenantId: string, slug: string) {
  const raw = window.localStorage.getItem(key);
  const groups = parseSavedGroups(raw, tenantId);
  if (slug !== 'al-maher' || !raw || !Array.isArray(JSON.parse(raw))) return groups;

  // Reset the old demo data once. New groups use the snapshot format.
  const archived = groups.map(group => archiveGroup(group));
  writeDemoData(key, { groups: archived }, 'المجموعات');
  return archived;
}

export function readDemoSchedule(tenantId: string) {
  const groupKey = `yc-center-groups-v1:${tenantId}`;
  const roomKey = `yc-center-classrooms-v1:${tenantId}`;
  const catalogKey = `yc-master-data-v1:${tenantId}`;
  const storage = window.localStorage;
  const groups = storage.getItem(groupKey);
  const rooms = storage.getItem(roomKey);
  const catalog = storage.getItem(catalogKey);
  const dal = getDataProvider();
  const storedGroups = parseSavedGroups(groups, tenantId);
  const storedRooms = parseSavedClassrooms(rooms, tenantId);
  dal.setManagedGroups(tenantId, storedGroups);
  dal.setManagedClassrooms(tenantId, storedRooms);

  function verifyCurrent() {
    if (storage.getItem(groupKey) !== groups || storage.getItem(roomKey) !== rooms ||
      storage.getItem(catalogKey) !== catalog) throw new Error(groupConflictMessage);
  }

  return { storedGroups, storedRooms, verifyCurrent };
}

async function requestGroups<T>(slug: string, token: string, input?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/center/${encodeURIComponent(slug)}/groups`, {
    cache: 'no-store', signal, method: input ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(input ? { 'Content-Type': 'application/json' } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? 'تعذّر الاتصال بخدمة المجموعات');
  return result as T;
}

export function useCenterGroups(tenant: Tenant, catalog: MasterData, auth: FirebaseAuthSessionState, role: UserRole) {
  const demo = !auth.configured;
  const token = auth.idToken;
  const account = auth.user?.uid ?? token;
  const { id: tenantId, slug } = tenant;
  const key = `yc-center-groups-v1:${tenantId}`;
  const roomsKey = `yc-center-classrooms-v1:${tenantId}`;
  const [state, setState] = useState<{ tenantId: string; account: string | null; groups: Group[]; canEdit: boolean; error?: string }>();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [revision, setRevision] = useState(0);
  const managedGroups = useRef<Group[]>([]);
  const managedClassrooms = useRef<Classroom[]>([]);
  const request = useRef(0);
  const current = state?.tenantId === tenantId && state.account === account ? state : undefined;
  const canEdit = Boolean(current && !current.error && (demo
    ? ['CENTER_ADMIN', 'PLATFORM_OWNER'].includes(role) : token && current.canEdit));

  useEffect(() => {
    if (!demo && !token) {
      getDataProvider().setManagedGroups(tenantId, []);
      getDataProvider().setManagedClassrooms(tenantId, []);
      return;
    }

    const controller = new AbortController();
    async function load() {
      const sequence = ++request.current;
      const active = () => !controller.signal.aborted && sequence === request.current;
      const dal = getDataProvider();
      try {
        const stored = demo
          ? { groups: loadDemoGroups(key, tenantId, slug),
            classrooms: parseSavedClassrooms(window.localStorage.getItem(roomsKey), tenantId), canEdit: true }
          : await requestGroups<{ groups: Group[]; classrooms: Classroom[]; canEdit: boolean }>(slug, token!, undefined, controller.signal);
        if (!active()) return;
        managedGroups.current = stored.groups;
        managedClassrooms.current = stored.classrooms;
        dal.setManagedGroups(tenantId, stored.groups);
        dal.setManagedClassrooms(tenantId, stored.classrooms);
        const [groups, rooms] = await Promise.all([dal.getGroups(tenantId), dal.getClassrooms(tenantId)]);
        if (!active()) return;
        setState({ tenantId, account, groups, canEdit: stored.canEdit });
        setClassrooms(rooms);
      } catch (cause) {
        if (!active()) return;
        const error = cause instanceof Error ? cause.message : 'تعذّر تحميل المجموعات';
        setState(previous => previous?.tenantId === tenantId && previous.account === account ? { ...previous, error }
          : { tenantId, account, error, groups: [], canEdit: false });
      }
    }
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === roomsKey || event.key === null) void load();
    };
    void load();
    if (demo) window.addEventListener('storage', sync);
    return () => {
      controller.abort();
      if (demo) window.removeEventListener('storage', sync);
    };
  }, [account, demo, key, revision, roomsKey, slug, tenantId, token]);

  async function applyGroups(records: Group[]) {
    request.current += 1;
    const dal = getDataProvider();
    managedGroups.current = records;
    dal.setManagedGroups(tenantId, records);
    setState({ tenantId, account, groups: await dal.getGroups(tenantId), canEdit: true });
  }

  async function applyClassrooms(records: Classroom[]) {
    request.current += 1;
    const dal = getDataProvider();
    managedClassrooms.current = records;
    dal.setManagedClassrooms(tenantId, records);
    setClassrooms(await dal.getClassrooms(tenantId));
  }

  async function save(input: GroupInput) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحفظ المجموعة');
    if (!demo) {
      const { group } = await requestGroups<{ group: Group }>(slug, token!, input);
      await applyGroups(mergeManagedRecords(managedGroups.current, [group]));
      return group;
    }

    const dal = getDataProvider();
    const snapshot = readDemoSchedule(tenantId);
    const [groups, classrooms, users] = await Promise.all([
      dal.getGroups(tenantId), dal.getClassrooms(tenantId), dal.getUsers(tenantId, { role: 'TEACHER' }),
    ]);
    const teachers = new Map(users.map(user => [user.id, {
      id: user.id, fullName: user.fullName, isActive: user.isActive,
    }]));
    for (const profile of readDemoTeacherProfiles(tenantId)) teachers.set(profile.id, {
      id: profile.id, fullName: profile.fullName, isActive: profile.active,
    });
    const group = buildGroup(tenantId, input, { ...catalog, groups, classrooms, teachers: [...teachers.values()] });
    const next = mergeManagedRecords(snapshot.storedGroups, [group]);
    snapshot.verifyCurrent();
    writeDemoData(key, { groups: next }, 'المجموعات');
    await applyGroups(next);
    return group;
  }

  async function deleteGroups(selection: Group[]) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحذف المجموعات');
    const targets = selection.map(group => ({ id: group.id, version: group.version ?? 0 }));
    if (!demo) {
      const { groups } = await requestGroups<{ groups: Group[] }>(slug, token!, { action: 'deleteGroups', groups: targets });
      await applyGroups(mergeManagedRecords(managedGroups.current, groups));
      return;
    }

    const snapshot = readDemoSchedule(tenantId);
    const groups = new Map((await getDataProvider().getGroups(tenantId)).map(group => [group.id, group]));
    const archived = targets.map(({ id, version }) => {
      const group = groups.get(id);
      if (group?.archivedAt) return group;
      if (!group?.isActive || (group.version ?? 0) !== version) throw new Error(groupConflictMessage);
      return archiveGroup(group);
    });
    const next = mergeManagedRecords(snapshot.storedGroups, archived);
    snapshot.verifyCurrent();
    writeDemoData(key, { groups: next }, 'المجموعات');
    await applyGroups(next);
  }

  async function saveClassroom(input: ClassroomInput) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحفظ القاعة');
    const parsed = classroomInputSchema.parse(input);
    if (!demo) {
      const { room } = await requestGroups<{ room: Classroom }>(slug, token!, { action: 'saveClassroom', room: parsed });
      await applyClassrooms(mergeManagedRecords(managedClassrooms.current, [room]));
      return room;
    }

    const snapshot = readDemoSchedule(tenantId);
    const room = buildClassroom(tenantId, parsed, catalog.branches, await getDataProvider().getClassrooms(tenantId));
    const next = mergeManagedRecords(snapshot.storedRooms, [room]);
    snapshot.verifyCurrent();
    writeDemoData(roomsKey, next, 'القاعات');
    await applyClassrooms(next);
    return room;
  }

  async function deleteClassroom(room: Classroom) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحذف القاعة');
    if (!demo) {
      const input = { id: room.id, branchId: room.branchId };
      const { room: archived } = await requestGroups<{ room: Classroom }>(slug, token!, { action: 'deleteClassroom', room: input });
      await applyClassrooms(mergeManagedRecords(managedClassrooms.current, [archived]));
      return;
    }

    const dal = getDataProvider();
    const snapshot = readDemoSchedule(tenantId);
    const [rooms, groups] = await Promise.all([dal.getClassrooms(tenantId, room.branchId), dal.getGroups(tenantId)]);
    const existing = rooms.find(item => item.id === room.id);
    if (!existing) throw new Error('القاعة غير موجودة في هذا الفرع');
    const next = mergeManagedRecords(snapshot.storedRooms, [archiveClassroom(existing, groups)]);
    snapshot.verifyCurrent();
    writeDemoData(roomsKey, next, 'القاعات');
    await applyClassrooms(next);
  }

  return {
    groups: current?.groups ?? [], classrooms: current ? classrooms : [], canEdit, save, deleteGroups,
    saveClassroom, deleteClassroom, error: current?.error,
    ready: Boolean(current && !current.error), loading: auth.loading || Boolean((demo || token) && !current),
    refresh: () => setRevision(value => value + 1),
  };
}
