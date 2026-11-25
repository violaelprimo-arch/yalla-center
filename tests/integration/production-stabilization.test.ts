import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GET_OWNER_CENTERS } from '@/app/api/owner/centers/route';
import { GET as GET_NOTIFICATIONS } from '@/app/api/center/[centerSlug]/notifications/route';
import { GET as GET_AUTH_ME } from '@/app/api/auth/me/route';
import { GET as GET_VERSION } from '@/app/api/version/route';
import { middleware } from '@/middleware';
import { MockDataProvider } from '@/lib/dal/mock-data';
import {
  createServerFirestoreStore,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';
import { InMemoryTransactionalFirestoreStore } from '../helpers/in-memory-firestore';

vi.mock('@/lib/firebase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/firebase/server')>();
  return {
    ...actual,
    verifyFirebaseIdToken: vi.fn(),
    createServerFirestoreStore: vi.fn(),
  };
});

describe('Production Stabilization & Security Regression Suite', () => {
  let store: InMemoryTransactionalFirestoreStore;

  beforeEach(() => {
    store = new InMemoryTransactionalFirestoreStore();
    vi.mocked(createServerFirestoreStore).mockResolvedValue(store);
    vi.mocked(verifyFirebaseIdToken).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('1. Strictly Read-Only GET /api/owner/centers (No Reseeding or Deletion)', () => {
    it('returns empty centers list without creating tenant-elmaher-001 when Firestore is empty', async () => {
      store.seed('staff_memberships/owner-uid', {
        uid: 'owner-uid',
        tenantId: 'platform',
        role: 'PLATFORM_OWNER',
        isActive: true,
      });
      vi.mocked(verifyFirebaseIdToken).mockResolvedValue({
        uid: 'owner-uid',
        email: 'admin@yallacenter.com',
        emailVerified: true,
        rawClaims: { role: 'PLATFORM_OWNER' },
      });

      const commitSpy = vi.spyOn(store, 'commit');
      const req = new NextRequest('http://localhost:3000/api/owner/centers', {
        headers: { Authorization: 'Bearer owner-token' },
      });
      const res = await GET_OWNER_CENTERS(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.centers).toEqual([]);
      expect(commitSpy).not.toHaveBeenCalled();
      expect((await store.getDocument('tenants/tenant-elmaher-001')).exists).toBe(false);
    });

    it('preserves legacy tenant-maher-001 without deleting it inside GET', async () => {
      store.seed('staff_memberships/owner-uid', {
        uid: 'owner-uid',
        tenantId: 'platform',
        role: 'PLATFORM_OWNER',
        isActive: true,
      });
      store.seed('tenants/tenant-maher-001', {
        id: 'tenant-maher-001',
        slug: 'al-maher',
        nameAr: 'سنتر الماهر',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      });
      vi.mocked(verifyFirebaseIdToken).mockResolvedValue({
        uid: 'owner-uid',
        email: 'admin@yallacenter.com',
        emailVerified: true,
        rawClaims: {},
      });

      const commitSpy = vi.spyOn(store, 'commit');
      const req = new NextRequest('http://localhost:3000/api/owner/centers', {
        headers: { Authorization: 'Bearer owner-token' },
      });
      const res = await GET_OWNER_CENTERS(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.centers).toHaveLength(1);
      expect(body.centers[0].id).toBe('tenant-maher-001');
      expect(commitSpy).not.toHaveBeenCalled();
      expect((await store.getDocument('tenants/tenant-maher-001')).exists).toBe(true);
    });

    it('rejects non-owner users even if email begins with owner@', async () => {
      vi.mocked(verifyFirebaseIdToken).mockResolvedValue({
        uid: 'fake-owner-uid',
        email: 'owner@random-attacker.com',
        emailVerified: true,
        rawClaims: {},
      });

      const req = new NextRequest('http://localhost:3000/api/owner/centers', {
        headers: { Authorization: 'Bearer fake-owner-token' },
      });
      const res = await GET_OWNER_CENTERS(req);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Strictly Read-Only Notifications (No Auto-Seeding Fake Records)', () => {
    it('returns empty array when no notification logs exist instead of generating 4 fake logs', async () => {
      const factory = await import('@/lib/dal/factory');
      const emptyDal = new MockDataProvider({ empty: true });
      await emptyDal.createTenant({
        id: 'tenant-elmaher-001',
        slug: 'elmaher',
        nameAr: 'سنتر الماهر',
        nameEn: 'Al Maher',
        subscriptionPlan: 'pro',
        isActive: true,
        settings: { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(factory, 'getDataProvider').mockReturnValue(emptyDal);
      store.seed('staff_memberships/admin-uid', {
        uid: 'admin-uid',
        tenantId: 'tenant-elmaher-001',
        role: 'CENTER_ADMIN',
        isActive: true,
      });
      vi.mocked(verifyFirebaseIdToken).mockResolvedValue({
        uid: 'admin-uid',
        emailVerified: true,
        rawClaims: {},
      });

      const req = new NextRequest('http://localhost:3000/api/center/elmaher/notifications', {
        headers: { Authorization: 'Bearer admin-token' },
      });
      const res = await GET_NOTIFICATIONS(req, { params: { centerSlug: 'elmaher' } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.stats.total).toBe(0);
      expect(body.logs).toEqual([]);
      expect(await emptyDal.getNotificationLogs('tenant-elmaher-001')).toEqual([]);
    });
  });

  describe('3. Auth & Middleware Fail-Closed Production Security', () => {
    it('GET /api/auth/me rejects owner@ email prefix escalation and missing staff_memberships', async () => {
      vi.mocked(verifyFirebaseIdToken).mockResolvedValue({
        uid: 'escalated-uid',
        email: 'owner@attacker.test',
        emailVerified: true,
        name: 'Spoofed Owner',
        rawClaims: {},
      });

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: 'Bearer attacker-token' },
      });
      const res = await GET_AUTH_ME(req);

      expect(res.status).toBe(403);
      expect((await store.getDocument('staff_memberships/escalated-uid')).exists).toBe(false);
    });

    it('middleware ignores spoofed yc_role/yc_tenant cookies & x-user-* headers outside test env', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATA_PROVIDER_MODE', 'firebase');

      const req = new NextRequest('http://localhost:3000/owner', {
        headers: {
          cookie: 'yc_role=PLATFORM_OWNER; yc_tenant=elmaher; yc_user_id=spoofed-id',
          'x-user-role': 'PLATFORM_OWNER',
          'x-user-id': 'spoofed-id',
        },
      });
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('middleware blocks spoofed center cookies without verified yc_token in production mode', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATA_PROVIDER_MODE', 'firebase');

      const req = new NextRequest('http://localhost:3000/center/elmaher/finance', {
        headers: {
          cookie: 'yc_role=CENTER_ADMIN; yc_tenant=elmaher; yc_user_id=admin-1',
        },
      });
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });
  });

  describe('4. Read-Only /api/version Diagnostic Endpoint', () => {
    it('returns commit SHA, branch, build timestamp, environment, and exposes no secrets', async () => {
      vi.stubEnv('NEXT_PUBLIC_GIT_SHA', 'abc1234deadbeef');
      vi.stubEnv('NEXT_PUBLIC_GIT_BRANCH', 'feat/firebase-auth-and-clean-data');
      vi.stubEnv('NEXT_PUBLIC_BUILD_TIMESTAMP', '2026-11-25T05:00:00Z');
      vi.stubEnv('DATA_PROVIDER_MODE', 'firebase');

      const res = await GET_VERSION();
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');

      const payload = await res.json();
      expect(payload).toMatchObject({
        service: 'yalla-center',
        gitCommitSha: 'abc1234deadbeef',
        gitBranch: 'feat/firebase-auth-and-clean-data',
        buildTimestamp: '2026-11-25T05:00:00Z',
        dataProviderMode: 'firebase',
      });
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('PRIVATE KEY');
      expect(serialized).not.toContain('FIREBASE_SERVICE_ACCOUNT');
      expect(serialized).not.toContain('Bearer');
    });
  });
});
