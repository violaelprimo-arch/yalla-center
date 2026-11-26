import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  assertRepoFileExists,
  readRepoFileText,
  requireRepoModule,
  resolveRepoPath,
} from '../helpers/module-loader';
import {
  installFirestoreFetchHarness,
  signFirebaseIdToken,
  type FirestoreFetchHarness,
} from '../helpers/firebase-harness';
import {
  assertRulesBlock,
  assertRulesCollectionImmutable,
  assertRulesNoPublicReadOn,
  assertRulesNoSelfBootstrapOnStaffMemberships,
  assertRulesTeacherOwnershipOn,
  extractRuleMatchBlock,
  loadFirestoreRulesText,
} from '../helpers/rules-harness';

function seedMultiTenantWorld(harness: FirestoreFetchHarness) {
  harness.setDoc('tenants/tenant-maher-001', {
    id: 'tenant-maher-001',
    slug: 'al-maher',
    aliases: ['elmaher'],
    nameAr: 'سنتر الماهر',
    nameEn: 'Al-Maher Center',
    subscriptionPlan: 'pro',
    isActive: true,
    settings: { currency: 'EGP', enableWhatsApp: false, enableFCM: true },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  harness.setDoc('tenants/tenant-noor-002', {
    id: 'tenant-noor-002',
    slug: 'al-noor',
    aliases: [],
    nameAr: 'سنتر النور',
    nameEn: 'Al-Noor Center',
    subscriptionPlan: 'starter',
    isActive: true,
    settings: { currency: 'EGP', enableWhatsApp: false, enableFCM: true },
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  });

  // Maher admin
  harness.setDoc('memberships/tenant-maher-001_uid-admin-maher', {
    uid: 'uid-admin-maher',
    tenantId: 'tenant-maher-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@almaher.edu.eg',
    displayName: 'مدير الماهر',
  });
  harness.setDoc('staff_memberships/uid-admin-maher', {
    uid: 'uid-admin-maher',
    tenantId: 'tenant-maher-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@almaher.edu.eg',
    displayName: 'مدير الماهر',
  });

  // Noor admin
  harness.setDoc('memberships/tenant-noor-002_uid-admin-noor', {
    uid: 'uid-admin-noor',
    tenantId: 'tenant-noor-002',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@alnoor.edu.eg',
    displayName: 'مدير النور',
  });
  harness.setDoc('staff_memberships/uid-admin-noor', {
    uid: 'uid-admin-noor',
    tenantId: 'tenant-noor-002',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@alnoor.edu.eg',
    displayName: 'مدير النور',
  });

  // Multi-center teacher
  harness.setDoc('memberships/tenant-maher-001_uid-multi-teacher', {
    uid: 'uid-multi-teacher',
    tenantId: 'tenant-maher-001',
    role: 'TEACHER',
    teacherId: 'teacher-maher-1',
    branchIds: ['b-maher-1'],
    isActive: true,
    email: 'teacher@multi.edu.eg',
    displayName: 'أ. محمد متعدد المراكز',
  });
  harness.setDoc('memberships/tenant-noor-002_uid-multi-teacher', {
    uid: 'uid-multi-teacher',
    tenantId: 'tenant-noor-002',
    role: 'TEACHER',
    teacherId: 'teacher-noor-1',
    branchIds: ['b-noor-1'],
    isActive: true,
    email: 'teacher@multi.edu.eg',
    displayName: 'أ. محمد متعدد المراكز',
  });

  // Student & inactive user
  harness.setDoc('memberships/tenant-maher-001_uid-student-1', {
    uid: 'uid-student-1',
    tenantId: 'tenant-maher-001',
    role: 'STUDENT',
    studentIds: ['std-maher-1'],
    branchIds: ['b-maher-1'],
    isActive: true,
    email: 'student1@almaher.edu.eg',
    displayName: 'طالب الماهر',
  });
  harness.setDoc('memberships/tenant-maher-001_uid-inactive-staff', {
    uid: 'uid-inactive-staff',
    tenantId: 'tenant-maher-001',
    role: 'RECEPTIONIST',
    branchIds: ['b-maher-1'],
    isActive: false,
    email: 'inactive@almaher.edu.eg',
    displayName: 'موظف موقوف',
  });

  // Students in Maher vs Noor
  harness.setDoc('center_students/tenant-maher-001~std-maher-1', {
    id: 'std-maher-1',
    tenantId: 'tenant-maher-001',
    studentUid: 'uid-student-1',
    fullName: 'يوسف طارق الماهر',
    studentCode: 'MHR-101',
    isActive: true,
  });
  harness.setDoc('center_students/tenant-noor-002~std-noor-1', {
    id: 'std-noor-1',
    tenantId: 'tenant-noor-002',
    studentUid: 'uid-student-noor-1',
    fullName: 'سلمى كريم النور',
    studentCode: 'NOR-201',
    isActive: true,
  });

  // Groups in Maher vs Noor
  harness.setDoc('center_groups/tenant-maher-001~grp-m-1', {
    id: 'grp-m-1',
    tenantId: 'tenant-maher-001',
    teacherId: 'teacher-maher-1',
    nameAr: 'مجموعة الماهر رياضيات',
    isActive: true,
  });
  harness.setDoc('center_groups/tenant-noor-002~grp-n-1', {
    id: 'grp-n-1',
    tenantId: 'tenant-noor-002',
    teacherId: 'teacher-noor-1',
    nameAr: 'مجموعة النور فيزياء',
    isActive: true,
  });

  harness.resetCounts();
}

describe('F6 — Canonical Center IDs & Slug Resolution (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATA_PROVIDER_MODE = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'yalla-center';
    harness = await installFirestoreFetchHarness();
    seedMultiTenantWorld(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F06-01: canonical slug /api/center/al-maher/students resolves to tenant-maher-001 without mutating slug', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { students?: Array<{ id: string }>; data?: Array<{ id: string }> };
    const list = body.students ?? body.data ?? [];
    expect(list.some((s) => s.id === 'std-maher-1')).toBe(true);
    expect(list.some((s) => s.id === 'std-noor-1')).toBe(false);
    expect(harness.getDoc<{ slug: string }>('tenants/tenant-maher-001')?.slug).toBe('al-maher');
  });

  it('T1-F06-02: alias slug /api/center/elmaher/students resolves to tenant-maher-001 without mutating tenant.slug or creating duplicate tenant', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/elmaher/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'elmaher' } }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { students?: Array<{ id: string }>; data?: Array<{ id: string }> };
    const list = body.students ?? body.data ?? [];
    expect(list.some((s) => s.id === 'std-maher-1')).toBe(true);
    expect(harness.listCollection('tenants')).toHaveLength(2);
    expect(harness.getDoc<{ slug: string }>('tenants/tenant-maher-001')?.slug).toBe('al-maher');
    expect(harness.counts.writes).toBe(0);
  });

  it('T1-F06-03: /api/center/elmaher/groups and /api/center/al-maher/groups resolve to the identical tenant-maher-001 dataset', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/groups/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const resCanonical = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/groups', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    const resAlias = await route.GET(
      new NextRequest('http://localhost:3000/api/center/elmaher/groups', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'elmaher' } }
    );

    expect(resCanonical.status).toBe(200);
    expect(resAlias.status).toBe(200);
    const bodyCanonical = await resCanonical.json();
    const bodyAlias = await resAlias.json();
    expect(bodyAlias).toEqual(bodyCanonical);
  });

  it('T1-F06-04: two distinct tenants (al-maher and al-noor) remain strictly disjoint', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const tokenMaher = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });
    const tokenNoor = await signFirebaseIdToken({
      sub: 'uid-admin-noor',
      email: 'admin@alnoor.edu.eg',
    });

    const mRes = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        headers: { Authorization: `Bearer ${tokenMaher}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    const nRes = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-noor/students', {
        headers: { Authorization: `Bearer ${tokenNoor}` },
      }),
      { params: { centerSlug: 'al-noor' } }
    );

    expect(mRes.status).toBe(200);
    expect(nRes.status).toBe(200);
    const mJson = JSON.stringify(await mRes.json());
    const nJson = JSON.stringify(await nRes.json());
    expect(mJson).toContain('std-maher-1');
    expect(mJson).not.toContain('std-noor-1');
    expect(nJson).toContain('std-noor-1');
    expect(nJson).not.toContain('std-maher-1');
  });

  it('T1-F06-05: public center site route app/site/[centerSlug]/page.tsx exists for canonical slug rendering without mutating tenant.slug', () => {
    assertRepoFileExists('app/site/[centerSlug]/page.tsx');
    const src = readRepoFileText('app/site/[centerSlug]/page.tsx');
    expect(src).not.toContain('getDataProvider');
  });

  it('T2-F06-01: resolving alias slug elmaher keeps tenant.slug strictly equal to canonical "al-maher"', async () => {
    const mockDataMod = await requireRepoModule<{
      MockDataProvider?: new () => { getTenantBySlug: (slug: string) => Promise<{ slug?: string } | null> };
    }>('lib/dal/mock-data.ts');

    if (mockDataMod.MockDataProvider) {
      const dal = new mockDataMod.MockDataProvider();
      const resolved = await dal.getTenantBySlug('elmaher');
      expect(resolved?.slug).toBe('al-maher');
    }
    expect(harness.getDoc<{ slug: string }>('tenants/tenant-maher-001')?.slug).toBe('al-maher');
  });

  it('T2-F06-02: unknown slug /api/center/al-maher-999/students returns 404 { ok: false } and never falls back to tenant-maher-001', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher-999/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher-999' } }
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(false);
  });

  it('T2-F06-03: duplicate slug/alias validation prevents creating a second tenant with slug "al-maher" or alias "elmaher"', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const ownerCentersExists = fs.existsSync(resolveRepoPath('app/api/owner/centers/route.ts'));
    expect(
      ownerCentersExists,
      'Expected Firestore-backed /api/owner/centers route enforcing unique canonical tenant slugs and aliases'
    ).toBe(true);

    const ownerRoute = await requireRepoModule<{
      POST: (req: NextRequest) => Promise<Response>;
    }>('app/api/owner/centers/route.ts');

    harness.setDoc('memberships/platform_uid-owner-1', {
      uid: 'uid-owner-1',
      tenantId: 'platform',
      role: 'PLATFORM_OWNER',
      isActive: true,
    });
    const ownerToken = await signFirebaseIdToken({ sub: 'uid-owner-1', email: 'owner@yalla.eg' });

    const res = await ownerRoute.POST(
      new NextRequest('http://localhost:3000/api/owner/centers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: 'al-maher', nameAr: 'سنتر مكرر' }),
      })
    );
    expect([400, 409]).toContain(res.status);
    expect(harness.listCollection('tenants')).toHaveLength(2);
    expect(route.GET).toBeDefined();
  });

  it('T2-F06-04: case-variant slug /api/center/AL-MAHER/students either normalizes cleanly or returns 404 with 0 duplicate tenants', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/AL-MAHER/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'AL-MAHER' } }
    );

    expect([200, 404]).toContain(res.status);
    expect(harness.listCollection('tenants')).toHaveLength(2);
    expect(harness.counts.writes).toBe(0);
  });

  it('T2-F06-05: firestore.rules enforces immutable tenant.id on tenants/{tenantId} updates', () => {
    const rules = loadFirestoreRulesText();
    const tenantsBlock = extractRuleMatchBlock(rules, 'tenants');
    expect(tenantsBlock).not.toBe('');
    expect(tenantsBlock).toMatch(/request\.resource\.data\.id\s*==\s*resource\.data\.id/);
  });
});

describe('F7 — Secure Single Auth, RBAC & Multi-Center Isolation (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATA_PROVIDER_MODE = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'yalla-center';
    harness = await installFirestoreFetchHarness();
    seedMultiTenantWorld(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F07-01: GET /api/auth/me returns verified uid, email, and active memberships for single-center admin', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest) => Promise<Response>;
    }>('app/api/auth/me/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uid?: string;
      email?: string;
      memberships?: Array<{ tenantId: string; role: string; isActive: boolean }>;
    };
    expect(body.uid).toBe('uid-admin-maher');
    expect(body.email).toBe('admin@almaher.edu.eg');
    expect(Array.isArray(body.memberships)).toBe(true);
    expect(body.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-maher-001',
          role: 'CENTER_ADMIN',
          isActive: true,
        }),
      ])
    );
  });

  it('T1-F07-02: multi-center teacher receives both verified memberships and keeps al-maher and al-noor groups strictly isolated', async () => {
    const authRoute = await requireRepoModule<{
      GET: (req: NextRequest) => Promise<Response>;
    }>('app/api/auth/me/route.ts');
    const groupsRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/groups/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-multi-teacher',
      email: 'teacher@multi.edu.eg',
    });

    const meRes = await authRoute.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      memberships?: Array<{ tenantId: string; role: string }>;
    };
    expect(meBody.memberships).toHaveLength(2);

    const maherGroups = await groupsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/groups', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    const noorGroups = await groupsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/al-noor/groups', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-noor' } }
    );

    expect(maherGroups.status).toBe(200);
    expect(noorGroups.status).toBe(200);
    const mStr = JSON.stringify(await maherGroups.json());
    const nStr = JSON.stringify(await noorGroups.json());
    expect(mStr).toContain('grp-m-1');
    expect(mStr).not.toContain('grp-n-1');
    expect(nStr).toContain('grp-n-1');
    expect(nStr).not.toContain('grp-m-1');
  });

  it('T1-F07-03: /login removes hardcoded DEMO_ACCOUNTS/workers.dev bypass and RBAC maps all 8 roles', async () => {
    const loginSrc = readRepoFileText('app/(auth)/login/page.tsx');
    expect(loginSrc).not.toContain('DEMO_ACCOUNTS');
    expect(loginSrc).not.toContain('password123');
    expect(loginSrc).not.toContain("includes('workers.dev')");

    const rbac = await requireRepoModule<{
      ROLE_PORTALS?: Record<string, string>;
      getPortalHomeRoute?: (role: string, centerSlug?: string) => string;
    }>('lib/security/rbac.ts');

    const roles = [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'TEACHER',
      'ACCOUNTANT',
      'STUDENT',
      'PARENT',
    ];
    for (const r of roles) {
      if (rbac.getPortalHomeRoute) {
        expect(rbac.getPortalHomeRoute(r, 'al-maher')).toBeTruthy();
      } else if (rbac.ROLE_PORTALS) {
        expect(rbac.ROLE_PORTALS[r]).toBeTruthy();
      } else {
        expect(readRepoFileText('lib/security/rbac.ts')).toContain(r);
      }
    }
  });

  it('T1-F07-04: authenticated STUDENT updating own profile photo via /api/profile/update-photo persists ONLY avatar without touching role/tenantId', async () => {
    const route = await requireRepoModule<{
      POST: (req: NextRequest) => Promise<Response>;
    }>('app/api/profile/update-photo/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-student-1',
      email: 'student1@almaher.edu.eg',
    });

    const res = await route.POST(
      new NextRequest('http://localhost:3000/api/profile/update-photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoUrl: 'https://cdn.example.com/avatars/std-1.png',
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
    expect(harness.counts.writes).toBeGreaterThan(0);

    const membership = harness.getDoc<{ role: string; tenantId: string }>(
      'memberships/tenant-maher-001_uid-student-1'
    );
    expect(membership?.role).toBe('STUDENT');
    expect(membership?.tenantId).toBe('tenant-maher-001');
  });

  it('T1-F07-05: cross-device requests with same verified Firebase ID token return identical memberships and persisted Firestore records', async () => {
    const authRoute = await requireRepoModule<{
      GET: (req: NextRequest) => Promise<Response>;
    }>('app/api/auth/me/route.ts');
    const studentsRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    // Device A creates student
    const createRes = await studentsRoute.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Device-A-Desktop',
        },
        body: JSON.stringify({
          fullName: 'نور الدين الجهاز الأول',
          phone: '01001234567',
          grade: '3sec',
        }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect([200, 201]).toContain(createRes.status);

    // Device B queries auth & students
    const meDeviceB = await authRoute.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Device-B-Mobile' },
      })
    );
    const listDeviceB = await studentsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Device-B-Mobile' },
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect(meDeviceB.status).toBe(200);
    expect(listDeviceB.status).toBe(200);
    expect(JSON.stringify(await listDeviceB.json())).toContain('نور الدين الجهاز الأول');
  });

  it('T2-F07-01: unauthenticated requests are rejected (401) across protected APIs and middleware gates student/parent portals', async () => {
    const authMe = await requireRepoModule<{ GET: (req: NextRequest) => Promise<Response> }>(
      'app/api/auth/me/route.ts'
    );
    const updatePhoto = await requireRepoModule<{ POST: (req: NextRequest) => Promise<Response> }>(
      'app/api/profile/update-photo/route.ts'
    );
    const notifications = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/notifications/route.ts');
    const exams = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/exams/route.ts');

    expect((await authMe.GET(new NextRequest('http://localhost:3000/api/auth/me'))).status).toBe(
      401
    );
    expect(
      (
        await updatePhoto.POST(
          new NextRequest('http://localhost:3000/api/profile/update-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoUrl: 'https://cdn.example.com/a.png' }),
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await notifications.GET(
          new NextRequest('http://localhost:3000/api/center/al-maher/notifications'),
          { params: { centerSlug: 'al-maher' } }
        )
      ).status
    ).toBe(401);
    expect(
      (
        await exams.GET(new NextRequest('http://localhost:3000/api/center/al-maher/exams'), {
          params: { centerSlug: 'al-maher' },
        })
      ).status
    ).toBe(401);

    const mwMod = await requireRepoModule<{
      middleware: (req: NextRequest) => Promise<Response> | Response;
    }>('middleware.ts');

    const studentPortalRes = await mwMod.middleware(
      new NextRequest('http://localhost:3000/center/al-maher/student-portal')
    );
    const parentPortalRes = await mwMod.middleware(
      new NextRequest('http://localhost:3000/center/al-maher/parent-portal')
    );
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(studentPortalRes.status);
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(parentPortalRes.status);
  });

  it('T2-F07-02: forged yc_role/yc_tenant cookies and actorRole body fields are completely ignored', async () => {
    const authMe = await requireRepoModule<{ GET: (req: NextRequest) => Promise<Response> }>(
      'app/api/auth/me/route.ts'
    );
    const finance = await requireRepoModule<{
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/finance/route.ts');

    const forgedNoToken = await authMe.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: 'yc_role=PLATFORM_OWNER; yc_tenant=tenant-maher-001; yc_user_id=admin',
          'x-user-role': 'PLATFORM_OWNER',
        },
      })
    );
    expect(forgedNoToken.status).toBe(401);

    const studentToken = await signFirebaseIdToken({
      sub: 'uid-student-1',
      email: 'student1@almaher.edu.eg',
    });
    const forgedStudentFinance = await finance.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/finance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          cookie: 'yc_role=CENTER_ADMIN; yc_tenant=tenant-maher-001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve_payroll',
          actorRole: 'CENTER_ADMIN',
        }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect(forgedStudentFinance.status).toBe(403);
  });

  it('T2-F07-03: POST /api/center/al-maher/staff/bootstrap rejects arbitrary signed-in users (403) without creating CENTER_ADMIN', async () => {
    const bootstrapRoute = await requireRepoModule<{
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/staff/bootstrap/route.ts');

    const strangerToken = await signFirebaseIdToken({
      sub: 'uid-attacker-99',
      email: 'attacker@example.com',
    });

    const res = await bootstrapRoute.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/staff/bootstrap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${strangerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'CENTER_ADMIN' }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect([403, 404, 410]).toContain(res.status);
    expect(harness.getDoc('staff_memberships/uid-attacker-99')).toBeNull();
    expect(harness.getDoc('memberships/tenant-maher-001_uid-attacker-99')).toBeNull();
    expect(harness.counts.writes).toBe(0);
  });

  it('T2-F07-04: unverified email or deactivated membership (isActive: false) is blocked from center writes (403)', async () => {
    const studentsRoute = await requireRepoModule<{
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const unverifiedToken = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
      email_verified: false,
    });
    const unverifiedRes = await studentsRoute.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${unverifiedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName: 'طالب غير موثق' }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect([401, 403]).toContain(unverifiedRes.status);

    const inactiveToken = await signFirebaseIdToken({
      sub: 'uid-inactive-staff',
      email: 'inactive@almaher.edu.eg',
      email_verified: true,
    });
    const inactiveRes = await studentsRoute.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${inactiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName: 'طالب موظف موقوف' }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect(inactiveRes.status).toBe(403);
  });

  it('T2-F07-05: cross-tenant admin request returns 403 and update-photo rejects forbidden privilege/discount fields (403)', async () => {
    const studentsRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');
    const updatePhoto = await requireRepoModule<{
      POST: (req: NextRequest) => Promise<Response>;
    }>('app/api/profile/update-photo/route.ts');

    const maherAdminToken = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });
    const crossTenantRes = await studentsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/al-noor/students', {
        headers: { Authorization: `Bearer ${maherAdminToken}` },
      }),
      { params: { centerSlug: 'al-noor' } }
    );
    expect(crossTenantRes.status).toBe(403);

    const studentToken = await signFirebaseIdToken({
      sub: 'uid-student-1',
      email: 'student1@almaher.edu.eg',
    });
    const privEscRes = await updatePhoto.POST(
      new NextRequest('http://localhost:3000/api/profile/update-photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoUrl: 'https://cdn.example.com/a.png',
          role: 'CENTER_ADMIN',
          discount: 100,
        }),
      })
    );
    expect(privEscRes.status).toBe(403);
    expect(
      harness.getDoc<{ role: string }>('memberships/tenant-maher-001_uid-student-1')?.role
    ).toBe('STUDENT');
  });
});

describe('F8 — Repaired Firestore Rules & Persistence Confirmation (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATA_PROVIDER_MODE = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'yalla-center';
    harness = await installFirestoreFetchHarness();
    seedMultiTenantWorld(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F08-01: firestore.rules defines multi-center memberships/{membershipId} and restricts center_students to tenant members', () => {
    const rules = loadFirestoreRulesText();
    const membershipsBlock = extractRuleMatchBlock(rules, 'memberships');
    expect(membershipsBlock, 'Expected match /memberships/{membershipId} in firestore.rules').not.toBe('');
    expect(membershipsBlock).toMatch(/tenantId/);
    expect(membershipsBlock).toMatch(/uid/);

    const studentsBlock = extractRuleMatchBlock(rules, 'center_students');
    expect(studentsBlock).not.toBe('');
    expect(studentsBlock).toMatch(/tenantId/);
  });

  it('T1-F08-02: firestore.rules enforces teacher ownership on center_materials, lesson_exams, and comprehensive_exams', () => {
    assertRulesTeacherOwnershipOn('center_materials');
    assertRulesTeacherOwnershipOn('lesson_exams');
    assertRulesTeacherOwnershipOn('comprehensive_exams');
  });

  it('T1-F08-03: POST /api/center/al-maher/students returns success ONLY after Firestore commit and immediate GET returns persisted student', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    const postRes = await route.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'مريم حسن الجبالي',
          phone: '01122334455',
          grade: '3sec',
        }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect([200, 201]).toContain(postRes.status);
    const postBody = (await postRes.json()) as { ok?: boolean };
    expect(postBody.ok).toBe(true);
    expect(harness.counts.writes).toBeGreaterThan(0);

    const getRes = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect(getRes.status).toBe(200);
    expect(JSON.stringify(await getRes.json())).toContain('مريم حسن الجبالي');
  });

  it('T1-F08-04: firestore.rules scopes student reads on center_students, center_attendance, lesson_grades, center_invoices, and exam_submissions', () => {
    const rules = loadFirestoreRulesText();
    for (const col of [
      'center_students',
      'center_attendance',
      'lesson_grades',
      'center_invoices',
      'exam_submissions',
    ]) {
      const block = extractRuleMatchBlock(rules, col);
      expect(block, `Missing match block for ${col}`).not.toBe('');
      expect(block).toMatch(/studentUid|studentIds|childStudentIds|request\.auth\.uid/);
    }
  });

  it('T1-F08-05: firestore.rules enforces immutable append-only rules on lesson_grade_audits', () => {
    assertRulesCollectionImmutable('lesson_grade_audits');
    const block = extractRuleMatchBlock(loadFirestoreRulesText(), 'lesson_grade_audits');
    expect(block).toMatch(/actorUid\s*==\s*request\.auth\.uid/);
  });

  it('T2-F08-01: firestore.rules blocks self-bootstrap privilege escalation and removes hardcoded owner email / token.role shortcuts', () => {
    assertRulesNoSelfBootstrapOnStaffMemberships();
    const rules = loadFirestoreRulesText();
    expect(rules).not.toMatch(/request\.auth\.token\.role\s*==/);
    expect(rules).not.toMatch(/fathyelprimo@gmail\.com/);

    const membershipsBlock = extractRuleMatchBlock(rules, 'memberships');
    expect(membershipsBlock).not.toBe('');
    expect(membershipsBlock).not.toMatch(/allow\s+create[^;]*:\s*if\s+isSignedIn\(\)\s*;/);
  });

  it('T2-F08-02: firestore.rules forbids public unauthenticated reads on tenants, teacher PII, and operational collections', () => {
    assertRulesNoPublicReadOn([
      'tenants',
      'teacher_profiles',
      'teacher_login_keys',
      'center_students',
      'center_invoices',
      'center_groups',
      'master_stages',
      'master_subjects',
      'master_branches',
      'center_classrooms',
    ]);
  });

  it('T2-F08-03: firestore.rules prevents Teacher T1 from mutating Teacher T2 materials or comprehensive_exams', () => {
    const rules = loadFirestoreRulesText();
    const materialsBlock = extractRuleMatchBlock(rules, 'center_materials');
    const examsBlock = extractRuleMatchBlock(rules, 'comprehensive_exams');

    expect(materialsBlock).toMatch(/teacherId|createdByUid|matchesTeacher/);
    expect(examsBlock).toMatch(/teacherId|createdByUid|matchesTeacher/);
    expect(examsBlock).not.toMatch(/allow\s+update\s*:\s*if\s+isStaffMember\([^)]+\)\s*&&\s*isSessionAllowedRole\(\)\s*;/);
  });

  it('T2-F08-04: firestore.rules enforces append-only immutability on audit collections and tenantId immutability on updates', () => {
    assertRulesCollectionImmutable('lesson_grade_audits');
    assertRulesCollectionImmutable('financial_audits');
    assertRulesCollectionImmutable('audit_logs');
    assertRulesBlock(
      /request\.resource\.data\.tenantId\s*==\s*resource\.data\.tenantId/,
      'Immutable tenantId check on tenant-scoped document updates'
    );
  });

  it('T2-F08-05: Firestore write failure or 409 conflict fails loudly with { ok: false } instead of fake { ok: true }', async () => {
    const route = await requireRepoModule<{
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-maher',
      email: 'admin@almaher.edu.eg',
    });

    harness.simulateFailure({
      target: 'commit',
      status: 409,
      code: 'ABORTED',
      message: 'Transaction conflict',
    });

    const res = await route.POST(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'طالب تعارض معاملة',
          phone: '01099887766',
          grade: '3sec',
        }),
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(false);
  });
});
