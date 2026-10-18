'use client';

import React from 'react';
import { Users, UserCheck, UserX, AlertTriangle, TrendingUp } from 'lucide-react';
import { SessionAttendanceStats } from '@/lib/dal/types';

interface LiveStatsRingProps {
  stats: SessionAttendanceStats | null;
  capacity?: number;
}

export function LiveStatsRing({ stats, capacity }: LiveStatsRingProps) {
  const totalEnrolled = stats?.totalEnrolled ?? 0;
  const presentCount = stats?.presentCount ?? 0;
  const lateCount = stats?.lateCount ?? 0;
  const totalAttended = presentCount + lateCount;
  const absentCount = stats?.absentCount ?? Math.max(0, totalEnrolled - totalAttended);
  const balanceAlertCount = stats?.studentsWithBalanceDueCount ?? 0;
  const percentage = stats?.attendanceRatePercentage ?? (totalEnrolled > 0 ? Math.round((totalAttended / totalEnrolled) * 100) : 0);

  // SVG ring circumference math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalEnrolled > 0 ? Math.min(1, totalAttended / totalEnrolled) : 0;
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <div className="card-elevated rounded-3xl p-6 border border-border/80 bg-card space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-cyan-500" />
          <span>إحصائيات الحضور اللحظية</span>
        </h3>
        {capacity && (
          <span className="text-xs text-muted-foreground font-mono">
            سعة القاعة: {capacity}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
        {/* Circular SVG Ring */}
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <defs>
              <linearGradient id="cyanEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00A3FF" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-muted/40"
            />

            {/* Progress Stroke */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="url(#cyanEmeraldGrad)"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black font-mono text-foreground">
              {percentage}%
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {totalAttended} من {totalEnrolled}
            </span>
          </div>
        </div>

        {/* Breakdown Metric Cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {/* Present */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-right space-y-1">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-bold">الحاضرون</span>
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-mono font-black text-foreground">
              {totalAttended}
            </div>
          </div>

          {/* Absent */}
          <div className="p-3 rounded-2xl bg-muted/60 border border-border text-right space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold">الغائبون</span>
              <UserX className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-mono font-black text-foreground">
              {absentCount}
            </div>
          </div>

          {/* Balance Alerts */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-right space-y-1">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-bold">مستحقات معلقة</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-mono font-black text-foreground">
              {balanceAlertCount}
            </div>
          </div>

          {/* Total Enrolled */}
          <div className="p-3 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-right space-y-1">
            <div className="flex items-center justify-between text-brand-cyan-600 dark:text-brand-cyan-400">
              <span className="text-[11px] font-bold">إجمالي المقيدين</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-mono font-black text-foreground">
              {totalEnrolled}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
