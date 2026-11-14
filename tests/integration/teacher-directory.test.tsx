import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TeachersDirectoryPage from '@/app/center/[centerSlug]/teachers/page';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { getDataProvider } from '@/lib/dal/factory';
import { readDemoTeacherProfiles } from '@/lib/teachers/client';

const tenantId = 'tenant-maher-001';
const teacherName = 'معلم لتجربة التسجيل';

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('adds a teacher with saved permissions and subjects, then edits and archives the teacher', async () => {
  const dal = getDataProvider();
  const tenant = (await dal.getTenantBySlug('al-maher'))!;
  const branches = await dal.getBranches(tenantId);
  const users = await dal.getUsers(tenantId);
  const page = (
    <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
      <TeachersDirectoryPage />
    </TenantProvider>
  );

  const first = render(page);
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة معلم جديد' }));
  let form = within(screen.getByRole('dialog'));
  fireEvent.click(form.getByRole('button', { name: 'التالي' }));
  expect(form.getByRole('alert')).toHaveTextContent('اسم المعلم مطلوب');

  fireEvent.change(form.getByLabelText(/اسم المعلم/), { target: { value: teacherName } });
  fireEvent.change(form.getByLabelText(/رقم الهاتف \(1\)/), { target: { value: '٠١٠ ١٢٣٤ ٥٦٧٨' } });
  fireEvent.click(form.getByRole('checkbox', { name: /الرياضيات التطبيقية/ }));
  fireEvent.click(form.getByRole('radio', { name: 'حساب Google' }));
  fireEvent.change(form.getByLabelText('بريد حساب Google للمعلم'), { target: { value: 'teacher-test@example.com' } });
  fireEvent.click(form.getByRole('button', { name: 'التالي' }));

  expect(form.getByRole('checkbox', { name: 'الاطلاع على بيانات الطلاب' })).toBeDisabled();
  fireEvent.click(form.getByRole('checkbox', { name: 'الاطلاع على الطلاب' }));
  fireEvent.click(form.getByRole('checkbox', { name: 'الاطلاع على بيانات الطلاب' }));
  fireEvent.click(form.getByRole('checkbox', { name: 'الطلاب' }));
  fireEvent.click(form.getByRole('button', { name: 'حفظ المعلم' }));

  await screen.findByText('تمت إضافة المعلم');
  const [saved] = readDemoTeacherProfiles(tenantId);
  expect(saved).toMatchObject({
    phone: '01012345678',
    phone2: '',
    subjectIds: ['sub-math-3sec'],
    permissions: ['viewStudents', 'viewStudentDetails'],
  });
  expect(saved.tabs).not.toContain('students');

  first.unmount();
  render(page);
  const row = within(await screen.findByRole('row', { name: new RegExp(teacherName) }));
  fireEvent.click(row.getByRole('button', { name: 'تعديل' }));
  form = within(screen.getByRole('dialog'));
  fireEvent.change(form.getByLabelText(/رقم الهاتف \(2\)/), { target: { value: '01123456789' } });
  fireEvent.click(form.getByRole('button', { name: 'التالي' }));
  expect(form.getByRole('checkbox', { name: 'الاطلاع على بيانات الطلاب' })).toBeChecked();
  expect(form.getByRole('checkbox', { name: 'الطلاب' })).not.toBeChecked();
  fireEvent.click(form.getByRole('button', { name: 'حفظ المعلم' }));
  await row.findByText('01123456789');

  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(row.getByRole('button', { name: 'حذف' }));
  await waitFor(() => expect(screen.queryByText(teacherName)).not.toBeInTheDocument());
  expect(readDemoTeacherProfiles(tenantId)[0]).toMatchObject({ active: false, version: 3 });
});
