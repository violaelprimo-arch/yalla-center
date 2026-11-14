import { createCenterDataProvider, getDataProvider } from '@/lib/dal/factory';
import { emptyMasterData, masterDataStorageKey, readMasterData, type MasterData } from '@/lib/dal/master-data';
import type { Material } from '@/lib/dal/types';
import { changeMaterial, materialConflict, MaterialError, type MaterialMutation } from './management';

export function demoMaterialsKey(tenantId: string) {
  return `yc-materials-v1:${tenantId}`;
}

export async function readDemoMaterials(tenantId: string, raw = window.localStorage.getItem(demoMaterialsKey(tenantId))): Promise<Material[]> {
  if (raw === null) return getDataProvider().getMaterials(tenantId);
  let materials: unknown;
  try { materials = JSON.parse(raw); } catch { throw new MaterialError(400, 'تعذّر قراءة المذكرات المحفوظة في هذا المتصفح'); }
  if (!Array.isArray(materials) || !materials.every(row => row?.tenantId === tenantId &&
    ['id', 'stage', 'grade', 'subjectId', 'title', 'unitName', 'lessonName', 'fileUrl'].every(field => typeof row[field] === 'string'))) {
    throw new MaterialError(400, 'تعذّر قراءة المذكرات المحفوظة في هذا المتصفح');
  }
  return materials;
}

export async function saveDemoMaterial(tenantId: string, actorId: string, mutation: MaterialMutation) {
  const editor = createCenterDataProvider();
  const storage = window.localStorage;
  const key = demoMaterialsKey(tenantId);
  const raw = storage.getItem(key);
  const catalogKey = masterDataStorageKey(tenantId);
  const rawCatalog = storage.getItem(catalogKey);
  editor.materials = structuredClone(await readDemoMaterials(tenantId, raw));
  const catalog: MasterData = mutation.action === 'delete' ? emptyMasterData
    : rawCatalog === null ? await readMasterData(editor, tenantId) : JSON.parse(rawCatalog);
  await changeMaterial(editor, tenantId, catalog, actorId, mutation);
  if (storage.getItem(key) !== raw || storage.getItem(catalogKey) !== rawCatalog) throw new MaterialError(409, materialConflict);
  try {
    storage.setItem(key, JSON.stringify(editor.materials));
  } catch {
    throw new MaterialError(503, 'تعذّر حفظ المذكرات في هذا المتصفح');
  }
  return editor.materials;
}
