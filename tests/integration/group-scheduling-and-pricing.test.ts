import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { attachDemoOperations } from '@/lib/dal/demo-operations';
import { readMasterData } from '@/lib/dal/master-data';
import { buildGroup, type GroupInput, type GroupPricing } from '@/lib/timetable/group-schedule';
import { weeklyScheduleRows } from '@/lib/timetable/schedule-view';
import { scheduleExportRows } from '@/lib/timetable/export';
import { archiveManagedClassroom, archiveManagedGroups, loadGroupProvider, saveManagedClassroom, saveManagedGroup } from '@/lib/firebase/group-service';
import { InMemoryTransactionalFirestoreStore } from '../helpers/in-memory-firestore';

const tenantId = 'tenant-maher-001';
const teacherId = 'user-teacher-math';
const studentId = 'user-student-1001';
const pricing: GroupPricing = { model: 'center', monthlyFee: 300, teacherRate: 20 };
const sample: GroupInput = {
  id: 'group-weekly-test', version: 0, nameAr: 'مجموعة الاختبار', branchId: 'branch-nasr-city',
  stageId: 'secondary', gradeId: '3_sec', subjectId: 'sub-math-3sec', teacherId, pricing,
  weeklySlots: [
    { id: 'saturday', scheduleDay: 6, startTime: '10:00', endTime: '11:00', classroomId: 'room-101' },
    { id: 'monday', scheduleDay: 1, startTime: '17:00', endTime: '18:00', classroomId: 'room-102' },
  ],
};

async function references(dal: MockDataProvider) {
  return {
    ...await readMasterData(dal, tenantId),
    groups: await dal.getGroups(tenantId), classrooms: await dal.getClassrooms(tenantId),
    teachers: await dal.getUsers(tenantId, { role: 'TEACHER' }),
  };
}

