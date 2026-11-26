'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Wallet,
  Settings,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ScanLine,
} from 'lucide-react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export function MotionSidebar({
  activeId = 'dashboard',
  onSelect,
  className = '',
}: {
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [currentActive, setCurrentActive] = useState<string>(activeId);

  const navItems: SidebarNavItem[] = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'students', label: 'شؤون الطلاب', icon: <Users className="w-5 h-5" />, badge: '142' },
    { id: 'teachers', label: 'شؤون المعلمين', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'reception', label: 'الاستقبال والحضور', icon: <ScanLine className="w-5 h-5" /> },
    { id: 'groups', label: 'الحصص والمجموعات', icon: <Calendar className="w-5 h-5" /> },
    { id: 'materials', label: 'المذكرات والملفات', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'finance', label: 'الخزينة والمالية', icon: <Wallet className="w-5 h-5" /> },
    { id: 'settings', label: 'الإعدادات العامة', icon: <Settings className="w-5 h-5" /> },
  ];

  const handleItemClick = (id: string) => {
    setCurrentActive(id);
    onSelect?.(id);
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 256 }}
      transition={
        isReduced
          ? { duration: 0.001 }
          : { type: 'spring', stiffness: 350, damping: 30 }
      }
      className={`relative h-[560px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between shadow-sm overflow-hidden ${className}`}
      dir="rtl"
    >
      <div>
        {/* Header Branding Row */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-black flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              Y
            </div>
            {!isCollapsed && (
              <motion.div
                initial={isReduced ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-w-0"
              >
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                  يلا سنتر
                </h3>
                <p className="text-[10px] text-slate-400 truncate">النظام التعليمي الذكي</p>
              </motion.div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentActive === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors z-10 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarIndicator"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md shadow-blue-500/25 z-[-1]"
                    transition={
                      isReduced
                        ? { duration: 0.001 }
                        : { type: 'spring', stiffness: 400, damping: 28 }
                    }
                  />
                )}

                <span className="shrink-0">{item.icon}</span>

                {!isCollapsed && (
                  <motion.span
                    initial={isReduced ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate flex-1 text-right"
                  >
                    {item.label}
                  </motion.span>
                )}

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
          م
        </div>
        {!isCollapsed && (
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              مدير السنتر
            </p>
            <p className="text-[10px] text-slate-400 truncate">سنتر الماهر النموذجي</p>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}
