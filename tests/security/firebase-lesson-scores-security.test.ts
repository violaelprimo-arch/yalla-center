import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearFirebaseServerCachesForTests,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
  type ILessonScoreStore,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';
import {
  deleteLessonGrade,
  getSessionExamsAndGrades,
  importReviewedLocalStorageGrades,
  LessonScoreServiceError,
  resolveAuthorizedStaffActor,
  saveExamTotalMarks,
  upsertLessonGrade,
} from '@/lib/firebase/lesson-scores-service';
import {
  FirestoreRestClient,
  decodeFirestoreDocument,
  encodeFirestoreFields,
  type FirestoreWriteOperation,
  type StructuredFilter,
} from '@/lib/firebase/firestore-rest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { receptionSessionState } from '@/lib/attendance/reception';
import { lessonGradeDocId } from '@/lib/attendance/lesson-scores';

class InMemoryTransactionalFirestoreStore implements ILessonScoreStore {
  docs = new Map<string, { data: Record<string, unknown>; updateTime: string }>();
  private clock = 1;

  seed(path: string, data: Record<string, unknown>) {
    this.clock += 1;
    this.docs.set(path, { data: structuredClone(data), updateTime: `2026-11-11T12:00:${String(this.clock).padStart(2, '0')}Z` });
  }

  async getDocument<T = Record<string, unknown>>(
    documentPath: string
  ): Promise<{ exists: false } | { exists: true; data: T; updateTime?: string }> {
    const clean = documentPath.replace(/^\/+/, '');
    const row = this.docs.get(clean);
    if (!row) return { exists: false };
    return { exists: true, data: structuredClone(row.data) as T, updateTime: row.updateTime };
  }

  async queryCollection<T = Record<string, unknown>>(
    collectionId: string,
    filters: StructuredFilter[]
  ): Promise<Array<{ data: T; updateTime?: string; id: string }>> {
    const prefix = `${collectionId}/`;
    const out: Array<{ data: T; updateTime?: string; id: string }> = [];
    for (const [path, row] of this.docs.entries()) {
      if (!path.startsWith(prefix)) continue;
      const matches = filters.every((f) => {
        const val = row.data[f.fieldPath];
        if (f.op === 'EQUAL') return val === f.value;
        return false;
      });
      if (matches) {
        out.push({
          id: path.slice(prefix.length),
          data: structuredClone(row.data) as T,
          updateTime: row.updateTime,
        });
      }
    }
    return out;
  }

  async commit(writes: FirestoreWriteOperation[]): Promise<void> {
    // Check preconditions first (atomic semantics)
    for (const w of writes) {
      const clean = w.documentPath.replace(/^\/+/, '');
      const current = this.docs.get(clean);
      if (w.currentDocument?.exists === false && current) {
        throw new Error(`409 ALREADY_EXISTS at ${clean}`);
      }
      if (w.currentDocument?.exists === true && !current) {
        throw new Error(`409 NOT_FOUND at ${clean}`);
      }
      if (w.currentDocument?.updateTime && current?.updateTime !== w.currentDocument.updateTime) {
        throw new Error(`409 UPDATE_TIME_MISMATCH at ${clean}`);
      }
    }

    for (const w of writes) {
      const clean = w.documentPath.replace(/^\/+/, '');
      if (w.type === 'delete') {
        this.docs.delete(clean);
      } else if (w.data) {
        this.clock += 1;
        this.docs.set(clean, {
          data: structuredClone(w.data),
          updateTime: `2026-11-11T12:00:${String(this.clock).padStart(2, '0')}Z`,
        });
      }
    }
  }
}

async function generateTestRsaKeypair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey & {
    kid?: string;
  };
  publicJwk.kid = 'test-key-1';
  return { privateKey: keyPair.privateKey, publicJwk };
}

function toBase64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  kid = 'test-key-1'
): Promise<string> {
  const headerB64 = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  return `${headerB64}.${payloadB64}.${toBase64Url(new Uint8Array(signature))}`;
}

