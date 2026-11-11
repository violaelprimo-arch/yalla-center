'use client';

import { useEffect, useState } from 'react';
import { hasFirebaseWebConfig } from '@/lib/firebase/client';
import type { TeacherProfile } from './profile';

function demoKey(tenantId: string) {
  return 'yc-teachers-v1:' + tenantId;
}

export function readDemoTeacherProfiles(tenantId: string): TeacherProfile[] {
  const raw = localStorage.getItem(demoKey(tenantId));
  if (!raw) return [];
  const records: TeacherProfile[] = JSON.parse(raw);
  return records.filter(profile => profile.tenantId === tenantId);
}

export function writeDemoTeacherProfile(profile: TeacherProfile) {
  const records = readDemoTeacherProfiles(profile.tenantId);
  const previous = records.find(record => record.id === profile.id);
  if ((previous?.version ?? 0) + 1 !== profile.version) {
    throw new Error('بيانات المعلم اتعدلت. حدّث القائمة وحاول مرة أخرى');
  }
  if (profile.active && profile.login && records.some(record => record.active &&
    record.id !== profile.id && JSON.stringify(record.login) === JSON.stringify(profile.login))) {
    throw new Error('بيانات الدخول مستخدمة لمعلم آخر في هذا السنتر');
  }
  const next = [...records.filter(record => record.id !== profile.id), profile];
  localStorage.setItem(demoKey(profile.tenantId), JSON.stringify(next));
  return next;
}

export async function teacherApi<T>(centerSlug: string, idToken: string, query = '', body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/center/${encodeURIComponent(centerSlug)}/teachers${query}`, {
    cache: 'no-store',
    signal,
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(result.message || 'تعذّر إكمال العملية');
  return result;
}

export type TeacherContractSummary = Pick<TeacherProfile, 'id' | 'tenantId' | 'fullName' | 'phone' | 'active' | 'contracts'>;

const noContracts: TeacherContractSummary[] = [];

export function useTeacherContracts(tenantId: string, centerSlug: string, enabled: boolean, idToken: string | null) {
  const [state, setState] = useState<{ tenantId: string; idToken: string | null; items: TeacherContractSummary[]; error?: string }>();
  const configured = hasFirebaseWebConfig();
  useEffect(() => {
    if (!enabled) return;
    if (!configured) {
      const refresh = () => {
        try {
          setState({ tenantId, idToken, items: readDemoTeacherProfiles(tenantId) });
        } catch {
          setState({ tenantId, idToken, items: [], error: 'تعذّر تحميل عقود المعلمين' });
        }
      };
      refresh();
      window.addEventListener('storage', refresh);
      return () => window.removeEventListener('storage', refresh);
    }
    if (!idToken) return;
    const request = new AbortController();
    teacherApi<{ profiles: TeacherContractSummary[] }>(centerSlug, idToken, '?view=contracts', undefined, request.signal)
      .then(data => setState({ tenantId, idToken, items: data.profiles }))
      .catch(cause => {
        if (!request.signal.aborted) setState({ tenantId, idToken, items: [], error: cause.message });
      });
    return () => request.abort();
  }, [tenantId, centerSlug, configured, enabled, idToken]);

  const current = enabled && state?.tenantId === tenantId && state.idToken === idToken ? state : undefined;
  return { profiles: current?.items ?? noContracts, ready: Boolean(current && !current.error), error: current?.error };
}
