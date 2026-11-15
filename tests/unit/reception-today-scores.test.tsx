import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receptionSessionState, summarizeReception, readReceptionRecord, writeReceptionRecord } from '@/lib/attendance/reception';
import { SessionSelector } from '@/components/attendance/session-selector';
import { LessonExamScorePanel } from '@/components/attendance/lesson-exam-score-panel';
import { ReceptionStudentCard } from '@/components/attendance/reception-student-card';
import { getReceptionDataProvider } from '@/lib/dal/factory';
import type { Session, Group, User, Exam, Attendance, Enrollment } from '@/lib/dal/types';
import type { LessonExamRecord, LessonGradeRecord } from '@/lib/attendance/lesson-scores';

const tenantId = 'tenant-maher-001';
const clockToday = '2026-11-15T15:00:00'; // Cairo: Nov 15, 2026

describe('Reception: Today Filtering, Fast Enter Scores & Unified Single Card', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('HTMLDialogElement', window.HTMLDialogElement);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = true; },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // Requirement 1: Cairo Today Only Session Filtering
  // =========================================================================
  describe('1. Cairo Today Only Session Filtering', () => {
    const baseSession: Session = {
      id: 'sess-today',
      tenantId,
      groupId: 'grp-math',
      branchId: 'branch-1',
      teacherId: 'teacher-1',
      sessionDate: '2026-11-15',
      startTime: '16:00',
      endTime: '18:00',
      status: 'scheduled',
      createdAt: '2026-11-01T00:00:00Z',
    };

    it('returns "upcoming" for future session later today, "current" for ongoing, null for finished and future days', () => {
      // 1. Later today (at 15:00, starts at 16:00) -> upcoming
      expect(receptionSessionState(baseSession, '2026-11-15T15:00:00')).toBe('upcoming');

      // 2. Ongoing today (at 16:30, between 16:00 and 18:00) -> current
      expect(receptionSessionState(baseSession, '2026-11-15T16:30:00')).toBe('current');

      // 3. Finished today (at 18:01) -> null
      expect(receptionSessionState(baseSession, '2026-11-15T18:01:00')).toBeNull();

      // 4. Session scheduled on a future date (e.g. Nov 17 or Nov 21) -> null (hidden!)
      const futureSession: Session = {
        ...baseSession,
        id: 'sess-nov-17',
        sessionDate: '2026-11-17',
        startTime: '10:00',
        endTime: '13:00',
      };
      expect(receptionSessionState(futureSession, '2026-11-15T15:00:00')).toBeNull();

      // 5. Canceled or completed session -> null
      expect(receptionSessionState({ ...baseSession, status: 'canceled' }, '2026-11-15T16:30:00')).toBeNull();
      expect(receptionSessionState({ ...baseSession, status: 'completed' }, '2026-11-15T16:30:00')).toBeNull();
    });

    it('renders exact message "لا توجد حصص حالية أو قادمة اليوم" when no sessions match today', () => {
      render(
        <SessionSelector
          branches={[{ id: 'branch-1', tenantId, nameAr: 'الفرع الرئيسي', isActive: true, createdAt: '2026-11-01T00:00:00Z' }]}
          selectedBranchId="ALL"
          onSelectBranch={() => {}}
          sessions={[]}
          clock={clockToday}
          groups={[]}
          classrooms={[]}
          teachers={[]}
          selectedSessionId={null}
          onSelectSession={() => {}}
        />
      );

      expect(screen.getByText('لا توجد حصص حالية أو قادمة اليوم')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Requirement 2: Fast Lesson Exam Score Entry by Code + Enter
  // =========================================================================
  describe('2. Fast Lesson Exam Score Entry by Code + Enter', () => {
    function SetupPanelHarness({ onSaveMock }: { onSaveMock?: (params: any) => Promise<any> }) {
      const activeExam: LessonExamRecord = {
        id: 'exam-sess-today',
        tenantId,
        branchId: 'branch-1',
        sessionId: 'sess-today',
        groupId: 'grp-math',
        subjectId: 'sub-math',
        subjectNameAr: 'الرياضيات',
        teacherId: 'teacher-1',
        title: 'اختبار الحصة',
        totalMarks: 20,
        passMarks: 10,
        version: 1,
        updatedByUid: 'uid-admin',
        createdAt: '2026-11-15T12:00:00Z',
        updatedAt: '2026-11-15T12:00:00Z',
      };

      const students: User[] = [
        {
          id: 'std-1',
          tenantId,
          role: 'STUDENT',
          fullName: 'زياد طارق',
          studentCode: 'STD-1001',
          balanceDue: 0,
          isActive: true,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'std-2',
          tenantId,
          role: 'STUDENT',
          fullName: 'مريم محمود',
          studentCode: 'STD-1002',
          balanceDue: 150,
          isActive: true,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ];

      const [gradesByStudent, setGradesByStudent] = React.useState<Record<string, LessonGradeRecord>>({});
      const [saveStateByKey, setSaveStateByKey] = React.useState<Record<string, any>>({});

      const defaultSave = async (params: any) => {
        const num = Number(params.rawScore);
        const gradeRec: LessonGradeRecord = {
          id: `${params.examId}_${params.studentId}`,
          tenantId,
          branchId: 'branch-1',
          sessionId: params.sessionId,
          groupId: 'grp-math',
          teacherId: 'teacher-1',
          examId: params.examId,
          studentId: params.studentId,
          studentCode: params.studentIdOrCode,
          studentName: students.find(s => s.id === params.studentId)?.fullName || '',
          score: num,
          totalMarksSnapshot: params.totalMarks,
          version: 1,
          recordedByUid: 'uid-staff',
          recordedByName: 'موظف الاستقبال',
          recordedByRole: 'RECEPTIONIST',
          source: 'panel',
          updatedAt: '2026-11-15T15:05:00Z',
          createdAt: '2026-11-15T15:05:00Z',
        };
        setGradesByStudent(prev => ({ ...prev, [params.studentId]: gradeRec }));
        setSaveStateByKey(prev => ({ ...prev, [gradeRec.id]: { status: 'saved', message: 'تم الحفظ' } }));
        if (onSaveMock) await onSaveMock(params);
        return { ok: true as const, grade: gradeRec };
      };

      return (
        <LessonExamScorePanel
          session={{
            id: 'sess-today',
            tenantId,
            groupId: 'grp-math',
            branchId: 'branch-1',
            teacherId: 'teacher-1',
            sessionDate: '2026-11-15',
            startTime: '16:00',
            endTime: '18:00',
            status: 'scheduled',
            createdAt: '2026-11-01T00:00:00Z',
          }}
          enrolledStudents={students}
          allTenantUsers={students}
          mode="grades"
          onModeChange={() => {}}
          exams={[activeExam]}
          activeExam={activeExam}
          onSelectExam={() => {}}
          gradesForActiveExamByStudent={gradesByStudent}
          saveStateByKey={saveStateByKey}
          audits={[]}
          authProps={{
            configured: false,
            loading: false,
            signedIn: false,
            onSignIn: async () => {},
            onSignOut: async () => {},
          }}
          onSaveTotalMarks={async () => ({ ok: true as const, exam: activeExam })}
          onSaveScore={defaultSave}
          pendingLocalCount={0}
          importReviewRows={[]}
          onOpenImportReview={async () => []}
          onCommitImport={async () => ({ ok: true, message: 'ok' })}
        />
      );
    }

    it('completes rapid consecutive entry for 2 students with Enter key, accepts 0, and returns focus to code input', async () => {
      const savedCalls: any[] = [];
      render(<SetupPanelHarness onSaveMock={async (p) => savedCalls.push(p)} />);

      const codeInput = screen.getByLabelText('اكتب كود الطالب أو امسح الباركود');
      const scoreInput = screen.getByLabelText('درجة الطالب');

      // 1. First student STD-1001: Type code and press Enter
      fireEvent.change(codeInput, { target: { value: 'STD-1001' } });
      fireEvent.keyDown(codeInput, { key: 'Enter' });

      // Student name is displayed and score input is focused
      expect(screen.getByText('زياد طارق')).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(scoreInput));

      // Type score 18 and press Enter -> saves immediately!
      fireEvent.change(scoreInput, { target: { value: '18' } });
      fireEvent.keyDown(scoreInput, { key: 'Enter' });

      // Save confirmation appears, fields cleared, and focus returned to code input
      await waitFor(() => expect(screen.getByText(/تم حفظ درجة الطالب زياد طارق/)).toBeInTheDocument());
      expect(codeInput).toHaveValue('');
      await waitFor(() => expect(document.activeElement).toBe(codeInput));

      // 2. Second student STD-1002: Type code and press Enter
      fireEvent.change(codeInput, { target: { value: 'STD-1002' } });
      fireEvent.keyDown(codeInput, { key: 'Enter' });

      expect(screen.getByText('مريم محمود')).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(scoreInput));

      // Type score 0 (valid score!) and press Enter -> saves immediately!
      fireEvent.change(scoreInput, { target: { value: '0' } });
      fireEvent.keyDown(scoreInput, { key: 'Enter' });

      await waitFor(() => expect(screen.getByText(/تم حفظ درجة الطالب مريم محمود/)).toBeInTheDocument());
      expect(codeInput).toHaveValue('');
      await waitFor(() => expect(document.activeElement).toBe(codeInput));

      expect(savedCalls.length).toBe(2);
      expect(savedCalls[0].rawScore).toBe('18');
      expect(savedCalls[1].rawScore).toBe('0');
    });

    it('rejects out of range score (> totalMarks) and displays Arabic error without clearing fields', async () => {
      render(<SetupPanelHarness />);

      const codeInput = screen.getByLabelText('اكتب كود الطالب أو امسح الباركود');
      const scoreInput = screen.getByLabelText('درجة الطالب');

      fireEvent.change(codeInput, { target: { value: 'STD-1001' } });
      fireEvent.keyDown(codeInput, { key: 'Enter' });

      // Type score 25 (exam max is 20)
      fireEvent.change(scoreInput, { target: { value: '25' } });
      fireEvent.keyDown(scoreInput, { key: 'Enter' });

      expect(await screen.findByText(/الدرجة \(25\) تتجاوز الدرجة النهائية للاختبار \(20\)/)).toBeInTheDocument();
      // Inputs remain for user correction
      expect(scoreInput).toHaveValue('25');
    });
  });

  // =========================================================================
  // Requirement 3: Unified Single Card with Notes & Subject Scoping
  // =========================================================================
  describe('3. Unified Single Card with Notes & Subject-Scoped Performance', () => {
    it('isolates performance strictly to current subject (ignores other subjects)', () => {
      const sessionMath: Session = {
        id: 'sess-math',
        tenantId,
        groupId: 'grp-math',
        subjectId: 'sub-math',
        branchId: 'branch-1',
        teacherId: 'teacher-math',
        sessionDate: '2026-11-15',
        startTime: '10:00',
        endTime: '12:00',
        status: 'scheduled',
        createdAt: '2026-11-01T00:00:00Z',
      };

      const enrollment: Enrollment = {
        id: 'enr-1',
        tenantId,
        groupId: 'grp-math',
        studentId: 'std-1',
        enrolledAt: '2026-11-01T00:00:00Z',
        isActive: true,
        pricingModel: 'per_session',
        discountType: 'none',
        discountValue: 0,
      };

      const mathPrevious: Session = {
        id: 'sess-math-prev',
        tenantId,
        groupId: 'grp-math',
        subjectId: 'sub-math',
        branchId: 'branch-1',
        teacherId: 'teacher-math',
        sessionDate: '2026-11-10',
        startTime: '10:00',
        endTime: '12:00',
        status: 'completed',
        createdAt: '2026-11-01T00:00:00Z',
      };

      const physicsSession: Session = {
        id: 'sess-phys',
        tenantId,
        groupId: 'grp-physics',
        subjectId: 'sub-physics',
        branchId: 'branch-1',
        teacherId: 'teacher-phys',
        sessionDate: '2026-11-12',
        startTime: '10:00',
        endTime: '12:00',
        status: 'completed',
        createdAt: '2026-11-01T00:00:00Z',
      };

      const mathExam: Exam = {
        id: 'exam-math-1',
        tenantId,
        groupId: 'grp-math',
        subjectId: 'sub-math',
        sessionId: 'sess-math-prev',
        teacherId: 'teacher-math',
        title: 'اختبار الرياضيات',
        durationMinutes: 15,
        totalMarks: 20,
        passMarks: 10,
        isAiGenerated: false,
        groundedMaterialIds: [],
        status: 'published',
        createdAt: '2026-11-10T00:00:00Z',
      };

      const physicsExam: Exam = {
        id: 'exam-phys-1',
        tenantId,
        groupId: 'grp-physics',
        subjectId: 'sub-physics',
        sessionId: 'sess-phys',
        teacherId: 'teacher-phys',
        title: 'اختبار الفيزياء',
        durationMinutes: 15,
        totalMarks: 50,
        passMarks: 25,
        isAiGenerated: false,
        groundedMaterialIds: [],
        status: 'published',
        createdAt: '2026-11-12T00:00:00Z',
      };

      const attendance: Attendance[] = [
        {
          id: 'att-1',
          tenantId,
          sessionId: 'sess-math-prev',
          studentId: 'std-1',
          status: 'present',
          scannedAt: '2026-11-10T10:05:00Z',
          verificationMethod: 'barcode',
        },
        {
          id: 'att-2',
          tenantId,
          sessionId: 'sess-phys',
          studentId: 'std-1',
          status: 'absent',
          scannedAt: '2026-11-12T10:05:00Z',
          verificationMethod: 'manual',
        },
      ];

      // Score 18/20 in Math, 0 in Physics
      const manualGrades = (exam: Exam) => {
        if (exam.id === 'exam-math-1') return 18;
        if (exam.id === 'exam-phys-1') return 0;
        return undefined;
      };

      const summary = summarizeReception(
        sessionMath,
        enrollment,
        [sessionMath, mathPrevious, physicsSession],
        attendance,
        [mathExam, physicsExam],
        [],
        manualGrades,
        clockToday
      );

      // Math performance: classScores = [90%], comprehensive = null, attendance = [100%] -> avg = 95%
      // Physics (0%) was strictly filtered out!
      expect(summary.previous).toBe('present');
      expect(summary.monthlyAbsences).toBe(0);
      expect(summary.performance).toBe(95);
    });

    it('renders single card with student avatar, balance alert, homework toggle, exam grade, and notes', async () => {
      const dal = getReceptionDataProvider('2026-11-11T15:00');
      const session = (await dal.getSessionById(tenantId, 'reception-demo-2026-11-11'))!;
      const student = (await dal.getUsers(tenantId)).find(user => user.id === 'user-student-1001')!;

      // Seed previous session note in localStorage
      writeReceptionRecord(tenantId, 'reception-demo-2026-11-10', student.id, {
        grades: {},
        notes: 'ملاحظة: يحتاج متابعة في حل الواجب',
      });

      render(
        <ReceptionStudentCard
          tenantId={tenantId}
          student={{ ...student, balanceDue: 350, seatNumber: '5001' }}
          session={session}
          centerSlug="al-maher"
          onQuickPayClick={() => {}}
        />
      );

      // Single card contains:
      // 1. Identity & Attendance & Seat
      expect(await screen.findByText(student.fullName)).toBeInTheDocument();
      expect(screen.getByText('حضور مؤكد')).toBeInTheDocument();
      expect(screen.getByText('مقعد رقم: 5001')).toBeInTheDocument();

      // 2. Financial alert banner
      expect(screen.getByText('تنبيه المستحقات المالية')).toBeInTheDocument();
      expect(screen.getByText(/مطلوب سداد: 350.00 ج.م/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'تحصيل فوري الآن' })).toBeInTheDocument();

      // 3. Homework toggle switch auto-saves
      const hwSwitch = screen.getByRole('switch', { name: 'تسليم واجب الحصة' });
      fireEvent.click(hwSwitch);
      expect(hwSwitch).toHaveAttribute('aria-checked', 'true');
      expect(readReceptionRecord(tenantId, session.id, student.id).homework).toBe(true);

      // 4. Notes: displays previous session note and edits current note
      expect(screen.getByText('ملاحظات الحصة السابقة')).toBeInTheDocument();
      expect(screen.getByText('ملاحظة: يحتاج متابعة في حل الواجب')).toBeInTheDocument();

      const currentNotesArea = screen.getByLabelText('ملاحظات الحصة الحالية');
      fireEvent.change(currentNotesArea, { target: { value: 'أداء متميز في التفاعل الصفي' } });
      fireEvent.blur(currentNotesArea);

      expect(readReceptionRecord(tenantId, session.id, student.id).notes).toBe('أداء متميز في التفاعل الصفي');
      expect(await screen.findByText('تم الحفظ')).toBeInTheDocument();
    });
  });
});
