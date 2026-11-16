'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Calendar,
  Clock,
  QrCode,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cairoClock } from '@/lib/attendance/reception';
import { getDataProvider } from '@/lib/dal/factory';
import type { Session } from '@/lib/dal/types';

export default function BranchManagerPortalPage() {
  const { tenant, branches, currentRole, currentUser, groupData } = useTenant();
  const { groups, classrooms } = groupData;

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches[0]?.id || ''
  );
  const [sessions, setSessions] = useState<Session[]>([]);

  const clock = cairoClock();
  const today = clock.slice(0, 10);

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const branchClassrooms = classrooms.filter((c) => c.branchId === currentBranch?.id);
  const branchGroups = groups.filter((g) => g.branchId === currentBranch?.id && g.isActive);

  useEffect(() => {
    let active = true;
    getDataProvider()
      .getSessions(tenant.id, { date: today })
      .then((res) => {
        if (active) setSessions(res);
      });
    return () => {
      active = false;
    };
  }, [tenant.id, today]);

  const branchSessionsToday = sessions.filter(
    (s) => s.branchId === currentBranch?.id || branchGroups.some((g) => g.id === s.groupId)
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Branch Header Banner */}
      <div className="card-elevated p-6 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">
              بوابة إدارة الفرع — {currentBranch?.nameAr || 'الفرع الرئيسي'}
            </h1>
            <Badge variant="cyan" className="font-bold">
              مدير فرع
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5 text-brand-cyan-600" />
            <span>{currentBranch?.address || 'العنوان الرئيسي للفرع'}</span>
            <span>•</span>
            <span>مرحباً، {currentUser.fullName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {branches.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">تبديل الفرع:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-9 px-3 text-xs font-bold rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link href={`/center/${tenant.slug}/reception`}>
            <Button size="sm" variant="primary" className="gap-1.5 text-xs font-bold shadow-soft-sm">
              <QrCode className="w-4 h-4" />
              <span>استقبال الفرع</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Branch Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">حصص اليوم في الفرع</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {branchSessionsToday.length}
            </span>
            <span className="text-[10px] text-muted-foreground">حصة مجدولة</span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">القاعات التشغيلية</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {branchClassrooms.length}
            </span>
            <span className="text-[10px] text-muted-foreground">
              إجمالي السعة: {branchClassrooms.reduce((acc, c) => acc + (c.capacity || 0), 0)} مقعد
            </span>
          </div>
        </div>

        <div className="card-elevated p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">المجموعات المقيدة بالفرع</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">
              {branchGroups.length}
            </span>
            <span className="text-[10px] text-muted-foreground">مجموعة نشطة</span>
          </div>
        </div>
      </div>

      {/* Today's Branch Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600" />
            <span>حصص اليوم في {currentBranch?.nameAr}</span>
          </h2>
          <span className="text-xs font-mono text-muted-foreground">{today}</span>
        </div>

        {branchSessionsToday.length === 0 ? (
          <div className="card-elevated p-8 rounded-2xl border border-border text-center text-xs text-muted-foreground bg-card">
            لا توجد حصص مجدولة اليوم في هذا الفرع.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchSessionsToday.map((s) => {
              const grp = groups.find((g) => g.id === s.groupId);
              const room = classrooms.find((c) => c.id === s.classroomId);
              return (
                <div key={s.id} className="card-elevated p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{grp?.nameAr || 'حصة دراسية'}</span>
                    <Badge variant="cyan" className="font-mono text-[10px]">
                      {s.startTime} - {s.endTime}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{grp?.teacherName || 'المعلم المعتمد'}</p>
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>القاعة: {room?.nameAr || 'قاعة عامة'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">مجدولة</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
