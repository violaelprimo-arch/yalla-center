import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SessionsGroupsPage from '@/app/center/[centerSlug]/sessions/page';
import BranchesManagementPage from '@/app/center/[centerSlug]/branches-list/page';
import SubjectsManagementPage from '@/app/center/[centerSlug]/subjects/page';
import TeachersDirectoryPage from '@/app/center/[centerSlug]/teachers/page';
import { Sidebar } from '@/components/layout/sidebar';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { createCenterDataProvider, getDataProvider } from '@/lib/dal/factory';
import { readDemoTeacherProfiles } from '@/lib/teachers/client';
import { buildGroup } from '@/lib/timetable/group-schedule';
import { readMasterData } from '@/lib/dal/master-data';

vi.mock('next/navigation', () => ({ usePathname: () => '/center/al-maher/sessions' }));
vi.mock('@/lib/dal/factory', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/dal/factory')>();
  const { MockDataProvider } = await import('@/lib/dal/mock-data');
  const dal = new MockDataProvider({ archiveMaherGroups: true });
  return { ...actual, getDataProvider: vi.fn(() => dal) };
});

const tenantId = 'tenant-maher-001';
const groupKey = `yc-center-groups-v1:${tenantId}`;
const mainBranchId = 'branch-nasr-city';

async function open(page: React.ReactNode) {
  const dal = getDataProvider();
  const tenant = (await dal.getTenantById(tenantId))!;
  const branches = await dal.getBranches(tenantId);
  const users = await dal.getUsers(tenantId);
  return render(<TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
    <Sidebar />{page}
  </TenantProvider>);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
});

afterEach(cleanup);

