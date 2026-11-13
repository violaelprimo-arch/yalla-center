/**
 * Yalla Center - Timetable & Schedule Conflict Detection Engine
 * Path: lib/timetable/conflict-detector.ts
 *
 * Implements interval collision detection algorithm: (s1 < e2) && (s2 < e1),
 * preventing classroom double-booking and teacher double-booking across rooms and branches.
 * Supports back-to-back zero-gap scheduling (s2 = e1), canceled session bypass,
 * and self-exclusion on edit.
 */

export interface TimeSlot {
  startTime: string; // "HH:mm" e.g. "14:00"
  endTime: string;   // "HH:mm" e.g. "16:00"
}

export interface ScheduleCandidate {
  id?: string;             // Excluded when updating existing record
  tenantId: string;
  branchId: string;
  classroomId: string;
  teacherId: string;
  dayOfWeek?: number;      // 0=Sun..6=Sat (for recurring weekly groups)
  sessionDate?: string;    // YYYY-MM-DD (for calendar sessions)
  startTime: string;       // "14:00"
  endTime: string;         // "16:00"
  maxStudents?: number;
}

export type ConflictSeverity = 'error' | 'warning';

export type ConflictCode =
  | 'CLASSROOM_DOUBLE_BOOKING'
  | 'TEACHER_DOUBLE_BOOKING'
  | 'CAPACITY_OVERFLOW'
  | 'CROSS_BRANCH_TRANSIT_TIGHT'
  | 'INVALID_TIME_RANGE';

export interface ScheduleConflict {
  code: ConflictCode;
  severity: ConflictSeverity;
  conflictingEntityId?: string;
  conflictingEntityName?: string;
  teacherName?: string;
  classroomName?: string;
  branchName?: string;
  timeSlot?: TimeSlot;
  messageAr: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean; // True if any 'error' severity exists
  canSchedule: boolean; // True if no 'error' severity exists (warnings allowed)
  errors: ScheduleConflict[];
  warnings: ScheduleConflict[];
  suggestedAlternativeSlots?: TimeSlot[];
}

/**
 * Converts "HH:mm" string to total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return 0;
  }
  const [hours, minutes] = timeStr.split(':').map((val) => parseInt(val, 10) || 0);
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight to "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Evaluates whether two half-open intervals [startA, endA) and [startB, endB) overlap.
 * Invariant: Overlap occurs iff (startA < endB) && (startB < endA).
 * Back-to-back classes where endA === startB do NOT overlap (returns false).
 */
export function isTimeOverlapping(slotA: TimeSlot, slotB: TimeSlot): boolean {
  const startA = timeToMinutes(slotA.startTime);
  const endA = timeToMinutes(slotA.endTime);
  const startB = timeToMinutes(slotB.startTime);
  const endB = timeToMinutes(slotB.endTime);

  // Guard against invalid or zero-duration intervals
  if (endA <= startA || endB <= startB) {
    return false;
  }

  // Interval collision detection: (startA < endB) && (startB < endA)
  return startA < endB && startB < endA;
}

/**
 * Detects schedule collisions for Recurring Weekly Groups
 */
export function checkGroupScheduleConflicts(
  candidate: ScheduleCandidate,
  existingGroups: Array<{
    id: string;
    tenantId: string;
    branchId: string;
    classroomId: string;
    teacherId: string;
    nameAr: string;
    scheduleDay: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>,
  classroomsMap: Map<string, { nameAr: string; capacity: number }>,
  teachersMap: Map<string, { fullName: string }>
): ConflictCheckResult {
  const errors: ScheduleConflict[] = [];
  const warnings: ScheduleConflict[] = [];

  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);

  // 1. Time range validity check
  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'خطأ في التوقيت: وقت نهاية الحصة يجب أن يكون بعد وقت البداية.',
    });
    return { hasConflict: true, canSchedule: false, errors, warnings };
  }

  // 2. Classroom capacity check (warning)
  const targetRoom = classroomsMap.get(candidate.classroomId);
  if (targetRoom && candidate.maxStudents && candidate.maxStudents > targetRoom.capacity) {
    warnings.push({
      code: 'CAPACITY_OVERFLOW',
      severity: 'warning',
      classroomName: targetRoom.nameAr,
      messageAr: `تنبيه السعة: الحد الأقصى للطلاب بالمجموعة (${candidate.maxStudents}) يتجاوز سعة القاعة (${targetRoom.capacity} مقعد).`,
    });
  }

  const candSlot: TimeSlot = {
    startTime: candidate.startTime,
    endTime: candidate.endTime,
  };

  for (const group of existingGroups) {
    // Exclude inactive groups or self-record on edit
    if (!group.isActive) continue;
    if (candidate.id && group.id === candidate.id) continue;
    if (group.tenantId !== candidate.tenantId) continue;
    if (candidate.dayOfWeek !== undefined && group.scheduleDay !== candidate.dayOfWeek) continue;

    const groupSlot: TimeSlot = {
      startTime: group.startTime,
      endTime: group.endTime,
    };

    if (!isTimeOverlapping(candSlot, groupSlot)) {
      continue;
    }

    // A. Classroom collision (Error - Block)
    if (group.classroomId === candidate.classroomId) {
      const roomName = classroomsMap.get(group.classroomId)?.nameAr || 'القاعة';
      errors.push({
        code: 'CLASSROOM_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: group.id,
        conflictingEntityName: group.nameAr,
        classroomName: roomName,
        timeSlot: groupSlot,
        messageAr: `تعارض في القاعة: قاعة [${roomName}] محجوزة بالفعل لمجموعة "${group.nameAr}" في نفس التوقيت (${group.startTime} - ${group.endTime}).`,
      });
    }

    // B. Teacher collision across any classroom or branch (Error - Block)
    if (group.teacherId === candidate.teacherId) {
      const teacherName = teachersMap.get(group.teacherId)?.fullName || 'المعلم';
      errors.push({
        code: 'TEACHER_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: group.id,
        conflictingEntityName: group.nameAr,
        teacherName: teacherName,
        timeSlot: groupSlot,
        messageAr: `تعارض في جدول المعلم: المعلم [${teacherName}] مرتبط بمجموعة "${group.nameAr}" في نفس التوقيت (${group.startTime} - ${group.endTime}).`,
      });
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canSchedule: !hasConflict,
    errors,
    warnings,
  };
}

