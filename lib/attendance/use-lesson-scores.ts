'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatCleanNumber,
  lessonGradeDocId,
  parseLessonScore,
  parseTotalMarksInput,
  scanLocalStorageReceptionGrades,
  type LessonExamRecord,
  type LessonGradeAuditEntry,
  type LessonGradeRecord,
  type LocalStorageGradeCandidate,
} from '@/lib/attendance/lesson-scores';
import { readReceptionRecord, writeReceptionRecord } from '@/lib/attendance/reception';
import { getDataProvider } from '@/lib/dal/factory';
import type { Group, Session, User } from '@/lib/dal/types';
import {
  subscribeSessionLessonScores,
  useFirebaseAuthSession,
} from '@/lib/firebase/client';

export type SaveLifecycleStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface GradeSaveState {
  status: SaveLifecycleStatus;
  draftValue?: string;
  message?: string;
  lastAttempt?: {
    sessionId: string;
    examId: string;
    studentId: string;
    studentIdOrCode: string;
    rawScore: string;
    source: 'panel' | 'feed' | 'card';
  };
}

export interface LocalImportReviewRow {
  candidate: LocalStorageGradeCandidate;
  studentName?: string;
  studentCode?: string;
  sessionDate?: string;
  groupName?: string;
  examTitle?: string;
  totalMarks?: number;
  eligible: boolean;
  reasonAr: string;
}

export const LESSON_GRADE_SYNC_EVENT = 'yc:lesson-grade-updated';

function emitGradeSyncEvent(detail: { tenantId: string; sessionId: string; examId: string; studentId: string }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LESSON_GRADE_SYNC_EVENT, { detail }));
}

function mirrorGradeToLocalStorage(
  tenantId: string,
  sessionId: string,
  studentId: string,
  examId: string,
  score: number | null
) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readReceptionRecord(tenantId, sessionId, studentId);
    const nextGrades = { ...existing.grades };
    if (score === null) {
      delete nextGrades[examId];
    } else {
      nextGrades[examId] = score;
    }
    writeReceptionRecord(tenantId, sessionId, studentId, {
      ...existing,
      grades: nextGrades,
    });
  } catch {
    // Ignore storage quota or private mode failures cleanly
  }
}

export interface UseReceptionLessonScoresParams {
  tenantId: string;
  centerSlug: string;
  selectedSession: Session | undefined;
  selectedGroup: Group | undefined;
  sessions: Session[];
  groups: Group[];
  fetchImpl?: typeof fetch;
}

