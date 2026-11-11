import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import {
  archiveTeacherProfile, assertTeacherManager, getSignedInTeacher, readTeacherPortal, saveTeacherProfile,
  submitTeacherExtraSession,
} from '@/lib/firebase/teacher-service';
import type { VerifiedFirebaseToken } from '@/lib/firebase/server';
import {
  emptyTeacherInput, matchTeacherContract, teacherInputSchema, type TeacherInput,
} from '@/lib/teachers/profile';
import { calculateTeacherSessionPay } from '@/lib/teachers/session-compensation';
import { cairoClock } from '@/lib/attendance/reception';
import { InMemoryTransactionalFirestoreStore } from '../helpers/in-memory-firestore';

const teacherId = 'user-teacher-math';
const tenantId = 'tenant-maher-001';
const google = (email: string, emailVerified = true): VerifiedFirebaseToken => ({
  uid: 'verified-firebase-teacher', email, emailVerified,
  rawClaims: { firebase: { sign_in_provider: 'google.com' } },
});
const teacher: TeacherInput = {
  ...emptyTeacherInput, fullName: 'معلم تجريبي', phone: '01000000000',
  login: { mode: 'google', email: 'math.teacher@example.com' },
  subjectIds: ['sub-math-3sec'],
  contracts: [{ level: '3_sec', model: 'per_attendee', value: 10 }],
};

