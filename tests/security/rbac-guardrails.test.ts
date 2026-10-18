import { describe, it, expect } from 'vitest';
import {
  handleTenantDataQuery,
  handleUpdateStudentProfile,
  handleUpdateTeacherRates,
  handleAccessTeacherStatement,
  UserContext,
} from '../fixtures/contract-bridge';

describe('Tier 2: RBAC Security Guardrails & Multi-Tenant Isolation (AC-3, AC-4, AC-5, AC-6)', () => {
  // Test User Contexts
  const centerA_Admin: UserContext = {
    id: 'user-admin-a',
    role: 'CENTER_ADMIN',
    centerId: 'center-a-slug',
  };

  const centerB_Admin: UserContext = {
    id: 'user-admin-b',
    role: 'CENTER_ADMIN',
    centerId: 'center-b-slug',
  };

  const platformOwner: UserContext = {
    id: 'user-owner-1',
    role: 'PLATFORM_OWNER',
    centerId: 'global',
  };

  const studentAlice_CenterA: UserContext = {
    id: 'student-alice-id',
    role: 'STUDENT',
    centerId: 'center-a-slug',
  };

  const studentBob_CenterA: UserContext = {
    id: 'student-bob-id',
    role: 'STUDENT',
    centerId: 'center-a-slug',
  };

  const teacherZaid_CenterA: UserContext = {
    id: 'teacher-zaid-id',
    role: 'TEACHER',
    centerId: 'center-a-slug',
  };

  const teacherAmr_CenterA: UserContext = {
    id: 'teacher-amr-id',
    role: 'TEACHER',
    centerId: 'center-a-slug',
  };

  // -------------------------------------------------------------------------
  // AC-3: Multi-Tenant Center Isolation
  // -------------------------------------------------------------------------
  describe('AC-3: Multi-Tenant Tenant Isolation (Center A vs Center B)', () => {
    it('allows Center A administrator to query Center A data', () => {
      const response = handleTenantDataQuery(centerA_Admin, 'center-a-slug');
      expect(response.status).toBe(200);
      expect(response.data?.access).toBe('GRANTED_LOCAL');
      expect(response.data?.tenantId).toBe('center-a-slug');
    });

    it('strictly rejects Center A administrator or user from querying Center B data with HTTP 403 Forbidden', () => {
      const response = handleTenantDataQuery(centerA_Admin, 'center-b-slug');
      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
      expect(response.message).toMatch(/cross-tenant.*rejected/i);
    });

    it('strictly rejects Center B user from accessing Center A data', () => {
      const response = handleTenantDataQuery(centerB_Admin, 'center-a-slug');
      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
    });

    it('allows Platform Owner global cross-tenant visibility', () => {
      const responseA = handleTenantDataQuery(platformOwner, 'center-a-slug');
      expect(responseA.status).toBe(200);
      expect(responseA.data?.access).toBe('GRANTED_GLOBAL');

      const responseB = handleTenantDataQuery(platformOwner, 'center-b-slug');
      expect(responseB.status).toBe(200);
      expect(responseB.data?.access).toBe('GRANTED_GLOBAL');
    });
  });

  // -------------------------------------------------------------------------
  // AC-4 & AC-5: Student RBAC Guardrails
  // -------------------------------------------------------------------------
  describe('AC-4 & AC-5: Student Profile Photo and Administrative Lockdown Guardrails', () => {
    it('AC-4: allows student to successfully update their own profile avatar URL (HTTP 200 OK)', () => {
      const response = handleUpdateStudentProfile(
        studentAlice_CenterA,
        studentAlice_CenterA.id,
        { avatar_url: 'https://storage.yallacenter.com/avatars/alice-new.png' }
      );

      expect(response.status).toBe(200);
      expect(response.data?.avatar_url).toBe(
        'https://storage.yallacenter.com/avatars/alice-new.png'
      );
    });

    it('AC-5: rejects student attempting to update their student code with HTTP 403 Forbidden', () => {
      const response = handleUpdateStudentProfile(
        studentAlice_CenterA,
        studentAlice_CenterA.id,
        { student_code: 'HAX-9999' }
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
      expect(response.message).toMatch(/administrative.*financial/i);
    });

    it('AC-5: rejects student attempting to update their financial balance with HTTP 403 Forbidden', () => {
      const response = handleUpdateStudentProfile(
        studentAlice_CenterA,
        studentAlice_CenterA.id,
        { financial_balance: 0.0 }
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
    });

    it('AC-5: rejects student attempting to update grade, stage, or academic name with HTTP 403 Forbidden', () => {
      const fields = [
        { name: 'Dr. Alice Hacked' },
        { grade: 'الصف الثالث الثانوي' },
        { stage: 'المرحلة الثانوية' },
        { test_scores: [100, 100] },
      ];

      for (const fieldPayload of fields) {
        const response = handleUpdateStudentProfile(
          studentAlice_CenterA,
          studentAlice_CenterA.id,
          fieldPayload
        );
        expect(response.status).toBe(403);
        expect(response.error).toBe('FORBIDDEN');
      }
    });

    it('AC-5: rejects mass assignment exploit mixing allowed avatar_url with forbidden financial balance', () => {
      const exploitPayload = {
        avatar_url: 'https://storage.yallacenter.com/avatars/alice.png',
        financial_balance: 0.0,
      };

      const response = handleUpdateStudentProfile(
        studentAlice_CenterA,
        studentAlice_CenterA.id,
        exploitPayload
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
    });

    it('rejects student attempting to update another student avatar or profile', () => {
      const response = handleUpdateStudentProfile(
        studentAlice_CenterA,
        studentBob_CenterA.id, // target is Bob, actor is Alice
        { avatar_url: 'https://storage.yallacenter.com/avatars/fake.png' }
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
    });

    it('allows Center Administrator to update administrative fields for students', () => {
      const response = handleUpdateStudentProfile(
        centerA_Admin,
        studentAlice_CenterA.id,
        { grade: 'الصف الأول الثانوي', student_code: 'STD-101' }
      );

      expect(response.status).toBe(200);
      expect(response.data?.student_code).toBe('STD-101');
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Teacher Rate Lockout & Peer Privacy Guardrails
  // -------------------------------------------------------------------------
  describe('AC-6: Teacher Contractual Rates and Peer Financial Privacy Guardrails', () => {
    it('rejects teacher attempting to alter contractual fixed salary rate with HTTP 403 Forbidden', () => {
      const response = handleUpdateTeacherRates(
        teacherZaid_CenterA,
        teacherZaid_CenterA.id,
        { contractualFixedRate: 150.0 }
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
      expect(response.message).toMatch(/cannot alter contractual salary rates/i);
    });

    it('rejects teacher attempting to alter revenue-sharing percentage with HTTP 403 Forbidden', () => {
      const response = handleUpdateTeacherRates(
        teacherZaid_CenterA,
        teacherZaid_CenterA.id,
        { splitPercentage: 90.0 }
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
    });

    it('allows Center Administrator to update teacher contractual rates', () => {
      const response = handleUpdateTeacherRates(
        centerA_Admin,
        teacherZaid_CenterA.id,
        { contractualFixedRate: 40.0, splitPercentage: 75.0 }
      );

      expect(response.status).toBe(200);
      expect(response.data?.contractualFixedRate).toBe(40.0);
      expect(response.data?.splitPercentage).toBe(75.0);
    });

    it('rejects teacher attempting to inspect peer teacher payroll statement with HTTP 403 Forbidden', () => {
      // Teacher Zaid attempting to view Teacher Amr's ledger
      const response = handleAccessTeacherStatement(
        teacherZaid_CenterA,
        teacherAmr_CenterA.id
      );

      expect(response.status).toBe(403);
      expect(response.error).toBe('FORBIDDEN');
      expect(response.message).toMatch(/cannot access another teacher/i);
    });

    it('allows teacher to view their own financial statement (HTTP 200 OK)', () => {
      const response = handleAccessTeacherStatement(
        teacherZaid_CenterA,
        teacherZaid_CenterA.id
      );

      expect(response.status).toBe(200);
      expect(response.data?.statement).toBe('CONFIDENTIAL_PAYROLL_DATA');
    });

    it('allows Center Administrator to view teacher financial statements for auditing', () => {
      const response = handleAccessTeacherStatement(
        centerA_Admin,
        teacherZaid_CenterA.id
      );

      expect(response.status).toBe(200);
    });
  });
});
