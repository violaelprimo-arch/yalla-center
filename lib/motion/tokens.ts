/**
 * Yalla Center Motion Design System — Core Tokens & Configurations
 * Path: lib/motion/tokens.ts
 *
 * Implements centralized motion timing, cubic-bezier curves, spring dynamics,
 * and intensity presets ('minimal' | 'balanced' | 'expressive').
 */

export type MotionIntensity = 'minimal' | 'balanced' | 'expressive';

export const MOTION_TIMING = {
  micro: 0.15, // 120-180ms
  button: 0.18, // 140-220ms
  panel: 0.24, // 180-280ms
  modal: 0.28, // 220-360ms
  chart: 0.65, // 450-900ms
  hero: 1.2, // 900-1500ms
} as const;

export const MOTION_EASING = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
  decelerate: [0.05, 0.7, 0.1, 1] as const,
  accelerate: [0.3, 0, 0.8, 0.15] as const,
  smoothOut: [0.22, 1, 0.36, 1] as const,
} as const;

export const MOTION_SPRINGS = {
  snappy: { type: 'spring', stiffness: 450, damping: 32 } as const,
  balanced: { type: 'spring', stiffness: 320, damping: 28 } as const,
  gentle: { type: 'spring', stiffness: 180, damping: 22 } as const,
  bouncy: { type: 'spring', stiffness: 260, damping: 16 } as const,
} as const;

export interface MotionConfigOptions {
  intensity?: MotionIntensity;
  reducedMotion?: boolean;
  speedMultiplier?: number;
}

export function getDuration(
  key: keyof typeof MOTION_TIMING,
  options?: MotionConfigOptions
): number {
  if (options?.reducedMotion) return 0.001;
  const base = MOTION_TIMING[key];
  const multiplier = options?.speedMultiplier ?? 1;
  const intensityFactor =
    options?.intensity === 'minimal'
      ? 0.7
      : options?.intensity === 'expressive'
      ? 1.25
      : 1.0;
  return Number((base * multiplier * intensityFactor).toFixed(3));
}

export function getTransition(
  timingKey: keyof typeof MOTION_TIMING,
  easing: keyof typeof MOTION_EASING = 'emphasized',
  options?: MotionConfigOptions
) {
  if (options?.reducedMotion) {
    return { duration: 0.001, ease: 'linear' };
  }
  return {
    duration: getDuration(timingKey, options),
    ease: MOTION_EASING[easing],
  };
}

export const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: (custom: { delay?: number; reducedMotion?: boolean } = {}) => ({
    opacity: 1,
    y: 0,
    transition: custom.reducedMotion
      ? { duration: 0.001 }
      : {
          duration: MOTION_TIMING.panel,
          ease: MOTION_EASING.emphasized,
          delay: custom.delay ?? 0,
        },
  }),
  exit: (custom: { reducedMotion?: boolean } = {}) => ({
    opacity: 0,
    y: -8,
    transition: custom.reducedMotion
      ? { duration: 0.001 }
      : { duration: MOTION_TIMING.button, ease: MOTION_EASING.accelerate },
  }),
};

export const SCALE_FADE_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (custom: { delay?: number; reducedMotion?: boolean } = {}) => ({
    opacity: 1,
    scale: 1,
    transition: custom.reducedMotion
      ? { duration: 0.001 }
      : {
          duration: MOTION_TIMING.modal,
          ease: MOTION_EASING.emphasized,
          delay: custom.delay ?? 0,
        },
  }),
  exit: (custom: { reducedMotion?: boolean } = {}) => ({
    opacity: 0,
    scale: 0.96,
    transition: custom.reducedMotion
      ? { duration: 0.001 }
      : { duration: MOTION_TIMING.micro, ease: MOTION_EASING.accelerate },
  }),
};

export const STAGGER_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: (custom: { stagger?: number; delayChildren?: number } = {}) => ({
    opacity: 1,
    transition: {
      staggerChildren: custom.stagger ?? 0.06,
      delayChildren: custom.delayChildren ?? 0.02,
    },
  }),
};
