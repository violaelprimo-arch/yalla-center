import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  Wallet,
  Bell,
} from 'lucide-react';

import {
  Skeleton,
  SkeletonCard,
  SkeletonTableRows,
  SkeletonKpiGrid,
  SkeletonProfile,
} from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { Drawer } from '@/components/ui/drawer';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  InteractiveBarChart,
  InteractiveLineChart,
  InteractiveDonutChart,
  InteractiveChart,
} from '@/components/ui/interactive-chart';
import { PageTransition } from '@/components/ui/page-transition';
import {
  CollapsibleSidebar,
  MobileBottomNav,
  type SidebarNavItem,
} from '@/components/ui/collapsible-sidebar';

const ROOT = process.cwd();
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('Official Brand Assets Integrity (public/brand/*)', () => {
  const expectedAssets = [
    {
      relPath: 'public/brand/yalla-center-icon.png',
      bytes: 138885,
      sha256: 'A669BE7CA7D4CAD20D7F8431D0E27532CA2D76DCB1BBDBFE6345DA36C42B27BB',
    },
    {
      relPath: 'public/brand/yalla-center-logo-dark.png',
      bytes: 99378,
      sha256: 'DE5E3647F161F1634C6DAD015016D3CDF64F21EBA75464F160AAF9D4FB90C3A7',
    },
    {
      relPath: 'public/brand/yalla-center-logo-light.png',
      bytes: 81901,
      sha256: '0A49C7F8197134F736749C1EBEC442520AE5B444B94A5CB333BEA44F34DD7E7A',
    },
    {
      relPath: 'public/brand/yalla-center-wireframes.jpg',
      bytes: 341920,
      sha256: '8D611B96EA0C164BD34AEDF571C5A630072F9E4A944742CC1F3237D9D3BF970B',
    },
  ];

  it.each(expectedAssets)(
    'preserves exact byte size and SHA-256 hash for $relPath',
    ({ relPath, bytes, sha256 }) => {
      const fullPath = path.join(ROOT, relPath);
      const buf = fs.readFileSync(fullPath);
      const actualHash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
      expect(buf.byteLength).toBe(bytes);
      expect(actualHash).toBe(sha256);
    }
  );
});

