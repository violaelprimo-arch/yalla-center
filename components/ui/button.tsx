'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'cyan';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variantStyles = {
      primary:
        'bg-brand-cyan-500 hover:bg-brand-cyan-600 text-brand-navy-950 font-bold shadow-soft-sm active:scale-[0.98]',
      cyan:
        'bg-brand-cyan-500 hover:bg-brand-cyan-600 text-brand-navy-950 font-bold shadow-soft-sm active:scale-[0.98]',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold',
      outline:
        'border border-border bg-background hover:bg-muted text-foreground font-medium',
      ghost:
        'hover:bg-muted text-foreground font-medium',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-lg',
      md: 'h-10 px-4 text-sm rounded-lg',
      lg: 'h-12 px-6 text-base rounded-xl',
      icon: 'h-10 w-10 p-0 rounded-lg flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
