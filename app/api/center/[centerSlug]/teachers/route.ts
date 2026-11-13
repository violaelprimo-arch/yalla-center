import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/dal/factory';
import { loadGroupProvider } from '@/lib/firebase/group-service';
import { cairoClock } from '@/lib/attendance/reception';
import {
  createServerFirestoreStore, extractBearerToken, FirebaseAuthError, FirestoreHttpError, verifyFirebaseIdToken,
} from '@/lib/firebase/server';
import {
  archiveTeacherProfile, assertTeacherManager, getSignedInTeacher, listExtraSessionRequests,
  listTeacherProfiles, readTeacherPortal, saveTeacherProfile, submitTeacherExtraSession, TeacherServiceError,
} from '@/lib/firebase/teacher-service';
import { extraSessionSchema, teacherIdSchema, teacherInputSchema } from '@/lib/teachers/profile';

export const dynamic = 'force-dynamic';
type Params = { params: { centerSlug: string } };

const mutation = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'), id: teacherIdSchema, version: z.number().int().min(0),
    input: teacherInputSchema, password: z.string().max(128).optional(),
  }),
  z.object({ action: z.literal('archive'), id: teacherIdSchema, version: z.number().int().min(0) }),
  z.object({ action: z.literal('extraSession'), request: extraSessionSchema }),
]);

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorize(req: NextRequest, centerSlug: string) {
  const idToken = extractBearerToken(req.headers.get('authorization'));
  if (!idToken) throw new FirebaseAuthError(401, 'سجّل الدخول بحساب Firebase للمتابعة');
  const token = await verifyFirebaseIdToken(idToken);
  if (token.uid.includes('/')) throw new FirebaseAuthError(401, 'معرّف الحساب غير صالح');
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);
  if (!tenant?.isActive) throw new TeacherServiceError(404, 'السنتر غير متاح');
  const store = await createServerFirestoreStore({ callerIdToken: idToken, requireServiceAccount: true });
  return { token, context: { dal, tenant, store } };
}

function errorReply(error: unknown) {
  if (error instanceof FirebaseAuthError || error instanceof TeacherServiceError) {
    return reply({ message: error.message }, error.status);
  }
  if (error instanceof FirestoreHttpError) {
    if ([409, 412].includes(error.status) || ['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED'].includes(error.code ?? '')) {
      return reply({ message: 'البيانات اتعدلت أثناء الحفظ. حدّث القائمة وحاول مرة أخرى' }, 409);
    }
    if (error.status === 403) {
      return reply({ message: 'حساب خدمة Firebase يحتاج صلاحية الوصول لبيانات المعلمين' }, 503);
    }
  }
  return reply({ message: 'تعذّر الاتصال بخدمة شؤون المعلمين' }, 503);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { token, context } = await authorize(req, params.centerSlug);
    const view = req.nextUrl.searchParams.get('view');

    if (view === 'portal') {
      const teacher = await getSignedInTeacher(context, token);
      const [currentYear, currentMonth] = cairoClock().split('-').map(Number);
      const month = Number(req.nextUrl.searchParams.get('month') || currentMonth);
      const year = Number(req.nextUrl.searchParams.get('year') || currentYear);
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new TeacherServiceError(400, 'اختر شهرًا وسنة صالحين');
      }
      return reply({ portal: await readTeacherPortal({ ...context, dal: await loadGroupProvider(context.store, context.tenant) }, teacher, month, year) });
    }

    await assertTeacherManager(context.store, token.uid, context.tenant.id, view === 'contracts');
    const profiles = await listTeacherProfiles(context);
    if (view === 'contracts') {
      return reply({ profiles: profiles.map(({ id, tenantId, fullName, phone, active, contracts }) =>
        ({ id, tenantId, fullName, phone, active, contracts })) });
    }
    return reply({ profiles, requests: await listExtraSessionRequests(context) });
  } catch (error) {
    return errorReply(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { token, context } = await authorize(req, params.centerSlug);
    const body = mutation.safeParse(await req.json().catch(() => null));
    if (!body.success) return reply({ message: body.error.issues[0].message }, 400);
    const input = body.data;

    if (input.action === 'extraSession') {
      const teacher = await getSignedInTeacher(context, token);
      return reply({ request: await submitTeacherExtraSession({ ...context, dal: await loadGroupProvider(context.store, context.tenant) }, teacher, input.request) });
    }
    await assertTeacherManager(context.store, token.uid, context.tenant.id);
    if (input.action === 'archive') {
      return reply({ profile: await archiveTeacherProfile(context, input.id, input.version) });
    }
    return reply({ profile: await saveTeacherProfile(context, input.id, input.version, input.input, input.password) });
  } catch (error) {
    return errorReply(error);
  }
}
