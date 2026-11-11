'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import { readReceptionRecord, summarizeReception, writeReceptionRecord } from '@/lib/attendance/reception';
import type { Attendance, Enrollment, Exam, ExamSubmission, Group, Session, User } from '@/lib/dal/types';

interface Props {
  tenantId: string;
  student: User;
  session: Session;
  group?: Group;
  centerSlug: string;
}

interface StudentData {
  enrollment: Enrollment;
  sessions: Session[];
  attendance: Attendance[];
  exams: Exam[];
  submissions: ExamSubmission[];
}

const previousLabels = {
  present: 'حاضر', late: 'حاضر متأخر', absent: 'غائب', excused: 'بعذر',
  unrecorded: 'غير مسجل', none: 'لا توجد حصة سابقة',
};

const percentage = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1, style: 'percent' });
function formatPercentage(value: number | null) {
  return value === null ? 'بيانات غير كافية' : percentage.format(value / 100);
}

export function ReceptionStudentCard({ tenantId, student, session, group, centerSlug }: Props) {
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState('');
  const [homework, setHomework] = useState<boolean>();
  const [, setRevision] = useState(0);
  const [gradeExams, setGradeExams] = useState<Exam[]>();
  const studentId = student.id;
  const { id: sessionId, groupId } = session;

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
      setHomework(readReceptionRecord(tenantId, sessionId, studentId).homework);
    }).catch(() => { if (active) setError('تعذّر تحميل تفاصيل الطالب'); });
    return () => { active = false; };
  }, [tenantId, groupId, sessionId, studentId, student.tenantId, student.role]);

  const { summary, history } = (() => {
    if (!data) return { summary: null, history: [] };
    try {
      const records = new Map(data.sessions.map(item =>
        [item.id, readReceptionRecord(tenantId, item.id, studentId)]));
      const manualGrade = (exam: Exam) => exam.sessionId ? records.get(exam.sessionId)?.grades[exam.id] : undefined;
      return {
        summary: summarizeReception(session, data.enrollment, data.sessions, data.attendance,
          data.exams, data.submissions, manualGrade),
        history: data.exams.filter(exam => exam.sessionId !== sessionId && manualGrade(exam) !== undefined),
      };
    } catch {
      return { summary: null, history: [] };
    }
  })();

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

  return (
    <section aria-label="متابعة الطالب" className="card-elevated rounded-2xl border border-border p-4 space-y-3">
      <h2 className="font-bold">متابعة {student.fullName}</h2>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <p role="status" className="text-sm">جارٍ تحميل تفاصيل الطالب…</p>}
      {data && <>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">الحصة السابقة</dt>
            <dd className="font-bold">{summary ? previousLabels[summary.previous] : 'غير متاح'}</dd></div>
          <div><dt className="text-muted-foreground">غياب الشهر في المجموعة</dt>
            <dd className="font-bold">{summary?.monthlyAbsences ?? 'غير متاح'}</dd></div>
          <div><dt className="text-muted-foreground">متوسط الأداء</dt>
            <dd className="font-bold">{formatPercentage(summary?.performance ?? null)}</dd></div>
          <div><dt className="text-muted-foreground">واجب الحصة الحالية</dt>
            <dd className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" role="switch" aria-label="تسليم واجب الحصة"
                aria-checked={homework === true} onClick={() => saveHomework(homework !== true)} variant={homework ? 'cyan' : 'outline'}>
                {homework === undefined ? 'لم يُسجّل بعد' : homework ? 'تم التسليم' : 'لم يتم التسليم'}
              </Button>
              {homework === undefined && <Button type="button" size="sm" variant="outline"
                onClick={() => saveHomework(false)}>لم يتم التسليم</Button>}
            </dd>
          </div>
        </dl>
        {summary && <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">تفاصيل متوسط الأداء</summary>
          <ul className="space-y-1 mt-1">
            {['اختبارات الحصص', 'امتحانات الشامل', 'الحضور'].map((label, index) =>
              <li key={label}>{label} · {formatPercentage(summary.components[index])}</li>)}
          </ul>
        </details>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="cyan" onClick={() => setGradeExams(data.exams.filter(exam => exam.sessionId === sessionId && exam.status !== 'archived'))}>
            تسجيل درجة اختبار الحصة
          </Button>
          {history.length > 0 && <Button type="button" size="sm" variant="outline" onClick={() => setGradeExams(history)}>
            تعديل درجات الحصص السابقة
          </Button>}
        </div>
        {gradeExams && <GradeDialog
          exams={gradeExams}
          sessions={data.sessions} student={student} group={group} centerSlug={centerSlug} tenantId={tenantId}
          onChange={() => setRevision(value => value + 1)} onClose={() => setGradeExams(undefined)} />}
      </>}
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
  onChange: () => void;
  onClose: () => void;
}

