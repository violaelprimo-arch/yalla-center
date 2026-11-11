'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  QrCode,
  Camera,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getReceptionDataProvider as getDataProvider } from '@/lib/dal/factory';
import {
  Session,
  Group,
  Branch,
  Classroom,
  User,
  Attendance,
  SessionAttendanceStats,
} from '@/lib/dal/types';
import {
  playSuccessChime,
  playWarningChime,
  playErrorChime,
  getMuted,
  toggleMuted,
} from '@/lib/attendance/audio';
import { BarcodeListener } from '@/components/attendance/barcode-listener';
import { CameraQrScanner } from '@/components/attendance/camera-qr-scanner';
import { VerificationHud, HudScanData } from '@/components/attendance/verification-hud';
import { QuickPaymentModal } from '@/components/attendance/quick-payment-modal';
import { SessionSelector } from '@/components/attendance/session-selector';
import { LiveStatsRing } from '@/components/attendance/live-stats-ring';
import { ManualCheckinTable } from '@/components/attendance/manual-checkin-table';
import { cairoClock, receptionSessionState, sessionStart } from '@/lib/attendance/reception';
import { ReceptionStudentCard } from '@/components/attendance/reception-student-card';
import { RecentScansFeed, RecentScanItem } from '@/components/attendance/recent-scans-feed';
import {
  LessonExamScorePanel,
  type ReceptionEntryMode,
} from '@/components/attendance/lesson-exam-score-panel';
import { useReceptionLessonScores } from '@/lib/attendance/use-lesson-scores';

