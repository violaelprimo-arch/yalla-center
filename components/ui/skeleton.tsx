import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
  animated?: boolean;
}

export function Skeleton({
  className,
  variant = 'rect',
  animated = true,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    rect: 'rounded-xl',
    circle: 'rounded-full',
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden bg-muted/80 dark:bg-brand-navy-800/70',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {animated && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-white/30 dark:via-brand-cyan-400/10 to-transparent animate-yc-shimmer motion-reduce:animate-none"
        />
      )}
    </div>
  );
}

export interface SkeletonCardProps {
  lines?: number;
  showHeader?: boolean;
  className?: string;
}

export function SkeletonCard({
  lines = 3,
  showHeader = true,
  className,
}: SkeletonCardProps) {
  const widths = ['w-full', 'w-5/6', 'w-2/3', 'w-4/5', 'w-1/2'];
  return (
    <div
      role="status"
      aria-label="جاري التحميل..."
      dir="rtl"
      className={cn(
        'rounded-2xl border border-border bg-card p-6 shadow-soft-sm space-y-4',
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton variant="text" className="h-5 w-1/3" />
            <Skeleton variant="text" className="h-3.5 w-1/2" />
          </div>
          <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: Math.max(1, lines) }).map((_, idx) => (
          <Skeleton
            key={idx}
            variant="text"
            className={cn('h-3.5', widths[idx % widths.length])}
          />
        ))}
      </div>
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
}

export interface SkeletonTableRowsProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTableRows({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableRowsProps) {
  const colWidths = ['w-3/4', 'w-2/3', 'w-1/2', 'w-4/5', 'w-1/3'];
  return (
    <div
      role="status"
      aria-label="جاري التحميل..."
      dir="rtl"
      className={cn('w-full space-y-3 py-2', className)}
    >
      {Array.from({ length: Math.max(1, rows) }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="grid gap-4 items-center px-4 py-2.5 rounded-xl border border-border/50 bg-background/50 dark:bg-brand-navy-900/40"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: Math.max(1, columns) }).map((__, cIdx) => (
            <Skeleton
              key={cIdx}
              variant="text"
              className={cn('h-4', colWidths[(rIdx + cIdx) % colWidths.length])}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
}

export interface SkeletonKpiGridProps {
  count?: number;
  className?: string;
}

export function SkeletonKpiGrid({ count = 4, className }: SkeletonKpiGridProps) {
  return (
    <div
      role="status"
      aria-label="جاري التحميل..."
      dir="rtl"
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
        className
      )}
    >
      {Array.from({ length: Math.max(1, count) }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="rect" className="h-10 w-10 rounded-xl shrink-0" />
          </div>
          <Skeleton variant="text" className="h-7 w-28" />
          <div className="flex items-center gap-2">
            <Skeleton variant="rect" className="h-5 w-14 rounded-full" />
            <Skeleton variant="text" className="h-3.5 w-20" />
          </div>
        </div>
      ))}
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
}

export interface SkeletonProfileProps {
  className?: string;
}

export function SkeletonProfile({ className }: SkeletonProfileProps) {
  return (
    <div
      role="status"
      aria-label="جاري التحميل..."
      dir="rtl"
      className={cn(
        'rounded-2xl border border-border bg-card p-6 shadow-soft-sm',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Skeleton variant="circle" className="h-16 w-16 shrink-0" />
        <div className="flex-1 space-y-2.5 w-full">
          <Skeleton variant="text" className="h-5 w-44" />
          <Skeleton variant="text" className="h-4 w-64 max-w-full" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
            <Skeleton variant="rect" className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
}
