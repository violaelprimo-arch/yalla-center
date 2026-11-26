'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { CheckCircle2, AlertTriangle, XCircle, QrCode, ScanLine, UserCheck } from 'lucide-react';

export interface AttendanceScanCardProps {
  studentName?: string;
  studentCode?: string;
  groupName?: string;
  stageName?: string;
  balanceDue?: number;
  status?: 'idle' | 'scanning' | 'success' | 'duplicate' | 'error';
  onScanTrigger?: () => void;
  className?: string;
}

export function AttendanceScanAnimation({
  studentName = 'زياد أحمد إبراهيم',
  studentCode = 'STD-99042',
  groupName = '3ث - كيمياء متميزة (السبت 5:00م)',
  stageName = 'الصف الثالث الثانوي',
  balanceDue = 0,
  status = 'idle',
  onScanTrigger,
  className = '',
}: AttendanceScanCardProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm ${className}`}
      dir="rtl"
    >
      {/* Laser Scan-line Effect */}
      {status === 'scanning' && !isReduced && (
        <motion.div
          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#06B6D4] z-20 pointer-events-none"
          initial={{ top: '0%' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              تسجيل الحضور الفوري والباركود
            </h4>
            <p className="text-xs text-slate-500">مسح ليزري وتحديث لحظي مؤكد</p>
          </div>
        </div>

        <button
          onClick={onScanTrigger}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
        >
          محاكاة المسح
        </button>
      </div>

      {/* Main Student Card Surface */}
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={isReduced ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <motion.div
                initial={isReduced ? { scale: 1 } : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0"
              >
                <CheckCircle2 className="w-6 h-6" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-extrabold text-slate-900 dark:text-slate-100">
                    {studentName}
                  </h5>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {studentCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {groupName}
                </p>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 text-white">
                تم التأكيد والتوثيق
              </span>
            </div>
          </motion.div>
        ) : status === 'duplicate' ? (
          <motion.div
            key="duplicate"
            initial={isReduced ? { opacity: 1 } : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-700 dark:text-amber-400 text-xs font-semibold"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>تنبيه: الطالب مسجل حضور بالفعل في هذه الحصة اليوم (مسح مكرر)</span>
          </motion.div>
        ) : status === 'error' ? (
          <motion.div
            key="error"
            initial={isReduced ? { opacity: 1 } : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-700 dark:text-rose-400 text-xs font-semibold"
          >
            <XCircle className="w-5 h-5 shrink-0" />
            <span>خطأ: الرمز غير مسجل أو الطالب غير مسند لهذه المجموعة</span>
          </motion.div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-slate-500 text-xs">
            <div className="flex items-center gap-3">
              <QrCode className="w-8 h-8 opacity-40" />
              <span>مرر الباركود أو بطاقة الطالب بجهاز الليزر لبدء التسجيل الفوري...</span>
            </div>
            <span className="font-mono text-[11px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
              جاهز للاستقبال
            </span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
