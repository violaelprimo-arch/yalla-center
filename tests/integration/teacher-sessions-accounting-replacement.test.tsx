import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TeachersDirectoryPage from '@/app/center/[centerSlug]/teachers/page';
import SessionsGroupsPage from '@/app/center/[centerSlug]/sessions/page';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { getDataProvider } from '@/lib/dal/factory';

const tenantId = 'tenant-maher-001';

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Yalla Center — Complete Replacement of Teacher Accounting with Sessions & Groups Accounting', () => {
  it('1. Directory table displays teacher groups and pricing badges directly from groups', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenantId);
    const users = await dal.getUsers(tenantId);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <TeachersDirectoryPage />
      </TenantProvider>
    );

    // Verify column header is "مجموعات ونظام حساب المعلم"
    expect(await screen.findByText('مجموعات ونظام حساب المعلم')).toBeInTheDocument();

    // Verify row for math teacher displays group with pricing model badge
    const teacherRow = within(await screen.findByRole('row', { name: /أحمد محمد الشناوي/ }));
    expect(teacherRow.getByText(/مجموعة العباقرة/)).toBeInTheDocument();
    expect(teacherRow.getByText(/متوسط/)).toBeInTheDocument();
    expect(teacherRow.getByRole('button', { name: /الحسابات والمجموعات/ })).toBeInTheDocument();
  });

  it('2. Clicking "الحسابات والمجموعات" opens the exact same Sessions & Groups accounting view filtered to the teacher', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenantId);
    const users = await dal.getUsers(tenantId);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <TeachersDirectoryPage />
      </TenantProvider>
    );

    const teacherRow = within(await screen.findByRole('row', { name: /أحمد محمد الشناوي/ }));
    fireEvent.click(teacherRow.getByRole('button', { name: /الحسابات والمجموعات/ }));

    // Verify switched to accounting view
    expect(await screen.findByText('نظام حسابات الحصص والمجموعات للمعلم')).toBeInTheDocument();

    // Verify toggle between timetable and groups list view exists
    expect(screen.getByRole('button', { name: /عرض الجدول/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /قائمة المجموعات/ })).toBeInTheDocument();

    // Verify the pricing model card matches the Sessions & Groups accounting system
    expect((await screen.findAllByText('نظام المتوسط')).length).toBeGreaterThan(0);
    expect(screen.getByText(/المرتب = سعر الطالب للمدرس × متوسط عدد الطلاب الحاضرين/)).toBeInTheDocument();

    // Verify export buttons exist
    expect(screen.getByRole('button', { name: /تصدير إكسيل/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /طباعة \/ PDF/ })).toBeInTheDocument();

    // Verify group CRUD is NOT duplicated in teachers affairs (link to sessions instead)
    expect(screen.queryByRole('button', { name: 'إضافة مجموعة' })).not.toBeInTheDocument();
    expect(screen.getByText(/إدارة وإضافة المجموعات في تبويب الحصص والمجموعات/)).toBeInTheDocument();
  });

  it('3. Timetable view displays the weekly slots with classroom allocations and pricing badges', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenantId);
    const users = await dal.getUsers(tenantId);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <TeachersDirectoryPage />
      </TenantProvider>
    );

    // Open accounting tab directly
    fireEvent.click(await screen.findByRole('button', { name: 'الحسابات والمستحقات' }));

    // Switch to Timetable view
    const timetableBtn = await screen.findByRole('button', { name: /عرض الجدول/ });
    fireEvent.click(timetableBtn);

    // Verify days of the week headers appear
    expect(screen.getAllByText('السبت').length).toBeGreaterThan(0);
    expect(screen.getAllByText('الثلاثاء').length).toBeGreaterThan(0);

    // Verify session badge
    expect(screen.getAllByText('متوسط').length).toBeGreaterThan(0);
  });

  it('4. Sessions & Groups page and Teachers page share the exact same underlying group records and pricing rules', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenantId);
    const users = await dal.getUsers(tenantId);

    // Render Sessions page
    const { unmount } = render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <SessionsGroupsPage />
      </TenantProvider>
    );

    expect(await screen.findByText('الحصص والمجموعات الميدانية')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة مجموعة' })).toBeInTheDocument();
    unmount();

    // Render Teachers page
    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <TeachersDirectoryPage />
      </TenantProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'الحسابات والمستحقات' }));
    // Verify math group is present in both
    expect(await screen.findByText(/مجموعة العباقرة/)).toBeInTheDocument();
    expect(screen.getByText('20 ج.م / طالب')).toBeInTheDocument();
  });
});
