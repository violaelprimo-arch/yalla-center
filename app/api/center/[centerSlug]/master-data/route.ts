import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { masterDataActionSchema, masterDataConflict, MasterDataError } from '@/lib/dal/master-data';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  FirestoreHttpError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';
import { authorizeMasterData, listMasterData, saveMasterData } from '@/lib/firebase/master-data-service';
import { groupRevisionWrite, loadGroupProvider } from '@/lib/firebase/group-service';
import { GroupScheduleError } from '@/lib/timetable/group-schedule';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function resolveContext(req: NextRequest, centerSlug: string, requireAdmin: boolean) {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);
  if (!tenant?.isActive) throw new MasterDataError(404, 'السنتر غير موجود أو غير مفعل');

  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (!bearer) throw new MasterDataError(401, 'سجّل الدخول بحساب إدارة السنتر للمتابعة');
  const { uid } = await verifyFirebaseIdToken(bearer);
  if (uid.includes('/')) throw new MasterDataError(401, 'معرّف الحساب غير صالح');

  const store = await createServerFirestoreStore({ callerIdToken: bearer });
  const canEdit = await authorizeMasterData(store, uid, tenant.id, requireAdmin);
  return { tenant, store, dal, canEdit };
}

function errorResponse(error: unknown) {
  if (error instanceof MasterDataError || error instanceof FirebaseAuthError || error instanceof GroupScheduleError) {
    return reply({ success: false, error: error.message }, error.status);
  }
  if (error instanceof FirestoreHttpError &&
    ([409, 412].includes(error.status) || ['ALREADY_EXISTS', 'ABORTED', 'FAILED_PRECONDITION'].includes(error.code ?? ''))) {
    return reply({ success: false, error: masterDataConflict }, 409);
  }
  return reply({ success: false, error: 'تعذّر الاتصال بخدمة البيانات الأساسية. حاول مرة أخرى.' }, 503);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await params;
    const context = await resolveContext(req, centerSlug, false);
    return reply({ success: true, data: await listMasterData(context), canEdit: context.canEdit });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await params;
    const context = await resolveContext(req, centerSlug, true);
    const parsed = masterDataActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return reply({ success: false, error: parsed.error.issues[0]?.message || 'بيانات الطلب غير صالحة' }, 400);
    }
    const scheduleWrite = parsed.data.action.startsWith('delete')
      ? await groupRevisionWrite(context.store, context.tenant.id) : undefined;
    const dal = scheduleWrite
      ? await loadGroupProvider(context.store, context.tenant) : context.dal;
    const { data, result } = await saveMasterData({ ...context, dal }, parsed.data, scheduleWrite);
    return reply({ success: true, data, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
