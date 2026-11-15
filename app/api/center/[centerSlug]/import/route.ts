import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  authorizeStaffMember,
  CenterOperationsError,
} from '@/lib/firebase/center-operations-service';
import { executeFirestoreImport, ImportPayload } from '@/lib/firebase/import-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant?.isActive) throw new CenterOperationsError(404, 'السنتر غير موجود أو غير نشط');

    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (!bearer) throw new CenterOperationsError(401, 'سجّل الدخول للمتابعة');

    const { uid } = await verifyFirebaseIdToken(bearer);
    const store = await createServerFirestoreStore({ callerIdToken: bearer });
    await authorizeStaffMember(store, uid, tenant.id, ['CENTER_ADMIN', 'PLATFORM_OWNER']);

    const payload = (await req.json()) as ImportPayload;
    const result = await executeFirestoreImport(store, tenant.id, payload);

    return reply(result);
  } catch (err) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return reply({ success: false, error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : 'تعذّر إتمام عملية الاستيراد السحابي';
    return reply({ success: false, error: message }, 500);
  }
}
