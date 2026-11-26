'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { ChevronDown, Users, BookOpen, Clock, Calendar, Check, ArrowLeft } from 'lucide-react';

export interface MorphingCardProps {
  title: string;
  subtitle: string;
  badge?: string;
  studentsCount: number;
  timeSlot: string;
  classroomName: string;
  pricingModel: string;
  teacherName: string;
  className?: string;
}

export function MorphingCard({
  title = '3ث - كيمياء متميزة',
  subtitle = 'المرحلة الثانوية • الصف الثالث الثانوي',
  badge = 'نشطة',
  studentsCount = 42,
  timeSlot = 'السبت والأربعاء 05:00 م - 07:00 م',
  classroomName = 'قاعة الفارابي (الرئيسية)',
  pricingModel = 'نظام السنتر (المتوسط)',
  teacherName = 'أ. محمد عبد العزيز',
  className = '',
}: Partial<MorphingCardProps>) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <motion.div
      layout
      transition={
        isReduced
          ? { duration: 0.001 }
          : { type: 'spring', stiffness: 350, damping: 28 }
      }
      className={`rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 shadow-sm transition-shadow hover:shadow-md ${className}`}
      dir="rtl"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title={isExpanded ? 'طي التفاصيل' : 'عرض التفاصيل الموسعة'}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Primary KPI Row */}
      <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Users className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            <strong>{studentsCount}</strong> طالب مسجل
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Clock className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="truncate">{timeSlot}</span>
        </div>
      </div>

      {/* Expanded Details Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={isReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700/80 space-y-3 overflow-hidden text-xs"
          >
            <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">المعلم المسؤول:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{teacherName}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">القاعة المخصصة:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{classroomName}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">نظام المحاسبة:</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">{pricingModel}</span>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
                <span>فتح كشف الحضور والدرجات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
