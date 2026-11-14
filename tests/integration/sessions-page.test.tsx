import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SessionsGroupsPage from '@/app/center/[centerSlug]/sessions/page';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { getDataProvider } from '@/lib/dal/factory';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/center/al-maher/sessions',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe('Sessions & Groups Management Page Integration', () => {
  let tenant: any;
  let branches: any[];
  let users: any[];

  beforeEach(async () => {
    const dal = getDataProvider();
    tenant = (await dal.getTenantBySlug('al-maher'))!;
    branches = await dal.getBranches(tenant.id);
    users = await dal.getUsers(tenant.id);
  });

  it('renders page header, timetable view, and action buttons', async () => {
    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <SessionsGroupsPage />
      </TenantProvider>
    );

    expect(screen.getByText('الحصص والمجموعات الميدانية')).toBeInTheDocument();
    expect(screen.getByText('عرض الجدول')).toBeInTheDocument();
    expect(screen.getByText(/قائمة المجموعات/)).toBeInTheDocument();
    expect(screen.getByText('تصدير إكسيل')).toBeInTheDocument();
    expect(screen.getByText('طباعة / PDF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إضافة مجموعة/i })).toBeInTheDocument();

    // Verify timetable days are displayed
    await waitFor(() => {
      expect(screen.getByText('السبت')).toBeInTheDocument();
      expect(screen.getByText('الأحد')).toBeInTheDocument();
      expect(screen.getByText('الثلاثاء')).toBeInTheDocument();
    });
  });

  it('toggles between Timetable View and Groups List View', async () => {
    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <SessionsGroupsPage />
      </TenantProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('جاري تحميل بيانات المجموعات وجدول الحصص...')).not.toBeInTheDocument();
    });

    // Switch to Groups list
    const groupsTabButton = screen.getByRole('button', { name: /قائمة المجموعات/i });
    fireEvent.click(groupsTabButton);

    await waitFor(() => {
      expect(screen.getByText('مجموعة العباقرة - رياضيات 3 ثانوي (السبت والثلاثاء)')).toBeInTheDocument();
      expect(screen.getAllByText('نظام المتوسط').length).toBeGreaterThan(0);
    });

    // Switch back to Timetable view
    const timetableTabButton = screen.getByRole('button', { name: /عرض الجدول/i });
    fireEvent.click(timetableTabButton);

    await waitFor(() => {
      expect(screen.getByText('عرض كامل الأسبوع')).toBeInTheDocument();
    });
  });

  it('opens Add Group modal displaying the 3 financial calculation models and schedule builder', async () => {
    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <SessionsGroupsPage />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('جاري تحميل بيانات المجموعات وجدول الحصص...')).not.toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /إضافة مجموعة/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('إضافة مجموعة جديدة ومواعيد حصصها')).toBeInTheDocument();
      expect(screen.getByText('1. نظام المتوسط')).toBeInTheDocument();
      expect(screen.getByText('2. نظام البرايفت')).toBeInTheDocument();
      expect(screen.getByText('3. نظام الدفع بالحصة')).toBeInTheDocument();
      expect(screen.getByText('+ إضافة حصة أخرى في الأسبوع')).toBeInTheDocument();
    });
  });

  it('triggers window.print when clicking Print / PDF button', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <SessionsGroupsPage />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('جاري تحميل بيانات المجموعات وجدول الحصص...')).not.toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /طباعة \/ PDF/i });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
