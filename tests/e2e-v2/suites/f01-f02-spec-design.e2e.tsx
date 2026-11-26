import * as React from 'react';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { Home, Users, Wallet, BookOpen, Calendar, Settings } from 'lucide-react';
import {
  assertRepoFileExists,
  readRepoFileText,
  requireRepoModule,
  resolveRepoPath,
} from '../helpers/module-loader';
import {
  assertBrandAssetsUnmodified,
  renderWithNextContext,
  setReducedMotion,
  setTheme,
  setViewportWidth,
} from '../helpers/ui-harness';

describe('F1 — Complete UI/UX Spec & Page Map (Tier 1 & Tier 2)', () => {
  it('T1-F01-01: docs/ui-ux-spec.md exists, is non-empty, and defines all 8 portals with screens and routes', () => {
    const spec = readRepoFileText('docs/ui-ux-spec.md');
    expect(spec.trim().length).toBeGreaterThan(500);

    const requiredPortals = [
      'Platform Owner',
      'Center Admin',
      'Branch Manager',
      'Receptionist',
      'Teacher',
      'Accountant',
      'Student',
      'Parent',
    ];
    for (const portal of requiredPortals) {
      expect(spec, `Spec missing portal: ${portal}`).toContain(portal);
    }

    const requiredRoutes = [
      '/owner',
      '/login',
      '/site/[centerSlug]',
      '/center/[centerSlug]',
      '/teacher/[centerSlug]',
      '/center/[centerSlug]/branch',
      '/center/[centerSlug]/reception',
      '/center/[centerSlug]/accountant',
      '/center/[centerSlug]/student-portal',
      '/center/[centerSlug]/parent-portal',
    ];
    for (const route of requiredRoutes) {
      expect(spec, `Spec missing route: ${route}`).toContain(route);
    }
  });

  it('T1-F01-02: docs/ui-ux-spec.md includes user workflows, 8-role permission matrix, data entities, and domain events', () => {
    const spec = readRepoFileText('docs/ui-ux-spec.md');

    const roles = [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'TEACHER',
      'ACCOUNTANT',
      'STUDENT',
      'PARENT',
    ];
    for (const role of roles) {
      expect(spec, `Permission matrix missing role: ${role}`).toContain(role);
    }

    const events = [
      'attendance.recorded',
      'grade.published',
      'payment.recorded',
      'group.updated',
      'material.published',
    ];
    for (const ev of events) {
      expect(spec, `Spec missing domain event: ${ev}`).toContain(ev);
    }

    const entities = [
      'memberships/{tenantId}_{uid}',
      'center_materials',
      'center_material_versions',
      'financial_audits',
      'notification_outbox',
      'audit_logs',
    ];
    for (const entity of entities) {
      expect(spec, `Spec missing data entity: ${entity}`).toContain(entity);
    }
  });

  it('T1-F01-03: docs/ui-ux-spec.md documents reusable components and files to modify per milestone', () => {
    const spec = readRepoFileText('docs/ui-ux-spec.md');
    expect(spec).toContain('Components to Reuse');
    expect(spec).toContain('Files to Modify');
    expect(spec).toContain('components/ui/');
    expect(spec).toContain('components/brand/');
  });

  it('T1-F01-04: phased review dossiers exist under docs/phases/phase-*.md with required R1 sections', () => {
    const phasesDir = resolveRepoPath('docs/phases');
    expect(
      fs.existsSync(phasesDir),
      'Expected docs/phases/ directory containing phase-*.md dossiers per R1'
    ).toBe(true);

    const files = fs
      .readdirSync(phasesDir)
      .filter((f) => /^phase-.*\.md$/i.test(f));
    expect(
      files.length,
      'Expected at least one phase-*.md dossier in docs/phases/'
    ).toBeGreaterThanOrEqual(1);

    for (const file of files) {
      const content = fs.readFileSync(resolveRepoPath(`docs/phases/${file}`), 'utf8');
      expect(content).toMatch(/screens|routes/i);
      expect(content).toMatch(/workflow/i);
      expect(content).toMatch(/permission/i);
      expect(content).toMatch(/entit|event/i);
      expect(content).toMatch(/acceptance criteria/i);
      expect(content).toMatch(/test result/i);
    }
  });

  it('T1-F01-05: every primary portal and public route documented in docs/ui-ux-spec.md resolves to an App Router page', () => {
    const expectedPageFiles = [
      'app/page.tsx',
      'app/(auth)/login/page.tsx',
      'app/owner/page.tsx',
      'app/owner/centers/page.tsx',
      'app/owner/plans/page.tsx',
      'app/owner/subscriptions/page.tsx',
      'app/owner/requests/page.tsx',
      'app/owner/settings/page.tsx',
      'app/owner/website/page.tsx',
      'app/owner/finance/page.tsx',
      'app/teacher/[centerSlug]/page.tsx',
      'app/center/[centerSlug]/page.tsx',
      'app/center/[centerSlug]/admin/page.tsx',
      'app/center/[centerSlug]/branch/page.tsx',
      'app/center/[centerSlug]/reception/page.tsx',
      'app/center/[centerSlug]/accountant/page.tsx',
      'app/center/[centerSlug]/finance/page.tsx',
      'app/center/[centerSlug]/student-portal/page.tsx',
      'app/center/[centerSlug]/parent-portal/page.tsx',
      'app/center/[centerSlug]/materials/page.tsx',
      'app/center/[centerSlug]/exams/page.tsx',
      'app/center/[centerSlug]/exams/[examId]/run/page.tsx',
      'app/center/[centerSlug]/exams/printable/[id]/page.tsx',
      'app/site/[centerSlug]/page.tsx',
      'app/center/[centerSlug]/settings/page.tsx',
      'app/center/[centerSlug]/website/page.tsx',
      'app/center/[centerSlug]/reports/page.tsx',
    ];

    for (const pagePath of expectedPageFiles) {
      assertRepoFileExists(pagePath);
    }
  });

  it('T2-F01-01: permission matrix in docs/ui-ux-spec.md grants zero undocumented wildcard write access across 8 roles', () => {
    const spec = readRepoFileText('docs/ui-ux-spec.md');
    const matrixSectionIdx = spec.indexOf('## 4. Complete RBAC');
    expect(matrixSectionIdx).toBeGreaterThan(-1);
    const matrixSection = spec.slice(matrixSectionIdx, spec.indexOf('## 5.'));
    const tableRows = matrixSection
      .split('\n')
      .filter((line) => line.startsWith('| **'));
    expect(tableRows.length).toBeGreaterThanOrEqual(10);
    for (const row of tableRows) {
      const cells = row
        .split('|')
        .slice(2, -1)
        .map((c) => c.trim());
      expect(cells).toHaveLength(8);
      for (const cell of cells) {
        expect(cell).not.toMatch(/^(?:\*|ALL\s*RW)$/i);
      }
    }
    expect(matrixSection).toContain('/owner/*');
    expect(matrixSection).toContain('/accountant');
    expect(matrixSection).toContain('/teacher');
  });

  it('T2-F01-02: unauthenticated navigation to deep portal URL /center/al-maher/finance redirects to /login rather than passing through', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const mod = await requireRepoModule<{
      middleware: (req: NextRequest) => Promise<Response> | Response;
    }>('middleware.ts');

    const req = new NextRequest('http://localhost:3000/center/al-maher/finance');
    const res = await mod.middleware(req);
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status);
    if (res.status >= 300 && res.status < 400) {
      expect(res.headers.get('location')).toContain('/login');
    }
  });

  it('T2-F01-03: unknown portal sub-route /center/al-maher/nonexistent-tab has no route and repository provides branded not-found handling', async () => {
    expect(fs.existsSync(resolveRepoPath('app/center/[centerSlug]/nonexistent-tab/page.tsx'))).toBe(
      false
    );
    const hasNotFound =
      fs.existsSync(resolveRepoPath('app/not-found.tsx')) ||
      fs.existsSync(resolveRepoPath('app/center/[centerSlug]/not-found.tsx'));
    expect(
      hasNotFound,
      'Expected app/not-found.tsx or app/center/[centerSlug]/not-found.tsx for clean 404 handling'
    ).toBe(true);
  });

  it('T2-F01-04: every phase dossier in docs/phases/phase-*.md includes non-empty Acceptance Criteria and Test Results', () => {
    const phasesDir = resolveRepoPath('docs/phases');
    expect(fs.existsSync(phasesDir)).toBe(true);
    const files = fs.readdirSync(phasesDir).filter((f) => /^phase-.*\.md$/i.test(f));
    expect(files.length).toBeGreaterThanOrEqual(1);

    for (const file of files) {
      const content = fs.readFileSync(resolveRepoPath(`docs/phases/${file}`), 'utf8');
      const acMatch = content.match(/acceptance criteria[\s\S]{10,}/i);
      const trMatch = content.match(/test results?[\s\S]{10,}/i);
      expect(acMatch, `${file} missing non-empty Acceptance Criteria`).not.toBeNull();
      expect(trMatch, `${file} missing non-empty Test Results`).not.toBeNull();
    }
  });

  it('T2-F01-05: route inventory in docs/ui-ux-spec.md has unique canonical portal paths without conflicting mappings', () => {
    const spec = readRepoFileText('docs/ui-ux-spec.md');
    const pageMapStart = spec.indexOf('## 2. Full Page Map');
    const pageMapEnd = spec.indexOf('## 3. End-to-End');
    expect(pageMapStart).toBeGreaterThan(-1);
    expect(pageMapEnd).toBeGreaterThan(pageMapStart);

    const tableText = spec.slice(pageMapStart, pageMapEnd);
    const rows = tableText
      .split('\n')
      .filter((line) => line.startsWith('| **') && !line.includes('Portal / Area'));
    expect(rows.length).toBeGreaterThanOrEqual(10);

    const portalLabels = rows.map((r) => r.split('|')[1].trim());
    expect(new Set(portalLabels).size).toBe(portalLabels.length);
  });
});

