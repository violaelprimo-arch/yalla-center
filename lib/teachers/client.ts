'use client';

import { useEffect, useState } from 'react';
import { getFreshFirebaseIdToken, hasFirebaseWebConfig } from '@/lib/firebase/client';
import type { TeacherProfile } from './profile';

export function demoTeacherKey(tenantId: string) {
  return 'yc-teachers-v1:' + tenantId;
}

export function readDemoTeacherProfiles(tenantId: string): TeacherProfile[] {
  const raw = localStorage.getItem(demoTeacherKey(tenantId));
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
  try {
    localStorage.setItem(demoTeacherKey(profile.tenantId), JSON.stringify(next));
  } catch {
    throw new Error('تعذّر حفظ المعلم على هذا المتصفح. تحقّق من مساحة التخزين وإعدادات المتصفح.');
  }
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

export type TeacherContractSummary = Pick<TeacherProfile, 'id' | 'tenantId' | 'fullName' | 'phone' | 'active' | 'contracts' | 'subjectIds'>;

const noContracts: TeacherContractSummary[] = [];

export function useTeacherContracts(tenantId: string, centerSlug: string, enabled: boolean, idToken: string | null) {
  const [state, setState] = useState<{ tenantId: string; idToken: string | null; items: TeacherContractSummary[]; error?: string }>();
  const configured = hasFirebaseWebConfig();
  const isProduction = process.env.DATA_PROVIDER_MODE === 'production' || process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (!enabled) return;
    const request = new AbortController();

    async function loadContracts() {
      const activeToken = idToken || (await getFreshFirebaseIdToken());
      if (activeToken) {
        try {
          const data = await teacherApi<{ profiles: TeacherContractSummary[] }>(
            centerSlug,
            activeToken,
            '?view=contracts',
            undefined,
            request.signal
          );
          if (!request.signal.aborted) {
            setState({ tenantId, idToken: activeToken, items: data.profiles });
          }
        } catch (cause) {
          if (!request.signal.aborted) {
            setState({
              tenantId,
              idToken: activeToken,
              items: [],
              error: cause instanceof Error ? cause.message : 'تعذّر تحميل عقود المعلمين',
            });
          }
        }
        return;
      }

      if (!isProduction) {
        try {
          setState({ tenantId, idToken: null, items: readDemoTeacherProfiles(tenantId) });
        } catch {
          setState({ tenantId, idToken: null, items: [], error: 'تعذّر تحميل عقود المعلمين' });
        }
      } else {
        setState({
          tenantId,
          idToken: null,
          items: [],
          error: 'يلزم تسجيل الدخول بحساب مصرح له لعرض بيانات المعلمين',
        });
      }
    }

    void loadContracts();

    const sync = (event: StorageEvent) => {
      if (!isProduction && (event.key === demoTeacherKey(tenantId) || event.key === null)) {
        void loadContracts();
      }
    };
    if (!isProduction) {
      window.addEventListener('storage', sync);
    }

    return () => {
      request.abort();
      if (!isProduction) {
        window.removeEventListener('storage', sync);
      }
    };
  }, [tenantId, centerSlug, configured, enabled, idToken, isProduction]);

  const current = enabled && state?.tenantId === tenantId && state.idToken === idToken ? state : undefined;
  return { profiles: current?.items ?? noContracts, ready: Boolean(current && !current.error), error: current?.error };
}
