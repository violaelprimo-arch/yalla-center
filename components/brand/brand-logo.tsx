import React from 'react';
import { BrandLogoLight } from './brand-logo-light';
import { BrandLogoDark } from './brand-logo-dark';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  theme?: 'auto' | 'light' | 'dark';
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Adaptive Yalla Center Logo Component
 * - In 'auto' mode: leverages CSS dark:hidden / hidden dark:block to switch seamlessly
 *   without SSR hydration mismatch or client-side flicker.
 * - In 'light' mode: forces light logo (essential for printable A4 sheets).
 * - In 'dark' mode: forces dark logo (essential for deep navy sidebars).
 */
export function BrandLogo({
  theme = 'auto',
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoProps) {
  if (theme === 'light') {
    return <BrandLogoLight width={width} height={height} className={className} priority={priority} />;
  }

  if (theme === 'dark') {
    return <BrandLogoDark width={width} height={height} className={className} priority={priority} />;
  }

  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <div className="dark:hidden">
        <BrandLogoLight width={width} height={height} priority={priority} />
      </div>
      <div className="hidden dark:block">
        <BrandLogoDark width={width} height={height} priority={priority} />
      </div>
    </div>
  );
}
