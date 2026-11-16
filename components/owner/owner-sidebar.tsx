'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';

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
    badge: null,
  },
  {
    title: 'إدارة السناتر والاشتراكات',
    href: '/owner/centers',
    icon: Building2,
    badge: '3 سناتر',
  },
  {
    title: 'الواجهة الرئيسية (الموقع)',
    href: '/owner/website',
    icon: Globe,
    badge: 'CMS',
  },
  {
    title: 'السناتر والحجوزات',
    href: '/owner/requests',
    icon: Inbox,
    badge: 'جديد 2',
  },
  {
    title: 'الباقات والاشتراكات',
    href: '/owner/plans',
    icon: Sparkles,
    badge: '3 باقات',
  },
  {
    title: 'إعدادات التواصل والـ AI',
    href: '/owner/settings',
    icon: Bot,
    badge: 'نشط',
  },
  {
    title: 'الحسابات والمواعيد',
    href: '/owner/finance',
    icon: Wallet,
    badge: null,
  },
];

export function OwnerSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

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
        className={`w-64 h-screen fixed right-0 top-0 z-50 flex flex-col bg-[#0B132B] text-[#F8FAFC] border-l border-[#1C2541] shadow-soft-lg select-none transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        {/* Brand & Portal Header */}
        <div className="p-4 border-b border-[#1C2541] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link
              href="/owner"
              onClick={onClose}
              className="inline-block transition-transform hover:scale-[1.01]"
            >
              <BrandLogo theme="dark" width={145} height={36} priority />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة الجانبية"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>بوابة مالك المنصة</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Super-Admin
            </span>
          </div>
        </div>

        {/* 6 Main Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          <div className="px-3 pb-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">
            أقسام الإدارة الرئيسية
          </div>

          {OWNER_NAV_TABS.map((tab) => {
            const active = isTabActive(tab.href, tab.exact);
            const Icon = tab.icon;
            const isFinanceTab = tab.href === '/owner/finance';

            return (
              <div key={tab.href} className="space-y-1">
                <Link
                  href={tab.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
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
                    <span className="truncate">{tab.title}</span>
                  </div>

                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        active
                          ? 'bg-brand-cyan-500/20 text-brand-cyan-300 border border-brand-cyan-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}

                  {active && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-cyan-500 rounded-l-full shadow-[0_0_12px_#00E5FF]" />
                  )}
                </Link>

                {/* Sub-menu for the 8 financial tabs under 'الحسابات والمواعيد' */}
                {isFinanceTab && active && (
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
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#111A38]/50 transition-colors"
          >
            <Home className="w-4 h-4 text-slate-500" />
            <span>الموقع التسويقي العام</span>
          </Link>

          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>تسجيل الخروج</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
