'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MotionProvider, useMotionTheme } from '@/lib/motion/context';
import { MotionIntensity } from '@/lib/motion/tokens';
import {
  Sparkles,
  Sliders,
  Moon,
  Sun,
  Smartphone,
  Monitor,
  Eye,
  EyeOff,
  Layers,
  LayoutDashboard,
  ScanLine,
  BookOpen,
  Cpu,
  GraduationCap,
  Bell,
  RefreshCw,
  FolderOpen,
  FileCheck2,
  Users,
} from 'lucide-react';

import {
  MathIllustration,
  PhysicsIllustration,
  ChemistryIllustration,
  LanguagesIllustration,
  AcademicAchievementIllustration,
  EducationalSubjectBadge,
} from '@/components/motion/educational-graphics';
import { AnimatedPageShell } from '@/components/motion/animated-page-shell';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedTabs } from '@/components/motion/animated-tabs';
import { AnimatedDataChart } from '@/components/motion/animated-data-chart';
import { AttendanceScanAnimation } from '@/components/motion/attendance-scan-animation';
import { UploadProgressAnimation } from '@/components/motion/upload-progress-animation';
import { FileLibraryAnimation } from '@/components/motion/file-library-animation';
import { AIExamGenerationAnimation } from '@/components/motion/ai-exam-generation-animation';
import { GradeProgressAnimation } from '@/components/motion/grade-progress-animation';
import { NotificationAnimation } from '@/components/motion/notification-animation';
import { MorphingCard } from '@/components/motion/morphing-card';
import { MotionSidebar } from '@/components/motion/motion-sidebar';
import { CinematicHero } from '@/components/motion/cinematic-hero';

