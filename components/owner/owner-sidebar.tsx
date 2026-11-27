'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Globe,
  Inbox,
  Sparkles,
  Bot,
  Wallet,
  ShieldCheck,
  Home,
  X,
  LogOut,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  ArrowUpRight,
  TrendingUp,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { BrandIcon } from '@/components/brand/brand-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { useMotionTheme } from '@/lib/motion/context';

export const FINANCE_SUB_TABS = [
  { id: 'overview', title: 'نظرة عامة', href: '/owner/finance?tab=overview', icon: Wallet },
  { id: 'sheet', title: 'شيت حسابات السناتر', href: '/owner/finance?tab=sheet', icon: FileSpreadsheet },
  { id: 'invoices', title: 'فواتير الاشتراكات', href: '/owner/finance?tab=invoices', icon: Receipt },
  { id: 'payments', title: 'التحصيلات والمدفوعات', href: '/owner/finance?tab=payments', icon: CreditCard },
  { id: 'expenses', title: 'المصروفات', href: '/owner/finance?tab=expenses', icon: ArrowUpRight },
  { id: 'reports', title: 'الأرباح والتقارير المالية', href: '/owner/finance?tab=reports', icon: TrendingUp },
  { id: 'calendar', title: 'تقويم المواعيد والتجديدات', href: '/owner/finance?tab=calendar', icon: Calendar },
  { id: 'export', title: 'النسخ والتصدير', href: '/owner/finance?tab=export', icon: Download },
];

export const OWNER_NAV_TABS = [
  {
    title: 'لوحة القيادة المركزية',
    href: '/owner',
    exact: true,
    icon: LayoutDashboard,
    badgeKey: null as null | 'centers' | 'requests' | 'plans' | 'website' | 'ai',
  },
  {
    title: 'إدارة السناتر والاشتراكات',
    href: '/owner/centers',
    icon: Building2,
    badgeKey: 'centers' as const,
  },
  {
    title: 'الواجهة الرئيسية (الموقع)',
    href: '/owner/website',
    icon: Globe,
    badgeKey: 'website' as const,
  },
  {
    title: 'السناتر والحجوزات',
    href: '/owner/requests',
    icon: Inbox,
    badgeKey: 'requests' as const,
  },
  {
    title: 'الباقات والاشتراكات',
    href: '/owner/plans',
    icon: Sparkles,
    badgeKey: 'plans' as const,
  },
  {
    title: 'إعدادات التواصل والـ AI',
    href: '/owner/settings',
    icon: Bot,
    badgeKey: 'ai' as const,
  },
  {
    title: 'الحسابات والمواعيد',
    href: '/owner/finance',
    icon: Wallet,
    badgeKey: null,
  },
];

export function OwnerSidebar({
  mobileOpen = false,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: {
  mobileOpen?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [counts, setCounts] = useState({ centers: 0, requests: 0, plans: 0 });

  useEffect(() => {
    const syncCounts = () => {
      const centers = SaasPlatformService.getCenters();
      const requests = SaasPlatformService.getRequests();
      const plans = SaasPlatformService.getPlans(true);
      setCounts({
        centers: centers.length,
        requests: requests.filter((r) => r.status === 'new' || r.status === 'under_review').length,
        plans: plans.length,
      });
    };
    syncCounts();
    window.addEventListener('storage', syncCounts);
    return () => window.removeEventListener('storage', syncCounts);
  }, [pathname]);

  const getDynamicBadge = (key: (typeof OWNER_NAV_TABS)[number]['badgeKey']) => {
    if (key === 'centers') return counts.centers > 0 ? `${counts.centers} سنتر` : null;
    if (key === 'requests') return counts.requests > 0 ? `جديد ${counts.requests}` : null;
    if (key === 'plans') return counts.plans > 0 ? `${counts.plans} باقات` : null;
    if (key === 'website') return 'CMS';
    if (key === 'ai') return 'AI';
    return null;
  };

  const isTabActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="إغلاق القائمة"
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`h-screen fixed right-0 top-0 z-50 flex flex-col bg-[#0B132B] text-[#F8FAFC] border-l border-[#1C2541] shadow-soft-lg select-none transition-all duration-300 ease-in-out lg:translate-x-0 ${
          collapsed ? 'w-64 lg:w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
        dir="rtl"
      >
        {/* Brand & Portal Header */}
        <div className="p-4 border-b border-[#1C2541] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/owner"
              onClick={onClose}
              className="inline-flex items-center gap-2 transition-transform hover:scale-[1.01] overflow-hidden"
            >
              {collapsed ? (
                <BrandIcon size={34} priority />
              ) : (
                <BrandLogo theme="dark" width={140} height={34} priority />
              )}
            </Link>
            <div className="flex items-center gap-1">
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                  title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
                  className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق القائمة الجانبية"
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>بوابة مالك المنصة</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Super-Admin
              </span>
            </div>
          )}
        </div>

        {/* Main Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">
              أقسام الإدارة الرئيسية
            </div>
          )}

          {OWNER_NAV_TABS.map((tab) => {
            const active = isTabActive(tab.href, tab.exact);
            const Icon = tab.icon;
            const isFinanceTab = tab.href === '/owner/finance';
            const badgeText = getDynamicBadge(tab.badgeKey);

            return (
              <div key={tab.href} className="space-y-1">
                <Link
                  href={tab.href}
                  onClick={onClose}
                  title={collapsed ? tab.title : undefined}
                  className={`flex items-center ${
                    collapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                    active
                      ? 'bg-[#111A38] text-brand-cyan-400 shadow-soft-sm ring-1 ring-brand-cyan-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-[#111A38]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-brand-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{tab.title}</span>}
                  </div>

                  {!collapsed && badgeText && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                        active
                          ? 'bg-brand-cyan-500/20 text-brand-cyan-300 border border-brand-cyan-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {badgeText}
                    </span>
                  )}

                  {active && (
                    <motion.span
                      layoutId={isReduced ? undefined : 'ownerActiveIndicator'}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-cyan-500 rounded-l-full shadow-[0_0_12px_#00E5FF]"
                    />
                  )}
                </Link>

                {/* Sub-menu for the 8 financial tabs under 'الحسابات والمواعيد' */}
                {isFinanceTab && active && !collapsed && (
                  <div className="pr-5 pl-2 py-1 space-y-1 border-r border-[#1C2541] mr-3 my-1">
                    {FINANCE_SUB_TABS.map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          onClick={onClose}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#111A38]/40 transition-colors"
                        >
                          <SubIcon className="w-3 h-3 text-brand-cyan-400/70 shrink-0" />
                          <span className="truncate">{sub.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </nav>

        {/* Bottom Actions: Public Site & Sign Out */}
        <div className="p-3 border-t border-[#1C2541] bg-[#070B19]/40 space-y-1">
          <Link
            href="/"
            onClick={onClose}
            title={collapsed ? 'الموقع التسويقي العام' : undefined}
            className={`flex items-center ${
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
            } py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#111A38]/50 transition-colors`}
          >
            <Home className="w-4 h-4 text-slate-500 shrink-0" />
            {!collapsed && <span>الموقع التسويقي العام</span>}
          </Link>

          <Link
            href="/login"
            onClick={onClose}
            title={collapsed ? 'تسجيل الخروج' : undefined}
            className={`flex items-center ${
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
            } py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors`}
          >
            <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
