'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Wallet,
  Activity,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Server,
  Sparkles,
  Globe,
  Inbox,
  Bot,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { OWNER_NAV_TABS } from '@/components/owner/owner-sidebar';

export default function OwnerOverviewDashboard() {
  const [centers, setCenters] = useState(SaasPlatformService.getCenters());
  const [plans, setPlans] = useState(SaasPlatformService.getPlans(true));
  const [requests, setRequests] = useState(SaasPlatformService.getRequests());
  const [finance, setFinance] = useState(SaasPlatformService.getFinancialSummary());
  const [aiConfig, setAiConfig] = useState(SaasPlatformService.getCentralAiConfig());

  const reloadData = () => {
    setCenters(SaasPlatformService.getCenters());
    setPlans(SaasPlatformService.getPlans(true));
    setRequests(SaasPlatformService.getRequests());
    setFinance(SaasPlatformService.getFinancialSummary());
    setAiConfig(SaasPlatformService.getCentralAiConfig());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const activeCentersCount = centers.filter((c) => c.status === 'active').length;
  const trialCentersCount = centers.filter((c) => c.status === 'trial').length;
  const suspendedCentersCount = centers.filter((c) => c.status === 'suspended').length;
  const totalStudents = centers.reduce((sum, c) => sum + c.studentsCount, 0);
  const totalAiUnits = centers.reduce((sum, c) => sum + c.aiBalance, 0);
  const totalAiConsumed = centers.reduce((sum, c) => sum + c.aiUsageTotal, 0);
  const pendingRequestsCount = requests.filter((r) => r.status === 'new' || r.status === 'under_review').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                لوحة القيادة المركزية لمالك المنصة
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                متابعة شاملة للمراكز والسناتر، الاشتراكات السحابية، البوابات المستقلة، ومحرك الذكاء الاصطناعي.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reloadData}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-cyan-500" />
            <span>تحديث المؤشرات</span>
          </Button>

          <Link href="/owner/centers">
            <Button
              type="button"
              variant="cyan"
              size="sm"
              className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سنتر جديد</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Main Core SaaS KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Centers */}
        <Card className="hover:border-purple-500/40 transition-all card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              السناتر والمراكز المسجلة
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">{centers.length}</div>
            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold">
              <span className="text-emerald-600 dark:text-emerald-400">
                {activeCentersCount} نشط
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-amber-600 dark:text-amber-400">
                {trialCentersCount} تجريبي
              </span>
              {suspendedCentersCount > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-rose-600 dark:text-rose-400">
                    {suspendedCentersCount} موقوف
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Financial Collections */}
        <Card className="hover:border-emerald-500/40 transition-all card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              إجمالي التحصيلات الفعلية
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground" dir="ltr">
              {finance.totalCollections.toLocaleString('en-US')} <span className="text-xs font-bold">ج.م</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-muted-foreground">مستحقات معلقة:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {finance.outstandingReceivables.toLocaleString('en-US')} ج.م
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Total Enrolled Students */}
        <Card className="hover:border-brand-cyan-500/40 transition-all card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              إجمالي الطلاب المخدومين
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {totalStudents.toLocaleString('ar-EG')}
            </div>
            <p className="text-[11px] text-brand-cyan-600 dark:text-brand-cyan-400 font-bold mt-2">
              عبر {centers.reduce((sum, c) => sum + c.branchesCount, 0)} مقرات وفروع تشغيلية
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Central AI Engine */}
        <Card className="hover:border-blue-500/40 transition-all card-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              محرك الذكاء الاصطناعي (AI)
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {totalAiUnits.toLocaleString('ar-EG')}{' '}
              <span className="text-xs font-bold text-muted-foreground">وحدة متاحة</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {aiConfig.provider === 'google_gemini' ? 'Gemini 1.5 Pro' : aiConfig.model}
              </span>
              <span className="text-muted-foreground font-mono">استهلاك: {totalAiConsumed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State Banner if no centers exist yet */}
      {centers.length === 0 && (
        <div className="card-elevated p-6 rounded-2xl border border-brand-cyan-500/30 bg-brand-cyan-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">مرحباً بك في لوحة تحكم مالك منصة يلا سنتر</h3>
              <p className="text-xs text-muted-foreground mt-0.5">لا توجد سناتر أو مراكز مسجلة بعد. يمكنك إضافة وتكوين أول سنتر على المنصة الآن.</p>
            </div>
          </div>
          <Link href="/owner/centers">
            <Button variant="cyan" size="sm" className="font-bold text-xs gap-1.5 shrink-0 shadow-soft-sm">
              <Plus className="w-4 h-4" />
              <span>إضافة أول سنتر</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Six Main Tabs Quick Navigator Hub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-cyan-500" />
            <span>الأقسام الرئيسية الستة لإدارة المنصة</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            بوابة الإدارة المركزية الموحدة لـ Yalla Center
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tab 1: Centers */}
          <Link
            href="/owner/centers"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-purple-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {centers.length} سناتر
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              1. إدارة السناتر والاشتراكات
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              دليل السناتر، معالج إنشاء السنتر المكون من 6 خطوات، التحكم في حدود الطلاب، الصلاحيات، وإيقاف أو تفعيل المراكز.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>فتح إدارة السناتر</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          {/* Tab 2: Website */}
          <Link
            href="/owner/website"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-brand-cyan-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center font-bold">
                <Globe className="w-5 h-5" />
              </div>
              <Badge variant="cyan" className="text-[11px]">
                نظام CMS ديناميكي
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-brand-cyan-600 dark:group-hover:text-brand-cyan-400 transition-colors">
              2. الواجهة الرئيسية (الموقع)
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              منشئ الموقع التسويقي العام، التحكم في الأقسام، النصوص، العروض الخاصة، المسودات، المعاينة، والنشر المباشر.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-brand-cyan-600 dark:text-brand-cyan-400">
              <span>فتح منشئ الموقع</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          {/* Tab 3: Requests */}
          <Link
            href="/owner/requests"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-blue-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Inbox className="w-5 h-5" />
              </div>
              {pendingRequestsCount > 0 && (
                <Badge variant="destructive" className="text-[11px] animate-pulse">
                  {pendingRequestsCount} جديد
                </Badge>
              )}
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              3. السناتر والحجوزات
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              طلبات الانضمام وحجز الديمو الواردة من الموقع العام، صندوق الشكاوى الخاص، وتحويل الطلب لسنتر بضغطة زر.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
              <span>مراجعة الطلبات والشكاوى</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          {/* Tab 4: Plans */}
          <Link
            href="/owner/plans"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-amber-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {plans.length} باقات
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              4. الباقات والاشتراكات
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              إدارة باقات الاشتراك، أسعار الشهري والسنوي، الميزات والحدود القصوى، النشر على الموقع وصفحات السناتر.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>إدارة الباقات والأسعار</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          {/* Tab 5: Settings & AI */}
          <Link
            href="/owner/settings"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-emerald-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <Badge variant="success" className="text-[11px]">
                API متصل
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              5. إعدادات التواصل والـ AI
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              تكوين مزود الذكاء الاصطناعي المركزي، تخصيص وحدات الـ AI للسناتر، حماية المفاتيح السحابية، ووسائل الاتصال.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>ضبط الذكاء الاصطناعي والتواصل</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          {/* Tab 6: Finance & Appointments */}
          <Link
            href="/owner/finance"
            className="card-elevated p-5 rounded-2xl border border-border hover:border-rose-500/50 bg-card transition-all group hover:shadow-soft-md"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                صافي: {finance.netProfit.toLocaleString('en-US')} ج.م
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground mt-3 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              6. الحسابات والمواعيد
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              فواتير اشتراكات السناتر، سندات القبض، مصاريف المنصة، وتقويم المواعيد وتجديد الاشتراكات ومقابلات الديمو.
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>فتح الحسابات والتقويم</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Active Centers Quick Status Table */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              <span>حالة المراكز والسناتر النشطة</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة مباشرة لبيئات العمل المنشأة على منصة يلا سنتر
            </p>
          </div>
          <Link href="/owner/centers">
            <Button variant="ghost" size="sm" className="text-xs font-bold gap-1 text-purple-600 dark:text-purple-400">
              <span>عرض كل السناتر ({centers.length})</span>
              <RTLIcon icon={ArrowUpRight} className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">السنتر</th>
                  <th className="py-3 px-4">الباقة والاشتراك</th>
                  <th className="py-3 px-4">الفروع / الطلاب</th>
                  <th className="py-3 px-4">رصيد الـ AI</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">دخول بيئة السنتر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {centers.map((center) => (
                  <tr key={center.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{center.nameAr}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        /{center.slug}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{center.planNameAr}</div>
                      <div className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                        {center.billingAmount.toLocaleString('en-US')} EGP / {center.billingFrequency === 'annual' ? 'سنة' : 'شهر'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">
                        {center.studentsCount.toLocaleString('ar-EG')} طالب
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {center.branchesCount} فروع
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="font-mono text-xs">
                        {center.aiBalance} وحدة
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          center.status === 'active'
                            ? 'success'
                            : center.status === 'trial'
                            ? 'cyan'
                            : 'destructive'
                        }
                        className="text-[11px]"
                      >
                        {center.status === 'active'
                          ? 'نشط'
                          : center.status === 'trial'
                          ? 'فترة تجريبية'
                          : 'موقوف'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/center/${center.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors"
                      >
                        <span>فتح السنتر</span>
                        <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