describe('Global CSS Tokens & Reduced-Motion Rules (app/globals.css)', () => {
  it('preserves R4 brand tokens, KaTeX BiDi, tabular-nums, GPU keyframes, and prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    expect(css).toContain(':root');
    expect(css).toContain('.dark');
    expect(css).toContain('#0B132B');
    expect(css).toContain('#070B19');
    expect(css).toContain('#111A38');
    expect(css).toContain('#1C2541');
    expect(css).toContain('#00A3FF');
    expect(css).toContain('#00C2FF');
    expect(css).toContain('.tabular-nums');
    expect(css).toContain('.katex');
    expect(css).toContain('direction: ltr !important');
    expect(css).toContain('@media print');
    expect(css).toContain('@keyframes yc-fade-slide-up');
    expect(css).toContain('@keyframes yc-modal-in');
    expect(css).toContain('@keyframes yc-drawer-in-start');
    expect(css).toContain('@keyframes yc-drawer-in-end');
    expect(css).toContain('@keyframes yc-shimmer');
    expect(css).toContain('.pb-safe');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('Skeleton Primitives', () => {
  it('renders Skeleton variants and composite loading placeholders with status role', () => {
    const { container } = render(
      <div>
        <Skeleton variant="circle" className="h-10 w-10" />
        <SkeletonCard lines={3} />
        <SkeletonTableRows rows={3} columns={4} />
        <SkeletonKpiGrid count={4} />
        <SkeletonProfile />
      </div>
    );

    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBe(4);
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    expect(screen.getAllByText('جاري التحميل...').length).toBe(4);
  });
});

describe('DataTable & Table Primitives', () => {
  interface StudentRow {
    id: string;
    name: string;
    balance: number;
  }

  const rows: StudentRow[] = [
    { id: '1', name: 'أحمد محمود', balance: 450 },
    { id: '2', name: 'سارة علي', balance: 120 },
    { id: '3', name: 'يوسف حسن', balance: 900 },
  ];

  const columns: DataTableColumn<StudentRow>[] = [
    { key: 'name', header: 'اسم الطالب', sortable: true },
    {
      key: 'balance',
      header: 'الرصيد المستحق',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.balance,
      accessor: (r) => `${r.balance} ج.م`,
    },
  ];

  it('renders RTL table with tabular-nums, sorts columns with aria-sort, and handles search', () => {
    const onSearch = vi.fn();
    const onRowClick = vi.fn();

    const { container } = render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchValue=""
        onSearchChange={onSearch}
        searchPlaceholder="ابحث عن طالب..."
        onRowClick={onRowClick}
      />
    );

    expect(container.querySelector('table')).toHaveAttribute('dir', 'rtl');
    expect(container.querySelector('td.tabular-nums')).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers[1]).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(screen.getByRole('button', { name: 'الرصيد المستحق' }));
    expect(headers[1]).toHaveAttribute('aria-sort', 'ascending');

    const bodyCells = container.querySelectorAll('tbody tr td:nth-child(2)');
    expect(bodyCells[0].textContent).toBe('120 ج.م');
    expect(bodyCells[2].textContent).toBe('900 ج.م');

    fireEvent.click(screen.getByRole('button', { name: 'الرصيد المستحق' }));
    expect(headers[1]).toHaveAttribute('aria-sort', 'descending');
    const descCells = container.querySelectorAll('tbody tr td:nth-child(2)');
    expect(descCells[0].textContent).toBe('900 ج.م');

    fireEvent.change(screen.getByPlaceholderText('ابحث عن طالب...'), {
      target: { value: 'سارة' },
    });
    expect(onSearch).toHaveBeenCalledWith('سارة');

    const firstRow = container.querySelector('tbody tr')!;
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton and Arabic empty state', () => {
    const { rerender } = render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        loading
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(r) => r.id}
        emptyTitle="لا يوجد طلاب مسجلون"
      />
    );
    expect(screen.getByText('لا يوجد طلاب مسجلون')).toBeInTheDocument();
  });
});

