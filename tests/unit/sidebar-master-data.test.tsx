import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { getDataProvider } from '@/lib/dal/factory';

// Mock next/navigation
let currentPathname = '/center/al-maher';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

describe('Sidebar Master Data Navigation', () => {
  beforeEach(() => {
    currentPathname = '/center/al-maher';
  });

  it('renders «البيانات الأساسية» collapsible section with chevron for authorized admin', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenant.id);
    const users = await dal.getUsers(tenant.id);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <Sidebar />
      </TenantProvider>
    );

    const masterDataButton = screen.getByRole('button', { name: /البيانات الأساسية/i });
    expect(masterDataButton).toBeInTheDocument();
  });

  it('toggles sub-items open and closed when clicked', async () => {
    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenant.id);
    const users = await dal.getUsers(tenant.id);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <Sidebar />
      </TenantProvider>
    );

    const masterDataButton = screen.getByRole('button', { name: /البيانات الأساسية/i });

    // Initially closed when on dashboard
    expect(screen.queryByText('قائمة المراحل التعليمية')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(masterDataButton);
    expect(screen.getByText('قائمة المراحل التعليمية')).toBeInTheDocument();
    expect(screen.getByText('قائمة المواد الدراسية')).toBeInTheDocument();
    expect(screen.getByText('قائمة الفروع')).toBeInTheDocument();

    // Click to close
    fireEvent.click(masterDataButton);
    expect(screen.queryByText('قائمة المراحل التعليمية')).not.toBeInTheDocument();
  });

  it('auto-expands and highlights active link when direct URL matches a child page', async () => {
    currentPathname = '/center/al-maher/stages';

    const dal = getDataProvider();
    const tenant = (await dal.getTenantBySlug('al-maher'))!;
    const branches = await dal.getBranches(tenant.id);
    const users = await dal.getUsers(tenant.id);

    render(
      <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
        <Sidebar />
      </TenantProvider>
    );

    // Auto-expanded: sub-items must be visible immediately
    expect(screen.getByText('قائمة المراحل التعليمية')).toBeInTheDocument();
    expect(screen.getByText('قائمة المواد الدراسية')).toBeInTheDocument();
    expect(screen.getByText('قائمة الفروع')).toBeInTheDocument();

    // The stages link should have active styling
    const stagesLink = screen.getByRole('link', { name: /قائمة المراحل التعليمية/i });
    expect(stagesLink).toHaveClass('text-brand-cyan-400');
  });
});
