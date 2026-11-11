import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandLogoDarkProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Official Yalla Center Logo for Dark / Midnight Navy Surfaces
 * Wordmark with Electric Ribbon + Off-White Typography (R1 compliance)
 */
export function BrandLogoDark({
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoDarkProps) {
  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <Image
        src="/brand/yalla-center-logo-dark.png"
        alt="يلا سنتر — Yalla Center"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        style={{ width, height }}
        className="object-contain object-center max-w-full"
      />
    </div>
  );
}
