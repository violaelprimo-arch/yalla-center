'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { Award, Trophy, Star } from 'lucide-react';

export interface GradeProgressProps {
  score: number; // e.g. 94
  totalMarks?: number; // e.g. 100
  title?: string;
  examName?: string;
  rank?: string;
  size?: number; // diameter in px
  strokeWidth?: number;
  className?: string;
}

export function GradeProgressAnimation({
  score = 92,
  totalMarks = 100,
  title = 'النتيجة العامة',
  examName = 'امتحان الفيزياء الدورية — الأسبوع 8',
  rank = 'المركز الثاني على الدفعة',
  size = 140,
  strokeWidth = 10,
  className = '',
}: GradeProgressProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  const percentage = Math.min(Math.round((score / totalMarks) * 100), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const [animatedScore, setAnimatedScore] = useState<number>(isReduced ? score : 0);

  useEffect(() => {
    if (isReduced) {
      setAnimatedScore(score);
      return;
    }

    let start = 0;
    const durationMs = 800 * (options.speedMultiplier ?? 1);
    const startTime = performance.now();

    const frame = (time: number) => {
      const progress = Math.min((time - startTime) / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(start + (score - start) * ease));
      if (progress < 1) requestAnimationFrame(frame);
    };

    const frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [score, isReduced, options.speedMultiplier]);

  const getColor = () => {
    if (percentage >= 85) return { stroke: '#10B981', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-600' };
    if (percentage >= 70) return { stroke: '#06B6D4', text: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-600' };
    if (percentage >= 50) return { stroke: '#F59E0B', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-600' };
    return { stroke: '#EF4444', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-500/10 text-rose-600' };
  };

  const theme = getColor();

  return (
    <div
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6 ${className}`}
      dir="rtl"
    >
      {/* Circular Progress SVG */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth={strokeWidth}
          />
          {/* Animated Foreground Arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={isReduced ? { strokeDashoffset } : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: isReduced ? 0.001 : 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-2xl font-black font-mono tracking-tight ${theme.text}`}>
            %{animatedScore}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {score} من {totalMarks}
          </span>
        </div>
      </div>

      {/* Details Meta */}
      <div className="space-y-2 text-center sm:text-right flex-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span>{rank}</span>
        </div>
        <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
          {examName}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          أداء ممتاز يتجاوز متوسط المجموعة بنسبة 18%. تم توثيق النتيجة في السجل الأكاديمي الموحد.
        </p>
      </div>
    </div>
  );
}
