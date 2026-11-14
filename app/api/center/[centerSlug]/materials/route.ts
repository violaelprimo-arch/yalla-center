import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import type { MaterialIndexStatus } from '@/lib/dal/types';
import { authorizeMaterialAccess, loadMaterialProvider, saveManagedMaterial } from '@/lib/firebase/material-service';
import { FirebaseAuthError, FirestoreHttpError } from '@/lib/firebase/server';
import { MasterDataError } from '@/lib/dal/master-data';
import {
  createMaterialSchema, deleteMaterialSchema, materialConflict, MaterialError, updateMaterialSchema,
  type MaterialMutation,
} from '@/lib/materials/management';

export const dynamic = 'force-dynamic';
type Params = { params: { centerSlug: string } };

function reply(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function failure(cause: unknown) {
  if (cause instanceof MaterialError || cause instanceof FirebaseAuthError || cause instanceof MasterDataError) {
    return reply({ error: cause.message }, cause.status);
  }
  if (cause instanceof FirestoreHttpError &&
    ([409, 412].includes(cause.status) || ['ALREADY_EXISTS', 'ABORTED', 'FAILED_PRECONDITION'].includes(cause.code ?? ''))) {
    return reply({ error: materialConflict }, 409);
  }
  return reply({ error: 'تعذّر الاتصال بخدمة المذكرات' }, 503);
}

async function center(slug: string) {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(slug);
  if (!tenant?.isActive) throw new MaterialError(404, 'السنتر غير متاح');
  return { dal, tenant };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { dal, tenant } = await center(params.centerSlug);
    const access = req.headers.has('authorization')
      ? await authorizeMaterialAccess(req.headers.get('authorization'), tenant.id) : undefined;
    const source = access ? await loadMaterialProvider(access.store, dal, tenant.id) : dal;
    const { searchParams } = req.nextUrl;
    const [materials, stats] = await Promise.all([
      source.getMaterials(tenant.id, {
        stage: searchParams.get('stage') || undefined,
        grade: searchParams.get('grade') || undefined,
        subjectId: searchParams.get('subjectId') || undefined,
        indexStatus: (searchParams.get('indexStatus') as MaterialIndexStatus | null) ?? undefined,
        search: searchParams.get('search') || undefined,
      }),
      source.getMaterialsStats(tenant.id),
    ]);
    return reply({ success: true, materials, stats, canEdit: access?.canEdit ?? false });
  } catch (cause) {
    return failure(cause);
  }
}

async function mutate(req: NextRequest, { params }: Params, action: MaterialMutation['action']) {
  try {
    const context = await center(params.centerSlug);
    const { store, uid } = await authorizeMaterialAccess(req.headers.get('authorization'), context.tenant.id, true);
    const body = await req.json().catch(() => null);
    let input: MaterialMutation;
    switch (action) {
      case 'create': {
        const result = createMaterialSchema.safeParse(body);
        if (!result.success) return reply({ error: result.error.issues[0].message }, 400);
        input = { action, input: result.data };
        break;
      }
      case 'update': {
        const result = updateMaterialSchema.safeParse(body);
        if (!result.success) return reply({ error: result.error.issues[0].message }, 400);
        input = { action, ...result.data };
        break;
      }
      case 'delete': {
        const result = deleteMaterialSchema.safeParse(body);
        if (!result.success) return reply({ error: result.error.issues[0].message }, 400);
        input = { action, ...result.data };
        break;
      }
    }
    const material = await saveManagedMaterial({ ...context, store }, uid, input);
    return reply({ success: true, material }, action === 'create' ? 201 : 200);
  } catch (cause) {
    return failure(cause);
  }
}

export function POST(req: NextRequest, context: Params) {
  return mutate(req, context, 'create');
}

export function PATCH(req: NextRequest, context: Params) {
  return mutate(req, context, 'update');
}

export function DELETE(req: NextRequest, context: Params) {
  return mutate(req, context, 'delete');
}