describe('F2 — R4 Design System Primitives & A11y (Tier 1 & Tier 2)', () => {
  it('T1-F02-01: root layout and CSS/Tailwind enforce RTL, Arabic Cairo font, and Navy/Electric-Blue/Cyan tokens', () => {
    const layoutText = readRepoFileText('app/layout.tsx');
    expect(layoutText).toContain('lang="ar"');
    expect(layoutText).toContain('dir="rtl"');
    expect(layoutText).toContain('Cairo');
    expect(layoutText).toContain('--font-cairo');

    const globalsText = readRepoFileText('app/globals.css');
    expect(globalsText).toContain('--brand-navy-950: #070B19');
    expect(globalsText).toContain('--brand-navy-900: #0B132B');
    expect(globalsText).toContain('--brand-navy-850: #111A38');
    expect(globalsText).toContain('--brand-navy-800: #1C2541');
    expect(globalsText).toContain('--brand-blue-500: #00A3FF');
    expect(globalsText).toContain('--brand-cyan-500: #00C2FF');
    expect(globalsText).toContain('direction: rtl');

    const tailwindText = readRepoFileText('tailwind.config.ts');
    expect(tailwindText).toContain("darkMode: ['class']");
    expect(tailwindText).toContain('#0066FF');
    expect(tailwindText).toContain('#0B132B');
    expect(tailwindText).toContain('--font-cairo');
  });

  it('T1-F02-02: official brand assets in public/brand/* remain byte-for-byte unmodified', () => {
    assertBrandAssetsUnmodified();
  });

  it('T1-F02-03: ThemeToggle and BrandLogo switch dark/light themes and persist selection to localStorage', async () => {
    const { ThemeToggle } = await requireRepoModule<{
      ThemeToggle: React.ComponentType;
    }>('components/ui/theme-toggle.tsx');
    const { BrandLogo } = await requireRepoModule<{
      BrandLogo: React.ComponentType<{ theme?: 'auto' | 'light' | 'dark' }>;
    }>('components/brand/brand-logo.tsx');

    setTheme('light');
    await renderWithNextContext(
      <div>
        <ThemeToggle />
        <BrandLogo theme="auto" />
      </div>
    );

    const button = await screen.findByRole('button');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('yalla-theme')).toBe('dark');

    const imgs = document.querySelectorAll('img');
    const srcs = Array.from(imgs).map((img) => img.getAttribute('src') ?? '');
    expect(srcs.some((s) => s.includes('yalla-center-logo-light.png'))).toBe(true);
    expect(srcs.some((s) => s.includes('yalla-center-logo-dark.png'))).toBe(true);

    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('yalla-theme')).toBe('light');
  });

  it('T1-F02-04: R4 UI primitives (CollapsibleSidebar, DataTable, Drawer, Modal, Skeleton, InteractiveChart) function with ARIA and keyboard Escape', async () => {
    const { CollapsibleSidebar } = await requireRepoModule<any>(
      'components/ui/collapsible-sidebar.tsx'
    );
    const { DataTable } = await requireRepoModule<any>('components/ui/table.tsx');
    const { Drawer } = await requireRepoModule<any>('components/ui/drawer.tsx');
    const { Modal } = await requireRepoModule<any>('components/ui/modal.tsx');
    const { SkeletonTableRows } = await requireRepoModule<any>('components/ui/skeleton.tsx');
    const { InteractiveChart } = await requireRepoModule<any>('components/ui/interactive-chart.tsx');

    const onCloseModal = vi.fn();
    const onCloseDrawer = vi.fn();
    const onCollapsedChange = vi.fn();

    await renderWithNextContext(
      <div>
        <CollapsibleSidebar
          items={[
            { id: 'home', label: 'الرئيسية', href: '/center/al-maher', icon: Home },
            { id: 'students', label: 'الطلاب', href: '/center/al-maher/students', icon: Users },
          ]}
          activePath="/center/al-maher"
          collapsed={false}
          onCollapsedChange={onCollapsedChange}
          portalTitle="بوابة السنتر"
        />
        <DataTable
          data={[
            { id: '1', name: 'أحمد علي', amount: 1250 },
            { id: '2', name: 'سارة حسن', amount: 850 },
          ]}
          keyExtractor={(row: { id: string }) => row.id}
          columns={[
            { key: 'name', header: 'الاسم', accessor: (r: { name: string }) => r.name },
            {
              key: 'amount',
              header: 'المبلغ',
              numeric: true,
              accessor: (r: { amount: number }) => `${r.amount} EGP`,
            },
          ]}
        />
        <InteractiveChart
          type="bar"
          title="الإيرادات"
          data={[
            { label: 'يناير', value: 1000 },
            { label: 'فبراير', value: 1500 },
          ]}
        />
        <Modal isOpen={true} onClose={onCloseModal} title="نافذة اختبار">
          <p>محتوى المودال</p>
        </Modal>
        <Drawer isOpen={true} onClose={onCloseDrawer} title="درج اختبار">
          <p>محتوى الدرج</p>
        </Drawer>
        <SkeletonTableRows rows={2} columns={2} />
      </div>
    );

    // Numeric column uses tabular-nums
    const numericCell = screen.getByText('1250 EGP').closest('td');
    expect(numericCell?.className).toContain('tabular-nums');

    // Dialogs rendered with ARIA roles and close on Escape
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseModal.mock.calls.length + onCloseDrawer.mock.calls.length).toBeGreaterThanOrEqual(
      1
    );

    // Chart SVG has zero NaN attributes
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of Array.from(svgs)) {
      expect(svg.outerHTML).not.toContain('NaN');
    }

    // Skeleton status present
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);

    // Sidebar collapse toggle fires callback
    const toggleBtn = screen
      .getAllByRole('button')
      .find((b) => /طي|توسيع|collapse|sidebar/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''));
    expect(toggleBtn).toBeDefined();
    fireEvent.click(toggleBtn!);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('T1-F02-05: prefers-reduced-motion disables animations cleanly and globals.css restricts keyframes to transform/opacity', async () => {
    const globalsText = readRepoFileText('app/globals.css');
    expect(globalsText).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalsText).toContain('animation-duration: 0.01ms !important');
    expect(globalsText).toContain('transition-duration: 0.01ms !important');
    expect(globalsText).toContain('animation: none !important');
    expect(globalsText).toContain('translate3d');

    const { KpiCard } = await requireRepoModule<any>('components/ui/kpi-card.tsx');
    const { PageTransition } = await requireRepoModule<any>('components/ui/page-transition.tsx');

    setReducedMotion(true);
    await renderWithNextContext(
      <PageTransition>
        <KpiCard title="إجمالي التحصيل" value={4250} suffix=" ج.م" />
      </PageTransition>
    );

    expect(screen.getByText(/4,250|٤٬٢٥٠/)).toBeInTheDocument();
  });

  it('T2-F02-01: 320px narrow mobile viewport renders MobileBottomNav (capped <= 5 items) and DataTable without breaking layout', async () => {
    const { MobileBottomNav } = await requireRepoModule<any>(
      'components/ui/collapsible-sidebar.tsx'
    );
    const { DataTable } = await requireRepoModule<any>('components/ui/table.tsx');

    setViewportWidth(320);
    await renderWithNextContext(
      <div>
        <DataTable
          data={[{ id: '1', student: 'طالب تجريبي', fee: 500 }]}
          keyExtractor={(r: { id: string }) => r.id}
          columns={[
            { key: 'student', header: 'الطالب', accessor: (r: { student: string }) => r.student },
            { key: 'fee', header: 'الرسوم', numeric: true, accessor: (r: { fee: number }) => r.fee },
          ]}
        />
        <MobileBottomNav
          activePath="/center/al-maher/student-portal"
          items={[
            { id: '1', label: 'الرئيسية', href: '/center/al-maher/student-portal', icon: Home },
            { id: '2', label: 'الجدول', href: '/center/al-maher/sessions', icon: Calendar },
            { id: '3', label: 'الملازم', href: '/center/al-maher/materials', icon: BookOpen },
            { id: '4', label: 'المالية', href: '/center/al-maher/finance', icon: Wallet },
            { id: '5', label: 'الطلاب', href: '/center/al-maher/students', icon: Users },
            { id: '6', label: 'الإعدادات', href: '/center/al-maher/settings', icon: Settings },
          ]}
        />
      </div>
    );

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('pb-safe');
    const links = within(nav).getAllByRole('link');
    expect(links.length).toBeLessThanOrEqual(5);

    const tableWrapper = screen.getByRole('table').parentElement;
    expect(tableWrapper?.className).toContain('overflow-x-auto');
  });

  it('T2-F02-02: long 120-character Arabic names inside KpiCard, DataTable, and CollapsibleSidebar render cleanly with RTL and truncation/wrapping', async () => {
    const { KpiCard } = await requireRepoModule<any>('components/ui/kpi-card.tsx');
    const { DataTable } = await requireRepoModule<any>('components/ui/table.tsx');
    const { CollapsibleSidebar } = await requireRepoModule<any>(
      'components/ui/collapsible-sidebar.tsx'
    );

    const longArabicName = 'أ'.repeat(40) + ' ' + 'المركز التعليمي المتميز للرياضيات والفيزياء ' + 'ب'.repeat(40);
    expect(longArabicName.length).toBeGreaterThanOrEqual(120);

    await renderWithNextContext(
      <div>
        <CollapsibleSidebar
          items={[{ id: '1', label: longArabicName, href: '/center/al-maher', icon: Home }]}
          activePath="/center/al-maher"
          portalTitle={longArabicName}
        />
        <KpiCard title={longArabicName} value={999} />
        <DataTable
          data={[{ id: 'r1', name: longArabicName }]}
          keyExtractor={(r: { id: string }) => r.id}
          columns={[{ key: 'name', header: 'الاسم', accessor: (r: { name: string }) => r.name }]}
        />
      </div>
    );

    expect(screen.getAllByText(longArabicName).length).toBeGreaterThanOrEqual(3);
    const table = screen.getByRole('table');
    expect(table.getAttribute('dir')).toBe('rtl');
  });

  it('T2-F02-03: with prefers-reduced-motion active, Modal, Drawer, and PageTransition suppress motion effects', async () => {
    const { Modal } = await requireRepoModule<any>('components/ui/modal.tsx');
    const { Drawer } = await requireRepoModule<any>('components/ui/drawer.tsx');
    const { PageTransition } = await requireRepoModule<any>('components/ui/page-transition.tsx');

    setReducedMotion(true);
    const globalsText = readRepoFileText('app/globals.css');
    expect(globalsText).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);

    const { container } = await renderWithNextContext(
      <PageTransition>
        <Modal isOpen={true} onClose={() => {}} title="اختبار تقليل الحركة">
          <span>محتوى</span>
        </Modal>
        <Drawer isOpen={true} onClose={() => {}} title="درج تقليل الحركة">
          <span>درج</span>
        </Drawer>
      </PageTransition>
    );

    expect(container.innerHTML).toContain('motion-reduce:');
  });

  it('T2-F02-04: mixed Arabic RTL text, tabular numbers, and KaTeX LTR isolation coexist cleanly', async () => {
    const { MathView } = await requireRepoModule<any>('components/ui/math-view.tsx');
    const { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } =
      await requireRepoModule<any>('components/ui/table.tsx');

    const globalsText = readRepoFileText('app/globals.css');
    expect(globalsText).toMatch(/\.katex\s*\{[\s\S]*?direction:\s*ltr\s*!important/);

    await renderWithNextContext(
      <div dir="rtl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead numeric>المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>STU-1024</TableCell>
              <TableCell numeric>1,250.00 EGP</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <MathView math="x^2 + y^2 = r^2" display={true} />
      </div>
    );

    expect(screen.getByText('STU-1024')).toBeInTheDocument();
    const moneyCell = screen.getByText('1,250.00 EGP').closest('td');
    expect(moneyCell?.className).toContain('tabular-nums');
    expect(document.querySelector('.katex')).not.toBeNull();
  });

  it('T2-F02-05: BrandLogo renders distinct non-empty dark/light official assets and brand checksums remain intact', async () => {
    assertBrandAssetsUnmodified();

    const { BrandLogo } = await requireRepoModule<any>('components/brand/brand-logo.tsx');

    await renderWithNextContext(
      <div>
        <div data-testid="light-wrap">
          <BrandLogo theme="light" width={160} height={40} />
        </div>
        <div data-testid="dark-wrap">
          <BrandLogo theme="dark" width={160} height={40} />
        </div>
      </div>
    );

    const lightImg = within(screen.getByTestId('light-wrap')).getByRole('img');
    const darkImg = within(screen.getByTestId('dark-wrap')).getByRole('img');
    expect(lightImg.getAttribute('src')).toContain('yalla-center-logo-light.png');
    expect(darkImg.getAttribute('src')).toContain('yalla-center-logo-dark.png');
    expect(Number(lightImg.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(darkImg.getAttribute('width'))).toBeGreaterThan(0);
  });
});
