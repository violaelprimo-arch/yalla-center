'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Briefcase,
  GraduationCap,
  Users,
  CheckCircle2,
  QrCode,
  Wallet,
  Calendar,
  BookOpen,
  Bell,
} from 'lucide-react';
import { useMotionTheme } from '@/lib/motion/context';
import { AnimatedTabs } from '@/components/motion/animated-tabs';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { GradeProgressAnimation } from '@/components/motion/grade-progress-animation';
import {
  MathIllustration,
  PhysicsIllustration,
  ChemistryIllustration,
  LanguagesIllustration,
  AcademicAchievementIllustration,
  EducationalSubjectBadge,
} from '@/components/motion/educational-graphics';
import { InteractiveBarChart } from '@/components/ui/interactive-chart';

type ShowcasePortalId = 'center' | 'teacher' | 'student' | 'parent';

const PORTAL_META: Record<
  ShowcasePortalId,
  {
    title: string;
    subtitle: string;
    bullets: string[];
    badge: string;
  }
> = {
  center: {
    title: 'لوحة إدارة السنتر المتكاملة',
    subtitle: 'رؤية شاملة لحظية للحضور والمدفوعات والحصص عبر جميع الفروع والقاعات.',
    badge: 'مدير السنتر والاستقبال',
    bullets: [
      'تسجيل الحضور بالباركود في أقل من 300 مللي ثانية',
      'كشوف محاسبة دقيقة بين إدارة السنتر والمعلمين بلا أخطاء',
      'توزيع القاعات والجداول الأسبوعية مع منع التعارض تلقائياً',
    ],
  },
  teacher: {
    title: 'بوابة المعلم الذكية والمستقلة',
    subtitle: 'بيئة عمل خاصة بالمعلم لإدارة مجموعاته، مذكراته، اختباراته، ومستحقاته.',
    badge: 'معلم معتمد',
    bullets: [
      'متابعة كشف الحساب الشهري وتفصيل حصص المجموعات بدقة',
      'تنظيم المذكرات والملازم ورفع الملفات حسب الصف والوحدة',
      'تصحيح الاختبارات وإرسال طلبات المحاضرات الإضافية بسهولة',
    ],
  },
  student: {
    title: 'بوابة الطالب التفاعلية',
    subtitle: 'متابعة ذكية للدرجات، سجل الحضور، المذكرات الدراسية، وجدول المحاضرات.',
    badge: 'طالب مقيد',
    bullets: [
      'مؤشر دائري تفاعلي لتقييم التقدم الأكاديمي والاختبارات الدورية',
      'تحميل المذكرات والملخصات المنظمة لكل مادة وصف دراسي',
      'معرفة مواعيد المجموعات والواجبات وحالة الاشتراك المالي فوراً',
    ],
  },
  parent: {
    title: 'بوابة ولي الأمر والمتابعة المباشرة',
    subtitle: 'اطمئنان لحظي على حضور الأبناء، مستواهم الدراسي، وسداد المصروفات.',
    badge: 'متابعة أسرية',
    bullets: [
      'التبديل السلس بين أكثر من طالب من حساب ولي أمر واحد',
      'تنبيهات فورية لحظة تسجيل الحضور أو صدور نتيجة الاختبار',
      'سجل شفاف لمدفوعات الحصص والاشتراكات بدون عناء التواصل الإداري',
    ],
  },
};

