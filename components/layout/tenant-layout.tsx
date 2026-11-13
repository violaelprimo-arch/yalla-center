'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex print:block print:bg-white print:text-black" dir="rtl">
      {/* Persistent Deep Midnight Navy Sidebar */}
      <div className="no-print">
        <Sidebar />
      </div>

      {/* Main Content Area with RTL offset (pr-64 for right sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 pr-64 print:pr-0 print:p-0">
        <div className="no-print">
          <Header />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
