'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';

export interface EducationalGraphicProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  animated?: boolean;
}

const SIZE_MAP = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-28 h-28',
  hero: 'w-48 h-48 md:w-64 md:h-64',
};

/**
 * 1. Mathematics: Coordinate systems, calculus integral & sum, geometry
 */
export function MathIllustration({
  className = '',
  size = 'md',
  animated = true,
}: EducationalGraphicProps) {
  const { options } = useMotionTheme();
  const shouldAnimate = animated && !options.reducedMotion;

  return (
    <div className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="mathGrad1" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id="mathCurveGrad" x1="30" y1="160" x2="170" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset="0.5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
          <radialGradient id="mathNodeGlow" cx="50%" cy="50%" r="50%">
            <stop stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Coordinate Grid Background */}
        <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 4">
          <line x1="40" y1="40" x2="160" y2="40" />
          <line x1="40" y1="80" x2="160" y2="80" />
          <line x1="40" y1="120" x2="160" y2="120" />
          <line x1="40" y1="160" x2="160" y2="160" />
          <line x1="40" y1="40" x2="40" y2="160" />
          <line x1="80" y1="40" x2="80" y2="160" />
          <line x1="120" y1="40" x2="120" y2="160" />
          <line x1="160" y1="40" x2="160" y2="160" />
        </g>

        {/* Axes */}
        <line x1="30" y1="160" x2="175" y2="160" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="170,155 178,160 170,165" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="40" y1="170" x2="40" y2="25" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points="35,32 40,24 45,32" fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />

        {/* Polynomial Parabola Curve */}
        <motion.path
          d="M 40 150 Q 85 155 105 110 T 170 35"
          fill="none"
          stroke="url(#mathCurveGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
          animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />

        {/* Geometric Triangle */}
        <motion.polygon
          points="60,150 140,150 140,80"
          fill="#38BDF8"
          fillOpacity="0.1"
          stroke="#0EA5E9"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          animate={shouldAnimate ? { opacity: [0.6, 0.9, 0.6] } : undefined}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Right-angle square */}
        <polyline points="132,150 132,142 140,142" fill="none" stroke="#0EA5E9" strokeWidth="1.2" />

        {/* Floating Calculus Sum & Integral */}
        <motion.text
          x="128"
          y="72"
          fontSize="24"
          fontWeight="bold"
          fill="url(#mathGrad1)"
          fontFamily="serif"
          animate={shouldAnimate ? { y: [72, 68, 72] } : undefined}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          ∫
        </motion.text>
        <motion.text
          x="75"
          y="65"
          fontSize="20"
          fontWeight="bold"
          fill="#06B6D4"
          fontFamily="serif"
          animate={shouldAnimate ? { y: [65, 61, 65] } : undefined}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          Σ
        </motion.text>

        {/* Glowing Peak Point */}
        <circle cx="105" cy="110" r="10" fill="url(#mathNodeGlow)" />
        <circle cx="105" cy="110" r="4" fill="#38BDF8" />
      </svg>
    </div>
  );
}

/**
 * 2. Physics: Electromagnetic waveforms, particle trajectory, circuits
 */