it('omits default groups, teachers, branches and rooms and keeps real records saved by the previous version', async () => {
  const dal = createCenterDataProvider(false);
  const savedProvider = getDataProvider();
  vi.mocked(getDataProvider).mockReturnValue(dal);
  const previous = createCenterDataProvider(true);
  const catalog = await readMasterData(previous, tenantId);
  const customBranch = await previous.saveBranch(tenantId, { nameAr: 'فرع المستخدم' });
  const seededRoom = (await previous.getClassrooms(tenantId))[0];
  const customRoom = { ...seededRoom, id: 'room-saved', branchId: customBranch.id, nameAr: 'قاعة المستخدم' };
  localStorage.setItem(`yc-master-data-v1:${tenantId}`, JSON.stringify({ ...catalog, branches: [...catalog.branches, customBranch] }));
  localStorage.setItem(`yc-center-classrooms-v1:${tenantId}`, JSON.stringify([seededRoom, customRoom]));
  const teacher = { id: 'teacher-user-created', tenantId, fullName: 'معلم المستخدم', active: true, contracts: [] };
  localStorage.setItem(`yc-teachers-v1:${tenantId}`, JSON.stringify([teacher]));
  const seedGroup = (await previous.getGroups(tenantId))[0];
  const customGroup = { ...seedGroup, id: 'group-saved', branchId: customBranch.id, classroomId: customRoom.id,
    teacherId: teacher.id, teacherName: teacher.fullName, nameAr: 'مجموعة المستخدم', pricingModel: 'center',
    pricing: { model: 'center', teacherRate: 20, monthlyFee: 300 }, monthlyFee: 300, isActive: true };
  localStorage.setItem(groupKey, JSON.stringify([seedGroup, customGroup]));

  try {
    expect(await dal.getUsers(tenantId, { role: 'TEACHER' })).toEqual([]);
    expect(await dal.getBranches(tenantId)).toEqual([]);
    expect(await dal.getClassrooms(tenantId)).toEqual([]);
    expect(await dal.getGroups(tenantId)).toEqual([]);
    const first = await open(<SessionsGroupsPage />);
    await screen.findByRole('heading', { name: customGroup.nameAr });
    expect(screen.queryByRole('heading', { name: seedGroup.nameAr })).not.toBeInTheDocument();
    expect(await dal.getGroups(tenantId)).toEqual([expect.objectContaining({ id: customGroup.id })]);
    first.unmount();

    const withTeachers = await open(<TeachersDirectoryPage />);
    const row = within(await screen.findByRole('row', { name: new RegExp(teacher.fullName) }));
    fireEvent.click(row.getByRole('button', { name: /الحسابات والمجموعات/ }));
    await screen.findByRole('heading', { name: customGroup.nameAr });
    expect(screen.getByText('20 ج.م / طالب')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إضافة مجموعة' })).not.toBeInTheDocument();
    withTeachers.unmount();

    await open(<BranchesManagementPage />);
    await screen.findByRole('heading', { name: customBranch.nameAr });
    await screen.findByText(customRoom.nameAr);
    expect(await dal.getClassrooms(tenantId)).toEqual([customRoom]);
    expect(await dal.getBranches(tenantId)).toEqual([customBranch]);
    expect(readDemoTeacherProfiles(tenantId)).toEqual([teacher]);
  } finally {
    vi.mocked(getDataProvider).mockReturnValue(savedProvider);
  }
});

it('keeps registered groups from the old storage format and applies add, edit and delete across reloads', async () => {
  const dal = getDataProvider();
  const previous = buildGroup(tenantId, {
    id: 'old-demo-group', version: 0, nameAr: 'مجموعة من النسخة السابقة',
    branchId: mainBranchId, stageId: 'secondary', gradeId: '3_sec', subjectId: 'sub-math-3sec',
    teacherId: 'user-teacher-math', pricing: { model: 'center', monthlyFee: 300, teacherRate: 20 },
    weeklySlots: [{ id: 'sat', scheduleDay: 6, classroomId: 'room-101', startTime: '14:00', endTime: '15:00' }],
  }, {
    ...await readMasterData(dal, tenantId), groups: [], classrooms: await dal.getClassrooms(tenantId),
    teachers: await dal.getUsers(tenantId, { role: 'TEACHER' }),
  });
  const { weeklySlots: _slots, pricing: _pricing, ...legacy } = previous;
  localStorage.setItem(groupKey, JSON.stringify([{ ...legacy, isActive: false }]));
  const initial = await open(<SessionsGroupsPage />);
  await screen.findByRole('heading', { name: previous.nameAr });
  expect(screen.getByText('غير نشطة')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'الفروع والقاعات' })).not.toBeInTheDocument();
  expect(await dal.getGroupById(tenantId, previous.id)).not.toHaveProperty('archivedAt');
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مجموعة' }));
  const add = within(screen.getByRole('dialog', { name: 'إضافة مجموعة' }));
  fireEvent.change(add.getByLabelText('اسم المجموعة'), { target: { value: 'مجموعة جديدة' } });
  fireEvent.change(add.getByLabelText('المرحلة'), { target: { value: 'secondary' } });
  fireEvent.change(add.getByLabelText('الصف الدراسي'), { target: { value: '3_sec' } });
  fireEvent.change(add.getByLabelText('المادة'), { target: { value: 'sub-math-3sec' } });
  fireEvent.change(add.getByLabelText('المعلم'), { target: { value: 'user-teacher-math' } });
  fireEvent.change(add.getByLabelText('القاعة'), { target: { value: 'room-101' } });
  fireEvent.change(add.getByLabelText('مصروفات الطالب الشهرية (ج.م)'), { target: { value: '300' } });
  fireEvent.change(add.getByLabelText('سعر الطالب للمعلم في الشهر (ج.م)'), { target: { value: '20' } });
  fireEvent.click(add.getByRole('button', { name: 'حفظ المجموعة' }));
  await screen.findByRole('heading', { name: 'مجموعة جديدة' });

  initial.unmount();
  const reloaded = await open(<SessionsGroupsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل مجموعة جديدة' }));
  const edit = within(screen.getByRole('dialog', { name: 'تعديل المجموعة' }));
  fireEvent.change(edit.getByLabelText('اسم المجموعة'), { target: { value: 'مجموعة معدلة' } });
  fireEvent.click(edit.getByRole('button', { name: 'حفظ المجموعة' }));
  await screen.findByRole('heading', { name: 'مجموعة معدلة' });
  fireEvent.click(screen.getByRole('button', { name: 'حذف مجموعة معدلة' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'تأكيد الحذف' }));
  await waitFor(() => expect(screen.queryByText('مجموعة معدلة', { exact: true })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: `حذف ${previous.nameAr}` }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'تأكيد الحذف' }));
  await screen.findByText('مفيش مجموعات مسجلة.');
  reloaded.unmount();
  await open(<SessionsGroupsPage />);
  await screen.findByText('مفيش مجموعات مسجلة.');
  fireEvent.click(screen.getByRole('button', { name: 'عرض الجدول' }));
  expect(screen.getAllByText('لا توجد حصص')).toHaveLength(7);
});

