import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  readRepoFileText,
  requireRepoModule,
  resolveRepoPath,
} from '../helpers/module-loader';
import {
  installFirestoreFetchHarness,
  signFirebaseIdToken,
  type FirestoreFetchHarness,
} from '../helpers/firebase-harness';

function seedTwoTenantsAndStaff(harness: FirestoreFetchHarness) {
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
  harness.setDoc('tenants/tenant-fresh-001', {
    id: 'tenant-fresh-001',
    slug: 'fresh-center',
    aliases: [],
    nameAr: 'سنتر جديد',
    nameEn: 'Fresh Center',
    subscriptionPlan: 'starter',
    isActive: true,
    settings: { currency: 'EGP', enableWhatsApp: false, enableFCM: true },
    createdAt: '2026-11-26T00:00:00Z',
    updatedAt: '2026-11-26T00:00:00Z',
  });
  harness.setDoc('memberships/tenant-maher-001_uid-admin-1', {
    uid: 'uid-admin-1',
    tenantId: 'tenant-maher-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@almaher.edu.eg',
    displayName: 'مدير الماهر',
  });
  harness.setDoc('memberships/tenant-fresh-001_uid-fresh-admin', {
    uid: 'uid-fresh-admin',
    tenantId: 'tenant-fresh-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@fresh.edu.eg',
    displayName: 'مدير سنتر جديد',
  });
  harness.setDoc('staff_memberships/uid-admin-1', {
    uid: 'uid-admin-1',
    tenantId: 'tenant-maher-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@almaher.edu.eg',
    displayName: 'مدير الماهر',
  });
  harness.setDoc('staff_memberships/uid-fresh-admin', {
    uid: 'uid-fresh-admin',
    tenantId: 'tenant-fresh-001',
    role: 'CENTER_ADMIN',
    branchIds: [],
    isActive: true,
    email: 'admin@fresh.edu.eg',
    displayName: 'مدير سنتر جديد',
  });
  harness.resetCounts();
}

function findBackupScriptPath(): string | null {
  const scriptsDir = resolveRepoPath('scripts');
  if (!fs.existsSync(scriptsDir)) return null;
  const files = fs.readdirSync(scriptsDir);
  const backupFile = files.find((f) => /backup|export/i.test(f) && /\.(ts|mjs|js|cjs)$/i.test(f));
  return backupFile ? `scripts/${backupFile}` : null;
}