/**
 * Detects schedule collisions for Specific Calendar Sessions
 */
export function checkSessionScheduleConflicts(
  candidate: ScheduleCandidate,
  existingSessions: Array<{
    id: string;
    tenantId: string;
    groupId: string;
    classroomId?: string;
    teacherId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    status: string;
  }>,
  groupsMap: Map<string, { nameAr: string }>,
  classroomsMap: Map<string, { nameAr: string }>,
  teachersMap: Map<string, { fullName: string }>
): ConflictCheckResult {
  const errors: ScheduleConflict[] = [];
  const warnings: ScheduleConflict[] = [];

  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);

  // 1. Time range validity check
  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'خطأ في التوقيت: وقت نهاية الحصة يجب أن يكون بعد وقت البداية.',
    });
    return { hasConflict: true, canSchedule: false, errors, warnings };
  }

  const candSlot: TimeSlot = {
    startTime: candidate.startTime,
    endTime: candidate.endTime,
  };

  for (const session of existingSessions) {
    // Exclude self and canceled/postponed sessions
    if (candidate.id && session.id === candidate.id) continue;
    if (session.status === 'canceled' || session.status === 'postponed') continue;
    if (session.tenantId !== candidate.tenantId) continue;
    if (candidate.sessionDate && session.sessionDate !== candidate.sessionDate) continue;

    const sessionSlot: TimeSlot = {
      startTime: session.startTime,
      endTime: session.endTime,
    };

    if (!isTimeOverlapping(candSlot, sessionSlot)) {
      continue;
    }

    const groupTitle = groupsMap.get(session.groupId)?.nameAr || 'حصة دراسية';

    // A. Classroom collision
    if (session.classroomId && session.classroomId === candidate.classroomId) {
      const roomName = classroomsMap.get(session.classroomId)?.nameAr || 'القاعة';
      errors.push({
        code: 'CLASSROOM_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: session.id,
        conflictingEntityName: groupTitle,
        classroomName: roomName,
        timeSlot: sessionSlot,
        messageAr: `تعارض بالقاعة: قاعة [${roomName}] محجوزة بالفعل لـ "${groupTitle}" بتاريخ ${session.sessionDate} (${session.startTime} - ${session.endTime}).`,
      });
    }

    // B. Teacher collision
    if (session.teacherId === candidate.teacherId) {
      const teacherName = teachersMap.get(session.teacherId)?.fullName || 'المعلم';
      errors.push({
        code: 'TEACHER_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: session.id,
        conflictingEntityName: groupTitle,
        teacherName: teacherName,
        timeSlot: sessionSlot,
        messageAr: `تعارض بجدول المعلم: المعلم [${teacherName}] لديه حصة مجدولة لـ "${groupTitle}" في نفس التوقيت (${session.startTime} - ${session.endTime}).`,
      });
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canSchedule: !hasConflict,
    errors,
    warnings,
  };
}

export type StudentConflictCode =
  | 'STUDENT_SCHEDULE_COLLISION'
  | 'DUPLICATE_ENROLLMENT'
  | 'CAPACITY_OVERFLOW'
  | 'CROSS_BRANCH_TRANSIT_TIGHT'
  | 'INVALID_TIME_RANGE';

export interface StudentScheduleConflict {
  code: StudentConflictCode;
  severity: ConflictSeverity;
  conflictingGroupId?: string;
  conflictingGroupName?: string;
  timeSlot?: TimeSlot;
  dayNameAr?: string;
  messageAr: string;
}

export interface StudentEnrollmentConflictCheckResult {
  hasConflict: boolean;
  canEnroll: boolean;
  errors: StudentScheduleConflict[];
  warnings: StudentScheduleConflict[];
  capacityInfo: {
    currentEnrolled: number;
    maxStudents: number;
    isFull: boolean;
    availableSeats: number;
  };
}

