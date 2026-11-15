'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  History,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import {
  cairoClock,
  readReceptionRecord,
  sessionStart,
  summarizeReception,
  writeReceptionRecord,
} from '@/lib/attendance/reception';
import {
  formatCleanNumber,
  formatLessonScoreFraction,
  lessonGradeDocId,
  type LessonExamRecord,
  type LessonGradeRecord,
} from '@/lib/attendance/lesson-scores';
import { LESSON_GRADE_SYNC_EVENT } from '@/lib/attendance/use-lesson-scores';
import type { Attendance, Enrollment, Exam, ExamSubmission, Group, Session, User } from '@/lib/dal/types';
import type { HudScanData } from './verification-hud';

interface Props {
  tenantId: string;
  student: User;
  session: Session;
  group?: Group;
  centerSlug: string;
  remoteExams?: LessonExamRecord[];
  remoteGradesByKey?: Record<string, LessonGradeRecord>;
  onSaveUnifiedGrade?: (params: {
    sessionId: string;
    examId: string;
    totalMarks: number;
    studentId: string;
    studentIdOrCode: string;
    rawScore: string;
    source: 'card';
  }) => Promise<{ ok: true; grade: LessonGradeRecord } | { ok: false; errorAr: string }>;
  onDeleteUnifiedGrade?: (params: {
    sessionId: string;
    examId: string;
    studentId: string;
    source: 'card';
  }) => Promise<{ ok: boolean; errorAr?: string }>;
  hudData?: HudScanData;
  onQuickPayClick?: (student: User) => void;
}

interface StudentData {
  enrollment: Enrollment;
  sessions: Session[];
  attendance: Attendance[];
  exams: Exam[];
  submissions: ExamSubmission[];
}

const previousLabels: Record<string, string> = {
  present: 'حاضر',
  late: 'حاضر',
  absent: 'غائب',
  excused: 'غائب',
  unrecorded: 'لم يُسجّل الحضور',
  none: 'لا توجد حصة سابقة',
};

const percentage = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1, style: 'percent' });
function formatPercentage(value: number | null) {
  return value === null ? 'بيانات غير كافية' : percentage.format(value / 100);
}