export function PhysicsIllustration({
  className = '',
  size = 'md',
  animated = true,
}: EducationalGraphicProps) {
  const { options } = useMotionTheme();
  const shouldAnimate = animated && !options.reducedMotion;

  return (
    <div className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="physWave1" x1="10" y1="100" x2="190" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="physOrbGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        {/* Oscilloscope Center Line */}
        <line x1="15" y1="100" x2="185" y2="100" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 3" />

        {/* Sinusoidal Wave */}
        <motion.path
          d="M 15 100 C 40 40, 65 40, 90 100 C 115 160, 140 160, 165 100 C 175 75, 182 75, 188 100"
          fill="none"
          stroke="url(#physWave1)"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={shouldAnimate ? { pathLength: 0 } : { pathLength: 1 }}
          animate={shouldAnimate ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />

        {/* Wave 2 (Phase-shifted Harmonic) */}
        <motion.path
          d="M 15 100 C 35 130, 60 130, 85 100 C 110 70, 135 70, 160 100 C 175 115, 182 115, 188 100"
          fill="none"
          stroke="#06B6D4"
          strokeOpacity="0.4"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="4 2"
          animate={shouldAnimate ? { opacity: [0.3, 0.7, 0.3] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Magnetic Field Vector Loops */}
        <ellipse cx="100" cy="100" rx="65" ry="32" fill="none" stroke="#3B82F6" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="5 3" />
        <ellipse cx="100" cy="100" rx="32" ry="65" fill="none" stroke="#6366F1" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="5 3" />

        {/* Orbiting Quantum Electron */}
        <motion.circle
          cx="90"
          cy="100"
          r="5"
          fill="url(#physOrbGrad)"
          animate={
            shouldAnimate
              ? {
                  x: [0, 25, 50, 75, 50, 25, 0],
                  y: [0, -60, 0, 60, 0, -30, 0],
                  scale: [1, 1.2, 1, 0.8, 1],
                }
              : undefined
          }
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Vector Arrow Pointer */}
        <line x1="90" y1="100" x2="120" y2="65" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <polyline points="113,63 120,65 118,72" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * 3. Chemistry: Hexagonal molecular ring, laboratory flask, reaction bubbles
 */
export function ChemistryIllustration({
  className = '',
  size = 'md',
  animated = true,
}: EducationalGraphicProps) {
  const { options } = useMotionTheme();
  const shouldAnimate = animated && !options.reducedMotion;

  return (
    <div className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="flaskLiquid" x1="100" y1="110" x2="100" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="chemHexGrad" x1="50" y1="30" x2="150" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10B981" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>

        {/* Hexagonal Benzene Ring / Molecular Scaffold */}
        <g stroke="url(#chemHexGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="120,40 145,55 145,85 120,100 95,85 95,55" fill="none" strokeOpacity="0.6" />
          <polygon points="120,47 139,58 139,81 120,92 101,81 101,58" fill="none" strokeDasharray="3 3" strokeOpacity="0.4" />
          {/* Atoms on vertices */}
          <circle cx="120" cy="40" r="3.5" fill="#10B981" />
          <circle cx="145" cy="55" r="3.5" fill="#3B82F6" />
          <circle cx="145" cy="85" r="3.5" fill="#06B6D4" />
          <circle cx="120" cy="100" r="3.5" fill="#6366F1" />
          <circle cx="95" cy="85" r="3.5" fill="#10B981" />
          <circle cx="95" cy="55" r="3.5" fill="#38BDF8" />
        </g>

        {/* Laboratory Conical Flask */}
        {/* Flask Rim & Neck */}
        <rect x="52" y="80" width="16" height="4" rx="2" fill="#94A3B8" />
        <path d="M 55 84 L 55 106 L 30 156 C 26 164, 32 172, 40 172 L 80 172 C 88 172, 94 164, 90 156 L 65 106 L 65 84" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Liquid inside flask */}
        <motion.path
          d="M 37 142 Q 60 146 83 142 L 80 170 L 40 170 Z"
          fill="url(#flaskLiquid)"
          fillOpacity="0.85"
          animate={shouldAnimate ? { d: ['M 37 142 Q 60 146 83 142 L 80 170 L 40 170 Z', 'M 37 144 Q 60 139 83 144 L 80 170 L 40 170 Z', 'M 37 142 Q 60 146 83 142 L 80 170 L 40 170 Z'] } : undefined}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Bubbles */}
        <motion.circle
          cx="50"
          cy="155"
          r="2.5"
          fill="#E0F2FE"
          animate={shouldAnimate ? { y: [0, -25], opacity: [0.8, 0] } : undefined}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.circle
          cx="68"
          cy="160"
          r="3"
          fill="#E0F2FE"
          animate={shouldAnimate ? { y: [0, -32], opacity: [0.9, 0] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
        />
        <motion.circle
          cx="58"
          cy="150"
          r="2"
          fill="#E0F2FE"
          animate={shouldAnimate ? { y: [0, -20], opacity: [0.7, 0] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 1.4 }}
        />
      </svg>
    </div>
  );
}

/**
 * 4. Languages & English: Scholars open book, floating vocabulary flashcards, quill
 */
export function LanguagesIllustration({
  className = '',
  size = 'md',
  animated = true,
}: EducationalGraphicProps) {
  const { options } = useMotionTheme();
  const shouldAnimate = animated && !options.reducedMotion;

  return (
    <div className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="bookCoverGrad" x1="30" y1="120" x2="170" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E40AF" />
            <stop offset="0.5" stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#0EA5E9" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* Open Book Pages */}
        <path
          d="M 100 148 C 75 140, 45 144, 30 152 L 30 92 C 45 84, 75 80, 100 88 C 125 80, 155 84, 170 92 L 170 152 C 155 144, 125 140, 100 148 Z"
          fill="#F8FAFC"
          stroke="#94A3B8"
          strokeWidth="1.5"
          className="dark:fill-slate-800 dark:stroke-slate-600"
        />
        {/* Book Spine Center */}
        <line x1="100" y1="88" x2="100" y2="148" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />

        {/* Book Ribbon Bookmark */}
        <path d="M 100 88 C 103 105, 106 115, 109 135 L 104 130 L 99 135 Z" fill="#EF4444" />

        {/* Text Lines on Pages */}
        <line x1="42" y1="104" x2="88" y2="104" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="114" x2="82" y2="114" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="124" x2="74" y2="124" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />

        <line x1="112" y1="104" x2="158" y2="104" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
        <line x1="112" y1="114" x2="152" y2="114" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        <line x1="112" y1="124" x2="140" y2="124" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />

        {/* Floating Vocabulary Flip Cards */}
        <motion.g
          animate={shouldAnimate ? { y: [0, -6, 0], rotate: [-2, 2, -2] } : undefined}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x="45" y="32" width="46" height="32" rx="6" fill="url(#cardGrad)" className="shadow-lg" />
          <text x="68" y="53" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            A B C
          </text>
        </motion.g>

        <motion.g
          animate={shouldAnimate ? { y: [0, -8, 0], rotate: [3, -2, 3] } : undefined}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        >
          <rect x="110" y="25" width="48" height="34" rx="6" fill="#6366F1" className="shadow-lg" />
          <text x="134" y="47" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            ق ر أ
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

/**
 * 5. General Education & Achievements: Certificate, Graduation cap, Golden Star
 */
export function AcademicAchievementIllustration({
  className = '',
  size = 'md',
  animated = true,
}: EducationalGraphicProps) {
  const { options } = useMotionTheme();
  const shouldAnimate = animated && !options.reducedMotion;

  return (
    <div className={`relative inline-flex items-center justify-center ${SIZE_MAP[size]} ${className}`}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="capGrad" x1="40" y1="60" x2="160" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E3A8A" />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FBBF24" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* Certificate Parchment */}
        <rect x="35" y="80" width="130" height="95" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-slate-700" />
        <rect x="43" y="88" width="114" height="79" rx="4" fill="none" stroke="#38BDF8" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="4 2" />

        {/* Ribbon & Golden Seal */}
        <circle cx="100" cy="138" r="16" fill="url(#goldGrad)" className="shadow-md" />
        <path d="M 94 148 L 90 168 L 98 162 L 102 168 L 100 148" fill="#D97706" />
        <path d="M 106 148 L 110 168 L 102 162 L 98 168 L 100 148" fill="#B45309" />
        {/* Star in seal */}
        <polygon points="100,128 103,135 110,135 104,139 107,146 100,142 93,146 96,139 90,135 97,135" fill="#FEF3C7" />

        {/* Graduation Cap (Floating over certificate) */}
        <motion.g
          animate={shouldAnimate ? { y: [0, -5, 0] } : undefined}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Skull cap */}
          <path d="M 70 55 Q 100 65 130 55 L 130 68 Q 100 78 70 68 Z" fill="#0F172A" />
          {/* Diamond Mortarboard top */}
          <polygon points="100,28 162,50 100,68 38,50" fill="url(#capGrad)" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Tassel Button */}
          <circle cx="100" cy="48" r="3.5" fill="url(#goldGrad)" />
          {/* Tassel string & fringe */}
          <motion.path
            d="M 100 48 Q 130 52 145 74"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
            animate={shouldAnimate ? { d: ['M 100 48 Q 130 52 145 74', 'M 100 48 Q 133 54 147 76', 'M 100 48 Q 130 52 145 74'] } : undefined}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle cx="145" cy="75" r="3" fill="#D97706" />
        </motion.g>
      </svg>
    </div>
  );
}

/**
 * Unified Subject Badge component with original SVG illustration
 */
export function EducationalSubjectBadge({
  subject,
  size = 'md',
  className = '',
  showLabel = true,
}: {
  subject: 'math' | 'physics' | 'chemistry' | 'languages' | 'achievement' | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}) {
  const getSubjectMeta = () => {
    switch (subject.toLowerCase()) {
      case 'math':
      case 'رياضيات':
      case 'الرياضيات':
        return {
          title: 'الرياضيات',
          comp: <MathIllustration size={size} />,
          badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
        };
      case 'physics':
      case 'فيزياء':
      case 'الفيزياء':
        return {
          title: 'الفيزياء',
          comp: <PhysicsIllustration size={size} />,
          badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        };
      case 'chemistry':
      case 'كيمياء':
      case 'الكيمياء':
        return {
          title: 'الكيمياء',
          comp: <ChemistryIllustration size={size} />,
          badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'languages':
      case 'arabic':
      case 'english':
      case 'لغة عربية':
      case 'لغة إنجليزية':
        return {
          title: 'اللغات',
          comp: <LanguagesIllustration size={size} />,
          badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      default:
        return {
          title: 'التميز الأكاديمي',
          comp: <AcademicAchievementIllustration size={size} />,
          badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
    }
  };

  const meta = getSubjectMeta();

  return (
    <div className={`inline-flex items-center gap-2 p-1.5 rounded-xl border ${meta.badgeColor} ${className}`}>
      {meta.comp}
      {showLabel && <span className="font-semibold text-sm">{meta.title}</span>}
    </div>
  );
}
