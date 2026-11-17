import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route';
import { GET as checkUsernameHandler } from '@/app/api/center/[centerSlug]/teachers/check-username/route';
import { saveTeacherProfile } from '@/lib/firebase/teacher-service';
import { InMemoryTransactionalFirestoreStore } from '../helpers/in-memory-firestore';
import { emptyTeacherInput, type TeacherInput } from '@/lib/teachers/profile';

describe('Firebase Auth, Clean Data & Empty States Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('TASK 2 — Clean Data & Empty Database Behavior', () => {
    it('initializes zero business records when operational fixtures are disabled', () => {
      const cleanDal = new MockDataProvider({ empty: true });

      expect(cleanDal.tenants).toHaveLength(0);
      expect(cleanDal.users).toHaveLength(0);
      expect(cleanDal.subjects).toHaveLength(0);
      expect(cleanDal.groups).toHaveLength(0);
      expect(cleanDal.sessions).toHaveLength(0);
      expect(cleanDal.enrollments).toHaveLength(0);
      expect(cleanDal.attendance).toHaveLength(0);
      expect(cleanDal.invoices).toHaveLength(0);
      expect(cleanDal.payments).toHaveLength(0);
      expect(cleanDal.expenses).toHaveLength(0);
      expect(cleanDal.materials).toHaveLength(0);
      expect(cleanDal.exams).toHaveLength(0);
    });

    it('allows platform owner to create the first center in an empty database', async () => {
      const cleanDal = new MockDataProvider({ empty: true });
      expect(await cleanDal.getTenants()).toHaveLength(0);

      const created = await cleanDal.createTenant({
        id: 'tenant-new-001',
        slug: 'future-center',
        nameAr: 'سنتر المستقبل التعليمي',
        nameEn: 'Future Educational Center',
        subscriptionPlan: 'pro',
        isActive: true,
        settings: {
          currency: 'EGP',
          enableWhatsApp: true,
          enableFCM: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(created.slug).toBe('future-center');
      const allTenants = await cleanDal.getTenants();
      expect(allTenants).toHaveLength(1);
      expect(allTenants[0].nameAr).toBe('سنتر المستقبل التعليمي');

      // Verify default stages were initialized for the new center
      const stages = await cleanDal.getStages('tenant-new-001');
      expect(stages.length).toBeGreaterThan(0);
    });
  });

  describe('TASK 3 & TASK 5 — Secure Login & Username Identity Toolkit Integration', () => {
    it('rejects invalid credentials with user-friendly Arabic error message', async () => {
      // Mock fetch to Identity Toolkit returning INVALID_LOGIN_CREDENTIALS
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('accounts:signInWithPassword')) {
          return new Response(
            JSON.stringify({
              error: { message: 'INVALID_LOGIN_CREDENTIALS' },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return originalFetch(url, init);
      });

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'wrong_user',
          password: 'wrong_password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('اسم المستخدم أو كلمة المرور غير صحيحة');

      global.fetch = originalFetch;
    });

    it('resolves authenticated teacher role and directs to teacher portal', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('accounts:signInWithPassword')) {
          return new Response(
            JSON.stringify({
              idToken: 'mock-id-token',
              localId: 'firebase-teacher-uid',
              email: 'ahmed+al-maher@teachers.yalla-center.invalid',
              displayName: 'أحمد محمود',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return originalFetch(url, init);
      });

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'ahmed',
          password: 'Password123!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.email).toBe('ahmed+al-maher@teachers.yalla-center.invalid');
      expect(data.defaultRedirectUrl).toContain('/center/');

      global.fetch = originalFetch;
    });

    it('enforces rate limiting on rapid repeated requests', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      let lastRes: Response | null = null;
      for (let i = 0; i < 6; i++) {
        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '198.51.100.42',
          },
          body: JSON.stringify({
            identifier: 'rate_limit_test',
            password: 'wrong_pass',
          }),
        });
        lastRes = await loginHandler(req);
      }

      expect(lastRes).not.toBeNull();
      expect(lastRes?.status).toBe(429);
      const data = await lastRes?.json();
      expect(data.error).toContain('تم تجاوز الحد المسموح');

      global.fetch = originalFetch;
    });

    it('handles password reset recovery request without user enumeration', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).includes('accounts:sendOobCode')) {
          return new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'teacher_user' }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('إذا كان هذا الحساب مسجلاً');

      global.fetch = originalFetch;
    });
  });

  describe('TASK 4 — Teacher Registration & Username Uniqueness', () => {
    it('validates username syntax in check-username endpoint', async () => {
      const invalidReq = new NextRequest(
        'http://localhost:3000/api/center/al-maher/teachers/check-username?username=ab'
      );
      const res = await checkUsernameHandler(invalidReq, { params: { centerSlug: 'al-maher' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.available).toBe(false);

      const validReq = new NextRequest(
        'http://localhost:3000/api/center/al-maher/teachers/check-username?username=math_star_2026'
      );
      const validRes = await checkUsernameHandler(validReq, { params: { centerSlug: 'al-maher' } });
      expect(validRes.status).toBe(200);
      const validData = await validRes.json();
      expect(validData.available).toBe(true);
    });

    it('provisions teacher with username and writes system_usernames and staff_memberships', async () => {
      const dal = new MockDataProvider();
      const store = new InMemoryTransactionalFirestoreStore();
      const tenant = (await dal.getTenantBySlug('al-maher'))!;
      const context = { dal, store, tenant };

      const provisionMock = vi.fn(async () => undefined);

      const input: TeacherInput = {
        ...emptyTeacherInput,
        fullName: 'أحمد سعيد',
        phone: '01012345678',
        login: { mode: 'username', username: 'ahmed_unique' },
        subjectIds: ['sub-math-3sec'],
        contracts: [{ level: '3_sec', model: 'fixed_session', value: 200 }],
      };

      const saved = await saveTeacherProfile(
        context,
        'teacher-11111111-2222-3333-4444-555555555555',
        0,
        input,
        'Secret123456!',
        provisionMock
      );

      expect(saved.fullName).toBe('أحمد سعيد');
      expect(provisionMock).toHaveBeenCalledTimes(1);

      // Verify system_usernames doc was written
      const usernameDoc = await store.getDocument<{ username: string; uid: string }>('system_usernames/ahmed_unique');
      expect(usernameDoc.exists).toBe(true);
      if (usernameDoc.exists) {
        expect(usernameDoc.data.username).toBe('ahmed_unique');

        // Verify staff_memberships doc was written
        const membershipDoc = await store.getDocument<{ role: string; isActive: boolean }>(`staff_memberships/${usernameDoc.data.uid}`);
        expect(membershipDoc.exists).toBe(true);
        if (membershipDoc.exists) {
          expect(membershipDoc.data.role).toBe('TEACHER');
          expect(membershipDoc.data.isActive).toBe(true);
        }
      }

      // Attempting to register another teacher with the same username must fail with 409
      const secondInput: TeacherInput = {
        ...input,
        fullName: 'محمود أحمد',
        phone: '01099998888',
      };

      await expect(
        saveTeacherProfile(context, 'teacher-22222222-3333-4444-5555-666666666666', 0, secondInput, 'AnotherPass123!', provisionMock)
      ).rejects.toMatchObject({ status: 409 });
    });
  });
});
