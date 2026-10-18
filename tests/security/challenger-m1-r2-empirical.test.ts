import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { UserRole } from '@/lib/dal';

describe('Challenger M1-R2-2: Empirical Verification of Schema, Role Whitelist & Attendance Idempotency', () => {
  // =========================================================================
  // 1. updateTeacherRate Role Whitelist & Security Guardrails
  // =========================================================================
  describe('1. updateTeacherRate RBAC Whitelist Verification', () => {
    let dal: MockDataProvider;

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    const authorizedRoles: UserRole[] = [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
    ];

    const forbiddenRoles: UserRole[] = [
      'TEACHER',
      'STUDENT',
      'PARENT',
      'RECEPTIONIST',
    ];

    it.each(authorizedRoles)(
      'permits authorized role %s to update teacher rates with HTTP 200 OK',
      async (role) => {
        const rate = dal.teacherRates[0];
        const newRateValue = 75.5;

        const result = await dal.updateTeacherRate(
          rate.id,
          { fixedRatePerStudent: newRateValue, teacherPercentage: 80, centerPercentage: 20 },
          role
        );

        expect(result.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.fixedRatePerStudent).toBe(newRateValue);
        expect(result.data?.teacherPercentage).toBe(80);
      }
    );

    it.each(forbiddenRoles)(
      'rejects unauthorized role %s attempting to update teacher rates with HTTP 403 Forbidden',
      async (role) => {
        const rate = dal.teacherRates[0];
        const originalRate = rate.fixedRatePerStudent;

        const result = await dal.updateTeacherRate(
          rate.id,
          { fixedRatePerStudent: 999.0, teacherPercentage: 99 },
          role
        );

        expect(result.status).toBe(403);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Forbidden|HTTP 403|غير مصرح لك/i);

        // Verify the database / memory state was NOT modified
        const freshRate = dal.teacherRates.find((r) => r.id === rate.id);
        expect(freshRate?.fixedRatePerStudent).toBe(originalRate);
      }
    );

    it('rejects teacher attempting to modify their OWN rate (self-escalation) with HTTP 403', async () => {
      const teacher = dal.users.find((u) => u.role === 'TEACHER')!;
      const teacherRate = dal.teacherRates.find((r) => r.teacherId === teacher.id)!;

      const result = await dal.updateTeacherRate(
        teacherRate.id,
        { fixedRatePerStudent: 500, teacherPercentage: 95 },
        'TEACHER'
      );

      expect(result.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/403/);
    });

    it('rejects teacher attempting to modify peer teacher rate with HTTP 403', async () => {
      const allRates = dal.teacherRates;
      expect(allRates.length).toBeGreaterThanOrEqual(1);

      const result = await dal.updateTeacherRate(
        allRates[0].id,
        { fixedRatePerStudent: 300 },
        'TEACHER'
      );

      expect(result.status).toBe(403);
      expect(result.success).toBe(false);
    });

    it('enforces RBAC gate before database existence check (rejects non-existent rate ID for unauthorized role with 403, not 404)', async () => {
      // Prevents attackers from enumerating valid rate IDs via status code differences
      const result = await dal.updateTeacherRate(
        'non-existent-rate-uuid-999',
        { fixedRatePerStudent: 100 },
        'STUDENT'
      );

      expect(result.status).toBe(403);
      expect(result.success).toBe(false);
    });

    it('returns 404 for authorized role when rate ID does not exist', async () => {
      const result = await dal.updateTeacherRate(
        'non-existent-rate-uuid-999',
        { fixedRatePerStudent: 100 },
        'CENTER_ADMIN'
      );

      expect(result.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/غير موجود/);
    });
  });

  // =========================================================================
  // 2. Attendance Idempotency & Reception HUD Scanning
  // =========================================================================
  describe('2. Attendance Idempotency Verification', () => {
    let dal: MockDataProvider;

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    it('first scan returns isNewRecord: true, duplicate: false, and exactly 1 record is created', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT' && u.tenantId === session.tenantId)!;

      const initialCount = (await dal.getSessionAttendance(session.id)).length;

      const scanResult = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
        verificationMethod: 'barcode',
      });

      expect(scanResult.success).toBe(true);
      expect(scanResult.isNewRecord).toBe(true);
      expect(scanResult.duplicate).toBe(false);
      expect(scanResult.attendance).toBeDefined();
      expect(scanResult.attendance?.studentId).toBe(student.id);
      expect(scanResult.attendance?.sessionId).toBe(session.id);
      expect(scanResult.messageAr).toMatch(/تم تسجيل الحضور بنجاح/);

      const afterCount = (await dal.getSessionAttendance(session.id)).length;
      expect(afterCount).toBe(initialCount + 1);
    });

    it('duplicate scan in same session returns duplicate: true, isNewRecord: false, and reuses record ID', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT' && u.tenantId === session.tenantId)!;

      // First scan
      const firstScan = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
      });
      expect(firstScan.isNewRecord).toBe(true);
      expect(firstScan.duplicate).toBe(false);

      const countAfterFirst = (await dal.getSessionAttendance(session.id)).length;

      // Duplicate scan
      const secondScan = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
      });

      expect(secondScan.success).toBe(true);
      expect(secondScan.duplicate).toBe(true);
      expect(secondScan.isNewRecord).toBe(false);
      expect(secondScan.attendance?.id).toBe(firstScan.attendance?.id);
      expect(secondScan.messageAr).toMatch(/تم تسجيل الحضور مسبقاً/);

      // Verify no extra row was inserted
      const countAfterSecond = (await dal.getSessionAttendance(session.id)).length;
      expect(countAfterSecond).toBe(countAfterFirst);
    });

    it('duplicate scan does not enqueue duplicate notifications to guardian', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.guardianPhone
      )!;

      const notifsBefore = (await dal.getNotificationLogs(session.tenantId)).length;

      // First scan (should enqueue 1 notification)
      const scan1 = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
      });
      expect(scan1.isNewRecord).toBe(true);

      const notifsAfterScan1 = (await dal.getNotificationLogs(session.tenantId)).length;
      expect(notifsAfterScan1).toBe(notifsBefore + 1);

      // Duplicate scan (should NOT enqueue any notification)
      const scan2 = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
      });
      expect(scan2.duplicate).toBe(true);
      expect(scan2.isNewRecord).toBe(false);

      const notifsAfterScan2 = (await dal.getNotificationLogs(session.tenantId)).length;
      expect(notifsAfterScan2).toBe(notifsAfterScan1); // Exactly equal, zero spam
    });

    it('cross-identifier idempotency: scan by studentCode followed by scan by student ID returns duplicate', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode
      )!;

      const scanBarcode = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode!,
        verificationMethod: 'barcode',
      });
      expect(scanBarcode.isNewRecord).toBe(true);
      expect(scanBarcode.duplicate).toBe(false);

      const scanUUID = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
        verificationMethod: 'qr',
      });
      expect(scanUUID.isNewRecord).toBe(false);
      expect(scanUUID.duplicate).toBe(true);
      expect(scanUUID.attendance?.id).toBe(scanBarcode.attendance?.id);
    });

    it('concurrent bursts: 25 simultaneous scans produce exactly 1 new record and 24 duplicates', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT' && u.tenantId === session.tenantId)!;

      const promises = Array.from({ length: 25 }, () =>
        dal.recordAttendance({
          tenantId: session.tenantId,
          sessionId: session.id,
          studentIdOrCode: student.id,
        })
      );

      const results = await Promise.all(promises);

      const newRecords = results.filter((r) => r.isNewRecord);
      const duplicates = results.filter((r) => r.duplicate);

      expect(newRecords.length).toBe(1);
      expect(duplicates.length).toBe(24);

      const sessionAttendance = await dal.getSessionAttendance(session.id);
      const studentRecords = sessionAttendance.filter((a) => a.studentId === student.id);
      expect(studentRecords.length).toBe(1);
    });

    it('records same student in two DIFFERENT sessions as two separate valid attendance records', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;
      const availableSessions = dal.sessions.filter((s) => s.tenantId === student.tenantId);
      expect(availableSessions.length).toBeGreaterThanOrEqual(2);

      const sessionA = availableSessions[0];
      const sessionB = availableSessions[1];

      const resA = await dal.recordAttendance({
        tenantId: sessionA.tenantId,
        sessionId: sessionA.id,
        studentIdOrCode: student.id,
      });
      expect(resA.isNewRecord).toBe(true);
      expect(resA.duplicate).toBe(false);

      const resB = await dal.recordAttendance({
        tenantId: sessionB.tenantId,
        sessionId: sessionB.id,
        studentIdOrCode: student.id,
      });
      expect(resB.isNewRecord).toBe(true);
      expect(resB.duplicate).toBe(false);

      expect(resA.attendance?.id).not.toBe(resB.attendance?.id);
    });

    it('returns balance alert badge data along with scan result', async () => {
      const session = dal.sessions[0];
      const studentWithBalance = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.balanceDue > 0
      )!;

      const scanRes = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: studentWithBalance.id,
      });

      expect(scanRes.balanceAlert).toBeDefined();
      expect(scanRes.balanceAlert?.hasBalance).toBe(true);
      expect(scanRes.balanceAlert?.balanceDue).toBe(studentWithBalance.balanceDue);
      expect(scanRes.balanceAlert?.messageAr).toContain(String(studentWithBalance.balanceDue));
    });
  });

  // =========================================================================
  // 3. lib/supabase/schema.sql Triggers, Ordering, and Constraints
  // =========================================================================
  describe('3. Supabase Schema Structure & Constraints Verification', () => {
    let schemaSql: string;

    beforeEach(() => {
      const schemaPath = path.resolve(process.cwd(), 'lib/supabase/schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    });

    it('verifies topological ordering: table cashier_shifts is created BEFORE table payments', () => {
      const cashierShiftIdx = schemaSql.indexOf('CREATE TABLE cashier_shifts');
      const paymentsIdx = schemaSql.indexOf('CREATE TABLE payments');

      expect(cashierShiftIdx).toBeGreaterThan(0);
      expect(paymentsIdx).toBeGreaterThan(0);
      expect(cashierShiftIdx).toBeLessThan(paymentsIdx);
    });

    it('verifies payments table declares foreign key reference to cashier_shifts', () => {
      const paymentsBlockMatch = schemaSql.match(/CREATE\s+TABLE\s+payments\s*\([\s\S]*?\);/i);
      expect(paymentsBlockMatch).not.toBeNull();
      const paymentsDdl = paymentsBlockMatch![0];

      expect(paymentsDdl).toMatch(
        /cashier_shift_id\s+UUID\s+REFERENCES\s+cashier_shifts\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i
      );
    });

    it('verifies attendance table contains composite unique constraint (session_id, student_id)', () => {
      const attendanceBlockMatch = schemaSql.match(/CREATE\s+TABLE\s+attendance\s*\([\s\S]*?\);/i);
      expect(attendanceBlockMatch).not.toBeNull();
      const attendanceDdl = attendanceBlockMatch![0];

      expect(attendanceDdl).toMatch(
        /CONSTRAINT\s+unique_session_student_attendance\s+UNIQUE\s*\(\s*session_id\s*,\s*student_id\s*\)/i
      );
    });

    it('verifies enforce_self_profile_update_guardrail guards all 15 protected columns with SQLSTATE 42501', () => {
      // Trigger function exists
      expect(schemaSql).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+enforce_self_profile_update_guardrail\s*\(\s*\)/i
      );

      // Trigger attached to users table BEFORE UPDATE FOR EACH ROW
      expect(schemaSql).toMatch(
        /CREATE\s+TRIGGER\s+trg_enforce_user_guardrail\s+BEFORE\s+UPDATE\s+ON\s+users\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+enforce_self_profile_update_guardrail\s*\(\s*\);/i
      );

      // Procedure filters by STUDENT and TEACHER
      expect(schemaSql).toMatch(/OLD\.role\s+IN\s*\(\s*'STUDENT'\s*,\s*'TEACHER'\s*\)/i);

      // Check all 15 columns
      const all15Columns = [
        'full_name',
        'student_code',
        'stage',
        'grade',
        'division',
        'seat_number',
        'balance_due',
        'role',
        'tenant_id',
        'is_active',
        'phone',
        'guardian_phone',
        'guardian_name',
        'email',
        'national_id',
      ];

      for (const col of all15Columns) {
        const regex = new RegExp(`NEW\\.${col}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${col}`, 'i');
        expect(schemaSql).toMatch(regex);
      }

      // avatar_url must NOT be blocked (allows photo updates)
      const avatarRegex = /NEW\.avatar_url\s+IS\s+DISTINCT\s+FROM\s+OLD\.avatar_url/i;
      expect(schemaSql).not.toMatch(avatarRegex);

      // Raises SQLSTATE 42501
      expect(schemaSql).toMatch(/USING\s+ERRCODE\s*=\s*'42501'/i);
    });

    it('verifies RLS policies: users_self_profile_update_policy and tenant isolation', () => {
      // RLS on users
      expect(schemaSql).toMatch(/ALTER\s+TABLE\s+users\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);

      // Self profile update policy allows students and teachers
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+users_self_profile_update_policy\s+ON\s+users/i);
      expect(schemaSql).toMatch(/id\s*=\s*auth\.uid\(\)/i);
      expect(schemaSql).toMatch(/current_user_role\(\)\s+IN\s*\(\s*'STUDENT'\s*,\s*'TEACHER'\s*\)/i);

      // Teacher rates mutation policy restricts mutation to admin roles
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+teacher_rates_mutation_policy\s+ON\s+teacher_rates/i);
    });
  });
});
