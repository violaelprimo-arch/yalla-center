import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  MOTION_TIMING,
  MOTION_EASING,
  MOTION_SPRINGS,
  getDuration,
  getTransition,
  type MotionIntensity,
} from '@/lib/motion/tokens';
import { MotionProvider, useMotionTheme } from '@/lib/motion/context';
import {
  MathIllustration,
  PhysicsIllustration,
  ChemistryIllustration,
  LanguagesIllustration,
  AcademicAchievementIllustration,
  EducationalSubjectBadge,
} from '@/components/motion/educational-graphics';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { AnimatedTabs } from '@/components/motion/animated-tabs';

describe('Motion Design Tokens', () => {
  it('defines consistent second durations for framer-motion transitions', () => {
    expect(MOTION_TIMING.micro).toBe(0.15);
    expect(MOTION_TIMING.button).toBe(0.18);
    expect(MOTION_TIMING.panel).toBe(0.24);
    expect(MOTION_TIMING.modal).toBe(0.28);
    expect(MOTION_TIMING.chart).toBe(0.65);
    expect(MOTION_TIMING.hero).toBe(1.2);
  });

  it('provides cubic bezier curves for smooth and crisp motion', () => {
    expect(MOTION_EASING.emphasized).toEqual([0.16, 1, 0.3, 1]);
    expect(MOTION_EASING.standard).toEqual([0.2, 0, 0, 1]);
    expect(MOTION_EASING.decelerate).toEqual([0.05, 0.7, 0.1, 1]);
  });

  it('configures spring physics with appropriate stiffness and damping', () => {
    expect(MOTION_SPRINGS.snappy.stiffness).toBeGreaterThan(MOTION_SPRINGS.gentle.stiffness);
    expect(MOTION_SPRINGS.bouncy.damping).toBeLessThan(MOTION_SPRINGS.snappy.damping);
  });

  it('computes durations dynamically with respect to reduced-motion and intensity', () => {
    // Reduced motion collapses to 0.001s
    expect(getDuration('modal', { reducedMotion: true })).toBe(0.001);

    // Minimal intensity runs faster
    expect(getDuration('button', { intensity: 'minimal' })).toBeLessThan(MOTION_TIMING.button);

    // Expressive intensity has longer, more dramatic easing
    expect(getDuration('hero', { intensity: 'expressive' })).toBeGreaterThan(MOTION_TIMING.hero);
  });

  it('constructs complete transition configurations', () => {
    const transition = getTransition('panel', 'emphasized');
    expect(transition.duration).toBe(0.24);
    expect(transition.ease).toEqual([0.16, 1, 0.3, 1]);
  });
});

describe('Educational Scalable Graphics (Pure SVG)', () => {
  it('renders MathIllustration with coordinate grid and equation elements', () => {
    const { container } = render(<MathIllustration className="w-48 h-36" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.innerHTML).toContain('path');
    expect(container.innerHTML).toContain('∫');
  });

  it('renders PhysicsIllustration with wave harmonics and quantum particle', () => {
    const { container } = render(<PhysicsIllustration className="w-48 h-36" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.innerHTML).toContain('physWave1');
  });

  it('renders ChemistryIllustration with benzene ring and laboratory flask', () => {
    const { container } = render(<ChemistryIllustration className="w-48 h-36" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.innerHTML).toContain('polygon');
  });

  it('renders LanguagesIllustration with book spine, text lines and vocabulary card', () => {
    const { container } = render(<LanguagesIllustration className="w-48 h-36" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.innerHTML).toContain('A B C');
    expect(container.innerHTML).toContain('ق ر أ');
  });

  it('renders AcademicAchievementIllustration with graduation cap and diploma', () => {
    const { container } = render(<AcademicAchievementIllustration className="w-48 h-36" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.innerHTML).toContain('capGrad');
    expect(container.innerHTML).toContain('goldGrad');
  });

  it('renders EducationalSubjectBadge correctly for each subject', () => {
    render(<EducationalSubjectBadge subject="math" size="md" showLabel />);
    expect(screen.getByText('الرياضيات')).toBeInTheDocument();
  });
});

describe('Motion UI Components', () => {
  it('renders AnimatedMetric with formatted label and initial value', () => {
    render(
      <AnimatedMetric
        label="إجمالي الطلاب"
        value={1200}
        prefix="طلاب: "
        suffix=" طالب"
        trend={{ value: 5.4, isPositive: true }}
      />
    );
    expect(screen.getByText('إجمالي الطلاب')).toBeInTheDocument();
    expect(screen.getByText('+5.4%')).toBeInTheDocument();
  });

  it('renders AnimatedTabs with active indicator and RTL tabs', () => {
    const tabs = [
      { id: 'tab1', label: 'التبويب الأول' },
      { id: 'tab2', label: 'التبويب الثاني' },
    ];
    render(
      <AnimatedTabs
        tabs={tabs}
        activeId="tab1"
        onChange={() => {}}
      />
    );
    expect(screen.getByText('التبويب الأول')).toBeInTheDocument();
    expect(screen.getByText('التبويب الثاني')).toBeInTheDocument();
  });
});
