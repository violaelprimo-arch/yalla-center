import type { Material, Tenant } from '@/lib/dal/types';
import type { IDataProvider } from '@/lib/dal';
import { authorizeMaterialAccess, readManagedMaterials } from '@/lib/firebase/material-service';
import { MaterialError } from './management';

export async function readExamSourceMaterials(dal: IDataProvider, tenant: Tenant, authorization: string | null, ids: string[]): Promise<Material[]> {
  const available = authorization ? await readManagedMaterials((await authorizeMaterialAccess(authorization, tenant.id)).store, dal, tenant.id)
    : await dal.getMaterials(tenant.id);
  const materials = available.filter(item => ids.includes(item.id));
  if (materials.length !== new Set(ids).size) {
    throw new MaterialError(422, 'بعض المذكرات المحددة غير متاحة. حدّث القائمة واختر المذكرات الموجودة.');
  }
  return materials;
}