/**
 * Validates candidate group against student's existing active enrollments
 * and group capacity limits.
 *
 * Invariants:
 * - Interval collision: (s1 < e2) && (s2 < e1) on the same scheduleDay
 * - Back-to-back zero-gap allowance (s2 === e1) is NOT a collision
 * - Capacity overflow generates a warning/notice
 * - Duplicate enrollment generates an error
 */
export function checkStudentEnrollmentConflict(
  candidateGroup: {
    id: string;
    tenantId?: string;
    nameAr: string;
    branchId?: string;
    scheduleDay: number;
    weeklySlots?: Array<TimeSlot & { scheduleDay: number }>;
    startTime: string;
    endTime: string;
    maxStudents: number;
  },
  studentActiveGroups: Array<{
    id: string;
    tenantId?: string;
    nameAr: string;
    branchId?: string;
    scheduleDay: number;
    weeklySlots?: Array<TimeSlot & { scheduleDay: number }>;
    startTime: string;
    endTime: string;
  }>,
  currentEnrolledCount: number,
  dayNameAr?: string
): StudentEnrollmentConflictCheckResult {
  const errors: StudentScheduleConflict[] = [];
  const warnings: StudentScheduleConflict[] = [];

  const candStart = timeToMinutes(candidateGroup.startTime);
  const candEnd = timeToMinutes(candidateGroup.endTime);

  const isFull = currentEnrolledCount >= candidateGroup.maxStudents;
  const availableSeats = Math.max(0, candidateGroup.maxStudents - currentEnrolledCount);

  // 1. Time range validity check
  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'خطأ في التوقيت: وقت نهاية الحصة يجب أن يكون بعد وقت البداية.',
    });
    return {
      hasConflict: true,
      canEnroll: false,
      errors,
      warnings,
      capacityInfo: {
        currentEnrolled: currentEnrolledCount,
        maxStudents: candidateGroup.maxStudents,
        isFull,
        availableSeats,
      },
    };
  }

  // 2. Duplicate Enrollment check
  const isAlreadyEnrolled = studentActiveGroups.some((g) => g.id === candidateGroup.id);
  if (isAlreadyEnrolled) {
    errors.push({
      code: 'DUPLICATE_ENROLLMENT',
      severity: 'error',
      conflictingGroupId: candidateGroup.id,
      conflictingGroupName: candidateGroup.nameAr,
      messageAr: `الطالب مسجل بالفعل في هذه المجموعة (${candidateGroup.nameAr}).`,
    });
  }

  // 3. Capacity Check (Warning)
  if (isFull) {
    warnings.push({
      code: 'CAPACITY_OVERFLOW',
      severity: 'warning',
      messageAr: `تنبيه السعة: المجموعة مكتملة العدد (${currentEnrolledCount}/${candidateGroup.maxStudents} مقعد).`,
    });
  }

  // Compare every weekly meeting, including the legacy single-slot groups.
  const candidateSlots = candidateGroup.weeklySlots ?? [candidateGroup];
  for (const existing of studentActiveGroups) {
    if (existing.id === candidateGroup.id || (existing.tenantId && candidateGroup.tenantId &&
      existing.tenantId !== candidateGroup.tenantId)) continue;
    const existingSlots = existing.weeklySlots ?? [existing];
    for (const candidate of candidateSlots) {
      for (const other of existingSlots) {
        if (other.scheduleDay !== candidate.scheduleDay) continue;
        if (isTimeOverlapping(candidate, other)) {
          errors.push({
            code: 'STUDENT_SCHEDULE_COLLISION',
            severity: 'error',
            conflictingGroupId: existing.id,
            conflictingGroupName: existing.nameAr,
            timeSlot: other,
            dayNameAr: candidateGroup.weeklySlots ? undefined : dayNameAr,
            messageAr: `تعارض زمني في جدول الطالب: الطالب مسجل بالفعل في مجموعة "${existing.nameAr}" في نفس التوقيت (${other.startTime} - ${other.endTime}).`,
          });
        } else if (existing.branchId && candidateGroup.branchId && existing.branchId !== candidateGroup.branchId) {
          const gap = Math.min(
            Math.abs(timeToMinutes(candidate.startTime) - timeToMinutes(other.endTime)),
            Math.abs(timeToMinutes(other.startTime) - timeToMinutes(candidate.endTime)),
          );
          if (gap < 30) {
            warnings.push({
              code: 'CROSS_BRANCH_TRANSIT_TIGHT',
              severity: 'warning',
              messageAr: `تنبيه انتقال: الفاصل الزمني (${gap} دقيقة) ضيق جداً للانتقال بين فرعين مختلفين.`,
            });
          }
        }
      }
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canEnroll: !hasConflict,
    errors,
    warnings,
    capacityInfo: {
      currentEnrolled: currentEnrolledCount,
      maxStudents: candidateGroup.maxStudents,
      isFull,
      availableSeats,
    },
  };
}

