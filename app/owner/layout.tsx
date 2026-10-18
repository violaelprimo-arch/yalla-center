import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Home,
  ShieldCheck,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RTLIcon } from '@/components/ui/rtl-icon';

export const metadata: Metadata = {
  title: 'بوابة مالك المنصة — يلا سنتر Super-Admin',
  description: 'لوحة القيادة المركزية لمالك المنصة لإدارة السناتر، الاشتراكات السحابية، ومؤشرات الأداء العامة.',
};

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex" dir="rtl">
      {/* Persistent Platform Owner Sidebar */}
      <aside
        className="w-64 h-screen fixed right-0 top-0 z-30 flex flex-col bg-[#0B132B] text-[#F8FAFC] border-l border-[#1C2541] shadow-soft-lg select-none"
        dir="rtl"
      >
        <div className="p-4 border-b border-[#1C2541] flex flex-col gap-2">
          <Link href="/owner" className="inline-block transition-transform hover:scale-[1.01]">
            <BrandLogo theme="dark" width={145} height={36} priority />
          </Link>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              بوابة مالك المنصة
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Super-Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <Link
            href="/owner"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-[#111A38] text-brand-cyan-400 shadow-soft-sm relative"
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#00A3FF] rounded-l-full shadow-[0_0_12px_#00A3FF]" />
            <LayoutDashboard className="w-5 h-5 text-[#00A3FF]" />
            <span>لوحة القيادة المركزية</span>
          </Link>

          <Link
            href="/center/al-maher"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-[#111A38]/60 transition-colors"
          >
            <Building2 className="w-5 h-5 text-slate-400" />
            <span>سنتر الماهر النموذجي</span>
            <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5 text-slate-500 mr-auto" />
          </Link>

          <Link
            href="/center/al-rowad"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-[#111A38]/60 transition-colors"
          >
            <Building2 className="w-5 h-5 text-slate-400" />
            <span>سنتر الرواد التعليمي</span>
            <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5 text-slate-500 mr-auto" />
          </Link>

          <div className="pt-4 mt-4 border-t border-[#1C2541]">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#111A38]/40 transition-colors"
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>الصفحة الترحيبية</span>
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-[#1C2541] bg-[#070B19]/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-purple-500/40 bg-purple-950 flex items-center justify-center font-bold text-xs text-purple-200">
            م.إ
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">م. إسلام خليل</p>
            <span className="text-[10px] text-purple-300">مالك النظام العام</span>
          </div>
        </div>
      </aside>

      {/* Main Container with pr-64 for RTL Right Sidebar */}
      <div className="flex-1 flex flex-col min-w-0 pr-64">
        <header className="sticky top-0 z-20 h-16 bg-background/95 backdrop-blur border-b border-border px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground">
              حالة السيرفر والمنصة: <strong className="text-emerald-600 dark:text-emerald-400">متصل وجاهز للتشغيل</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
