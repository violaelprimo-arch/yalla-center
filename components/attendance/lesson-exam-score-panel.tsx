'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Barcode,
  CheckCircle2,
  Cloud,
  CloudOff,
  Edit3,
  History,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatCleanNumber,
  formatLessonScoreFraction,
  lessonGradeDocId,
  parseLessonScore,
  type LessonExamRecord,
  type LessonGradeAuditEntry,
  type LessonGradeRecord,
  type LocalStorageGradeCandidate,
} from '@/lib/attendance/lesson-scores';
import type { GradeSaveState, LocalImportReviewRow } from '@/lib/attendance/use-lesson-scores';
import type { Group, Session, User } from '@/lib/dal/types';

export type ReceptionEntryMode = 'attendance' | 'grades';

export interface LessonExamScorePanelAuthProps {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  userEmail?: string | null;
  staffRoleLabel?: string;
  error?: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

interface LessonExamScorePanelProps {
  session: Session;
  group?: Group;
  subjectNameAr?: string;
  enrolledStudents: User[];
  allTenantUsers: User[];
  mode: ReceptionEntryMode;
  onModeChange: (mode: ReceptionEntryMode) => void;
  exams: LessonExamRecord[];
  activeExam: LessonExamRecord | null;
  onSelectExam: (examId: string) => void;
  gradesForActiveExamByStudent: Record<string, LessonGradeRecord>;
  saveStateByKey: Record<string, GradeSaveState>;
  audits: LessonGradeAuditEntry[];
  authProps: LessonExamScorePanelAuthProps;
  syncError?: string | null;
  isLoadingScores?: boolean;
  onSaveTotalMarks: (params: {
    sessionId: string;
    examId?: string;
    title?: string;
    rawTotalMarks: string;
  }) => Promise<{ ok: true; exam: LessonExamRecord } | { ok: false; errorAr: string }>;
  onSaveScore: (params: {
    sessionId: string;
    examId: string;
    totalMarks: number;
    studentId: string;
    studentIdOrCode: string;
    rawScore: string;
    source: 'panel';
  }) => Promise<{ ok: true; grade: LessonGradeRecord } | { ok: false; errorAr: string }>;
  incomingBarcodeScan?: { code: string; seq: number } | null;
  pendingLocalCount: number;
  importReviewRows: LocalImportReviewRow[];
  onOpenImportReview: () => Promise<LocalImportReviewRow[]>;
  onCommitImport: (
    selected: LocalStorageGradeCandidate[]
  ) => Promise<{ ok: boolean; message: string }>;
}

export function LessonExamScorePanel({
  session,
  group,
  subjectNameAr,
  enrolledStudents,
  allTenantUsers,
  mode,
  onModeChange,
  exams,
  activeExam,
  onSelectExam,
  gradesForActiveExamByStudent,
  saveStateByKey,
  audits,
  authProps,
  syncError,
  isLoadingScores = false,
  onSaveTotalMarks,
  onSaveScore,
  incomingBarcodeScan,
  pendingLocalCount,
  importReviewRows,
  onOpenImportReview,
  onCommitImport,
}: LessonExamScorePanelProps) {
  const codeInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Firebase Auth Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Exam Total Marks Editor State
  const [isEditingMaxMarks, setIsEditingMaxMarks] = useState(false);
  const [maxMarksInput, setMaxMarksInput] = useState('20');
  const [examTitleInput, setExamTitleInput] = useState('');
  const [maxMarksError, setMaxMarksError] = useState<string | null>(null);
  const [maxMarksSavedMsg, setMaxMarksSavedMsg] = useState<string | null>(null);
  const [isSavingMaxMarks, setIsSavingMaxMarks] = useState(false);

  // Fast Student Code -> Score Entry State
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [scoreDraftsByKey, setScoreDraftsByKey] = useState<Record<string, string>>({});
  const [validationErrorByKey, setValidationErrorByKey] = useState<Record<string, string | null>>({});

  // Local Import Review & Audit Drawer
  const [showImportReview, setShowImportReview] = useState(false);
  const [selectedImportKeys, setSelectedImportKeys] = useState<Record<string, boolean>>({});
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showAudits, setShowAudits] = useState(false);

  // Clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Reset per-session UI error states cleanly on session change
  useEffect(() => {
    setSelectedStudent(null);
    setStudentCodeInput('');
    setLookupError(null);
    setMaxMarksError(null);
    setMaxMarksSavedMsg(null);
    setIsEditingMaxMarks(false);
  }, [session.id]);

