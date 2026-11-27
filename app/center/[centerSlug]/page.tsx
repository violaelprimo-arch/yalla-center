'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarCheck,
  Wallet,
  FileSpreadsheet,
  Building2,
  Clock,
  ArrowUpRight,
  QrCode,
  ShieldAlert,
  UserCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { InteractiveBarChart, InteractiveDonutChart } from '@/components/ui/interactive-chart';
import { SkeletonKpiGrid } from '@/components/ui/skeleton';
import { EducationalSubjectBadge } from '@/components/motion/educational-graphics';
import { cairoClock, receptionSessionState } from '@/lib/attendance/reception';
import { getDataProvider } from '@/lib/dal/factory';
import type { Session, Payment, Exam, User } from '@/lib/dal/types';
import { clockLabel, GROUP_PRICING_LABELS } from '@/lib/timetable/group-schedule';

export default function CenterDashboardPage() {
  const { tenant, branches, currentRole, currentUser, groupData, masterData } = useTenant();
  const { groups, classrooms, ready } = groupData;
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [todayAttendanceStats, setTodayAttendanceStats] = useState({ present: 0, enrolled: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const clock = cairoClock();
  const today = clock.slice(0, 10);
  const ownGroups = groups.filter(group => group.teacherId === currentUser.id && group.isActive);
  const scheduledToday = todaySessions.filter(session => groups.some(group => group.id === session.groupId && group.isActive));
  const ownModels = [...new Set(ownGroups.map(group => GROUP_PRICING_LABELS[group.pricingModel]))];

  useEffect(() => {
    if (!ready) return;
    const token = masterData.auth.idToken;
    if (process.env.NODE_ENV !== 'test' && !token) {
      setMetricsLoading(false);
      return;
    }
    let active = true;
    setMetricsLoading(true);
    const dal = getDataProvider(token || undefined);

    Promise.all([
      dal.getSessions(tenant.id, { date: today }).catch(() => [] as Session[]),
      dal.getUsers(tenant.id, { role: 'STUDENT' }).catch(() => [] as User[]),
      dal.getPayments(tenant.id).catch(() => [] as Payment[]),
      dal.getExams(tenant.id).catch(() => [] as Exam[]),
    ]).then(async ([sessionsList, studentsList, paymentsList, examsList]) => {
      if (!active) return;
      const sortedSessions = [...sessionsList].sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodaySessions(sortedSessions);
      setStudents(studentsList);
      setPayments(paymentsList);
      setExams(examsList);

      // Compute real attendance counts from today's sessions
      const sessionSubset = sortedSessions.slice(0, 12);
      if (sessionSubset.length > 0) {
        const statsResults = await Promise.all(
          sessionSubset.map((s) =>
            dal.getSessionAttendanceStats(tenant.id, s.id).catch(() => null)
          )
        );
        if (!active) return;
        let present = 0;
        let enrolled = 0;
        for (const stat of statsResults) {
          if (stat) {
            present += stat.presentCount + (stat.lateCount || 0);
            enrolled += stat.totalEnrolled;
          }
        }
        setTodayAttendanceStats({ present, enrolled });
      } else {
        setTodayAttendanceStats({ present: 0, enrolled: 0 });
      }
      setMetricsLoading(false);
    }).catch(() => {
      if (active) setMetricsLoading(false);
    });
    return () => { active = false; };
  }, [ready, groups, tenant.id, today, masterData.auth.idToken]);

  const activeStudentsCount = students.filter((s) => s.isActive !== false).length;
  const attendancePct = todayAttendanceStats.enrolled > 0
    ? Number(((todayAttendanceStats.present / todayAttendanceStats.enrolled) * 100).toFixed(1))
    : 0;
  const todayRevenue = payments
    .filter((p) => (p.paidAt || '').slice(0, 10) === today)
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  const activeGroupsList = groups.filter((g) => g.isActive !== false);
  const pricingBreakdownData = Object.entries(GROUP_PRICING_LABELS).map(([modelKey, label]) => ({
    id: modelKey,
    label,
    value: activeGroupsList.filter((g) => g.pricingModel === modelKey).length,
  })).filter((d) => d.value > 0);

  const branchGroupsChartData = branches.map((b) => ({
    id: b.id,
    label: b.nameAr.slice(0, 14),
    value: activeGroupsList.filter((g) => g.branchId === b.id).length,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Banner & Quick Action HUD */}
      <div className="card-elevated p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">
              لوحة القيادة — {tenant.nameAr}
            </h1>
            <Badge variant="cyan">
              {currentRole === 'STUDENT'
                ? 'طالب'
                : currentRole === 'TEACHER'
                ? 'معلم'
                : currentRole === 'PLATFORM_OWNER'
                ? 'مالك المنصة'
                : 'إدارة'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            مرحباً بك، <strong className="text-foreground">{currentUser.fullName}</strong>.
            متابعة فورية للعمليات اليومية، الحصص الميدانية، والحضور السريع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['CENTER_ADMIN', 'PLATFORM_OWNER'].includes(currentRole) && (
            <Link href={`/center/${tenant.slug}/admin`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-brand-cyan-500/40">
                <ShieldCheck className="w-4 h-4 text-brand-cyan-600" />
                <span>لوحة الإدارة</span>
              </Button>
            </Link>
          )}
          {['CENTER_ADMIN', 'PLATFORM_OWNER'].includes(currentRole) && (
            <Link href={`/center/${tenant.slug}/subscription`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-purple-500/40">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>الاشتراك السحابي</span>
              </Button>
            </Link>
          )}
          <Link href={`/center/${tenant.slug}/reception`}>
            <Button size="sm" variant="primary" className="gap-1.5 shadow-soft-sm">
              <QrCode className="w-4 h-4" />
              <span>تسجيل حضور سريع</span>
            </Button>
          </Link>
          <Link href={`/center/${tenant.slug}/branches-list`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Building2 className="w-4 h-4 text-brand-cyan-600" />
              <span>قائمة الفروع</span>
            </Button>
          </Link>
          <Link href={`/center/${tenant.slug}/profile`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <UserCheck className="w-4 h-4 text-brand-cyan-600" />
              <span>الملف الشخصي</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Role-Specific Alert Cards */}
      {currentRole === 'STUDENT' && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-lg">
              🎓
            </div>
            <div>
              <span className="text-xs text-indigo-400 font-semibold block">بيانات الطالب المقيد:</span>
              <p className="text-sm font-bold text-foreground">
                الكود: <span className="font-mono text-brand-cyan-600">{currentUser.studentCode || 'STD-1001'}</span> | الرصيد المالي: <span className="text-emerald-500 font-bold">{currentUser.balanceDue.toFixed(2)} ج.م</span>
              </p>
            </div>
          </div>
          <Link href={`/center/${tenant.slug}/profile`}>
            <Button size="sm" variant="outline" className="text-xs">
              تحديث الصورة الشخصية
            </Button>
          </Link>
        </div>
      )}

      {currentRole === 'TEACHER' && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-500 flex items-center justify-center font-bold text-lg">
              👨‍🏫
            </div>
            <div>
              <span className="text-xs text-teal-400 font-semibold block">بوابة المعلم المعتمد:</span>
              <p className="text-sm font-bold text-foreground">
                {ownGroups.length} مجموعة نشطة{ownModels.length ? ` · ${ownModels.join("، ")}` : ""}
              </p>
            </div>
          </div>
          <Link href={`/center/${tenant.slug}/sessions`}>
            <Button size="sm" variant="outline" className="text-xs">
              عرض حصص اليوم
            </Button>
          </Link>
        </div>
      )}

      {/* 4 Primary Real-Data Operational Metric Cards with Motion */}
      {metricsLoading ? (
        <SkeletonKpiGrid count={4} />
      ) : (
        <StaggeredCardGrid columns={4}>
          <AnimatedMetric
            label="الطلاب المقيدون"
            value={activeStudentsCount}
            suffix=" طالب"
            color="cyan"
            icon={<Users className="w-4 h-4" />}
            trend={{
              value: 0,
              periodText: `إجمالي المسجلين: ${students.length} · ${activeGroupsList.length} مجموعة نشطة`,
            }}
          />
          <AnimatedMetric
            label="نسبة الحضور اليوم"
            value={attendancePct}
            decimals={1}
            suffix="%"
            color="emerald"
            icon={<CalendarCheck className="w-4 h-4" />}
            trend={{
              value: 0,
              periodText:
                todayAttendanceStats.enrolled > 0
                  ? `${todayAttendanceStats.present} حاضر من أصل ${todayAttendanceStats.enrolled} مقيد في حصص اليوم`
                  : `${scheduledToday.length} حصص مجدولة اليوم`,
            }}
          />
          <AnimatedMetric
            label="متحصلات الخزينة اليوم"
            value={todayRevenue}
            prefix="ج.م "
            color="amber"
            icon={<Wallet className="w-4 h-4" />}
            trend={{
              value: 0,
              periodText: `${payments.filter((p) => (p.paidAt || '').slice(0, 10) === today).length} إيصال محصل اليوم`,
            }}
          />
          <AnimatedMetric
            label="الامتحانات الذكية"
            value={exams.length}
            suffix=" امتحان"
            color="purple"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            trend={{
              value: 0,
              periodText: `${exams.filter((e) => e.status === 'published').length} منشور للطلاب`,
            }}
          />
        </StaggeredCardGrid>
      )}

      {/* Real Operational Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <InteractiveBarChart
            title="توزيع المجموعات النشطة على الفروع"
            subtitle="عدد المجموعات الدراسية المفعّلة في كل فرع"
            height={210}
            valueFormatter={(v) => `${v} مجموعة`}
            emptyLabel="لا توجد مجموعات مسجلة في الفروع بعد"
            data={branchGroupsChartData}
          />
        </div>
        <div className="lg:col-span-5">
          <InteractiveDonutChart
            title="توزيع أنظمة محاسبة المجموعات"
            subtitle="تصنيف المجموعات حسب نظام التسعير والمحاسبة"
            height={200}
            centerLabel="مجموعة نشطة"
            centerValue={activeGroupsList.length}
            emptyLabel="أضف مجموعات لعرض توزيع أنظمة المحاسبة"
            data={pricingBreakdownData}
          />
        </div>
      </div>

      {/* Main Grid: Today's Sessions & Branches Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right 2 Columns: Today's Field Sessions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-cyan-600" />
              <span>جدول الحصص الميدانية المقررة اليوم</span>
            </h2>
            <Link
              href={`/center/${tenant.slug}/sessions#weekly`}
              className="text-xs font-bold text-brand-cyan-600 dark:text-brand-cyan-400 hover:underline flex items-center gap-1"
            >
              عرض الجدول الأسبوعي
              <RTLIcon icon={ArrowUpRight} className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {scheduledToday.length ? scheduledToday.map(session => {
              const group = groups.find(item => item.id === session.groupId);
              const room = classrooms.find(item => item.id === session.classroomId);
              const branch = branches.find(item => item.id === (session.branchId ?? group?.branchId));
              const state = receptionSessionState(session, clock);
              return <div key={session.id} className="card-elevated flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div>
                  <h3 className="text-sm font-bold">{group?.nameAr ?? 'حصة دراسية'}</h3>
                  <p className="text-xs text-muted-foreground">{[group?.teacherName, room?.nameAr, branch?.nameAr].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <time dir="ltr">{clockLabel(session.startTime)} – {clockLabel(session.endTime)}</time>
                  {state && <Badge variant={state === 'current' ? 'cyan' : 'outline'}>{state === 'current' ? 'جارية' : 'قادمة'}</Badge>}
                </div>
              </div>;
            }) : <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">مفيش حصص مجدولة النهارده.</p>}
          </div>
        </div>

        {/* Left Column: Branches Summary */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-cyan-600" />
            <span>الفروع والقاعات التابعة</span>
          </h2>

          <div className="space-y-3">
            {branches.map((b) => (
              <div
                key={b.id}
                className="card-elevated p-4 rounded-xl border border-border space-y-2 hover:border-brand-cyan-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">{b.nameAr}</h3>
                  <Badge variant="success">نشط</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{b.address || 'القاهرة'}</p>
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>هاتف: <span className="font-mono">{b.phone || '01001234567'}</span></span>
                  <Link
                    href={`/center/${tenant.slug}/branches-list#${b.id}`}
                    className="text-brand-cyan-600 dark:text-brand-cyan-400 font-bold hover:underline"
                  >
                    إدارة القاعات ←
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
