'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Users,
  ScanLine,
  TrendingUp,
  Cpu,
  BookOpen,
  Award,
} from 'lucide-react';
import {
  MathIllustration,
  PhysicsIllustration,
  ChemistryIllustration,
  LanguagesIllustration,
  AcademicAchievementIllustration,
} from './educational-graphics';

import Link from 'next/link';

export interface CinematicHeroProps {
  className?: string;
  onCtaClick?: () => void;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
}

export function CinematicHero({
  className = '',
  onCtaClick,
  secondaryCtaHref,
  secondaryCtaLabel,
}: CinematicHeroProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  return (
    <section
      className={`relative min-h-[640px] md:min-h-[720px] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-950 via-[#0B1528] to-slate-950 border border-slate-800/80 p-6 md:p-12 flex flex-col justify-between text-white ${className}`}
      dir="rtl"
    >
      {/* Background Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={
            isReduced
              ? undefined
              : {
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.35, 0.2],
                  x: [0, 20, 0],
                }
          }
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-600/30 blur-[100px]"
        />
        <motion.div
          animate={
            isReduced
              ? undefined
              : {
                  scale: [1, 1.3, 1],
                  opacity: [0.15, 0.3, 0.15],
                  y: [0, -30, 0],
                }
          }
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/25 blur-[100px]"
        />

        {/* Ambient Connecting Glowing SVG Grid Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="heroGridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38BDF8" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#heroGridPattern)" />
        </svg>
      </div>

      {/* Top Banner Tag */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          <span>منظومة يلا سنتر التعليمية 2.0 — الجيل السحابي القادم</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>مزامنة مباشرة 100%</span>
        </div>
      </div>

      {/* Main Headline & Cinematic Interactive Elements */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto py-8">
        {/* Left Column (in RTL, Right text): Typography Reveal */}
        <div className="lg:col-span-7 space-y-6 text-right">
          <motion.h1
            initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.25] text-white"
          >
            إدارة السناتر التعليمية بأسلوب{' '}
            <span className="bg-gradient-to-l from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              مبتكر وسينمائي
            </span>
          </motion.h1>

          <motion.p
            initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed font-normal"
          >
            لوحات قيادة فائقة السرعة، ومسح ليزري لحظي للحضور، وامتحانات ذكاء اصطناعي تفاعلية،
            وحسابات مؤتمتة تجمع بين الدقة المحاسبية وجمال التجربة البصرية.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap items-center gap-4 pt-2"
          >
            <button
              onClick={onCtaClick}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-cyan-500/25 flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>ابدأ التجربة وتفقد المنظومة</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            {secondaryCtaHref && (
              <Link
                href={secondaryCtaHref}
                className="px-5 py-3 rounded-2xl border border-slate-700 bg-slate-900/70 hover:bg-slate-800/80 text-slate-100 font-bold text-sm transition-all flex items-center gap-2"
              >
                <span>{secondaryCtaLabel || 'دخول المنصة'}</span>
              </Link>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>8 بوابات مخصصة لكل دور</span>
            </div>
          </motion.div>
        </div>

        {/* Right Column (in RTL, Left visual): Floating Educational Composition */}
        <div className="lg:col-span-5 relative h-80 sm:h-96 w-full flex items-center justify-center">
          {/* Central Mockup Dashboard Canvas */}
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="relative w-64 sm:w-72 rounded-2xl bg-slate-900/90 border border-cyan-500/40 p-4 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl z-10"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-[11px] font-bold text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>لوحة متابعة السنتر</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">متصل مباشر</span>
            </div>

            <div className="space-y-2.5 mt-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
                <span className="text-slate-400">حضور الطلاب اليوم</span>
                <span className="font-bold text-white font-mono">142 طالب</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
                <span className="text-slate-400">نسبة التحصيل المالي</span>
                <span className="font-bold text-emerald-400 font-mono">98.4%</span>
              </div>
            </div>
          </motion.div>

          {/* Floating Educational Graphic Satellite: Mathematics */}
          <motion.div
            animate={
              isReduced
                ? undefined
                : {
                    y: [0, -14, 0],
                    x: [0, 8, 0],
                  }
            }
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-2 right-2 sm:right-6 z-20"
          >
            <MathIllustration size="sm" />
          </motion.div>

          {/* Floating Educational Graphic Satellite: Physics */}
          <motion.div
            animate={
              isReduced
                ? undefined
                : {
                    y: [0, 12, 0],
                    x: [0, -10, 0],
                  }
            }
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-4 left-4 z-20"
          >
            <PhysicsIllustration size="sm" />
          </motion.div>

          {/* Floating Educational Graphic Satellite: Chemistry */}
          <motion.div
            animate={
              isReduced
                ? undefined
                : {
                    y: [0, -10, 0],
                    x: [0, -6, 0],
                  }
            }
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-6 left-6 z-20"
          >
            <ChemistryIllustration size="sm" />
          </motion.div>

          {/* Floating Educational Graphic Satellite: Languages */}
          <motion.div
            animate={
              isReduced
                ? undefined
                : {
                    y: [0, 10, 0],
                    x: [0, 6, 0],
                  }
            }
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute bottom-6 right-8 z-20"
          >
            <LanguagesIllustration size="sm" />
          </motion.div>
        </div>
      </div>

      {/* Footer Feature Badges */}
      <div className="relative z-10 pt-4 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-cyan-400" />
          <span>مسح ليزري بالباركود</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>توليد امتحانات AI</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>محاسبة دقيقة للمجموعات</span>
        </div>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>متابعة فورية للدرجات</span>
        </div>
      </div>
    </section>
  );
}
