'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshFirebaseIdToken, useFirebaseAuthSession } from '@/lib/firebase/client';
import { readDemoSchedule } from '@/lib/timetable/group-client';
import { demoMaterialsKey, readDemoMaterials } from '@/lib/materials/demo-storage';
import { createCenterDataProvider, getDataProvider } from './factory';
import { MockDataProvider, INITIAL_SEEDED_DATA } from './mock-data';
import {
  changeMasterData,
  emptyMasterData,
  masterDataConflict,
  masterDataStorageKey,
  readMasterData,
  type MasterData,
  type MasterDataAction,
} from './master-data';
import type { Tenant } from './types';

export { masterDataStorageKey } from './master-data';

async function readDemoData(tenantId: string, raw: string | null): Promise<MasterData> {
  if (raw === null) return readMasterData(createCenterDataProvider(), tenantId);
  const parsed = JSON.parse(raw) as MasterData;
  const ownsRecords = (records: unknown) =>
    Array.isArray(records) &&
    records.every(
      record =>
        record?.tenantId === tenantId &&
        typeof record.id === 'string' &&
        typeof record.nameAr === 'string'
    );
  if (
    !parsed ||
    !ownsRecords(parsed.branches) ||
    !ownsRecords(parsed.subjects) ||
    !ownsRecords(parsed.stages) ||
    !parsed.stages.every(stage => ownsRecords(stage.grades))
  ) {
    throw new Error('تعذّر قراءة البيانات الأساسية المحفوظة في هذا المتصفح');
  }
  const dal = getDataProvider();
  const branches =
    dal instanceof MockDataProvider
      ? dal.keepSavedRecords(parsed.branches, INITIAL_SEEDED_DATA.branches)
      : parsed.branches;
  return { ...parsed, branches };
}

export async function saveDemoMasterData(tenantId: string, input: MasterDataAction) {
  const key = masterDataStorageKey(tenantId);
  const storage = window.localStorage;
  const raw = storage.getItem(key);
  const schedule = input.action.startsWith('delete') ? readDemoSchedule(tenantId) : undefined;
  const materialKey = demoMaterialsKey(tenantId);
  const materialSnapshot = storage.getItem(materialKey);
  const catalog = await readDemoData(tenantId, raw);
  const materials =
    input.action === 'deleteSubject'
      ? await readDemoMaterials(tenantId, materialSnapshot)
      : undefined;
  const { data } = await changeMasterData(getDataProvider(), tenantId, catalog, input, materials);
  if (
    storage.getItem(key) !== raw ||
    (materials && storage.getItem(materialKey) !== materialSnapshot)
  ) {
    throw new Error(masterDataConflict);
  }
  schedule?.verifyCurrent();
  try {
    storage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error('تعذّر حفظ البيانات في هذا المتصفح. تحقّق من مساحة التخزين وإعدادات المتصفح.');
  }
  return data;
}

async function requestCatalog(
  tenant: Tenant,
  token: string,
  input?: MasterDataAction,
  signal?: AbortSignal
) {
  const response = await fetch(`/api/center/${encodeURIComponent(tenant.slug)}/master-data`, {
    cache: 'no-store',
    signal,
    method: input ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(input ? { 'Content-Type': 'application/json' } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  const result = (await response.json().catch(() => null)) as {
    success: boolean;
    data?: MasterData;
    error?: string;
    canEdit?: boolean;
  } | null;
  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.error ?? 'تعذّر الاتصال بخدمة البيانات الأساسية');
  }
  return { data: result.data, canEdit: result.canEdit === true };
}

export function useMasterDataCatalog(tenant: Tenant, demoAdmin: boolean) {
  const auth = useFirebaseAuthSession();
  const token = auth.idToken;
  const isProduction =
    process.env.DATA_PROVIDER_MODE === 'production' ||
    process.env.DATA_PROVIDER_MODE === 'firebase' ||
    process.env.NODE_ENV === 'production';
  const demo = !isProduction && (!auth.configured || !token);
  const accountId = auth.user?.uid ?? token ?? (demo ? 'demo' : null);
  const tenantId = tenant.id;
  const key = masterDataStorageKey(tenantId);
  const [state, setState] = useState<{
    tenantId: string;
    accountId: string | null;
    data?: MasterData;
    canEdit?: boolean;
    error?: string;
  }>();
  const [refreshCount, setRefreshCount] = useState(0);
  const revision = useRef(0);
  const refresh = useCallback(() => setRefreshCount(count => count + 1), []);

  useEffect(() => {
    if (!demo && !token) {
      if (!auth.loading) {
        setState({
          tenantId,
          accountId: null,
          error: 'يلزم تسجيل الدخول بحساب إدارة السنتر للوصول إلى البيانات الأساسية السحابية',
        });
      }
      return;
    }

    const controller = new AbortController();
    async function load() {
      const requestRevision = ++revision.current;
      const current = () => !controller.signal.aborted && requestRevision === revision.current;
      try {
        const result = demo
          ? { data: await readDemoData(tenantId, window.localStorage.getItem(key)) }
          : await requestCatalog(tenant, token!, undefined, controller.signal);
        if (current()) setState({ tenantId, accountId, ...result });
      } catch (cause) {
        if (current()) {
          const error = cause instanceof Error ? cause.message : 'تعذّر تحميل البيانات الأساسية';
          setState(previous =>
            previous?.tenantId === tenantId && previous.accountId === accountId
              ? { ...previous, error }
              : { tenantId, accountId, error }
          );
        }
      }
    }
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) void load();
    };
    void load();
    if (demo) window.addEventListener('storage', sync);
    return () => {
      controller.abort();
      if (demo) window.removeEventListener('storage', sync);
    };
  }, [auth.loading, demo, key, tenant, tenantId, accountId, token, refreshCount]);

  const current =
    state?.tenantId === tenantId && state.accountId === accountId && (demo || token || state?.error)
      ? state
      : undefined;
  const canEdit = Boolean(current?.data && !current.error && (demo ? demoAdmin : current.canEdit));

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  async function save(input: MasterDataAction) {
    if (!canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لحفظ البيانات الأساسية');
    setSaving(true);
    try {
      const activeToken = token || (await getFreshFirebaseIdToken());
      let data: MasterData;
      if (activeToken) {
        data = (await requestCatalog(tenant, activeToken, input)).data;
      } else if (!isProduction) {
        data = await saveDemoMasterData(tenantId, input);
      } else {
        throw new Error('يلزم تسجيل الدخول بحساب إدارة السنتر لحفظ البيانات على السحابة');
      }
      revision.current += 1;
      setState({ tenantId, accountId, data, canEdit: true });
      setLastSavedAt(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  }

  return {
    auth,
    demo,
    canEdit,
    save,
    refresh,
    ready: Boolean(current?.data),
    data: current?.data ?? emptyMasterData,
    loading: auth.loading || Boolean((demo || token) && !current),
    saving,
    lastSavedAt,
    error: current?.error,
  };
}
