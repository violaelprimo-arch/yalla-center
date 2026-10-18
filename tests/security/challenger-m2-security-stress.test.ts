/**
 * Challenger M2-1: Empirical Security Guardrails Stress Test Suite
 * Path: tests/security/challenger-m2-security-stress.test.ts
 *
 * Adversarial and empirical verification of Milestone 2 security guardrails:
 * 1. Student & Teacher avatar photo update: ensure valid photo upload returns HTTP 200 OK.
 * 2. Student & Teacher administrative field lockout: ensure attempting to update
 *    fullName, studentCode, balanceDue, stage, grade, phone, role, or any non-avatar key
 *    returns HTTP 403 Forbidden.
 * 3. Cross-tenant access: ensure actor with Center A credentials visiting Center B receives HTTP 403 Forbidden.
 * 4. Teacher privacy: ensure teacher attempting to inspect peer statement or modify rates returns HTTP 403 Forbidden.
 * 5. Full Route Handler & Middleware integration execution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateProfilePhotoUpdate,
  checkTenantAccess,
  validateTeacherRateUpdate,
  validateTeacherStatementAccess,
  UserSecurityContext,
  ALLOWED_MUTATION_KEYS,
  RESTRICTED_ADMIN_FIELDS,
} from '@/lib/security/rbac';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { POST } from '@/app/api/profile/update-photo/route';
import { middleware } from '@/middleware';
import { UserRole } from '@/lib/dal/types';

describe('Challenger M2-1: Empirical Security Guardrails Stress Testing', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  // Test identities
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

  const centerAdminMaher: UserSecurityContext = {
    id: 'user-admin-maher',
    role: 'CENTER_ADMIN',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const branchManagerMaher: UserSecurityContext = {
    id: 'user-bm-nasr',
    role: 'BRANCH_MANAGER',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const accountantMaher: UserSecurityContext = {
    id: 'user-acct-01',
    role: 'ACCOUNTANT',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const receptionistMaher: UserSecurityContext = {
    id: 'user-recep-01',
    role: 'RECEPTIONIST',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const parentAhmed: UserSecurityContext = {
    id: 'user-parent-ahmed',
    role: 'PARENT',
    tenantSlug: 'al-maher',
    tenantId: 'tenant-maher-001',
  };

  const platformOwner: UserSecurityContext = {
    id: 'user-owner-001',
    role: 'PLATFORM_OWNER',
    tenantSlug: 'global',
  };

  // =========================================================================
  // Mission Item 1: Student & Teacher Avatar Photo Update (HTTP 200 OK)
  // =========================================================================
  describe('Mission Item 1: Student & Teacher Avatar Photo Update (HTTP 200 OK)', () => {
    it('allows STUDENT to update own avatar with valid HTTPS URL', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://images.unsplash.com/photo-student-alice.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://images.unsplash.com/photo-student-alice.jpg');
      expect(res.data?.targetUserId).toBe(studentAlice.id);
    });

    it('allows TEACHER to update own avatar with valid HTTPS URL', () => {
      const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatar_url: 'https://images.unsplash.com/photo-teacher-zaid.png',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://images.unsplash.com/photo-teacher-zaid.png');
      expect(res.data?.targetUserId).toBe(teacherZaid.id);
    });

    it('accepts camelCase avatarUrl payload key for both student and teacher', () => {
      const resStudent = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatarUrl: 'https://cdn.yallacenter.com/alice-new.jpg',
      });
      expect(resStudent.status).toBe(200);
      expect(resStudent.success).toBe(true);
      expect(resStudent.data?.avatarUrl).toBe('https://cdn.yallacenter.com/alice-new.jpg');

      const resTeacher = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatarUrl: 'https://cdn.yallacenter.com/zaid-new.jpg',
      });
      expect(resTeacher.status).toBe(200);
      expect(resTeacher.success).toBe(true);
      expect(resTeacher.data?.avatarUrl).toBe('https://cdn.yallacenter.com/zaid-new.jpg');
    });

    it('trims leading and trailing whitespace from valid avatar URL', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: '   https://cdn.yallacenter.com/trimmed.jpg   ',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://cdn.yallacenter.com/trimmed.jpg');
    });

    it('allows authorized administrative roles (CENTER_ADMIN, BRANCH_MANAGER, PLATFORM_OWNER) to update photos', () => {
      const adminRes = validateProfilePhotoUpdate(centerAdminMaher, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/alice-admin-override.jpg',
      });
      expect(adminRes.status).toBe(200);
      expect(adminRes.success).toBe(true);

      const bmRes = validateProfilePhotoUpdate(branchManagerMaher, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/alice-bm-override.jpg',
      });
      expect(bmRes.status).toBe(200);
      expect(bmRes.success).toBe(true);

      const ownerRes = validateProfilePhotoUpdate(platformOwner, teacherZaid.id, {
        avatar_url: 'https://cdn.yallacenter.com/zaid-owner-override.jpg',
      });
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.success).toBe(true);
    });

    it('rejects empty, whitespace-only, or invalid avatar URLs with HTTP 400 Bad Request', () => {
      const emptyRes = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: '',
      });
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toBe('BAD_REQUEST');

      const wsRes = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: '     ',
      });
      expect(wsRes.status).toBe(400);
      expect(wsRes.success).toBe(false);

      const nonStringRes = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 12345,
      });
      expect(nonStringRes.status).toBe(400);
      expect(nonStringRes.success).toBe(false);
    });

    it('empirically verifies Route Handler POST returns HTTP 200 for valid photo update', async () => {
      const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': studentAlice.id,
          'x-user-role': 'STUDENT',
          'x-tenant-slug': 'al-maher',
        },
        body: JSON.stringify({
          avatar_url: 'https://cdn.yallacenter.com/alice-live-route.jpg',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.avatarUrl).toBe('https://cdn.yallacenter.com/alice-live-route.jpg');
    });

    it('empirically verifies Route Handler POST returns HTTP 200 for TEACHER photo update', async () => {
      const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': teacherZaid.id,
          'x-user-role': 'TEACHER',
          'x-tenant-slug': 'al-maher',
        },
        body: JSON.stringify({
          avatarUrl: 'https://cdn.yallacenter.com/zaid-live-route.jpg',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.avatarUrl).toBe('https://cdn.yallacenter.com/zaid-live-route.jpg');
    });

    it('empirically verifies state persistence via DAL updateUserProfilePhoto', async () => {
      const res = await dal.updateUserProfilePhoto(
        studentAlice.id,
        'https://cdn.yallacenter.com/persisted-photo.jpg',
        studentAlice.id,
        'STUDENT'
      );
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://cdn.yallacenter.com/persisted-photo.jpg');

      // Verify user in DAL has updated avatar
      const user = await dal.getUserById(studentAlice.id);
      expect(user?.avatarUrl).toBe('https://cdn.yallacenter.com/persisted-photo.jpg');
    });
  });

  // =========================================================================
  // Mission Item 2: Student & Teacher Administrative Field Lockout (HTTP 403)
  // =========================================================================
  describe('Mission Item 2: Student & Teacher Administrative Field Lockout (HTTP 403 Forbidden)', () => {
    const requiredForbiddenKeys = [
      'fullName',
      'studentCode',
      'balanceDue',
      'stage',
      'grade',
      'phone',
      'role',
    ];

    const extendedForbiddenKeys = [
      'full_name',
      'student_code',
      'balance_due',
      'division',
      'seatNumber',
      'seat_number',
      'email',
      'nationalId',
      'national_id',
      'guardianName',
      'guardian_name',
      'guardianPhone',
      'guardian_phone',
      'isActive',
      'is_active',
      'tenantId',
      'tenant_id',
      'contractualFixedRate',
      'splitPercentage',
      'test_scores',
      'enrolled_groups',
      'attendance_history',
      'isAdmin',
      '__proto__',
      'constructor',
    ];

    describe('A. Systematic rejection of every required administrative field for STUDENT', () => {
      requiredForbiddenKeys.forEach((field) => {
        it(`strictly rejects student attempting to update "${field}" with HTTP 403`, () => {
          const payload = {
            avatar_url: 'https://cdn.yallacenter.com/alice.jpg',
            [field]: 'malicious_override',
          };
          const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, payload);
          expect(res.status).toBe(403);
          expect(res.success).toBe(false);
          expect(res.error).toBe('FORBIDDEN');
          expect(res.message).toContain(field);
        });
      });
    });

    describe('B. Systematic rejection of extended administrative & financial fields for STUDENT', () => {
      extendedForbiddenKeys.forEach((field) => {
        it(`strictly rejects student attempting to update extended field "${field}" with HTTP 403`, () => {
          const payload = {
            avatar_url: 'https://cdn.yallacenter.com/alice.jpg',
            [field]: 'unauthorized_value',
          };
          const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, payload);
          expect(res.status).toBe(403);
          expect(res.success).toBe(false);
          expect(res.error).toBe('FORBIDDEN');
        });
      });
    });

    describe('C. Systematic rejection of administrative & financial fields for TEACHER', () => {
      const teacherRestrictedFields = [
        'contractualFixedRate',
        'splitPercentage',
        'fullName',
        'role',
        'balanceDue',
        'phone',
        'salary',
        'rates',
      ];

      teacherRestrictedFields.forEach((field) => {
        it(`strictly rejects teacher attempting to update "${field}" with HTTP 403`, () => {
          const payload = {
            avatar_url: 'https://cdn.yallacenter.com/zaid.jpg',
            [field]: 99999,
          };
          const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, payload);
          expect(res.status).toBe(403);
          expect(res.success).toBe(false);
          expect(res.error).toBe('FORBIDDEN');
        });
      });
    });

    describe('D. Sneaky injection / Mass-assignment attacks via Route Handler POST', () => {
      it('Route Handler rejects student payload containing balanceDue: 0 with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': studentAlice.id,
            'x-user-role': 'STUDENT',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            avatar_url: 'https://cdn.yallacenter.com/alice.jpg',
            balanceDue: 0.0,
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('Route Handler rejects student payload containing studentCode with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': studentAlice.id,
            'x-user-role': 'STUDENT',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            avatar_url: 'https://cdn.yallacenter.com/alice.jpg',
            studentCode: 'STD-HACK-001',
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('Route Handler rejects student payload containing role elevation attempt with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': studentAlice.id,
            'x-user-role': 'STUDENT',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            avatar_url: 'https://cdn.yallacenter.com/alice.jpg',
            role: 'PLATFORM_OWNER',
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('Route Handler rejects teacher payload containing contractualFixedRate with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': teacherZaid.id,
            'x-user-role': 'TEACHER',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            avatar_url: 'https://cdn.yallacenter.com/zaid.jpg',
            contractualFixedRate: 1000,
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('rejects student attempting to modify peer student profile via Route Handler with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': studentAlice.id,
            'x-user-role': 'STUDENT',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            userId: studentBob.id,
            avatar_url: 'https://cdn.yallacenter.com/hacked.jpg',
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('rejects teacher attempting to modify peer teacher profile via Route Handler with HTTP 403', async () => {
        const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': teacherZaid.id,
            'x-user-role': 'TEACHER',
            'x-tenant-slug': 'al-maher',
          },
          body: JSON.stringify({
            userId: teacherAmr.id,
            avatar_url: 'https://cdn.yallacenter.com/hacked.jpg',
          }),
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('FORBIDDEN');
      });

      it('rejects unauthorized roles (PARENT, RECEPTIONIST, ACCOUNTANT) from updating photos with HTTP 403', async () => {
        for (const actor of [parentAhmed, receptionistMaher, accountantMaher]) {
          const req = new NextRequest('http://localhost:3000/api/profile/update-photo', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-user-id': actor.id,
              'x-user-role': actor.role,
              'x-tenant-slug': 'al-maher',
            },
            body: JSON.stringify({
              avatar_url: 'https://cdn.yallacenter.com/test.jpg',
            }),
          });

          const res = await POST(req);
          expect(res.status).toBe(403);
        }
      });
    });

    describe('E. Direct DAL Mutation Guardrail (dal.updateUser)', () => {
      it('dal.updateUser returns HTTP 403 when student updates balanceDue', async () => {
        const res = await dal.updateUser(
          studentAlice.id,
          { balanceDue: 0 } as any,
          studentAlice.id,
          'STUDENT'
        );
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
      });

      it('dal.updateUser returns HTTP 403 when student updates fullName', async () => {
        const res = await dal.updateUser(
          studentAlice.id,
          { fullName: 'اسم مخترق' } as any,
          studentAlice.id,
          'STUDENT'
        );
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
      });

      it('dal.updateUser returns HTTP 403 when student updates another student', async () => {
        const res = await dal.updateUser(
          studentBob.id,
          { avatarUrl: 'https://cdn.yallacenter.com/hacked.jpg' },
          studentAlice.id,
          'STUDENT'
        );
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
      });
    });
  });

  // =========================================================================
  // Mission Item 3: Cross-Tenant Access Boundary (HTTP 403 Forbidden)
  // =========================================================================
  describe('Mission Item 3: Cross-Tenant Access Isolation (HTTP 403 Forbidden)', () => {
    describe('A. checkTenantAccess Security Engine', () => {
      it('allows Center A user to access Center A data (GRANTED_LOCAL)', () => {
        const resSlug = checkTenantAccess(centerAdminMaher, 'al-maher');
        expect(resSlug.status).toBe(200);
        expect(resSlug.success).toBe(true);
        expect(resSlug.data?.access).toBe('GRANTED_LOCAL');

        const resId = checkTenantAccess(centerAdminMaher, 'tenant-maher-001');
        expect(resId.status).toBe(200);
        expect(resId.success).toBe(true);
        expect(resId.data?.access).toBe('GRANTED_LOCAL');
      });

      it('strictly rejects Center A Admin accessing Center B by slug with HTTP 403', () => {
        const res = checkTenantAccess(centerAdminMaher, 'al-rowad');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
        expect(res.message).toMatch(/cross-tenant/i);
      });

      it('strictly rejects Center A Admin accessing Center B by ID with HTTP 403', () => {
        const res = checkTenantAccess(centerAdminMaher, 'tenant-rowad-002');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects Center A Student accessing Center B with HTTP 403', () => {
        const res = checkTenantAccess(studentAlice, 'al-rowad');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects Center A Teacher accessing Center B with HTTP 403', () => {
        const res = checkTenantAccess(teacherZaid, 'al-rowad');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects Center A Branch Manager accessing Center B with HTTP 403', () => {
        const res = checkTenantAccess(branchManagerMaher, 'al-rowad');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects Center A Receptionist accessing Center B with HTTP 403', () => {
        const res = checkTenantAccess(receptionistMaher, 'al-rowad');
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('allows Platform Owner global access to any tenant (GRANTED_GLOBAL)', () => {
        const resMaher = checkTenantAccess(platformOwner, 'al-maher');
        expect(resMaher.status).toBe(200);
        expect(resMaher.data?.access).toBe('GRANTED_GLOBAL');

        const resRowad = checkTenantAccess(platformOwner, 'al-rowad');
        expect(resRowad.status).toBe(200);
        expect(resRowad.data?.access).toBe('GRANTED_GLOBAL');

        const resArbitrary = checkTenantAccess(platformOwner, 'future-center-999');
        expect(resArbitrary.status).toBe(200);
        expect(resArbitrary.data?.access).toBe('GRANTED_GLOBAL');
      });

      it('returns HTTP 401 Unauthorized if actor is null or undefined', () => {
        const res = checkTenantAccess(null as any, 'al-maher');
        expect(res.status).toBe(401);
        expect(res.success).toBe(false);
        expect(res.error).toBe('UNAUTHORIZED');
      });
    });

    describe('B. Next.js Middleware Route Guarding (middleware.ts)', () => {
      it('blocks Center A user visiting Center B route with HTTP 403 Forbidden (header-based)', () => {
        const req = new NextRequest('http://localhost:3000/center/al-rowad/students', {
          headers: {
            'x-user-id': centerAdminMaher.id,
            'x-user-role': 'CENTER_ADMIN',
            'x-tenant-slug': 'al-maher',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(403);
      });

      it('blocks Center A student visiting Center B route with HTTP 403 Forbidden (cookie-based)', () => {
        const req = new NextRequest('http://localhost:3000/center/al-rowad/sessions', {
          headers: {
            cookie: 'yc_tenant=al-maher; yc_role=STUDENT; yc_user_id=user-student-1001',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(403);
      });

      it('blocks Center A teacher visiting Center B route with HTTP 403 Forbidden (cookie-based)', () => {
        const req = new NextRequest('http://localhost:3000/center/al-rowad/materials', {
          headers: {
            cookie: 'yc_tenant=al-maher; yc_role=TEACHER; yc_user_id=user-teacher-math',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(403);
      });

      it('allows Center A user visiting Center A route (status 200 / next)', () => {
        const req = new NextRequest('http://localhost:3000/center/al-maher/students', {
          headers: {
            'x-user-id': centerAdminMaher.id,
            'x-user-role': 'CENTER_ADMIN',
            'x-tenant-slug': 'al-maher',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(200);
      });

      it('allows PLATFORM_OWNER to visit any center route regardless of cookie', () => {
        const req = new NextRequest('http://localhost:3000/center/al-rowad/branches', {
          headers: {
            'x-user-id': platformOwner.id,
            'x-user-role': 'PLATFORM_OWNER',
            'x-tenant-slug': 'al-maher', // Even with different tenant slug header
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(200);
      });

      it('redirects unauthorized non-PLATFORM_OWNER visiting /owner to their center', () => {
        const req = new NextRequest('http://localhost:3000/owner', {
          headers: {
            'x-user-id': centerAdminMaher.id,
            'x-user-role': 'CENTER_ADMIN',
            'x-tenant-slug': 'al-maher',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(307); // NextResponse.redirect defaults to 307
        expect(res.headers.get('location')).toBe('http://localhost:3000/center/al-maher');
      });

      it('allows PLATFORM_OWNER visiting /owner route without redirection', () => {
        const req = new NextRequest('http://localhost:3000/owner', {
          headers: {
            'x-user-id': platformOwner.id,
            'x-user-role': 'PLATFORM_OWNER',
          },
        });

        const res = middleware(req);
        expect(res.status).toBe(200);
      });
    });
  });

  // =========================================================================
  // Mission Item 4: Teacher Privacy & Contractual Rate Lockout (HTTP 403)
  // =========================================================================
  describe('Mission Item 4: Teacher Privacy & Rate Lockout (HTTP 403 Forbidden)', () => {
    describe('A. Contractual Rate Alteration Lockout (validateTeacherRateUpdate)', () => {
      it('strictly rejects TEACHER attempting to alter own contractual salary rate with HTTP 403', () => {
        const res = validateTeacherRateUpdate(teacherZaid, teacherZaid.id, {
          contractualFixedRate: 500,
        });
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects TEACHER attempting to alter peer teacher rates with HTTP 403', () => {
        const res = validateTeacherRateUpdate(teacherZaid, teacherAmr.id, {
          contractualFixedRate: 300,
        });
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects TEACHER attempting to alter split percentage with HTTP 403', () => {
        const res = validateTeacherRateUpdate(teacherZaid, teacherZaid.id, {
          splitPercentage: 90,
        });
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
      });

      it('strictly rejects non-authorized roles (STUDENT, PARENT, RECEPTIONIST, BRANCH_MANAGER) with HTTP 403', () => {
        const unauthorizedActors = [
          studentAlice,
          parentAhmed,
          receptionistMaher,
          branchManagerMaher,
        ];

        unauthorizedActors.forEach((actor) => {
          const res = validateTeacherRateUpdate(actor, teacherZaid.id, {
            contractualFixedRate: 200,
          });
          expect(res.status).toBe(403);
          expect(res.success).toBe(false);
        });
      });

      it('allows authorized administrative roles (CENTER_ADMIN, ACCOUNTANT, PLATFORM_OWNER) to update rates', () => {
        const adminRes = validateTeacherRateUpdate(centerAdminMaher, teacherZaid.id, {
          contractualFixedRate: 30,
        });
        expect(adminRes.status).toBe(200);
        expect(adminRes.success).toBe(true);

        const acctRes = validateTeacherRateUpdate(accountantMaher, teacherZaid.id, {
          contractualFixedRate: 35,
        });
        expect(acctRes.status).toBe(200);
        expect(acctRes.success).toBe(true);

        const ownerRes = validateTeacherRateUpdate(platformOwner, teacherZaid.id, {
          contractualFixedRate: 40,
        });
        expect(ownerRes.status).toBe(200);
        expect(ownerRes.success).toBe(true);
      });
    });

    describe('B. Teacher Payroll Statement Privacy (validateTeacherStatementAccess)', () => {
      it('allows TEACHER to inspect their own payroll statement (HTTP 200 OK)', () => {
        const res = validateTeacherStatementAccess(teacherZaid, teacherZaid.id);
        expect(res.status).toBe(200);
        expect(res.success).toBe(true);
        expect(res.data?.teacherId).toBe(teacherZaid.id);
      });

      it('strictly rejects TEACHER attempting to inspect peer teacher statement with HTTP 403', () => {
        const res = validateTeacherStatementAccess(teacherZaid, teacherAmr.id);
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
        expect(res.message).toMatch(/cannot access another teacher/i);
      });

      it('strictly rejects STUDENT attempting to inspect teacher payroll statement with HTTP 403', () => {
        const res = validateTeacherStatementAccess(studentAlice, teacherZaid.id);
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects PARENT attempting to inspect teacher payroll statement with HTTP 403', () => {
        const res = validateTeacherStatementAccess(parentAhmed, teacherZaid.id);
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toBe('FORBIDDEN');
      });

      it('strictly rejects RECEPTIONIST attempting to inspect teacher payroll statement with HTTP 403', () => {
        const res = validateTeacherStatementAccess(receptionistMaher, teacherZaid.id);
        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
      });

      it('allows authorized administrative roles (CENTER_ADMIN, ACCOUNTANT, PLATFORM_OWNER) to view statement', () => {
        const adminRes = validateTeacherStatementAccess(centerAdminMaher, teacherZaid.id);
        expect(adminRes.status).toBe(200);
        expect(adminRes.success).toBe(true);

        const acctRes = validateTeacherStatementAccess(accountantMaher, teacherZaid.id);
        expect(acctRes.status).toBe(200);
        expect(acctRes.success).toBe(true);

        const ownerRes = validateTeacherStatementAccess(platformOwner, teacherZaid.id);
        expect(ownerRes.status).toBe(200);
        expect(ownerRes.success).toBe(true);
      });
    });
  });
});
