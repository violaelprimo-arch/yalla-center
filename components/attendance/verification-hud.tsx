'use client';

import React from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  QrCode,
  CreditCard,
  Clock,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Session, Group } from '@/lib/dal/types';

export type HudState = 'idle' | 'success' | 'warning' | 'error';

export interface HudScanData {
  state: HudState;
  student?: User;
  session?: Session;
  group?: Group;
  scannedCode?: string;
  isNewRecord?: boolean;
  duplicate?: boolean;
  recordedAt?: string;
  messageAr?: string;
  balanceAlert?: {
    hasBalance: boolean;
    balanceDue: number;
    messageAr: string;
  };
  errorReason?: string;
}

interface VerificationHudProps {
  data: HudScanData;
  onQuickPayClick?: (student: User) => void;
  onManualSearchFallback?: () => void;
}

export function VerificationHud({
  data,
  onQuickPayClick,
  onManualSearchFallback,
}: VerificationHudProps) {
  const {
    state,
    student,
    group,
    duplicate,
    recordedAt,
    messageAr,
    balanceAlert,
  } = data;

  // 1. Idle State
  if (state === 'idle' || (!student && state !== 'error')) {
    return (
      <div className="card-elevated rounded-3xl p-8 border border-border/80 text-center space-y-4 bg-gradient-to-b from-card to-card/60 shadow-soft-sm">
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-brand-cyan-500/10 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-brand-cyan-500/15 border border-brand-cyan-500/30 text-brand-cyan-500 flex items-center justify-center text-2xl shadow-inner">
            <QrCode className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-foreground">منصة الاستقبال والحضور الفوري</h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            مرر كود الطالب أو الباركود عبر القارئ، أو استخدم كاميرا الجهاز لتسجيل الحضور وتأكيد البيانات في أقل من 300 مللي ثانية.
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (state === 'error') {
    return (
      <div className="card-elevated rounded-3xl p-6 sm:p-8 border-2 border-rose-500/60 bg-rose-500/10 text-right space-y-4 shadow-lg animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="destructive" className="mb-1 text-xs font-bold">
              خطأ في التسجيل
            </Badge>
            <h2 className="text-xl sm:text-2xl font-black text-rose-500 truncate">
              {messageAr || 'تعذر تسجيل حضور الطالب'}
            </h2>
            {data.scannedCode && (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                الكود الممسوح: <span className="font-bold text-foreground">{data.scannedCode}</span>
              </p>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-background/80 border border-rose-500/20 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span>يرجى التحقق من كود الطالب أو قيده في المجموعة المحددة.</span>
          {onManualSearchFallback && (
            <Button
              size="sm"
              variant="outline"
              onClick={onManualSearchFallback}
              className="h-8 text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              بحث يدوي بالاسم
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 3. Success / Warning Card
  const isWarning = state === 'warning' || (balanceAlert && balanceAlert.hasBalance);

  return (
    <div
      className={`card-elevated rounded-3xl p-6 sm:p-8 border-2 transition-all duration-300 shadow-xl animate-in zoom-in-95 duration-200 ${
        isWarning
          ? 'border-amber-500/70 bg-gradient-to-b from-amber-500/10 via-card to-card'
          : 'border-emerald-500/70 bg-gradient-to-b from-emerald-500/10 via-card to-card'
      }`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Student Profile Info */}
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-border shadow-md shrink-0 bg-muted flex items-center justify-center">
            {student?.avatarUrl ? (
              <Image
                src={student.avatarUrl}
                alt={student.fullName}
                fill
                className="object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-muted-foreground">
                {student?.fullName.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isWarning ? 'warning' : 'success'}
                className="text-xs font-bold px-2.5 py-0.5 flex items-center gap-1"
              >
                {isWarning ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>{duplicate ? 'حضور مسجل مسبقاً' : 'حضور مؤكد ✓'}</span>
              </Badge>

              <Badge variant="outline" className="font-mono text-xs font-bold">
                {student?.studentCode || student?.id}
              </Badge>

              {student?.seatNumber && (
                <Badge variant="cyan" className="text-xs font-medium">
                  مقعد رقم: {student.seatNumber}
                </Badge>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              {student?.fullName}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {group && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-cyan-500" />
                  <span>{group.nameAr}</span>
                </span>
              )}
              {recordedAt && (
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-brand-cyan-500" />
                  <span>{new Date(recordedAt).toLocaleTimeString('ar-EG')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Idempotency & Instant Status Notification */}
        <div className="text-right shrink-0">
          <div className="inline-flex flex-col items-start md:items-end">
            <span className="text-[11px] text-muted-foreground font-medium">
              {duplicate
                ? 'تم منع تكرار التسجيل لنفس الحصة'
                : 'تم إرسال إشعار ولي الأمر (واتساب)'}
            </span>
            <span className="text-xs font-bold text-foreground mt-0.5">
              {duplicate ? 'Idempotent Verified' : 'Real-time Async Dispatched'}
            </span>
          </div>
        </div>
      </div>

      {/* Warning Alert Banner (FEAT-24: Overdue balance banner & quick shortcut) */}
      {isWarning && balanceAlert && balanceAlert.hasBalance && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                تنبيه المستحقات المالية
              </span>
              <p className="text-sm font-black text-foreground">
                مطلوب سداد:{' '}
                <span className="text-amber-600 dark:text-amber-400 font-mono text-base">
                  {balanceAlert.balanceDue.toFixed(2)} ج.م
                </span>
              </p>
            </div>
          </div>

          {onQuickPayClick && student && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onQuickPayClick(student)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shrink-0 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              <span>تحصيل فوري الآن</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
