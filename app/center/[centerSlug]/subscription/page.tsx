'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CreditCard,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Users,
  Building2,
  FileText,
  ArrowRight,
  Send,
  Zap,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SaasPlatformService } from '@/lib/saas/service';
import type {
  CenterExtended,
  SubscriptionPlan,
  OwnerInvoice,
} from '@/lib/saas/types';

export default function CenterSubscriptionPage() {
  const { tenant, currentRole, currentUser } = useTenant();
  const [center, setCenter] = useState<CenterExtended | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [invoices, setInvoices] = useState<OwnerInvoice[]>([]);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [requestUpgradeOpen, setRequestUpgradeOpen] = useState(false);
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = useState('');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  useEffect(() => {
    const c = SaasPlatformService.getCenterBySlug(tenant.slug);
    if (c) {
      setCenter(c);
      const p = SaasPlatformService.getPlanById(c.subscriptionPlanId);
      if (p) setPlan(p);
      const invs = SaasPlatformService.getInvoices().filter((i) => i.tenantId === c.id || i.tenantSlug === c.slug);
      setInvoices(invs);
    }
    const publicPlans = SaasPlatformService.getPlans(false);
    setAllPlans(publicPlans);
    if (publicPlans.length > 0) setSelectedUpgradePlanId(publicPlans[0].id);
  }, [tenant.slug]);

  if (!center) {
    return (
      <div className="card-elevated p-8 rounded-2xl border border-border text-center text-xs text-muted-foreground bg-card" dir="rtl">
        جارٍ تحميل بيانات الاشتراك السحابي للسنتر...
      </div>
    );
  }

  // Calculate days remaining
  const now = new Date();
  const endDate = new Date(center.subscriptionEndDate);
  const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const handleUpgradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlan = allPlans.find((p) => p.id === selectedUpgradePlanId);
    const req = SaasPlatformService.submitCustomerRequest({
      type: 'subscription',
      centerName: center.nameAr,
      contactPerson: currentUser.fullName || center.adminName,
      phone: center.adminPhone || '01000000000',
      email: center.adminEmail || 'admin@example.com',
      governorate: 'القاهرة',
      branchCount: center.branchesCount,
      approxStudentsCount: center.studentsCount,
      requestedPlanId: selectedUpgradePlanId,
      requestedPlanName: targetPlan?.nameAr || 'ترقية باقة',
      preferredContactMethod: 'phone',
      notes: `طلب ترقية أو تجديد من لوحة السنتر. ملاحظات: ${upgradeNotes}`,
    });

    setUpgradeSuccess(`تم إرسال طلب الترقية (#${req.id}) إلى إدارة المنصة بنجاح. سيتواصل معك فريق الحسابات لتفعيل الميزات.`);
    setUpgradeNotes('');
    setTimeout(() => {
      setRequestUpgradeOpen(false);
      setUpgradeSuccess(null);
    }, 3000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="card-elevated p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-card via-card to-purple-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">
              اشتراك السنتر السحابي — {center.nameAr}
            </h1>
            <Badge variant="cyan" className="font-bold">
              {center.planNameAr}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            متابعة استهلاك الحدود السحابية، رصيد بنك الأسئلة والـ AI، وفواتير الاشتراك السنوية والشهرية.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setRequestUpgradeOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold gap-2 shadow-soft-sm self-start md:self-center"
        >
          <Sparkles className="w-4 h-4" />
          <span>طلب ترقية أو تجديد الباقة</span>
        </Button>
      </div>

      {/* Subscription Status HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground font-semibold">حالة الاشتراك</span>
          <div className="mt-3 flex items-baseline justify-between">
            <Badge
              variant={center.status === 'active' ? 'success' : center.status === 'trial' ? 'cyan' : 'destructive'}
              className="text-xs"
            >
              {center.status === 'active' ? 'نشط ومفعل' : center.status === 'trial' ? 'فترة تجريبية' : 'معلق'}
            </Badge>
            <span className="text-xs font-mono font-bold text-foreground">
              {center.billingAmount} ج.م / {center.billingFrequency === 'annual' ? 'سنة' : 'شهر'}
            </span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground font-semibold">الأيام المتبقية</span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {remainingDays}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ينتهي: {new Date(center.subscriptionEndDate).toLocaleDateString('ar-EG')}
            </span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground font-semibold">رصيد الذكاء الاصطناعي الحالي</span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {center.aiBalance}
            </span>
            <span className="text-[10px] text-muted-foreground">وحدة بنك الأسئلة</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <span className="text-xs text-muted-foreground font-semibold">إجمالي استخدام الـ AI</span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {center.aiUsageTotal}
            </span>
            <span className="text-[10px] text-muted-foreground">عملية توليد ذكية</span>
          </div>
        </div>
      </div>

      {/* Usage vs Limits Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">حدود السنتر والاستهلاك الفعلي</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Students Limit */}
          <div className="card-elevated p-5 rounded-2xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-500" />
                <span>الطلاب المقيدون</span>
              </span>
              <span className="text-xs font-mono font-bold">
                {center.studentsCount} / {center.maxStudents === -1 ? '∞' : center.maxStudents}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{
                  width: `${center.maxStudents === -1 ? 25 : Math.min(100, Math.round((center.studentsCount / center.maxStudents) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {center.maxStudents === -1
                ? 'باقتك تدعم عدداً غير محدود من الطلاب دون أي قيود.'
                : `المتبقي: ${Math.max(0, center.maxStudents - center.studentsCount)} مقعد قبل الوصول للحد الأقصى.`}
            </p>
          </div>

          {/* Branches Limit */}
          <div className="card-elevated p-5 rounded-2xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span>الفروع المشغلة</span>
              </span>
              <span className="text-xs font-mono font-bold">
                {center.branchesCount} / {center.maxBranches === -1 ? '∞' : center.maxBranches}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${center.maxBranches === -1 ? 30 : Math.min(100, Math.round((center.branchesCount / center.maxBranches) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {center.maxBranches === -1
                ? 'باقتك تدعم فتح عدد غير محدود من الفروع.'
                : `يمكنك إضافة ${Math.max(0, center.maxBranches - center.branchesCount)} فرع إضافي.`}
            </p>
          </div>

          {/* Teachers Limit */}
          <div className="card-elevated p-5 rounded-2xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-500" />
                <span>المعلمون المعتمدون</span>
              </span>
              <span className="text-xs font-mono font-bold">
                {center.teachersCount} / {center.maxTeachers === -1 ? '∞' : center.maxTeachers}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${center.maxTeachers === -1 ? 20 : Math.min(100, Math.round((center.teachersCount / center.maxTeachers) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {center.maxTeachers === -1
                ? 'عدد المعلمين مفتوح بالكامل في هذه الباقة.'
                : `متاح إضافة ${Math.max(0, center.maxTeachers - center.teachersCount)} معلماً.`}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Invoices History */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-600" />
          <span>سجل فواتير الاشتراك السحابي الصادرة من المنصة</span>
        </h2>

        {invoices.length === 0 ? (
          <div className="card-elevated p-6 rounded-2xl border border-border text-center text-xs text-muted-foreground bg-card">
            لا توجد فواتير اشتراك مسجلة حالياً لهذا السنتر.
          </div>
        ) : (
          <div className="card-elevated rounded-2xl border border-border overflow-hidden bg-card">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">الباقة / البيان</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">تاريخ الاستحقاق</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="p-3 font-mono font-bold text-foreground">{inv.invoiceNumber}</td>
                    <td className="p-3">{inv.planNameAr}</td>
                    <td className="p-3 font-bold font-mono text-foreground">
                      {inv.amount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{inv.dueDate}</td>
                    <td className="p-3">
                      <Badge variant={inv.status === 'paid' ? 'success' : 'destructive'} className="text-[10px]">
                        {inv.status === 'paid' ? 'مسددة بالكامل' : 'مستحقة'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upgrade Request Modal */}
      {requestUpgradeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-soft-lg space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>طلب ترقية أو تجديد باقة السنتر</span>
              </h3>
              <button
                type="button"
                onClick={() => setRequestUpgradeOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {upgradeSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{upgradeSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpgradeSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">اختر الباقة المستهدفة للترقية</label>
                <select
                  value={selectedUpgradePlanId}
                  onChange={(e) => setSelectedUpgradePlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-bold"
                >
                  {allPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} ({p.monthlyPrice} ج.م/شهر - {p.maxStudents === -1 ? 'طلاب غير محدود' : `${p.maxStudents} طالب`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">ملاحظات أو وحدات AI إضافية مطلوبة</label>
                <textarea
                  rows={3}
                  placeholder="مثال: نود ترقية الباقة لفرع إضافي وإضافة 1000 وحدة ذكاء اصطناعي..."
                  value={upgradeNotes}
                  onChange={(e) => setUpgradeNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRequestUpgradeOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال الطلب لإدارة المنصة</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
