'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AccountantPortalPage() {
  const { tenant, currentRole, currentUser } = useTenant();

  // Simulated cash shift data
  const [shiftActive, setShiftActive] = useState(true);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="card-elevated p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-card via-card to-emerald-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">
              بوابة الخزينة والمحاسبة — {tenant.nameAr}
            </h1>
            <Badge variant="success" className="font-bold">
              المحاسب المعتمد
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            مرحباً بك، <strong className="text-foreground">{currentUser.fullName}</strong>. إدارة الخزينة الميدانية، تحصيلات الطلاب، وتسويات حسابات المعلمين الموحدة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/center/${tenant.slug}/finance`}>
            <Button size="sm" variant="primary" className="gap-1.5 text-xs font-bold shadow-soft-sm">
              <Wallet className="w-4 h-4" />
              <span>فتح سجل الخزينة الكامل</span>
            </Button>
          </Link>
          <Link href={`/center/${tenant.slug}/teachers`}>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تسويات المعلمين الموحدة</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">تحصيلات اليوم المباشرة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              14,250
            </span>
            <span className="text-[10px] text-muted-foreground">ج.م (نقدي وسحابي)</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">رصيد الخزينة الحالي (الوردية)</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              9,800
            </span>
            <span className="text-[10px] text-muted-foreground">ج.م في الدرج الميداني</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">مستحقات المعلمين المعلقة</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              4,450
            </span>
            <span className="text-[10px] text-muted-foreground">ج.م جاهزة للصرف</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">حالة الوردية الحالية</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <Badge variant={shiftActive ? 'success' : 'outline'} className="text-xs">
              {shiftActive ? 'وردية مفتوحة ومسجلة' : 'مغلقة'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">بدأت 09:00 ص</span>
          </div>
        </div>
      </div>

      {/* Accounting Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-elevated p-5 rounded-2xl border border-border bg-card space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
            <span>نظام حسابات المعلمين الموحد</span>
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            يستخدم نفس محرك الحسابات المالي المعتمد في الحصص والمجموعات. يدعم العقود الشهرية، نسبة السنتر، وقيمة الحضور الصافي دون أي تفاوت.
          </p>
          <div className="pt-2">
            <Link href={`/center/${tenant.slug}/teachers`}>
              <Button size="sm" variant="outline" className="w-full text-xs font-bold gap-2">
                <span>استعراض تسويات المعلمين الحالية</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>سجل المقبوضات وإغلاق الوردية</span>
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            تسجيل المصروفات النثرية، توريد النقدية للإدارة، وتوليد تقرير إغلاق الوردية اليومي للسنتر.
          </p>
          <div className="pt-2">
            <Link href={`/center/${tenant.slug}/finance`}>
              <Button size="sm" variant="outline" className="w-full text-xs font-bold gap-2">
                <span>الانتقال إلى سندات الصرف والقبض</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
