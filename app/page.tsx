'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  Send,
  HelpCircle,
  BarChart3,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  QrCode,
  Calendar,
  Layers,
  FileSpreadsheet,
  Cpu,
  BadgeAlert,
  GraduationCap,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { BrandIcon } from '@/components/brand/brand-icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CinematicHero } from '@/components/motion/cinematic-hero';
import { SaasPlatformService } from '@/lib/saas/service';
import type {
  WebsiteConfig,
  SubscriptionPlan,
  CenterExtended,
  PlatformCommunicationSettings,
} from '@/lib/saas/types';

export default function DynamicHomePage() {
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [centers, setCenters] = useState<CenterExtended[]>([]);
  const [settings, setSettings] = useState<PlatformCommunicationSettings | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Poll Voting State
  const [selectedPollOption, setSelectedPollOption] = useState<string | null>(null);
  const [hasVotedPoll, setHasVotedPoll] = useState(false);

  // Active Public Form Tab
  const [activeFormTab, setActiveFormTab] = useState<'subscription' | 'demo' | 'complaint'>('subscription');

  // Subscription Form State
  const [subForm, setSubForm] = useState({
    centerName: '',
    contactPerson: '',
    phone: '',
    email: '',
    governorate: 'القاهرة',
    branchCount: 1,
    approxStudentsCount: 300,
    requestedPlanId: '',
    preferredContactMethod: 'phone' as 'phone' | 'whatsapp' | 'email',
    notes: '',
  });
  const [subSuccess, setSubSuccess] = useState<string | null>(null);

  // Demo Form State
  const [demoForm, setDemoForm] = useState({
    centerName: '',
    contactPerson: '',
    phone: '',
    email: '',
    preferredDate: '',
    notes: '',
  });
  const [demoSuccess, setDemoSuccess] = useState<string | null>(null);

  // Complaint Form State
  const [complaintForm, setComplaintForm] = useState({
    senderName: '',
    email: '',
    phone: '',
    centerName: '',
    subject: '',
    description: '',
  });
  const [complaintSuccess, setComplaintSuccess] = useState<string | null>(null);

  // Load SaaS Data
  useEffect(() => {
    const published = SaasPlatformService.getWebsitePublished();
    const publicPlans = SaasPlatformService.getPlans(false);
    const allCenters = SaasPlatformService.getCenters();
    const commSettings = SaasPlatformService.getCommunicationSettings();

    setConfig(published);
    setPlans(publicPlans);
    setCenters(allCenters.filter((c) => c.showInPublicDirectory !== false));
    setSettings(commSettings);

    if (publicPlans.length > 0 && !subForm.requestedPlanId) {
      setSubForm((prev) => ({ ...prev, requestedPlanId: publicPlans[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center text-white font-sans" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold">جارٍ تحميل موقع يلا سنتر...</span>
        </div>
      </div>
    );
  }

  // Handle Poll Vote
  const handleVote = () => {
    if (!selectedPollOption) return;
    const ok = SaasPlatformService.votePoll(selectedPollOption);
    if (ok) {
      setHasVotedPoll(true);
      setConfig(SaasPlatformService.getWebsitePublished());
    }
  };

  // Submit Subscription Request
  const handleSubmitSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    const planName = plans.find((p) => p.id === subForm.requestedPlanId)?.nameAr || '';
    const req = SaasPlatformService.submitCustomerRequest({
      type: 'subscription',
      centerName: subForm.centerName,
      contactPerson: subForm.contactPerson,
      phone: subForm.phone,
      email: subForm.email,
      governorate: subForm.governorate,
      branchCount: Number(subForm.branchCount) || 1,
      approxStudentsCount: Number(subForm.approxStudentsCount) || 100,
      requestedPlanId: subForm.requestedPlanId,
      requestedPlanName: planName,
      preferredContactMethod: subForm.preferredContactMethod,
      notes: subForm.notes,
    });
    setSubSuccess(`تم استلام طلبك بنجاح برقم مرجعي (#${req.id}). سيتواصل معك فريق الدعم قريباً.`);
    setSubForm({
      centerName: '',
      contactPerson: '',
      phone: '',
      email: '',
      governorate: 'القاهرة',
      branchCount: 1,
      approxStudentsCount: 300,
      requestedPlanId: plans[0]?.id || '',
      preferredContactMethod: 'phone',
      notes: '',
    });
  };

  // Submit Demo Request
  const handleSubmitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    const req = SaasPlatformService.submitCustomerRequest({
      type: 'demo',
      centerName: demoForm.centerName,
      contactPerson: demoForm.contactPerson,
      phone: demoForm.phone,
      email: demoForm.email,
      governorate: 'القاهرة',
      branchCount: 1,
      approxStudentsCount: 100,
      preferredContactMethod: 'phone',
      notes: `تاريخ العرض المفضل: ${demoForm.preferredDate}. ملاحظات: ${demoForm.notes}`,
    });
    setDemoSuccess(`تم حجز موعد العرض التوضيحي برقم (#${req.id}). سيتم تأكيد الموعد هاتفياً.`);
    setDemoForm({
      centerName: '',
      contactPerson: '',
      phone: '',
      email: '',
      preferredDate: '',
      notes: '',
    });
  };

  // Submit Complaint
  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    const comp = SaasPlatformService.submitComplaint(complaintForm);
    setComplaintSuccess(`تم تسجيل رسالتك في صندوق المنصة برقم (#${comp.id}). نشكر اهتمامك وحرصك على التطوير.`);
    setComplaintForm({
      senderName: '',
      email: '',
      phone: '',
      centerName: '',
      subject: '',
      description: '',
    });
  };

  const heroSection = config.sections.find((s) => s.id === 'hero' && s.enabled);
  const featuresSection = config.sections.find((s) => s.id === 'features' && s.enabled);
  const plansSection = config.sections.find((s) => s.id === 'plans' && s.enabled);
  const partnersSection = config.sections.find((s) => s.id === 'partners' && s.enabled);
  const testimonialsSection = config.sections.find((s) => s.id === 'testimonials' && s.enabled);
  const pollsSection = config.sections.find((s) => s.id === 'polls' && s.enabled);
  const faqSection = config.sections.find((s) => s.id === 'faq' && s.enabled);
  const formSection = config.sections.find((s) => s.id === 'subscription_form' && s.enabled);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden" dir="rtl">
      {/* Top Announcement Bar */}
      {config.announcementBar?.enabled && (
        <aside
          aria-label="إعلان المنصة"
          className="bg-gradient-to-r from-[#0B132B] via-[#1C2541] to-[#0B132B] border-b border-[#1C2541] text-xs py-2 px-4 text-center text-slate-200 z-50 flex items-center justify-center gap-2"
        >
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[10px] border border-cyan-500/40">
            {config.announcementBar.badgeAr}
          </span>
          <span className="font-medium">{config.announcementBar.textAr}</span>
          {config.announcementBar.link && (
            <a
              href={config.announcementBar.link}
              className="text-cyan-400 hover:text-cyan-300 underline font-bold transition-colors inline-flex items-center gap-0.5"
            >
              <span>تفاصيل أكثر</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </aside>
      )}

      {/* Main Public Navbar */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="inline-block transition-transform hover:scale-[1.01]">
              <BrandLogo width={160} height={38} priority />
            </Link>
            <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">الميزات المتطورة</a>
              <a href="#plans" className="hover:text-foreground transition-colors">باقات الاشتراك</a>
              <a href="#partners" className="hover:text-foreground transition-colors">السناتر الشريكة</a>
              <a href="#testimonials" className="hover:text-foreground transition-colors">آراء العملاء</a>
              <a href="#polls" className="hover:text-foreground transition-colors">استطلاع الرأي</a>
              <a href="#faq" className="hover:text-foreground transition-colors">الأسئلة الشائعة</a>
              <a href="#contact-forms" className="hover:text-foreground transition-colors">طلب اشتراك</a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted font-bold text-xs text-foreground transition-colors"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/owner"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold text-xs items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>بوابة المالك</span>
            </Link>
            <a
              href="#contact-forms"
              className="px-4 py-1.5 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs shadow-soft-sm transition-colors"
            >
              احجز سنترك الآن
            </a>
          </div>
        </div>
      </header>

      {/* Cinematic Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8">
        <CinematicHero
          onCtaClick={() => {
            const el = document.getElementById('contact-forms');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* Hero Section */}
      {heroSection && (
        <section className="relative py-16 lg:py-24 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
          {/* Ambient Background Blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

          {heroSection.badgeAr && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-bold mb-6 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{heroSection.badgeAr}</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight max-w-4xl leading-[1.25] mb-6">
            {heroSection.titleAr}
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8">
            {heroSection.subtitleAr}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
            <a
              href={heroSection.ctaLink || '#contact-forms'}
              className="px-7 py-3 rounded-2xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-sm shadow-soft-md transition-transform hover:scale-[1.02] flex items-center gap-2"
            >
              <span>{heroSection.ctaLabelAr || 'ابدأ تجربتك المجانية'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/center/elmaher"
              className="px-6 py-3 rounded-2xl border border-border bg-card hover:bg-muted font-bold text-sm text-foreground transition-colors flex items-center gap-2"
            >
              <Building2 className="w-4 h-4 text-cyan-500" />
              <span>الدخول إلى سنتر الماهر</span>
            </Link>
          </div>

          {/* Quick SaaS Trust Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
            <div className="p-4 rounded-2xl bg-card border border-border/80 text-center shadow-soft-sm">
              <p className="text-2xl sm:text-3xl font-black text-cyan-500">120K+</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">طالب مسجل بالسناتر</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border/80 text-center shadow-soft-sm">
              <p className="text-2xl sm:text-3xl font-black text-blue-500">&lt; 300ms</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">سرعة تسجيل الحضور</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border/80 text-center shadow-soft-sm">
              <p className="text-2xl sm:text-3xl font-black text-purple-500">100%</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">دقة حسابات المعلمين</p>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border/80 text-center shadow-soft-sm">
              <p className="text-2xl sm:text-3xl font-black text-emerald-500">99.9%</p>
              <p className="text-xs text-muted-foreground font-semibold mt-1">جاهزية سحابية Cloudflare</p>
            </div>
          </div>
        </section>
      )}

      {/* Special Offer Card */}
      {config.specialOffer?.enabled && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 w-full mb-16">
          <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-indigo-900/40 via-purple-900/30 to-card border border-purple-500/30 shadow-soft-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/40">
                  {config.specialOffer.titleAr}
                </span>
                <span className="text-xs text-muted-foreground">
                  صالح حتى {config.specialOffer.endDate}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground">
                {config.specialOffer.discountAr}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                {config.specialOffer.descriptionAr}
              </p>
            </div>
            <a
              href={config.specialOffer.ctaLink || '#contact-forms'}
              className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-soft-md transition-all self-start md:self-center shrink-0 flex items-center gap-2"
            >
              <span>{config.specialOffer.ctaLabelAr}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>
      )}

      {/* Features Grid Section */}
      {featuresSection && (
        <section id="features" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {featuresSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {featuresSection.subtitleAr}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">الاستقبال والحضور فائق السرعة</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                قراءة الباركود الليزري أو كاميرا الهاتف بأقل من 300 مللي ثانية مع التحقق الفوري من المقعد والمدفوعات ورصد درجات اختبار الحصة بالـ Enter.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">نظام حسابات موحد للمعلمين</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                مصدر حقيقة مالي موحد 100% بين شؤون المعلمين والحصص والمجموعات: يدعم أنظمة السنتر والبرايفت، الشرائح، والخصومات دون أي تضارب محاسبي.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">بنك الأسئلة والامتحانات بالـ AI</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                توليد نماذج اختبارات ذكية بنقرة واحدة بتنسيق الطباعة الرسمي A4 مع تصحيح تلقائي وإرسال النتائج عبر إشعارات أولياء الأمور.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">عزل أمني سحابي متعدد السناتر</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                معمارية Multi-Tenant حقيقية: بيانات كل سنتر معزولة تماماً في Firebase Firestore ومحمية بقواعد أمان صارمة ومصادقة حقيقية.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">7 بوابات مخصصة للأدوار</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                بوابات مستقلة لمالك المنصة، مدير السنتر، مدير الفرع، المحاسب، موظف الاستقبال، المعلم، وبوابات الطلاب وأولياء الأمور.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all shadow-soft-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">تكامل الإشعارات والواتساب</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                إرسال رسائل الغياب، تنبيهات السداد، ودرجات الحصص مباشرة لأولياء الأمور عبر واتساب والرسائل النصية لتعزيز الانضباط.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Pricing Plans Section */}
      {plansSection && (
        <section id="plans" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {plansSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              {plansSection.subtitleAr}
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-muted border border-border text-xs font-bold">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                دفع شهري
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>دفع سنوي</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">
                  وفر شهرين
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((p) => {
              const price = billingCycle === 'annual' ? p.annualPrice : p.monthlyPrice;
              const isSelectedInForm = subForm.requestedPlanId === p.id;
              return (
                <div
                  key={p.id}
                  className={`relative p-6 sm:p-7 rounded-3xl border flex flex-col justify-between transition-all ${
                    p.highlighted
                      ? 'border-cyan-500 bg-gradient-to-b from-card via-card to-cyan-500/5 shadow-soft-lg ring-1 ring-cyan-500/40'
                      : 'border-border bg-card shadow-soft-sm hover:border-cyan-500/40'
                  }`}
                >
                  {p.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-600 text-white font-bold text-[10px] shadow-sm">
                      الأكثر طلباً
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-black text-foreground mb-1">{p.nameAr}</h3>
                    <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{p.descriptionAr}</p>

                    <div className="mb-6 pb-6 border-b border-border/70 flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-black text-foreground">
                        {price.toLocaleString('ar-EG')}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        ج.م / {billingCycle === 'annual' ? 'سنة' : 'شهر'}
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-6 text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>
                          الطلاب:{' '}
                          <strong>
                            {p.maxStudents === -1 ? 'غير محدود' : p.maxStudents.toLocaleString('ar-EG')}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>
                          الفروع:{' '}
                          <strong>{p.maxBranches === -1 ? 'غير محدود' : p.maxBranches}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>
                          المعلمون:{' '}
                          <strong>{p.maxTeachers === -1 ? 'غير محدود' : p.maxTeachers}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>
                          وحدات AI الشهرية:{' '}
                          <strong>{p.aiUnitAllowance.toLocaleString('ar-EG')}</strong>
                        </span>
                      </div>
                      {p.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <a
                    href="#contact-forms"
                    onClick={() => {
                      setSubForm((prev) => ({ ...prev, requestedPlanId: p.id }));
                      setActiveFormTab('subscription');
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs text-center transition-all ${
                      isSelectedInForm
                        ? 'bg-cyan-600 text-white shadow-soft-sm'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    {isSelectedInForm ? '✓ الباقة المحددة في الطلب' : 'اختيار هذه الباقة'}
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Partner Centers Showcase */}
      {partnersSection && (
        <section id="partners" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {partnersSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {partnersSection.subtitleAr}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {centers.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-2xl bg-card border border-border hover:border-cyan-500/50 transition-all flex flex-col justify-between shadow-soft-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-base text-foreground">{c.nameAr}</span>
                    <Badge variant="cyan" className="text-[10px]">
                      {c.planNameAr}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{c.address || 'القاهرة، جمهورية مصر العربية'}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs font-medium text-foreground pb-4 border-b border-border/70">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">الطلاب</span>
                      <strong>{c.studentsCount}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">الفروع</span>
                      <strong>{c.branchesCount}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">المعلمون</span>
                      <strong>{c.teachersCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    سنتر مفعل سحابياً
                  </span>
                  <Link
                    href={`/center/${c.slug}`}
                    className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>دخول السنتر</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonialsSection && config.testimonials?.length > 0 && (
        <section id="testimonials" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {testimonialsSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {testimonialsSection.subtitleAr}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.testimonials.map((t) => (
              <div
                key={t.id}
                className="p-6 rounded-2xl bg-card border border-border shadow-soft-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400 text-xs">
                    {'★'.repeat(t.rating)}
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="pt-3 border-t border-border/60">
                  <p className="font-bold text-xs text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.role} — <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{t.centerName}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Poll Section */}
      {pollsSection && config.activePoll?.isActive && (
        <section id="polls" className="py-16 px-4 sm:px-6 max-w-4xl mx-auto w-full border-t border-border/60">
          <div className="p-6 sm:p-8 rounded-3xl bg-card border border-cyan-500/30 shadow-soft-md space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-500" />
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  استطلاع الرأي: {config.activePoll.questionAr}
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                إجمالي الأصوات: {config.activePoll.totalVotes.toLocaleString('ar-EG')}
              </span>
            </div>

            <div className="space-y-3">
              {config.activePoll.options.map((opt) => {
                const total = config.activePoll!.totalVotes || 1;
                const pct = Math.round((opt.votes / total) * 100);
                const isSelected = selectedPollOption === opt.id;

                return (
                  <div
                    key={opt.id}
                    onClick={() => !hasVotedPoll && setSelectedPollOption(opt.id)}
                    className={`relative p-3.5 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/40'
                        : 'border-border bg-background hover:border-cyan-500/30'
                    }`}
                  >
                    {hasVotedPoll && (
                      <div
                        className="absolute inset-y-0 right-0 bg-cyan-500/15 pointer-events-none transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <div className="relative z-10 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 font-semibold text-foreground">
                        <input
                          type="radio"
                          name="poll-option"
                          checked={isSelected}
                          onChange={() => setSelectedPollOption(opt.id)}
                          disabled={hasVotedPoll}
                          className="accent-cyan-500"
                        />
                        <span>{opt.textAr}</span>
                      </div>
                      {hasVotedPoll && (
                        <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                          {pct}% ({opt.votes})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                onClick={handleVote}
                disabled={!selectedPollOption || hasVotedPoll}
                className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                {hasVotedPoll ? '✓ تم تسجيل صوتك' : 'تصويت الآن'}
              </Button>
              {hasVotedPoll && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  شكراً لمشاركتك! صوتك يسهم في تحسين المنصة.
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAQs Section */}
      {faqSection && config.faqs?.length > 0 && (
        <section id="faq" className="py-16 px-4 sm:px-6 max-w-4xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {faqSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {faqSection.subtitleAr}
            </p>
          </div>

          <div className="space-y-3">
            {config.faqs.map((faq) => {
              const isExpanded = expandedFaq === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft-sm transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                    className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="font-bold text-sm text-foreground">{faq.question}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-cyan-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50 bg-background/50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Working Public Forms Section */}
      {formSection && (
        <section id="contact-forms" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto w-full border-t border-border/60">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              {formSection.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formSection.subtitleAr}
            </p>
          </div>

          {/* Form Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              type="button"
              onClick={() => setActiveFormTab('subscription')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFormTab === 'subscription'
                  ? 'bg-cyan-600 text-white shadow-soft-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              طلب اشتراك جديد
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab('demo')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFormTab === 'demo'
                  ? 'bg-cyan-600 text-white shadow-soft-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              طلب عرض تجريبي (Demo)
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab('complaint')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFormTab === 'complaint'
                  ? 'bg-cyan-600 text-white shadow-soft-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              صندوق الشكاوى والمقترحات
            </button>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-soft-md">
            {/* 1. Subscription Form */}
            {activeFormTab === 'subscription' && (
              <form onSubmit={handleSubmitSubscription} className="space-y-4">
                {subSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{subSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">اسم السنتر / المركز التعليمي *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: سنتر الأوائل التعليمي"
                      value={subForm.centerName}
                      onChange={(e) => setSubForm({ ...subForm, centerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">اسم المسؤول أو المدير *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أ. عبد الرحمن محمد"
                      value={subForm.contactPerson}
                      onChange={(e) => setSubForm({ ...subForm, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">رقم الهاتف / الواتساب *</label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="010XXXXXXXX"
                      value={subForm.phone}
                      onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      placeholder="center@example.com"
                      value={subForm.email}
                      onChange={(e) => setSubForm({ ...subForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">المحافظة</label>
                    <input
                      type="text"
                      placeholder="القاهرة / الجيزة / الإسكندرية..."
                      value={subForm.governorate}
                      onChange={(e) => setSubForm({ ...subForm, governorate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">الباقة المطلوبة</label>
                    <select
                      value={subForm.requestedPlanId}
                      onChange={(e) => setSubForm({ ...subForm, requestedPlanId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr} ({p.monthlyPrice} ج.م/شهرياً)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">عدد الفروع التقريبي</label>
                    <input
                      type="number"
                      min="1"
                      value={subForm.branchCount}
                      onChange={(e) => setSubForm({ ...subForm, branchCount: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">عدد الطلاب المتوقع</label>
                    <input
                      type="number"
                      min="10"
                      value={subForm.approxStudentsCount}
                      onChange={(e) => setSubForm({ ...subForm, approxStudentsCount: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">ملاحظات أو استفسارات خاصة</label>
                  <textarea
                    rows={3}
                    placeholder="اكتب أي متطلبات خاصة أو أسئلة تود مناقشتها مع فريق المبيعات..."
                    value={subForm.notes}
                    onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-soft-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال طلب الاشتراك السحابي</span>
                </Button>
              </form>
            )}

            {/* 2. Demo Booking Form */}
            {activeFormTab === 'demo' && (
              <form onSubmit={handleSubmitDemo} className="space-y-4">
                {demoSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{demoSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">اسم السنتر أو المؤسسة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أكاديمية المستقبل"
                      value={demoForm.centerName}
                      onChange={(e) => setDemoForm({ ...demoForm, centerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">اسم المسؤول *</label>
                    <input
                      type="text"
                      required
                      placeholder="اسمك الكريم"
                      value={demoForm.contactPerson}
                      onChange={(e) => setDemoForm({ ...demoForm, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">رقم الهاتف / الواتساب *</label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="010XXXXXXXX"
                      value={demoForm.phone}
                      onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      placeholder="name@domain.com"
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">الوقت والتاريخ المفضل للعرض</label>
                    <input
                      type="text"
                      placeholder="مثال: غداً الساعة 4 عصراً"
                      value={demoForm.preferredDate}
                      onChange={(e) => setDemoForm({ ...demoForm, preferredDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">أبرز الميزات التي تود التركيز عليها</label>
                  <textarea
                    rows={3}
                    placeholder="مثال: حضور الباركود، حسابات المعلمين، بنك الامتحانات..."
                    value={demoForm.notes}
                    onChange={(e) => setDemoForm({ ...demoForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-soft-sm flex items-center justify-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>تأكيد حجز العرض التوضيحي الحي</span>
                </Button>
              </form>
            )}

            {/* 3. Complaints & Suggestions Box */}
            {activeFormTab === 'complaint' && (
              <form onSubmit={handleSubmitComplaint} className="space-y-4">
                {complaintSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{complaintSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">الاسم الكريم *</label>
                    <input
                      type="text"
                      required
                      placeholder="اسمك"
                      value={complaintForm.senderName}
                      onChange={(e) => setComplaintForm({ ...complaintForm, senderName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      placeholder="email@example.com"
                      value={complaintForm.email}
                      onChange={(e) => setComplaintForm({ ...complaintForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="010XXXXXXXX"
                      value={complaintForm.phone}
                      onChange={(e) => setComplaintForm({ ...complaintForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">اسم السنتر (إن وُجد)</label>
                    <input
                      type="text"
                      placeholder="اختياري"
                      value={complaintForm.centerName}
                      onChange={(e) => setComplaintForm({ ...complaintForm, centerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">موضوع الرسالة أو الشكوى *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مقترح تطوير شاشة الاستقبال"
                      value={complaintForm.subject}
                      onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">تفاصيل الشكوى أو المقترح *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="يرجى كتابة التفاصيل وسيقوم فريق جودة المنصة بمراجعتها بدقة..."
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-soft-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال إلى إدارة جودة المنصة</span>
                </Button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Public Footer */}
      <footer className="mt-auto border-t border-border/80 bg-[#0B132B] text-slate-300 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-xs">
          <div className="space-y-3 md:col-span-1">
            <BrandLogo theme="dark" width={160} height={38} priority />
            <p className="text-slate-400 text-xs leading-relaxed">
              يلا سنتر: المنصة السحابية المتقدمة لإدارة شؤون السناتر والمراكز التعليمية، تابعة لمجموعة Yalla Codex.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white text-sm mb-3">روابط سريعة</p>
            <p><a href="#features" className="hover:text-cyan-400 transition-colors">الميزات السحابية</a></p>
            <p><a href="#plans" className="hover:text-cyan-400 transition-colors">باقات السناتر</a></p>
            <p><a href="#partners" className="hover:text-cyan-400 transition-colors">المراكز المشتركة</a></p>
            <p><a href="#faq" className="hover:text-cyan-400 transition-colors">الأسئلة المتكررة</a></p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white text-sm mb-3">بوابات الدخول</p>
            <p><Link href="/owner" className="hover:text-cyan-400 transition-colors flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-purple-400" /> بوابة المالك</Link></p>
            <p><Link href="/center/elmaher" className="hover:text-cyan-400 transition-colors flex items-center gap-1"><Building2 className="w-3 h-3 text-cyan-400" /> سنتر الماهر</Link></p>
            <p><Link href="/center/elmaher/student-portal" className="hover:text-cyan-400 transition-colors flex items-center gap-1"><GraduationCap className="w-3 h-3 text-emerald-400" /> بوابة الطالب</Link></p>
            <p><Link href="/teacher/elmaher" className="hover:text-cyan-400 transition-colors flex items-center gap-1"><Briefcase className="w-3 h-3 text-blue-400" /> بوابة المعلم</Link></p>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold text-white text-sm mb-3">بيانات التواصل المعتمدة</p>
            {settings && (
              <>
                <p className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span dir="ltr">{settings.primaryPhone}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-300">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span dir="ltr">{settings.whatsappNumber}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span dir="ltr">{settings.supportEmail}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{settings.addressAr}</span>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-[#1C2541] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© 2026 Yalla Center by Yalla Codex. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SaaS Engine 2.0 Live
            </span>
            <span>Cloudflare Edge Deployment</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
