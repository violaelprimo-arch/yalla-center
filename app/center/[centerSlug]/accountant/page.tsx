'use client';

import React, { useEffect, useState } from 'react';
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
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { InteractiveBarChart } from '@/components/ui/interactive-chart';
import { SkeletonKpiGrid } from '@/components/ui/skeleton';
import { getDataProvider } from '@/lib/dal/factory';
import { cairoClock } from '@/lib/attendance/reception';
import type { CashierShift, Expense, Payment, TeacherPayroll } from '@/lib/dal/types';

export default function AccountantPortalPage() {
  const { tenant, currentUser, masterData } = useTenant();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payrolls, setPayrolls] = useState<TeacherPayroll[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const today = cairoClock().slice(0, 10);

  useEffect(() => {
    const token = masterData.auth.idToken;
    if (process.env.NODE_ENV !== 'test' && !token) {
      setLoading(false);
      return;
    }
    let active = true;
    const dal = getDataProvider(token || undefined);
    Promise.all([
      dal.getPayments(tenant.id).catch(() => [] as Payment[]),
      dal.getExpenses(tenant.id).catch(() => [] as Expense[]),
      dal.getTeacherPayroll(tenant.id).catch(() => [] as TeacherPayroll[]),
      dal.getActiveCashierShift(tenant.id).catch(() => null),
    ]).then(([paymentsList, expensesList, payrollList, shift]) => {
      if (!active) return;
      setPayments(paymentsList);
      setExpenses(expensesList);
      setPayrolls(payrollList);
      setActiveShift(shift);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [tenant.id, masterData.auth.idToken]);

  const todayCollected = payments
    .filter((p) => (p.paidAt || '').slice(0, 10) === today)
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const shiftBalance = activeShift ? Number(activeShift.expectedCash || activeShift.openingCash || 0) : 0;
  const pendingPayroll = payrolls
    .filter((p) => p.status !== 'paid')
    .reduce((sum, p) => sum + (Number(p.netPayroll) || 0), 0);

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

      {/* Real Financial KPIs */}
      {loading ? (
        <SkeletonKpiGrid count={4} />
      ) : (
        <StaggeredCardGrid columns={4}>
          <AnimatedMetric
            label="تحصيلات اليوم المباشرة"
            value={todayCollected}
            suffix=" ج.م"
            color="emerald"
            icon={<DollarSign className="w-4 h-4" />}
            trend={{ value: 0, periodText: `${payments.filter((p) => (p.paidAt || '').slice(0, 10) === today).length} سند قبض اليوم` }}
          />
          <AnimatedMetric
            label="رصيد الخزينة (الوردية)"
            value={shiftBalance}
            suffix=" ج.م"
            color="cyan"
            icon={<Wallet className="w-4 h-4" />}
            trend={{ value: 0, periodText: activeShift ? 'وردية مفتوحة ومسجلة' : 'لا توجد وردية مفتوحة' }}
          />
          <AnimatedMetric
            label="مستحقات المعلمين المعلقة"
            value={pendingPayroll}
            suffix=" ج.م"
            color="purple"
            icon={<Users className="w-4 h-4" />}
            trend={{ value: 0, periodText: `${payrolls.filter((p) => p.status !== 'paid').length} كشف معلق للصرف` }}
          />
          <AnimatedMetric
            label="إجمالي المصروفات المسجلة"
            value={totalExpenses}
            suffix=" ج.م"
            color="amber"
            icon={<Clock className="w-4 h-4" />}
            trend={{ value: 0, periodText: `${expenses.length} بند مصروفات` }}
          />
        </StaggeredCardGrid>
      )}

      {/* Real Cashflow Chart */}
      <InteractiveBarChart
        title="ملخص التدفق النقدي المحصل مقابل المصروفات"
        subtitle="بيانات فعلية مباشرة من خزينة السنتر السحابية"
        height={210}
        valueFormatter={(v) => `${v.toLocaleString('ar-EG')} ج.م`}
        emptyLabel="لا توجد حركات مالية مسجلة حتى الآن"
        data={[
          { id: 'collected', label: 'تحصيلات اليوم', value: todayCollected, color: '#10B981' },
          { id: 'total-payments', label: 'إجمالي التحصيلات', value: payments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0), color: '#00A3FF' },
          { id: 'payroll', label: 'مستحقات معلقة', value: pendingPayroll, color: '#8B5CF6' },
          { id: 'expenses', label: 'المصروفات', value: totalExpenses, color: '#F59E0B' },
        ].filter((item) => item.value > 0)}
      />

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
