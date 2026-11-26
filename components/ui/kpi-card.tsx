'use client';

import * as React from 'react';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface KpiCardProps {
  title: string;
  value: number | string;
  formatValue?: (val: number) => string;
  suffix?: string;
  prefix?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    direction?: 'up' | 'down' | 'neutral';
  };
  tone?: 'cyan' | 'navy' | 'success' | 'warning' | 'destructive';
  animateCount?: boolean;
  loading?: boolean;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const toneIconStyles: Record<NonNullable<KpiCardProps['tone']>, string> = {
  cyan: 'bg-brand-cyan-500/15 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/25',
  navy: 'bg-brand-navy-900/10 dark:bg-brand-navy-800 text-brand-navy-900 dark:text-brand-cyan-400 border-brand-navy-700/20',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  destructive: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
};

function checkPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
}

export function KpiCard({
  title,
  value,
  formatValue,
  suffix,
  prefix,
  icon: Icon,
  trend,
  tone = 'cyan',
  animateCount = true,
  loading = false,
  subtitle,
  onClick,
  className,
}: KpiCardProps) {
  const numericTarget = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const [displayNumber, setDisplayNumber] = React.useState<number>(() => numericTarget ?? 0);

  React.useEffect(() => {
    if (numericTarget === null) return;

    if (
      !animateCount ||
      checkPrefersReducedMotion() ||
      typeof requestAnimationFrame !== 'function'
    ) {
      setDisplayNumber(numericTarget);
      return;
    }

    const durationMs = 420;
    const startVal = 0;
    let rafId = 0;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (numericTarget - startVal) * eased;
      setDisplayNumber(progress >= 1 ? numericTarget : current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [numericTarget, animateCount]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="جاري التحميل..."
        dir="rtl"
        className={cn(
          'rounded-2xl border border-border bg-card p-5 shadow-soft-sm space-y-4',
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Skeleton variant="text" className="h-4 w-28" />
          <Skeleton variant="rect" className="h-10 w-10 rounded-xl shrink-0" />
        </div>
        <Skeleton variant="text" className="h-8 w-32" />
        <Skeleton variant="text" className="h-4 w-24" />
        <span className="sr-only">جاري التحميل...</span>
      </div>
    );
  }

  const formattedValue =
    numericTarget !== null
      ? formatValue
        ? formatValue(Math.round(displayNumber * 100) / 100)
        : Math.round(displayNumber).toLocaleString('ar-EG')
      : value;

  const trendDirection =
    trend?.direction ??
    (trend ? (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral') : undefined);

  const trendBadgeStyles =
    trendDirection === 'up'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : trendDirection === 'down'
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
        : 'bg-muted text-muted-foreground border-border';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 text-start">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {prefix && (
              <span className="text-sm font-semibold text-muted-foreground">{prefix}</span>
            )}
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
              {formattedValue}
            </span>
            {suffix && (
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              'h-11 w-11 rounded-xl border flex items-center justify-center shrink-0',
              toneIconStyles[tone]
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border tabular-nums',
                trendBadgeStyles
              )}
            >
              {trendDirection === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : trendDirection === 'down' ? (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {trend.value > 0 ? `+${trend.value}` : trend.value}%
              </span>
              {trend.label && <span className="font-medium opacity-90">{trend.label}</span>}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
          )}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        dir="rtl"
        onClick={onClick}
        className={cn(
          'w-full text-start card-elevated card-interactive p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 motion-reduce:transition-none',
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div dir="rtl" className={cn('card-elevated p-5', className)}>
      {content}
    </div>
  );
}