  // Sync max marks input when switching active exam
  useEffect(() => {
    if (activeExam) {
      setMaxMarksInput(formatCleanNumber(activeExam.totalMarks));
      setExamTitleInput(activeExam.title);
    } else {
      setMaxMarksInput('20');
      setExamTitleInput(`اختبار حصة ${session.sessionDate}`);
    }
    setMaxMarksError(null);
  }, [activeExam, session.sessionDate]);

  const activeKey =
    activeExam && selectedStudent ? lessonGradeDocId(activeExam.id, selectedStudent.id) : null;
  const activeSavedGrade =
    selectedStudent && gradesForActiveExamByStudent[selectedStudent.id]
      ? gradesForActiveExamByStudent[selectedStudent.id].score
      : undefined;
  const activeSaveState = activeKey ? saveStateByKey[activeKey] : undefined;
  const activeValidationError = activeKey ? validationErrorByKey[activeKey] : null;

  const displayedScoreValue = (() => {
    if (!activeKey) return '';
    if (Object.prototype.hasOwnProperty.call(scoreDraftsByKey, activeKey)) {
      return scoreDraftsByKey[activeKey];
    }
    if (activeSaveState?.status === 'error' && activeSaveState.draftValue !== undefined) {
      return activeSaveState.draftValue;
    }
    return activeSavedGrade !== undefined ? formatCleanNumber(activeSavedGrade) : '';
  })();

