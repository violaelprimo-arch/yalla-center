'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Menu,
} from 'lucide-react';
import { UserRole } from '@/lib/dal/types';
import { useTenant } from './tenant-provider';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Badge } from '@/components/ui/badge';

const ALL_ROLES: Array<{ role: UserRole; labelAr: string }> = [
  { role: 'PLATFORM_OWNER', labelAr: 'مدير المنصة (مالك)' },
  { role: 'CENTER_ADMIN', labelAr: 'مدير السنتر' },
  { role: 'BRANCH_MANAGER', labelAr: 'مدير الفرع' },
  { role: 'ACCOUNTANT', labelAr: 'المحاسب المالي' },
  { role: 'RECEPTIONIST', labelAr: 'موظف الاستقبال' },
  { role: 'TEACHER', labelAr: 'معلم' },
  { role: 'STUDENT', labelAr: 'طالب' },
  { role: 'PARENT', labelAr: 'ولي أمر' },
];

export function Header({ onMenuToggle, menuOpen }: { onMenuToggle?: () => void; menuOpen?: boolean }) {
  const {
    tenant,
    branches,
    activeBranch,
    setActiveBranchId,
    currentRole,
    switchRole,
    currentUser,
  } = useTenant();

  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-20 h-16 bg-background/95 backdrop-blur border-b border-border px-2 sm:px-6 flex items-center justify-between gap-2 sm:gap-4"
      dir="rtl"
    >
      {/* Right Section: Tenant Title & Branch Selector */}
      <div className="flex items-center gap-1.5 sm:gap-6 min-w-0">
        {onMenuToggle && <button type="button" className="rounded-lg p-2 hover:bg-muted lg:hidden"
          aria-label="القائمة الرئيسية" aria-expanded={menuOpen} onClick={onMenuToggle}><Menu size={21} /></button>}
        <div className="hidden md:flex flex-col">
          <span className="text-xs text-muted-foreground font-medium">المركز التعليمي</span>
          <span className="text-sm font-bold text-foreground truncate max-w-[180px]">
            {tenant.nameAr}
          </span>
        </div>

        {/* Branch Switcher Dropdown */}
        {branches.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/60 hover:bg-muted p-1.5 px-3 rounded-xl border border-border transition-colors">
            <Building2 className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400 shrink-0" />
            <select
              aria-label="تحديد الفرع النشط"
              value={activeBranch?.id || ''}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="max-w-24 sm:max-w-none bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-card text-foreground">
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Left Section: 1-Click Role Switcher (Demo HUD) & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Switcher Widget */}
        <div className="flex items-center gap-1.5 bg-brand-cyan-500/10 border border-brand-cyan-500/30 p-1 px-2.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400 shrink-0" />
          <span className="text-[11px] font-bold text-brand-cyan-700 dark:text-brand-cyan-300 hidden sm:inline">
            الدور التجريبي:
          </span>
          <select
            aria-label="تبديل الدور التجريبي"
            value={currentRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="max-w-20 sm:max-w-none bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
          >
            {ALL_ROLES.map(({ role, labelAr }) => (
              <option key={role} value={role} className="bg-card text-foreground">
                {labelAr}
              </option>
            ))}
          </select>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Link */}
        <Link
          href={`/center/${tenant.slug}/profile`}
          className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-all"
          title="عرض وتعديل الملف الشخصي"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden bg-muted border border-border">
            {currentUser.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as any).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                {currentUser.fullName.charAt(0)}
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-foreground hidden lg:inline max-w-[120px] truncate">
            {currentUser.fullName}
          </span>
        </Link>
      </div>
    </header>
  );
}
