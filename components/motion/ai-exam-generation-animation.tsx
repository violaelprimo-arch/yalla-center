'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { FileText, Cpu, CheckCircle2, Sparkles, Printer, RefreshCw, ListFilter, ShieldCheck } from 'lucide-react';

export interface AIExamStep {
  id: number;
  label: string;
  desc: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export function AIExamGenerationAnimation({
  className = '',
  onComplete,
}: {
  className?: string;
  onComplete?: () => void;
}) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const steps = [
    {
      id: 1,
      title: 'تحليل المصدر والمحتوى',
      desc: 'استخراج الأفكار الرئيسية ونواتج التعلم المستهدفة',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: 2,
      title: 'صياغة بنك الأسئلة بالـ AI',
      desc: 'توليد أسئلة اختيار من متعدد ومقالية بمستويات بلوم المعرفية',
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      id: 3,
      title: 'المراجعة والتدقيق التربوي',
      desc: 'فحص الإجابات النموذجية وصحة المفاتيح والرسومات',
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      id: 4,
      title: 'تنسيق ورقة الامتحان والطباعة',
      desc: 'تجهيز قالب رسمي جاهز للطباعة وتوزيع باركود التصحيح',
      icon: <Printer className="w-5 h-5" />,
    },
  ];

  const handleStartSimulation = () => {
    setIsSimulating(true);
    setCurrentStep(1);

    const stepInterval = isReduced ? 500 : 1200;
    const t1 = setTimeout(() => setCurrentStep(2), stepInterval);
    const t2 = setTimeout(() => setCurrentStep(3), stepInterval * 2);
    const t3 = setTimeout(() => setCurrentStep(4), stepInterval * 3);
    const t4 = setTimeout(() => {
      setIsSimulating(false);
      onComplete?.();
    }, stepInterval * 4);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  };

  return (
    <div
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              مسار توليد الامتحانات الذكية (AI Engine)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تحويل المذكرات إلى اختبارات قياسية ونماذج إجابة في ثوانٍ
            </p>
          </div>
        </div>

        <button
          onClick={handleStartSimulation}
          disabled={isSimulating}
          className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'جاري المعالجة...' : 'بدء محاكاة التوليد'}</span>
        </button>
      </div>

      {/* 4-Step Animated Pipeline Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {steps.map((st) => {
          const isDone = currentStep > st.id || (!isSimulating && currentStep === 4);
          const isCurrent = isSimulating && currentStep === st.id;

          return (
            <motion.div
              key={st.id}
              initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isReduced ? 0 : st.id * 0.1 }}
              className={`relative p-4 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500/20'
                  : isDone
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-slate-900 dark:text-slate-100'
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isCurrent
                      ? 'bg-cyan-500 text-white animate-pulse'
                      : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : st.icon}
                </div>
                <span className="font-mono text-xs font-bold opacity-60">
                  0{st.id}
                </span>
              </div>

              <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                {st.title}
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {st.desc}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Output Exam Preview Reveal */}
      <AnimatePresence>
        {!isSimulating && currentStep === 4 && (
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  امتحان_شامل_الكيمياء_العضوية_2026.pdf
                </h5>
                <p className="text-xs text-slate-500 font-mono">
                  25 سؤالاً اختيار من متعدد + 3 مسائل تطبيقية • نموذج أ ونموذج ب معتمد
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                جاهز للتصدير
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
