'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Tier {
  id: 'starter' | 'pro' | 'enterprise';
  nameAr: string;
  monthlyFee: number;
  studentsLimit: number | 'unlimited';
  branchesLimit: number | 'unlimited';
  activeCentersCount: number;
  features: string[];
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'starter',
    nameAr: 'باقة البداية (Starter)',
    monthlyFee: 1500,
    studentsLimit: 200,
    branchesLimit: 1,
    activeCentersCount: 1,
    features: [
      'حتى 200 طالب مقيد',
      'فرع واحد وقاعة رئيسية',
      'الحضور السريع بالباركود',
      'تقارير مالية وخزينة أساسية',
      'دعم عبر البريد الإلكتروني',
    ],
  },
  {
    id: 'pro',
    nameAr: 'باقة المحترفين (Pro)',
    monthlyFee: 3500,
    studentsLimit: 1000,
    branchesLimit: 3,
    activeCentersCount: 2,
    popular: true,
    features: [
      'حتى 1,000 طالب مقيد',
      'حتى 3 فروع وقاعات متعددة',
      'تكامل إشعارات واتساب السحابي',
      'امتحانات الذكاء الاصطناعي وبنك الأسئلة',
      'نظام حسابات المعلمين المزدوج (سنتر + برايفت)',
      'تصدير Excel وطباعة امتحانات A4',
    ],
  },
  {
    id: 'enterprise',
    nameAr: 'باقة المؤسسات (Enterprise)',
    monthlyFee: 7500,
    studentsLimit: 'unlimited',
    branchesLimit: 'unlimited',
    activeCentersCount: 1,
    features: [
      'عدد غير محدود من الطلاب',
      'فروع وقاعات غير محدودة',
      'استضافة سحابية خاصة ونطاق مخصص',
      'أولوية معالجة رسائل الواتساب',
      'مدير حساب خاص ودعم على مدار الساعة',
      'نسخ احتياطي فوري متكرر',
    ],
  },
];

export default function OwnerSubscriptionsPage() {
  const [tiers] = useState(TIERS);

  // Compute total MRR
  const totalMRR = tiers.reduce(
    (acc, tier) => acc + tier.monthlyFee * tier.activeCentersCount,
    0
  );
  const totalSubscribedCenters = tiers.reduce(
    (acc, tier) => acc + tier.activeCentersCount,
    0
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-500" />
            <span>باقات واشتراكات السحابة (SaaS Plans)</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إدارة خطط الأسعار، تسعير المراكز التعليمية، ومتابعة العائد الشهري المتكرر (MRR).
          </p>
        </div>

        <Link
          href="/owner/centers"
          className="text-xs font-bold text-brand-cyan-600 dark:text-brand-cyan-400 hover:underline flex items-center gap-1.5"
        >
          <span>تخصيص باقات السناتر</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              العائد الشهري المتكرر (MRR)
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {totalMRR.toLocaleString('ar-EG')} ج.م
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              مجموع اشتراكات {totalSubscribedCenters} مراكز نشطة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              أعلى باقة انتشاراً
            </CardTitle>
            <Sparkles className="w-4 h-4 text-brand-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">باقة المحترفين (Pro)</div>
            <p className="text-[11px] text-brand-cyan-600 dark:text-brand-cyan-400 font-medium mt-1">
              تمثل 50% من إجمالي المراكز
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              نسبة التحصيل والالتزام
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">100%</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              لا توجد اشتراكات متأخرة السداد
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`card-elevated rounded-2xl border p-6 flex flex-col justify-between relative ${
              tier.popular
                ? 'border-brand-cyan-500 shadow-soft-lg ring-1 ring-brand-cyan-500/20'
                : 'border-border'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-brand-cyan-600 text-white font-bold text-[10px] shadow-soft-sm">
                الأكثر طلبًا
              </span>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-black text-foreground">{tier.nameAr}</h2>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {tier.activeCentersCount} سنتر مشترك
                </Badge>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-black font-mono text-foreground">
                  {tier.monthlyFee.toLocaleString('ar-EG')}
                </span>
                <span className="text-xs text-muted-foreground mr-1">ج.م / شهرياً</span>
              </div>

              <div className="space-y-2 py-4 border-t border-b border-border/60 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">حد الطلاب:</span>
                  <strong className="text-foreground">
                    {tier.studentsLimit === 'unlimited' ? 'غير محدود' : `${tier.studentsLimit} طالب`}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">حد الفروع:</span>
                  <strong className="text-foreground">
                    {tier.branchesLimit === 'unlimited' ? 'غير محدود' : `${tier.branchesLimit} فروع`}
                  </strong>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <p className="text-[11px] font-bold text-muted-foreground">الميزات المشمولة:</p>
                {tier.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/owner/centers"
                className="w-full py-2 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>عرض السناتر في هذه الباقة</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
