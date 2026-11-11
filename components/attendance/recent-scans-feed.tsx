'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  History,
  Zap,
  Camera,
  Edit3,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatCleanNumber,
  formatLessonScoreFraction,
  lessonGradeDocId,
  parseLessonScore,
  type LessonExamRecord,
  type LessonGradeRecord,
} from '@/lib/attendance/lesson-scores';
import type { GradeSaveState } from '@/lib/attendance/use-lesson-scores';
import { VerificationMethod, AttendanceStatus } from '@/lib/dal/types';

export interface RecentScanItem {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  scannedAt: string;
  verificationMethod: VerificationMethod;
  status: AttendanceStatus;
  balanceDue: number;
  avatarUrl?: string;
}

interface RecentScansFeedProps {
  scans: RecentScanItem[];
  sessionId?: string | null;
  activeExam?: LessonExamRecord | null;
  gradesByStudent?: Record<string, LessonGradeRecord>;
  saveStateByKey?: Record<string, GradeSaveState>;
  canEditScores?: boolean;
  onSaveInlineScore?: (params: {
    sessionId: string;
    examId: string;
    totalMarks: number;
    studentId: string;
    studentIdOrCode: string;
    rawScore: string;
    source: 'feed';
  }) => Promise<{ ok: true; grade: LessonGradeRecord } | { ok: false; errorAr: string }>;
}

