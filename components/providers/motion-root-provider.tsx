'use client';

import React from 'react';
import { MotionProvider } from '@/lib/motion/context';

export function MotionRootProvider({ children }: { children: React.ReactNode }) {
  return <MotionProvider defaultIntensity="balanced">{children}</MotionProvider>;
}