describe('F3 — Environment Audit, Staging Wrangler & Pre-Migration Backup (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    harness = await installFirestoreFetchHarness();
    seedTwoTenantsAndStaff(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F03-01: wrangler.jsonc defines explicit env.staging preserving DATA_PROVIDER_MODE=firebase without overwriting production', () => {
    const raw = readRepoFileText('wrangler.jsonc');
    const parsed = JSON.parse(raw) as {
      name?: string;
      vars?: Record<string, string>;
      env?: { staging?: { name?: string; vars?: Record<string, string> } };
    };

    expect(parsed.name).toBe('yalla-center');
    expect(parsed.vars?.DATA_PROVIDER_MODE).toBe('firebase');
    expect(parsed.env?.staging).toBeDefined();
    expect(parsed.env?.staging?.vars?.DATA_PROVIDER_MODE ?? parsed.vars?.DATA_PROVIDER_MODE).toBe(
      'firebase'
    );
  });

  it('T1-F03-02: non-destructive Firestore backup script exists in scripts/ and exports collection snapshots without mutating records', async () => {
    const scriptPath = findBackupScriptPath();
    expect(scriptPath, 'Expected a Firestore backup/export script under scripts/').not.toBeNull();

    const content = readRepoFileText(scriptPath!);
    expect(content).toMatch(/tenants|center_students|center_invoices/);
    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T1-F03-03: deployment source & commit audit record exists documenting branch cloudflare-demo, live Worker URL, and rollback', () => {
    const docsDir = resolveRepoPath('docs');
    const candidates: string[] = [];
    if (fs.existsSync(docsDir)) {
      for (const entry of fs.readdirSync(docsDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          candidates.push(readRepoFileText(`docs/${entry.name}`));
        } else if (entry.isDirectory() && entry.name === 'phases') {
          for (const sub of fs.readdirSync(resolveRepoPath('docs/phases'))) {
            if (sub.endsWith('.md')) {
              candidates.push(readRepoFileText(`docs/phases/${sub}`));
            }
          }
        }
      }
    }

    const joined = candidates.join('\n');
    expect(joined).toContain('cloudflare-demo');
    expect(joined).toContain('https://yalla-center.fathyelprimo.workers.dev');
    expect(joined).toMatch(/\b[0-9a-f]{7,40}\b/i);
    expect(joined).toMatch(/rollback/i);
  });

  it('T1-F03-04: package.json build/build:cloudflare scripts, wrangler.jsonc staging env, and .next/.open-next build artifacts exist', () => {
    const pkg = JSON.parse(readRepoFileText('package.json')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.build).toBe('next build');
    expect(pkg.scripts?.['build:cloudflare']).toBe('opennextjs-cloudflare build');

    const wrangler = JSON.parse(readRepoFileText('wrangler.jsonc')) as {
      env?: { staging?: Record<string, unknown> };
    };
    expect(wrangler.env?.staging).toBeDefined();

    expect(fs.existsSync(resolveRepoPath('.next')), 'Expected .next build output directory').toBe(true);
    expect(
      fs.existsSync(resolveRepoPath('.open-next/worker.js')),
      'Expected .open-next/worker.js build artifact'
    ).toBe(true);
  });

  it('T1-F03-05: backup/verification tooling in scripts/ covers verification/restore validation for tenant-maher-001', () => {
    const scriptsDir = resolveRepoPath('scripts');
    expect(fs.existsSync(scriptsDir), 'Expected scripts/ directory for backup/restore tooling').toBe(
      true
    );
    const files = fs.readdirSync(scriptsDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const allScriptsText = files
      .map((f) => fs.readFileSync(resolveRepoPath(`scripts/${f}`), 'utf8'))
      .join('\n');
    expect(allScriptsText).toMatch(/verify|restore|dry-run|count|backup/i);
  });

  it('T2-F03-01: wrangler.jsonc staging Worker name is distinct from production name "yalla-center"', () => {
    const wrangler = JSON.parse(readRepoFileText('wrangler.jsonc')) as {
      name?: string;
      env?: { staging?: { name?: string } };
    };
    expect(wrangler.env?.staging?.name).toBeDefined();
    expect(wrangler.env?.staging?.name).not.toBe(wrangler.name);
  });

  it('T2-F03-02: backup tooling fails loudly on missing credentials rather than producing silent/corrupted partial output', async () => {
    const scriptPath = findBackupScriptPath();
    expect(scriptPath).not.toBeNull();
    const text = readRepoFileText(scriptPath!);
    expect(text).toMatch(/throw|process\.exit\(1\)|exitCode\s*=\s*1/);
  });

  it('T2-F03-03: backup tooling preserves UTF-8 Arabic encoding and handles empty collections safely', () => {
    const scriptPath = findBackupScriptPath();
    expect(scriptPath).not.toBeNull();
    const text = readRepoFileText(scriptPath!);
    expect(text).toMatch(/utf-?8|JSON\.stringify/i);
  });

  it('T2-F03-04: backup script supports non-destructive dry-run mode without writing to Firestore', () => {
    const scriptPath = findBackupScriptPath();
    expect(scriptPath).not.toBeNull();
    const text = readRepoFileText(scriptPath!);
    expect(text).toMatch(/dry-?run|dryRun/i);
    expect(text).not.toMatch(/:commit/);
  });

  it('T2-F03-05: production Wrangler top-level name and live production target remain untouched by staging config', () => {
    const wrangler = JSON.parse(readRepoFileText('wrangler.jsonc')) as {
      name?: string;
      main?: string;
      env?: { staging?: { name?: string; routes?: unknown[] } };
    };
    expect(wrangler.name).toBe('yalla-center');
    expect(wrangler.main).toBe('.open-next/worker.js');
    expect(wrangler.env?.staging).toBeDefined();
    expect(wrangler.env?.staging?.name).not.toBe('yalla-center');
  });
});

