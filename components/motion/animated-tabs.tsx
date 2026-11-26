'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface AnimatedTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export function AnimatedTabs({
  tabs,
  activeId,
  onChange,
  className = '',
  variant = 'pill',
}: AnimatedTabsProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 ${className}`}
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-150 z-10 ${
              isActive
                ? 'text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className={`absolute inset-0 rounded-xl z-[-1] ${
                  variant === 'pill'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md shadow-blue-500/20'
                    : 'border-b-2 border-cyan-500 bg-white/10'
                }`}
                transition={
                  isReduced
                    ? { duration: 0.001 }
                    : { type: 'spring', stiffness: 420, damping: 30 }
                }
              />
            )}
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