export function useReceptionLessonScores({
  tenantId,
  centerSlug,
  selectedSession,
  selectedGroup,
  sessions,
  groups,
  fetchImpl,
}: UseReceptionLessonScoresParams) {
  const auth = useFirebaseAuthSession();
  const httpFetch = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const [examsById, setExamsById] = useState<Record<string, LessonExamRecord>>({});
  const [gradesByKey, setGradesByKey] = useState<Record<string, LessonGradeRecord>>({});
  const [audits, setAudits] = useState<LessonGradeAuditEntry[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [saveStateByKey, setSaveStateByKey] = useState<Record<string, GradeSaveState>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoadingSessionScores, setIsLoadingSessionScores] = useState<boolean>(false);
  const [localCandidates, setLocalCandidates] = useState<LocalStorageGradeCandidate[]>([]);
  const [importReviewRows, setImportReviewRows] = useState<LocalImportReviewRow[]>([]);
  const [dalUsersCache, setDalUsersCache] = useState<User[]>([]);

  const loadRequestSeq = useRef(0);

  // Scan browser localStorage non-destructively for existing demo scores on mount / tenant change
  useEffect(() => {
    setLocalCandidates(scanLocalStorageReceptionGrades(tenantId));
  }, [tenantId]);

  // Seed/refresh DAL exams for the selected session even before remote fetch resolves
  useEffect(() => {
    let active = true;
    const sessionId = selectedSession?.id;
    const groupId = selectedSession?.groupId;
    if (!sessionId || !groupId) return;

    const dal = getDataProvider();
    Promise.all([
      dal.getExams(tenantId, { groupId }),
      dal.getSubjects(tenantId),
      dal.getUsers(tenantId),
    ])
      .then(([dalExams, subjects, users]) => {
        if (!active) return;
        setDalUsersCache(users);
        const subjectNameAr = subjects.find((s) => s.id === selectedGroup?.subjectId)?.nameAr;
        const matching = dalExams.filter(
          (e) => e.sessionId === sessionId && e.status !== 'archived'
        );

        setExamsById((prev) => {
          const next = { ...prev };
          for (const e of matching) {
            if (!next[e.id]) {
              next[e.id] = {
                id: e.id,
                tenantId: e.tenantId,
                branchId: selectedGroup?.branchId || '',
                sessionId,
                groupId,
                subjectId: e.subjectId ?? selectedGroup?.subjectId,
                subjectNameAr: e.subjectNameAr ?? subjectNameAr,
                teacherId: e.teacherId ?? selectedSession.teacherId,
                title: e.title,
                totalMarks: e.totalMarks,
                passMarks: e.passMarks,
                version: 0,
                updatedByUid: 'seed',
                updatedAt: e.createdAt,
                createdAt: e.createdAt,
              };
            }
          }
          return next;
        });

        setSelectedExamId((prevSelected) => {
          if (prevSelected && matching.some((e) => e.id === prevSelected)) {
            return prevSelected;
          }
          return matching[0]?.id ?? null;
        });
      })
      .catch(() => {
        // non-fatal DAL seed read error
      });

    return () => {
      active = false;
    };
  }, [tenantId, selectedSession?.id, selectedSession?.groupId, selectedSession?.teacherId, selectedGroup?.branchId, selectedGroup?.subjectId]);

  // Fetch authenticated session exams + grades from Server/Firestore
  const refreshRemoteScores = useCallback(async () => {
    if (!selectedSession?.id || !auth.idToken || !httpFetch) return;
    const requestId = ++loadRequestSeq.current;
    const targetSessionId = selectedSession.id;
    setIsLoadingSessionScores(true);

    try {
      const response = await httpFetch(
        `/api/center/${encodeURIComponent(centerSlug)}/reception/lesson-scores?sessionId=${encodeURIComponent(targetSessionId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${auth.idToken}`,
          },
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        exams?: LessonExamRecord[];
        grades?: LessonGradeRecord[];
        audits?: LessonGradeAuditEntry[];
      };

      if (requestId !== loadRequestSeq.current) return;

      if (!response.ok || !data.success) {
        setSyncError(data.message || 'تعذّر مزامنة درجات الحصة من الخادم');
        return;
      }

      setSyncError(null);
      if (Array.isArray(data.exams)) {
        const fetchedExams = data.exams;
        setExamsById((prev) => {
          const next = { ...prev };
          for (const exam of fetchedExams) {
            next[exam.id] = exam;
          }
          return next;
        });
        setSelectedExamId((prev) =>
          prev && fetchedExams.some((e) => e.id === prev)
            ? prev
            : fetchedExams[0]?.id ?? prev
        );
      }
      if (Array.isArray(data.grades)) {
        const fetchedGrades = data.grades;
        setGradesByKey((prev) => {
          const next = { ...prev };
          for (const grade of fetchedGrades) {
            next[grade.id] = grade;
            mirrorGradeToLocalStorage(
              tenantId,
              grade.sessionId,
              grade.studentId,
              grade.examId,
              grade.score
            );
          }
          return next;
        });
      }
      if (Array.isArray(data.audits)) {
        setAudits(data.audits);
      }
    } catch {
      if (requestId === loadRequestSeq.current) {
        setSyncError('تعذّر الاتصال بخدمة الدرجات السحابية');
      }
    } finally {
      if (requestId === loadRequestSeq.current) {
        setIsLoadingSessionScores(false);
      }
    }
  }, [auth.idToken, centerSlug, httpFetch, selectedSession?.id, tenantId]);

  useEffect(() => {
    void refreshRemoteScores();
  }, [refreshRemoteScores]);

  // Real-time Cloud Firestore listener for multi-device instant visibility
  useEffect(() => {
    if (!selectedSession?.id || !auth.user || !auth.configured) return;
    const unsubscribe = subscribeSessionLessonScores({
      tenantId,
      sessionId: selectedSession.id,
      onExams: (remoteExams) => {
        setExamsById((prev) => {
          const next = { ...prev };
          for (const exam of remoteExams) {
            next[exam.id] = exam;
          }
          return next;
        });
        if (remoteExams.length > 0) {
          setSelectedExamId((prev) =>
            prev && remoteExams.some((e) => e.id === prev) ? prev : remoteExams[0].id
          );
        }
      },
      onGrades: (remoteGrades) => {
        setGradesByKey((prev) => {
          const next = { ...prev };
          for (const grade of remoteGrades) {
            next[grade.id] = grade;
            mirrorGradeToLocalStorage(
              tenantId,
              grade.sessionId,
              grade.studentId,
              grade.examId,
              grade.score
            );
            emitGradeSyncEvent({
              tenantId,
              sessionId: grade.sessionId,
              examId: grade.examId,
              studentId: grade.studentId,
            });
          }
          return next;
        });
      },
    });
    return () => unsubscribe();
  }, [auth.configured, auth.user, selectedSession?.id, tenantId]);

  const sessionExams = useMemo(() => {
    if (!selectedSession) return [];
    return Object.values(examsById)
      .filter((e) => e.tenantId === tenantId && e.sessionId === selectedSession.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [examsById, selectedSession, tenantId]);

  const activeExam = useMemo(() => {
    if (!sessionExams.length) return null;
    return sessionExams.find((e) => e.id === selectedExamId) ?? sessionExams[0];
  }, [selectedExamId, sessionExams]);

  const gradesForActiveExamByStudent = useMemo(() => {
    const map: Record<string, LessonGradeRecord> = {};
    if (!activeExam) return map;
    for (const grade of Object.values(gradesByKey)) {
      if (grade.examId === activeExam.id) {
        map[grade.studentId] = grade;
      }
    }
    return map;
  }, [activeExam, gradesByKey]);

  const saveExamMaxMarks = useCallback(
    async (params: {
      sessionId: string;
      examId?: string;
      title?: string;
      rawTotalMarks: string;
    }): Promise<{ ok: true; exam: LessonExamRecord } | { ok: false; errorAr: string }> => {
      const parsed = parseTotalMarksInput(params.rawTotalMarks);
      if (!parsed.ok) {
        return { ok: false, errorAr: parsed.errorAr };
      }

      const targetExamId = params.examId || `${params.sessionId}-exam`;
      const currentExam = examsById[targetExamId];

      // Fast local guard before network round-trip
      const recordedForExam = Object.values(gradesByKey).filter(
        (g) => g.examId === targetExamId
      );
      const maxRecorded = recordedForExam.reduce(
        (max, g) => (g.score > max ? g.score : max),
        -1
      );
      if (maxRecorded >= 0 && parsed.value < maxRecorded) {
        return {
          ok: false,
          errorAr: `تعذر خفض الدرجة النهائية إلى ${formatCleanNumber(parsed.value)} لأن هناك درجة مسجلة بالفعل تبلغ ${formatCleanNumber(maxRecorded)}. تم الإبقاء على الدرجات الحالية كما هي.`,
        };
      }

      if (!auth.idToken || !httpFetch) {
        return {
          ok: false,
          errorAr: 'يلزم تسجيل الدخول بحساب Firebase مخوّل لحفظ الدرجة النهائية في Firestore',
        };
      }

      try {
        const res = await httpFetch(
          `/api/center/${encodeURIComponent(centerSlug)}/reception/lesson-scores`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.idToken}`,
            },
            body: JSON.stringify({
              sessionId: params.sessionId,
              examId: params.examId,
              title: params.title,
              totalMarks: parsed.value,
              expectedVersion:
                currentExam && currentExam.version > 0 ? currentExam.version : undefined,
            }),
          }
        );

        const data = (await res.json()) as {
          success?: boolean;
          exam?: LessonExamRecord;
          message?: string;
        };

        if (!res.ok || !data.success || !data.exam) {
          return {
            ok: false,
            errorAr: data.message || 'تعذّر تحديث الدرجة النهائية للاختبار',
          };
        }

        const savedExam = data.exam;
        setExamsById((prev) => ({ ...prev, [savedExam.id]: savedExam }));
        setSelectedExamId(savedExam.id);
        return { ok: true, exam: savedExam };
      } catch {
        return {
          ok: false,
          errorAr: 'تعذر الاتصال بالخادم أثناء حفظ الدرجة النهائية للاختبار',
        };
      }
    },
    [auth.idToken, centerSlug, examsById, gradesByKey, httpFetch]
  );

  // Captures explicit (sessionId, examId, studentId) so switching active exam/session mid-flight
  // keeps response state strictly scoped to the original student and exam!
  const saveStudentScore = useCallback(
    async (params: {
      sessionId: string;
      examId: string;
      totalMarks: number;
      studentId: string;
      studentIdOrCode: string;
      rawScore: string;
      source: 'panel' | 'feed' | 'card';
    }): Promise<{ ok: true; grade: LessonGradeRecord } | { ok: false; errorAr: string }> => {
      const targetKey = lessonGradeDocId(params.examId, params.studentId);
      const parsed = parseLessonScore(params.rawScore, params.totalMarks);
      if (!parsed.ok) {
        setSaveStateByKey((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'error',
            draftValue: params.rawScore,
            message: parsed.errorAr,
            lastAttempt: {
              sessionId: params.sessionId,
              examId: params.examId,
              studentId: params.studentId,
              studentIdOrCode: params.studentIdOrCode,
              rawScore: params.rawScore,
              source: params.source,
            },
          },
        }));
        return { ok: false, errorAr: parsed.errorAr };
      }

      if (!auth.idToken || !httpFetch) {
        const msg = 'يلزم تسجيل الدخول بحساب Firebase موثق لحفظ الدرجة في Firestore';
        setSaveStateByKey((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'error',
            draftValue: params.rawScore,
            message: msg,
            lastAttempt: {
              sessionId: params.sessionId,
              examId: params.examId,
              studentId: params.studentId,
              studentIdOrCode: params.studentIdOrCode,
              rawScore: params.rawScore,
              source: params.source,
            },
          },
        }));
        return { ok: false, errorAr: msg };
      }

      setSaveStateByKey((prev) => ({
        ...prev,
        [targetKey]: {
          status: 'saving',
          draftValue: params.rawScore,
          message: 'جارٍ الحفظ',
          lastAttempt: {
            sessionId: params.sessionId,
            examId: params.examId,
            studentId: params.studentId,
            studentIdOrCode: params.studentIdOrCode,
            rawScore: params.rawScore,
            source: params.source,
          },
        },
      }));

      const existingVersion = gradesByKey[targetKey]?.version;

      try {
        const res = await httpFetch(
          `/api/center/${encodeURIComponent(centerSlug)}/reception/lesson-scores`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.idToken}`,
            },
            body: JSON.stringify({
              sessionId: params.sessionId,
              examId: params.examId,
              studentIdOrCode: params.studentIdOrCode,
              score: parsed.value,
              source: params.source,
              expectedVersion: existingVersion,
            }),
          }
        );

        const data = (await res.json()) as {
          success?: boolean;
          grade?: LessonGradeRecord;
          exam?: LessonExamRecord;
          audit?: LessonGradeAuditEntry;
          message?: string;
        };

        if (!res.ok || !data.success || !data.grade) {
          const msg = data.message || 'تعذر حفظ الدرجة؛ يمكنك إعادة المحاولة';
          setSaveStateByKey((prev) => ({
            ...prev,
            [targetKey]: {
              status: 'error',
              draftValue: params.rawScore,
              message: msg,
              lastAttempt: {
                sessionId: params.sessionId,
                examId: params.examId,
                studentId: params.studentId,
                studentIdOrCode: params.studentIdOrCode,
                rawScore: params.rawScore,
                source: params.source,
              },
            },
          }));
          return { ok: false, errorAr: msg };
        }

        const savedGrade = data.grade;
        if (data.exam) {
          const returnedExam = data.exam;
          setExamsById((prev) => ({ ...prev, [returnedExam.id]: returnedExam }));
        }
        setGradesByKey((prev) => ({ ...prev, [savedGrade.id]: savedGrade }));
        if (data.audit) {
          const nextAudit = data.audit;
          setAudits((prev) => [nextAudit, ...prev.slice(0, 49)]);
        }

        mirrorGradeToLocalStorage(
          tenantId,
          savedGrade.sessionId,
          savedGrade.studentId,
          savedGrade.examId,
          savedGrade.score
        );
        emitGradeSyncEvent({
          tenantId,
          sessionId: savedGrade.sessionId,
          examId: savedGrade.examId,
          studentId: savedGrade.studentId,
        });

        setSaveStateByKey((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'saved',
            message: 'تم الحفظ',
          },
        }));

        return { ok: true, grade: savedGrade };
      } catch {
        const msg = 'انقطع الاتصال أثناء الحفظ؛ القيمة محفوظة مؤقتاً لإعادة المحاولة';
        setSaveStateByKey((prev) => ({
          ...prev,
          [targetKey]: {
            status: 'error',
            draftValue: params.rawScore,
            message: msg,
            lastAttempt: {
              sessionId: params.sessionId,
              examId: params.examId,
              studentId: params.studentId,
              studentIdOrCode: params.studentIdOrCode,
              rawScore: params.rawScore,
              source: params.source,
            },
          },
        }));
        return { ok: false, errorAr: msg };
      }
    },
    [auth.idToken, centerSlug, gradesByKey, httpFetch, tenantId]
  );

  const deleteStudentScore = useCallback(
    async (params: {
      sessionId: string;
      examId: string;
      studentId: string;
      source: 'panel' | 'feed' | 'card';
    }): Promise<{ ok: boolean; errorAr?: string }> => {
      if (!auth.idToken || !httpFetch) {
        return {
          ok: false,
          errorAr: 'يلزم تسجيل الدخول بحساب Firebase موثق لحذف الدرجة من Firestore',
        };
      }
      const targetKey = lessonGradeDocId(params.examId, params.studentId);
      try {
        const res = await httpFetch(
          `/api/center/${encodeURIComponent(centerSlug)}/reception/lesson-scores`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth.idToken}`,
            },
            body: JSON.stringify(params),
          }
        );
        const data = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !data.success) {
          return { ok: false, errorAr: data.message || 'تعذّر حذف الدرجة' };
        }
        setGradesByKey((prev) => {
          const next = { ...prev };
          delete next[targetKey];
          return next;
        });
        mirrorGradeToLocalStorage(tenantId, params.sessionId, params.studentId, params.examId, null);
        emitGradeSyncEvent({
          tenantId,
          sessionId: params.sessionId,
          examId: params.examId,
          studentId: params.studentId,
        });
        return { ok: true };
      } catch {
        return { ok: false, errorAr: 'تعذّر الاتصال أثناء حذف الدرجة' };
      }
    },
    [auth.idToken, centerSlug, httpFetch, tenantId]
  );

  // Build non-destructive review list for browser localStorage grades
  const prepareLocalImportReview = useCallback(async () => {
    const candidates = scanLocalStorageReceptionGrades(tenantId);
    setLocalCandidates(candidates);
    const dal = getDataProvider();
    const [allEnrollments, allExams] = await Promise.all([
      dal.getEnrollments(tenantId),
      dal.getExams(tenantId),
    ]);

    const rows: LocalImportReviewRow[] = candidates.map((candidate) => {
      const student = dalUsersCache.find((u) => u.id === candidate.studentId);
      const session = sessions.find((s) => s.id === candidate.sessionId);
      const group = session ? groups.find((g) => g.id === session.groupId) : undefined;
      const remoteExam = examsById[candidate.examId];
      const seedExam = allExams.find((e) => e.id === candidate.examId);
      const examTotal = remoteExam?.totalMarks ?? seedExam?.totalMarks;
      const examTitle = remoteExam?.title ?? seedExam?.title;
      const examSessionId = remoteExam?.sessionId ?? seedExam?.sessionId;
      const examGroupId = remoteExam?.groupId ?? seedExam?.groupId;

      if (!student || !session || !group) {
        return {
          candidate,
          studentName: student?.fullName,
          studentCode: student?.studentCode,
          sessionDate: session?.sessionDate,
          groupName: group?.nameAr,
          examTitle,
          totalMarks: examTotal,
          eligible: false,
          reasonAr: 'تعذّر مطابقة الطالب أو الحصة أو المجموعة في السنتر',
        };
      }

      const enrolled = allEnrollments.some(
        (e) => e.studentId === student.id && e.groupId === group.id && e.isActive
      );
      if (!enrolled) {
        return {
          candidate,
          studentName: student.fullName,
          studentCode: student.studentCode,
          sessionDate: session.sessionDate,
          groupName: group.nameAr,
          examTitle,
          totalMarks: examTotal,
          eligible: false,
          reasonAr: 'الطالب غير مقيد في مجموعة الحصة',
        };
      }

      if (examSessionId !== session.id || examGroupId !== group.id || !examTotal) {
        return {
          candidate,
          studentName: student.fullName,
          studentCode: student.studentCode,
          sessionDate: session.sessionDate,
          groupName: group.nameAr,
          examTitle,
          totalMarks: examTotal,
          eligible: false,
          reasonAr: 'الاختبار غير مرتبط بهذه الحصة والمجموعة',
        };
      }

      if (candidate.score < 0 || candidate.score > examTotal) {
        return {
          candidate,
          studentName: student.fullName,
          studentCode: student.studentCode,
          sessionDate: session.sessionDate,
          groupName: group.nameAr,
          examTitle,
          totalMarks: examTotal,
          eligible: false,
          reasonAr: `الدرجة (${candidate.score}) خارج حدود الدرجة النهائية (${examTotal})`,
        };
      }

      const remoteExisting = gradesByKey[lessonGradeDocId(candidate.examId, candidate.studentId)];
      if (remoteExisting && remoteExisting.score === candidate.score) {
        return {
          candidate,
          studentName: student.fullName,
          studentCode: student.studentCode,
          sessionDate: session.sessionDate,
          groupName: group.nameAr,
          examTitle,
          totalMarks: examTotal,
          eligible: false,
          reasonAr: 'متزامنة بالفعل في Firestore',
        };
      }

      return {
        candidate,
        studentName: student.fullName,
        studentCode: student.studentCode,
        sessionDate: session.sessionDate,
        groupName: group.nameAr,
        examTitle,
        totalMarks: examTotal,
        eligible: true,
        reasonAr: remoteExisting
          ? `تختلف عن السحابة (${remoteExisting.score}) — جاهز للمراجعة والاستبدال`
          : 'مطابق وجاهز للاستيراد',
      };
    });

    setImportReviewRows(rows);
    return rows;
  }, [dalUsersCache, examsById, gradesByKey, groups, sessions, tenantId]);

  const commitReviewedImport = useCallback(
    async (selectedCandidates: LocalStorageGradeCandidate[]) => {
      if (!auth.idToken || !httpFetch) {
        return {
          ok: false,
          message: 'يلزم تسجيل الدخول بحساب Firebase موثق لاستيراد الدرجات إلى Firestore',
        };
      }
      const res = await httpFetch(
        `/api/center/${encodeURIComponent(centerSlug)}/reception/lesson-scores/import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify({
            items: selectedCandidates.map((c) => ({
              sessionId: c.sessionId,
              studentId: c.studentId,
              examId: c.examId,
              score: c.score,
              overwrite: true,
            })),
          }),
        }
      );

      const data = (await res.json()) as {
        success?: boolean;
        importedCount?: number;
        skippedCount?: number;
        rejectedCount?: number;
        message?: string;
      };

      if (!res.ok || !data.success) {
        return { ok: false, message: data.message || 'فشل استيراد الدرجات المراجعة' };
      }

      await refreshRemoteScores();
      await prepareLocalImportReview();

      return {
        ok: true,
        message: `تم استيراد ${data.importedCount ?? 0} درجة (تخطي ${data.skippedCount ?? 0}، مرفوض ${data.rejectedCount ?? 0}) مع بقاء النسخة المحلية محفوظة.`,
      };
    },
    [auth.idToken, centerSlug, httpFetch, prepareLocalImportReview, refreshRemoteScores]
  );

  const pendingLocalCount = useMemo(() => {
    return localCandidates.filter((c) => {
      const existing = gradesByKey[lessonGradeDocId(c.examId, c.studentId)];
      return !existing || existing.score !== c.score;
    }).length;
  }, [gradesByKey, localCandidates]);

  return {
    auth,
    sessionExams,
    activeExam,
    selectedExamId: activeExam?.id ?? null,
    setSelectedExamId,
    gradesByKey,
    gradesForActiveExamByStudent,
    saveStateByKey,
    audits,
    syncError,
    isLoadingSessionScores,
    refreshRemoteScores,
    saveExamMaxMarks,
    saveStudentScore,
    deleteStudentScore,
    pendingLocalCount,
    importReviewRows,
    prepareLocalImportReview,
    commitReviewedImport,
  };
}