async function create(dal: MockDataProvider, input: GroupInput = sample, at = '2026-11-01T08:00:00Z') {
  const group = buildGroup(tenantId, input, await references(dal), new Date(at));
  dal.groups.push(group);
  return group;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-09T14:00:00Z'));
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('weekly groups and their financial rules', () => {
  it('keeps the room for each weekly meeting and rejects a collision on a secondary slot', async () => {
    const dal = new MockDataProvider();
    const group = await create(dal);
    const refs = await references(dal);
    expect(() => buildGroup(tenantId, {
      ...sample, id: 'group-conflicting', weeklySlots: [{ ...sample.weeklySlots[1], startTime: '17:30', endTime: '18:30' }],
    }, refs)).toThrow('تعارض');
    const sessions = await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-09' });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ classroomId: 'room-102', teacherId });
    expect((await dal.getSessionById(tenantId, sessions[0].id))?.classroomId).toBe('room-102');
    const rows = weeklyScheduleRows([group], refs.classrooms, refs.branches, refs.subjects, refs.teachers);
    expect(rows.map(row => row.room)).toEqual(['قاعة د. زويل (1)', 'قاعة العقاد (2)']);
    expect(scheduleExportRows(rows)).toHaveLength(3);
  });

  it('calculates 20 × 100 from actual distinct attendance in completed sessions of the selected month', async () => {
    const dal = new MockDataProvider();
    const group = await create(dal);
    const sessions = await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-02' });
    const [saturday] = await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-07' });
    for (const session of [...sessions, saturday]) {
      for (let index = 0; index < 100; index += 1) {
        dal.attendance.push({ id: `${session.id}-${index}`, tenantId, sessionId: session.id, studentId: `student-${index}`,
          status: index % 2 ? 'late' : 'present', scannedAt: new Date().toISOString(), verificationMethod: 'manual' });
      }
      dal.attendance.push({ ...dal.attendance.at(-1)!, id: `duplicate-${session.id}` });
    }
    const result = await dal.calculateMonthlyTeacherPayroll({ tenantId, teacherId, year: 2026, month: 11, persistDraft: false });
    expect(result.centerSubscription.groups.find(item => item.groupId === group.id)).toMatchObject({
      conductedSessionsCount: 2, totalValidAttendance: 200, averageAttendance: 100, compensationAmount: 2000,
    });
    const otherMonth = await dal.calculateMonthlyTeacherPayroll({ tenantId, teacherId, year: 2026, month: 12, persistDraft: false });
    expect(otherMonth.centerSubscription.totalCompensation).toBe(0);
  });

  it('keeps the 210/90 split attached to a 300 monthly invoice after editing the group', async () => {
    const dal = new MockDataProvider();
    const group = await create(dal, { ...sample, pricing: { model: 'private', monthlyFee: 300, teacherPercentage: 70 } });
    const enrollment = await dal.enrollStudent({
      tenantId, studentId, groupId: group.id, pricingModel: 'center', discountType: 'none', discountValue: 0,
    });
    expect(enrollment.invoice?.netAmount).toBe(300);
    const edited = buildGroup(tenantId, { ...sample, version: 1,
      pricing: { model: 'private', monthlyFee: 350, teacherPercentage: 50 } }, await references(dal));
    dal.setManagedGroups(tenantId, [edited]);
    const result = await dal.calculateMonthlyTeacherPayroll({ tenantId, teacherId, year: 2026, month: 11, persistDraft: false });
    expect(result.privateLessons.groups.find(item => item.groupId === group.id && item.teacherPercentage === 70))
      .toMatchObject({ totalTeacherShare: 210, totalCenterShare: 90, totalCollectedTeacherShare: 0 });
  });

  it('creates a single fixed-split ticket per attended session and keeps payments after reopening the demo', async () => {
    const dal = new MockDataProvider();
    attachDemoOperations(dal, localStorage);
    const group = await create(dal, { ...sample, pricing: { model: 'per_session', teacherFee: 60, centerFee: 25 } });
    const result = await dal.enrollStudent({
      tenantId, studentId, groupId: group.id, pricingModel: 'center', discountType: 'none', discountValue: 0,
    });
    expect(result.invoice).toBeUndefined();
    expect(result.enrollment?.pricingModel).toBe('per_session');
    const [session] = await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-09' });
    const scans = await Promise.all([
      dal.recordAttendanceScan(tenantId, session.id, studentId),
      dal.recordAttendanceScan(tenantId, session.id, studentId),
    ]);
    expect(scans.filter(scan => scan.isNewRecord)).toHaveLength(1);
    const ticket = (await dal.getInvoices(tenantId)).filter(invoice => invoice.sessionId === session.id);
    expect(ticket).toHaveLength(1);
    expect(ticket[0].netAmount).toBe(85);
    await dal.collectStudentPayment({ tenantId, studentId, sessionId: session.id, amountPaid: 85,
      paymentMethod: 'cash', cashierUserId: 'user-admin-maher' });
    const restored = new MockDataProvider();
    attachDemoOperations(restored, localStorage);
    restored.setManagedGroups(tenantId, [group]);
    expect((await restored.getSessionAttendanceStats(tenantId, session.id)).fixedSessionSplit)
      .toMatchObject({ collected: 85, teacherDue: 60, centerNet: 25 });
    await restored.updateSessionStatus(session.id, 'completed');
    const statement = await restored.calculateMonthlyTeacherPayroll({ tenantId, teacherId, year: 2026, month: 11, persistDraft: false });
    expect(statement.lessonCompensation?.sessions.find(row => row.sessionId === session.id))
      .toMatchObject({ teacherDue: 60, centerNet: 25, teacherCollected: 60, centerCollected: 25 });
  });

  it('persists group versions and serializes concurrent schedule changes in Firestore', async () => {
    const dal = new MockDataProvider();
    const tenant = (await dal.getTenantById(tenantId))!;
    const store = new InMemoryTransactionalFirestoreStore();
    const [a, b] = await Promise.allSettled([
      saveManagedGroup({ dal, tenant, store }, sample),
      saveManagedGroup({ dal, tenant, store }, { ...sample, id: 'group-other' }),
    ]);
    expect([a, b].filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const first = a.status === 'fulfilled' ? a.value : b.status === 'fulfilled' ? b.value : undefined;
    expect(first?.version).toBe(1);
    const next = await saveManagedGroup({ dal: new MockDataProvider(), tenant, store }, {
      ...sample, id: first!.id, version: 1, nameAr: 'اسم جديد',
    });
    expect(next).toMatchObject({ nameAr: 'اسم جديد', version: 2 });
  });

  it('keeps the original attendance and invoice after removing a group and stops generating new sessions', async () => {
    const dal = new MockDataProvider();
    const tenant = (await dal.getTenantById(tenantId))!;
    const store = new InMemoryTransactionalFirestoreStore();
    vi.setSystemTime(new Date('2026-11-01T08:00:00Z'));
    const group = await saveManagedGroup({ dal, tenant, store }, sample);
    dal.setManagedGroups(tenantId, [group]);
    const result = await dal.enrollStudent({
      tenantId, studentId, groupId: group.id, pricingModel: 'center', discountType: 'none', discountValue: 0,
    });
    const [session] = await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-02' });
    await dal.recordAttendanceScan(tenantId, session.id, studentId);
    vi.setSystemTime(new Date('2026-11-09T14:00:00Z'));
    const archived = await archiveManagedGroups({ dal, tenant, store }, [{ id: group.id, version: group.version! }]);
    dal.setManagedGroups(tenantId, archived);

    expect(archived[0]).toMatchObject({ isActive: false, version: 2 });
    expect(await dal.getSessions(tenantId, { groupId: group.id, date: '2026-11-09' })).toEqual([]);
    expect(await dal.getStudentAttendanceHistory(tenantId, studentId)).toContainEqual(expect.objectContaining({ sessionId: session.id }));
    expect(await dal.getInvoices(tenantId)).toContainEqual(result.invoice);
    expect(await dal.getStudentEnrollmentDetails(tenantId, studentId)).not.toContainEqual(expect.objectContaining({ groupId: group.id }));
    expect((await loadGroupProvider(store, tenant)).groups.find(item => item.id === group.id)?.isActive).toBe(false);
  });

  it('edits a seeded room in place and permits its removal after the dependent groups are removed', async () => {
    const dal = new MockDataProvider();
    const tenant = (await dal.getTenantById(tenantId))!;
    const store = new InMemoryTransactionalFirestoreStore();
    const context = { dal, tenant, store };
    const room = { id: 'room-102', branchId: 'branch-nasr-city', nameAr: 'قاعة معدلة', capacity: 40 };
    await saveManagedClassroom(context, room);
    const readRooms = async () => (await loadGroupProvider(store, tenant)).getClassrooms(tenantId, room.branchId);
    expect((await readRooms()).filter(item => item.id === room.id)).toEqual([expect.objectContaining(room)]);
    const group = await saveManagedGroup(context, sample);
    await expect(archiveManagedClassroom(context, room)).rejects.toThrow('مرتبطة بموعد مجموعة نشطة');
    await archiveManagedGroups(context, [
      { id: group.id, version: group.version! }, { id: 'grp-phys-sun', version: 0 },
    ]);
    await archiveManagedClassroom(context, room);
    expect(await readRooms()).not.toContainEqual(expect.objectContaining({ id: room.id }));
    await expect(saveManagedGroup(context, { ...sample, id: 'group-new' })).rejects.toThrow('اختر قاعة');
  });
});
