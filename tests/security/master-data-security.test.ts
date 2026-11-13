import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Master Data Collections Cloud Firestore Security Rules Invariants', () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

  it('declares master_stages match block with expected RBAC, tenant isolation, and field types', () => {
    expect(rules).toContain('match /master_stages/{stageDocId}');
    expect(rules).toMatch(
      /match \/master_stages\/\{stageDocId\}\s*\{\s*allow read:\s*if isActiveStaff\(\) && matchesTenant\(resource\.data\.tenantId\);/
    );
    expect(rules).toMatch(
      /allow create:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(request\.resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId is string &&\s*request\.resource\.data\.nameAr is string;/
    );
    expect(rules).toMatch(
      /allow update:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId == resource\.data\.tenantId;/
    );
    expect(rules).toMatch(
      /allow delete:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\);/
    );
  });

  it('declares master_subjects match block with expected RBAC, tenant isolation, and grade validation', () => {
    expect(rules).toContain('match /master_subjects/{subjectDocId}');
    expect(rules).toMatch(
      /match \/master_subjects\/\{subjectDocId\}\s*\{\s*allow read:\s*if isActiveStaff\(\) && matchesTenant\(resource\.data\.tenantId\);/
    );
    expect(rules).toMatch(
      /allow create:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(request\.resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId is string &&\s*request\.resource\.data\.nameAr is string &&\s*request\.resource\.data\.grade is string;/
    );
    expect(rules).toMatch(
      /allow update:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId == resource\.data\.tenantId;/
    );
    expect(rules).toMatch(
      /allow delete:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\);/
    );
  });

  it('declares master_branches match block with expected RBAC, tenant isolation, and name validation', () => {
    expect(rules).toContain('match /master_branches/{branchDocId}');
    expect(rules).toMatch(
      /match \/master_branches\/\{branchDocId\}\s*\{\s*allow read:\s*if isActiveStaff\(\) && matchesTenant\(resource\.data\.tenantId\);/
    );
    expect(rules).toMatch(
      /allow create:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(request\.resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId is string &&\s*request\.resource\.data\.nameAr is string;/
    );
    expect(rules).toMatch(
      /allow update:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\) &&\s*request\.resource\.data\.tenantId == resource\.data\.tenantId;/
    );
    expect(rules).toMatch(
      /allow delete:\s*if isActiveStaff\(\) &&\s*\(staffRole\(\) == 'PLATFORM_OWNER' \|\| \(staffRole\(\) == 'CENTER_ADMIN' && matchesTenant\(resource\.data\.tenantId\)\)\);/
    );
  });

  it('preserves existing lesson_exams, lesson_grades, lesson_grade_audits, staff_memberships, and default deny', () => {
    expect(rules).toContain('match /staff_memberships/{uid}');
    expect(rules).toContain('match /lesson_exams/{examId}');
    expect(rules).toContain('match /lesson_grades/{gradeId}');
    expect(rules).toContain('match /lesson_grade_audits/{auditId}');
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false;');
  });

  // Emulation test harness for rule decision logic
  describe('Rule Evaluation Logic Emulation', () => {
    type StaffAuth = {
      uid: string;
      exists: boolean;
      isActive?: boolean;
      role?: string;
      tenantId?: string;
    } | null;

    function evalRead(auth: StaffAuth, resourceTenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      const staffRole = auth.role;
      const matchesTenant = staffRole === 'PLATFORM_OWNER' || auth.tenantId === resourceTenantId;
      return matchesTenant;
    }

    function evalCreate(
      auth: StaffAuth,
      collection: 'master_stages' | 'master_subjects' | 'master_branches',
      data: Record<string, unknown>
    ): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      const staffRole = auth.role;
      const reqTenant = data.tenantId;
      const matchesTenant = staffRole === 'PLATFORM_OWNER' || (typeof reqTenant === 'string' && auth.tenantId === reqTenant);
      const isRoleAllowed = staffRole === 'PLATFORM_OWNER' || (staffRole === 'CENTER_ADMIN' && matchesTenant);
      if (!isRoleAllowed) return false;

      if (typeof data.tenantId !== 'string' || typeof data.nameAr !== 'string') {
        return false;
      }
      if (collection === 'master_subjects' && typeof data.grade !== 'string') {
        return false;
      }
      return true;
    }

    function evalUpdate(
      auth: StaffAuth,
      oldData: Record<string, unknown>,
      newData: Record<string, unknown>
    ): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      const staffRole = auth.role;
      const oldTenant = oldData.tenantId;
      const matchesTenant = staffRole === 'PLATFORM_OWNER' || (typeof oldTenant === 'string' && auth.tenantId === oldTenant);
      const isRoleAllowed = staffRole === 'PLATFORM_OWNER' || (staffRole === 'CENTER_ADMIN' && matchesTenant);
      if (!isRoleAllowed) return false;

      return newData.tenantId === oldData.tenantId;
    }

    function evalDelete(auth: StaffAuth, resourceTenantId: string): boolean {
      if (!auth || !auth.exists || auth.isActive !== true) return false;
      const staffRole = auth.role;
      const matchesTenant = staffRole === 'PLATFORM_OWNER' || auth.tenantId === resourceTenantId;
      return staffRole === 'PLATFORM_OWNER' || (staffRole === 'CENTER_ADMIN' && matchesTenant);
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

    const teacherTenant1: StaffAuth = {
      uid: 'tch-1',
      exists: true,
      isActive: true,
      role: 'TEACHER',
      tenantId: 'tenant-1',
    };

    const inactiveAdmin: StaffAuth = {
      uid: 'inact-1',
      exists: true,
      isActive: false,
      role: 'CENTER_ADMIN',
      tenantId: 'tenant-1',
    };

    it('enforces read permissions strictly per tenant', () => {
      // Unauthenticated / inactive
      expect(evalRead(null, 'tenant-1')).toBe(false);
      expect(evalRead(inactiveAdmin, 'tenant-1')).toBe(false);

      // PLATFORM_OWNER reads any tenant
      expect(evalRead(platformOwner, 'tenant-1')).toBe(true);
      expect(evalRead(platformOwner, 'tenant-2')).toBe(true);

      // Same tenant staff can read
      expect(evalRead(adminTenant1, 'tenant-1')).toBe(true);
      expect(evalRead(teacherTenant1, 'tenant-1')).toBe(true);

      // Cross-tenant read denied
      expect(evalRead(adminTenant1, 'tenant-2')).toBe(false);
      expect(evalRead(teacherTenant1, 'tenant-2')).toBe(false);
    });

    it('enforces create validation and RBAC for master collections', () => {
      const validStage = { tenantId: 'tenant-1', nameAr: 'المرحلة الثانوية' };
      const validSubject = { tenantId: 'tenant-1', nameAr: 'الفيزياء', grade: 'gr-3' };
      const validBranch = { tenantId: 'tenant-1', nameAr: 'فرع مدينة نصر' };

      // PLATFORM_OWNER can create anywhere with valid fields
      expect(evalCreate(platformOwner, 'master_stages', validStage)).toBe(true);
      expect(evalCreate(platformOwner, 'master_subjects', validSubject)).toBe(true);
      expect(evalCreate(platformOwner, 'master_branches', validBranch)).toBe(true);

      // CENTER_ADMIN can create for their own tenant
      expect(evalCreate(adminTenant1, 'master_stages', validStage)).toBe(true);
      expect(evalCreate(adminTenant1, 'master_subjects', validSubject)).toBe(true);
      expect(evalCreate(adminTenant1, 'master_branches', validBranch)).toBe(true);

      // CENTER_ADMIN cannot create for another tenant
      expect(evalCreate(adminTenant1, 'master_stages', { ...validStage, tenantId: 'tenant-2' })).toBe(false);
      expect(evalCreate(adminTenant1, 'master_subjects', { ...validSubject, tenantId: 'tenant-2' })).toBe(false);
      expect(evalCreate(adminTenant1, 'master_branches', { ...validBranch, tenantId: 'tenant-2' })).toBe(false);

      // Non-admin staff cannot create
      expect(evalCreate(teacherTenant1, 'master_stages', validStage)).toBe(false);
      expect(evalCreate(teacherTenant1, 'master_subjects', validSubject)).toBe(false);
      expect(evalCreate(teacherTenant1, 'master_branches', validBranch)).toBe(false);

      // Missing required fields rejected
      expect(evalCreate(adminTenant1, 'master_stages', { tenantId: 'tenant-1' })).toBe(false);
      expect(evalCreate(adminTenant1, 'master_subjects', { tenantId: 'tenant-1', nameAr: 'كيمياء' })).toBe(false);
      expect(evalCreate(adminTenant1, 'master_branches', { nameAr: 'فرع المعادي' })).toBe(false);
    });

    it('enforces update immutability on tenantId and blocks unauthorized roles', () => {
      const oldDoc = { tenantId: 'tenant-1', nameAr: 'المرحلة الثانوية' };
      const validUpdate = { tenantId: 'tenant-1', nameAr: 'الثانوية المعدلة' };
      const tamperedTenant = { tenantId: 'tenant-2', nameAr: 'الثانوية المعدلة' };

      // Admin updating own tenant
      expect(evalUpdate(adminTenant1, oldDoc, validUpdate)).toBe(true);

      // Admin attempting to change tenantId
      expect(evalUpdate(adminTenant1, oldDoc, tamperedTenant)).toBe(false);

      // Admin attempting to update another tenant's doc
      expect(evalUpdate(adminTenant1, { tenantId: 'tenant-2', nameAr: 'أخرى' }, { tenantId: 'tenant-2', nameAr: 'تعديل' })).toBe(false);

      // Teacher cannot update
      expect(evalUpdate(teacherTenant1, oldDoc, validUpdate)).toBe(false);

      // PLATFORM_OWNER can update any tenant, but tenantId must still match
      expect(evalUpdate(platformOwner, oldDoc, validUpdate)).toBe(true);
      expect(evalUpdate(platformOwner, oldDoc, tamperedTenant)).toBe(false);
    });

    it('enforces delete permissions strictly per role and tenant', () => {
      expect(evalDelete(adminTenant1, 'tenant-1')).toBe(true);
      expect(evalDelete(adminTenant1, 'tenant-2')).toBe(false);
      expect(evalDelete(teacherTenant1, 'tenant-1')).toBe(false);
      expect(evalDelete(platformOwner, 'tenant-1')).toBe(true);
      expect(evalDelete(platformOwner, 'tenant-2')).toBe(true);
      expect(evalDelete(null, 'tenant-1')).toBe(false);
      expect(evalDelete(inactiveAdmin, 'tenant-1')).toBe(false);
    });
  });
});
