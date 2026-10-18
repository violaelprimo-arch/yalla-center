import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'navy' | 'success' | 'warning' | 'destructive' | 'outline' | 'default';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const variantStyles = {
    default:
      'bg-muted text-muted-foreground border-border',
    cyan:
      'bg-brand-cyan-500/15 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/30',
    navy:
      'bg-brand-navy-800 text-brand-cyan-400 border-brand-navy-700',
    success:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    destructive:
      'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    outline:
      'border border-border text-foreground bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
