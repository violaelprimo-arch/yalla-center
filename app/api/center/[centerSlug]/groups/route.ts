import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/dal/factory';
import { classroomDeletionSchema, classroomInputSchema, groupConflictMessage, GroupScheduleError, groupDeletionSchema, groupInputSchema } from '@/lib/timetable/group-schedule';
import {
  archiveManagedClassroom, archiveManagedGroups, groupStaff, listManagedClassrooms, listManagedGroups,
  saveManagedClassroom, saveManagedGroup,
} from '@/lib/firebase/group-service';
import {
  createServerFirestoreStore, extractBearerToken, FirebaseAuthError, FirestoreHttpError, verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

type Params = { params: { centerSlug: string } };

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function context(req: NextRequest, slug: string) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) throw new GroupScheduleError(401, 'سجّل الدخول بحساب السنتر');
  const { uid } = await verifyFirebaseIdToken(token);
  if (uid.includes('/')) throw new GroupScheduleError(401, 'معرّف الحساب غير صالح');
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(slug);
  if (!tenant?.isActive) throw new GroupScheduleError(404, 'السنتر غير موجود');
  const store = await createServerFirestoreStore({ callerIdToken: token, requireServiceAccount: true });
  const staff = await groupStaff(store, tenant, uid);
  return { dal, tenant, store, staff };
}

function errorResponse(error: unknown) {
  if (error instanceof GroupScheduleError || error instanceof FirebaseAuthError) {
    return reply({ error: error.message }, error.status);
  }
  if (error instanceof FirestoreHttpError) {
    if (error.status === 403) return reply({ error: 'حسابك لا يملك صلاحية الوصول إلى الجدول' }, 403);
    if ([409, 412].includes(error.status) ||
      ['ALREADY_EXISTS', 'ABORTED', 'FAILED_PRECONDITION'].includes(error.code ?? '')) {
      return reply({ error: groupConflictMessage }, 409);
    }
  }
  return reply({ error: 'تعذّر الاتصال بقاعدة بيانات المجموعات' }, 503);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { store, tenant, staff } = await context(req, params.centerSlug);
    const [groups, classrooms] = await Promise.all([listManagedGroups(store, tenant.id), listManagedClassrooms(store, tenant.id)]);
    const branchIds = (staff.role === 'BRANCH_MANAGER' || staff.role === 'RECEPTIONIST') ? staff.branchIds : undefined;
    const allowed = staff.role === 'BRANCH_MANAGER' || staff.role === 'RECEPTIONIST'
      ? groups.filter(group => !branchIds?.length || branchIds.includes(group.branchId))
      : staff.role === 'TEACHER' ? groups.filter(group => group.teacherId === (staff.teacherId || staff.uid)) : groups;
    const canEdit = staff.role === 'CENTER_ADMIN' || staff.role === 'PLATFORM_OWNER';
    return reply({ groups: allowed, classrooms: branchIds?.length
      ? classrooms.filter(room => branchIds.includes(room.branchId)) : classrooms, canEdit });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await context(req, params.centerSlug);
    if (actor.staff.role !== 'CENTER_ADMIN' && actor.staff.role !== 'PLATFORM_OWNER') {
      throw new GroupScheduleError(403, 'صلاحية مدير السنتر مطلوبة لإدارة المجموعات والقاعات');
    }
    const body = await req.json().catch(() => null);
    if (body?.action === 'saveClassroom') {
      const room = classroomInputSchema.safeParse(body.room);
      if (!room.success) return reply({ error: room.error.issues[0].message }, 400);
      return reply({ room: await saveManagedClassroom(actor, room.data) });
    }
    if (body?.action === 'deleteClassroom') {
      const room = classroomDeletionSchema.safeParse(body.room);
      if (!room.success) return reply({ error: room.error.issues[0].message }, 400);
      return reply({ room: await archiveManagedClassroom(actor, room.data) });
    }
    if (body?.action === 'deleteGroups') {
      const selected = z.array(groupDeletionSchema).min(1).max(400).safeParse(body.groups);
      if (!selected.success || new Set(selected.data.map(group => group.id)).size !== selected.data.length) {
        return reply({ error: 'حدّد مجموعات صالحة للحذف' }, 400);
      }
      return reply({ groups: await archiveManagedGroups(actor, selected.data) });
    }
    const input = groupInputSchema.safeParse(body);
    if (!input.success) return reply({ error: input.error.issues[0].message }, 400);
    return reply({ group: await saveManagedGroup(actor, input.data) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
