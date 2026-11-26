'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';

export interface StaggeredCardGridProps {
  children: React.ReactNode[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  staggerDelay?: number;
}

export function StaggeredCardGrid({
  children,
  columns = 4,
  className = '',
  staggerDelay = 0.05,
}: StaggeredCardGridProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: isReduced ? 0 : staggerDelay * (options.speedMultiplier ?? 1),
      },
    },
  };

  const itemVariants: Variants = {
    hidden: isReduced ? { opacity: 1 } : { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: isReduced ? 0.001 : 0.22,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`grid ${colClasses} gap-4 sm:gap-6 ${className}`}
      dir="rtl"
    >
      {React.Children.map(children, (child, idx) => (
        <motion.div key={idx} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
