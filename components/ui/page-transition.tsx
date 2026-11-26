'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  transitionKey?: string;
}

export function PageTransition({
  children,
  className,
  transitionKey,
}: PageTransitionProps) {
  return (
    <div
      key={transitionKey}
      dir="rtl"
      data-transition-key={transitionKey}
      className={cn(
        'animate-yc-page-enter gpu-accelerated motion-reduce:animate-none motion-reduce:transform-none',
        className
      )}
    >
      {children}
    </div>
  );
}
