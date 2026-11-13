import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/center/[centerSlug]/master-data/route';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { createServerFirestoreStore, verifyFirebaseIdToken } from '@/lib/firebase/server';
import { InMemoryTransactionalFirestoreStore } from '../helpers/in-memory-firestore';

vi.mock('@/lib/dal/factory', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/dal/factory')>(),
  getDataProvider: () => new MockDataProvider(),
}));

vi.mock('@/lib/firebase/server', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/firebase/server')>(),
  verifyFirebaseIdToken: vi.fn(async (token: string) => ({ uid: token })),
  createServerFirestoreStore: vi.fn(),
}));

describe('Master Data API', () => {
  const tenantId = 'tenant-maher-001';
  const params = { centerSlug: 'al-maher' };
  const url = 'http://localhost:3000/api/center/al-maher/master-data';
  let store: InMemoryTransactionalFirestoreStore;

  const request = (token: string | null, body?: object) => new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  const write = (body: object) => POST(request('admin', body), { params });
  const read = () => GET(request('admin'), { params });

  beforeEach(() => {
    store = new InMemoryTransactionalFirestoreStore();
    store.seed('staff_memberships/admin', { tenantId, role: 'CENTER_ADMIN', isActive: true });
    store.seed('staff_memberships/staff', { tenantId, role: 'RECEPTIONIST', isActive: true });
    store.seed('staff_memberships/other-admin', { tenantId: 'tenant-rowad-002', role: 'CENTER_ADMIN', isActive: true });
    vi.mocked(createServerFirestoreStore).mockResolvedValue(store);
    vi.mocked(verifyFirebaseIdToken).mockClear();
  });

  it('requires a verified staff account and restricts edits to the correct center administration', async () => {
    expect((await GET(request(null), { params })).status).toBe(401);
    const change = { action: 'saveStage', stage: { nameAr: 'مرحلة جديدة' } };
    expect((await POST(request(null, change), { params })).status).toBe(401);
    expect((await POST(request('staff', change), { params })).status).toBe(403);
    expect((await POST(request('other-admin', change), { params })).status).toBe(403);
    const response = await GET(request('staff'), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, canEdit: false });
    expect(verifyFirebaseIdToken).toHaveBeenCalledWith('staff');
    expect(store.docs.size).toBe(3);
  });

  it('returns 404 for an unknown center', async () => {
    const response = await GET(request('admin'), { params: { centerSlug: 'nonexistent-center' } });
    expect(response.status).toBe(404);
  });

  it('adds and edits catalog records across requests with fresh data providers', async () => {
    const stage = (await (await write({ action: 'saveStage', stage: { nameAr: 'مرحلة جديدة', order: 9 } })).json()).stage;
    const grade = (await (await write({
      action: 'saveGrade', grade: { stageId: stage.id, nameAr: 'صف جديد' },
    })).json()).grade;
    const subject = (await (await write({
      action: 'saveSubject', subject: { stage: stage.id, grade: grade.id, nameAr: 'مادة جديدة' },
    })).json()).subject;
    const branch = (await (await write({
      action: 'saveBranch', branch: { nameAr: 'فرع جديد', address: 'عنوان' },
    })).json()).branch;

    expect((await write({
      action: 'saveStage', stage: { id: stage.id, nameAr: 'مرحلة معدلة' },
    })).status).toBe(200);
    expect((await write({
      action: 'saveSubject', subject: { ...subject, nameAr: 'مادة معدلة' },
    })).status).toBe(200);
    expect((await write({
      action: 'saveBranch', branch: { id: branch.id, nameAr: 'فرع معدل', address: '' },
    })).status).toBe(200);

    const { data } = await (await read()).json();
    expect(data.stages).toContainEqual(expect.objectContaining({
      id: stage.id, nameAr: 'مرحلة معدلة', grades: [expect.objectContaining({ id: grade.id })],
    }));
    expect(data.subjects).toContainEqual(expect.objectContaining({ id: subject.id, nameAr: 'مادة معدلة' }));
    expect(data.branches).toContainEqual(expect.objectContaining({ id: branch.id, nameAr: 'فرع معدل', address: '' }));

    expect((await write({ action: 'deleteGrade', gradeId: grade.id })).status).toBe(400);
    expect((await write({ action: 'deleteSubject', subjectId: subject.id })).status).toBe(200);
    expect((await write({ action: 'deleteGrade', gradeId: grade.id })).status).toBe(200);
    expect((await write({ action: 'deleteBranch', branchId: branch.id })).status).toBe(200);
    const removed = (await (await read()).json()).data;
    expect(removed.stages.find((item: { id: string }) => item.id === stage.id).grades).toEqual([]);
    expect(removed.branches).not.toContainEqual(expect.objectContaining({ id: branch.id }));
  });

  it('rejects duplicate names in the same grade and unrelated stage/grade combinations', async () => {
    const subject = { nameAr: 'اللغة الفرنسية الخاصة', stage: 'secondary', grade: '1_sec' };
    expect((await write({ action: 'saveSubject', subject })).status).toBe(200);
    expect((await write({ action: 'saveSubject', subject: { ...subject, grade: '2_sec' } })).status).toBe(200);
    expect((await write({ action: 'saveSubject', subject })).status).toBe(400);
    expect((await write({ action: 'saveSubject', subject: { ...subject, stage: 'primary' } })).status).toBe(400);
  });

  it('does not acknowledge a write or replace stored data if Firestore is unavailable', async () => {
    const commit = vi.spyOn(store, 'commit').mockRejectedValueOnce(new Error('connection failed'));
    const failed = await write({ action: 'saveBranch', branch: { nameAr: 'فرع لم يُحفظ' } });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ success: false });
    expect(commit).toHaveBeenCalledTimes(1);
    const { data } = await (await read()).json();
    expect(data.branches).not.toContainEqual(expect.objectContaining({ nameAr: 'فرع لم يُحفظ' }));
    vi.spyOn(store, 'queryCollection').mockRejectedValueOnce(new Error('connection failed'));
    expect((await read()).status).toBe(503);
  });
});