export function ReceptionStudentCard({
  tenantId,
  student,
  session,
  group,
  centerSlug,
  remoteExams,
  remoteGradesByKey,
  onSaveUnifiedGrade,
  onDeleteUnifiedGrade,
  hudData,
  onQuickPayClick,
}: Props) {
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState('');
  const [homework, setHomework] = useState<boolean>();
  const [currentNotes, setCurrentNotes] = useState('');
  const [notesSavedIndicator, setNotesSavedIndicator] = useState(false);
  const [, setRevision] = useState(0);
  const [gradeExams, setGradeExams] = useState<Exam[]>();
  const studentId = student.id;
  const { id: sessionId, groupId } = session;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setRevision((v) => v + 1);
    window.addEventListener(LESSON_GRADE_SYNC_EVENT, handler);
    return () => window.removeEventListener(LESSON_GRADE_SYNC_EVENT, handler);
  }, []);

  useEffect(() => {
    let active = true;
    const dal = getDataProvider();
    Promise.all([
      dal.getEnrollments(tenantId, { groupId, studentId }),
      dal.getSessions(tenantId, { groupId }),
      dal.getStudentAttendanceHistory(tenantId, studentId),
      dal.getExams(tenantId, { groupId }),
      dal.getStudentExamSubmissions(tenantId, groupId, studentId),
    ]).then(([enrollments, sessions, attendance, exams, submissions]) => {
      if (!active) return;
      const enrollment = enrollments.find(item => item.isActive);
      if (!enrollment || student.tenantId !== tenantId || student.role !== 'STUDENT') {
        setError('الطالب غير مقيد في هذه المجموعة');
        return;
      }
      setData({ enrollment, sessions, attendance, exams, submissions });
      const record = readReceptionRecord(tenantId, sessionId, studentId);
      setHomework(record.homework);
      if (record.notes !== undefined) {
        setCurrentNotes(record.notes);
      }
    }).catch(() => { if (active) setError('تعذّر تحميل تفاصيل الطالب'); });
    return () => { active = false; };
  }, [tenantId, groupId, sessionId, studentId, student.tenantId, student.role]);

  const mergedExams = useMemo(() => {
    if (!data) return [] as Exam[];
    if (!remoteExams || remoteExams.length === 0) return data.exams;
    const byId = new Map<string, Exam>(data.exams.map((e) => [e.id, e]));
    for (const remote of remoteExams) {
      if (remote.groupId !== groupId) continue;
      const existing = byId.get(remote.id);
      byId.set(remote.id, {
        ...(existing ?? {
          id: remote.id,
          tenantId: remote.tenantId,
          sessionId: remote.sessionId,
          groupId: remote.groupId,
          subjectId: remote.subjectId,
          subjectNameAr: remote.subjectNameAr,
          teacherId: remote.teacherId,
          title: remote.title,
          durationMinutes: 15,
          totalMarks: remote.totalMarks,
          passMarks: remote.passMarks,
          isAiGenerated: false,
          groundedMaterialIds: [],
          status: 'draft',
          createdAt: remote.createdAt,
        }),
        title: remote.title,
        totalMarks: remote.totalMarks,
        passMarks: remote.passMarks,
      });
    }
    return Array.from(byId.values());
  }, [data, groupId, remoteExams]);

  const { summary, history } = (() => {
    if (!data) return { summary: null, history: [] };
    try {
      const records = new Map(data.sessions.map(item =>
        [item.id, readReceptionRecord(tenantId, item.id, studentId)]));
      const manualGrade = (exam: Exam) => {
        const remote = remoteGradesByKey?.[lessonGradeDocId(exam.id, studentId)];
        if (remote) return remote.score;
        return exam.sessionId ? records.get(exam.sessionId)?.grades[exam.id] : undefined;
      };
      return {
        summary: summarizeReception(session, data.enrollment, data.sessions, data.attendance,
          mergedExams, data.submissions, manualGrade, undefined, group ? [group] : undefined),
        history: mergedExams.filter(exam => exam.sessionId !== sessionId && manualGrade(exam) !== undefined),
      };
    } catch {
      return { summary: null, history: [] };
    }
  })();

  const previousSession = useMemo(() => {
    if (!data) return undefined;
    return data.sessions
      .filter(s => s.groupId === groupId && s.id !== sessionId && sessionStart(s) < sessionStart(session))
      .sort((a, b) => sessionStart(b).localeCompare(sessionStart(a)))[0];
  }, [data, groupId, sessionId, session]);

  const previousNotes = useMemo(() => {
    if (!previousSession) return null;
    const rec = readReceptionRecord(tenantId, previousSession.id, studentId);
    if (rec.notes && rec.notes.trim()) return rec.notes.trim();
    const att = data?.attendance.find(a => a.sessionId === previousSession.id);
    if (att?.notes && att.notes.trim()) return att.notes.trim();
    return null;
  }, [previousSession, tenantId, studentId, data]);

  const currentExam = useMemo(() => {
    return mergedExams.find(exam => exam.sessionId === sessionId && exam.status !== 'archived');
  }, [mergedExams, sessionId]);

  const currentExamScore = useMemo(() => {
    if (!currentExam) return undefined;
    const remote = remoteGradesByKey?.[lessonGradeDocId(currentExam.id, studentId)];
    if (remote !== undefined) return remote.score;
    return readReceptionRecord(tenantId, sessionId, studentId).grades[currentExam.id];
  }, [currentExam, remoteGradesByKey, studentId, tenantId, sessionId]);

  function saveHomework(next: boolean) {
    try {
      const record = readReceptionRecord(tenantId, sessionId, studentId);
      writeReceptionRecord(tenantId, sessionId, studentId, { ...record, homework: next });
      setHomework(next);
      setError('');
    } catch {
      setError('تعذّر حفظ حالة الواجب');
    }
  }

  const handleNotesChange = (val: string) => {
    setCurrentNotes(val);
  };

  const handleNotesBlur = () => {
    try {
      const record = readReceptionRecord(tenantId, sessionId, studentId);
      const nextRecord = { ...record };
      if (currentNotes.trim()) {
        nextRecord.notes = currentNotes.trim();
      } else {
        delete nextRecord.notes;
      }
      writeReceptionRecord(tenantId, sessionId, studentId, nextRecord);
      setNotesSavedIndicator(true);
      setTimeout(() => setNotesSavedIndicator(false), 2000);
    } catch {
      // ignore
    }
  };

  const balanceDue = hudData?.balanceAlert?.balanceDue ?? student.balanceDue ?? 0;
  const hasOverdueBalance = (hudData?.balanceAlert && hudData.balanceAlert.hasBalance) || balanceDue > 0;
  const isWarning = hudData?.state === 'warning' || hasOverdueBalance;

  return (
    <section
      aria-label="متابعة الطالب"
      className={`card-elevated rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 shadow-xl space-y-4 ${
        isWarning
          ? 'border-amber-500/70 bg-gradient-to-b from-amber-500/10 via-card to-card'
          : 'border-emerald-500/70 bg-gradient-to-b from-emerald-500/10 via-card to-card'
      }`}
    >
      {/* 1. Unified Student Identity & Attendance Status Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-border/70">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-border shadow-md shrink-0 bg-muted flex items-center justify-center">
            {student.avatarUrl ? (
              <Image
                src={student.avatarUrl}
                alt={student.fullName}
                fill
                className="object-cover"
              />
            ) : (
              <span className="text-xl sm:text-2xl font-black text-muted-foreground">
                {student.fullName.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>حضور مؤكد</span>
              </span>
              <Badge variant="cyan" className="font-mono text-xs font-bold">
                {student.studentCode || student.id}
              </Badge>
              {student.seatNumber && (
                <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">
                  مقعد رقم: {student.seatNumber}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-foreground">
              {student.fullName}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {group?.nameAr && (
                <span className="flex items-center gap-1 text-foreground/80 font-medium">
                  <MapPin className="w-3 h-3 text-brand-cyan-500" />
                  <span>{group.nameAr}</span>
                </span>
              )}
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-brand-cyan-500" />
                <span>{hudData?.recordedAt ? new Date(hudData.recordedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : cairoClock().slice(11, 16)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="text-left md:text-right shrink-0">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
            تم إرسال إشعار ولي الأمر (واتساب)
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Real-time Async Dispatched
          </span>
        </div>
      </div>

      {/* Financial Balance Warning Banner */}
      {hasOverdueBalance && (
        <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground block">تنبيه المستحقات المالية</span>
              <span className="text-sm sm:text-base font-black">
                مطلوب سداد: {balanceDue.toFixed(2)} ج.م
              </span>
            </div>
          </div>
          {onQuickPayClick && (
            <Button
              type="button"
              size="sm"
              onClick={() => onQuickPayClick(student)}
              className="h-9 px-4 text-xs font-black gap-1.5 shadow-sm bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CreditCard className="w-4 h-4" />
              <span>تحصيل فوري الآن</span>
            </Button>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <p role="status" className="text-xs text-muted-foreground">جارٍ تحميل تفاصيل الطالب…</p>}

      {data && (
        <>
          {/* 2. Unified Academic & Follow-up Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Previous Session Status */}
            <div className="space-y-1 p-2.5 rounded-2xl bg-muted/20 border border-border/60">
              <span className="text-muted-foreground block">الحصة السابقة</span>
              <div className="font-bold pt-0.5">
                {summary ? (
                  summary.previous === 'present' || summary.previous === 'late' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{previousLabels[summary.previous]}</span>
                    </span>
                  ) : summary.previous === 'absent' || summary.previous === 'excused' ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{previousLabels[summary.previous]}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium">{previousLabels[summary.previous]}</span>
                  )
                ) : (
                  'غير متاح'
                )}
              </div>
            </div>

            {/* Monthly Absences in Group */}
            <div className="space-y-1 p-2.5 rounded-2xl bg-muted/20 border border-border/60">
              <span className="text-muted-foreground block">غياب الشهر في المجموعة</span>
              <div className="font-bold text-sm text-foreground pt-0.5">
                {summary?.monthlyAbsences ?? 0}
              </div>
            </div>

            {/* Homework Toggle Switch */}
            <div className="space-y-1 p-2.5 rounded-2xl bg-muted/20 border border-border/60">
              <span className="text-muted-foreground block">واجب الحصة الحالية</span>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  role="switch"
                  aria-label="تسليم واجب الحصة"
                  aria-checked={homework === true}
                  onClick={() => saveHomework(homework !== true)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 ${
                    homework ? 'bg-brand-cyan-500' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      homework ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-[11px] font-bold ${homework ? 'text-brand-cyan-600 dark:text-brand-cyan-400' : 'text-muted-foreground'}`}>
                  {homework === true ? 'تم التسليم' : 'لم يتم التسليم'}
                </span>
              </div>
            </div>

            {/* Current Session Exam Score */}
            <div className="space-y-1 p-2.5 rounded-2xl bg-muted/20 border border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground block">درجة اختبار الحصة</span>
                {currentExam && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setGradeExams([currentExam])}
                    className="h-5 px-1 text-[10px] text-brand-cyan-600 dark:text-brand-cyan-400 hover:bg-brand-cyan-500/10"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <div className="font-mono font-bold text-foreground text-xs pt-0.5">
                {currentExam
                  ? currentExamScore !== undefined
                    ? `${formatCleanNumber(currentExamScore)} / ${formatCleanNumber(currentExam.totalMarks)}`
                    : `لم تُرصد (/ ${formatCleanNumber(currentExam.totalMarks)})`
                  : 'لا يوجد اختبار'}
              </div>
            </div>
          </div>

          {/* Average Performance (Subject Scoped) */}
          <div className="p-3 rounded-2xl bg-muted/30 border border-border/70 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-cyan-500" />
                <span className="font-bold text-foreground">متوسط أداء الطالب للمادة:</span>
                <Badge variant={summary?.performance !== null ? 'cyan' : 'outline'} className="font-mono font-bold text-xs">
                  {formatPercentage(summary?.performance ?? null)}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="cyan"
                  onClick={() => setGradeExams(mergedExams.filter(exam => exam.sessionId === sessionId && exam.status !== 'archived'))}
                  className="h-7 text-xs font-bold"
                >
                  تسجيل درجة اختبار الحصة
                </Button>
                {history.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGradeExams(history)}
                    className="h-7 text-xs"
                  >
                    تعديل درجات الحصص السابقة
                  </Button>
                )}
              </div>
            </div>

            {summary && (
              <details className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <summary className="cursor-pointer font-medium hover:text-foreground">
                  تفاصيل متوسط الأداء
                </summary>
                <ul className="space-y-1 mt-1.5 pr-2">
                  {['اختبارات الحصص', 'امتحانات الشامل', 'الحضور'].map((label, index) => (
                    <li key={label} className="flex items-center justify-between max-w-xs">
                      <span>{label}:</span>
                      <span className="font-mono font-bold text-foreground">{formatPercentage(summary.components[index])}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* 3. Notes Section: Current & Previous Session Notes */}
          <div className="pt-2 border-t border-border/70 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Current Session Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="reception-student-current-notes" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-cyan-500" />
                    <span>ملاحظات الحصة الحالية</span>
                  </label>
                  {notesSavedIndicator && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> تم الحفظ
                    </span>
                  )}
                </div>
                <textarea
                  id="reception-student-current-notes"
                  rows={2}
                  placeholder="اكتب ملاحظات الطالب في الحصة الحالية (تُحفظ تلقائيًا)..."
                  value={currentNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  onBlur={handleNotesBlur}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 resize-none font-medium"
                />
              </div>

              {/* Previous Session Notes */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>ملاحظات الحصة السابقة</span>
                </span>
                <div className="h-[58px] p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs overflow-y-auto">
                  {previousNotes ? (
                    <p className="text-foreground leading-relaxed font-medium">{previousNotes}</p>
                  ) : (
                    <p className="text-muted-foreground italic">لا توجد ملاحظات مسجلة للحصة السابقة</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {gradeExams && (
        <GradeDialog
          exams={gradeExams}
          sessions={data?.sessions || [session]}
          student={student}
          group={group}
          centerSlug={centerSlug}
          tenantId={tenantId}
          remoteGradesByKey={remoteGradesByKey}
          onSaveUnifiedGrade={onSaveUnifiedGrade}
          onDeleteUnifiedGrade={onDeleteUnifiedGrade}
          onChange={() => setRevision(value => value + 1)}
          onClose={() => setGradeExams(undefined)}
        />
      )}
    </section>
  );
}

interface GradeProps {
  exams: Exam[];
  sessions: Session[];
  student: User;
  group?: Group;
  centerSlug: string;
  tenantId: string;
  remoteGradesByKey?: Record<string, LessonGradeRecord>;
  onSaveUnifiedGrade?: Props['onSaveUnifiedGrade'];
  onDeleteUnifiedGrade?: Props['onDeleteUnifiedGrade'];
  onChange: () => void;
  onClose: () => void;
}

function GradeDialog({
  exams,
  sessions,
  student,
  group,
  centerSlug,
  tenantId,
  remoteGradesByKey,
  onSaveUnifiedGrade,
  onDeleteUnifiedGrade,
  onChange,
  onClose,
}: GradeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeExamRef = useRef<string | undefined>(exams[0]?.id);
  const [examId, setExamId] = useState(exams[0]?.id);
  activeExamRef.current = examId;
  const exam = exams.find(item => item.id === examId);
  const session = sessions.find(item => item.id === exam?.sessionId);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<number>();
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!exam || !session) return;
    try {
      const remoteGrade = remoteGradesByKey?.[lessonGradeDocId(exam.id, student.id)]?.score;
      const grade = remoteGrade ?? readReceptionRecord(tenantId, session.id, student.id).grades[exam.id];
      setValue(grade !== undefined ? formatCleanNumber(grade) : '');
      setSaved(grade);
      setStatus('');
    } catch { setStatus('تعذّر قراءة الدرجة'); }
  }, [exam, session, tenantId, student.id, remoteGradesByKey]);

  async function save(
    input: string,
    remove = false,
    ctxExam: Exam | undefined = exam,
    ctxSession: Session | undefined = session
  ): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!ctxExam || !ctxSession || (!remove && !input.trim())) return true;
    const normalized = input.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace('٫', '.');
    const grade = Number(normalized);
    if (!remove && (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || grade < 0 || grade > ctxExam.totalMarks)) {
      if (activeExamRef.current === ctxExam.id) {
        setStatus(`أدخل درجة من ٠ إلى ${ctxExam.totalMarks} بدقة منزلتين عشريتين`);
      }
      return false;
    }

    if (remove && onDeleteUnifiedGrade) {
      if (activeExamRef.current === ctxExam.id) setStatus('جارٍ الحذف…');
      const res = await onDeleteUnifiedGrade({
        sessionId: ctxSession.id,
        examId: ctxExam.id,
        studentId: student.id,
        source: 'card',
      });
      if (!res.ok) {
        if (activeExamRef.current === ctxExam.id) {
          setStatus(res.errorAr || 'تعذّر الحفظ. أعد المحاولة.');
        }
        return false;
      }
      if (activeExamRef.current === ctxExam.id) {
        setSaved(undefined);
        setValue('');
        setStatus('تم حذف الدرجة');
      }
      onChange();
      return true;
    }

    if (!remove && onSaveUnifiedGrade) {
      if (activeExamRef.current === ctxExam.id) setStatus('جارٍ الحفظ…');
      const res = await onSaveUnifiedGrade({
        sessionId: ctxSession.id,
        examId: ctxExam.id,
        totalMarks: ctxExam.totalMarks,
        studentId: student.id,
        studentIdOrCode: student.studentCode || student.id,
        rawScore: input,
        source: 'card',
      });
      if (!res.ok) {
        if (activeExamRef.current === ctxExam.id) {
          setStatus(`تعذّر الحفظ. ${res.errorAr}`);
        }
        return false;
      }
      if (activeExamRef.current === ctxExam.id) {
        setSaved(res.grade.score);
        setStatus('تم الحفظ');
      }
      onChange();
      return true;
    }

    try {
      const record = readReceptionRecord(tenantId, ctxSession.id, student.id);
      if (remove) delete record.grades[ctxExam.id];
      else record.grades[ctxExam.id] = grade;
      writeReceptionRecord(tenantId, ctxSession.id, student.id, record);
      if (activeExamRef.current === ctxExam.id) {
        setSaved(remove ? undefined : grade);
        if (remove) setValue('');
        setStatus(remove ? 'تم حذف الدرجة' : 'تم الحفظ على هذا المتصفح');
      }
      onChange();
      return true;
    } catch {
      if (activeExamRef.current === ctxExam.id) {
        setStatus('تعذّر الحفظ. أعد المحاولة.');
      }
      return false;
    }
  }

  async function close() {
    if ((!timer.current && !status.startsWith('تعذّر الحفظ')) || (await save(value))) onClose();
  }

  return (
    <dialog ref={dialog} aria-labelledby="reception-grade-title"
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); void close(); }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60">
      <h2 id="reception-grade-title" className="text-lg font-bold">درجة اختبار الحصة</h2>
      <p className="mt-1 text-sm text-muted-foreground">{student.fullName} · {group?.nameAr}</p>
      {session && <p className="text-sm text-muted-foreground">{exam?.subjectNameAr || group?.nameAr} · {session.sessionDate} · {session.startTime}</p>}
      <div className="mt-4 space-y-3">
        {exams.length > 1 && <label className="block text-sm">الاختبار
          <select className="mt-1 block w-full rounded-lg border border-border bg-background p-2"
            value={examId} onChange={event => {
              if (timer.current) {
                void save(value, false, exam, session);
              }
              setConfirmDelete(false);
              setExamId(event.target.value);
            }}>
            {exams.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
        {exam ? <>
          <label className="block text-sm">{exam.title} · الدرجة من {exam.totalMarks}
            <input className="mt-1 block w-full rounded-lg border border-border bg-background p-2"
              inputMode="decimal" value={value} onBlur={() => { if (timer.current) void save(value); }}
              onChange={event => {
                const input = event.target.value;
                const capturedExam = exam;
                const capturedSession = session;
                setValue(input);
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                if (!input.trim()) { setStatus(''); return; }
                setStatus('جارٍ الحفظ…');
                timer.current = setTimeout(() => { void save(input, false, capturedExam, capturedSession); }, 400);
              }} />
          </label>
          <p role="status" className="text-sm text-muted-foreground">{status}</p>
          {status.startsWith('تعذّر الحفظ') && <Button type="button" variant="outline" size="sm" onClick={() => void save(value)}>إعادة المحاولة</Button>}
          {saved !== undefined && !confirmDelete && <Button type="button" variant="outline" size="sm"
            onClick={() => setConfirmDelete(true)}>حذف الدرجة</Button>}
          {confirmDelete && <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>تأكيد حذف درجة الطالب؟</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { void save('', true).then(ok => { if (ok) setConfirmDelete(false); }); }}>تأكيد الحذف</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>إلغاء</Button>
          </div>}
        </> : <p className="text-sm">لا يوجد اختبار لهذه الحصة. <Link className="underline" href={`/center/${centerSlug}/exams`}>فتح الاختبارات</Link></p>}
        <Button type="button" variant="outline" size="sm" onClick={() => void close()}>إغلاق</Button>
      </div>
    </dialog>
  );
}