export default function ReceptionScanPage() {
  const { tenant, currentRole } = useTenant();

  // Master Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<User[]>([]);

  // Active Selections
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<ReceptionEntryMode>('attendance');
  const [incomingGradeScan, setIncomingGradeScan] = useState<{ code: string; seq: number } | null>(null);
  const [clock, setClock] = useState(cairoClock);
  const visibleSessions = useMemo(() => sessions.filter(session =>
    receptionSessionState(session, clock) && (selectedBranchId === 'ALL' ||
      groups.some(group => group.id === session.groupId && group.branchId === selectedBranchId)))
    .sort((a, b) => sessionStart(a).localeCompare(sessionStart(b))), [sessions, groups, selectedBranchId, clock]);
  const cairoDate = clock.slice(0, 10);
  const selectedSession = visibleSessions.find(session => session.id === selectedSessionId) ??
    (selectedSessionId === null ? visibleSessions[0] : undefined);
  const selectedGroup = groups.find(group => group.id === selectedSession?.groupId);
  const selectedSubjectName = subjects.find((s) => s.id === selectedGroup?.subjectId)?.nameAr;
  const canRecordAttendance = ['CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'].includes(currentRole);
  const canEditScores = ['CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'TEACHER'].includes(currentRole);

  const lessonScores = useReceptionLessonScores({
    tenantId: tenant.id,
    centerSlug: tenant.slug,
    selectedSession,
    selectedGroup,
    sessions,
    groups,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(cairoClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Live Attendance & Stats
  const [sessionAttendance, setSessionAttendance] = useState<Attendance[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionAttendanceStats | null>(null);
  const statsRequest = useRef(0);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);

  // HUD & Scanner State
  const [hudData, setHudData] = useState<HudScanData>({ state: 'idle' });
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);

  // Quick Payment Modal
  const [paymentStudent, setPaymentStudent] = useState<User | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Load initial mute state
  useEffect(() => {
    setIsMuted(getMuted());
  }, []);

  const handleToggleMute = () => {
    const next = toggleMuted();
    setIsMuted(next);
  };

  // Load Tenant Foundation Data
  const loadTenantData = useCallback(async () => {
    const dal = getDataProvider();
    try {
      const [brs, cls, grps, sess, users, subs] = await Promise.all([
        dal.getBranches(tenant.id),
        dal.getClassrooms(tenant.id),
        dal.getGroups(tenant.id),
        dal.getSessions(tenant.id),
        dal.getUsers(tenant.id),
        dal.getSubjects(tenant.id),
      ]);

      setBranches(brs);
      setClassrooms(cls);
      setGroups(grps);
      setSessions(sess);
      setAllUsers(users);
      setTeachers(users.filter((u) => u.role === 'TEACHER'));
      setSubjects(subs.map((s) => ({ id: s.id, nameAr: s.nameAr })));

    } catch {
      // transient load error
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadTenantData();
  }, [loadTenantData, cairoDate]);

  // Load Session-Specific Data (Attendance & Enrolled Students)
  const refreshSessionData = useCallback(async () => {
    const request = ++statsRequest.current;
    if (!selectedSession) return;
    const dal = getDataProvider();

    try {
      const [stats, atts, enrollments, allUsers] = await Promise.all([
        dal.getSessionAttendanceStats(tenant.id, selectedSession.id),
        dal.getSessionAttendance(selectedSession.id),
        dal.getEnrollments(tenant.id, { groupId: selectedSession.groupId }),
        dal.getUsers(tenant.id, { role: 'STUDENT' }),
      ]);

      if (request !== statsRequest.current) return;
      setSessionStats(stats);
      setSessionAttendance(atts);

      // Enrolled students in this group
      const enrolledIds = new Set(enrollments.filter((e) => e.isActive).map((e) => e.studentId));
      const activeEnrolled = allUsers.filter((u) => enrolledIds.has(u.id));
      setEnrolledStudents(activeEnrolled);

      // Populate recent scans feed from stats records
      if (stats.records) {
        const scansList: RecentScanItem[] = stats.records.map((r) => ({
          id: r.attendanceId,
          studentId: r.studentId,
          studentName: r.studentName,
          studentCode: r.studentCode,
          scannedAt: r.scannedAt,
          verificationMethod: r.verificationMethod,
          status: r.status,
          balanceDue: r.balanceDue,
          avatarUrl: r.avatarUrl,
        }));
        setRecentScans(scansList);
      }
    } catch {
      // transient refresh error
    }
  }, [selectedSession, tenant.id]);

  useEffect(() => {
    setSessionStats(null);
    setSessionAttendance([]);
    setEnrolledStudents([]);
    setRecentScans([]);
    void refreshSessionData();
    return () => { statsRequest.current += 1; };
  }, [refreshSessionData]);

  // Execute Idempotent Scan (Attendance mode only)
  const handleProcessScan = useCallback(
    async (rawCode: string, method: 'barcode' | 'qr' | 'manual' = 'barcode') => {
      const trimmedCode = rawCode.trim();
      if (!trimmedCode || !canRecordAttendance) return;
      if (!selectedSession || !receptionSessionState(selectedSession)) {
        setHudData({ state: 'error', messageAr: 'اختر حصة متاحة لتسجيل الحضور' });
        return;
      }

      setIsProcessingScan(true);
      const dal = getDataProvider();

      try {
        const result = await dal.recordAttendanceScan(
          tenant.id,
          selectedSession.id,
          trimmedCode,
          undefined,
          method
        );

        const hasOverdueBalance =
          Boolean(result.balanceAlert && result.balanceAlert.hasBalance) ||
          Boolean(result.student && result.student.balanceDue > 0);

        // Determine audio & HUD visual state
        if (hasOverdueBalance) {
          playWarningChime();
          setHudData({
            state: 'warning',
            student: result.student,
            session: result.session,
            group: selectedGroup || undefined,
            scannedCode: trimmedCode,
            duplicate: result.isDuplicate,
            isNewRecord: result.isNewRecord,
            recordedAt: result.scannedAt,
            messageAr: result.messageAr,
            balanceAlert: result.balanceAlert,
          });
        } else {
          playSuccessChime();
          setHudData({
            state: 'success',
            student: result.student,
            session: result.session,
            group: selectedGroup || undefined,
            scannedCode: trimmedCode,
            duplicate: result.isDuplicate,
            isNewRecord: result.isNewRecord,
            recordedAt: result.scannedAt,
            messageAr: result.messageAr,
            balanceAlert: result.balanceAlert,
          });
        }

        // Add to recent feed if newly recorded
        if (result.student) {
          setRecentScans((prev) => [
            {
              id: result.attendance.id,
              studentId: result.student!.id,
              studentName: result.student!.fullName,
              studentCode: result.student!.studentCode || result.student!.id,
              scannedAt: result.scannedAt,
              verificationMethod: method,
              status: result.status,
              balanceDue: result.student!.balanceDue,
              avatarUrl: result.student!.avatarUrl,
            },
            ...prev.filter((p) => p.studentId !== result.student!.id),
          ]);
        }

        // Refresh stats
        refreshSessionData();
      } catch (err: unknown) {
        playErrorChime();
        const errorMessage = err instanceof Error ? err.message : 'تعذر تسجيل حضور الطالب';
        setHudData({
          state: 'error',
          scannedCode: trimmedCode,
          messageAr: errorMessage,
        });
      } finally {
        setIsProcessingScan(false);
        setManualCodeInput('');
      }
    },
    [selectedSession, tenant.id, selectedGroup, refreshSessionData, canRecordAttendance]
  );

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCodeInput) {
      handleProcessScan(manualCodeInput, 'manual');
    }
  };

  const handleOpenQuickPay = (student: User) => {
    setPaymentStudent(student);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (updatedStudent: User, paidAmount: number) => {
    // Update local HUD to success
    setHudData((prev) => ({
      ...prev,
      state: 'success',
      student: updatedStudent,
      balanceAlert: {
        hasBalance: updatedStudent.balanceDue > 0,
        balanceDue: updatedStudent.balanceDue,
        messageAr:
          updatedStudent.balanceDue > 0
            ? `تنبيه: متبقي مبلغ ${updatedStudent.balanceDue} ج.م`
            : 'جميع الرسوم مسددة بالكامل',
      },
    }));

    // Update in enrolled list
    setEnrolledStudents((prev) =>
      prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
    );

    // Refresh stats
    refreshSessionData();
  };

  // Find classroom capacity
  const activeClassroom = useMemo(() => {
    if (!selectedSession) return null;
    return classrooms.find((c) => c.id === selectedSession.classroomId);
  }, [selectedSession, classrooms]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
              <QrCode className="w-8 h-8 text-brand-cyan-500" />
              <span>منصة الاستقبال والحضور السريع</span>
            </h1>
            <Badge variant="cyan" className="font-bold">
              Sub-300ms HUD
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            نظام مسح الباركود الفوري، كشف هوية الطالب، التنبيهات المالية الذكية، ومنع تكرار التحضير لنفس الحصة.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="cyan"
            size="sm"
            onClick={() => setIsCameraScannerOpen(true)}
            className="h-10 text-xs gap-1.5 shadow-md"
          >
            <Camera className="w-4 h-4" />
            <span>كاميرا QR</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { void loadTenantData(); void refreshSessionData(); }}
            className="h-10 text-xs gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4 text-brand-cyan-500" />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      {/* Hardware Laser Scanner Listener */}
      <BarcodeListener
        onScan={(code) => {
          if (entryMode === 'grades') {
            setIncomingGradeScan((prev) => ({ code, seq: (prev?.seq ?? 0) + 1 }));
            return;
          }
          void handleProcessScan(code, 'barcode');
        }}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Session Selector */}
      <SessionSelector
        branches={branches}
        selectedBranchId={selectedBranchId}
        onSelectBranch={(branchId) => {
          setSelectedBranchId(branchId);
          setSelectedSessionId(null);
          setHudData({ state: 'idle' });
        }}
        sessions={visibleSessions}
        clock={clock}
        groups={groups}
        classrooms={classrooms}
        teachers={teachers}
        selectedSessionId={selectedSession?.id || null}
        onSelectSession={(session) => {
          setSelectedSessionId(session.id);
          setHudData({ state: 'idle' });
        }}
      />

      {/* Verification HUD & Live Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Verification HUD Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <VerificationHud
            data={selectedSession ? hudData : { state: 'idle' }}
            onQuickPayClick={handleOpenQuickPay}
            onManualSearchFallback={() => {
              const el = document.getElementById('manual-search-table');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {canRecordAttendance && hudData.student && selectedSession && hudData.session?.id === selectedSession.id && (
            <ReceptionStudentCard key={`${tenant.id}:${selectedSession.id}:${hudData.student.id}`}
              tenantId={tenant.id} centerSlug={tenant.slug} student={hudData.student} session={selectedSession} group={selectedGroup}
              remoteExams={lessonScores.sessionExams}
              remoteGradesByKey={lessonScores.gradesByKey}
              onSaveUnifiedGrade={lessonScores.saveStudentScore}
              onDeleteUnifiedGrade={lessonScores.deleteStudentScore} />
          )}

          {/* Manual Barcode / Code Fast Input */}
          <form
            onSubmit={handleManualFormSubmit}
            className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border shadow-soft-sm"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="أدخل كود الطالب أو مرر الباركود يدوياً (مثال: STD-1001)..."
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                className="w-full h-10 pr-10 pl-3 rounded-xl bg-background border border-border text-foreground font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!canRecordAttendance || !selectedSession || isProcessingScan || !manualCodeInput.trim()}
              className="h-10 px-5 text-xs font-bold shrink-0"
            >
              <span>{isProcessingScan ? 'جاري التحقق...' : 'تسجيل'}</span>
            </Button>
          </form>
        </div>

        {/* Live Circular Attendance Stats (5 cols) */}
        <div className="lg:col-span-5">
          <LiveStatsRing stats={selectedSession ? sessionStats : null} capacity={activeClassroom?.capacity} />
        </div>
      </div>

      {/* Recent Scans Feed & Manual Check-In Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="manual-search-table">
        {/* Manual Table (7 cols) */}
        <div className="lg:col-span-7">
          <ManualCheckinTable
            students={selectedSession ? enrolledStudents : []}
            attendanceRecords={sessionAttendance}
            onManualCheckin={(code) => handleProcessScan(code, 'manual')}
            isLoading={isProcessingScan}
          />
        </div>

        {/* Lesson Exam Score Entry & Reverse Chronological Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {selectedSession && receptionSessionState(selectedSession, clock) && canEditScores && (
            <LessonExamScorePanel
              session={selectedSession}
              group={selectedGroup}
              subjectNameAr={selectedSubjectName}
              enrolledStudents={enrolledStudents}
              allTenantUsers={allUsers}
              mode={entryMode}
              onModeChange={setEntryMode}
              exams={lessonScores.sessionExams}
              activeExam={lessonScores.activeExam}
              onSelectExam={lessonScores.setSelectedExamId}
              gradesForActiveExamByStudent={lessonScores.gradesForActiveExamByStudent}
              saveStateByKey={lessonScores.saveStateByKey}
              audits={lessonScores.audits}
              authProps={{
                configured: lessonScores.auth.configured,
                loading: lessonScores.auth.loading,
                signedIn: Boolean(lessonScores.auth.user),
                userEmail: lessonScores.auth.user?.email,
                error: lessonScores.auth.error,
                onSignIn: lessonScores.auth.signIn,
                onSignOut: lessonScores.auth.signOut,
              }}
              syncError={lessonScores.syncError}
              isLoadingScores={lessonScores.isLoadingSessionScores}
              onSaveTotalMarks={lessonScores.saveExamMaxMarks}
              onSaveScore={lessonScores.saveStudentScore}
              incomingBarcodeScan={incomingGradeScan}
              pendingLocalCount={lessonScores.pendingLocalCount}
              importReviewRows={lessonScores.importReviewRows}
              onOpenImportReview={lessonScores.prepareLocalImportReview}
              onCommitImport={lessonScores.commitReviewedImport}
            />
          )}

          <RecentScansFeed
            scans={selectedSession ? recentScans : []}
            sessionId={selectedSession?.id}
            activeExam={lessonScores.activeExam}
            gradesByStudent={lessonScores.gradesForActiveExamByStudent}
            saveStateByKey={lessonScores.saveStateByKey}
            canEditScores={canEditScores}
            onSaveInlineScore={lessonScores.saveStudentScore}
          />
        </div>
      </div>

      {/* Camera QR Scanner Modal */}
      <CameraQrScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => {
          setIsCameraScannerOpen(false);
          handleProcessScan(code, 'qr');
        }}
      />

      {/* Front-Desk Quick Payment Modal */}
      <QuickPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentStudent(null);
        }}
        student={paymentStudent}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
