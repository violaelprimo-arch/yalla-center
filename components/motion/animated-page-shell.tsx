'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { MOTION_TIMING, MOTION_EASING } from '@/lib/motion/tokens';

export interface AnimatedPageShellProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  badge?: React.ReactNode;
}

export function AnimatedPageShell({
  children,
  className = '',
  title,
  description,
  headerAction,
  badge,
}: AnimatedPageShellProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  return (
    <motion.div
      initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={isReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{
        duration: isReduced ? 0.001 : MOTION_TIMING.panel * (options.speedMultiplier ?? 1),
        ease: MOTION_EASING.emphasized,
      }}
      className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${className}`}
      dir="rtl"
    >
      {(title || headerAction) && (
        <motion.div
          initial={isReduced ? { opacity: 1 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: isReduced ? 0.001 : MOTION_TIMING.button * (options.speedMultiplier ?? 1),
            ease: MOTION_EASING.emphasized,
            delay: isReduced ? 0 : 0.05,
          }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {badge}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {title}
              </h1>
            </div>
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {headerAction}
            </div>
          )}
        </motion.div>
      )}

      <div>{children}</div>
    </motion.div>
  );
}
