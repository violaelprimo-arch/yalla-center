import type { IDataProvider } from '@/lib/dal';
import { cairoClock } from '@/lib/attendance/reception';
import type { Tenant } from '@/lib/dal/types';
import {
  canUseTeacherTab,
  teacherPasswordEmail,
  type ExtraSessionRequest,
  type TeacherInput,
  type TeacherLogin,
  type TeacherProfile,
} from '@/lib/teachers/profile';
import type { FirestoreWriteOperation } from './firestore-rest';
import {
  FirebaseAuthError,
  getFirebaseProjectId,
  getServiceAccountAccessToken,
  type ILessonScoreStore,
  type StaffMembershipRecord,
  type VerifiedFirebaseToken,
} from './server';

export class TeacherServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

interface LoginLink {
  teacherId: string;
  tenantId: string;
  uid: string | null;
}

interface TeacherServiceContext {
  tenant: Tenant;
  store: ILessonScoreStore;
  dal: IDataProvider;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function profilePath(tenantId: string, id: string) {
  return `teacher_profiles/${tenantId}~${id}`;
}

function loginEmail(tenant: Tenant, login: TeacherLogin) {
  return login.mode === 'username' ? teacherPasswordEmail(tenant.slug, login.username) : login.email;
}

async function loginPath(tenant: Tenant, mode: TeacherLogin['mode'], email: string) {
  return `teacher_login_keys/${await digest(JSON.stringify([tenant.id, mode, email]))}`;
}

export async function assertTeacherManager(
  store: ILessonScoreStore, uid: string, tenantId: string, financeRead = false
) {
  const membership = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (membership.exists && membership.data.isActive && (
    membership.data.role === 'PLATFORM_OWNER' ||
    (membership.data.tenantId === tenantId && (
      membership.data.role === 'CENTER_ADMIN' || (financeRead && membership.data.role === 'ACCOUNTANT')
    ))
  )) return;
  throw new TeacherServiceError(403, 'الصلاحية مطلوبة من إدارة هذا السنتر');
}

export async function listTeacherProfiles({ tenant, store }: TeacherServiceContext) {
  return (await store.queryCollection<TeacherProfile>('teacher_profiles', [
    { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
  ])).map(row => row.data);
}

export async function listExtraSessionRequests({ tenant, store }: TeacherServiceContext) {
  return (await store.queryCollection<ExtraSessionRequest>('teacher_extra_sessions', [
    { fieldPath: 'tenantId', op: 'EQUAL', value: tenant.id },
  ])).map(row => row.data).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function provisionUsernameAccount(uid: string, email: string, password: string) {
  const token = await getServiceAccountAccessToken(fetch, 'https://www.googleapis.com/auth/identitytoolkit');
  if (!token) throw new FirebaseAuthError(503, 'بيانات خدمة Firebase Authentication على الخادم مطلوبة');
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${getFirebaseProjectId()}/accounts`;
  const post = (suffix: string, body: object) => fetch(base + suffix, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const created = await post('', { localId: uid, email, password });
  const result = await created.json() as { localId?: string; error?: { message?: string } };
  if (created.ok && result.localId === uid) return;

  // An earlier save may have provisioned Auth before its Firestore commit failed.
  // Recover that account only when both its deterministic UID and email match.
  if (['EMAIL_EXISTS', 'LOCAL_ID_EXISTS', 'DUPLICATE_LOCAL_ID', 'DUPLICATE_EMAIL'].includes(result.error?.message ?? '')) {
    const lookup = await post(':lookup', { localId: [uid] });
    const account = await lookup.json() as { users?: Array<{ localId: string; email?: string }> };
    if (!lookup.ok || !account.users?.some(user => user.localId === uid && user.email?.toLowerCase() === email)) {
      throw new TeacherServiceError(409, 'اسم المستخدم مستخدم بالفعل. اختر اسمًا مختلفًا');
    }
    return;
  }

  if (result.error?.message?.startsWith('WEAK_PASSWORD')) {
    throw new TeacherServiceError(400, 'كلمة المرور لا تستوفي سياسة Firebase للمشروع');
  }
  throw new TeacherServiceError(503, 'تعذّر إنشاء حساب المعلم في Firebase Authentication. راجع تفعيل البريد وكلمة المرور وصلاحيات حساب الخدمة');
}

async function expectTeacher(
  { tenant, dal, store }: TeacherServiceContext, id: string, version: number
) {
  const path = profilePath(tenant.id, id);
  const snapshot = await store.getDocument<TeacherProfile>(path);
  if (snapshot.exists) {
    if (snapshot.data.tenantId !== tenant.id || snapshot.data.id !== id) {
      throw new TeacherServiceError(404, 'المعلم غير موجود في هذا السنتر');
    }
    if (snapshot.data.version !== version || !snapshot.updateTime) {
      throw new TeacherServiceError(409, 'بيانات المعلم اتعدلت من جهاز تاني. حدّث القائمة وحاول مرة أخرى');
    }
    return { path, previous: snapshot.data, precondition: { updateTime: snapshot.updateTime } };
  }

  if (version !== 0) throw new TeacherServiceError(409, 'حدّث قائمة المعلمين وحاول مرة أخرى');
  if (!/^teacher-[a-f0-9-]{36}$/.test(id)) {
    const teacher = await dal.getUserById(id);
    if (teacher?.tenantId !== tenant.id || teacher.role !== 'TEACHER') {
      throw new TeacherServiceError(404, 'المعلم غير موجود في هذا السنتر');
    }
  }
  return { path, previous: undefined, precondition: { exists: false } };
}

export async function saveTeacherProfile(
  context: TeacherServiceContext,
  id: string,
  version: number,
  input: TeacherInput,
  password?: string,
  provision = provisionUsernameAccount,
): Promise<TeacherProfile> {
  const { tenant, store, dal } = context;
  const { path, previous, precondition } = await expectTeacher(context, id, version);
  if (previous && !previous.active) throw new TeacherServiceError(409, 'حساب المعلم مؤرشف');

  const subjects = new Set((await dal.getSubjects(tenant.id)).map(subject => subject.id));
  if (input.subjectIds.some(subjectId => !subjects.has(subjectId))) {
    throw new TeacherServiceError(400, 'اختر المواد من قائمة هذا السنتر');
  }

  const profile: TeacherProfile = {
    ...input, id, tenantId: tenant.id, active: true, version: version + 1, updatedAt: new Date().toISOString(),
  };
  const writes: FirestoreWriteOperation[] = [
    { type: 'set', documentPath: path, data: { ...profile }, currentDocument: precondition },
  ];
  const previousPath = previous?.login && await loginPath(tenant, previous.login.mode, loginEmail(tenant, previous.login));
  const email = input.login && loginEmail(tenant, input.login);
  const nextPath = input.login && email && await loginPath(tenant, input.login.mode, email);

  if (input.login && email && nextPath && nextPath !== previousPath) {
    const existingLink = await store.getDocument<LoginLink>(nextPath);
    if (existingLink.exists) throw new TeacherServiceError(409, 'بيانات الدخول مستخدمة لمعلم آخر في هذا السنتر');

    let uid: string | null = null;
    if (input.login.mode === 'username') {
      if (!password || password.length < 8 || password.length > 128) {
        throw new TeacherServiceError(400, 'كلمة مرور المعلم مطلوبة ومن 8 إلى 128 حرفًا');
      }
      uid = `yc_${await digest(JSON.stringify([tenant.id, id, email]))}`;
      await provision(uid, email, password);
    }
    writes.push({
      type: 'set', documentPath: nextPath, currentDocument: { exists: false },
      data: { teacherId: id, tenantId: tenant.id, uid },
    });
  }

  if (previousPath && previousPath !== nextPath) {
    writes.push({ type: 'delete', documentPath: previousPath });
  }
  await store.commit(writes);
  return profile;
}

export async function archiveTeacherProfile(context: TeacherServiceContext, id: string, version: number) {
  const { tenant, store, dal } = context;
  const { path, previous, precondition } = await expectTeacher(context, id, version);
  if (previous && !previous.active) return previous;
  const teacher = previous ? undefined : await dal.getUserById(id);
  const profile: TeacherProfile = {
    ...(previous ?? {
      fullName: teacher?.fullName ?? '', phone: teacher?.phone ?? '', phone2: '',
      avatarData: null, contracts: [], subjectIds: [], login: null, permissions: [], tabs: [],
    }),
    id, tenantId: tenant.id, active: false, version: version + 1, updatedAt: new Date().toISOString(),
  };
  const writes: FirestoreWriteOperation[] = [
    { type: 'set', documentPath: path, data: { ...profile }, currentDocument: precondition },
  ];
  if (previous?.login) {
    writes.push({ type: 'delete', documentPath: await loginPath(tenant, previous.login.mode, loginEmail(tenant, previous.login)) });
  }
  await store.commit(writes);
  return profile;
}

export async function getSignedInTeacher({ tenant, store }: TeacherServiceContext, token: VerifiedFirebaseToken) {
  const firebase = token.rawClaims.firebase as { sign_in_provider?: string } | undefined;
  const mode = firebase?.sign_in_provider === 'google.com' && token.emailVerified ? 'google'
    : firebase?.sign_in_provider === 'password' ? 'username' : null;
  const email = token.email?.trim().toLowerCase();
  const unauthorized = () => new TeacherServiceError(403, 'حساب الدخول ده مش مرتبط بمعلم نشط في هذا السنتر');
  if (!mode || !email) throw unauthorized();

  const link = await store.getDocument<LoginLink>(await loginPath(tenant, mode, email));
  if (!link.exists || link.data.tenantId !== tenant.id || (mode === 'username' && link.data.uid !== token.uid)) {
    throw unauthorized();
  }
  const record = await store.getDocument<TeacherProfile>(profilePath(tenant.id, link.data.teacherId));
  if (!record.exists || !record.data.active || record.data.tenantId !== tenant.id ||
    record.data.login?.mode !== mode || loginEmail(tenant, record.data.login) !== email) {
    throw unauthorized();
  }
  return record.data;
}

export async function readTeacherPortal(context: TeacherServiceContext, teacher: TeacherProfile, month: number, year: number) {
  const { tenant, dal } = context;
  const today = cairoClock().slice(0, 10);
  const seeSchedule = canUseTeacherTab(teacher, 'schedule');
  const seeStudents = canUseTeacherTab(teacher, 'students');
  const requestExtra = canUseTeacherTab(teacher, 'extraSession');
  const groups = seeSchedule || seeStudents || requestExtra ? await dal.getGroups(tenant.id) : [];
  const ownGroups = groups.filter(group => group.teacherId === teacher.id && group.isActive);

  const [schedule, roster, statement] = await Promise.all([
    seeSchedule ? dal.getSessions(tenant.id) : [],
    seeStudents ? Promise.all([
      dal.getEnrollments(tenant.id),
      dal.getUsers(tenant.id, { role: 'STUDENT' }),
    ]) : null,
    canUseTeacherTab(teacher, 'account') ? dal.calculateMonthlyTeacherPayroll({
      tenantId: tenant.id, teacherId: teacher.id, month, year, teacherProfile: teacher, persistDraft: false,
    }) : null,
  ]);
  const allowedStudents = new Set(roster?.[0].filter(enrollment => enrollment.isActive &&
    ownGroups.some(group => group.id === enrollment.groupId)).map(enrollment => enrollment.studentId));

  return {
    teacher: {
      fullName: teacher.fullName,
      avatarData: teacher.avatarData,
      permissions: teacher.permissions,
      tabs: teacher.tabs,
    },
    schedule: schedule.filter(session => session.status !== 'canceled' && session.status !== 'postponed' &&
      session.sessionDate >= today).map(session => ({
      id: session.id, date: session.sessionDate, start: session.startTime, end: session.endTime,
      groupName: groups.find(group => group.id === session.groupId)?.nameAr ?? 'حصة',
    })).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    students: roster?.[1].filter(student => allowedStudents.has(student.id) && student.isActive).map(student => ({
      id: student.id,
      name: student.fullName,
      code: student.studentCode,
      ...(teacher.permissions.includes('viewStudentDetails') ? { phone: student.phone, stage: student.stage, grade: student.grade } : {}),
    })) ?? [],
    account: statement ? {
      summary: {
        gross: statement.summary.grossCompensation,
        advances: statement.summary.totalAdvances,
        net: statement.summary.netPayrollInvoiced,
      },
      groups: [
        ...statement.centerSubscription.groups.map(group => ({ id: group.groupId, name: group.groupName, due: group.compensationAmount })),
        ...statement.privateLessons.groups.map(group => ({ id: group.groupId, name: group.groupName, due: group.totalTeacherShare })),
      ],
      lessons: statement.lessonCompensation?.sessions ?? [],
    } : null,
    groups: requestExtra ? ownGroups.map(group => ({ id: group.id, name: group.nameAr })) : [],
  };
}

export type TeacherPortalData = Awaited<ReturnType<typeof readTeacherPortal>>;

export async function submitTeacherExtraSession(
  { tenant, dal, store }: TeacherServiceContext,
  teacher: TeacherProfile,
  input: { id: string; groupId: string; date: string; time: string; note: string }
) {
  if (!canUseTeacherTab(teacher, 'extraSession')) throw new TeacherServiceError(403, 'طلب محاضرة إضافية يحتاج صلاحية');
  const group = await dal.getGroupById(tenant.id, input.groupId);
  if (!group?.isActive || group.teacherId !== teacher.id) throw new TeacherServiceError(403, 'اختر مجموعة مسندة لك');
  const clock = cairoClock();
  const dateMs = Date.parse(input.date);
  const today = Date.parse(clock.slice(0, 10));
  if (!Number.isFinite(dateMs) || new Date(dateMs).toISOString().slice(0, 10) !== input.date ||
    `${input.date}T${input.time}` <= clock || dateMs >= today + 7 * 86400000) {
    throw new TeacherServiceError(400, 'اختر موعدًا قادمًا خلال الأيام السبعة الحالية بتوقيت القاهرة');
  }
  const request: ExtraSessionRequest = {
    ...input, tenantId: tenant.id, teacherId: teacher.id, teacherName: teacher.fullName,
    groupName: group.nameAr, createdAt: new Date().toISOString(),
  };
  const path = `teacher_extra_sessions/${tenant.id}~${teacher.id}~${input.id}`;
  const previous = await store.getDocument<ExtraSessionRequest>(path);
  if (previous.exists) return previous.data;
  await store.commit([{ type: 'set', documentPath: path, data: { ...request }, currentDocument: { exists: false } }]);
  return request;
}
