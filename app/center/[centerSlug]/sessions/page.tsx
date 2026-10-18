'use client';

import React from 'react';
import { CalendarClock } from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';

export default function SessionsGroupsPage() {
  const { tenant } = useTenant();

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-brand-cyan-600" />
            <span>الحصص والمجموعات الميدانية</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            سجل الجلسات الدراسية المؤرخة، متابعة الحضور الميداني، وتبويب الاختبارات أثناء الحصة.
          </p>
        </div>
        <Badge variant="cyan">Milestone 4</Badge>
      </div>

      <div className="card-elevated p-8 rounded-2xl border border-border text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto text-xl">
          📅
        </div>
        <h2 className="text-lg font-bold text-foreground">جدول الحصص الميدانية والاختبارات الفورية</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          إدارة جلسات التدريس اليومية وتوليد الاختبارات السريعة أثناء الحصة وتتبع نسب الإنجاز.
        </p>
      </div>
    </div>
  );
}