function GradeDialog({ exams, sessions, student, group, centerSlug, tenantId, onChange, onClose }: GradeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [examId, setExamId] = useState(exams[0]?.id);
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
      const grade = readReceptionRecord(tenantId, session.id, student.id).grades[exam.id];
      setValue(grade?.toString() ?? '');
      setSaved(grade);
      setStatus('');
    } catch { setStatus('تعذّر قراءة الدرجة'); }
  }, [exam, session, tenantId, student.id]);

  function save(input: string, remove = false) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!exam || !session || (!remove && !input.trim())) return true;
    const normalized = input.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace('٫', '.');
    const grade = Number(normalized);
    if (!remove && (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || grade < 0 || grade > exam.totalMarks)) {
      setStatus(`أدخل درجة من ٠ إلى ${exam.totalMarks} بدقة منزلتين عشريتين`);
      return false;
    }
    try {
      const record = readReceptionRecord(tenantId, session.id, student.id);
      if (remove) delete record.grades[exam.id];
      else record.grades[exam.id] = grade;
      writeReceptionRecord(tenantId, session.id, student.id, record);
      setSaved(remove ? undefined : grade);
      if (remove) setValue('');
      setStatus(remove ? 'تم حذف الدرجة' : 'تم الحفظ على هذا المتصفح');
      onChange();
      return true;
    } catch {
      setStatus('تعذّر الحفظ. أعد المحاولة.');
      return false;
    }
  }

  function close() {
    if ((!timer.current && !status.startsWith('تعذّر الحفظ')) || save(value)) onClose();
  }

  return (
    <dialog ref={dialog} aria-labelledby="reception-grade-title"
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); close(); }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60">
      <h2 id="reception-grade-title" className="text-lg font-bold">درجة اختبار الحصة</h2>
      <p className="mt-1 text-sm text-muted-foreground">{student.fullName} · {group?.nameAr}</p>
      {session && <p className="text-sm text-muted-foreground">{exam?.subjectNameAr || group?.nameAr} · {session.sessionDate} · {session.startTime}</p>}
      <div className="mt-4 space-y-3">
        {exams.length > 1 && <label className="block text-sm">الاختبار
          <select className="mt-1 block w-full rounded-lg border border-border bg-background p-2"
            value={examId} onChange={event => {
              if (timer.current && !save(value)) return;
              setConfirmDelete(false);
              setExamId(event.target.value);
            }}>
            {exams.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
        {exam ? <>
          <label className="block text-sm">{exam.title} · الدرجة من {exam.totalMarks}
            <input className="mt-1 block w-full rounded-lg border border-border bg-background p-2"
              inputMode="decimal" value={value} onBlur={() => { if (timer.current) save(value); }}
              onChange={event => {
                const input = event.target.value;
                setValue(input);
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                if (!input.trim()) { setStatus(''); return; }
                setStatus('جارٍ الحفظ…');
                timer.current = setTimeout(() => save(input), 400);
              }} />
          </label>
          <p role="status" className="text-sm text-muted-foreground">{status}</p>
          {status.startsWith('تعذّر الحفظ') && <Button type="button" variant="outline" size="sm" onClick={() => save(value)}>إعادة المحاولة</Button>}
          {saved !== undefined && !confirmDelete && <Button type="button" variant="outline" size="sm"
            onClick={() => setConfirmDelete(true)}>حذف الدرجة</Button>}
          {confirmDelete && <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>تأكيد حذف درجة الطالب؟</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { if (save('', true)) setConfirmDelete(false); }}>تأكيد الحذف</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>إلغاء</Button>
          </div>}
        </> : <p className="text-sm">لا يوجد اختبار لهذه الحصة. <Link className="underline" href={`/center/${centerSlug}/exams`}>فتح الاختبارات</Link></p>}
        <Button type="button" variant="outline" size="sm" onClick={close}>إغلاق</Button>
      </div>
    </dialog>
  );
}