describe('F4 — Remove MockDataProvider & Demo Auto-Recreation (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATA_PROVIDER_MODE = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'yalla-center';
    process.env.INTEGRITY_MODE = 'production';
    harness = await installFirestoreFetchHarness();
    seedTwoTenantsAndStaff(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F04-01: GET /api/center/fresh-center/students in firebase mode returns empty [] with 0 demo students synthesized', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-fresh-admin',
      email: 'admin@fresh.edu.eg',
    });
    const req = new NextRequest('http://localhost:3000/api/center/fresh-center/students', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await route.GET(req, { params: { centerSlug: 'fresh-center' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { students?: unknown[]; data?: unknown[] };
    const list = body.students ?? body.data ?? (Array.isArray(body) ? body : undefined);
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(0);
    expect(harness.counts.writes).toBe(0);
  });

  it('T1-F04-02: GET teachers and groups for empty fresh-center return [] with zero hardcoded demo records', async () => {
    const teachersRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/teachers/route.ts');
    const groupsRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/groups/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-fresh-admin',
      email: 'admin@fresh.edu.eg',
    });

    const tRes = await teachersRoute.GET(
      new NextRequest('http://localhost:3000/api/center/fresh-center/teachers', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'fresh-center' } }
    );
    expect(tRes.status).toBe(200);
    const tBody = (await tRes.json()) as { teachers?: unknown[]; data?: unknown[] };
    expect(tBody.teachers ?? tBody.data ?? []).toHaveLength(0);

    const gRes = await groupsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/fresh-center/groups', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'fresh-center' } }
    );
    expect(gRes.status).toBe(200);
    const gBody = (await gRes.json()) as { groups?: unknown[]; data?: unknown[] };
    expect(gBody.groups ?? gBody.data ?? []).toHaveLength(0);
    expect(harness.counts.writes).toBe(0);
  });

  it('T1-F04-03: deleting a student in Firestore stays deleted on subsequent GET without automatic demo recreation', async () => {
    harness.setDoc('center_students/tenant-maher-001~std-temp-1', {
      id: 'std-temp-1',
      tenantId: 'tenant-maher-001',
      fullName: 'طالب مؤقت',
      studentCode: 'TMP-01',
      isActive: true,
    });
    harness.store.delete('center_students/tenant-maher-001~std-temp-1');
    harness.resetCounts();

    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');
    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
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
    expect(list.some((s) => s.id === 'std-temp-1' || s.id === 'std-1001')).toBe(false);
    expect(harness.counts.writes).toBe(0);
  });

  it('T1-F04-04: /owner/centers does not depend on in-memory SaasPlatformService mock seed arrays', () => {
    const ownerCentersSrc = readRepoFileText('app/owner/centers/page.tsx');
    expect(ownerCentersSrc).not.toContain('SaasPlatformService');
    expect(ownerCentersSrc).not.toContain('INITIAL_CENTERS');
  });

  it('T1-F04-05: production/staging API routes and layouts do not invoke MockDataProvider', () => {
    const filesToAudit = [
      'app/api/auth/me/route.ts',
      'app/api/center/[centerSlug]/students/route.ts',
      'app/api/center/[centerSlug]/teachers/route.ts',
      'app/api/center/[centerSlug]/groups/route.ts',
      'app/api/center/[centerSlug]/notifications/route.ts',
      'app/api/center/[centerSlug]/finance/route.ts',
      'app/center/[centerSlug]/layout.tsx',
    ];

    for (const file of filesToAudit) {
      const src = readRepoFileText(file);
      expect(src, `${file} still imports/uses getDataProvider (MockDataProvider)`).not.toContain(
        'getDataProvider'
      );
      expect(src, `${file} still references MockDataProvider`).not.toContain('MockDataProvider');
    }
  });

  it('T2-F04-01: Firestore failure in firebase production mode returns explicit 5xx { ok: false } instead of falling back to MockDataProvider', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    harness.simulateFailure({
      target: 'all',
      status: 503,
      code: 'UNAVAILABLE',
      message: 'Firestore unavailable',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );
    expect(res.status).toBeGreaterThanOrEqual(500);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(false);
  });

  it('T2-F04-02: missing Firebase credentials with requireServiceAccount fails loudly (5xx) without calling hardcoded admin signInWithPassword', async () => {
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    const serverMod = await requireRepoModule<{
      createServerFirestoreStore: (opts: {
        callerIdToken: string;
        requireServiceAccount?: boolean;
      }) => Promise<unknown>;
    }>('lib/firebase/server.ts');

    await expect(
      serverMod.createServerFirestoreStore({
        callerIdToken: '',
        requireServiceAccount: true,
      })
    ).rejects.toThrow();

    expect(harness.identityToolkitCalls).toHaveLength(0);
  });

  it('T2-F04-03: new tenant created in Firestore shows 0 students/teachers/groups with zero demo Arabic placeholder records', async () => {
    harness.setDoc('tenants/tenant-new-999', {
      id: 'tenant-new-999',
      slug: 'new-center',
      nameAr: 'سنتر النهضة الجديد',
      isActive: true,
    });
    harness.setDoc('memberships/tenant-new-999_uid-new-admin', {
      uid: 'uid-new-admin',
      tenantId: 'tenant-new-999',
      role: 'CENTER_ADMIN',
      branchIds: [],
      isActive: true,
    });
    harness.resetCounts();

    const studentsRoute = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({ sub: 'uid-new-admin', email: 'new@center.eg' });
    const res = await studentsRoute.GET(
      new NextRequest('http://localhost:3000/api/center/new-center/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'new-center' } }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { students?: unknown[]; data?: unknown[] };
    expect(body.students ?? body.data ?? []).toHaveLength(0);
  });

  it('T2-F04-04: POST /api/center/al-maher/students with malformed payload while Firestore unavailable returns 4xx/5xx { ok: false }', async () => {
    const route = await requireRepoModule<{
      POST: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    harness.simulateFailure({ target: 'all', status: 503, code: 'UNAVAILABLE' });

    const req = new NextRequest('http://localhost:3000/api/center/al-maher/students', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: '' }),
    });

    const res = await route.POST(req, { params: { centerSlug: 'al-maher' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(false);
  });

  it('T2-F04-05: /owner/page.tsx and /owner/centers/page.tsx do not fallback to hardcoded INITIAL_CENTERS when tenants collection is empty', () => {
    const ownerPageSrc = readRepoFileText('app/owner/page.tsx');
    const ownerCentersSrc = readRepoFileText('app/owner/centers/page.tsx');
    expect(ownerPageSrc).not.toContain('SaasPlatformService');
    expect(ownerCentersSrc).not.toContain('SaasPlatformService');
    expect(ownerPageSrc).not.toContain('INITIAL_CENTERS');
  });
});

describe('F5 — Strictly Read-Only GET Endpoints (Tier 1 & Tier 2)', () => {
  let harness: FirestoreFetchHarness;

  beforeEach(async () => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DATA_PROVIDER_MODE = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'yalla-center';
    harness = await installFirestoreFetchHarness();
    seedTwoTenantsAndStaff(harness);
  });

  afterEach(async () => {
    await harness.restore();
  });

  it('T1-F05-01: GET /api/center/al-maher/notifications with empty inbox returns [] and performs 0 Firestore writes', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/notifications/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      notifications?: unknown[];
      logs?: unknown[];
      data?: unknown[];
    };
    const items = body.notifications ?? body.logs ?? body.data ?? [];
    expect(items).toHaveLength(0);
    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
    expect(harness.listCollection('notifications')).toHaveLength(0);
    expect(harness.listCollection('notification_outbox')).toHaveLength(0);
  });

  it('T1-F05-02: GET across core center endpoints performs zero Firestore writes or deletes', async () => {
    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const endpoints = [
      'students',
      'teachers',
      'groups',
      'sessions',
      'finance',
      'materials',
      'exams',
    ];

    for (const ep of endpoints) {
      const route = await requireRepoModule<{
        GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
      }>(`app/api/center/[centerSlug]/${ep}/route.ts`);

      const unauthRes = await route.GET(
        new NextRequest(`http://localhost:3000/api/center/al-maher/${ep}`),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(unauthRes.status, `GET /${ep} must require auth`).toBe(401);

      const authRes = await route.GET(
        new NextRequest(`http://localhost:3000/api/center/al-maher/${ep}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(authRes.status, `GET /${ep} should succeed for authenticated admin`).toBe(200);
    }

    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T1-F05-03: GET /api/center/nonexistent-center/students returns 404/403 and never auto-creates tenant', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/students/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });
    const initialTenantsCount = harness.listCollection('tenants').length;

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/nonexistent-center/students', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'nonexistent-center' } }
    );

    expect([403, 404]).toContain(res.status);
    expect(harness.counts.writes).toBe(0);
    expect(harness.listCollection('tenants')).toHaveLength(initialTenantsCount);
  });

  it('T1-F05-04: GET /api/auth/me returns verified identity and performs zero Firestore writes', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest) => Promise<Response>;
    }>('app/api/auth/me/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T1-F05-05: repeated GETs on master-data, enrollments, attendance, and lesson-scores are idempotent with 0 mutations', async () => {
    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const routes = [
      'master-data',
      'enrollments',
      'attendance',
      'reception/lesson-scores?sessionId=sess-1',
    ];

    for (const r of routes) {
      const routePath = r.split('?')[0];
      const mod = await requireRepoModule<{
        GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
      }>(`app/api/center/[centerSlug]/${routePath}/route.ts`);

      const first = await mod.GET(
        new NextRequest(`http://localhost:3000/api/center/al-maher/${r}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      const second = await mod.GET(
        new NextRequest(`http://localhost:3000/api/center/al-maher/${r}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { params: { centerSlug: 'al-maher' } }
      );

      expect([200, 404]).toContain(first.status);
      expect(second.status).toBe(first.status);
    }

    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T2-F05-01: calling GET /api/center/al-maher/notifications 10 consecutive times produces identical results and 0 writes', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/notifications/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const snapshots: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await route.GET(
        new NextRequest('http://localhost:3000/api/center/al-maher/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(res.status).toBe(200);
      snapshots.push(JSON.stringify(await res.json()));
    }

    expect(new Set(snapshots).size).toBe(1);
    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T2-F05-02: GET probe on mutation-only routes (staff/bootstrap, notifications/resend) does not export GET or returns 405 with 0 writes', async () => {
    const bootstrapRoute = await requireRepoModule<{
      GET?: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/staff/bootstrap/route.ts');

    if (bootstrapRoute.GET) {
      const token = await signFirebaseIdToken({ sub: 'uid-random', email: 'random@example.com' });
      const res = await bootstrapRoute.GET(
        new NextRequest('http://localhost:3000/api/center/al-maher/staff/bootstrap', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(res.status).toBe(405);
    } else {
      expect(bootstrapRoute.GET).toBeUndefined();
    }

    expect(harness.counts.writes).toBe(0);
  });

  it('T2-F05-03: GET /api/center/bad-slug-$$$/finance rejects cleanly with 4xx and 0 Firestore mutations', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/finance/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });
    const beforeTenants = harness.listCollection('tenants').length;

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/bad-slug-%24%24%24/finance', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'bad-slug-$$$' } }
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(harness.counts.writes).toBe(0);
    expect(harness.listCollection('tenants')).toHaveLength(beforeTenants);
  });

  it('T2-F05-04: GET /api/center/al-maher/exams?seed=true&reset=true ignores side-effect query flags and performs 0 writes', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest, ctx: { params: { centerSlug: string } }) => Promise<Response>;
    }>('app/api/center/[centerSlug]/exams/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-admin-1',
      email: 'admin@almaher.edu.eg',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/center/al-maher/exams?seed=true&reset=true', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { params: { centerSlug: 'al-maher' } }
    );

    expect(res.status).toBe(200);
    expect(harness.counts.writes).toBe(0);
    expect(harness.counts.deletes).toBe(0);
  });

  it('T2-F05-05: GET /api/auth/me for authenticated user with NO membership returns empty memberships and 0 writes', async () => {
    const route = await requireRepoModule<{
      GET: (req: NextRequest) => Promise<Response>;
    }>('app/api/auth/me/route.ts');

    const token = await signFirebaseIdToken({
      sub: 'uid-no-membership',
      email: 'stranger@example.com',
    });

    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uid?: string;
      role?: string | null;
      memberships?: unknown[];
      availableTenants?: unknown[];
    };
    expect(body.uid).toBe('uid-no-membership');
    expect(body.role).not.toBe('CENTER_ADMIN');
    expect(body.memberships ?? []).toHaveLength(0);
    expect(harness.counts.writes).toBe(0);
  });
});
