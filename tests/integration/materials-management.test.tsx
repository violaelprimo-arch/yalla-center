import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import MaterialsPage from '@/app/center/[centerSlug]/materials/page';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { saveDemoMasterData } from '@/lib/dal/master-data-client';
import { readDemoMaterials, saveDemoMaterial } from '@/lib/materials/demo-storage';

const tenantId = 'tenant-maher-001';
const seedId = 'mat-kirchhoff-complete';

async function open() {
  const dal = new MockDataProvider();
  return render(<TenantProvider tenant={(await dal.getTenantById(tenantId))!}
    branches={await dal.getBranches(tenantId)} initialUsers={await dal.getUsers(tenantId)}><MaterialsPage /></TenantProvider>);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
});
afterEach(cleanup);

it('edits a seeded memo in a card and removes it from the tree, persisting both changes after reopening', async () => {
  const original = (await readDemoMaterials(tenantId)).find(item => item.id === seedId)!;
  const first = await open();
  fireEvent.click(await screen.findByRole('button', { name: `تعديل ${original.title}` }));
  const edit = within(screen.getByRole('dialog', { name: 'تعديل المذكرة' }));
  expect(edit.getByLabelText('عنوان المذكرة')).toHaveValue(original.title);
  expect(edit.getByLabelText('المادة الدراسية')).toHaveValue(original.subjectId);
  fireEvent.change(edit.getByLabelText('عنوان المذكرة'), { target: { value: 'مذكرة الاختبار بعد التعديل' } });
  fireEvent.change(edit.getByLabelText('نبذة عن المحتوى'), { target: { value: 'ملخص محدث' } });
  await act(async () => fireEvent.click(edit.getByRole('button', { name: 'حفظ المذكرة' })));
  await screen.findByText('تم تعديل المذكرة');
  expect((await readDemoMaterials(tenantId)).find(item => item.id === original.id)).toMatchObject({
    title: 'مذكرة الاختبار بعد التعديل', description: 'ملخص محدث', googleDriveFileId: original.googleDriveFileId,
    textContentIndexed: original.textContentIndexed, wordCount: original.wordCount, indexStatus: original.indexStatus,
  });
  first.unmount();

  const reopened = await open();
  await screen.findByRole('heading', { name: 'مذكرة الاختبار بعد التعديل' });
  fireEvent.click(screen.getByRole('button', { name: 'جدول' }));
  const row = screen.getByRole('row', { name: /مذكرة الاختبار بعد التعديل/ });
  expect(within(row).getByRole('button', { name: 'تعديل مذكرة الاختبار بعد التعديل' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'شجرة' }));
  fireEvent.click(screen.getByRole('button', { name: 'حذف مذكرة الاختبار بعد التعديل' }));
  const confirm = within(screen.getByRole('alertdialog'));
  expect(confirm.getByText(/الملف الأصلي يفضل محفوظ على Google Drive/)).toBeInTheDocument();
  await act(async () => fireEvent.click(confirm.getByRole('button', { name: 'تأكيد الحذف' })));
  await screen.findByText('تم حذف المذكرة من البنك');
  reopened.unmount();
  await open();
  expect(await screen.findAllByRole('button', { name: /^تعديل / })).toHaveLength(5);
  expect(screen.queryByText(original.title)).not.toBeInTheDocument();
  expect(screen.queryByText('مذكرة الاختبار بعد التعديل')).not.toBeInTheDocument();
});

it('uses the same stored memo state when deleting a linked subject', async () => {
  const { subjects } = await saveDemoMasterData(tenantId, {
    action: 'saveSubject', subject: { nameAr: 'مادة اختبار المذكرات', stage: 'secondary', grade: '3_sec' },
  });
  const subject = subjects.find(item => item.nameAr === 'مادة اختبار المذكرات')!;
  const [created] = await saveDemoMaterial(tenantId, 'user-admin-maher', {
    action: 'create', input: { title: 'مذكرة تتبع مادة', unitName: 'الوحدة', lessonName: 'الدرس',
      stage: subject.stage, grade: subject.grade, subjectId: subject.id, autoIndex: false },
  });
  await expect(saveDemoMasterData(tenantId, { action: 'deleteSubject', subjectId: subject.id })).rejects.toThrow('مذكرات');
  await saveDemoMaterial(tenantId, 'user-admin-maher', { action: 'delete', id: created.id, updatedAt: created.updatedAt });
  const saved = await saveDemoMasterData(tenantId, { action: 'deleteSubject', subjectId: subject.id });
  expect(saved.subjects.some(item => item.id === subject.id)).toBe(false);
  await waitFor(async () => expect(await readDemoMaterials(tenantId)).toHaveLength(6));
});
