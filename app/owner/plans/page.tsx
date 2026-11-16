'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sliders,
  DollarSign,
  Users,
  Building2,
  Bot,
  Bell,
  HardDrive,
  Check,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { SubscriptionPlan, SubscriptionPlanTier, BillingFrequency } from '@/lib/saas/types';

export default function OwnerPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    nameAr: '',
    nameEn: '',
    tier: 'pro',
    descriptionAr: '',
    monthlyPrice: 3500,
    annualPrice: 35000,
    currency: 'EGP',
    billingFrequency: 'monthly',
    trialDays: 14,
    maxStudents: 1000,
    maxTeachers: 40,
    maxEmployees: 12,
    maxBranches: 3,
    aiUnitAllowance: 250,
    notificationAllowance: 2500,
    storageAllowanceMb: 10240,
    enabledModules: ['attendance', 'reception', 'groups', 'finance', 'exams', 'materials'],
    features: [
      'حضور سريع بالباركود والليزر',
      'حسابات المعلمين بنظامي السنتر والبرايفت',
      'توليد امتحانات بالذكاء الاصطناعي',
      'بوابة ولي الأمر والطالب',
    ],
    highlighted: false,
    isPublic: true,
    displayOrder: 1,
    isActive: true,
  });

  const reloadPlans = () => {
    setPlans(SaasPlatformService.getPlans(true));
  };

  useEffect(() => {
    reloadPlans();
  }, []);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      id: `plan-${Date.now().toString().slice(-4)}`,
      nameAr: '',
      nameEn: '',
      tier: 'pro',
      descriptionAr: '',
      monthlyPrice: 2500,
      annualPrice: 25000,
      currency: 'EGP',
      billingFrequency: 'monthly',
      trialDays: 14,
      maxStudents: 500,
      maxTeachers: 20,
      maxEmployees: 5,
      maxBranches: 2,
      aiUnitAllowance: 150,
      notificationAllowance: 1000,
      storageAllowanceMb: 5120,
      enabledModules: ['attendance', 'reception', 'groups', 'finance'],
      features: ['ميزة قياسية 1', 'ميزة قياسية 2'],
      highlighted: false,
      isPublic: true,
      displayOrder: plans.length + 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({ ...plan });
    setIsEditorOpen(true);
  };

  const handleSavePlan = () => {
    if (!formData.nameAr || !formData.monthlyPrice) {
      alert('يرجى ملء اسم الباقة وسعرها الشهري');
      return;
    }

    const planToSave: SubscriptionPlan = {
      id: formData.id || editingPlan?.id || `plan-${Date.now()}`,
      tier: (formData.tier as SubscriptionPlanTier) || 'pro',
      nameAr: formData.nameAr,
      nameEn: formData.nameEn || '',
      descriptionAr: formData.descriptionAr || '',
      monthlyPrice: Number(formData.monthlyPrice),
      annualPrice: Number(formData.annualPrice || Number(formData.monthlyPrice) * 10),
      currency: formData.currency || 'EGP',
      billingFrequency: (formData.billingFrequency as BillingFrequency) || 'monthly',
      trialDays: Number(formData.trialDays || 14),
      maxStudents: Number(formData.maxStudents),
      maxTeachers: Number(formData.maxTeachers),
      maxEmployees: Number(formData.maxEmployees),
      maxBranches: Number(formData.maxBranches),
      aiUnitAllowance: Number(formData.aiUnitAllowance || 0),
      notificationAllowance: Number(formData.notificationAllowance || 0),
      storageAllowanceMb: Number(formData.storageAllowanceMb || 1024),
      enabledModules: formData.enabledModules || [],
      features: formData.features || [],
      highlighted: Boolean(formData.highlighted),
      isPublic: Boolean(formData.isPublic),
      displayOrder: Number(formData.displayOrder || 1),
      isActive: Boolean(formData.isActive),
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    SaasPlatformService.savePlan(planToSave);
    reloadPlans();
    setIsEditorOpen(false);
    setStatusMessage(`تم حفظ باقة «${planToSave.nameAr}» بنجاح وتحديث قاعدة البيانات السحابية.`);
  };

  const handleArchive = (planId: string) => {
    SaasPlatformService.archivePlan(planId);
    reloadPlans();
    setStatusMessage('تم أرشفة الباقة وإخفاؤها من الموقع العام مع الحفاظ الكامل على الاشتراكات النشطة السابقة.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                إدارة باقات واشتراكات المنصة السحابية
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                تحديد الأسعار الرسمية، فترات التجربة، حدود الطلاب والمعلمين، وتخصيص وحدات الـ AI.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="cyan"
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة باقة جديدة</span>
          </Button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-500" />
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

      {/* Notice about Pricing Integrity */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-brand-cyan-500 shrink-0" />
        <span>
          <strong>ملاحظة مالية:</strong> تعديل أسعار الباقات يطبَّق فوراً على الموقع التسويقي العام والاشتراكات الجديدة، ولا يغير إطلاقاً فواتير أو عقود الاشتراكات السابقة سارية المفعول.
        </span>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`card-elevated rounded-3xl border p-6 bg-card flex flex-col justify-between transition-all hover:shadow-soft-md ${
              plan.highlighted
                ? 'border-brand-cyan-500 ring-2 ring-brand-cyan-500/30'
                : 'border-border'
            } ${!plan.isActive ? 'opacity-50' : ''}`}
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  ترتيب: #{plan.displayOrder}
                </span>

                <div className="flex items-center gap-1.5">
                  {plan.highlighted && (
                    <Badge variant="cyan" className="text-[10px] font-bold">
                      الأكثر طلباً ⭐
                    </Badge>
                  )}
                  {plan.isPublic ? (
                    <Badge variant="success" className="text-[10px]">
                      معروضة للعامة
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      خاصة
                    </Badge>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-black text-foreground mt-3">{plan.nameAr}</h3>
              <p className="text-xs text-muted-foreground mt-1 min-h-[32px] leading-relaxed">
                {plan.descriptionAr}
              </p>

              {/* Pricing Display */}
              <div className="mt-4 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                <div className="flex items-baseline gap-1" dir="ltr">
                  <span className="text-2xl font-black font-mono text-foreground">
                    {plan.monthlyPrice.toLocaleString('en-US')}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">EGP / شهر</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex justify-between font-mono">
                  <span>السنوي: {plan.annualPrice.toLocaleString('en-US')} EGP</span>
                  <span>تجربة مجانية: {plan.trialDays} يوم</span>
                </div>
              </div>

              {/* Limits Matrix */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">الطلاب</span>
                  <strong className="text-foreground font-mono">
                    {plan.maxStudents === -1 ? 'غير محدود (∞)' : `${plan.maxStudents} طالب`}
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">الفروع</span>
                  <strong className="text-foreground font-mono">
                    {plan.maxBranches === -1 ? 'غير محدود (∞)' : `${plan.maxBranches} فروع`}
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">وحدات الـ AI</span>
                  <strong className="text-purple-600 dark:text-purple-400 font-mono">
                    {plan.aiUnitAllowance} وحدة/شهر
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">إشعارات الواتساب</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {plan.notificationAllowance} إشعار
                  </strong>
                </div>
              </div>

              {/* Features List */}
              <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                <span className="text-[11px] font-bold text-foreground block">الميزات المشمولة:</span>
                {plan.features.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(plan)}
                className="text-xs font-bold gap-1 h-8 px-3"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل الباقة</span>
              </Button>

              {plan.isActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(plan.id)}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 h-8 px-2"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>أرشفة</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* PLAN EDITOR MODAL */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>{editingPlan ? `تعديل باقة «${editingPlan.nameAr}»` : 'إنشاء باقة اشتراك جديدة'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">اسم الباقة (عربي) *</span>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">الاسم بالإنجليزي</span>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  />
                </label>

                <label className="space-y-1 block sm:col-span-2">
                  <span className="font-bold text-foreground">الوصف التسويقي للباقة</span>
                  <input
                    type="text"
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">السعر الشهري (ج.م) *</span>
                  <input
                    type="number"
                    required
                    value={formData.monthlyPrice}
                    onChange={(e) => setFormData({ ...formData, monthlyPrice: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">السعر السنوي (ج.م)</span>
                  <input
                    type="number"
                    value={formData.annualPrice}
                    onChange={(e) => setFormData({ ...formData, annualPrice: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">الحد الأقصى للطلاب (-1 لغير المحدود)</span>
                  <input
                    type="number"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">الحد الأقصى للفروع (-1 لغير المحدود)</span>
                  <input
                    type="number"
                    value={formData.maxBranches}
                    onChange={(e) => setFormData({ ...formData, maxBranches: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">رصيد وحدات الـ AI الشهري</span>
                  <input
                    type="number"
                    value={formData.aiUnitAllowance}
                    onChange={(e) => setFormData({ ...formData, aiUnitAllowance: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold text-purple-600 dark:text-purple-400"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">أيام الفترة التجريبية (Trial)</span>
                  <input
                    type="number"
                    value={formData.trialDays}
                    onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  />
                </label>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.highlighted}
                    onChange={(e) => setFormData({ ...formData, highlighted: e.target.checked })}
                  />
                  <span>تمييز كباقة موصى بها (Highlighted)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  />
                  <span>إظهار في الموقع التسويقي العام</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(false)}
                className="text-xs font-bold px-4"
              >
                إلغاء
              </Button>

              <Button
                type="button"
                variant="cyan"
                size="sm"
                onClick={handleSavePlan}
                className="text-xs font-bold px-4"
              >
                حفظ التغييرات في قاعدة البيانات
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
