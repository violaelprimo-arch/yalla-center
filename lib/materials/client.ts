'use client';

import { useEffect, useRef, useState } from 'react';
import type { Material, Tenant, User } from '@/lib/dal/types';
import type { FirebaseAuthSessionState } from '@/lib/firebase/client';
import { demoMaterialsKey, readDemoMaterials, saveDemoMaterial } from './demo-storage';
import { canManageMaterials, type MaterialMutation } from './management';

export function useCenterMaterials(tenant: Tenant, auth: FirebaseAuthSessionState, user?: User) {
  const { id: tenantId, slug } = tenant;
  const token = auth.idToken;
  const demo = !auth.configured;
  const scope = `${tenantId}:${demo ? 'demo' : auth.user?.uid ?? token}`;
  const endpoint = `/api/center/${encodeURIComponent(slug)}/materials`;
  const [state, setState] = useState<{ scope: string; materials: Material[]; canEdit: boolean; error?: string }>();
  const [refreshCount, setRefreshCount] = useState(0);
  const loadVersion = useRef(0);
  const current = state?.scope === scope ? state : undefined;
  const canEdit = Boolean(current && !current.error && user && (demo ? canManageMaterials(user.role) : token && current.canEdit));

  useEffect(() => {
    if (!demo && !token) return;
    const controller = new AbortController();
    async function load() {
      const version = ++loadVersion.current;
      try {
        const data = demo ? { materials: await readDemoMaterials(tenantId), canEdit: false }
          : await requestMaterials<{ materials: Material[]; canEdit: boolean }>(endpoint, token!, { signal: controller.signal });
        if (!controller.signal.aborted && version === loadVersion.current) setState({ scope, ...data });
      } catch (cause) {
        if (!controller.signal.aborted && version === loadVersion.current) setState({ scope, materials: [], canEdit: false,
          error: cause instanceof Error ? cause.message : 'تعذّر تحميل المذكرات' });
      }
    }
    const key = demoMaterialsKey(tenantId);
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) void load(); };
    if (demo) window.addEventListener('storage', sync);
    void load();
    return () => { controller.abort(); if (demo) window.removeEventListener('storage', sync); };
  }, [demo, endpoint, refreshCount, scope, tenantId, token]);

  async function save(mutation: MaterialMutation) {
    if (!user || !canEdit) throw new Error('صلاحية مدير السنتر مطلوبة لإدارة المذكرات');
    if (demo) {
      const materials = await saveDemoMaterial(tenantId, user.id, mutation);
      loadVersion.current += 1;
      setState({ scope, materials, canEdit: true });
      return;
    }
    const method = mutation.action === 'create' ? 'POST' : mutation.action === 'update' ? 'PATCH' : 'DELETE';
    const body = mutation.action === 'create' ? mutation.input : mutation;
    const { material } = await requestMaterials<{ material: Material | null }>(endpoint, token!, { method, body: JSON.stringify(body) });
    loadVersion.current += 1;
    setState(previous => {
      if (!previous || previous.scope !== scope) return previous;
      const materials = mutation.action === 'delete' ? previous.materials.filter(item => item.id !== mutation.id)
        : mutation.action === 'update' ? previous.materials.map(item => item.id === material?.id ? material : item)
        : material ? [material, ...previous.materials] : previous.materials;
      return { ...previous, materials };
    });
  }

  return { materials: demo || token ? current?.materials ?? [] : [], canEdit, save, error: current?.error,
    loading: auth.loading || Boolean((demo || token) && !current), refresh: () => setRefreshCount(value => value + 1) };
}

async function requestMaterials<T>(url: string, token: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: {
    Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}),
  } });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error ?? 'تعذّر الاتصال بخدمة المذكرات');
  return result as T;
}
