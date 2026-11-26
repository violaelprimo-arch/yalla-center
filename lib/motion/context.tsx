'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionIntensity, MotionConfigOptions } from './tokens';

interface MotionContextValue {
  intensity: MotionIntensity;
  setIntensity: (intensity: MotionIntensity) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
  options: MotionConfigOptions;
}

const MotionContext = createContext<MotionContextValue>({
  intensity: 'balanced',
  setIntensity: () => {},
  speed: 1,
  setSpeed: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
  options: { intensity: 'balanced', speedMultiplier: 1, reducedMotion: false },
});

export function MotionProvider({
  children,
  defaultIntensity = 'balanced',
}: {
  children: React.ReactNode;
  defaultIntensity?: MotionIntensity;
}) {
  const [intensity, setIntensity] = useState<MotionIntensity>(defaultIntensity);
  const [speed, setSpeed] = useState<number>(1);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const options: MotionConfigOptions = {
    intensity,
    speedMultiplier: speed,
    reducedMotion,
  };

  return (
    <MotionContext.Provider
      value={{
        intensity,
        setIntensity,
        speed,
        setSpeed,
        reducedMotion,
        setReducedMotion,
        options,
      }}
    >
      {children}
    </MotionContext.Provider>
  );
}

export function useMotionTheme(): MotionContextValue {
  return useContext(MotionContext);
}
