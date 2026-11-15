import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Multi-Tenant Core Collections Security Rules Invariants', () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

  it('declares rules_version = 2 and closed default guardrail', () => {
    expect(rules).toContain("rules_version = '2';");
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false;');
  });

  it('declares all mandatory collection blocks', () => {
    const requiredCollections = [
      'tenants',
      'staff_memberships',
      'master_stages',
      'master_subjects',
      'master_branches',
      'lesson_exams',
      'lesson_grades',
      'lesson_grade_audits',
      'center_groups',
      'center_classrooms',
      'teacher_profiles',
      'teacher_login_keys',
      'center_materials',
      'center_students',
      'center_enrollments',
      'center_sessions',
      'center_attendance',
      'center_invoices',
      'center_payments',
      'center_expenses',
      'center_shifts',
      'comprehensive_exams',
      'exam_submissions',
    ];

    for (const col of requiredCollections) {
      expect(rules).toContain(`match /${col}/`);
    }
  });

  it('declares tenants and staff_memberships rules with platform owner & center admin RBAC', () => {
    expect(rules).toMatch(/match \/tenants\/\{tenantId\}\s*\{/);
    expect(rules).toMatch(/allow read:\s*if true;/);
    expect(rules).toMatch(/allow create, delete:\s*if isPlatformOwner\(\);/);
    expect(rules).toContain('isCenterAdmin(tenantId)');
    expect(rules).toContain('request.resource.data.id == resource.data.id');

    expect(rules).toMatch(/match \/staff_memberships\/\{uid\}\s*\{/);
    expect(rules).toMatch(/allow read:\s*if isSignedIn\(\) && \(\s*request\.auth\.uid == uid \|\|\s*isPlatformOwner\(\) \|\|\s*\(isCenterAdmin\(resource\.data\.tenantId\)\)\s*\);/);
    expect(rules).toMatch(/allow create:\s*if isSignedIn\(\) && \(\s*isPlatformOwner\(\) \|\|\s*request\.auth\.uid == uid \|\|\s*isCenterAdmin\(request\.resource\.data\.tenantId\)\s*\);/);
    expect(rules).toMatch(/allow update:\s*if isPlatformOwner\(\) \|\| \(\s*isCenterAdmin\(resource\.data\.tenantId\) &&\s*request\.resource\.data\.tenantId == resource\.data\.tenantId\s*\);/);
    expect(rules).toMatch(/allow delete:\s*if isPlatformOwner\(\) \|\| isCenterAdmin\(resource\.data\.tenantId\);/);
  });

  it('enforces multi-tenant isolation and immutable tenantId on updates for all core collections', () => {
    expect(rules).toContain('function matchesTenant(tenantId)');
    expect(rules).toContain('function isStaffMember(tenantId)');
    expect(rules).toContain('function isCenterAdmin(tenantId)');
    expect(rules).toContain('function isStudentOpsStaff(tenantId)');
    expect(rules).toContain('function isFinanceStaff(tenantId)');
    expect(rules).toContain('function isSessionAllowedRole()');

    // center_groups
    expect(rules).toMatch(/match \/center_groups\/\{groupId\}\s*\{\s*allow read:\s*if isStaffMember\(resource\.data\.tenantId\);/);
    expect(rules).toContain('request.resource.data.tenantId == resource.data.tenantId');

    // center_classrooms
    expect(rules).toMatch(/match \/center_classrooms\/\{classroomId\}\s*\{\s*allow read:\s*if isStaffMember\(resource\.data\.tenantId\);/);

    // teacher_profiles & teacher_login_keys
    expect(rules).toMatch(/match \/teacher_profiles\/\{profileId\}/);
    expect(rules).toMatch(/match \/teacher_login_keys\/\{keyId\}/);

    // center_materials
    expect(rules).toMatch(/match \/center_materials\/\{materialId\}\s*\{\s*allow read:\s*if isStaffMember\(resource\.data\.tenantId\);/);

    // center_students
    expect(rules).toMatch(/match \/center_students\/\{studentId\}/);
    expect(rules).toContain('isStudentOpsStaff(request.resource.data.tenantId)');

    // center_enrollments
    expect(rules).toMatch(/match \/center_enrollments\/\{enrollmentId\}/);
    expect(rules).toContain('isStudentOpsStaff(request.resource.data.tenantId)');

    // center_sessions
    expect(rules).toMatch(/match \/center_sessions\/\{sessionId\}/);
    expect(rules).toContain('isSessionAllowedRole()');

    // center_attendance
    expect(rules).toMatch(/match \/center_attendance\/\{attendanceId\}/);

    // center_invoices & payments
    expect(rules).toMatch(/match \/center_invoices\/\{invoiceId\}/);
    expect(rules).toContain('isFinanceStaff(request.resource.data.tenantId)');
    expect(rules).toMatch(/match \/center_payments\/\{paymentId\}/);

    // center_expenses & shifts
    expect(rules).toMatch(/match \/center_expenses\/\{expenseId\}/);
    expect(rules).toContain('isFinanceStaff(request.resource.data.tenantId)');
    expect(rules).toMatch(/match \/center_shifts\/\{shiftId\}/);

    // comprehensive_exams & exam_submissions
    expect(rules).toMatch(/match \/comprehensive_exams\/\{examId\}/);
    expect(rules).toMatch(/match \/exam_submissions\/\{submissionId\}/);
  });

  describe('Emulated Role Evaluation across Core Collections', () => {
    type StaffAuth = {
      uid: string;
      exists: boolean;
      isActive?: boolean;
      role?: string;
      tenantId?: string;
    } | null;

    function isStaffMember(auth: StaffAuth, tenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      return auth.role === 'PLATFORM_OWNER' || auth.tenantId === tenantId;
    }

    function isCenterAdmin(auth: StaffAuth, tenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      return auth.role === 'PLATFORM_OWNER' || (auth.role === 'CENTER_ADMIN' && auth.tenantId === tenantId);
    }

    function isStudentOpsStaff(auth: StaffAuth, tenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      if (auth.role === 'PLATFORM_OWNER') return true;
      if (auth.tenantId !== tenantId) return false;
      return ['CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(auth.role ?? '');
    }

    function isFinanceStaff(auth: StaffAuth, tenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      if (auth.role === 'PLATFORM_OWNER') return true;
      if (auth.tenantId !== tenantId) return false;
      return ['CENTER_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'].includes(auth.role ?? '');
    }

    function isSessionAllowedRole(auth: StaffAuth, tenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      if (auth.role === 'PLATFORM_OWNER') return true;
      if (auth.tenantId !== tenantId) return false;
      return ['CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'TEACHER'].includes(auth.role ?? '');
    }

    const platformOwner: StaffAuth = {
      uid: 'po-1',
      exists: true,
      isActive: true,
      role: 'PLATFORM_OWNER',
      tenantId: 'tenant-owner',
    };

    const adminTenant1: StaffAuth = {
      uid: 'adm-1',
      exists: true,
      isActive: true,
      role: 'CENTER_ADMIN',
      tenantId: 'tenant-1',
    };

    const receptionistTenant1: StaffAuth = {
      uid: 'rec-1',
      exists: true,
      isActive: true,
      role: 'RECEPTIONIST',
      tenantId: 'tenant-1',
    };

    const accountantTenant1: StaffAuth = {
      uid: 'acc-1',
      exists: true,
      isActive: true,
      role: 'ACCOUNTANT',
      tenantId: 'tenant-1',
    };

    const teacherTenant1: StaffAuth = {
      uid: 'tch-1',
      exists: true,
      isActive: true,
      role: 'TEACHER',
      tenantId: 'tenant-1',
    };

    const adminTenant2: StaffAuth = {
      uid: 'adm-2',
      exists: true,
      isActive: true,
      role: 'CENTER_ADMIN',
      tenantId: 'tenant-2',
    };

    it('validates tenant boundaries: tenant 1 staff cannot access tenant 2 resources', () => {
      expect(isStaffMember(adminTenant1, 'tenant-2')).toBe(false);
      expect(isCenterAdmin(adminTenant1, 'tenant-2')).toBe(false);
      expect(isStudentOpsStaff(receptionistTenant1, 'tenant-2')).toBe(false);
      expect(isFinanceStaff(accountantTenant1, 'tenant-2')).toBe(false);
      expect(isSessionAllowedRole(teacherTenant1, 'tenant-2')).toBe(false);

      // PLATFORM_OWNER has global access across all tenants
      expect(isStaffMember(platformOwner, 'tenant-1')).toBe(true);
      expect(isStaffMember(platformOwner, 'tenant-2')).toBe(true);
      expect(isCenterAdmin(platformOwner, 'tenant-1')).toBe(true);
      expect(isCenterAdmin(platformOwner, 'tenant-2')).toBe(true);
    });

    it('enforces role differentiation on student ops and finance ops', () => {
      // Receptionist can do student ops and finance (invoices/shifts/payments)
      expect(isStudentOpsStaff(receptionistTenant1, 'tenant-1')).toBe(true);
      expect(isFinanceStaff(receptionistTenant1, 'tenant-1')).toBe(true);
      expect(isCenterAdmin(receptionistTenant1, 'tenant-1')).toBe(false);

      // Accountant cannot manage groups/classrooms or student enrollment modifications
      expect(isFinanceStaff(accountantTenant1, 'tenant-1')).toBe(true);
      expect(isStudentOpsStaff(accountantTenant1, 'tenant-1')).toBe(false);
      expect(isCenterAdmin(accountantTenant1, 'tenant-1')).toBe(false);

      // Teacher can manage sessions and attendance, but not finance or groups directly
      expect(isSessionAllowedRole(teacherTenant1, 'tenant-1')).toBe(true);
      expect(isFinanceStaff(teacherTenant1, 'tenant-1')).toBe(false);
      expect(isStudentOpsStaff(teacherTenant1, 'tenant-1')).toBe(false);
      expect(isCenterAdmin(teacherTenant1, 'tenant-1')).toBe(false);

      // Center Admin has full center permissions
      expect(isCenterAdmin(adminTenant1, 'tenant-1')).toBe(true);
      expect(isStudentOpsStaff(adminTenant1, 'tenant-1')).toBe(true);
      expect(isFinanceStaff(adminTenant1, 'tenant-1')).toBe(true);
      expect(isSessionAllowedRole(adminTenant1, 'tenant-1')).toBe(true);
    });
  });
});
