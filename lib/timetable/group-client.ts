'use client';

import { useEffect, useRef, useState } from 'react';
import type { Classroom, Group, Tenant, UserRole } from '@/lib/dal/types';
import type { MasterData } from '@/lib/dal/master-data';
import { getDataProvider } from '@/lib/dal/factory';
import type { FirebaseAuthSessionState } from '@/lib/firebase/client';
import { readDemoTeacherProfiles } from '@/lib/teachers/client';
import { buildClassroom, buildGroup, classroomInputSchema, groupConflictMessage, type ClassroomInput, type GroupInput } from './group-schedule';

function storageKey(tenantId: string) {
  return `yc-center-groups-v1:${tenantId}`;
}

function parseSavedGroups(raw: string | null, tenantId: string): Group[] {
  const records = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(records) || !records.every(row => row && row.tenantId === tenantId &&
    typeof row.id === 'string' && Array.isArray(row.weeklySlots) && row.weeklySlots.length && row.pricing)) {
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
  const key = storageKey(tenantId);
  const roomsKey = `yc-center-classrooms-v1:${tenantId}`;
  const [state, setState] = useState<{ account: string | null; groups: Group[]; canEdit: boolean; error?: string }>();
  const [revision, setRevision] = useState(0);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const managedClassrooms = useRef<Classroom[]>([]);
  const request = useRef(0);
  const current = state?.account === account ? state : undefined;
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
          ? { groups: parseSavedGroups(window.localStorage.getItem(key), tenantId),
            classrooms: parseSavedClassrooms(window.localStorage.getItem(roomsKey), tenantId), canEdit: true }
          : await requestGroups<{ groups: Group[]; classrooms: Classroom[]; canEdit: boolean }>(slug, token!, undefined, controller.signal);
        if (!active()) return;
        dal.setManagedGroups(tenantId, stored.groups);
        managedClassrooms.current = stored.classrooms;
        dal.setManagedClassrooms(tenantId, stored.classrooms);
        const [groups, rooms] = await Promise.all([dal.getGroups(tenantId), dal.getClassrooms(tenantId)]);
        if (!active()) return;
        setState({ account, groups, canEdit: stored.canEdit });
        setClassrooms(rooms);
      } catch (cause) {
        if (!active()) return;
        const error = cause instanceof Error ? cause.message : 'تعذّر تحميل المجموعات';
        setState(previous => previous?.account === account ? { ...previous, error }
          : { account, error, groups: [], canEdit: false });
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

  async function save(input: GroupInput) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحفظ المجموعة');
    const dal = getDataProvider();
    let group: Group;
    if (demo) {
      const storage = window.localStorage;
      const raw = storage.getItem(key);
      const stored = parseSavedGroups(raw, tenantId);
      dal.setManagedGroups(tenantId, stored);
      const [groups, classrooms, users] = await Promise.all([
        dal.getGroups(tenantId), dal.getClassrooms(tenantId), dal.getUsers(tenantId, { role: 'TEACHER' }),
      ]);
      const teachers = new Map(users.map(user => [user.id, {
        id: user.id, fullName: user.fullName, isActive: user.isActive,
      }]));
      for (const profile of readDemoTeacherProfiles(tenantId)) teachers.set(profile.id, {
        id: profile.id, fullName: profile.fullName, isActive: profile.active,
      });
      group = buildGroup(tenantId, input, { ...catalog, groups, classrooms, teachers: [...teachers.values()] });
      if (storage.getItem(key) !== raw) throw new Error(groupConflictMessage);
      const next = [...stored.filter(item => item.id !== group.id), group];
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        throw new Error('تعذّر حفظ المجموعة في هذا المتصفح. تحقّق من مساحة التخزين وإعدادات المتصفح.');
      }
      dal.setManagedGroups(tenantId, next);
    } else {
      group = (await requestGroups<{ group: Group }>(slug, token!, input)).group;
      const current = (await dal.getGroups(tenantId)).filter(item => item.version && item.id !== group.id);
      dal.setManagedGroups(tenantId, [...current, group]);
    }
    request.current += 1;
    setState({ account, groups: await dal.getGroups(tenantId), canEdit: true });
    return group;
  }

  async function saveClassroom(input: ClassroomInput) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحفظ القاعة');
    const parsed = classroomInputSchema.parse(input);
    const dal = getDataProvider();
    let room: Classroom;
    if (demo) {
      const raw = window.localStorage.getItem(roomsKey);
      const rooms = parseSavedClassrooms(raw, tenantId);
      dal.setManagedClassrooms(tenantId, rooms);
      room = buildClassroom(tenantId, parsed, catalog.branches, await dal.getClassrooms(tenantId));
      if (window.localStorage.getItem(roomsKey) !== raw) throw new Error(groupConflictMessage);
      const next = [...rooms, room];
      try {
        window.localStorage.setItem(roomsKey, JSON.stringify(next));
      } catch {
        throw new Error('تعذّر حفظ القاعة في هذا المتصفح. تحقّق من إعدادات التخزين.');
      }
      managedClassrooms.current = next;
    } else {
      room = (await requestGroups<{ room: Classroom }>(slug, token!, { action: 'saveClassroom', room: parsed })).room;
      managedClassrooms.current = [...managedClassrooms.current, room];
    }
    dal.setManagedClassrooms(tenantId, managedClassrooms.current);
    request.current += 1;
    setClassrooms(await dal.getClassrooms(tenantId));
    return room;
  }

  return {
    groups: current?.groups ?? [], classrooms: current ? classrooms : [], canEdit, save, saveClassroom, error: current?.error,
    ready: Boolean(current && !current.error), loading: auth.loading || Boolean((demo || token) && !current),
    refresh: () => setRevision(value => value + 1),
  };
}