it('shows linked registered groups for a subject and reports materials once only archived groups remain', async () => {
  const dal = getDataProvider();
  const archivedGroup = (await dal.getGroupById(tenantId, 'grp-math-sat'))!;
  const { archivedAt: _archivedAt, ...record } = archivedGroup;
  localStorage.setItem(groupKey, JSON.stringify({ groups: [{ ...record, id: 'registered-math-group', nameAr: 'مجموعة الرياضيات المسجلة' }] }));

  const initial = await open(<SubjectsManagementPage />);
  const math = await screen.findByRole('row', { name: /الرياضيات التطبيقية/ });
  await waitFor(() => expect(within(math).getByTitle('حذف المادة')).toBeEnabled());
  fireEvent.click(within(math).getByTitle('حذف المادة'));
  expect(await screen.findByText('مجموعة الرياضيات المسجلة')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'إدارة المجموعات المرتبطة' })).toHaveAttribute('href', '/center/al-maher/sessions');
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحذف' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('مجموعات مرتبطة بها');
  initial.unmount();

  localStorage.removeItem(groupKey);
  await open(<SubjectsManagementPage />);
  const reloaded = await screen.findByRole('row', { name: /الرياضيات التطبيقية/ });
  await waitFor(() => expect(within(reloaded).getByTitle('حذف المادة')).toBeEnabled());
  fireEvent.click(within(reloaded).getByTitle('حذف المادة'));
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحذف' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('مذكرات ومواد تعليمية مرتبطة بها');
  expect(screen.queryByRole('link', { name: 'إدارة المجموعات المرتبطة' })).not.toBeInTheDocument();
});

it('manages rooms inside the selected branch and allows branch deletion once its rooms are removed', async () => {
  const initial = await open(<BranchesManagementPage />);
  const addBranch = await screen.findByRole('button', { name: 'إضافة فرع جديد' });
  await waitFor(() => expect(addBranch).toBeEnabled());
  fireEvent.click(addBranch);
  fireEvent.change(screen.getByPlaceholderText('مثال: فرع مدينة نصر'), { target: { value: 'فرع التجربة' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ الفرع' }));
  const heading = await screen.findByRole('heading', { name: 'فرع التجربة' });
  const branch = heading.closest<HTMLElement>('[id]')!;
  const card = within(branch);
  fireEvent.click(card.getByRole('button', { name: 'إضافة قاعة' }));
  const add = within(screen.getByRole('dialog', { name: 'إضافة قاعة' }));
  fireEvent.change(add.getByLabelText('اسم القاعة'), { target: { value: 'قاعة التجربة' } });
  fireEvent.change(add.getByLabelText('سعة القاعة'), { target: { value: '42' } });
  fireEvent.click(add.getByRole('button', { name: 'حفظ القاعة' }));
  fireEvent.click(await card.findByRole('button', { name: 'تعديل القاعة قاعة التجربة' }));
  const edit = within(screen.getByRole('dialog', { name: 'تعديل القاعة' }));
  expect(edit.getByLabelText('سعة القاعة')).toHaveValue(42);
  fireEvent.change(edit.getByLabelText('اسم القاعة'), { target: { value: 'قاعة معدلة' } });
  fireEvent.click(edit.getByRole('button', { name: 'حفظ القاعة' }));
  await card.findByText('قاعة معدلة');
  initial.unmount();

  await open(<BranchesManagementPage />);
  const reloaded = within((await screen.findByRole('heading', { name: 'فرع التجربة' })).closest<HTMLElement>('[id]')!);
  fireEvent.click(await reloaded.findByRole('button', { name: 'حذف القاعة قاعة معدلة' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'تأكيد الحذف' }));
  await reloaded.findByText('مفيش قاعات مسجلة للفرع.');
  fireEvent.click(reloaded.getByTitle('حذف الفرع'));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'تأكيد الحذف' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'فرع التجربة' })).not.toBeInTheDocument());
});
