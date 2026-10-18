/**
 * Milestone 2 Test Suite: Profile Guardrails, Route Protection & 8-Role RBAC Matrix
 * Path: tests/security/m2-profile-guardrails.test.ts
 *
 * Validates AC-3, AC-4, AC-5, and AC-6:
 * - AC-3: Multi-tenant isolation (Center A users cannot access Center B)
 * - AC-4: Student and teacher profile photo update permissions
 * - AC-5: Administrative/financial field lockout (HTTP 403 Forbidden for students and teachers)
 * - AC-6: Teacher contractual salary rate and peer payroll statement lockout
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateProfilePhotoUpdate,
  checkTenantAccess,
  validateTeacherRateUpdate,
  validateTeacherStatementAccess,
  UserSecurityContext,
  ALLOWED_MUTATION_KEYS,
} from '@/lib/security/rbac';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Milestone 2 Security: Profile Guardrails & 8-Role RBAC Matrix', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  const studentAlice: UserSecurityContext = {
    id: 'user-student-1001',
    role: 'STUDENT',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const studentBob: UserSecurityContext = {
    id: 'user-student-1002',
    role: 'STUDENT',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const teacherZaid: UserSecurityContext = {
    id: 'user-teacher-math',
    role: 'TEACHER',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const teacherAmr: UserSecurityContext = {
    id: 'user-teacher-phys',
    role: 'TEACHER',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const centerAdmin: UserSecurityContext = {
    id: 'user-admin-maher',
    role: 'CENTER_ADMIN',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const branchManager: UserSecurityContext = {
    id: 'user-bm-nasr',
    role: 'BRANCH_MANAGER',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const platformOwner: UserSecurityContext = {
    id: 'user-owner-001',
    role: 'PLATFORM_OWNER',
    tenantSlug: 'global',
  };

  // =========================================================================
  // 1. Photo Update Endpoint & Whitelist Guardrail (AC-4, AC-5)
  // =========================================================================
  describe('1. Profile Photo Update Whitelist Enforcement (AC-4, AC-5)', () => {
    it('verifies ALLOWED_MUTATION_KEYS contains exactly expected keys', () => {
      expect(ALLOWED_MUTATION_KEYS).toContain('avatar_url');
      expect(ALLOWED_MUTATION_KEYS).toContain('avatarUrl');
      expect(ALLOWED_MUTATION_KEYS).toContain('userId');
      expect(ALLOWED_MUTATION_KEYS).toContain('targetUserId');
    });

    it('AC-4: allows student to update their own avatar URL with HTTP 200 OK', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://cdn.yallacenter.com/avatars/alice.jpg');
    });

    it('AC-4: allows teacher to update their own avatar URL with HTTP 200 OK', () => {
      const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/zaid.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://cdn.yallacenter.com/avatars/zaid.jpg');
    });

    it('AC-5: rejects student attempting to update another student avatar with HTTP 403 Forbidden', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentBob.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/hacked.jpg',
      });
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('AC-5: rejects student attempting to modify student code with HTTP 403 Forbidden', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
        studentCode: 'STD-9999',
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
      expect(res.message).toMatch(/avatar_url/i);
    });

    it('AC-5: rejects student attempting to modify balanceDue with HTTP 403 Forbidden', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
        balanceDue: 0.0,
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('AC-5: rejects student mass-assignment attempt with HTTP 403 Forbidden', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
        grade: '3_sec',
        fullName: 'أحمد المعدل',
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('AC-6: rejects teacher attempting to modify contractualFixedRate via photo payload with HTTP 403', () => {
      const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/zaid.jpg',
        contractualFixedRate: 500,
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('rejects empty or whitespace avatar URL with HTTP 400 Bad Request', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: '   ',
      });
      expect(res.status).toBe(400);
      expect(res.error).toBe('BAD_REQUEST');
    });

    it('allows Center Administrator to update avatar URL for any student', () => {
      const res = validateProfilePhotoUpdate(centerAdmin, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice-admin.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });

    it('allows Branch Manager to update avatar URL for a student', () => {
      const res = validateProfilePhotoUpdate(branchManager, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice-bm.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 2. Tenant Boundary & Cross-Tenant Isolation (AC-3)
  // =========================================================================
  describe('2. Multi-Tenant Cross-Center Isolation (AC-3)', () => {
    it('allows Center Admin to access own center slug', () => {
      const res = checkTenantAccess(centerAdmin, 'al-maher');
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.access).toBe('GRANTED_LOCAL');
    });

    it('strictly rejects Center A admin accessing Center B data with HTTP 403 Forbidden', () => {
      const res = checkTenantAccess(centerAdmin, 'al-rowad');
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
      expect(res.message).toMatch(/Cross-tenant/i);
    });

    it('strictly rejects Center A student accessing Center B data with HTTP 403 Forbidden', () => {
      const res = checkTenantAccess(studentAlice, 'al-rowad');
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows Platform Owner global cross-tenant visibility', () => {
      const resA = checkTenantAccess(platformOwner, 'al-maher');
      expect(resA.status).toBe(200);
      expect(resA.data?.access).toBe('GRANTED_GLOBAL');

      const resB = checkTenantAccess(platformOwner, 'al-rowad');
      expect(resB.status).toBe(200);
      expect(resB.data?.access).toBe('GRANTED_GLOBAL');
    });
  });

  // =========================================================================
  // 3. Teacher Rate Lock & Peer Privacy (AC-6)
  // =========================================================================
  describe('3. Teacher Rate Lockout & Peer Ledger Privacy (AC-6)', () => {
    it('rejects teacher attempting to alter own contractual salary rate with HTTP 403', () => {
      const res = validateTeacherRateUpdate(teacherZaid, teacherZaid.id, {
        contractualFixedRate: 100,
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows Center Admin to update teacher salary rate with HTTP 200', () => {
      const res = validateTeacherRateUpdate(centerAdmin, teacherZaid.id, {
        contractualFixedRate: 40,
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });

    it('rejects teacher attempting to inspect peer teacher payroll statement with HTTP 403', () => {
      const res = validateTeacherStatementAccess(teacherZaid, teacherAmr.id);
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows teacher to inspect their own payroll statement with HTTP 200', () => {
      const res = validateTeacherStatementAccess(teacherZaid, teacherZaid.id);
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Data Access Layer Integration with Whitelist Guardrail
  // =========================================================================
  describe('4. MockDataProvider Whitelist Guardrail Verification', () => {
    it('allows student to update only avatarUrl via dal.updateUser', async () => {
      const res = await dal.updateUser(
        studentAlice.id,
        { avatarUrl: 'https://images.unsplash.com/photo-new' },
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data?.avatarUrl).toBe('https://images.unsplash.com/photo-new');
    });

    it('rejects student attempting to modify balanceDue via dal.updateUser with status 403', async () => {
      const res = await dal.updateUser(
        studentAlice.id,
        { balanceDue: 0.0 },
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
    });

    it('rejects student attempting to modify another student profile via dal.updateUser with status 403', async () => {
      const res = await dal.updateUser(
        studentBob.id,
        { avatarUrl: 'https://images.unsplash.com/hacked' },
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
    });

    it('allows student to update photo via dal.updateUserProfilePhoto', async () => {
      const res = await dal.updateUserProfilePhoto(
        studentAlice.id,
        'https://images.unsplash.com/photo-photo',
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://images.unsplash.com/photo-photo');
    });

    it('rejects student updating another user photo via dal.updateUserProfilePhoto', async () => {
      const res = await dal.updateUserProfilePhoto(
        studentBob.id,
        'https://images.unsplash.com/photo-fail',
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(false);
    });
  });
});
