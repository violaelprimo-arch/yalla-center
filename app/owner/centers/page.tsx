'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Sliders,
  Sparkles,
  Bot,
  Calendar,
  Lock,
  PauseCircle,
  PlayCircle,
  CreditCard,
  FileText,
  Key,
  Eye,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { CenterExtended, CenterStatus, BillingFrequency, SubscriptionPlan } from '@/lib/saas/types';
import { CenterFinancialModal } from '@/components/owner/center-financial-modal';

export default function OwnerCentersPage() {
  const [centers, setCenters] = useState<CenterExtended[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Selected center for details/actions modal
  const [selectedCenter, setSelectedCenter] = useState<CenterExtended | null>(null);
  const [financialCenter, setFinancialCenter] = useState<CenterExtended | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'subscription' | 'limits' | 'ai' | 'support'>('info');

  // AI Allocation form inside center details
  const [aiUnitsToAdd, setAiUnitsToAdd] = useState<number>(50);
  const [aiReason, setAiReason] = useState<string>('');
  const [supportReason, setSupportReason] = useState<string>('مساعدة فنية في ضبط المجموعات');

  // 6-step Wizard Form State
  const [wizardData, setWizardData] = useState({
    // Step 1: Identity & Contact
    nameAr: '',
    nameEn: '',
    slug: '',
    phone: '',
    address: 'القاهرة، مصر',
    email: '',
    // Step 2: Administrator
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminUsername: '',
    // Step 3: Plan & Frequency
    planId: 'plan-pro',
    billingFrequency: 'monthly' as BillingFrequency,
    // Step 4: Dates & Custom Price
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    customPrice: '' as string | number,
    // Step 5: Modules & AI Allocation
    modules: [
      'attendance',
      'reception',
      'groups',
      'exams',
      'ai_exams',
      'finance',
      'materials',
      'whatsapp',
      'parent_portal',
      'student_portal',
    ],
    aiAllocation: 250,
    showInPublicDirectory: true,
    notes: '',
  });

  const reloadData = () => {
    setCenters(SaasPlatformService.getCenters());
    setPlans(SaasPlatformService.getPlans(true));
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Filtered & Searched Centers
  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      const matchQuery =
        !searchQuery ||
        c.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.adminEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchPlan = planFilter === 'all' || c.subscriptionPlanId === planFilter;

      return matchQuery && matchStatus && matchPlan;
    });
  }, [centers, searchQuery, statusFilter, planFilter]);

  // Handle Wizard Auto Slug
  const handleNameArChange = (name: string) => {
    setWizardData((prev) => {
      let slug = prev.slug;
      if (!slug || slug === 'al-') {
        slug = name
          .trim()
          .replace(/^(سنتر|مركز|أكاديمية)\s+/i, '')
          .toLowerCase()
          .replace(/\s+/g, '-');
      }
      return { ...prev, nameAr: name, slug };
    });
  };

  // Submit 6-Step Wizard
  const handleCompleteWizard = async () => {
    setStatusMessage(null);
    const res = await SaasPlatformService.provisionNewCenter({
      ...wizardData,
      customPrice: wizardData.customPrice ? Number(wizardData.customPrice) : undefined,
    });

    if (!res.ok) {
      setStatusMessage(res.errorAr || 'تعذّر إنشاء السنتر');
      return;
    }

    reloadData();
    setIsWizardOpen(false);
    setWizardStep(1);
    setStatusMessage(`تم بنجاح تهيئة السنتر «${res.center?.nameAr}» برابط /center/${res.center?.slug}`);
  };

  // Status Change (Suspend / Activate)
  const handleToggleCenterStatus = (center: CenterExtended) => {
    const nextStatus: CenterStatus = center.status === 'active' ? 'suspended' : 'active';
    const updated = SaasPlatformService.setCenterStatus(center.id, nextStatus);
    if (updated) {
      reloadData();
      if (selectedCenter?.id === center.id) setSelectedCenter(updated);
      setStatusMessage(
        nextStatus === 'suspended'
          ? `تم إيقاف تشغيل سنتر «${center.nameAr}» مؤقتاً (مع الحفاظ الكامل على كافة البيانات والطلاب).`
          : `تم إعادة تفعيل سنتر «${center.nameAr}» بنجاح.`
      );
    }
  };

  // Allocate AI units
  const handleAddAiUnits = () => {
    if (!selectedCenter || aiUnitsToAdd <= 0) return;
    const res = SaasPlatformService.allocateAiUnits(
      selectedCenter.id,
      aiUnitsToAdd,
      aiReason || `شحن يدوي بواسطة مالك المنصة (+${aiUnitsToAdd} وحدة)`
    );
    if (res.ok) {
      reloadData();
      setSelectedCenter((prev) => (prev ? { ...prev, aiBalance: res.newBalance || 0 } : null));
      setStatusMessage(`تم شحن ${aiUnitsToAdd} وحدة AI لسنتر «${selectedCenter.nameAr}» بنجاح.`);
      setAiUnitsToAdd(50);
      setAiReason('');
    }
  };

  // Support Access
  const handleStartSupportAccess = () => {
    if (!selectedCenter) return;
    const session = SaasPlatformService.startSupportAccess(
      selectedCenter.slug,
      supportReason,
      60
    );
    if (session) {
      reloadData();
      setSelectedCenter((prev) => (prev ? { ...prev, supportAccessActive: true } : null));
      setStatusMessage(`تم تفعيل جلسة الدعم الفني المصرح بها لسنتر «${selectedCenter.nameAr}» لمدة 60 دقيقة.`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Building2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                إدارة السناتر والمراكز التعليمية
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                دليل السناتر، معالج الإنشاء الشامل، التحكم في الحدود والباقات، وتخصيص الصلاحيات.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="cyan"
            size="sm"
            onClick={() => {
              setWizardStep(1);
              setIsWizardOpen(true);
            }}
            className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            <span>معالج إضافة سنتر جديد</span>
          </Button>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-xs font-bold text-brand-cyan-700 dark:text-brand-cyan-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-cyan-500" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Directory Filters & Search Toolbar */}
      <div className="card-elevated p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث بالاسم، الرابط، أو البريد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="trial">فترة تجريبية</option>
            <option value="suspended">موقوف مؤقتاً</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
          >
            <option value="all">كافة الباقات</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reloadData}
            className="h-9 px-2.5 text-xs text-muted-foreground"
            title="إعادة تحميل"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Centers Directory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCenters.map((center) => {
          const isSuspended = center.status === 'suspended';
          return (
            <div
              key={center.id}
              className={`card-elevated rounded-2xl border p-5 bg-card flex flex-col justify-between transition-all hover:shadow-soft-md ${
                isSuspended
                  ? 'border-rose-500/30 opacity-80'
                  : 'border-border hover:border-brand-cyan-500/40'
              }`}
            >
              <div>
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <span>{center.nameAr}</span>
                    </h3>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      /{center.slug}
                    </div>
                  </div>

                  <Badge
                    variant={
                      center.status === 'active'
                        ? 'success'
                        : center.status === 'trial'
                        ? 'cyan'
                        : 'destructive'
                    }
                    className="text-[10px]"
                  >
                    {center.status === 'active'
                      ? 'نشط'
                      : center.status === 'trial'
                      ? 'تجريبي'
                      : 'موقوف'}
                  </Badge>
                </div>

                {/* Subscription & Pricing */}
                <div className="mt-3 p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground">{center.planNameAr}</span>
                    <span className="font-mono text-brand-cyan-600 dark:text-brand-cyan-400" dir="ltr">
                      {center.billingAmount.toLocaleString('en-US')} EGP / {center.billingFrequency === 'annual' ? 'سنة' : 'شهر'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>انتهاء الاشتراك:</span>
                    <span className="font-mono">{center.subscriptionEndDate.slice(0, 10)}</span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground">الطلاب</div>
                    <div className="font-mono font-bold text-xs mt-0.5 text-foreground">
                      {center.studentsCount} / {center.maxStudents === -1 ? '∞' : center.maxStudents}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground">الفروع</div>
                    <div className="font-mono font-bold text-xs mt-0.5 text-foreground">
                      {center.branchesCount} / {center.maxBranches === -1 ? '∞' : center.maxBranches}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground">رصيد AI</div>
                    <div className="font-mono font-bold text-xs mt-0.5 text-brand-cyan-600 dark:text-brand-cyan-400">
                      {center.aiBalance}
                    </div>
                  </div>
                </div>

                {/* Admin Contact info */}
                <div className="mt-3 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{center.adminName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate font-mono text-[10px]">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{center.adminEmail}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCenter(center);
                      setIsDetailsOpen(true);
                    }}
                    className="h-8 text-xs font-bold px-2.5 gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>إدارة وتحكم</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFinancialCenter(center)}
                    className="h-8 text-xs font-bold px-2.5 gap-1 border-brand-cyan-500/30 text-brand-cyan-600 dark:text-brand-cyan-400 hover:bg-brand-cyan-500/10"
                    title="عرض كشف حساب السنتر والفواتير والتحصيلات"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>الحسابات وكشف الحساب</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={isSuspended ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleCenterStatus(center)}
                    className="h-8 text-[11px] px-2 font-bold"
                    title={isSuspended ? 'إعادة التفعيل' : 'إيقاف مؤقت'}
                  >
                    {isSuspended ? (
                      <>
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>تفعيل</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>إيقاف</span>
                      </>
                    )}
                  </Button>

                  <Link
                    href={`/center/${center.slug}`}
                    className="h-8 px-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold inline-flex items-center gap-1 transition-colors"
                  >
                    <span>دخول</span>
                    <RTLIcon icon={ExternalLink} className="w-3 h-3 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 6-STEP ADD NEW CENTER WIZARD MODAL */}
      {/* ========================================================================= */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  <span>معالج إنشاء وتفعيل سنتر جديد (الخطوة {wizardStep} من 6)</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تهيئة النطاق السحابي المعزول وتوليد حساب المدير وحزمة الصلاحيات
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="px-5 pt-3">
              <div className="grid grid-cols-6 gap-1.5 text-center text-[10px] font-bold">
                {[
                  '1. الهوية',
                  '2. المدير',
                  '3. الباقة',
                  '4. الأسعار',
                  '5. الصلاحيات',
                  '6. المراجعة',
                ].map((label, idx) => (
                  <div
                    key={label}
                    className={`py-1 rounded-lg transition-colors ${
                      wizardStep === idx + 1
                        ? 'bg-brand-cyan-500 text-white'
                        : wizardStep > idx + 1
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Body */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {/* STEP 1: Center Identity & Contact */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 1: هوية وبيانات السنتر الأساسية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">اسم السنتر (عربي) *</span>
                      <input
                        type="text"
                        required
                        placeholder="مثال: سنتر الأوائل التعليمي"
                        value={wizardData.nameAr}
                        onChange={(e) => handleNameArChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">اسم السنتر (إنجليزي)</span>
                      <input
                        type="text"
                        placeholder="Al-Awael Educational Center"
                        value={wizardData.nameEn}
                        onChange={(e) => setWizardData({ ...wizardData, nameEn: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">معرّف الرابط (Slug) *</span>
                      <input
                        type="text"
                        required
                        placeholder="al-awael"
                        value={wizardData.slug}
                        onChange={(e) => setWizardData({ ...wizardData, slug: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        الرابط: /center/{wizardData.slug || '...'}
                      </span>
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">هاتف التواصل الرسمي *</span>
                      <input
                        type="text"
                        required
                        placeholder="+20 100 000 0000"
                        value={wizardData.phone}
                        onChange={(e) => setWizardData({ ...wizardData, phone: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                        dir="ltr"
                      />
                    </label>

                    <label className="text-xs space-y-1 block sm:col-span-2">
                      <span className="font-bold text-foreground">العنوان والمقر</span>
                      <input
                        type="text"
                        placeholder="المحافظة، المدينة، الشارع"
                        value={wizardData.address}
                        onChange={(e) => setWizardData({ ...wizardData, address: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: Administrator Profile */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 2: حساب المدير الإداري للسنتر
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">اسم المدير المسؤول *</span>
                      <input
                        type="text"
                        required
                        placeholder="أ. أحمد سامي"
                        value={wizardData.adminName}
                        onChange={(e) => setWizardData({ ...wizardData, adminName: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">البريد الإلكتروني للدخول *</span>
                      <input
                        type="email"
                        required
                        placeholder="admin@alawael.edu.eg"
                        value={wizardData.adminEmail}
                        onChange={(e) => setWizardData({ ...wizardData, adminEmail: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                        dir="ltr"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">هاتف المدير / واتساب *</span>
                      <input
                        type="text"
                        required
                        placeholder="+20 100 000 0000"
                        value={wizardData.adminPhone}
                        onChange={(e) => setWizardData({ ...wizardData, adminPhone: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                        dir="ltr"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">اسم المستخدم</span>
                      <input
                        type="text"
                        placeholder="awael_admin"
                        value={wizardData.adminUsername}
                        onChange={(e) => setWizardData({ ...wizardData, adminUsername: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                        dir="ltr"
                      />
                    </label>
                  </div>

                  <div className="p-3 rounded-2xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>
                      سيتم إرسال رابط تفعيل الحساب وتعيين كلمة المرور المشفرة مباشرة إلى بريد المدير عبر Firebase Auth دون إرسال كلمات مرور صريحة.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: Subscription Plan */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 3: باقة الاشتراك ودورية الفوترة
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {plans.map((p) => {
                      const selected = wizardData.planId === p.id;
                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setWizardData({ ...wizardData, planId: p.id })}
                          onKeyDown={(e) => e.key === 'Enter' && setWizardData({ ...wizardData, planId: p.id })}
                          className={`p-4 rounded-2xl border text-right cursor-pointer transition-all ${
                            selected
                              ? 'border-brand-cyan-500 bg-brand-cyan-500/10 ring-2 ring-brand-cyan-500/40 shadow-soft-sm'
                              : 'border-border bg-card/60 hover:border-border/80'
                          }`}
                        >
                          <div className="font-bold text-xs text-foreground">{p.nameAr}</div>
                          <div className="font-mono font-black text-sm text-brand-cyan-600 dark:text-brand-cyan-400 mt-2" dir="ltr">
                            {p.monthlyPrice.toLocaleString('en-US')} EGP/m
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-2 space-y-1">
                            <div>الطلاب: {p.maxStudents === -1 ? 'غير محدود' : p.maxStudents}</div>
                            <div>الفروع: {p.maxBranches === -1 ? 'غير محدود' : p.maxBranches}</div>
                            <div>وحدات AI: {p.aiUnitAllowance}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center gap-4 text-xs font-bold">
                    <span className="text-foreground">دورية الفاتورة:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="billingFreq"
                        checked={wizardData.billingFrequency === 'monthly'}
                        onChange={() => setWizardData({ ...wizardData, billingFrequency: 'monthly' })}
                      />
                      <span>شهري</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="billingFreq"
                        checked={wizardData.billingFrequency === 'annual'}
                        onChange={() => setWizardData({ ...wizardData, billingFrequency: 'annual' })}
                      />
                      <span>سنوي (توفير شهرين)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 4: Dates & Custom Price */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 4: تواريخ الاشتراك والسعر المخصص
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">تاريخ بدء الاشتراك</span>
                      <input
                        type="date"
                        value={wizardData.startDate}
                        onChange={(e) => setWizardData({ ...wizardData, startDate: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </label>

                    <label className="text-xs space-y-1 block">
                      <span className="font-bold text-foreground">تاريخ انتهاء الاشتراك</span>
                      <input
                        type="date"
                        value={wizardData.endDate}
                        onChange={(e) => setWizardData({ ...wizardData, endDate: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </label>

                    <label className="text-xs space-y-1 block sm:col-span-2">
                      <span className="font-bold text-foreground">سعر مخصص (اختياري - بالجنيه)</span>
                      <input
                        type="number"
                        placeholder="اتركه فارغاً لاعتماد السعر القياسي للباقة"
                        value={wizardData.customPrice}
                        onChange={(e) => setWizardData({ ...wizardData, customPrice: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        يمكن للمالك تحديد اتفاق مالي مخصص لسنتر شريك دون تغيير تسعير الباقة العامة.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 5: Limits, Permissions & Modules */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 5: تخصيص الموديولات ورصيد الذكاء الاصطناعي
                  </h3>

                  <label className="text-xs space-y-1 block">
                    <span className="font-bold text-foreground">رصيد وحدات الـ AI المبدئي</span>
                    <input
                      type="number"
                      value={wizardData.aiAllocation}
                      onChange={(e) => setWizardData({ ...wizardData, aiAllocation: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-foreground block">الموديولات المفعّلة للسنتر:</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { id: 'attendance', label: 'الاستقبال والحضور الفوري' },
                        { id: 'groups', label: 'الحصص والمجموعات' },
                        { id: 'exams', label: 'الامتحانات الورقية والتصحيح' },
                        { id: 'ai_exams', label: 'توليد امتحانات الذكاء الاصطناعي' },
                        { id: 'finance', label: 'الخزينة وحسابات المعلمين' },
                        { id: 'materials', label: 'بنك المذكرات والملفات' },
                        { id: 'whatsapp', label: 'إشعارات الواتساب السحابية' },
                        { id: 'parent_portal', label: 'بوابة ولي الأمر' },
                        { id: 'student_portal', label: 'بوابة الطالب' },
                      ].map((mod) => (
                        <label key={mod.id} className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wizardData.modules.includes(mod.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setWizardData((prev) => ({
                                ...prev,
                                modules: checked
                                  ? [...prev.modules, mod.id]
                                  : prev.modules.filter((m) => m !== mod.id),
                              }));
                            }}
                          />
                          <span className="text-[11px] font-semibold">{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={wizardData.showInPublicDirectory}
                      onChange={(e) => setWizardData({ ...wizardData, showInPublicDirectory: e.target.checked })}
                    />
                    <span>إظهار السنتر في قسم «شركاء النجاح» على الموقع التسويقي العام</span>
                  </label>
                </div>
              )}

              {/* STEP 6: Review & Idempotent Confirmation */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-cyan-500 uppercase tracking-wider">
                    الخطوة 6: مراجعة البيانات وتأكيد التهيئة
                  </h3>

                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">اسم السنتر:</span>
                      <strong className="text-foreground">{wizardData.nameAr}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">الرابط المباشر:</span>
                      <strong className="font-mono text-brand-cyan-600 dark:text-brand-cyan-400">/center/{wizardData.slug}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">المدير المسؤول:</span>
                      <strong className="text-foreground">{wizardData.adminName} ({wizardData.adminEmail})</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">الباقة:</span>
                      <strong className="text-foreground">{plans.find((p) => p.id === wizardData.planId)?.nameAr}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">رصيد وحدات الـ AI:</span>
                      <strong className="font-mono text-purple-600 dark:text-purple-400">{wizardData.aiAllocation} وحدة</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">الموديولات المفعّلة:</span>
                      <strong className="text-foreground">{wizardData.modules.length} موديولات</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>
                      جاهز للتنفيذ الآمن. سيتم إنشاء مساحة السنتر فوراً وإصدار أول فاتورة اشتراك تلقائياً.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Controls Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                className="text-xs font-bold gap-1"
              >
                <RTLIcon icon={ArrowRight} className="w-3.5 h-3.5" />
                <span>السابق</span>
              </Button>

              {wizardStep < 6 ? (
                <Button
                  type="button"
                  variant="cyan"
                  size="sm"
                  onClick={() => {
                    if (wizardStep === 1 && (!wizardData.nameAr || !wizardData.slug || !wizardData.phone)) {
                      alert('يرجى ملء الحقول الإلزامية في الخطوة الأولى');
                      return;
                    }
                    if (wizardStep === 2 && (!wizardData.adminName || !wizardData.adminEmail || !wizardData.adminPhone)) {
                      alert('يرجى ملء بيانات المدير الإداري');
                      return;
                    }
                    setWizardStep((prev) => Math.min(6, prev + 1));
                  }}
                  className="text-xs font-bold gap-1"
                >
                  <span>التالي</span>
                  <RTLIcon icon={ArrowLeft} className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="cyan"
                  size="sm"
                  onClick={handleCompleteWizard}
                  className="text-xs font-bold gap-1.5 shadow-soft-sm bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد وإنشاء السنتر الآن</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CENTER DETAILS & MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      {isDetailsOpen && selectedCenter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  <span>لوحة تحكم سنتر «{selectedCenter.nameAr}»</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    ID: {selectedCenter.id}
                  </Badge>
                  <Badge variant="cyan" className="font-mono text-[10px]">
                    /{selectedCenter.slug}
                  </Badge>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Internal Tabs */}
            <div className="flex border-b border-border px-5 gap-4 text-xs font-bold overflow-x-auto">
              {[
                { id: 'info', label: 'البيانات والهوية' },
                { id: 'subscription', label: 'الاشتراك والباقة' },
                { id: 'limits', label: 'الحدود والصلاحيات' },
                { id: 'ai', label: 'وحدات الـ AI' },
                { id: 'support', label: 'جلسة الدعم الفني' },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 border-b-2 transition-colors shrink-0 ${
                    activeTab === tab.id
                      ? 'border-brand-cyan-500 text-brand-cyan-600 dark:text-brand-cyan-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Tab Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar text-xs">
              {/* Tab 1: Info */}
              {activeTab === 'info' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">المدير الإداري</span>
                      <strong className="text-foreground text-xs mt-0.5 block">{selectedCenter.adminName}</strong>
                      <span className="text-[10px] text-muted-foreground font-mono">{selectedCenter.adminEmail}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">هاتف التواصل</span>
                      <strong className="text-foreground text-xs mt-0.5 block font-mono" dir="ltr">{selectedCenter.phone}</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-background border border-border col-span-2">
                      <span className="text-muted-foreground block text-[10px]">العنوان التشغيلي</span>
                      <strong className="text-foreground text-xs mt-0.5 block">{selectedCenter.address}</strong>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-bold text-foreground">الحالة التشغيلية للسنتر:</span>
                    <Button
                      type="button"
                      variant={selectedCenter.status === 'suspended' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleCenterStatus(selectedCenter)}
                      className="text-xs font-bold"
                    >
                      {selectedCenter.status === 'suspended' ? 'إعادة التفعيل الآن' : 'إيقاف مؤقت'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Subscription */}
              {activeTab === 'subscription' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الباقة المعتمدة:</span>
                      <strong className="text-foreground">{selectedCenter.planNameAr}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">قيمة الفاتورة:</span>
                      <strong className="font-mono text-brand-cyan-600 dark:text-brand-cyan-400" dir="ltr">
                        {selectedCenter.billingAmount.toLocaleString('en-US')} EGP / {selectedCenter.billingFrequency === 'annual' ? 'سنة' : 'شهر'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                      <strong className="font-mono">{selectedCenter.subscriptionEndDate.slice(0, 10)}</strong>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newEnd = new Date(Date.parse(selectedCenter.subscriptionEndDate) + 30 * 86400000).toISOString();
                        const updated = SaasPlatformService.updateCenter(selectedCenter.id, { subscriptionEndDate: newEnd });
                        if (updated) {
                          setSelectedCenter(updated);
                          reloadData();
                          setStatusMessage(`تم تمديد اشتراك «${selectedCenter.nameAr}» لمدة شهر إضافي.`);
                        }
                      }}
                      className="text-xs font-bold"
                    >
                      تمديد شهر إضافي (+30 يوم)
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 3: Limits */}
              {activeTab === 'limits' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground">الحد الأقصى للطلاب</span>
                      <div className="text-sm font-bold font-mono mt-1 text-foreground">
                        {selectedCenter.maxStudents === -1 ? 'غير محدود (∞)' : selectedCenter.maxStudents}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground">الحد الأقصى للفروع</span>
                      <div className="text-sm font-bold font-mono mt-1 text-foreground">
                        {selectedCenter.maxBranches === -1 ? 'غير محدود (∞)' : selectedCenter.maxBranches}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-1">
                    <span className="font-bold text-foreground block">الموديولات المصرّح بها:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCenter.enabledModules.map((mod) => (
                        <Badge key={mod} variant="outline" className="text-[10px]">
                          {mod}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: AI Units */}
              {activeTab === 'ai' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-purple-400 font-bold block">الرصيد المتاح حالياً</span>
                      <div className="text-xl font-mono font-black text-purple-300">
                        {selectedCenter.aiBalance} وحدة AI
                      </div>
                    </div>
                    <div className="text-left font-mono text-xs text-muted-foreground">
                      استهلاك كلي: {selectedCenter.aiUsageTotal}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="font-bold text-foreground block">شحن أو تعديل رصيد الـ AI:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={aiUnitsToAdd}
                        onChange={(e) => setAiUnitsToAdd(Number(e.target.value))}
                        className="w-28 h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="سبب الشحن (مثال: هدية باقة أو ترقية)..."
                        value={aiReason}
                        onChange={(e) => setAiReason(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-xl border border-border bg-background text-xs"
                      />
                      <Button
                        type="button"
                        variant="cyan"
                        size="sm"
                        onClick={handleAddAiUnits}
                        className="h-9 px-3 text-xs font-bold shrink-0"
                      >
                        شحن
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Support Access */}
              {activeTab === 'support' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                      <span>جلسة الدعم الفني المصرح بها (Time-Limited Support Access)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      تتيح هذه الميزة لمالك المنصة دخول بيئة السنتر كدعم فني مؤقت وموثق بسجل تدقيق رسمي دون انتحال هوية المدير وبأذونات زمنية تنتهي تلقائياً.
                    </p>
                  </div>

                  <label className="text-xs space-y-1 block">
                    <span className="font-bold text-foreground">سبب الدخول الفني الموثق:</span>
                    <input
                      type="text"
                      value={supportReason}
                      onChange={(e) => setSupportReason(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium"
                    />
                  </label>

                  <div className="pt-2 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="cyan"
                      size="sm"
                      onClick={handleStartSupportAccess}
                      className="text-xs font-bold gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>بدء جلسة دعم لمدة 60 دقيقة</span>
                    </Button>

                    <Link
                      href={`/center/${selectedCenter.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors"
                    >
                      <span>الانتقال المباشر لبيئة السنتر</span>
                      <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Close Footer */}
            <div className="p-4 border-t border-border flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="text-xs font-bold px-4"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Center Detailed Statement & Financial Ledger Modal */}
      {financialCenter && (
        <CenterFinancialModal
          center={financialCenter}
          isOpen={true}
          onClose={() => setFinancialCenter(null)}
          onDataChanged={reloadData}
        />
      )}
    </div>
  );
}