export function RecentScansFeed({
  scans,
  sessionId,
  activeExam,
  gradesByStudent,
  saveStateByKey,
  canEditScores = false,
  onSaveInlineScore,
}: RecentScansFeedProps) {
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [draftsByKey, setDraftsByKey] = useState<Record<string, string>>({});
  const [validationErrorByKey, setValidationErrorByKey] = useState<Record<string, string | null>>({});
  const rowTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timers = rowTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Sort reverse-chronologically (newest at top)
  const sortedScans = [...scans].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
  );

  const getMethodBadge = (method: VerificationMethod) => {
    switch (method) {
      case 'barcode':
        return (
          <Badge variant="cyan" className="text-[10px] gap-1 font-normal">
            <Zap className="w-3 h-3" />
            <span>ليزر باركود</span>
          </Badge>
        );
      case 'qr':
        return (
          <Badge variant="cyan" className="text-[10px] gap-1 font-normal">
            <Camera className="w-3 h-3" />
            <span>كاميرا QR</span>
          </Badge>
        );
      case 'manual':
      default:
        return (
          <Badge variant="outline" className="text-[10px] gap-1 font-normal">
            <Edit3 className="w-3 h-3" />
            <span>يدوي</span>
          </Badge>
        );
    }
  };

  const commitInlineSave = async (ctx: {
    sessionId: string;
    examId: string;
    totalMarks: number;
    studentId: string;
    studentIdOrCode: string;
    rawScore: string;
  }) => {
    const key = lessonGradeDocId(ctx.examId, ctx.studentId);
    if (rowTimersRef.current[key]) {
      clearTimeout(rowTimersRef.current[key]);
      delete rowTimersRef.current[key];
    }

    if (!onSaveInlineScore || !ctx.rawScore.trim()) return;

    const parsed = parseLessonScore(ctx.rawScore, ctx.totalMarks);
    if (!parsed.ok) {
      setValidationErrorByKey((prev) => ({ ...prev, [key]: parsed.errorAr }));
      return;
    }

    setValidationErrorByKey((prev) => ({ ...prev, [key]: null }));
    const res = await onSaveInlineScore({
      ...ctx,
      source: 'feed',
    });

    if (res.ok) {
      setDraftsByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setOpenRowKey((prev) => (prev === key ? null : prev));
    }
  };

  return (
    <div className="card-elevated rounded-3xl p-5 border border-border/80 bg-card space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-brand-cyan-500" />
          <span>شريط عمليات الحضور اللحظي</span>
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {scans.length} عملية مسجلة
        </span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sortedScans.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            لم يتم تسجيل أي حضور حتى الآن في هذه الحصة.
          </div>
        ) : (
          sortedScans.map((scan) => {
            const hasBalance = scan.balanceDue > 0;
            const currentGradeRecord = activeExam ? gradesByStudent?.[scan.studentId] : undefined;
            const currentScore = currentGradeRecord?.score;
            const rowKey = activeExam ? lessonGradeDocId(activeExam.id, scan.studentId) : null;
            const saveState = rowKey ? saveStateByKey?.[rowKey] : undefined;
            const isEditing = Boolean(rowKey && (openRowKey === rowKey || saveState?.status === 'error'));
            const validationErr = rowKey ? validationErrorByKey[rowKey] : null;
            const draftValue =
              rowKey && Object.prototype.hasOwnProperty.call(draftsByKey, rowKey)
                ? draftsByKey[rowKey]
                : saveState?.status === 'error' && saveState.draftValue !== undefined
                  ? saveState.draftValue
                  : currentScore !== undefined
                    ? formatCleanNumber(currentScore)
                    : '';

            return (
              <div
                key={scan.id}
                data-grade-entry-scope={isEditing ? 'true' : undefined}
                className="p-3 rounded-2xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                      {scan.avatarUrl ? (
                        <Image
                          src={scan.avatarUrl}
                          alt={scan.studentName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {scan.studentName.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {scan.studentName}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-muted-foreground">
                          ({scan.studentCode})
                        </span>
                        {activeExam && (
                          <Badge
                            variant={currentScore !== undefined ? 'cyan' : 'outline'}
                            dir="ltr"
                            className="text-[10px] font-mono font-bold"
                          >
                            {formatLessonScoreFraction(currentScore, activeExam.totalMarks)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {getMethodBadge(scan.verificationMethod)}
                        {hasBalance && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>متبقي {scan.balanceDue.toFixed(2)} ج.م</span>
                          </span>
                        )}
                        {saveState?.status === 'saving' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-cyan-600 dark:text-brand-cyan-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>جارٍ الحفظ</span>
                          </span>
                        )}
                        {saveState?.status === 'saved' && !isEditing && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم الحفظ</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEditScores && activeExam && sessionId && onSaveInlineScore && rowKey && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenRowKey((prev) => (prev === rowKey ? null : rowKey));
                          setDraftsByKey((prev) => ({
                            ...prev,
                            [rowKey]:
                              currentScore !== undefined ? formatCleanNumber(currentScore) : '',
                          }));
                          setValidationErrorByKey((prev) => ({ ...prev, [rowKey]: null }));
                          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                            window.requestAnimationFrame(() => {
                              activeInputRef.current?.focus();
                              activeInputRef.current?.select();
                            });
                          }
                        }}
                        className="h-7 px-2 text-[10px] font-bold"
                      >
                        تعديل الدرجة
                      </Button>
                    )}

                    <div className="text-left font-mono text-[11px] text-muted-foreground font-medium">
                      {new Date(scan.scannedAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

                {/* Inline Grade Editor inside Student Row */}
                {isEditing && activeExam && sessionId && rowKey && (
                  <div className="pt-2 border-t border-border/50 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center flex-1 h-8 rounded-xl border border-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-brand-cyan-500"
                        dir="ltr"
                      >
                        <input
                          ref={activeInputRef}
                          type="text"
                          inputMode="decimal"
                          aria-label={`درجة ${scan.studentName}`}
                          value={draftValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            const capturedCtx = {
                              sessionId,
                              examId: activeExam.id,
                              totalMarks: activeExam.totalMarks,
                              studentId: scan.studentId,
                              studentIdOrCode: scan.studentCode || scan.studentId,
                              rawScore: val,
                            };
                            const capturedKey = lessonGradeDocId(
                              capturedCtx.examId,
                              capturedCtx.studentId
                            );
                            setDraftsByKey((prev) => ({ ...prev, [capturedKey]: val }));
                            if (rowTimersRef.current[capturedKey]) {
                              clearTimeout(rowTimersRef.current[capturedKey]);
                              delete rowTimersRef.current[capturedKey];
                            }
                            if (!val.trim()) {
                              setValidationErrorByKey((prev) => ({ ...prev, [capturedKey]: null }));
                              return;
                            }
                            const parsed = parseLessonScore(val, capturedCtx.totalMarks);
                            if (!parsed.ok) {
                              setValidationErrorByKey((prev) => ({
                                ...prev,
                                [capturedKey]: parsed.errorAr,
                              }));
                              return;
                            }
                            setValidationErrorByKey((prev) => ({ ...prev, [capturedKey]: null }));
                            rowTimersRef.current[capturedKey] = setTimeout(() => {
                              void commitInlineSave(capturedCtx);
                            }, 450);
                          }}
                          onBlur={() => {
                            if (!draftValue.trim()) return;
                            const hasPending = Boolean(rowTimersRef.current[rowKey]);
                            const differsFromSaved =
                              currentScore === undefined ||
                              formatCleanNumber(currentScore) !== draftValue.trim();
                            if (hasPending || differsFromSaved) {
                              void commitInlineSave({
                                sessionId,
                                examId: activeExam.id,
                                totalMarks: activeExam.totalMarks,
                                studentId: scan.studentId,
                                studentIdOrCode: scan.studentCode || scan.studentId,
                                rawScore: draftValue,
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void commitInlineSave({
                                sessionId,
                                examId: activeExam.id,
                                totalMarks: activeExam.totalMarks,
                                studentId: scan.studentId,
                                studentIdOrCode: scan.studentCode || scan.studentId,
                                rawScore: draftValue,
                              });
                            } else if (e.key === 'Escape') {
                              setOpenRowKey(null);
                            }
                          }}
                          className="w-full bg-transparent text-xs font-mono font-black text-foreground text-center focus:outline-none"
                        />
                        <span className="text-[11px] font-mono font-bold text-muted-foreground shrink-0 pl-2 border-l border-border">
                          / {formatCleanNumber(activeExam.totalMarks)}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenRowKey(null)}
                        className="h-8 px-2 text-[11px]"
                      >
                        إغلاق
                      </Button>
                    </div>

                    {validationErr && (
                      <p role="alert" className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        {validationErr}
                      </p>
                    )}

                    {saveState?.status === 'error' && (
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span role="alert" className="text-rose-600 dark:text-rose-400 font-bold">
                          {saveState.message}
                        </span>
                        {saveState.lastAttempt && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const attempt = saveState.lastAttempt!;
                              void commitInlineSave({
                                sessionId: attempt.sessionId,
                                examId: attempt.examId,
                                totalMarks: activeExam.totalMarks,
                                studentId: attempt.studentId,
                                studentIdOrCode: attempt.studentIdOrCode,
                                rawScore: attempt.rawScore,
                              });
                            }}
                            className="h-6 px-2 text-[10px] border-rose-500/40 text-rose-600 dark:text-rose-400"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>إعادة المحاولة</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
