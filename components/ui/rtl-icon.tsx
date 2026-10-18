import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RTLIconProps extends React.ComponentPropsWithoutRef<'svg'> {
  icon: LucideIcon;
  flip?: boolean;
  className?: string;
}

/**
 * Direction-aware Lucide Icon wrapper
 * Reverses directional icons (arrows, chevrons, pagination) in Arabic RTL context
 */
export function RTLIcon({ icon: Icon, flip = true, className, ...props }: RTLIconProps) {
  return (
    <Icon
      className={cn(
        'shrink-0 transition-transform',
        flip && 'rtl:rotate-180',
        className
      )}
      {...props}
    />
  );
}
