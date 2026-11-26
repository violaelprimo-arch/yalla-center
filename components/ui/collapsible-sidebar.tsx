'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RTLIcon } from '@/components/ui/rtl-icon';

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  children?: SidebarNavItem[];
}

export interface CollapsibleSidebarProps {
  items: SidebarNavItem[];
  activePath: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  portalBadge?: string;
  portalTitle?: string;
  storageKey?: string;
  className?: string;
}

function isRouteActive(activePath: string, href: string): boolean {
  if (activePath === href) return true;
  if (href.length > 1 && activePath.startsWith(`${href}/`)) return true;
  return false;
}

export function CollapsibleSidebar({
  items,
  activePath,
  collapsed,
  onCollapsedChange,
  defaultCollapsed = false,
  mobileOpen = false,
  onMobileOpenChange,
  headerSlot,
  footerSlot,
  portalBadge,
  portalTitle,
  storageKey,
  className,
}: CollapsibleSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState<boolean>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved === 'true') return true;
        if (saved === 'false') return false;
      } catch {
        // Ignore storage access errors
      }
    }
    return defaultCollapsed;
  });

  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;

  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children?.some((child) => isRouteActive(activePath, child.href))) {
        initial[item.id] = true;
      }
    }
    return initial;
  });

  React.useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMobileOpenChange?.(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileOpenChange]);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    if (collapsed === undefined) {
      setInternalCollapsed(next);
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // Ignore storage access errors
        }
      }
    }
    onCollapsedChange?.(next);
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNavItems = (forMobile: boolean) => {
    const compact = isCollapsed && !forMobile;
    return (
      <nav aria-label={portalTitle ?? 'القائمة الرئيسية'} className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isRouteActive(activePath, item.href);
          const hasChildren = Boolean(item.children && item.children.length > 0);
          const isGroupOpen = Boolean(expandedGroups[item.id]);

          if (hasChildren && !compact) {
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={isGroupOpen}
                  onClick={() => toggleGroup(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500',
                    active
                      ? 'bg-brand-navy-850 text-brand-cyan-400 border border-brand-cyan-500/30'
                      : 'text-slate-300 hover:bg-brand-navy-850 hover:text-white'
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-brand-cyan-400" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none',
                      isGroupOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isGroupOpen && (
                  <div className="ps-4 space-y-1 border-s border-brand-navy-800 ms-4">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isRouteActive(activePath, child.href);
                      return (
                        <Link
                          key={child.id}
                          href={child.href}
                          aria-current={childActive ? 'page' : undefined}
                          onClick={forMobile ? () => onMobileOpenChange?.(false) : undefined}
                          className={cn(
                            'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500',
                            childActive
                              ? 'bg-brand-cyan-500/15 text-brand-cyan-400 font-bold'
                              : 'text-slate-300 hover:bg-brand-navy-850 hover:text-white'
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <ChildIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{child.label}</span>
                          </span>
                          {child.badge !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-cyan-500/20 text-brand-cyan-400 tabular-nums">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              title={compact ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={forMobile ? () => onMobileOpenChange?.(false) : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500',
                compact && 'justify-center px-2',
                active
                  ? 'bg-brand-navy-850 text-white border border-brand-cyan-500/35 shadow-soft-sm'
                  : 'text-slate-300 hover:bg-brand-navy-850 hover:text-white'
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute start-0 top-2 bottom-2 w-1 rounded-full bg-brand-cyan-600 shadow-[0_0_10px_#00A3FF]"
                />
              )}
              <Icon
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-brand-cyan-400' : 'text-slate-400'
                )}
              />
              {!compact && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-cyan-500/20 text-brand-cyan-400 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        dir="rtl"
        data-collapsed={isCollapsed ? 'true' : 'false'}
        className={cn(
          'hidden lg:flex flex-col shrink-0 bg-[#0B132B] text-[#F8FAFC] border-e border-[#1C2541] transition-[width] duration-200 motion-reduce:transition-none',
          isCollapsed ? 'w-20' : 'w-64',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-[#1C2541]">
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              {headerSlot ?? (
                <div className="space-y-1 text-start">
                  {portalBadge && (
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-cyan-500/20 text-brand-cyan-400">
                      {portalBadge}
                    </span>
                  )}
                  {portalTitle && (
                    <p className="text-sm font-bold text-white truncate">{portalTitle}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
            className="h-9 w-9 rounded-xl inline-flex items-center justify-center text-slate-300 hover:text-white hover:bg-brand-navy-850 border border-brand-navy-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 shrink-0"
          >
            <RTLIcon
              icon={ChevronRight}
              flip={!isCollapsed}
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>
        </div>

        {renderNavItems(false)}

        {footerSlot && (
          <div className="p-3 border-t border-[#1C2541]">{footerSlot}</div>
        )}
      </aside>

      {/* Mobile RTL Slide-Over Sidebar */}
      {mobileOpen && (
        <div dir="rtl" className="fixed inset-0 z-50 lg:hidden">
          <div
            data-testid="sidebar-mobile-backdrop"
            aria-hidden="true"
            onClick={() => onMobileOpenChange?.(false)}
            className="fixed inset-0 bg-brand-navy-950/75 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={portalTitle ?? 'القائمة الجانبية'}
            className="fixed inset-y-0 start-0 z-10 w-72 max-w-[85vw] flex flex-col bg-[#0B132B] text-[#F8FAFC] border-e border-[#1C2541] shadow-soft-xl animate-yc-drawer-start motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-[#1C2541]">
              <div className="min-w-0 flex-1">
                {headerSlot ?? (
                  <div className="space-y-1 text-start">
                    {portalBadge && (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-cyan-500/20 text-brand-cyan-400">
                        {portalBadge}
                      </span>
                    )}
                    {portalTitle && (
                      <p className="text-sm font-bold text-white truncate">{portalTitle}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onMobileOpenChange?.(false)}
                aria-label="إغلاق القائمة"
                className="h-9 w-9 rounded-xl inline-flex items-center justify-center text-slate-300 hover:text-white hover:bg-brand-navy-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {renderNavItems(true)}

            {footerSlot && (
              <div className="p-3 border-t border-[#1C2541]">{footerSlot}</div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

export interface MobileBottomNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  activePath: string;
  className?: string;
}

export function MobileBottomNav({
  items,
  activePath,
  className,
}: MobileBottomNavProps) {
  const visibleItems = items.slice(0, 5);

  return (
    <nav
      dir="rtl"
      aria-label="التنقل السريع"
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe border-t border-border bg-card/95 backdrop-blur-md shadow-soft-lg',
        className
      )}
    >
      <ul className="grid grid-flow-col auto-cols-fr items-center px-1 py-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isRouteActive(activePath, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 min-h-[48px] px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500',
                  active
                    ? 'text-brand-cyan-600 dark:text-brand-cyan-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="absolute -top-1.5 -end-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-cyan-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
