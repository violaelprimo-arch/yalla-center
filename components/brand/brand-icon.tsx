import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

/**
 * Official Yalla Center Squircle Brand Icon
 * Preserves 1:1 square aspect ratio without distortion (R1 compliance)
 */
export function BrandIcon({
  size = 'md',
  className,
  priority = false,
  alt = 'Yalla Center Icon',
}: BrandIconProps) {
  const dimension = typeof size === 'number' ? size : sizeMap[size];

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 aspect-square overflow-hidden rounded-xl',
        className
      )}
      style={{ width: dimension, height: dimension }}
    >
      <Image
        src="/brand/yalla-center-icon.png"
        alt={alt}
        width={dimension}
        height={dimension}
        priority={priority}
        unoptimized
        className="object-contain w-full h-full"
      />
    </div>
  );
}
