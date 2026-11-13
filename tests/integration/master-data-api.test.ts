import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/center/[centerSlug]/master-data/route';
import { getDataProvider } from '@/lib/dal/factory';

describe('Master Data API Route (/api/center/[centerSlug]/master-data)', () => {
  const centerSlug = 'al-maher';

  beforeEach(() => {
    // Reset data provider instance if needed
  });

  it('GET returns stages, subjects, and branches for active center', async () => {
    const req = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`);
    const res = await GET(req, { params: Promise.resolve({ centerSlug }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.stages)).toBe(true);
    expect(Array.isArray(json.data.subjects)).toBe(true);
    expect(Array.isArray(json.data.branches)).toBe(true);
    expect(json.data.stages.length).toBeGreaterThan(0);
    expect(json.data.branches.length).toBeGreaterThan(0);
  });

  it('GET returns 404 for unknown center slug', async () => {
    const req = new NextRequest(`http://localhost:3000/api/center/nonexistent-center/master-data`);
    const res = await GET(req, { params: Promise.resolve({ centerSlug: 'nonexistent-center' }) });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('POST saveStage creates a new stage and returns it', async () => {
    const uniqueName = `مرحلة تجريبية ${Date.now()}`;
    const req = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveStage',
        stage: {
          nameAr: uniqueName,
          order: 99,
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ centerSlug }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.stage.nameAr).toBe(uniqueName);
    expect(json.stage.id).toBeDefined();
  });

  it('POST saveGrade creates a new grade under an existing stage', async () => {
    const uniqueGradeName = `صف تجريبي ${Date.now()}`;
    const req = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveGrade',
        grade: {
          stageId: 'primary',
          nameAr: uniqueGradeName,
          order: 10,
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ centerSlug }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.grade.nameAr).toBe(uniqueGradeName);
    expect(json.grade.stageId).toBe('primary');
  });

  it('POST saveSubject allows same subject name in different grades, but rejects duplicate in same grade', async () => {
    const subjectName = `اللغة الفرنسية الخاصة ${Date.now()}`;

    // 1. Create in 1_sec
    const req1 = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSubject',
        subject: {
          nameAr: subjectName,
          code: 'FR-1',
          stage: 'secondary',
          grade: '1_sec',
        },
      }),
    });

    const res1 = await POST(req1, { params: Promise.resolve({ centerSlug }) });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);

    // 2. Create same name in 2_sec -> MUST SUCCEED
    const req2 = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSubject',
        subject: {
          nameAr: subjectName,
          code: 'FR-2',
          stage: 'secondary',
          grade: '2_sec',
        },
      }),
    });

    const res2 = await POST(req2, { params: Promise.resolve({ centerSlug }) });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.subject.id).not.toBe(json1.subject.id);

    // 3. Create same name again in 1_sec -> MUST FAIL with 400
    const req3 = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSubject',
        subject: {
          nameAr: subjectName,
          stage: 'secondary',
          grade: '1_sec',
        },
      }),
    });

    const res3 = await POST(req3, { params: Promise.resolve({ centerSlug }) });
    expect(res3.status).toBe(400);
    const json3 = await res3.json();
    expect(json3.success).toBe(false);
    expect(json3.error).toContain('يوجد مادة بنفس الاسم');
  });

  it('POST saveBranch and deleteBranch work as expected', async () => {
    const branchName = `فرع الشروق ${Date.now()}`;
    const reqCreate = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveBranch',
        branch: {
          nameAr: branchName,
          address: 'مدخل الشروق 1',
          phone: '01055554444',
          isActive: true,
        },
      }),
    });

    const resCreate = await POST(reqCreate, { params: Promise.resolve({ centerSlug }) });
    expect(resCreate.status).toBe(200);
    const jsonCreate = await resCreate.json();
    expect(jsonCreate.success).toBe(true);
    const branchId = jsonCreate.branch.id;

    // Delete the new empty branch
    const reqDelete = new NextRequest(`http://localhost:3000/api/center/${centerSlug}/master-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteBranch',
        branchId,
      }),
    });

    const resDelete = await POST(reqDelete, { params: Promise.resolve({ centerSlug }) });
    expect(resDelete.status).toBe(200);
    const jsonDelete = await resDelete.json();
    expect(jsonDelete.success).toBe(true);
  });
});
