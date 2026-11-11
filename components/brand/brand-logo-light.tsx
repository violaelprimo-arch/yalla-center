import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandLogoLightProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Official Yalla Center Logo for Light Surfaces and Printable A4 Sheets
 * Wordmark with Electric Ribbon + Midnight Navy Typography (R1 compliance)
 */
export function BrandLogoLight({
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoLightProps) {
  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <Image
        src="/brand/yalla-center-logo-light.png"
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
