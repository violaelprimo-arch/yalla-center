'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  Users,
  Calendar,
  Clock,
  QrCode,
  FileSpreadsheet,
  Cpu,
  Wallet,
  Layers,
  ArrowRight,
  TrendingUp,
  Award,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SaasPlatformService } from '@/lib/saas/service';
import type { CenterExtended } from '@/lib/saas/types';
import { getDataProvider } from '@/lib/dal/factory';

export default function CenterAdminPortalPage() {
  const { tenant, branches, currentRole, currentUser, groupData, masterData } = useTenant();
  const { groups, classrooms } = groupData;
  const [centerSaaS, setCenterSaaS] = useState<CenterExtended | null>(null);
  const [studentsCount, setStudentsCount] = useState<number>(0);

  useEffect(() => {
    const c = SaasPlatformService.getCenterBySlug(tenant.slug);
    if (c) {
      setCenterSaaS(c);
    }
    const token = masterData.auth.idToken;
    if (process.env.NODE_ENV === 'test' || token) {
      getDataProvider(token || undefined)
        .getUsers(tenant.id, { role: 'STUDENT' })
        .then((users) => setStudentsCount(users.length))
        .catch(() => setStudentsCount(0));
    }
  }, [tenant.slug, tenant.id, masterData.auth.idToken]);

  const activeBranches = branches.filter((b) => b.isActive !== false);
  const activeGroups = groups.filter((g) => g.isActive !== false);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Admin Header Banner */}
      <div className="card-elevated p-6 rounded-2xl border border-brand-cyan-500/30 bg-gradient-to-r from-card via-card to-brand-cyan-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">
              بوابة الإدارة العامة — {tenant.nameAr}
            </h1>
            <Badge variant="cyan" className="font-bold">
              مدير السنتر الرئيسي
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            مرحباً بك، <strong className="text-foreground">{currentUser.fullName}</strong>. إدارة الفروع، المجموعات، الحسابات، وصلاحيات النظام.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/center/${tenant.slug}/subscription`}>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              <span>اشتراك السنتر ({centerSaaS?.planNameAr || 'الاحترافية'})</span>
            </Button>
          </Link>
          <Link href={`/center/${tenant.slug}/reception`}>
            <Button size="sm" variant="primary" className="gap-1.5 text-xs font-bold shadow-soft-sm">
              <QrCode className="w-4 h-4" />
              <span>الاستقبال السريع</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">إجمالي الطلاب</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {studentsCount}
            </span>
            <span className="text-[10px] text-muted-foreground">
              الحد الأقصى: {centerSaaS?.maxStudents === -1 ? 'مفتوح' : centerSaaS?.maxStudents || 'غير مقيد'}
            </span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">المجموعات النشطة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {activeGroups.length}
            </span>
            <span className="text-[10px] text-muted-foreground">
              فروع السنتر: {activeBranches.length}
            </span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">رصيد الذكاء الاصطناعي</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {centerSaaS?.aiBalance ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">وحدة بنك الأسئلة</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">حالة الاشتراك السحابي</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <Badge variant={tenant.isActive ? 'success' : 'warning'} className="text-xs">
              {tenant.isActive ? 'نشط ومفعل' : 'موقوف'}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              باقة {tenant.subscriptionPlan?.toUpperCase() || 'PRO'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Administrative Modules Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">الأقسام والوحدات الإدارية</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href={`/center/${tenant.slug}/reception`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-cyan-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-cyan-600 transition-colors">
              الاستقبال والحضور السريع
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              تسجيل حضور الطلاب بالباركود، التحقق المالي الفوري، ورصد درجات اختبار الحصة بالـ Enter.
            </p>
          </Link>

          <Link
            href={`/center/${tenant.slug}/sessions`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-blue-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-blue-600 transition-colors">
              الحصص والمجموعات الدراسية
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              جدول المواعيد والقاعات، نماذج التسعير، متابعة حضور المجموعات، ونظام الحسابات الموحد.
            </p>
          </Link>

          <Link
            href={`/center/${tenant.slug}/teachers`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-purple-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-purple-600 transition-colors">
              شؤون المعلمين والحسابات الموحدة
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              عقود المعلمين بنظامي السنتر والبرايفت، نسب الحصص، التسويات المالية، وصلاحيات بوابات المعلم.
            </p>
          </Link>

          <Link
            href={`/center/${tenant.slug}/finance`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-emerald-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-emerald-600 transition-colors">
              الخزينة والحسابات اليومية
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              سجل المقبوضات والمصروفات، ورديات الكاش، تسويات المعلمين، وتقارير الإيرادات.
            </p>
          </Link>

          <Link
            href={`/center/${tenant.slug}/exams`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-amber-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-amber-600 transition-colors">
              بنك الأسئلة والامتحانات بالـ AI
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              توليد الامتحانات الورقية A4، بنك الأسئلة، التصحيح الذكي، وإرسال الدرجات لأولياء الأمور.
            </p>
          </Link>

          <Link
            href={`/center/${tenant.slug}/branches-list`}
            className="card-elevated p-5 rounded-2xl border border-border hover:border-rose-500/50 bg-card transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform">←</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-3 group-hover:text-rose-600 transition-colors">
              إدارة الفروع والقاعات
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              هيكلة فروع السنتر، سعة القاعات الدراسية، توزيع المواعيد، وتعيين مدراء الفروع.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
