import type { Attendance, Session } from '@/lib/dal/types';
import type { TeacherContract } from './profile';

export function countTeacherSessionAttendance(records: Attendance[], session: Session) {
  const students = new Set(records.filter(record =>
    record.tenantId === session.tenantId && record.sessionId === session.id &&
    (record.status === 'present' || record.status === 'late')
  ).map(record => record.studentId));
  return students.size;
}

export function calculateTeacherSessionPay(
  contract: TeacherContract,
  session: Session,
  attendanceCount: number,
  revenue: number,
  live = false,
) {
  const eligible = session.status === 'completed' ||
    (live && (session.status === 'in_progress' || session.status === 'scheduled'));
  const revenueCents = Math.round(revenue * 100);
  const rateCents = Math.round(contract.value * 100);
  let teacherCents = 0;

  if (eligible) {
    if (contract.model === 'per_attendee') teacherCents = attendanceCount * rateCents;
    if (contract.model === 'fixed_session') teacherCents = rateCents;
    if (contract.model === 'private') teacherCents = Math.round(revenueCents * rateCents / 10000);
  }

  return { teacherDue: teacherCents / 100, centerNet: (revenueCents - teacherCents) / 100 };
}
