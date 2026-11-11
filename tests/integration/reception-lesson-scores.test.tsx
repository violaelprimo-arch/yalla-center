import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonExamScorePanel, type ReceptionEntryMode } from '@/components/attendance/lesson-exam-score-panel';
import { RecentScansFeed, type RecentScanItem } from '@/components/attendance/recent-scans-feed';
import { ReceptionStudentCard } from '@/components/attendance/reception-student-card';
import { BarcodeListener } from '@/components/attendance/barcode-listener';
import { writeReceptionRecord, readReceptionRecord } from '@/lib/attendance/reception';
import {
  formatLessonScoreFraction,
  lessonGradeDocId,
  scanLocalStorageReceptionGrades,
  type LessonExamRecord,
  type LessonGradeRecord,
} from '@/lib/attendance/lesson-scores';
import type {
  GradeSaveState,
  LocalImportReviewRow,
} from '@/lib/attendance/use-lesson-scores';
import type { LocalStorageGradeCandidate } from '@/lib/attendance/lesson-scores';
import { getReceptionDataProvider } from '@/lib/dal/factory';
import type { Group, Session, User } from '@/lib/dal/types';

const tenantId = 'tenant-maher-001';
const clock = '2026-11-11T15:00';

describe('Reception Lesson Exam Score Panel, RecentScansFeed & Single Source of Truth', () => {
  let dal: ReturnType<typeof getReceptionDataProvider>;
  let session: Session;
  let group: Group;
  let enrolledStudents: User[];
  let allUsers: User[];
  let initialExam: LessonExamRecord;

  beforeEach(async () => {
    localStorage.clear();
    vi.stubGlobal('HTMLDialogElement', window.HTMLDialogElement);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });

    dal = getReceptionDataProvider(clock);
    session = (await dal.getSessionById(tenantId, 'reception-demo-2026-11-11'))!;
    group = (await dal.getGroupById(tenantId, session.groupId))!;
    allUsers = await dal.getUsers(tenantId);
    const enrollments = await dal.getEnrollments(tenantId, { groupId: group.id });
    const enrolledIds = new Set(enrollments.filter((e) => e.isActive).map((e) => e.studentId));
    enrolledStudents = allUsers.filter((u) => u.role === 'STUDENT' && enrolledIds.has(u.id));

    initialExam = {
      id: `${session.id}-exam`,
      tenantId,
      branchId: group.branchId,
      sessionId: session.id,
      groupId: group.id,
      subjectId: group.subjectId,
      subjectNameAr: 'الرياضيات',
      teacherId: session.teacherId,
      title: 'اختبار الحصة التجريبي',
      totalMarks: 20,
      passMarks: 10,
      version: 1,
      updatedByUid: 'uid-staff',
      updatedAt: '2026-11-11T12:00:00Z',
      createdAt: '2026-11-11T12:00:00Z',
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    vi.unstubAllGlobals();
  });

  function Harness({
    extraExams = [],
    initialGrades = {},
    simulateSaveBehavior,
    simulateMaxMarksBehavior,
    onAttendanceScan = () => undefined,
    pendingLocalCount = 0,
    onBuildImportReview,
    onCommitImport = async () => ({ ok: true, message: 'ok' }),
  }: {
    extraExams?: LessonExamRecord[];
    initialGrades?: Record<string, LessonGradeRecord>;
    simulateSaveBehavior?: (params: {
      examId: string;
      studentId: string;
      score: number;
    }) => Promise<void>;
    simulateMaxMarksBehavior?: (newMax: number, grades: Record<string, LessonGradeRecord>) => Promise<void>;
    onAttendanceScan?: (code: string) => void;
    pendingLocalCount?: number;
    onBuildImportReview?: () => Promise<LocalImportReviewRow[]>;
    onCommitImport?: (selected: LocalStorageGradeCandidate[]) => Promise<{ ok: boolean; message: string }>;
  }) {
    const [mode, setMode] = React.useState<ReceptionEntryMode>('attendance');
    const [exams, setExams] = React.useState<LessonExamRecord[]>([initialExam, ...extraExams]);
    const [selectedExamId, setSelectedExamId] = React.useState<string>(initialExam.id);
    const [gradesByKey, setGradesByKey] = React.useState<Record<string, LessonGradeRecord>>(initialGrades);
    const [saveStateByKey, setSaveStateByKey] = React.useState<Record<string, GradeSaveState>>({});
    const [incomingScan, setIncomingScan] = React.useState<{ code: string; seq: number } | null>(null);
    const [importReviewRows, setImportReviewRows] = React.useState<LocalImportReviewRow[]>([]);

    const activeExam = exams.find((e) => e.id === selectedExamId) ?? exams[0];
    const gradesForActive = React.useMemo(() => {
      const map: Record<string, LessonGradeRecord> = {};
      if (!activeExam) return map;
      for (const g of Object.values(gradesByKey)) {
        if (g.examId === activeExam.id) map[g.studentId] = g;
      }
      return map;
    }, [activeExam, gradesByKey]);

    const handleSaveMaxMarks = async ({
      examId,
      rawTotalMarks,
    }: {
      sessionId: string;
      examId?: string;
      title?: string;
      rawTotalMarks: string;
    }) => {
      const nextMax = Number(rawTotalMarks);
      const targetId = examId || initialExam.id;
      const highest = Object.values(gradesByKey)
        .filter((g) => g.examId === targetId)
        .reduce((max, g) => Math.max(max, g.score), -1);
      if (highest >= 0 && nextMax < highest) {
        return {
          ok: false as const,
          errorAr: `تعذر خفض الدرجة النهائية إلى ${nextMax} لوجود درجة مسجلة بالفعل (${highest})`,
        };
      }
      if (simulateMaxMarksBehavior) {
        await simulateMaxMarksBehavior(nextMax, gradesByKey);
      }
      let updated!: LessonExamRecord;
      setExams((prev) =>
        prev.map((ex) => {
          if (ex.id !== targetId) return ex;
          updated = { ...ex, totalMarks: nextMax, version: ex.version + 1 };
          return updated;
        })
      );
      return { ok: true as const, exam: updated };
    };

    const handleSaveScore = async (params: {
      sessionId: string;
      examId: string;
      totalMarks: number;
      studentId: string;
      studentIdOrCode: string;
      rawScore: string;
      source: 'panel' | 'feed' | 'card';
    }) => {
      const key = lessonGradeDocId(params.examId, params.studentId);
      const numeric = Number(params.rawScore);
      setSaveStateByKey((prev) => ({
        ...prev,
        [key]: {
          status: 'saving',
          draftValue: params.rawScore,
          message: 'جارٍ الحفظ',
          lastAttempt: { ...params },
        },
      }));

      try {
        if (simulateSaveBehavior) {
          await simulateSaveBehavior({
            examId: params.examId,
            studentId: params.studentId,
            score: numeric,
          });
        }

        const student = enrolledStudents.find((s) => s.id === params.studentId)!;
        const grade: LessonGradeRecord = {
          id: key,
          tenantId,
          branchId: group.branchId,
          sessionId: params.sessionId,
          groupId: group.id,
          teacherId: session.teacherId,
          examId: params.examId,
          studentId: student.id,
          studentCode: student.studentCode || student.id,
          studentName: student.fullName,
          score: numeric,
          totalMarksSnapshot: params.totalMarks,
          version: (gradesByKey[key]?.version ?? 0) + 1,
          recordedByUid: 'uid-recep',
          recordedByName: 'سارة الشافعي',
          recordedByRole: 'RECEPTIONIST',
          source: params.source,
          updatedAt: '2026-11-11T15:05:00Z',
          createdAt: '2026-11-11T15:05:00Z',
        };

        setGradesByKey((prev) => ({ ...prev, [key]: grade }));
        setSaveStateByKey((prev) => ({
          ...prev,
          [key]: { status: 'saved', message: 'تم الحفظ' },
        }));
        return { ok: true as const, grade };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'فشل الاتصال';
        setSaveStateByKey((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            draftValue: params.rawScore,
            message: msg,
            lastAttempt: { ...params },
          },
        }));
        return { ok: false as const, errorAr: msg };
      }
    };

    const scans: RecentScanItem[] = enrolledStudents.map((s, idx) => ({
      id: `att-${idx}`,
      studentId: s.id,
      studentName: s.fullName,
      studentCode: s.studentCode || s.id,
      scannedAt: `2026-11-11T14:5${idx}:00Z`,
      verificationMethod: 'barcode',
      status: 'present',
      balanceDue: s.balanceDue,
    }));

    return (
      <div>
        <BarcodeListener
          onScan={(code) => {
            if (mode === 'grades') {
              setIncomingScan((prev) => ({ code, seq: (prev?.seq ?? 0) + 1 }));
            } else {
              onAttendanceScan(code);
            }
          }}
        />
        <LessonExamScorePanel
          session={session}
          group={group}
          subjectNameAr="الرياضيات"
          enrolledStudents={enrolledStudents}
          allTenantUsers={allUsers}
          mode={mode}
          onModeChange={setMode}
          exams={exams}
          activeExam={activeExam}
          onSelectExam={setSelectedExamId}
          gradesForActiveExamByStudent={gradesForActive}
          saveStateByKey={saveStateByKey}
          audits={[]}
          authProps={{
            configured: true,
            loading: false,
            signedIn: true,
            userEmail: 'sara@almaher.edu.eg',
            staffRoleLabel: 'موظف استقبال',
            onSignIn: async () => undefined,
            onSignOut: async () => undefined,
          }}
          onSaveTotalMarks={handleSaveMaxMarks}
          onSaveScore={handleSaveScore}
          incomingBarcodeScan={incomingScan}
          pendingLocalCount={pendingLocalCount}
          importReviewRows={importReviewRows}
          onOpenImportReview={async () => {
            if (!onBuildImportReview) return [];
            const rows = await onBuildImportReview();
            setImportReviewRows(rows);
            return rows;
          }}
          onCommitImport={onCommitImport}
        />
        <RecentScansFeed
          scans={scans}
          sessionId={session.id}
          activeExam={activeExam}
          gradesByStudent={gradesForActive}
          saveStateByKey={saveStateByKey}
          canEditScores={true}
          onSaveInlineScore={handleSaveScore}
        />
        <ReceptionStudentCard
          tenantId={tenantId}
          student={enrolledStudents[0]}
          session={session}
          group={group}
          centerSlug="al-maher"
          remoteExams={exams}
          remoteGradesByKey={gradesByKey}
          onSaveUnifiedGrade={handleSaveScore}
        />
      </div>
    );
  }

  it('completes full rapid entry -> 17/20 feed display -> inline edit 18/20 -> ReceptionStudentCard performance sync -> focus cycle', async () => {
    render(<Harness />);

    // Initially ungraded shows "لم تُرصد"
    expect(screen.getAllByText('لم تُرصد').length).toBeGreaterThanOrEqual(2);

    const codeInput = screen.getByLabelText('اكتب كود الطالب أو امسح الباركود');
    fireEvent.change(codeInput, { target: { value: 'STD-1001' } });
    fireEvent.submit(codeInput.closest('form')!);

    // Focus immediately moves to score input
    const scoreInput = screen.getByLabelText('درجة الطالب');
    await waitFor(() => expect(document.activeElement).toBe(scoreInput));

    // Enter 17 and press Enter -> saves, shows 17 / 20 in feed, returns focus to code input
    fireEvent.change(scoreInput, { target: { value: '17' } });
    fireEvent.keyDown(scoreInput, { key: 'Enter' });

    await waitFor(() => expect(screen.getAllByText('17 / 20').length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(document.activeElement).toBe(codeInput));

    // Inline row edit in RecentScansFeed for enrolledStudents[0]: change 17 -> 18
    const feedCard = screen.getByText('شريط عمليات الحضور اللحظي').closest('.card-elevated') as HTMLElement;
    const targetStudentRow = within(feedCard)
      .getByText(enrolledStudents[0].fullName)
      .closest('.rounded-2xl') as HTMLElement;
    fireEvent.click(within(targetStudentRow).getByRole('button', { name: 'تعديل الدرجة' }));
    const rowInput = screen.getByLabelText(`درجة ${enrolledStudents[0].fullName}`);
    expect(rowInput).toHaveValue('17');
    fireEvent.change(rowInput, { target: { value: '18' } });
    fireEvent.keyDown(rowInput, { key: 'Enter' });

    await waitFor(() => expect(screen.getAllByText('18 / 20').length).toBeGreaterThanOrEqual(1));

    // Verify ReceptionStudentCard performance updates immediately (single exam -> 18/20 = ٩٠٪)
    await waitFor(() => {
      expect(screen.getAllByText(/٩٠٪/).length).toBeGreaterThanOrEqual(2);
    });

    // Opening student card grade dialog reflects the EXACT same unified value 18
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل درجة اختبار الحصة' }));
    expect(screen.getByRole('textbox', { name: /الدرجة من 20/ })).toHaveValue('18');
  });

  it('supports score 0 display (0 / 20), rejects > maxMarks, rejects lowering maxMarks below saved grade, and detects wrong-group student', async () => {
    render(<Harness />);

    // Enter student from another group (STD-1003) -> error message
    const codeInput = screen.getByLabelText('اكتب كود الطالب أو امسح الباركود');
    fireEvent.change(codeInput, { target: { value: 'STD-1003' } });
    fireEvent.submit(codeInput.closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('غير مقيد في هذه المجموعة');

    // Select enrolled student STD-1001 and enter invalid > totalMarks (25)
    fireEvent.change(codeInput, { target: { value: 'STD-1001' } });
    fireEvent.submit(codeInput.closest('form')!);
    const scoreInput = screen.getByLabelText('درجة الطالب');
    fireEvent.change(scoreInput, { target: { value: '25' } });
    fireEvent.keyDown(scoreInput, { key: 'Enter' });
    expect(screen.getByText(/تتجاوز الدرجة النهائية للاختبار/)).toBeInTheDocument();

    // Now save zero (0) -> displays 0 / 20
    fireEvent.change(scoreInput, { target: { value: '0' } });
    fireEvent.keyDown(scoreInput, { key: 'Enter' });
    await waitFor(() => expect(screen.getAllByText('0 / 20').length).toBeGreaterThanOrEqual(1));

    // Save 18 on STD-1002 and then try lowering totalMarks from 20 -> 15 -> rejected
    fireEvent.change(codeInput, { target: { value: 'STD-1002' } });
    fireEvent.submit(codeInput.closest('form')!);
    const secondScoreInput = screen.getByLabelText('درجة الطالب');
    fireEvent.change(secondScoreInput, { target: { value: '18' } });
    fireEvent.keyDown(secondScoreInput, { key: 'Enter' });
    await waitFor(() => expect(screen.getAllByText('18 / 20').length).toBeGreaterThanOrEqual(1));

    fireEvent.click(screen.getByRole('button', { name: 'تعديل الدرجة النهائية' }));
    const maxInput = screen.getByLabelText('الدرجة النهائية للاختبار');
    fireEvent.change(maxInput, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ النهاية' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('تعذر خفض الدرجة النهائية'));
    expect(screen.getAllByText('18 / 20').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps failed saves in the input with retry button, and preserves exam-switch isolation during slow requests', async () => {
    let shouldFail = true;
    let resolveSlowSave!: () => void;
    let slowMode = false;

    const secondExam: LessonExamRecord = {
      ...initialExam,
      id: `${session.id}-exam-2`,
      title: 'اختبار الحصة الثاني',
      totalMarks: 10,
    };

    render(
      <Harness
        extraExams={[secondExam]}
        simulateSaveBehavior={async () => {
          if (shouldFail) throw new Error('انقطع الاتصال أثناء الحفظ');
          if (slowMode) {
            await new Promise<void>((res) => {
              resolveSlowSave = res;
            });
          }
        }}
      />
    );

    const codeInput = screen.getByLabelText('اكتب كود الطالب أو امسح الباركود');
    fireEvent.change(codeInput, { target: { value: 'STD-1001' } });
    fireEvent.submit(codeInput.closest('form')!);

    const scoreInput = screen.getByLabelText('درجة الطالب');
    fireEvent.change(scoreInput, { target: { value: '16.5' } });
    fireEvent.keyDown(scoreInput, { key: 'Enter' });

    // Failure keeps entered draft "16.5" and shows Retry button in both panel & feed row
    const panel = screen.getByRole('region', { name: 'تسجيل درجات اختبار الحصة' });
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument()
    );
    expect(screen.getAllByRole('button', { name: 'إعادة المحاولة' }).length).toBeGreaterThanOrEqual(2);
    expect(scoreInput).toHaveValue('16.5');

    // Now test slow in-flight save + exam switch race isolation
    shouldFail = false;
    slowMode = true;
    fireEvent.click(within(panel).getByRole('button', { name: 'إعادة المحاولة' }));
    await waitFor(() => expect(within(panel).getByText('جارٍ الحفظ')).toBeInTheDocument());

    // Switch exam dropdown while first save is in flight!
    const examSelect = screen.getByLabelText('اختيار اختبار الحصة');
    fireEvent.change(examSelect, { target: { value: secondExam.id } });

    // Complete first save while secondExam is currently active
    resolveSlowSave();
    await waitFor(() => {
      // Second exam still has NO score for STD-1001 ("لم تُرصد"), not overwritten!
      expect(screen.getAllByText('لم تُرصد').length).toBeGreaterThanOrEqual(2);
    });

    // Switch back to initialExam -> confirmed 16.5 / 20 persisted cleanly!
    fireEvent.change(examSelect, { target: { value: initialExam.id } });
    await waitFor(() => expect(screen.getAllByText('16.5 / 20').length).toBeGreaterThanOrEqual(1));
  });

  it('prevents hardware barcode scans in Grade Entry Mode from triggering attendance check-in', async () => {
    const attendanceSpy = vi.fn();
    render(<Harness onAttendanceScan={attendanceSpy} />);

    // Activate Grade Entry Mode
    fireEvent.click(screen.getByRole('button', { name: 'وضع تسجيل الدرجات' }));

    // Simulate sub-60ms laser barcode burst anywhere on window outside inputs
    let t = 1000;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
      t += 15;
      return t;
    });

    for (const ch of 'STD-1001') {
      fireEvent.keyDown(document.body, { key: ch });
    }
    fireEvent.keyDown(document.body, { key: 'Enter' });
    nowSpy.mockRestore();

    // Grade panel selects STD-1001, attendance spy is NEVER called!
    await waitFor(() => expect(screen.getByLabelText('درجة الطالب')).toBeInTheDocument());
    expect(attendanceSpy).not.toHaveBeenCalled();
  });

  it('non-destructively scans existing localStorage demo scores for review before Firestore import', () => {
    writeReceptionRecord(tenantId, session.id, enrolledStudents[0].id, {
      homework: true,
      grades: { [initialExam.id]: 19 },
    });

    const candidates = scanLocalStorageReceptionGrades(tenantId);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].score).toBe(19);
    // Original localStorage record stays untouched
    expect(readReceptionRecord(tenantId, session.id, enrolledStudents[0].id)).toEqual({
      homework: true,
      grades: { [initialExam.id]: 19 },
    });
    expect(formatLessonScoreFraction(0, 20)).toBe('0 / 20');
    expect(formatLessonScoreFraction(undefined, 20)).toBe('لم تُرصد');
  });

  it('allows reviewing eligible vs ineligible localStorage scores in UI modal and confirming import without erasing localStorage', async () => {
    const eligibleCandidate: LocalStorageGradeCandidate = {
      storageKey: `yc-reception:${tenantId}:${session.id}:${enrolledStudents[0].id}`,
      tenantId,
      sessionId: session.id,
      studentId: enrolledStudents[0].id,
      examId: initialExam.id,
      score: 19,
    };
    const ineligibleCandidate: LocalStorageGradeCandidate = {
      storageKey: `yc-reception:${tenantId}:other-session:unknown-student`,
      tenantId,
      sessionId: 'other-session',
      studentId: 'unknown-student',
      examId: 'other-exam',
      score: 12,
    };

    writeReceptionRecord(tenantId, session.id, enrolledStudents[0].id, {
      homework: true,
      grades: { [initialExam.id]: 19 },
    });

    const commitSpy = vi.fn(async (selected: LocalStorageGradeCandidate[]) => ({
      ok: true,
      message: `تم استيراد ${selected.length} درجة بنجاح`,
    }));

    render(
      <Harness
        pendingLocalCount={2}
        onBuildImportReview={async () => [
          {
            candidate: eligibleCandidate,
            studentName: enrolledStudents[0].fullName,
            studentCode: enrolledStudents[0].studentCode,
            examTitle: initialExam.title,
            sessionDate: session.sessionDate,
            totalMarks: initialExam.totalMarks,
            eligible: true,
            reasonAr: 'مؤهل للاستيراد بعد التحقق من القيد والدرجة النهائية',
          },
          {
            candidate: ineligibleCandidate,
            studentName: 'طالب غير معروف',
            studentCode: 'N/A',
            examTitle: 'اختبار آخر',
            sessionDate: '2026-10-01',
            totalMarks: 20,
            eligible: false,
            reasonAr: 'الطالب غير مقيد في المجموعة أو الاختبار غير مرتبط بهذه الحصة',
          },
        ]}
        onCommitImport={commitSpy}
      />
    );

    expect(screen.getByText('توجد 2 درجة محفوظة محلياً في المتصفح')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'مراجعة قبل الاستيراد' }));

    await waitFor(() =>
      expect(screen.getByText('مؤهل للاستيراد بعد التحقق من القيد والدرجة النهائية')).toBeInTheDocument()
    );
    expect(
      screen.getByText('الطالب غير مقيد في المجموعة أو الاختبار غير مرتبط بهذه الحصة')
    ).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeEnabled();
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'استيراد المحدد إلى Firestore' }));
    await waitFor(() => expect(commitSpy).toHaveBeenCalledTimes(1));
    expect(commitSpy).toHaveBeenCalledWith([eligibleCandidate]);
    expect(screen.getByText('تم استيراد 1 درجة بنجاح')).toBeInTheDocument();

    // Non-destructive guarantee: localStorage still retains original data
    expect(readReceptionRecord(tenantId, session.id, enrolledStudents[0].id)?.grades?.[initialExam.id]).toBe(19);
  });
});
