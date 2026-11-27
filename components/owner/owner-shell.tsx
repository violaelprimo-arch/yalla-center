'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, ShieldCheck } from 'lucide-react';
import { OwnerSidebar } from './owner-sidebar';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex" dir="rtl">
      {/* Platform Owner Sidebar */}
      <OwnerSidebar
        mobileOpen={mobileMenuOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area (dynamically sized for collapsed or expanded RTL sidebar) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pr-20' : 'lg:pr-64'}`}>
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="فتح القائمة الجانبية"
              className="lg:hidden p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                حالة السيرفر والمنصة: <strong className="text-emerald-600 dark:text-emerald-400">متصل وجاهز للتشغيل</strong>
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 sm:hidden">
                متصل
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden md:inline-flex text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors"
            >
              الموقع العام
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