export function PortalShowcase() {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [activePortal, setActivePortal] = useState<ShowcasePortalId>('center');

  const meta = PORTAL_META[activePortal];

  return (
    <motion.section
      id="showcase"
      initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: isReduced ? 0.001 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full"
      dir="rtl"
    >
      <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
        <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-brand-cyan-600 dark:text-brand-cyan-400 text-xs font-bold">
          <span>استكشف المنظومة تفاعلياً</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground">
          بوابات مستقلة مترابطة لحظياً لكل أطراف العملية التعليمية
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          اختر البوابة لمعاينة التصميم التفاعلي، والرسوم البيانية، وتجربة الاستخدام المخصصة لكل دور داخل السنتر.
        </p>
      </div>

      {/* Tabs Control */}
      <div className="flex justify-center mb-8 overflow-x-auto pb-2">
        <AnimatedTabs
          activeId={activePortal}
          onChange={(id) => setActivePortal(id as ShowcasePortalId)}
          tabs={[
            { id: 'center', label: 'لوحة السنتر', icon: <Building2 className="w-4 h-4" /> },
            { id: 'teacher', label: 'بوابة المعلم', icon: <Briefcase className="w-4 h-4" /> },
            { id: 'student', label: 'بوابة الطالب', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'parent', label: 'بوابة ولي الأمر', icon: <Users className="w-4 h-4" /> },
          ]}
        />
      </div>

      {/* Interactive Showcase Card */}
      <div className="rounded-3xl border border-border bg-card shadow-soft-lg p-6 sm:p-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePortal}
            initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={isReduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: isReduced ? 0.001 : 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            {/* Description Column */}
            <div className="lg:col-span-5 space-y-5">
              <span className="inline-block px-3 py-1 rounded-full bg-brand-navy-900/10 dark:bg-brand-cyan-500/15 text-brand-navy-900 dark:text-brand-cyan-300 text-xs font-bold border border-brand-cyan-500/20">
                {meta.badge}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-foreground leading-snug">
                {meta.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {meta.subtitle}
              </p>

              <ul className="space-y-3 pt-2">
                {meta.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-3">
                <EducationalSubjectBadge subject="math" size="sm" />
                <EducationalSubjectBadge subject="physics" size="sm" />
                <EducationalSubjectBadge subject="chemistry" size="sm" />
                <EducationalSubjectBadge subject="languages" size="sm" />
              </div>
            </div>

            {/* Interactive UI Preview Canvas */}
            <div className="lg:col-span-7 rounded-2xl bg-slate-50 dark:bg-[#070B19] border border-border p-4 sm:p-6 space-y-4">
              {activePortal === 'center' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AnimatedMetric
                      label="مؤشر سرعة المسح"
                      value={280}
                      suffix=" ms"
                      color="cyan"
                      icon={<QrCode className="w-4 h-4" />}
                    />
                    <AnimatedMetric
                      label="انتظام المجموعات"
                      value={96}
                      suffix="%"
                      color="emerald"
                      icon={<Wallet className="w-4 h-4" />}
                    />
                  </div>
                  <InteractiveBarChart
                    title="توزيع الحضور خلال أيام الأسبوع (نموذج عرض)"
                    height={170}
                    data={[
                      { label: 'السبت', value: 88 },
                      { label: 'الأحد', value: 92 },
                      { label: 'الإثنين', value: 85 },
                      { label: 'الثلاثاء', value: 95 },
                      { label: 'الأربعاء', value: 90 },
                    ]}
                  />
                </>
              )}

              {activePortal === 'teacher' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <MathIllustration size="sm" />
                      <div>
                        <h4 className="text-sm font-bold text-foreground">محاسبة المجموعات والملازم</h4>
                        <p className="text-xs text-muted-foreground">ربط تلقائي مع شؤون المعلمين والاستقبال</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      8 تبويبات بالصلاحيات
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-card border border-border flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-brand-cyan-500 shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-foreground">مكتبة المذكرات</p>
                        <p className="text-muted-foreground">تصنيف بالمراحل والوحدات</p>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-card border border-border flex items-center gap-2.5">
                      <Calendar className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-foreground">الجدول والحصص</p>
                        <p className="text-muted-foreground">طلبات حصص إضافية فورية</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePortal === 'student' && (
                <div className="space-y-4">
                  <GradeProgressAnimation
                    score={94}
                    totalMarks={100}
                    title="نموذج مؤشر الأداء العام"
                    examName="التقييم الدوري للمواد المقيدة"
                    rank="عرض بياني تفاعلي للدرجات"
                    size={120}
                  />
                </div>
              )}

              {activePortal === 'parent' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-3">
                      <AcademicAchievementIllustration size="sm" />
                      <div>
                        <h4 className="text-sm font-bold text-foreground">تنبيهات الحضور والدرجات</h4>
                        <p className="text-xs text-muted-foreground">تصل لحظياً لولي الأمر مع اختيار الأبناء</p>
                      </div>
                    </div>
                    <Bell className="w-5 h-5 text-amber-500 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-bold text-foreground">إشعار دخول القاعة بالباركود</span>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-cyan-500 shrink-0" />
                      <span className="font-bold text-foreground">متابعة التقييمات والواجبات</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Original Animated Educational Illustrations Strip */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { comp: <MathIllustration size="sm" />, label: 'الرياضيات والهندسة' },
          { comp: <PhysicsIllustration size="sm" />, label: 'الفيزياء والطاقة' },
          { comp: <ChemistryIllustration size="sm" />, label: 'الكيمياء والتجارب' },
          { comp: <LanguagesIllustration size="sm" />, label: 'اللغات والآداب' },
          { comp: <AcademicAchievementIllustration size="sm" />, label: 'التفوق الأكاديمي' },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: isReduced ? 0 : idx * 0.05 }}
            className="p-4 rounded-2xl border border-border bg-card/80 hover:border-brand-cyan-500/40 transition-all flex flex-col items-center text-center gap-2 shadow-soft-sm"
          >
            {item.comp}
            <span className="text-xs font-bold text-foreground">{item.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
