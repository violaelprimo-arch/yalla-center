'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { FileText, CheckCircle2, CloudUpload, AlertCircle } from 'lucide-react';

export interface UploadProgressProps {
  fileName?: string;
  fileSize?: string;
  progress?: number; // 0 to 100
  status?: 'idle' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  className?: string;
}

export function UploadProgressAnimation({
  fileName = 'مذكرة_الكيمياء_العضوية_الفصل_الثاني.pdf',
  fileSize = '4.8 ميجابايت',
  progress = 75,
  status = 'uploading',
  errorMessage,
  className = '',
}: UploadProgressProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  return (
    <div
      className={`p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            {status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : status === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-500" />
            ) : (
              <CloudUpload className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {fileName}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{fileSize}</p>
          </div>
        </div>

        <div className="text-left shrink-0">
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
            {status === 'completed' ? '100%' : `${Math.round(progress)}%`}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            status === 'completed'
              ? 'bg-emerald-500'
              : status === 'error'
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${status === 'completed' ? 100 : progress}%` }}
          transition={
            isReduced
              ? { duration: 0.001 }
              : { duration: 0.35, ease: 'easeOut' }
          }
        />
      </div>

      {errorMessage && status === 'error' && (
        <p className="text-xs text-rose-500 mt-2 font-medium">{errorMessage}</p>
      )}
    </div>
  );
}