describe('Modal Primitive', () => {
  it('renders accessible dialog when open and closes on ESC, backdrop, and close button', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} onClose={onClose} title="تعديل البيانات">
        <p>محتوى النافذة</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Modal
        isOpen
        onClose={onClose}
        title="تعديل البيانات"
        description="وصف مختصر"
        footer={<button type="button">حفظ</button>}
      >
        <p>محتوى النافذة</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'إغلاق النافذة' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('Drawer Primitive', () => {
  it('supports RTL start/end/bottom sides and closes on ESC and backdrop', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer isOpen onClose={onClose} side="start" title="سجل الإصدارات">
        <div>تفاصيل الإصدار</div>
      </Drawer>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-side', 'start');
    expect(dialog.className).toContain('start-0');

    rerender(
      <Drawer isOpen onClose={onClose} side="bottom" title="تبديل الطالب">
        <div>قائمة الأبناء</div>
      </Drawer>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'bottom');
    expect(screen.getByRole('dialog').className).toContain('bottom-0');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('KpiCard Primitive', () => {
  it('renders tabular-nums KPI, trend badge, and honors prefers-reduced-motion immediately', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onClick = vi.fn();
    const { container } = render(
      <KpiCard
        title="إجمالي التحصيل"
        value={12500}
        formatValue={(v) => `${v} ج.م`}
        icon={Wallet}
        trend={{ value: 12, label: 'عن الشهر الماضي', direction: 'up' }}
        onClick={onClick}
      />
    );

    expect(screen.getByText('12500 ج.م')).toHaveClass('tabular-nums');
    expect(screen.getByText('+12%')).toBeInTheDocument();

    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton when loading=true', () => {
    render(<KpiCard title="الطلاب" value={200} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('InteractiveChart Primitives', () => {
  const sampleData = [
    { label: 'سبت', value: 120 },
    { label: 'أحد', value: 240 },
    { label: 'إثنين', value: 180 },
  ];

  it('renders Bar, Line, and Donut charts with hover/focus tooltips and tabular-nums', () => {
    const { container } = render(
      <div>
        <InteractiveBarChart data={sampleData} title="الحضور الأسبوعي" />
        <InteractiveLineChart data={sampleData} title="الإيرادات" />
        <InteractiveDonutChart data={sampleData} title="توزيع الاشتراكات" />
      </div>
    );

    const buttons = screen.getAllByRole('button', { name: /أحد: / });
    fireEvent.focus(buttons[0]);
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.querySelector('.tabular-nums')).toBeInTheDocument();

    // Ensure no NaN leaked into SVG geometry attributes
    const html = container.innerHTML;
    expect(html).not.toContain('NaN');
  });

  it('handles empty and zero-sum datasets gracefully without NaN', () => {
    const zeroData = [
      { label: 'أ', value: 0 },
      { label: 'ب', value: 0 },
    ];
    const { container } = render(
      <div>
        <InteractiveChart type="bar" data={[]} title="فارغ" />
        <InteractiveChart type="line" data={[{ label: 'نقطة واحدة', value: 0 }]} title="نقطة" />
        <InteractiveChart type="donut" data={zeroData} title="أصفار" />
      </div>
    );

    expect(screen.getByText('لا توجد بيانات للعرض')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('NaN');
  });
});

describe('PageTransition Primitive', () => {
  it('wraps content with GPU page-enter animation and reduced-motion safeguards', () => {
    const { container } = render(
      <PageTransition transitionKey="dashboard">
        <section>لوحة التحكم</section>
      </PageTransition>
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute('dir', 'rtl');
    expect(wrapper).toHaveAttribute('data-transition-key', 'dashboard');
    expect(wrapper.className).toContain('animate-yc-page-enter');
    expect(wrapper.className).toContain('motion-reduce:animate-none');
  });
});

describe('CollapsibleSidebar & MobileBottomNav Primitives', () => {
  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'نظرة عامة', href: '/center/al-maher', icon: LayoutDashboard },
    {
      id: 'academic',
      label: 'الشؤون التعليمية',
      href: '/center/al-maher/students',
      icon: BookOpen,
      children: [
        { id: 'students', label: 'الطلاب', href: '/center/al-maher/students', icon: Users, badge: 12 },
        { id: 'sessions', label: 'الجداول', href: '/center/al-maher/sessions', icon: Calendar },
      ],
    },
  ];

  it('toggles desktop collapse, expands accordion groups, highlights active route, and closes mobile drawer on ESC', () => {
    const onMobileOpenChange = vi.fn();
    const { container } = render(
      <CollapsibleSidebar
        items={navItems}
        activePath="/center/al-maher/students"
        portalBadge="إدارة السنتر"
        portalTitle="سنتر الماهر"
        mobileOpen
        onMobileOpenChange={onMobileOpenChange}
      />
    );

    const aside = container.querySelector('aside[data-collapsed]')!;
    expect(aside).toHaveAttribute('data-collapsed', 'false');

    const collapseBtn = screen.getByRole('button', { name: 'طي القائمة الجانبية' });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(collapseBtn);
    expect(aside).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'توسيع القائمة الجانبية' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Active child link has aria-current="page"
    const activeLinks = screen.getAllByRole('link', { name: /الطلاب/ });
    expect(activeLinks.some((el) => el.getAttribute('aria-current') === 'page')).toBe(true);

    // Mobile drawer closes on ESC
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onMobileOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders MobileBottomNav with safe area padding, active page indicator, and badge counter', () => {
    const { container } = render(
      <MobileBottomNav
        activePath="/center/al-maher/parent-portal"
        items={[
          { id: 'home', label: 'الرئيسية', href: '/center/al-maher/parent-portal', icon: LayoutDashboard },
          { id: 'alerts', label: 'التنبيهات', href: '/center/al-maher/notifications', icon: Bell, badgeCount: 5 },
        ]}
      />
    );

    const nav = container.querySelector('nav')!;
    expect(nav.className).toContain('pb-safe');
    expect(screen.getByRole('link', { name: /الرئيسية/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('5')).toHaveClass('tabular-nums');
  });
});