describe('Firebase Auth, Cloud Firestore & Lesson Score Security Invariants', () => {
  let store: InMemoryTransactionalFirestoreStore;
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';
  const liveSessionId = 'sess-live-today-security';

  beforeEach(() => {
    clearFirebaseServerCachesForTests();
    store = new InMemoryTransactionalFirestoreStore();
    dal = new MockDataProvider();

    // Seed an active Cairo-time open session on MockDataProvider
    const liveTemplate = dal.sessions.find((s) => s.id === 'sess-live-today')!;
    dal.sessions.push({
      ...liveTemplate,
      id: liveSessionId,
      sessionDate: '2026-11-11',
      startTime: '00:00',
      endTime: '23:59',
      status: 'in_progress',
    });

    // Ensure session state is open
    expect(receptionSessionState(dal.sessions.find((s) => s.id === liveSessionId)!, '2026-11-11T15:00')).toBe('current');

    // Seed an exam & non-enrolled student edge case
    dal.exams.push({
      id: `${liveSessionId}-exam`,
      tenantId,
      sessionId: liveSessionId,
      groupId: 'grp-math-sat',
      teacherId: 'user-teacher-math',
      subjectId: 'sub-math-3sec',
      subjectNameAr: 'الرياضيات التطبيقية',
      title: 'اختبار الحصة التجريبي',
      durationMinutes: 15,
      totalMarks: 20,
      passMarks: 10,
      isAiGenerated: false,
      groundedMaterialIds: [],
      status: 'draft',
      createdAt: '2026-11-11T00:00:00Z',
    });
  });

  it('verifies Firebase RS256 ID tokens cryptographically and rejects expired/forged/wrong-project tokens', async () => {
    const { privateKey, publicJwk } = await generateTestRsaKeypair();
    const nowSec = Math.floor(Date.now() / 1000);

    const validJwt = await signJwt(privateKey, {
      aud: 'yalla-center',
      iss: 'https://securetoken.google.com/yalla-center',
      sub: 'uid-staff-maher',
      email: 'sara@almaher.edu.eg',
      email_verified: true,
      iat: nowSec - 10,
      auth_time: nowSec - 10,
      exp: nowSec + 3600,
    });

    const verified = await verifyFirebaseIdToken(validJwt, {
      projectId: 'yalla-center',
      nowSec,
      jwksOverride: [publicJwk],
    });
    expect(verified.uid).toBe('uid-staff-maher');
    expect(verified.email).toBe('sara@almaher.edu.eg');

    // Wrong project audience rejected
    const wrongAudJwt = await signJwt(privateKey, {
      aud: 'other-firebase-project',
      iss: 'https://securetoken.google.com/other-firebase-project',
      sub: 'uid-staff-maher',
      iat: nowSec - 10,
      exp: nowSec + 3600,
    });
    await expect(
      verifyFirebaseIdToken(wrongAudJwt, { projectId: 'yalla-center', nowSec, jwksOverride: [publicJwk] })
    ).rejects.toThrow(FirebaseAuthError);

    // Expired token rejected
    const expiredJwt = await signJwt(privateKey, {
      aud: 'yalla-center',
      iss: 'https://securetoken.google.com/yalla-center',
      sub: 'uid-staff-maher',
      iat: nowSec - 7200,
      exp: nowSec - 10,
    });
    await expect(
      verifyFirebaseIdToken(expiredJwt, { projectId: 'yalla-center', nowSec, jwksOverride: [publicJwk] })
    ).rejects.toThrow(FirebaseAuthError);

    // Tampered payload rejected
    const parts = validJwt.split('.');
    const forgedPayload = toBase64Url(JSON.stringify({
      aud: 'yalla-center',
      iss: 'https://securetoken.google.com/yalla-center',
      sub: 'uid-admin-hijack',
      iat: nowSec - 10,
      exp: nowSec + 3600,
    }));
    await expect(
      verifyFirebaseIdToken(`${parts[0]}.${forgedPayload}.${parts[2]}`, {
        projectId: 'yalla-center',
        nowSec,
        jwksOverride: [publicJwk],
      })
    ).rejects.toThrow(FirebaseAuthError);

    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('Bearer   abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  it('rejects unauthenticated visitors, students, cross-tenant users, wrong-branch staff, and other teachers', async () => {
    const seedStaff = (uid: string, staff: Omit<StaffMembershipRecord, 'uid'>) => {
      store.seed(`staff_memberships/${uid}`, { uid, ...staff });
    };

    seedStaff('uid-student', { tenantId, role: 'STUDENT', isActive: true });
    seedStaff('uid-other-tenant', { tenantId: 'tenant-rowad-002', role: 'CENTER_ADMIN', isActive: true });
    seedStaff('uid-other-branch', {
      tenantId,
      role: 'RECEPTIONIST',
      branchIds: ['branch-heliopolis'],
      isActive: true,
    });
    seedStaff('uid-other-teacher', {
      tenantId,
      role: 'TEACHER',
      teacherId: 'user-teacher-phys',
      isActive: true,
    });

    // Student rejected at actor resolution
    await expect(
      resolveAuthorizedStaffActor({
        centerSlug: 'al-maher',
        verifiedToken: { uid: 'uid-student', emailVerified: true, rawClaims: {} },
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_ROLE' });

    // Cross-tenant admin rejected even with admin role
    await expect(
      resolveAuthorizedStaffActor({
        centerSlug: 'al-maher',
        verifiedToken: { uid: 'uid-other-tenant', emailVerified: true, rawClaims: {} },
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_CROSS_TENANT' });

    // Branch-scoped receptionist from branch-heliopolis cannot grade branch-nasr-city session
    const otherBranchActor = await resolveAuthorizedStaffActor({
      centerSlug: 'al-maher',
      verifiedToken: { uid: 'uid-other-branch', emailVerified: true, rawClaims: {} },
      store,
      dal,
    });
    await expect(
      saveExamTotalMarks({
        actor: otherBranchActor,
        sessionId: liveSessionId,
        totalMarksInput: '20',
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_BRANCH' });

    // Teacher of Physics cannot grade Math teacher's session
    const physTeacherActor = await resolveAuthorizedStaffActor({
      centerSlug: 'al-maher',
      verifiedToken: { uid: 'uid-other-teacher', emailVerified: true, rawClaims: {} },
      store,
      dal,
    });
    await expect(
      upsertLessonGrade({
        actor: physTeacherActor,
        sessionId: liveSessionId,
        examId: `${liveSessionId}-exam`,
        studentIdOrCode: 'STD-1001',
        scoreInput: '17',
        source: 'panel',
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_TEACHER_SCOPE' });
  });

  it('enforces single record per (studentId, examId), prevents lowering max marks below existing grade, verifies enrollment, and appends audit logs', async () => {
    store.seed('staff_memberships/uid-recep', {
      uid: 'uid-recep',
      email: 'sara@almaher.edu.eg',
      displayName: 'سارة الشافعي',
      tenantId,
      role: 'RECEPTIONIST',
      branchIds: ['branch-nasr-city'],
      isActive: true,
    });

    const actor = await resolveAuthorizedStaffActor({
      centerSlug: 'al-maher',
      verifiedToken: { uid: 'uid-recep', email: 'sara@almaher.edu.eg', emailVerified: true, rawClaims: {} },
      store,
      dal,
    });

    // Save exam totalMarks = 20 once
    const examRes = await saveExamTotalMarks({
      actor,
      sessionId: liveSessionId,
      examId: `${liveSessionId}-exam`,
      totalMarksInput: '20',
      store,
      dal,
    });
    expect(examRes.exam.totalMarks).toBe(20);

    // Reject unknown code & student belonging to another group (STD-1003 is not enrolled in grp-math-sat)
    await expect(
      upsertLessonGrade({
        actor,
        sessionId: liveSessionId,
        examId: examRes.exam.id,
        studentIdOrCode: 'STD-9999',
        scoreInput: '15',
        source: 'panel',
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 404, code: 'STUDENT_NOT_FOUND' });

    await expect(
      upsertLessonGrade({
        actor,
        sessionId: liveSessionId,
        examId: examRes.exam.id,
        studentIdOrCode: 'STD-1003',
        scoreInput: '15',
        source: 'panel',
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 403, code: 'STUDENT_NOT_IN_GROUP' });

    // Record score 17 for STD-1001 from panel
    const firstSave = await upsertLessonGrade({
      actor,
      sessionId: liveSessionId,
      examId: examRes.exam.id,
      studentIdOrCode: 'STD-1001',
      scoreInput: '17',
      source: 'panel',
      store,
      dal,
    });
    expect(firstSave.grade.id).toBe(lessonGradeDocId(examRes.exam.id, 'user-student-1001'));
    expect(firstSave.grade.score).toBe(17);
    expect(firstSave.grade.version).toBe(1);
    expect(firstSave.audit.previousScore).toBeNull();
    expect(firstSave.audit.newScore).toBe(17);

    // Update same student+exam to 18 from inline feed -> reuses single document & detects stale expectedVersion
    await expect(
      upsertLessonGrade({
        actor,
        sessionId: liveSessionId,
        examId: examRes.exam.id,
        studentIdOrCode: 'user-student-1001',
        scoreInput: '19',
        source: 'card',
        expectedVersion: 0,
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 409, code: 'GRADE_VERSION_CONFLICT' });

    const secondSave = await upsertLessonGrade({
      actor,
      sessionId: liveSessionId,
      examId: examRes.exam.id,
      studentIdOrCode: 'user-student-1001',
      scoreInput: '18',
      source: 'feed',
      expectedVersion: 1,
      store,
      dal,
    });
    expect(secondSave.grade.version).toBe(2);
    expect(secondSave.grade.score).toBe(18);
    expect(secondSave.audit.previousScore).toBe(17);
    expect(secondSave.audit.newScore).toBe(18);

    // Still only ONE document in lesson_grades for that student & exam
    const sessionData = await getSessionExamsAndGrades({
      actor,
      sessionId: liveSessionId,
      store,
      dal,
    });
    expect(sessionData.grades.filter((g) => g.studentId === 'user-student-1001')).toHaveLength(1);
    expect(sessionData.grades[0].score).toBe(18);

    // Reject lowering max marks below recorded score 18
    await expect(
      saveExamTotalMarks({
        actor,
        sessionId: liveSessionId,
        examId: examRes.exam.id,
        totalMarksInput: '15',
        store,
        dal,
      })
    ).rejects.toMatchObject({ status: 409, code: 'TOTAL_MARKS_BELOW_RECORDED_GRADE' });

    // Existing max marks & grade remain intact
    const afterRejection = await getSessionExamsAndGrades({
      actor,
      sessionId: liveSessionId,
      store,
      dal,
    });
    expect(afterRejection.exams.find((e) => e.id === examRes.exam.id)?.totalMarks).toBe(20);
    expect(afterRejection.grades[0].score).toBe(18);

    // Accept zero (0) score properly & explicit delete logs audit
    const zeroSave = await upsertLessonGrade({
      actor,
      sessionId: liveSessionId,
      examId: examRes.exam.id,
      studentIdOrCode: 'STD-1002',
      scoreInput: '0',
      source: 'card',
      store,
      dal,
    });
    expect(zeroSave.grade.score).toBe(0);

    const deleted = await deleteLessonGrade({
      actor,
      sessionId: liveSessionId,
      examId: examRes.exam.id,
      studentId: 'user-student-1002',
      source: 'card',
      store,
      dal,
    });
    expect(deleted.deleted).toBe(true);

    const audits = await store.queryCollection('lesson_grade_audits', [
      { fieldPath: 'examId', op: 'EQUAL', value: examRes.exam.id },
    ]);
    expect(audits.length).toBeGreaterThanOrEqual(5);
  });

  it('validates reviewed localStorage import entries on the server before writing to Firestore', async () => {
    store.seed('staff_memberships/uid-admin', {
      uid: 'uid-admin',
      displayName: 'أ. محمود التهامي',
      tenantId,
      role: 'CENTER_ADMIN',
      isActive: true,
    });
    const actor = await resolveAuthorizedStaffActor({
      centerSlug: 'al-maher',
      verifiedToken: { uid: 'uid-admin', emailVerified: true, rawClaims: {} },
      store,
      dal,
    });

    const summary = await importReviewedLocalStorageGrades({
      actor,
      store,
      dal,
      items: [
        // Valid matching item
        { sessionId: liveSessionId, studentId: 'user-student-1001', examId: `${liveSessionId}-exam`, score: 17.5 },
        // Rejected: student not enrolled in grp-math-sat
        { sessionId: liveSessionId, studentId: 'user-student-1003', examId: `${liveSessionId}-exam`, score: 15 },
        // Rejected: score > totalMarks (20)
        { sessionId: liveSessionId, studentId: 'user-student-1002', examId: `${liveSessionId}-exam`, score: 25 },
      ],
    });

    expect(summary.importedCount).toBe(1);
    expect(summary.rejectedCount).toBe(2);
    expect(summary.results[0].status).toBe('imported');
    expect(summary.results[1].status).toBe('rejected');
    expect(summary.results[2].status).toBe('rejected');
  });

  it('encodes/decodes Firestore REST v1 payloads and executes structured commits safely', async () => {
    const sample = {
      score: 17.5,
      zeroScore: 0,
      name: 'أحمد',
      active: true,
      tags: ['math', 20],
    };
    const encoded = encodeFirestoreFields(sample);
    const decoded = decodeFirestoreDocument({ fields: encoded, updateTime: '2026-11-11T12:00:00Z' });
    expect(decoded.data).toEqual(sample);

    const calls: Array<{ url: string; body: string }> = [];
    const client = new FirestoreRestClient({
      projectId: 'yalla-center',
      accessToken: 'token-123',
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? '') });
        return new Response(JSON.stringify({ writeResults: [{ updateTime: '2026-11-11T12:00:01Z' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch,
    });

    await client.commit([
      {
        type: 'set',
        documentPath: 'lesson_grades/exam1_std1',
        data: { score: 0, version: 1 },
        currentDocument: { exists: false },
      },
    ]);
    expect(calls[0].url).toContain('projects/yalla-center/databases/(default)/documents:commit');
    expect(calls[0].body).toContain('"exists":false');
  });

  it('locks down Firestore Rules against cross-tenant users, students, and anonymous writes', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(rules).toContain('request.auth != null');
    expect(rules).toContain('staff_memberships/$(request.auth.uid)');
    expect(rules).toContain('matchesTenant(');
    expect(rules).toContain('matchesBranch(');
    expect(rules).toContain("gradeId == request.resource.data.examId + '_' + request.resource.data.studentId");
    expect(rules).toContain('isValidScoreNumber');
    expect(rules).toContain('match /lesson_grade_audits/{auditId}');
    expect(rules).toContain('allow update, delete: if false;');
    expect(rules).toContain('allow write: if false;');
  });

  it('rejects unauthenticated or forged-header HTTP requests and persists end-to-end across two staff devices via REST route handlers', async () => {
    const { NextRequest } = await import('next/server');
    const route = await import('@/app/api/center/[centerSlug]/reception/lesson-scores/route');
    const { privateKey, publicJwk } = await generateTestRsaKeypair();
    const nowSec = Math.floor(Date.now() / 1000);

    // Build dynamic reception-demo session id matching getReceptionDataProvider()
    const { cairoClock } = await import('@/lib/attendance/reception');
    const todayDate = cairoClock().slice(0, 10);
    const activeDemoSessionId = `reception-demo-${todayDate}`;
    const activeDemoExamId = `${activeDemoSessionId}-exam`;

    // Forged x-user-role without Firebase Bearer token -> HTTP 401
    const unauthReq = new NextRequest(
      `http://localhost:3000/api/center/al-maher/reception/lesson-scores?sessionId=${activeDemoSessionId}`,
      { headers: { 'x-user-role': 'CENTER_ADMIN', 'x-tenant-slug': 'al-maher' } }
    );
    const unauthRes = await route.GET(unauthReq, { params: { centerSlug: 'al-maher' } });
    expect(unauthRes.status).toBe(401);

    // Mock Google JWKS + Cloud Firestore REST backend cleanly
    const mockFirestoreDocs = new Map<string, { fields: Record<string, unknown>; updateTime: string }>([
      [
        'staff_memberships/uid-device-1',
        {
          fields: encodeFirestoreFields({
            uid: 'uid-device-1',
            displayName: 'سارة (جهاز 1)',
            email: 'sara1@almaher.edu.eg',
            tenantId: 'tenant-maher-001',
            role: 'RECEPTIONIST',
            branchIds: ['branch-nasr-city'],
            isActive: true,
          }),
          updateTime: '2026-11-11T10:00:00Z',
        },
      ],
      [
        'staff_memberships/uid-device-2',
        {
          fields: encodeFirestoreFields({
            uid: 'uid-device-2',
            displayName: 'محمود (جهاز 2)',
            email: 'mahmoud2@almaher.edu.eg',
            tenantId: 'tenant-maher-001',
            role: 'CENTER_ADMIN',
            branchIds: [],
            isActive: true,
          }),
          updateTime: '2026-11-11T10:00:00Z',
        },
      ],
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
        });
      }
      if (url.includes('firestore.googleapis.com/v1/projects/yalla-center/databases/(default)/documents:commit')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          writes: Array<{ update?: { name: string; fields: Record<string, unknown> }; delete?: string }>;
        };
        for (const w of body.writes) {
          if (w.update) {
            const path = w.update.name.split('/documents/')[1];
            mockFirestoreDocs.set(path, {
              fields: w.update.fields,
              updateTime: new Date().toISOString(),
            });
          } else if (w.delete) {
            const path = w.delete.split('/documents/')[1];
            mockFirestoreDocs.delete(path);
          }
        }
        return new Response(JSON.stringify({ writeResults: [] }), { status: 200 });
      }
      if (url.includes(':runQuery')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          structuredQuery?: { from?: Array<{ collectionId: string }> };
        };
        const col = body.structuredQuery?.from?.[0]?.collectionId ?? '';
        const rows = Array.from(mockFirestoreDocs.entries())
          .filter(([path]) => path.startsWith(`${col}/`))
          .map(([path, doc]) => ({
            document: {
              name: `projects/yalla-center/databases/(default)/documents/${path}`,
              fields: doc.fields,
              updateTime: doc.updateTime,
            },
          }));
        return new Response(JSON.stringify(rows.length > 0 ? rows : [{ readTime: new Date().toISOString() }]), {
          status: 200,
        });
      }
      if (url.includes('firestore.googleapis.com/v1/projects/yalla-center/databases/(default)/documents/')) {
        const path = url.split('/documents/')[1].split('?')[0];
        const found = mockFirestoreDocs.get(path);
        if (!found) {
          return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', message: 'not found' } }), {
            status: 404,
          });
        }
        return new Response(
          JSON.stringify({
            name: `projects/yalla-center/databases/(default)/documents/${path}`,
            fields: found.fields,
            updateTime: found.updateTime,
          }),
          { status: 200 }
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const tokenDevice1 = await signJwt(privateKey, {
        aud: 'yalla-center',
        iss: 'https://securetoken.google.com/yalla-center',
        sub: 'uid-device-1',
        email: 'sara1@almaher.edu.eg',
        email_verified: true,
        iat: nowSec - 10,
        auth_time: nowSec - 10,
        exp: nowSec + 3600,
      });
      const tokenDevice2 = await signJwt(privateKey, {
        aud: 'yalla-center',
        iss: 'https://securetoken.google.com/yalla-center',
        sub: 'uid-device-2',
        email: 'mahmoud2@almaher.edu.eg',
        email_verified: true,
        iat: nowSec - 10,
        auth_time: nowSec - 10,
        exp: nowSec + 3600,
      });

      // Device 1 sets score 17 then updates to 18
      const save17 = await route.POST(
        new NextRequest('http://localhost:3000/api/center/al-maher/reception/lesson-scores', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenDevice1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeDemoSessionId,
            examId: activeDemoExamId,
            studentIdOrCode: 'STD-1001',
            score: 17,
            source: 'panel',
          }),
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(save17.status).toBe(200);

      const save18 = await route.POST(
        new NextRequest('http://localhost:3000/api/center/al-maher/reception/lesson-scores', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenDevice1}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeDemoSessionId,
            examId: activeDemoExamId,
            studentIdOrCode: 'STD-1001',
            score: 18,
            source: 'feed',
          }),
        }),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(save18.status).toBe(200);

      // Device 2 (different Firebase user in same center) loads from Firestore & sees 18 / 20
      const device2Get = await route.GET(
        new NextRequest(
          `http://localhost:3000/api/center/al-maher/reception/lesson-scores?sessionId=${activeDemoSessionId}`,
          { headers: { Authorization: `Bearer ${tokenDevice2}` } }
        ),
        { params: { centerSlug: 'al-maher' } }
      );
      expect(device2Get.status).toBe(200);
      const device2Payload = (await device2Get.json()) as {
        grades: Array<{ studentCode: string; score: number }>;
        audits: Array<{ previousScore: number | null; newScore: number | null }>;
      };
      expect(device2Payload.grades.find((g) => g.studentCode === 'STD-1001')?.score).toBe(18);
      expect(device2Payload.audits.some((a) => a.previousScore === 17 && a.newScore === 18)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