describe('Teacher affairs permissions and compensation', () => {
  let dal: MockDataProvider;
  let store: InMemoryTransactionalFirestoreStore;

  beforeEach(() => {
    dal = new MockDataProvider();
    store = new InMemoryTransactionalFirestoreStore();
  });

  async function context(slug = 'al-maher') {
    const tenant = (await dal.getTenantBySlug(slug))!;
    return { dal, store, tenant };
  }

  it('allows active managers only in their own tenant and keeps accountant access read-only', async () => {
    store.seed('staff_memberships/manager', { tenantId, role: 'CENTER_ADMIN', isActive: true });
    store.seed('staff_memberships/accountant', { tenantId, role: 'ACCOUNTANT', isActive: true });
    store.seed('staff_memberships/teacher', { tenantId, role: 'TEACHER', isActive: true });
    store.seed('staff_memberships/disabled', { tenantId, role: 'CENTER_ADMIN', isActive: false });
    await expect(assertTeacherManager(store, 'manager', tenantId)).resolves.toBeUndefined();
    await expect(assertTeacherManager(store, 'accountant', tenantId, true)).resolves.toBeUndefined();
    for (const uid of ['accountant', 'teacher', 'disabled', 'missing']) {
      await expect(assertTeacherManager(store, uid, tenantId)).rejects.toMatchObject({ status: 403 });
    }
    await expect(assertTeacherManager(store, 'manager', 'another-tenant')).rejects.toMatchObject({ status: 403 });
  });

  it('binds Google access to the registered address and tenant, and revokes it on edit and deletion', async () => {
    const ctx = await context();
    const saved = await saveTeacherProfile(ctx, teacherId, 0, teacher);
    await expect(getSignedInTeacher(ctx, google('math.teacher@example.com', false))).rejects.toMatchObject({ status: 403 });
    await expect(getSignedInTeacher(await context('al-rowad'), google('math.teacher@example.com'))).rejects.toMatchObject({ status: 403 });
    await expect(getSignedInTeacher(ctx, google('math.teacher@example.com'))).resolves.toEqual(saved);
    await expect(saveTeacherProfile(ctx, teacherId, 0, teacher)).rejects.toMatchObject({ status: 409 });
    const updated = await saveTeacherProfile(ctx, teacherId, saved.version, {
      ...teacher, login: { mode: 'google', email: 'new.teacher@example.com' },
    });
    await expect(getSignedInTeacher(ctx, google('math.teacher@example.com'))).rejects.toMatchObject({ status: 403 });
    const deleted = await archiveTeacherProfile(ctx, teacherId, updated.version);
    expect(deleted.active).toBe(false);
    expect(deleted.contracts).toEqual(teacher.contracts);
    await expect(getSignedInTeacher(ctx, google('new.teacher@example.com'))).rejects.toMatchObject({ status: 403 });
  });

  it('provisions username/password through Firebase without storing the password', async () => {
    const ctx = await context();
    const provision = vi.fn(async (_uid: string, _email: string, _password: string) => undefined);
    const profile = await saveTeacherProfile(ctx, teacherId, 0,
      { ...teacher, login: { mode: 'username', username: 'math-teacher' } }, 'Test-Password-2026', provision);
    const [uid, email] = provision.mock.calls[0];
    expect(provision).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...store.docs.values()])).not.toContain('Test-Password-2026');
    const token = { ...google(email), uid, rawClaims: { firebase: { sign_in_provider: 'password' } } };
    await expect(getSignedInTeacher(ctx, token)).resolves.toEqual(profile);
    await expect(getSignedInTeacher(ctx, { ...token, uid: 'wrong-firebase-uid' })).rejects.toMatchObject({ status: 403 });
  });

  it('applies tab visibility and field-level permissions to the teacher portal', async () => {
    const ctx = await context();
    const profile = await saveTeacherProfile(ctx, teacherId, 0, {
      ...teacher, permissions: ['viewStudents', 'viewAccount'], tabs: ['students'],
    });
    const portal = await readTeacherPortal(ctx, profile, 10, 2026);
    expect(portal.students.map(student => student.id)).toEqual(['user-student-1001', 'user-student-1002']);
    expect(portal.students[0]).not.toHaveProperty('phone');
    expect(portal.account).toBeNull();
    expect(portal.schedule).toEqual([]);
    expect(portal.groups).toEqual([]);
    await expect(submitTeacherExtraSession(ctx, profile, {
      id: 'sample-request', groupId: 'grp-math-sat', date: '2026-11-11', time: '15:00', note: '',
    })).rejects.toMatchObject({ status: 403 });
  });

  it('sends an extra lecture request only for an assigned group in the next seven days', async () => {
    const ctx = await context();
    const profile = await saveTeacherProfile(ctx, teacherId, 0, {
      ...teacher, permissions: ['requestExtraSession'], tabs: ['extraSession'],
    });
    const date = new Date(Date.parse(cairoClock().slice(0, 10)) + 86400000).toISOString().slice(0, 10);
    const input = { id: 'sample-request', groupId: 'grp-math-sat', date, time: '15:00', note: 'مراجعة' };
    await expect(submitTeacherExtraSession(ctx, profile, { ...input, groupId: 'grp-phys-sun' })).rejects.toMatchObject({ status: 403 });
    const request = await submitTeacherExtraSession(ctx, profile, input);
    await expect(submitTeacherExtraSession(ctx, profile, input)).resolves.toEqual(request);
    expect(request.teacherId).toBe(teacherId);
    expect(request.date).toBe(date);
  });

  it('calculates 20 × 10 from unique valid attendance, deducts it from session revenue and includes it once in payroll', async () => {
    const session = dal.sessions.find(item => item.id === 'sess-math-1')!;
    const record = { tenantId, sessionId: session.id, scannedAt: '2026-10-04T11:00:00Z', verificationMethod: 'barcode' as const };
    for (let i = 0; i < 20; i++) {
      dal.attendance.push({ ...record, id: `scan-${i}`, studentId: `student-${i}`, status: i === 19 ? 'late' : 'present' });
    }
    dal.attendance.push({ ...record, id: 'repeat', studentId: 'student-0', status: 'present' });
    dal.attendance.push({ ...record, id: 'absent', studentId: 'student-21', status: 'absent' });
    dal.attendance.push({ ...record, id: 'wrong-tenant', tenantId: 'other', studentId: 'student-22', status: 'present' });
    dal.attendance.push({ ...record, id: 'cancelled', sessionId: 'sess-math-5-canceled', studentId: 'student-23', status: 'present' });
    const profile = await saveTeacherProfile(await context(), teacherId, 0, teacher);
    const statement = await dal.calculateMonthlyTeacherPayroll({ tenantId, teacherId, month: 10, year: 2026, teacherProfile: profile });
    expect(statement.lessonCompensation?.sessions.find(lesson => lesson.sessionId === session.id)).toMatchObject({
      attendanceCount: 20, revenue: 1600, teacherDue: 200, centerNet: 1400,
    });
    expect(statement.lessonCompensation?.sessions.map(lesson => lesson.sessionId)).not.toContain('sess-math-5-canceled');
    expect(statement.centerSubscription.totalCompensation).toBe(0);
    expect(statement.summary.grossCompensation).toBe(200);
    expect(statement.summary.payrollRecord?.calculatedCompensation).toBe(200);
    const nextMonth = await dal.calculateMonthlyTeacherPayroll({ tenantId, teacherId, month: 11, year: 2026, teacherProfile: profile });
    expect(nextMonth.summary.grossCompensation).toBe(0);
  });

  it('matches a grade contract before a whole stage and validates amounts and phone formats', async () => {
    const subject = (await dal.getSubjects(tenantId))[0];
    expect(matchTeacherContract([
      { level: 'secondary', model: 'private', value: 60 },
      { level: subject.grade, model: 'fixed_session', value: 100 },
    ], subject)?.model).toBe('fixed_session');
    expect(teacherInputSchema.parse({ ...teacher, phone: '٠١٠ ٠٠٠٠ ٠٠٠٠' }).phone).toBe('01000000000');
    expect(teacherInputSchema.safeParse({ ...teacher, contracts: [{ level: '1_sec', model: 'private', value: 100.01 }] }).success).toBe(false);
    const session = dal.sessions[0];
    expect(calculateTeacherSessionPay({ level: subject.grade, model: 'fixed_session', value: 120 }, session, 20, 500))
      .toEqual({ teacherDue: 120, centerNet: 380 });
    expect(calculateTeacherSessionPay({ level: subject.grade, model: 'private', value: 62.5 }, session, 20, 500))
      .toEqual({ teacherDue: 312.5, centerNet: 187.5 });
  });
});
