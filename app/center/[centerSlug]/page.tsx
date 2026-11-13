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
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { cairoClock, receptionSessionState } from '@/lib/attendance/reception';
import { getDataProvider } from '@/lib/dal/factory';
import type { Session } from '@/lib/dal/types';
import { clockLabel, GROUP_PRICING_LABELS } from '@/lib/timetable/group-schedule';

export default function CenterDashboardPage() {
  const { tenant, branches, currentRole, currentUser, groupData } = useTenant();
  const { groups, classrooms, ready } = groupData;
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const clock = cairoClock();
  const today = clock.slice(0, 10);
  const ownGroups = groups.filter(group => group.teacherId === currentUser.id && group.isActive);
  const ownModels = [...new Set(ownGroups.map(group => GROUP_PRICING_LABELS[group.pricingModel]))];

  useEffect(() => {
    if (!ready) return;
    let active = true;
    getDataProvider().getSessions(tenant.id, { date: today }).then(sessions => {
      if (active) setTodaySessions(sessions.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    });
    return () => { active = false; };
  }, [ready, groups, tenant.id, today]);

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
          <Link href={`/center/${tenant.slug}/reception`}>
            <Button size="sm" variant="primary" className="gap-1.5 shadow-soft-sm">
              <QrCode className="w-4 h-4" />
              <span>تسجيل حضور سريع</span>
            </Button>
          </Link>
          <Link href={`/center/${tenant.slug}/branches`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Building2 className="w-4 h-4 text-brand-cyan-600" />
              <span>الفروع والقاعات</span>
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

      {/* 4 Primary Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-brand-cyan-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              الطلاب المقيدون
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-brand-cyan-500/10 text-brand-cyan-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">850</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <span>+12.4% مقارنة بالشهر السابق</span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              نسبة الحضور اليوم
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">88.7%</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              142 طالب حاضر من أصل 160 متوقعاً
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-amber-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              متحصلات الخزينة اليوم
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">11,360 ج.م</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              تم إغلاق مناوبة الصباح بنجاح
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              الامتحانات الذكية
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">24</div>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-1">
              مؤصلة بذكاء اصطناعي وتصدير A4
            </p>
          </CardContent>
        </Card>
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
            {todaySessions.length ? todaySessions.map(session => {
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
                    href={`/center/${tenant.slug}/branches`}
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