  const focusScoreInputSoon = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        scoreInputRef.current?.focus();
        scoreInputRef.current?.select();
      });
    } else {
      scoreInputRef.current?.focus();
    }
  }, []);

  const focusCodeInputSoon = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        codeInputRef.current?.focus();
      });
    } else {
      codeInputRef.current?.focus();
    }
  }, []);

  // Select student cleanly by barcode or code in Grade Entry Mode ONLY (never records attendance)
  const handleSelectStudentByCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) {
        setLookupError('اكتب كود الطالب أو امسح الباركود أولاً');
        return;
      }

      onModeChange('grades');
      const lowered = code.toLowerCase();

      const enrolledMatch = enrolledStudents.find(
        (s) =>
          s.id === code ||
          (s.studentCode && s.studentCode.toLowerCase() === lowered)
      );

      if (!enrolledMatch) {
        const otherGroupStudent = allTenantUsers.find(
          (u) =>
            u.role === 'STUDENT' &&
            (u.id === code || (u.studentCode && u.studentCode.toLowerCase() === lowered))
        );
        if (otherGroupStudent) {
          setLookupError(
            `الطالب (${otherGroupStudent.fullName}) غير مقيد في هذه المجموعة أو تابع لمجموعة أخرى`
          );
        } else {
          setLookupError(`لم يتم العثور على طالب مسجل بالكود (${code})`);
        }
        setSelectedStudent(null);
        return;
      }

      setLookupError(null);
      setSelectedStudent(enrolledMatch);
      setStudentCodeInput(enrolledMatch.studentCode || enrolledMatch.id);

      if (activeExam) {
        const nextKey = lessonGradeDocId(activeExam.id, enrolledMatch.id);
        const existingScore = gradesForActiveExamByStudent[enrolledMatch.id]?.score;
        setScoreDraftsByKey((prev) => ({
          ...prev,
          [nextKey]: existingScore !== undefined ? formatCleanNumber(existingScore) : '',
        }));
        setValidationErrorByKey((prev) => ({ ...prev, [nextKey]: null }));
      }

      focusScoreInputSoon();
    },
    [
      activeExam,
      allTenantUsers,
      enrolledStudents,
      focusScoreInputSoon,
      gradesForActiveExamByStudent,
      onModeChange,
    ]
  );

  // Route hardware barcode scans captured by global listener when Grade Entry Mode is active
  const lastProcessedSeqRef = useRef(0);
  useEffect(() => {
    if (!incomingBarcodeScan || incomingBarcodeScan.seq === lastProcessedSeqRef.current) return;
    lastProcessedSeqRef.current = incomingBarcodeScan.seq;
    handleSelectStudentByCode(incomingBarcodeScan.code);
  }, [incomingBarcodeScan, handleSelectStudentByCode]);

  const handleSaveTotalMarksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaxMarksError(null);
    setMaxMarksSavedMsg(null);
    setIsSavingMaxMarks(true);

    const res = await onSaveTotalMarks({
      sessionId: session.id,
      examId: activeExam?.id,
      title: examTitleInput,
      rawTotalMarks: maxMarksInput,
    });

    setIsSavingMaxMarks(false);
    if (!res.ok) {
      setMaxMarksError(res.errorAr);
      return;
    }
    setIsEditingMaxMarks(false);
    setMaxMarksSavedMsg(`تم تثبيت الدرجة النهائية (${formatCleanNumber(res.exam.totalMarks)})`);
  };

  // Capture explicit (session, exam, student, value) so switching exam/session mid-save stays isolated
  const executeScoreSave = useCallback(
    async (ctx: {
      sessionId: string;
      examId: string;
      totalMarks: number;
      studentId: string;
      studentIdOrCode: string;
      rawScore: string;
    }) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const trimmed = ctx.rawScore.trim();
      if (!trimmed) return false;

      const key = lessonGradeDocId(ctx.examId, ctx.studentId);
      const parsed = parseLessonScore(trimmed, ctx.totalMarks);
      if (!parsed.ok) {
        setValidationErrorByKey((prev) => ({ ...prev, [key]: parsed.errorAr }));
        return false;
      }

      setValidationErrorByKey((prev) => ({ ...prev, [key]: null }));

      const result = await onSaveScore({
        ...ctx,
        source: 'panel',
      });

      if (result.ok) {
        setScoreDraftsByKey((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Clear scan input cleanly and move focus back for rapid sequential scanning if still on the same selection
        setStudentCodeInput('');
        focusCodeInputSoon();
        return true;
      }

      return false;
    },
    [focusCodeInputSoon, onSaveScore]
  );

  const handleScoreChange = (rawValue: string) => {
    if (!activeExam || !selectedStudent) return;
    const captured = {
      sessionId: session.id,
      examId: activeExam.id,
      totalMarks: activeExam.totalMarks,
      studentId: selectedStudent.id,
      studentIdOrCode: selectedStudent.studentCode || selectedStudent.id,
      rawScore: rawValue,
    };
    const key = lessonGradeDocId(captured.examId, captured.studentId);

    setScoreDraftsByKey((prev) => ({ ...prev, [key]: rawValue }));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!rawValue.trim()) {
      setValidationErrorByKey((prev) => ({ ...prev, [key]: null }));
      return;
    }

    const parsed = parseLessonScore(rawValue, captured.totalMarks);
    if (!parsed.ok) {
      setValidationErrorByKey((prev) => ({ ...prev, [key]: parsed.errorAr }));
      return;
    }

    setValidationErrorByKey((prev) => ({ ...prev, [key]: null }));
    debounceTimerRef.current = setTimeout(() => {
      void executeScoreSave(captured);
    }, 450);
  };

  const handleScoreBlur = () => {
    if (!activeExam || !selectedStudent || !activeKey) return;
    const hasDraft = Object.prototype.hasOwnProperty.call(scoreDraftsByKey, activeKey);
    const currentRaw = displayedScoreValue;
    if (!currentRaw.trim()) return;
    if (debounceTimerRef.current || (hasDraft && activeSavedGrade === undefined) || (hasDraft && String(activeSavedGrade) !== currentRaw.trim())) {
      void executeScoreSave({
        sessionId: session.id,
        examId: activeExam.id,
        totalMarks: activeExam.totalMarks,
        studentId: selectedStudent.id,
        studentIdOrCode: selectedStudent.studentCode || selectedStudent.id,
        rawScore: currentRaw,
      });
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSigningIn(true);
    try {
      await authProps.onSignIn(loginEmail, loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'فشل تسجيل الدخول بحساب Firebase');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOpenImportReview = async () => {
    setImportStatusMsg(null);
    const rows = await onOpenImportReview();
    const defaultChecks: Record<string, boolean> = {};
    rows.forEach((r) => {
      if (r.eligible) {
        defaultChecks[`${r.candidate.examId}:${r.candidate.studentId}`] = true;
      }
    });
    setSelectedImportKeys(defaultChecks);
    setShowImportReview((prev) => !prev);
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    setImportStatusMsg(null);
    const selected = importReviewRows
      .filter((r) => r.eligible && selectedImportKeys[`${r.candidate.examId}:${r.candidate.studentId}`])
      .map((r) => r.candidate);
    const res = await onCommitImport(selected);
    setImportStatusMsg(res.message);
    setIsImporting(false);
  };

  const needsExamSetup = !activeExam || isEditingMaxMarks;

  return (
    <section
      aria-label="تسجيل درجات اختبار الحصة"
      data-grade-entry-scope="true"
      className="card-elevated rounded-3xl p-5 border border-brand-cyan-500/35 bg-card space-y-4 shadow-soft-sm"
    >
      {/* Header + Mode Switch */}
      <div className="flex flex-col gap-3 pb-3 border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-cyan-500 shrink-0" />
              <span>تسجيل درجات اختبار الحصة</span>
              {isLoadingScores && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-cyan-500" />}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {group?.nameAr || 'المجموعة المختارة'} · {activeExam?.subjectNameAr || subjectNameAr || 'المادة'} · {session.sessionDate} ({session.startTime})
            </p>
          </div>

          <div
            className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 text-[11px]"
            role="group"
            aria-label="تبديل وضع المسح"
          >
            <button
              type="button"
              aria-pressed={mode === 'attendance'}
              onClick={() => onModeChange('attendance')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                mode === 'attendance'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              وضع تسجيل الحضور
            </button>
            <button
              type="button"
              aria-pressed={mode === 'grades'}
              onClick={() => {
                onModeChange('grades');
                focusCodeInputSoon();
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                mode === 'grades'
                  ? 'bg-brand-cyan-500 text-brand-navy-950 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              وضع تسجيل الدرجات
            </button>
          </div>
        </div>

        {/* Firebase Auth & Cloud Firestore Status */}
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs space-y-2">
          {authProps.signedIn ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate">
                  متصل بـ Cloud Firestore ({authProps.userEmail})
                </span>
                {authProps.staffRoleLabel && (
                  <Badge variant="success" className="text-[10px]">
                    {authProps.staffRoleLabel}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {audits.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setShowAudits((v) => !v)}
                  >
                    <History className="w-3 h-3" />
                    <span>سجل التعديلات ({audits.length})</span>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void authProps.onSignOut()}
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </Button>
              </div>
            </div>
          ) : authProps.configured ? (
            <form onSubmit={handleSignInSubmit} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>سجّل الدخول بحساب الموظف على Firebase لتفعيل الحفظ والمزامنة اللحظية</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="email"
                  required
                  placeholder="البريد الإلكتروني للموظف"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                />
                <input
                  type="password"
                  required
                  placeholder="كلمة المرور"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="cyan"
                  disabled={isSigningIn}
                  className="h-8 text-[11px]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSigningIn ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</span>
                </Button>
              </div>
              {(loginError || authProps.error) && (
                <p role="alert" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {loginError || authProps.error}
                </p>
              )}
            </form>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
              <span>
                ربط Firebase غير مفعّل بعد: أضف إعدادات مشروع <code className="font-mono">yalla-center</code> ووقّع دخول الموظف للمزامنة السحابية.
              </span>
            </div>
          )}

          {syncError && (
            <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
              {syncError}
            </p>
          )}
        </div>
      </div>

      {/* Exam Selector when multiple exams exist */}
      {exams.length > 1 && (
        <label className="block text-xs space-y-1">
          <span className="font-bold text-foreground">اختيار اختبار الحصة</span>
          <select
            aria-label="اختيار اختبار الحصة"
            value={activeExam?.id || ''}
            onChange={(e) => onSelectExam(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
          >
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} (الدرجة النهائية: {formatCleanNumber(exam.totalMarks)})
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Exam Shared Total Marks ("الدرجة النهائية للاختبار") */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 space-y-2.5">
        {!needsExamSetup && activeExam ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground block truncate">
                {activeExam.title}
              </span>
              <div className="text-xs font-black text-foreground flex items-center gap-2 mt-0.5">
                <span>الدرجة النهائية للاختبار:</span>
                <Badge variant="cyan" dir="ltr" className="font-mono font-black">
                  {formatCleanNumber(activeExam.totalMarks)}
                </Badge>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditingMaxMarks(true);
                setMaxMarksError(null);
                setMaxMarksSavedMsg(null);
              }}
              className="h-8 text-[11px] gap-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>تعديل الدرجة النهائية</span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSaveTotalMarksSubmit} className="space-y-2">
            <div className="text-xs font-bold text-foreground">
              {activeExam ? 'تعديل الدرجة النهائية للاختبار' : 'تحديد الدرجة النهائية للاختبار'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <label className="sm:col-span-6 text-[11px] space-y-1">
                <span className="text-muted-foreground">عنوان الاختبار</span>
                <input
                  type="text"
                  value={examTitleInput}
                  onChange={(e) => setExamTitleInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-border bg-background text-xs"
                />
              </label>
              <label className="sm:col-span-3 text-[11px] space-y-1">
                <span className="text-muted-foreground">الدرجة النهائية للاختبار</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="الدرجة النهائية للاختبار"
                  value={maxMarksInput}
                  onChange={(e) => setMaxMarksInput(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-border bg-background font-mono text-xs font-bold text-center"
                  dir="ltr"
                />
              </label>
              <div className="sm:col-span-3 flex gap-1.5">
                <Button
                  type="submit"
                  size="sm"
                  variant="cyan"
                  disabled={isSavingMaxMarks}
                  className="h-9 flex-1 text-[11px]"
                >
                  {isSavingMaxMarks ? 'جارٍ التثبيت...' : 'حفظ النهاية'}
                </Button>
                {activeExam && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingMaxMarks(false);
                      setMaxMarksError(null);
                    }}
                    className="h-9 px-2.5 text-[11px]"
                  >
                    إلغاء
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}

        {maxMarksError && (
          <p role="alert" className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
            {maxMarksError}
          </p>
        )}
        {maxMarksSavedMsg && (
          <p role="status" className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {maxMarksSavedMsg}
          </p>
        )}
      </div>

      {/* Rapid Barcode / Student Code Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSelectStudentByCode(studentCodeInput);
        }}
        className="space-y-2"
      >
        <label htmlFor="grade-student-code-input" className="block text-xs font-bold text-foreground">
          اكتب كود الطالب أو امسح الباركود
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-brand-cyan-500 absolute right-3 top-2.5" />
            <input
              id="grade-student-code-input"
              ref={codeInputRef}
              type="text"
              placeholder="مثال: STD-1001"
              value={studentCodeInput}
              onFocus={() => onModeChange('grades')}
              onChange={(e) => {
                setStudentCodeInput(e.target.value);
                if (lookupError) setLookupError(null);
              }}
              className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9 text-xs font-bold shrink-0">
            اختيار
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          المسح هنا يختار الطالب لرصد الدرجة فقط دون تسجيل حضور إضافي.
        </p>
        {lookupError && (
          <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {lookupError}
          </p>
        )}
      </form>

      {/* Selected Student & Auto-Focused Score Field */}
      {selectedStudent && activeExam && (
        <div className="rounded-2xl border border-brand-cyan-500/40 bg-brand-cyan-500/5 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-foreground">{selectedStudent.fullName}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {selectedStudent.studentCode || selectedStudent.id}
              </div>
            </div>
            <Badge
              variant={activeSavedGrade !== undefined ? 'cyan' : 'outline'}
              dir="ltr"
              className="font-mono font-bold"
            >
              {formatLessonScoreFraction(activeSavedGrade, activeExam.totalMarks)}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="lesson-score-value-input" className="text-xs font-bold text-foreground shrink-0">
              الدرجة:
            </label>
            <div className="flex items-center flex-1 rounded-xl border border-border bg-background px-3 h-10 focus-within:ring-2 focus-within:ring-brand-cyan-500" dir="ltr">
              <input
                id="lesson-score-value-input"
                ref={scoreInputRef}
                type="text"
                inputMode="decimal"
                aria-label="درجة الطالب"
                placeholder="0"
                value={displayedScoreValue}
                onChange={(e) => handleScoreChange(e.target.value)}
                onBlur={handleScoreBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void executeScoreSave({
                      sessionId: session.id,
                      examId: activeExam.id,
                      totalMarks: activeExam.totalMarks,
                      studentId: selectedStudent.id,
                      studentIdOrCode: selectedStudent.studentCode || selectedStudent.id,
                      rawScore: displayedScoreValue,
                    });
                  }
                }}
                className="w-full bg-transparent text-sm font-mono font-black text-foreground text-center focus:outline-none"
              />
              <span className="text-xs font-mono font-bold text-muted-foreground shrink-0 pl-2 border-l border-border">
                / {formatCleanNumber(activeExam.totalMarks)}
              </span>
            </div>
          </div>

          {/* Save Lifecycle Feedback & Retry */}
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[24px]">
            <div className="text-[11px] font-bold" role="status">
              {activeValidationError ? (
                <span className="text-rose-600 dark:text-rose-400">{activeValidationError}</span>
              ) : activeSaveState?.status === 'saving' ? (
                <span className="text-brand-cyan-600 dark:text-brand-cyan-400 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>جارٍ الحفظ</span>
                </span>
              ) : activeSaveState?.status === 'saved' ? (
                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>تم الحفظ</span>
                </span>
              ) : activeSaveState?.status === 'error' ? (
                <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{activeSaveState.message}</span>
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">
                  يحفظ تلقائياً عند الضغط على Enter أو الخروج من الحقل
                </span>
              )}
            </div>

            {activeSaveState?.status === 'error' && activeSaveState.lastAttempt && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const attempt = activeSaveState.lastAttempt!;
                  void executeScoreSave({
                    sessionId: attempt.sessionId,
                    examId: attempt.examId,
                    totalMarks: activeExam.totalMarks,
                    studentId: attempt.studentId,
                    studentIdOrCode: attempt.studentIdOrCode,
                    rawScore: attempt.rawScore,
                  });
                }}
                className="h-7 px-2.5 text-[11px] border-rose-500/40 text-rose-600 dark:text-rose-400"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إعادة المحاولة</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Existing LocalStorage Demo Grades Review Banner & Import Drawer */}
      {pendingLocalCount > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>توجد {pendingLocalCount} درجة محفوظة محلياً في المتصفح</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleOpenImportReview()}
              className="h-7 px-2.5 text-[11px]"
            >
              {showImportReview ? 'إخفاء المراجعة' : 'مراجعة قبل الاستيراد'}
            </Button>
          </div>

          {showImportReview && (
            <div className="space-y-2 pt-2 border-t border-amber-500/20">
              {importReviewRows.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">لا توجد سجلات قابلة للعرض.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5">
                  {importReviewRows.map((row) => {
                    const checkKey = `${row.candidate.examId}:${row.candidate.studentId}`;
                    return (
                      <label
                        key={`${row.candidate.storageKey}:${row.candidate.examId}`}
                        className="flex items-start justify-between gap-2 p-2 rounded-xl bg-background/80 border border-border/70 text-[11px]"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            disabled={!row.eligible}
                            checked={Boolean(selectedImportKeys[checkKey])}
                            onChange={(e) =>
                              setSelectedImportKeys((prev) => ({
                                ...prev,
                                [checkKey]: e.target.checked,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-bold text-foreground">
                              {row.studentName || row.candidate.studentId}{' '}
                              <span className="font-mono text-muted-foreground">
                                ({row.studentCode || row.candidate.studentId})
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              {row.examTitle || row.candidate.examId} · {row.sessionDate || row.candidate.sessionId}
                            </div>
                            <div
                              className={
                                row.eligible
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-amber-700 dark:text-amber-400'
                              }
                            >
                              {row.reasonAr}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" dir="ltr" className="font-mono shrink-0">
                          {formatLessonScoreFraction(row.candidate.score, row.totalMarks)}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="cyan"
                  disabled={!authProps.signedIn || isImporting}
                  onClick={() => void handleConfirmImport()}
                  className="h-8 text-[11px]"
                >
                  {isImporting ? 'جارٍ الاستيراد...' : 'استيراد المحدد إلى Firestore'}
                </Button>
                {!authProps.signedIn && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400">
                    سجّل الدخول بحساب موظف أولاً لاعتماد الاستيراد
                  </span>
                )}
              </div>
              {importStatusMsg && (
                <p role="status" className="text-[11px] font-semibold text-foreground">
                  {importStatusMsg}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Immutable Audit Trail Preview */}
      {showAudits && audits.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 space-y-2 text-[11px]">
          <div className="font-bold text-foreground">سجل تعديلات الدرجات (Firestore Audit)</div>
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {audits.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-background/80 border border-border/60"
              >
                <div>
                  <div className="font-bold text-foreground">
                    {entry.actorName} ({entry.actorRole}) — {entry.action}
                  </div>
                  <div className="text-muted-foreground font-mono">
                    {entry.studentId || entry.examId} ·{' '}
                    {entry.previousScore !== null ? entry.previousScore : 'لم تُرصد'} ←{' '}
                    {entry.newScore !== null ? entry.newScore : 'محذوفة'}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
