'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface AnimatedMetricProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: {
    value: number;
    isPositive?: boolean;
    periodText?: string;
  };
  icon?: React.ReactNode;
  sparklineData?: number[];
  color?: 'blue' | 'cyan' | 'emerald' | 'amber' | 'indigo' | 'purple';
  className?: string;
}

const COLOR_MAP = {
  blue: {
    bg: 'from-blue-500/10 to-indigo-500/5 dark:from-blue-950/40 dark:to-indigo-950/20',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    line: '#3B82F6',
  },
  purple: {
    bg: 'from-purple-500/10 to-fuchsia-500/5 dark:from-purple-950/40 dark:to-fuchsia-950/20',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    line: '#A855F7',
  },
  cyan: {
    bg: 'from-cyan-500/10 to-sky-500/5 dark:from-cyan-950/40 dark:to-sky-950/20',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    line: '#06B6D4',
  },
  emerald: {
    bg: 'from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-teal-950/20',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    line: '#10B981',
  },
  amber: {
    bg: 'from-amber-500/10 to-orange-500/5 dark:from-amber-950/40 dark:to-orange-950/20',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    line: '#F59E0B',
  },
  indigo: {
    bg: 'from-indigo-500/10 to-purple-500/5 dark:from-indigo-950/40 dark:to-purple-950/20',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    line: '#6366F1',
  },
};

export function AnimatedMetric({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  trend,
  icon,
  sparklineData,
  color = 'blue',
  className = '',
}: AnimatedMetricProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [displayValue, setDisplayValue] = useState<number>(isReduced ? value : 0);
  const currentValRef = useRef<number>(isReduced ? value : 0);

  useEffect(() => {
    if (isReduced) {
      setDisplayValue(value);
      currentValRef.current = value;
      return;
    }

    const start = currentValRef.current;
    const end = value;
    const durationMs = 650 * (options.speedMultiplier ?? 1);
    const startTime = performance.now();

    const animateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Easing: easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (end - start) * ease;
      setDisplayValue(current);
      currentValRef.current = current;

      if (progress < 1) {
        requestAnimationFrame(animateNumber);
      } else {
        setDisplayValue(end);
        currentValRef.current = end;
      }
    };

    const frameId = requestAnimationFrame(animateNumber);
    return () => cancelAnimationFrame(frameId);
  }, [value, isReduced, options.speedMultiplier]);

  const themeConfig = COLOR_MAP[color] || COLOR_MAP.blue;

  // Generate SVG Sparkline Points
  const generateSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 28;

    const points = sparklineData
      .map((d, i) => {
        const x = (i / (sparklineData.length - 1)) * width;
        const y = height - ((d - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={themeConfig.line}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <motion.div
      whileHover={
        isReduced
          ? undefined
          : {
              y: -3,
              boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.1)',
            }
      }
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`relative p-5 rounded-2xl bg-gradient-to-br ${themeConfig.bg} bg-white dark:bg-slate-900 border ${themeConfig.border} transition-colors ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {label}
        </span>
        {icon && (
          <div className={`p-2 rounded-xl ${themeConfig.iconBg}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
          <span>{prefix}</span>
          <span>
            {displayValue.toLocaleString('ar-EG', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}
          </span>
          {suffix && <span className="text-sm font-semibold mr-1">{suffix}</span>}
        </div>

        {sparklineData && (
          <div className="hidden sm:block opacity-75">
            {generateSparkline()}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trend.isPositive ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              +{trend.value}%
            </span>
          ) : trend.value === 0 ? (
            <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium">
              <Minus className="w-3.5 h-3.5" />
              0%
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              {trend.value}%
            </span>
          )}
          {trend.periodText && (
            <span className="text-slate-400 dark:text-slate-500">
              {trend.periodText}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
