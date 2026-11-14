import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TeachersDirectoryPage from '@/app/center/[centerSlug]/teachers/page';
import SessionsGroupsPage from '@/app/center/[centerSlug]/sessions/page';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { getDataProvider } from '@/lib/dal/factory';
import { readDemoTeacherProfiles } from '@/lib/teachers/client';

const tenantId = 'tenant-maher-001';
const teacherName = 'معلم لتجربة التسجيل';

vi.mock('next/navigation', () => ({ usePathname: () => '/center/al-maher/sessions' }));

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('adds a teacher with different grade contracts and saved permissions, then edits and archives the teacher', async () => {
  const dal = getDataProvider();
  const tenant = (await dal.getTenantBySlug('al-maher'))!;
  const branches = await dal.getBranches(tenantId);
  const users = await dal.getUsers(tenantId);
  const page = <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
    <TeachersDirectoryPage />
  </TenantProvider>;

  const first = render(page);
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة معلم جديد' }));
  let form = within(screen.getByRole('dialog'));
  fireEvent.click(form.getByRole('button', { name: 'التالي' }));
  expect(form.getByRole('alert')).toHaveTextContent('اسم المعلم مطلوب');

  fireEvent.change(form.getByLabelText(/اسم المعلم/), { target: { value: teacherName } });
  fireEvent.change(form.getByLabelText(/رقم الهاتف \(1\)/), { target: { value: '٠١٠ ١٢٣٤ ٥٦٧٨' } });
  fireEvent.click(form.getByRole('button', { name: 'إضافة مرحلة أو صف' }));
  fireEvent.change(form.getByLabelText('المرحلة أو الصف'), { target: { value: '1_sec' } });
  fireEvent.change(form.getByLabelText('مصروفات الطالب الشهرية (ج.م)'), { target: { value: '300' } });
  fireEvent.change(form.getByLabelText('سعر الطالب للمعلم في الشهر (ج.م)'), { target: { value: '20' } });
  fireEvent.click(form.getByRole('button', { name: 'إضافة مرحلة أو صف' }));
  fireEvent.change(form.getAllByLabelText('المرحلة أو الصف')[1], { target: { value: '2_sec' } });
  fireEvent.change(form.getAllByLabelText('طريقة الحساب')[1], { target: { value: 'private' } });
  fireEvent.change(form.getAllByLabelText('مصروفات الطالب الشهرية (ج.م)')[1], { target: { value: '300' } });
  fireEvent.change(form.getByLabelText('نسبة المعلم (%)'), { target: { value: '70' } });
  fireEvent.click(form.getByRole('button', { name: 'إضافة مرحلة أو صف' }));
  fireEvent.change(form.getAllByLabelText('المرحلة أو الصف')[2], { target: { value: 'secondary' } });
  fireEvent.change(form.getAllByLabelText('طريقة الحساب')[2], { target: { value: 'per_session' } });
  fireEvent.change(form.getByLabelText('نصيب المعلم لكل طالب في الحصة (ج.م)'), { target: { value: '10' } });
  fireEvent.change(form.getByLabelText('نصيب السنتر لكل طالب في الحصة (ج.م)'), { target: { value: '5' } });
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
    phone: '01012345678', phone2: '',
    subjectIds: ['sub-math-3sec'],
    contracts: [
      { level: '1_sec', model: 'center', monthlyFee: 300, teacherRate: 20 },
      { level: '2_sec', model: 'private', monthlyFee: 300, teacherPercentage: 70 },
      { level: 'secondary', model: 'per_session', teacherFee: 10, centerFee: 5 },
    ],
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

it('fills group pricing from the saved grade agreement and persists the selected terms on the group', async () => {
  const dal = getDataProvider();
  const tenant = (await dal.getTenantBySlug('al-maher'))!;
  const teacher = { id: 'teacher-test', tenantId, fullName: teacherName, phone: '01000000000', active: true,
    contracts: [
      { level: 'secondary', model: 'center', monthlyFee: 500, teacherRate: 40 },
      { level: '3_sec', model: 'private', monthlyFee: 300, teacherPercentage: 70 },
    ] };
  localStorage.setItem(`yc-teachers-v1:${tenantId}`, JSON.stringify([teacher]));
  const page = <TenantProvider tenant={tenant} branches={await dal.getBranches(tenantId)} initialUsers={await dal.getUsers(tenantId)}>
    <SessionsGroupsPage />
  </TenantProvider>;
  const first = render(page);
  const addGroup = await screen.findByRole('button', { name: 'إضافة مجموعة' });
  await waitFor(() => expect(addGroup).toBeEnabled());
  fireEvent.click(addGroup);
  let form = within(screen.getByRole('dialog'));
  await form.findByRole('option', { name: teacherName });
  fireEvent.change(form.getByLabelText('اسم المجموعة'), { target: { value: 'مجموعة تعاقد المعلم' } });
  fireEvent.change(form.getByLabelText('المرحلة'), { target: { value: 'secondary' } });
  fireEvent.change(form.getByLabelText('الصف الدراسي'), { target: { value: '3_sec' } });
  fireEvent.change(form.getByLabelText('المادة'), { target: { value: 'sub-math-3sec' } });
  fireEvent.change(form.getByLabelText('المعلم'), { target: { value: teacher.id } });
  fireEvent.change(form.getByLabelText('وقت البداية'), { target: { value: '09:00' } });
  fireEvent.change(form.getByLabelText('وقت النهاية'), { target: { value: '10:00' } });
  fireEvent.change(form.getByLabelText('القاعة'), { target: { value: 'room-101' } });
  expect(form.getByLabelText('نظام المجموعة')).toHaveValue('private');
  expect(form.getByLabelText('مصروفات الطالب الشهرية (ج.م)')).toHaveValue(300);
  expect(form.getByLabelText('نسبة المعلم (%)')).toHaveValue(70);
  fireEvent.change(form.getByLabelText('نسبة المعلم (%)'), { target: { value: '65' } });
  fireEvent.click(form.getByRole('button', { name: 'حفظ المجموعة' }));
  await screen.findByText('مجموعة تعاقد المعلم', { exact: true });
  first.unmount();

  render(page);
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل مجموعة تعاقد المعلم' }));
  form = within(screen.getByRole('dialog'));
  expect(form.getByLabelText('نسبة المعلم (%)')).toHaveValue(65);
  fireEvent.click(form.getByRole('button', { name: 'تطبيق تعاقد المعلم' }));
  expect(form.getByLabelText('نسبة المعلم (%)')).toHaveValue(70);
});