function MotionLabInner() {
  const { intensity, setIntensity, speed, setSpeed, reducedMotion, setReducedMotion } = useMotionTheme();
  const [activeCategory, setActiveCategory] = useState<string>('hero');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'duplicate' | 'error'>('idle');
  const [uploadProgressVal, setUploadProgressVal] = useState<number>(68);

  const categories = [
    { id: 'hero', label: 'البانر السينمائي (Hero)', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'graphics', label: 'الرسوم التعليمية (SVGs)', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'dashboard', label: 'المؤشرات والرسوم (KPIs & Charts)', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reception', label: 'الحضور والمسح (Reception)', icon: <ScanLine className="w-4 h-4" /> },
    { id: 'materials', label: 'المذكرات والرفع (Materials)', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'ai_exams', label: 'امتحانات AI (Workflow)', icon: <Cpu className="w-4 h-4" /> },
    { id: 'portals', label: 'بوابات الطلاب وأولياء الأمور', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'sidebar', label: 'القائمة والبطاقات الموسعة', icon: <Layers className="w-4 h-4" /> },
  ];

  const handleSimulateScan = (type: 'success' | 'duplicate' | 'error') => {
    setScanStatus('scanning');
    setTimeout(() => {
      setScanStatus(type);
    }, 900);
  };

  return (
    <div className={isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}>
      <div className="min-h-screen font-sans pb-16 transition-colors duration-200" dir="rtl">
        {/* Top Control Bar */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-sky-400 text-white font-black flex items-center justify-center shadow-lg shadow-cyan-500/20 text-lg">
                Y
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                    مختبر الحركة والتصميم السينمائي (Motion Lab)
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    v2.0 Preview
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  لوحة تحكم حية لاختبار وتعديل الحركة والرسوم التعليمية التفاعلية
                </p>
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              {/* Preset Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {(['minimal', 'balanced', 'expressive'] as MotionIntensity[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setIntensity(p)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                      intensity === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {p === 'minimal' ? 'هادئ (Minimal)' : p === 'balanced' ? 'متوازن (Balanced)' : 'تعبيري (Expressive)'}
                  </button>
                ))}
              </div>

              {/* Reduced Motion Toggle */}
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`p-2 rounded-xl border flex items-center gap-1.5 transition-colors ${
                  reducedMotion
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title="تبديل وضع تقليل الحركة (Reduced Motion)"
              >
                {reducedMotion ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {reducedMotion ? 'حركة مخففة' : 'حركة كاملة'}
                </span>
              </button>

              {/* Dark / Light Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="تبديل الوضع الداكن / الفاتح"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              </button>

              {/* Viewport Frame Toggle */}
              <button
                onClick={() => setIsMobileView(!isMobileView)}
                className={`p-2 rounded-xl border flex items-center gap-1.5 transition-colors ${
                  isMobileView
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title="معاينة إطار الهاتف المحمول"
              >
                {isMobileView ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {isMobileView ? 'هاتف محمول' : 'شاشة كاملة'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Navigation Category Switcher */}
          <div className="overflow-x-auto pb-2">
            <AnimatedTabs
              tabs={categories}
              activeId={activeCategory}
              onChange={setActiveCategory}
            />
          </div>

          {/* Optional Mobile Frame Container */}
          <div className={isMobileView ? 'max-w-md mx-auto border-4 border-slate-700 rounded-3xl p-3 bg-slate-900 shadow-2xl overflow-hidden' : ''}>
            <AnimatePresence mode="wait">
              {/* Category 1: Cinematic Hero */}
              {activeCategory === 'hero' && (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <CinematicHero />
                </motion.div>
              )}

              {/* Category 2: Educational SVG Graphics Library */}
              {activeCategory === 'graphics' && (
                <motion.div
                  key="graphics"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Math Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
                      <MathIllustration size="lg" />
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          الرياضيات وتفاضل الدوال
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          شبكة إحداثيات ديكارتية، منحنى تكامل، وتدرجات هندسية متجاوبة
                        </p>
                      </div>
                      <EducationalSubjectBadge subject="math" />
                    </div>

                    {/* Physics Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
                      <PhysicsIllustration size="lg" />
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          الفيزياء والموجات الكهرومغناطيسية
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          نبضات جيبية متذبذبة، حقل مغناطيسي، ومسار جسيم متألق
                        </p>
                      </div>
                      <EducationalSubjectBadge subject="physics" />
                    </div>

                    {/* Chemistry Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
                      <ChemistryIllustration size="lg" />
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          الكيمياء والروابط الجزيئية
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          حلقة بنزين سداسية، مخبار تفاعل مع فقاعات صاعدة حركية
                        </p>
                      </div>
                      <EducationalSubjectBadge subject="chemistry" />
                    </div>

                    {/* Languages Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
                      <LanguagesIllustration size="lg" />
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          اللغات والآداب
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          كتاب دراسي مفتوح مع بطاقات مفردات متحركة
                        </p>
                      </div>
                      <EducationalSubjectBadge subject="languages" />
                    </div>

                    {/* Academic Achievement Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
                      <AcademicAchievementIllustration size="lg" />
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          الشهادات والتخرج الأكاديمي
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          قبعة تخرج ذهبية مع وثيقة معتمدة وختم رسمي
                        </p>
                      </div>
                      <EducationalSubjectBadge subject="achievement" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Category 3: Dashboard Metrics & Charts */}
              {activeCategory === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <StaggeredCardGrid columns={4}>
                    <AnimatedMetric
                      label="إجمالي الطلاب المسجلين"
                      value={1240}
                      suffix="طالب"
                      color="blue"
                      icon={<Users className="w-5 h-5" />}
                      trend={{ value: 12.5, isPositive: true, periodText: 'مقارنة بالشهر الماضي' }}
                      sparklineData={[1100, 1140, 1180, 1210, 1240]}
                    />
                    <AnimatedMetric
                      label="المتحصلات المالية لليوم"
                      value={18650}
                      prefix="ج.م "
                      color="emerald"
                      trend={{ value: 8.2, isPositive: true, periodText: 'تم إغلاق الصباح' }}
                      sparklineData={[12000, 14500, 16200, 17800, 18650]}
                    />
                    <AnimatedMetric
                      label="نسبة الحضور الفعلي"
                      value={94.6}
                      decimals={1}
                      suffix="%"
                      color="cyan"
                      trend={{ value: 0, periodText: 'مطابق للهدف' }}
                      sparklineData={[91, 92.5, 93, 94.2, 94.6]}
                    />
                    <AnimatedMetric
                      label="الامتحانات الذكية المنتجة"
                      value={86}
                      suffix="امتحان"
                      color="indigo"
                      trend={{ value: 24, isPositive: true, periodText: 'بواسطة AI' }}
                      sparklineData={[45, 56, 68, 77, 86]}
                    />
                  </StaggeredCardGrid>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AnimatedDataChart
                      title="معدل الحضور الأسبوعي للسنتر"
                      color="cyan"
                      unit="طالب"
                      data={[
                        { label: 'السبت', value: 840 },
                        { label: 'الأحد', value: 920 },
                        { label: 'الإثنين', value: 780 },
                        { label: 'الثلاثاء', value: 990 },
                        { label: 'الأربعاء', value: 1100 },
                        { label: 'الخميس', value: 860 },
                        { label: 'الجمعة', value: 430 },
                      ]}
                    />
                    <AnimatedDataChart
                      title="الإيرادات والتحصيل اليومي (ج.م)"
                      color="emerald"
                      unit="ج.م"
                      data={[
                        { label: 'السبت', value: 14500 },
                        { label: 'الأحد', value: 18200 },
                        { label: 'الإثنين', value: 12400 },
                        { label: 'الثلاثاء', value: 19800 },
                        { label: 'الأربعاء', value: 22400 },
                        { label: 'الخميس', value: 16500 },
                        { label: 'الجمعة', value: 8200 },
                      ]}
                    />
                  </div>
                </motion.div>
              )}

              {/* Category 4: Reception & Attendance */}
              {activeCategory === 'reception' && (
                <motion.div
                  key="reception"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-slate-500">جرب حالات المسح:</span>
                    <button
                      onClick={() => handleSimulateScan('success')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      مسح ناجح (Success)
                    </button>
                    <button
                      onClick={() => handleSimulateScan('duplicate')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold shadow-sm hover:bg-amber-700 transition-colors"
                    >
                      مسح مكرر (Duplicate)
                    </button>
                    <button
                      onClick={() => handleSimulateScan('error')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-sm hover:bg-rose-700 transition-colors"
                    >
                      رمز غير صالح (Error)
                    </button>
                  </div>

                  <AttendanceScanAnimation
                    status={scanStatus}
                    onScanTrigger={() => handleSimulateScan('success')}
                  />
                </motion.div>
              )}

              {/* Category 5: Teacher Materials & Uploads */}
              {activeCategory === 'materials' && (
                <motion.div
                  key="materials"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <UploadProgressAnimation
                    progress={uploadProgressVal}
                    status={uploadProgressVal >= 100 ? 'completed' : 'uploading'}
                  />

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setUploadProgressVal(Math.min(uploadProgressVal + 25, 100))}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                    >
                      زيادة نسبة الرفع +25%
                    </button>
                    <button
                      onClick={() => setUploadProgressVal(20)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
                    >
                      إعادة البدء
                    </button>
                  </div>

                  <FileLibraryAnimation />
                </motion.div>
              )}

              {/* Category 6: AI Exam Generation Workflow */}
              {activeCategory === 'ai_exams' && (
                <motion.div
                  key="ai_exams"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <AIExamGenerationAnimation />
                </motion.div>
              )}

              {/* Category 7: Student & Parent Portals */}
              {activeCategory === 'portals' && (
                <motion.div
                  key="portals"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  <GradeProgressAnimation score={96} totalMarks={100} />
                  <NotificationAnimation />
                </motion.div>
              )}

              {/* Category 8: Sidebar & Morphing Cards */}
              {activeCategory === 'sidebar' && (
                <motion.div
                  key="sidebar"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                >
                  <div className="lg:col-span-4">
                    <MotionSidebar />
                  </div>
                  <div className="lg:col-span-8 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                      بطاقات المجموعات الموسعة (Morphing Cards)
                    </h3>
                    <MorphingCard
                      title="3ث - كيمياء متميزة (الفوج الأول)"
                      subtitle="الصف الثالث الثانوي • علمي علوم ورياضة"
                      studentsCount={46}
                      timeSlot="الأحد والثلاثاء 06:00 م - 08:00 م"
                      classroomName="قاعة ابن سينا الكبرى"
                      pricingModel="نظام السنتر (المتوسط)"
                      teacherName="أ. محمد عبد العزيز"
                    />
                    <MorphingCard
                      title="1ث - رياضيات تطبيقية (متقدم)"
                      subtitle="الصف الأول الثانوي • تأسيس شامل"
                      studentsCount={38}
                      timeSlot="السبت والأربعاء 04:00 م - 06:00 م"
                      classroomName="قاعة الخوارزمي"
                      pricingModel="نظام الحصة المستقلة"
                      teacherName="أ. أحمد سمير"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function MotionLabPage() {
  return (
    <MotionProvider defaultIntensity="balanced">
      <MotionLabInner />
    </MotionProvider>
  );
}
