import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MockDataProvider } from '@/lib/dal/mock-data';
import {
  handleUpdateStudentProfile,
  handleTenantDataQuery,
  handleUpdateTeacherRates,
  handleAccessTeacherStatement,
  UserContext,
} from '../fixtures/contract-bridge';

describe('Empirical Challenger M1-2: Database Schema, Security Guardrails & Attendance Idempotency', () => {
  // =========================================================================
  // 1. Database Schema Inspection (lib/supabase/schema.sql)
  // =========================================================================
  describe('1. Database Schema Verification (lib/supabase/schema.sql)', () => {
    let schemaSql: string;

    beforeEach(() => {
      const schemaPath = path.resolve(process.cwd(), 'lib/supabase/schema.sql');
      expect(fs.existsSync(schemaPath), 'schema.sql must exist').toBe(true);
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    });

    it('verifies attendance table contains CONSTRAINT unique_session_student_attendance UNIQUE (session_id, student_id)', () => {
      // Must contain exact unique constraint on (session_id, student_id)
      const uniqueConstraintRegex =
        /CONSTRAINT\s+unique_session_student_attendance\s+UNIQUE\s*\(\s*session_id\s*,\s*student_id\s*\)/i;
      expect(schemaSql).toMatch(uniqueConstraintRegex);

      // Verify it is defined inside CREATE TABLE attendance block
      const attendanceTableMatch = schemaSql.match(
        /CREATE\s+TABLE\s+attendance\s*\([\s\S]*?\);/i
      );
      expect(attendanceTableMatch).not.toBeNull();
      expect(attendanceTableMatch![0]).toMatch(uniqueConstraintRegex);
    });

    it('verifies trg_enforce_user_guardrail trigger and procedure logic', () => {
      // Verify trigger procedure exists
      expect(schemaSql).toMatch(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+enforce_self_profile_update_guardrail\s*\(\s*\)/i
      );

      // Verify trigger attaches to users table BEFORE UPDATE FOR EACH ROW
      const triggerRegex =
        /CREATE\s+TRIGGER\s+trg_enforce_user_guardrail\s+BEFORE\s+UPDATE\s+ON\s+users\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+enforce_self_profile_update_guardrail\s*\(\s*\);/i;
      expect(schemaSql).toMatch(triggerRegex);

      // Verify procedure guards STUDENT and TEACHER
      expect(schemaSql).toMatch(/OLD\.role\s+IN\s*\(\s*'STUDENT'\s*,\s*'TEACHER'\s*\)/i);

      // Verify protected columns in procedure
      const protectedCols = [
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
      ];

      for (const col of protectedCols) {
        const colRegex = new RegExp(`NEW\\.${col}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${col}`, 'i');
        expect(schemaSql).toMatch(colRegex);
      }

      // Verify 42501 (Forbidden) SQLSTATE is raised
      expect(schemaSql).toMatch(/USING\s+ERRCODE\s*=\s*'42501'/i);
    });

    it('verifies Row Level Security (RLS) policies for tenant isolation across core tables', () => {
      // Verify RLS is enabled on key tables
      const rlsTables = [
        'tenants',
        'branches',
        'classrooms',
        'users',
        'subjects',
        'groups',
        'sessions',
        'enrollments',
        'attendance',
        'invoices',
        'payments',
        'teacher_rates',
        'teacher_payroll',
      ];

      for (const table of rlsTables) {
        const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i');
        expect(schemaSql).toMatch(rlsRegex);
      }

      // Verify helper functions current_tenant_id() and current_user_role()
      expect(schemaSql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+current_tenant_id\s*\(\s*\)/i);
      expect(schemaSql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+current_user_role\s*\(\s*\)/i);

      // Verify tenant isolation policy exists
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+tenant_isolation_policy\s+ON\s+tenants/i);
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+branches_tenant_policy\s+ON\s+branches/i);
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+classrooms_tenant_policy\s+ON\s+classrooms/i);
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+users_select_policy\s+ON\s+users/i);
      expect(schemaSql).toMatch(/CREATE\s+POLICY\s+attendance_tenant_admin_policy\s+ON\s+attendance/i);
    });
  });

  // =========================================================================
  // 2. Attendance Idempotency Verification (lib/dal/mock-data.ts)
  // =========================================================================
  describe('2. Attendance Idempotency Empirical Tests (lib/dal/mock-data.ts)', () => {
    let dal: MockDataProvider;

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    it('first scan returns isNewRecord: true, duplicate: false and stores exactly 1 record', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const result1 = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode || student.id,
      });

      expect(result1.success).toBe(true);
      expect(result1.isNewRecord).toBe(true);
      expect(result1.duplicate).toBe(false);
      expect(result1.attendance).toBeDefined();
      expect(result1.attendance?.studentId).toBe(student.id);
      expect(result1.attendance?.sessionId).toBe(session.id);

      const records = await dal.getSessionAttendance(session.id);
      expect(records.length).toBe(1);
    });

    it('second scan returns isNewRecord: false, duplicate: true and does not duplicate state in memory', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      // First call
      const firstResult = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode || student.id,
      });
      expect(firstResult.isNewRecord).toBe(true);
      expect(firstResult.duplicate).toBe(false);

      const countAfterFirst = (await dal.getSessionAttendance(session.id)).length;
      expect(countAfterFirst).toBe(1);

      // Second call (identical student and session)
      const secondResult = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode || student.id,
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.isNewRecord).toBe(false);
      expect(secondResult.duplicate).toBe(true);
      expect(secondResult.attendance?.id).toBe(firstResult.attendance?.id);
      expect(secondResult.messageAr).toContain('مسبقاً');

      // CRITICAL: Ensure state was NOT duplicated
      const recordsAfterSecond = await dal.getSessionAttendance(session.id);
      expect(recordsAfterSecond.length).toBe(1);
      const studentRecords = recordsAfterSecond.filter((r) => r.studentId === student.id);
      expect(studentRecords.length).toBe(1);
    });

    it('rapid burst scans (10 sequential scans) yield exactly 1 attendance record and 9 duplicates', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const scanPromises = [];
      for (let i = 0; i < 10; i++) {
        // Sequentially execute to avoid in-memory race conditions in pure synchronous JS mock
        const res = await dal.recordAttendance({
          tenantId: session.tenantId,
          sessionId: session.id,
          studentIdOrCode: student.id,
        });
        scanPromises.push(res);
      }

      const newRecords = scanPromises.filter((s) => s.isNewRecord);
      const duplicates = scanPromises.filter((s) => s.duplicate);

      expect(newRecords.length).toBe(1);
      expect(duplicates.length).toBe(9);

      const allAttendance = await dal.getSessionAttendance(session.id);
      expect(allAttendance.length).toBe(1);
    });

    it('resolves duplicate when first scan is by studentCode and second scan is by student ID', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT' && u.studentCode)!;

      // Scan 1: using studentCode
      const scan1 = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode!,
      });
      expect(scan1.isNewRecord).toBe(true);
      expect(scan1.duplicate).toBe(false);

      // Scan 2: using student ID (uuid)
      const scan2 = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.id,
      });
      expect(scan2.isNewRecord).toBe(false);
      expect(scan2.duplicate).toBe(true);
      expect(scan2.attendance?.id).toBe(scan1.attendance?.id);

      // Total session attendance remains 1
      const attendance = await dal.getSessionAttendance(session.id);
      expect(attendance.length).toBe(1);
    });

    it('handles concurrent Promise.all scans without duplicating attendance state', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      // 5 concurrent scans started simultaneously
      const results = await Promise.all([
        dal.recordAttendance({ tenantId: session.tenantId, sessionId: session.id, studentIdOrCode: student.id }),
        dal.recordAttendance({ tenantId: session.tenantId, sessionId: session.id, studentIdOrCode: student.id }),
        dal.recordAttendance({ tenantId: session.tenantId, sessionId: session.id, studentIdOrCode: student.id }),
        dal.recordAttendance({ tenantId: session.tenantId, sessionId: session.id, studentIdOrCode: student.id }),
        dal.recordAttendance({ tenantId: session.tenantId, sessionId: session.id, studentIdOrCode: student.id }),
      ]);

      const newRecords = results.filter((r) => r.isNewRecord);
      const duplicates = results.filter((r) => r.duplicate);

      expect(newRecords.length).toBe(1);
      expect(duplicates.length).toBe(4);

      const allAttendance = await dal.getSessionAttendance(session.id);
      expect(allAttendance.length).toBe(1);
    });

    it('records multiple different students into the same session without false duplicate collisions', async () => {
      const session = dal.sessions[0];
      const students = dal.users.filter((u) => u.role === 'STUDENT' && u.tenantId === session.tenantId);
      expect(students.length).toBeGreaterThanOrEqual(2);

      const results = [];
      for (const st of students) {
        const res = await dal.recordAttendance({
          tenantId: session.tenantId,
          sessionId: session.id,
          studentIdOrCode: st.id,
        });
        results.push(res);
      }

      for (const res of results) {
        expect(res.isNewRecord).toBe(true);
        expect(res.duplicate).toBe(false);
      }

      const allAttendance = await dal.getSessionAttendance(session.id);
      expect(allAttendance.length).toBe(students.length);
    });

    it('enforces tenant scoping: scanning student from Center A in Center B session throws error', async () => {
      const session = dal.sessions[0]; // Center A (al-maher)
      const foreignStudent = {
        id: 'user-foreign-student',
        tenantId: 'tenant-rowad-002', // Center B
        role: 'STUDENT' as const,
        fullName: 'طالب سنتر آخر',
        balanceDue: 0,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      dal.users.push(foreignStudent);

      await expect(
        dal.recordAttendance({
          tenantId: session.tenantId,
          sessionId: session.id,
          studentIdOrCode: foreignStudent.id,
        })
      ).rejects.toThrow(/لم يتم العثور على طالب مطابق/);
    });
  });

  // =========================================================================
  // 3. Profile Update Security Guardrails Verification (lib/dal/mock-data.ts)
  // =========================================================================
  describe('3. Profile Update Security Guardrails (lib/dal/mock-data.ts)', () => {
    let dal: MockDataProvider;

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    it('rejects student attempting to change studentCode with status 403 Forbidden', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const res = await dal.updateUser(
        student.id,
        { studentCode: 'HAX-9999' },
        student.id,
        'STUDENT'
      );

      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/Forbidden.*403/i);

      // Verify student code was NOT modified in state
      const freshUser = await dal.getUserById(student.id);
      expect(freshUser?.studentCode).not.toBe('HAX-9999');
    });

    it('rejects student attempting to change fullName with status 403 Forbidden', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const res = await dal.updateUser(
        student.id,
        { fullName: 'اسم مخترق' },
        student.id,
        'STUDENT'
      );

      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/Forbidden.*403/i);

      const freshUser = await dal.getUserById(student.id);
      expect(freshUser?.fullName).not.toBe('اسم مخترق');
    });

    it('rejects student attempting to change grade with status 403 Forbidden', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const res = await dal.updateUser(
        student.id,
        { grade: 'university' },
        student.id,
        'STUDENT'
      );

      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/Forbidden.*403/i);

      const freshUser = await dal.getUserById(student.id);
      expect(freshUser?.grade).not.toBe('university');
    });

    it('rejects student attempting to change balanceDue or role with status 403 Forbidden', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      // Student tries to alter balance from current value
      const newBalance = student.balanceDue + 500;
      const resBalance = await dal.updateUser(
        student.id,
        { balanceDue: newBalance },
        student.id,
        'STUDENT'
      );
      expect(resBalance.status).toBe(403);
      expect(resBalance.success).toBe(false);

      // Student with debt (STD-1002 has 150 EGP) tries to clear it to 0
      const studentInDebt = dal.users.find((u) => u.role === 'STUDENT' && u.balanceDue > 0)!;
      const resClearDebt = await dal.updateUser(
        studentInDebt.id,
        { balanceDue: 0 },
        studentInDebt.id,
        'STUDENT'
      );
      expect(resClearDebt.status).toBe(403);
      expect(resClearDebt.success).toBe(false);

      // Student tries to escalate role to PLATFORM_OWNER
      const resRole = await dal.updateUser(
        student.id,
        { role: 'PLATFORM_OWNER' },
        student.id,
        'STUDENT'
      );
      expect(resRole.status).toBe(403);
      expect(resRole.success).toBe(false);
    });

    it('rejects student attempting to update another student profile photo or data', async () => {
      const students = dal.users.filter((u) => u.role === 'STUDENT');
      const student1 = students[0];
      const student2 = students[1];

      // Student 1 tries to update student 2 via updateUser
      const resUser = await dal.updateUser(
        student2.id,
        { avatarUrl: 'https://evil.com/fake.png' },
        student1.id, // actor is student1
        'STUDENT'
      );
      expect(resUser.status).toBe(403);

      // Student 1 tries to update student 2 via updateUserProfilePhoto
      const resPhoto = await dal.updateUserProfilePhoto(
        student2.id,
        'https://evil.com/fake.png',
        student1.id,
        'STUDENT'
      );
      expect(resPhoto.success).toBe(false);
      expect(resPhoto.error).toMatch(/Forbidden/i);
    });

    it('allows student to update their own avatarUrl successfully (HTTP 200 OK)', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;
      const newAvatarUrl = 'https://images.unsplash.com/photo-new-avatar-1234';

      // Test via updateUserProfilePhoto
      const resPhoto = await dal.updateUserProfilePhoto(
        student.id,
        newAvatarUrl,
        student.id,
        'STUDENT'
      );
      expect(resPhoto.success).toBe(true);
      expect(resPhoto.data?.avatarUrl).toBe(newAvatarUrl);

      // Verify persistent in DAL state
      const freshUser = await dal.getUserById(student.id);
      expect(freshUser?.avatarUrl).toBe(newAvatarUrl);

      // Test via updateUser (avatarUrl only)
      const secondAvatarUrl = 'https://images.unsplash.com/photo-another-avatar-5678';
      const resUser = await dal.updateUser(
        student.id,
        { avatarUrl: secondAvatarUrl },
        student.id,
        'STUDENT'
      );
      expect(resUser.success).toBe(true);
      expect(resUser.status).toBe(200);
      expect(resUser.data?.avatarUrl).toBe(secondAvatarUrl);
    });

    it('allows Center Administrator to update administrative fields for students', async () => {
      const admin = dal.users.find((u) => u.role === 'CENTER_ADMIN')!;
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const res = await dal.updateUser(
        student.id,
        { fullName: 'اسم تم تعديله بواسطة المدير', grade: '2_sec', balanceDue: 500 },
        admin.id,
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data?.fullName).toBe('اسم تم تعديله بواسطة المدير');
      expect(res.data?.grade).toBe('2_sec');
      expect(res.data?.balanceDue).toBe(500);
    });
  });

  // =========================================================================
  // 4. Contract Bridge Security & Tenant Isolation Cross-Check
  // =========================================================================
  describe('4. Contract Bridge Security & Isolation Cross-Check', () => {
    const studentUser: UserContext = {
      id: 'student-ch-01',
      role: 'STUDENT',
      centerId: 'al-maher',
    };

    it('rejects student attempting to update student_code, full_name, or grade via handleUpdateStudentProfile', () => {
      const fields = [
        { student_code: 'STD-CHALLENGE' },
        { name: 'Dr. Challenger' },
        { grade: '3_sec' },
      ];

      for (const payload of fields) {
        const res = handleUpdateStudentProfile(studentUser, studentUser.id, payload);
        expect(res.status).toBe(403);
        expect(res.error).toBe('FORBIDDEN');
      }
    });

    it('allows student to update avatar_url via handleUpdateStudentProfile', () => {
      const res = handleUpdateStudentProfile(studentUser, studentUser.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatar.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.data?.avatar_url).toBe('https://cdn.yallacenter.com/avatar.jpg');
    });

    it('verifies Center A administrator cannot access Center B data', () => {
      const centerAAdmin: UserContext = {
        id: 'admin-a',
        role: 'CENTER_ADMIN',
        centerId: 'center-a',
      };

      const res = handleTenantDataQuery(centerAAdmin, 'center-b');
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });
  });
});
