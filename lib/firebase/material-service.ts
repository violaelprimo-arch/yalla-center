import type { IDataProvider } from '@/lib/dal';
import { createCenterDataProvider } from '@/lib/dal/factory';
import { emptyMasterData } from '@/lib/dal/master-data';
import type { Material, Tenant } from '@/lib/dal/types';
import { changeMaterial, MaterialError, type MaterialMutation } from '@/lib/materials/management';
import { mergeManagedRecords } from '@/lib/timetable/group-schedule';
import type { FirestoreWriteOperation } from './firestore-rest';
import { authorizeMasterData, listMasterData } from './master-data-service';
import { createServerFirestoreStore, extractBearerToken, verifyFirebaseIdToken, type ILessonScoreStore } from './server';

type StoredMaterial = Material | Pick<Material, 'id' | 'tenantId'> & { deleted: true };
interface MaterialContext {
  tenant: Tenant;
  store: ILessonScoreStore;
  dal: IDataProvider;
}

const collection = 'center_materials';

export async function authorizeMaterialAccess(authorization: string | null, tenantId: string, write = false) {
  const idToken = extractBearerToken(authorization);
  if (!idToken) throw new MaterialError(401, 'سجّل الدخول بحساب السنتر');
  const { uid } = await verifyFirebaseIdToken(idToken);
  if (uid.includes('/')) throw new MaterialError(401, 'معرّف الحساب غير صالح');
  const store = await createServerFirestoreStore({ callerIdToken: idToken, requireServiceAccount: true });
  const canEdit = await authorizeMasterData(store, uid, tenantId, write);
  return { store, uid, canEdit };
}

export async function readManagedMaterials(store: ILessonScoreStore, dal: IDataProvider, tenantId: string) {
  const [base, records] = await Promise.all([
    dal.getMaterials(tenantId),
    store.queryCollection<StoredMaterial>(collection, [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }]),
  ]);
  const inserted = records.filter(row => row.data.tenantId === tenantId).map(row => row.data);
  return mergeManagedRecords<StoredMaterial>(base, inserted).filter((material): material is Material => !('deleted' in material))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadMaterialProvider(store: ILessonScoreStore, dal: IDataProvider, tenantId: string) {
  const editor = createCenterDataProvider();
  editor.materials = await readManagedMaterials(store, dal, tenantId);
  return editor;
}

export async function materialRevisionWrite(store: ILessonScoreStore, tenantId: string): Promise<FirestoreWriteOperation> {
  const documentPath = `center_material_revisions/${tenantId}`;
  const revision = await store.getDocument(documentPath);
  if (revision.exists && !revision.updateTime) throw new MaterialError(503, 'تعذّر التحقق من نسخة المذكرات الحالية');
  return {
    type: 'set', documentPath, data: { tenantId, updatedAt: new Date().toISOString() },
    currentDocument: revision.exists ? { updateTime: revision.updateTime } : { exists: false },
  };
}

export async function saveManagedMaterial(context: MaterialContext, actorId: string, mutation: MaterialMutation) {
  const { tenant, store } = context;
  const revision = await materialRevisionWrite(store, tenant.id);
  const [dal, catalog] = await Promise.all([
    loadMaterialProvider(store, context.dal, tenant.id),
    mutation.action === 'delete' ? emptyMasterData : listMasterData(context),
  ]);
  if (mutation.action === 'delete' && !await dal.getMaterialById(tenant.id, mutation.id)) return null;
  const material = await changeMaterial(dal, tenant.id, catalog, actorId, mutation);
  const data = mutation.action === 'delete' ? { id: mutation.id, tenantId: tenant.id, deleted: true } : material;
  if (!data) throw new MaterialError(503, 'تعذّر حفظ المذكرة');
  await store.commit([revision, { type: 'set', documentPath: `${collection}/${tenant.id}~${data.id}`, data: { ...data } }]);
  return material;
}
