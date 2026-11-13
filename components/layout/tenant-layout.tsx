'use client';

import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function TenantLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex" dir="rtl">
      {/* Persistent Deep Midnight Navy Sidebar */}
      {menuOpen && <button aria-label="إغلاق القائمة" className="fixed inset-0 z-20 bg-black/40 lg:hidden"
        onClick={() => setMenuOpen(false)} />}
      <Sidebar mobileOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />

      {/* Main Content Area with RTL offset (pr-64 for right sidebar) */}
      <div className="tenant-content flex-1 flex flex-col min-w-0 lg:pr-64">
        <Header onMenuToggle={() => setMenuOpen(value => !value)} menuOpen={menuOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
