'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Briefcase,
  QrCode,
  CalendarClock,
  FolderTree,
  FileSpreadsheet,
  Wallet,
  Bell,
  UserCircle,
  LucideIcon,
  ExternalLink,
} from 'lucide-react';
import { UserRole } from '@/lib/dal/types';
import { useTenant } from './tenant-provider';
import { BrandLogo } from '@/components/brand/brand-logo';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { cn } from '@/lib/utils';

export interface CenterNavItem {
  id: string;
  titleAr: string;
  href: (slug: string) => string;
  icon: LucideIcon;
  roles: UserRole[];
  badge?: string;
}

export const CENTER_NAV_ITEMS: CenterNavItem[] = [
  {
    id: 'dashboard',
    titleAr: 'لوحة التحكم',
    href: (slug) => `/center/${slug}`,
    icon: LayoutDashboard,
    roles: [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'RECEPTIONIST',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
  },
  {
    id: 'branches',
    titleAr: 'الفروع والقاعات',
    href: (slug) => `/center/${slug}/branches`,
    icon: Building2,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER'],
  },
  {
    id: 'students',
    titleAr: 'شؤون الطلاب',
    href: (slug) => `/center/${slug}/students`,
    icon: GraduationCap,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'],
  },
  {
    id: 'teachers',
    titleAr: 'شؤون المعلمين',
    href: (slug) => `/center/${slug}/teachers`,
    icon: Briefcase,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN'],
  },
  {
    id: 'reception',
    titleAr: 'الاستقبال والحضور',
    href: (slug) => `/center/${slug}/reception`,
    icon: QrCode,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STUDENT', 'PARENT'],
    badge: 'سريع',
  },
  {
    id: 'sessions',
    titleAr: 'الحصص والمجموعات',
    href: (slug) => `/center/${slug}/sessions`,
    icon: CalendarClock,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'],
  },
  {
    id: 'materials',
    titleAr: 'المذكرات والملازم',
    href: (slug) => `/center/${slug}/materials`,
    icon: FolderTree,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT'],
  },
  {
    id: 'exams',
    titleAr: 'الامتحانات الذكية',
    href: (slug) => `/center/${slug}/exams`,
    icon: FileSpreadsheet,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'],
    badge: 'AI',
  },
  {
    id: 'finance',
    titleAr: 'الخزينة والمالية',
    href: (slug) => `/center/${slug}/finance`,
    icon: Wallet,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT'],
  },
  {
    id: 'notifications',
    titleAr: 'مركز الإشعارات',
    href: (slug) => `/center/${slug}/notifications`,
    icon: Bell,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER'],
  },
  {
    id: 'profile',
    titleAr: 'الملف الشخصي',
    href: (slug) => `/center/${slug}/profile`,
    icon: UserCircle,
    roles: [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'RECEPTIONIST',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
  },
];

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  PLATFORM_OWNER: { label: 'مدير المنصة', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  CENTER_ADMIN: { label: 'مدير السنتر', color: 'bg-brand-cyan-500/20 text-brand-cyan-400 border-brand-cyan-500/30' },
  BRANCH_MANAGER: { label: 'مدير الفرع', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ACCOUNTANT: { label: 'محاسب السنتر', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  RECEPTIONIST: { label: 'الاستقبال', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  TEACHER: { label: 'معلم معتمد', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  STUDENT: { label: 'طالب مقيد', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  PARENT: { label: 'ولي أمر', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

export function Sidebar() {
  const { tenant, currentRole, currentUser, isOwnerMode } = useTenant();
  const pathname = usePathname();

  // Filter navigation items based on the active role
  const visibleNavItems = CENTER_NAV_ITEMS.filter((item) =>
    item.roles.includes(currentRole)
  );

  const roleMeta = ROLE_LABELS[currentRole] || {
    label: currentRole,
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };

  return (
    <aside
      className="w-64 h-screen fixed right-0 top-0 z-30 flex flex-col bg-[#0B132B] text-[#F8FAFC] border-l border-[#1C2541] shadow-soft-lg select-none"
      dir="rtl"
    >
      {/* Platform Owner Mode Top Banner */}
      {isOwnerMode && (
        <div className="bg-purple-950/80 border-b border-purple-800/40 px-3 py-1.5 text-xs text-purple-200 flex items-center justify-between">
          <span className="font-semibold">وضع مالك المنصة (وصول شامل)</span>
          <Link
            href="/owner"
            className="text-brand-cyan-400 hover:underline flex items-center gap-1 font-bold"
          >
            بوابة المالك <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Brand & Center Header */}
      <div className="p-4 border-b border-[#1C2541] flex flex-col gap-2">
        <Link href={`/center/${tenant.slug}`} className="inline-block transition-transform hover:scale-[1.01]">
          <BrandLogo theme="dark" width={145} height={36} priority />
        </Link>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-sm font-bold text-white truncate" title={tenant.nameAr}>
            {tenant.nameAr}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-cyan-500/15 text-brand-cyan-400 border border-brand-cyan-500/30 shrink-0">
            {tenant.subscriptionPlan === 'enterprise'
              ? 'مؤسسي'
              : tenant.subscriptionPlan === 'pro'
              ? 'برو'
              : 'بداية'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {visibleNavItems.map((item) => {
          const itemHref = item.href(tenant.slug);
          const isActive =
            itemHref === `/center/${tenant.slug}`
              ? pathname === itemHref
              : pathname.startsWith(itemHref);

          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={itemHref}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#111A38] text-brand-cyan-400 font-bold shadow-soft-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#111A38]/60'
              )}
            >
              {/* Electric Cyan Active Glow Indicator */}
              {isActive && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#00A3FF] rounded-l-full shadow-[0_0_12px_#00A3FF]" />
              )}

              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive
                    ? 'text-[#00A3FF]'
                    : 'text-slate-400 group-hover:text-slate-200'
                )}
              />

              <span className="flex-1 truncate">{item.titleAr}</span>

              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0',
                    item.badge === 'AI' ? 'bg-purple-600' : 'bg-emerald-600'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Card Footer */}
      <div className="p-3 border-t border-[#1C2541] bg-[#070B19]/50">
        <Link
          href={`/center/${tenant.slug}/profile`}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#111A38] transition-colors group"
        >
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-brand-cyan-500/40 bg-slate-800 shrink-0">
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
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">
                {currentUser.fullName.charAt(0)}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#0B132B]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate group-hover:text-brand-cyan-400 transition-colors">
              {currentUser.fullName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded border font-medium truncate',
                  roleMeta.color
                )}
              >
                {roleMeta.label}
              </span>
            </div>
          </div>

          <RTLIcon
            icon={ExternalLink}
            className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300"
          />
        </Link>
      </div>
    </aside>
  );
}
