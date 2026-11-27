'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  GraduationCap,
  Users,
  LogOut,
  ArrowRight,
  Calendar,
  Award,
  BookOpen,
  Wallet,
} from 'lucide-react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useTenant } from './tenant-provider';
import { BrandLogo } from '@/components/brand/brand-logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MobileBottomNav } from '@/components/ui/collapsible-sidebar';
import { signOutFirebaseStaff } from '@/lib/firebase/client';

export function TenantLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, currentRole, currentUser } = useTenant();

  const isStudentPortalRoute =
    pathname.startsWith(`/center/${tenant.slug}/student-portal`) || currentRole === 'STUDENT';
  const isParentPortalRoute =
    pathname.startsWith(`/center/${tenant.slug}/parent-portal`) || currentRole === 'PARENT';
  const isTeacherPortalRoute =
    pathname.startsWith(`/center/${tenant.slug}/teacher`) || currentRole === 'TEACHER';

  const isAdminPreviewing = ['PLATFORM_OWNER', 'CENTER_ADMIN'].includes(currentRole);

  const handlePortalSignOut = async () => {
    await signOutFirebaseStaff();
    if (typeof document !== 'undefined') {
      document.cookie = 'yc_role=; path=/; max-age=0';
      document.cookie = 'yc_tenant=; path=/; max-age=0';
      document.cookie = 'yc_user_id=; path=/; max-age=0';
    }
    router.push('/login');
  };

  // Independent shell for Teacher (/center/[slug]/teacher re-export handles its own layout)
  if (pathname.startsWith(`/center/${tenant.slug}/teacher`)) {
    return <>{children}</>;
  }

  // Strictly isolated shell for Student Portal and Parent Portal (ZERO Center Admin links for Student/Parent roles)
  if (isStudentPortalRoute || isParentPortalRoute) {
    const portalLabel = isParentPortalRoute ? 'بوابة ولي الأمر' : 'بوابة الطالب';
    const PortalIcon = isParentPortalRoute ? Users : GraduationCap;
    const baseHref = `/center/${tenant.slug}/${isParentPortalRoute ? 'parent-portal' : 'student-portal'}`;

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col pb-20 md:pb-0" dir="rtl">
        <header className="sticky top-0 z-30 h-16 bg-card/90 backdrop-blur-md border-b border-border px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={baseHref} className="inline-flex items-center shrink-0">
              <BrandLogo width={130} height={32} />
            </Link>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20 text-xs font-bold shrink-0">
                <PortalIcon className="w-3.5 h-3.5" />
                <span>{portalLabel}</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground truncate hidden md:inline">
                {tenant.nameAr}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminPreviewing && (
              <Link
                href={`/center/${tenant.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-xs font-bold text-foreground transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">لوحة إدارة السنتر</span>
              </Link>
            )}
            <span className="text-xs font-bold text-foreground hidden sm:inline px-2">
              {currentUser.fullName}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={handlePortalSignOut}
              aria-label="تسجيل الخروج"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>

        <MobileBottomNav
          activePath={pathname}
          items={
            isParentPortalRoute
              ? [
                  { id: 'overview', label: 'المتابعة', href: `${baseHref}#overview`, icon: Users },
                  { id: 'attendance', label: 'الحضور', href: `${baseHref}#attendance`, icon: Calendar },
                  { id: 'grades', label: 'الدرجات', href: `${baseHref}#grades`, icon: Award },
                  { id: 'finance', label: 'الاشتراك', href: `${baseHref}#finance`, icon: Wallet },
                ]
              : [
                  { id: 'overview', label: 'الرئيسية', href: `${baseHref}#overview`, icon: GraduationCap },
                  { id: 'timetable', label: 'الجدول', href: `${baseHref}#timetable`, icon: Calendar },
                  { id: 'grades', label: 'الدرجات', href: `${baseHref}#grades`, icon: Award },
                  { id: 'materials', label: 'المذكرات', href: `${baseHref}#materials`, icon: BookOpen },
                ]
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex" dir="rtl">
      {/* Persistent Deep Midnight Navy Sidebar */}
      {menuOpen && (
        <button
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <Sidebar
        mobileOpen={menuOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onNavigate={() => setMenuOpen(false)}
      />

      {/* Main Content Area with dynamic RTL offset */}
      <div
        className={`tenant-content flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pr-20' : 'lg:pr-64'
        }`}
      >
        <Header onMenuToggle={() => setMenuOpen((value) => !value)} menuOpen={menuOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
