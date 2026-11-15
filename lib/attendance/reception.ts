import type { Attendance, Enrollment, Exam, ExamSubmission, Group, Session } from '@/lib/dal/types';

const cairo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Cairo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function cairoClock(now = new Date()) {
  return cairo.format(now).replace(' ', 'T');
}

export function sessionStart(session: Session) {
  return `${session.sessionDate}T${session.startTime.slice(0, 5)}`;
}

export function receptionSessionState(session: Session, clock = cairoClock()) {
  if (session.status !== 'scheduled' && session.status !== 'in_progress') return null;
  const today = clock.slice(0, 10);
  const start = sessionStart(session);
  const endTime = session.endTime.slice(0, 5);
  const endDate = endTime < session.startTime.slice(0, 5)
    ? new Date(Date.parse(session.sessionDate) + 86400000).toISOString().slice(0, 10)
    : session.sessionDate;
  const endDateTime = `${endDate}T${endTime}`;

  if (clock >= endDateTime) return null;
  if (clock >= start) {
    if (session.sessionDate === today || endDate === today) {
      return 'current';
    }
    return null;
  }

  // Upcoming only during today in Africa/Cairo
  if (session.sessionDate === today) {
    return 'upcoming';
  }

  return null;
}

export interface ReceptionRecord {
  homework?: boolean;
  grades: Record<string, number>;
  notes?: string;
}

export function readReceptionRecord(tenantId: string, sessionId: string, studentId: string): ReceptionRecord {
  const value = localStorage.getItem(receptionKey(tenantId, sessionId, studentId));
  return value ? JSON.parse(value) : { grades: {} };
}

export function writeReceptionRecord(tenantId: string, sessionId: string, studentId: string, record: ReceptionRecord) {
  localStorage.setItem(receptionKey(tenantId, sessionId, studentId), JSON.stringify(record));
}

function receptionKey(tenantId: string, sessionId: string, studentId: string) {
  return 'yc-reception:' + JSON.stringify([tenantId, sessionId, studentId]);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeReception(
  session: Session,
  enrollment: Enrollment,
  sessions: Session[],
  attendance: Attendance[],
  exams: Exam[],
  submissions: ExamSubmission[],
  manualGrade: (exam: Exam) => number | undefined,
  clock = cairoClock(),
  groups?: Group[],
) {
  const targetSubjectId = session.subjectId ?? groups?.find(g => g.id === session.groupId)?.subjectId;
  const enrolledDate = cairoClock(new Date(enrollment.enrolledAt)).slice(0, 10);
  const completed = sessions.filter(item => {
    if (item.status !== 'completed' || item.sessionDate < enrolledDate || sessionStart(item) > clock) return false;
    if (item.groupId === session.groupId) return true;
    if (targetSubjectId && (item.subjectId === targetSubjectId || groups?.find(g => g.id === item.groupId)?.subjectId === targetSubjectId)) {
      return true;
    }
    return false;
  });
  const previous = completed.filter(item => item.groupId === session.groupId && item.id !== session.id && sessionStart(item) < sessionStart(session))
    .sort((a, b) => sessionStart(b).localeCompare(sessionStart(a)))[0];
  const records = new Map(attendance.filter(item => item.studentId === enrollment.studentId)
    .map(item => [item.sessionId, item.status]));
  const monthlyAbsences = completed.filter(item =>
    item.groupId === session.groupId &&
    item.sessionDate.startsWith(clock.slice(0, 7)) && records.get(item.id) === 'absent').length;

  const attendanceScores = completed.flatMap(item => {
    const status = records.get(item.id);
    if (!status || status === 'excused') return [];
    return [status === 'absent' ? 0 : 100];
  });
  const classScores: number[] = [];
  const comprehensiveScores: number[] = [];
  const groupSessions = new Map(sessions.filter(item => item.groupId === session.groupId)
    .map(item => [item.id, item]));
  for (const exam of exams) {
    if (exam.totalMarks <= 0) continue;
    // Subject scoping: strictly isolate to the current session's subject
    if (targetSubjectId && exam.subjectId && exam.subjectId !== targetSubjectId) continue;
    if (!targetSubjectId && exam.groupId !== session.groupId) continue;
    if (targetSubjectId && !exam.subjectId && exam.groupId !== session.groupId) {
      const examGroupSubject = groups?.find(g => g.id === exam.groupId)?.subjectId;
      if (examGroupSubject && examGroupSubject !== targetSubjectId) continue;
    }

    const examSession = exam.sessionId ? groupSessions.get(exam.sessionId) : undefined;
    if (exam.sessionId && (!examSession || examSession.status === 'canceled')) continue;
    const examDate = examSession?.sessionDate ?? cairoClock(new Date(exam.createdAt)).slice(0, 10);
    if (examDate < enrolledDate || examDate > clock.slice(0, 10)) continue;
    const submission = submissions.filter(item => item.examId === exam.id &&
      item.studentId === enrollment.studentId && item.status === 'graded')
      .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt))[0];
    const score = manualGrade(exam) ?? submission?.totalScore;
    if (score === undefined || !Number.isFinite(score) || score < 0 || score > exam.totalMarks) continue;
    (exam.sessionId ? classScores : comprehensiveScores).push(score / exam.totalMarks * 100);
  }

  const components = [average(classScores), average(comprehensiveScores), average(attendanceScores)];
  return {
    previous: previous ? records.get(previous.id) ?? ('unrecorded' as const) : ('none' as const),
    monthlyAbsences,
    components,
    performance: average(components.filter((value): value is number => value !== null)),
  };
}
