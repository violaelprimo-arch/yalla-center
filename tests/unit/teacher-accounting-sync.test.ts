import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { calculateCenterSubscriptionCompensation, calculatePrivateLessonsSplit } from '@/lib/finance/compensation';
import type { TeacherProfile } from '@/lib/teachers/profile';

describe('Yalla Center — Unify Teacher Accounting with Classes & Groups Accounting', () => {
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';
  const otherTenantId = 'tenant-rowad-002';

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  describe('1. Single Source of Truth & Formula Verification', () => {
    it('1 & 2: Center compensation matches approved formula: (Total Attendance / Conducted Sessions) * Fixed Rate', async () => {
      // 4 sessions: 40, 45, 50, 45 -> Total = 180, Avg = 45, Rate = 100 EGP -> Due = 4,500 EGP
      const sessionRecords = [
        { sessionId: 's1', attendanceCount: 40, isCanceled: false, sessionStatus: 'completed' as const },
        { sessionId: 's2', attendanceCount: 45, isCanceled: false, sessionStatus: 'completed' as const },
        { sessionId: 's3', attendanceCount: 50, isCanceled: false, sessionStatus: 'completed' as const },
        { sessionId: 's4', attendanceCount: 45, isCanceled: false, sessionStatus: 'completed' as const },
      ];
      const result = calculateCenterSubscriptionCompensation(sessionRecords, 100);

      expect(result.conductedSessions).toBe(4);
      expect(result.totalValidAttendance).toBe(180);
      expect(result.averageAttendance).toBe(45);
      expect(result.totalCompensation).toBe(4500.0);
    });

    it('3 & 4: Private percentage compensation calculates correctly with discounts', () => {
      // 100 EGP base, 20% discount -> Net = 80 EGP, 70% teacher / 30% center -> 56 / 24
      const split = calculatePrivateLessonsSplit(100, 'PERCENT', 20, 70, 30);
      expect(split.grossPrice).toBe(100);
      expect(split.discountAmount).toBe(20);
      expect(split.netRevenue).toBe(80);
      expect(split.teacherShare).toBe(56.0);
      expect(split.centerShare).toBe(24.0);
      expect(split.teacherShare + split.centerShare).toBe(80.0);
    });

    it('5: Fixed amount discounts calculate correctly with zero leakage', () => {
      // 100 EGP base, 35 EGP fixed discount -> Net = 65 EGP, 70/30 split -> 45.5 / 19.5
      const split = calculatePrivateLessonsSplit(100, 'FIXED', 35, 70, 30);
      expect(split.grossPrice).toBe(100);
      expect(split.discountAmount).toBe(35);
      expect(split.netRevenue).toBe(65);
      expect(split.teacherShare).toBe(45.5);
      expect(split.centerShare).toBe(19.5);
      expect(split.teacherShare + split.centerShare).toBe(65.0);
    });

    it('6: 100% scholarship free students yield zero teacher compensation in Private', () => {
      const split = calculatePrivateLessonsSplit(100, 'SCHOLARSHIP_100', 0, 70, 30);
      expect(split.grossPrice).toBe(100);
      expect(split.discountAmount).toBe(100);
      expect(split.netRevenue).toBe(0);
      expect(split.teacherShare).toBe(0);
      expect(split.centerShare).toBe(0);
      expect(split.teacherShare + split.centerShare).toBe(0);
    });
  });

  describe('2. DAL Monthly Teacher Statement Identical Calculations', () => {
    it('7 & 8: Calculates multi-group teacher with Center and Private groups accurately', async () => {
      const teacherId = 'user-teacher-math';

      // Math teacher has grp-math-sat (Center model, 20 EGP/student)
      const statement = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      expect(statement.tenantId).toBe(tenantId);
      expect(statement.teacherId).toBe(teacherId);
      expect(statement.payrollMonth).toBe(10);
      expect(statement.payrollYear).toBe(2026);
      expect(statement.centerSubscription.groups.length).toBeGreaterThan(0);

      const mathGroup = statement.centerSubscription.groups.find((g) => g.groupId === 'grp-math-sat');
      expect(mathGroup).toBeDefined();
      expect(mathGroup!.ratePerStudent).toBe(20.0);
      expect(mathGroup!.conductedSessionsCount).toBe(5);
      expect(mathGroup!.totalValidAttendance).toBe(52);
      expect(mathGroup!.averageAttendance).toBe(10.4);
      expect(mathGroup!.compensationAmount).toBe(208.0);

      // Verify gross and net match
      expect(statement.summary.grossCompensation).toBe(statement.centerSubscription.totalCompensation);
      expect(statement.summary.netPayrollInvoiced).toBe(statement.summary.grossCompensation - statement.summary.totalAdvances);
    });

    it('9 & 10: Attendance updates dynamically update statement and strictly exclude canceled sessions', async () => {
      const teacherId = 'user-teacher-math';

      // Verify initial statement with canceled session sess-math-5-canceled excluded
      const stmtBefore = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      const mathGroup = stmtBefore.centerSubscription.groups.find((g) => g.groupId === 'grp-math-sat')!;
      expect(mathGroup.conductedSessionsCount).toBe(5);
      expect(mathGroup.sessions?.find((s) => s.sessionId === 'sess-math-5-canceled')?.status).toBe('canceled');

      // Add a 6th completed session with 20 students
      dal.sessions.push({
        id: 'sess-math-extra',
        tenantId,
        groupId: 'grp-math-sat',
        classroomId: 'room-101',
        teacherId,
        sessionDate: '2026-10-30',
        startTime: '14:00',
        endTime: '16:00',
        status: 'completed',
        notes: 'حصة تعويضية إضافية',
        createdAt: '2026-10-30T00:00:00Z',
      });

      for (let i = 0; i < 20; i++) {
        dal.attendance.push({
          id: `att-extra-${i}`,
          tenantId,
          sessionId: 'sess-math-extra',
          studentId: `student-extra-${i}`,
          status: 'present',
          scannedAt: '2026-10-30T14:05:00Z',
          verificationMethod: 'barcode',
        });
      }

      // Recalculate statement dynamically
      const stmtAfter = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      const updatedGroup = stmtAfter.centerSubscription.groups.find((g) => g.groupId === 'grp-math-sat')!;
      expect(updatedGroup.conductedSessionsCount).toBe(6);
      expect(updatedGroup.totalValidAttendance).toBe(52 + 20); // 72
      expect(updatedGroup.averageAttendance).toBe(12.0); // 72 / 6 = 12.0
      expect(updatedGroup.compensationAmount).toBe(240.0); // 12.0 * 20 = 240.0
    });

    it('11: Advances and payouts deduct from net payroll without double-counting', async () => {
      const teacherId = 'user-teacher-math';

      const initial = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      // Add an advance of 100 EGP
      dal.teacherAdvances.push({
        id: 'adv-new-test',
        tenantId,
        teacherId,
        amount: 100.0,
        reason: 'سلفة نقدية شخصية',
        disbursedByUserId: 'admin-1',
        paidAt: '2026-10-15T10:00:00Z',
        status: 'pending',
        createdAt: '2026-10-15T10:00:00Z',
      });

      const updated = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      expect(updated.summary.totalAdvances).toBe(initial.summary.totalAdvances + 100.0);
      expect(updated.summary.netPayrollInvoiced).toBe(
        Math.max(0, updated.summary.grossCompensation - updated.summary.totalAdvances)
      );
    });

    it('12: Monthly filters return period-consistent results', async () => {
      const teacherId = 'user-teacher-math';

      // October 2026 has sessions
      const octStmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });
      expect(octStmt.centerSubscription.groups[0].conductedSessionsCount).toBeGreaterThan(0);

      // November 2026 has 0 conducted sessions
      const novStmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 11,
        year: 2026,
      });
      expect(novStmt.centerSubscription.groups[0].conductedSessionsCount).toBe(0);
      expect(novStmt.centerSubscription.groups[0].compensationAmount).toBe(0);
      expect(novStmt.summary.grossCompensation).toBe(0);
    });

    it('13 & 14: Finalized historical statements remain immutable', async () => {
      const teacherId = 'user-teacher-math';

      // Approve payroll record to finalize it
      const payrollRecord = dal.teacherPayroll.find(
        (p) => p.teacherId === teacherId && p.tenantId === tenantId && p.payrollMonth === 10
      );
      if (payrollRecord) {
        payrollRecord.status = 'approved';
        payrollRecord.calculatedCompensation = 5000.0;
        payrollRecord.netPayroll = 5000.0;
      }

      // Querying statement respects locked finalized values
      const stmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      expect(stmt.summary.grossCompensation).toBe(5000.0);
      expect(stmt.summary.netPayrollInvoiced).toBe(5000.0);
    });

    it('15: Tenant isolation prevents cross-tenant financial leakage', async () => {
      const teacherId = 'user-teacher-math';

      // Querying with another tenant ID must return 0 compensation for teacher of tenant-maher
      const otherStmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId: otherTenantId,
        teacherId,
        month: 10,
        year: 2026,
      });

      expect(otherStmt.centerSubscription.groups.length).toBe(0);
      expect(otherStmt.privateLessons.groups.length).toBe(0);
      expect(otherStmt.summary.grossCompensation).toBe(0);
    });
  });

  describe('3. Teacher Contracts Model Matching', () => {
    it('honors teacher profile contracts with average_monthly model', async () => {
      const teacherId = 'user-teacher-math';
      const teacherProfile: Pick<TeacherProfile, 'id' | 'tenantId' | 'fullName' | 'phone' | 'contracts'> = {
        id: teacherId,
        tenantId,
        fullName: 'أستاذ الرياضيات المتميز',
        phone: '01012345678',
        contracts: [
          {
            level: '3_sec',
            model: 'average_monthly',
            value: 50.0, // 50 EGP per student average
          },
        ],
      };

      const stmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId,
        teacherId,
        month: 10,
        year: 2026,
        teacherProfile,
      });

      const mathGroup = stmt.centerSubscription.groups.find((g) => g.groupId === 'grp-math-sat')!;
      expect(mathGroup.ratePerStudent).toBe(50.0);
      expect(mathGroup.compensationAmount).toBe(mathGroup.averageAttendance * 50.0);
    });
  });
});
