import { describe, it, expect } from 'vitest';
import { checkStudentEnrollmentConflict } from '@/lib/timetable/conflict-detector';

describe('Student Enrollment Timetable Conflict Radar (FEAT-16)', () => {
  const candidateGroup = {
    id: 'grp-candidate',
    nameAr: 'مجموعة الأحياء المتميزة',
    branchId: 'branch-1',
    scheduleDay: 1, // Monday
    startTime: '14:00',
    endTime: '16:00',
    maxStudents: 30,
  };

  it('allows enrollment when student has no active groups', () => {
    const result = checkStudentEnrollmentConflict(candidateGroup, [], 10);
    expect(result.hasConflict).toBe(false);
    expect(result.canEnroll).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
    expect(result.capacityInfo.availableSeats).toBe(20);
    expect(result.capacityInfo.isFull).toBe(false);
  });

  it('allows enrollment when existing group meets on a DIFFERENT weekday', () => {
    const studentGroups = [
      {
        id: 'grp-sunday',
        nameAr: 'مجموعة الفيزياء',
        branchId: 'branch-1',
        scheduleDay: 0, // Sunday
        startTime: '14:00',
        endTime: '16:00',
      },
    ];

    const result = checkStudentEnrollmentConflict(candidateGroup, studentGroups, 15);
    expect(result.hasConflict).toBe(false);
    expect(result.canEnroll).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('blocks enrollment when time intervals overlap on the SAME weekday (s1 < e2 && s2 < e1)', () => {
    // Existing: 15:00 - 17:00 (overlaps with 14:00 - 16:00 between 15:00 and 16:00)
    const studentGroups = [
      {
        id: 'grp-overlap',
        nameAr: 'مجموعة الكيمياء',
        branchId: 'branch-1',
        scheduleDay: 1, // Same day
        startTime: '15:00',
        endTime: '17:00',
      },
    ];

    const result = checkStudentEnrollmentConflict(candidateGroup, studentGroups, 15);
    expect(result.hasConflict).toBe(true);
    expect(result.canEnroll).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].code).toBe('STUDENT_SCHEDULE_COLLISION');
    expect(result.errors[0].messageAr).toContain('تعارض زمني');
    expect(result.errors[0].conflictingGroupName).toBe('مجموعة الكيمياء');
  });

  it('allows back-to-back classes with ZERO gap (e.g. 12:00-14:00 and 14:00-16:00)', () => {
    const studentGroups = [
      {
        id: 'grp-before',
        nameAr: 'حصة اللغة العربية',
        branchId: 'branch-1',
        scheduleDay: 1,
        startTime: '12:00',
        endTime: '14:00', // Exactly ends when candidate begins
      },
      {
        id: 'grp-after',
        nameAr: 'حصة اللغة الإنجليزية',
        branchId: 'branch-1',
        scheduleDay: 1,
        startTime: '16:00', // Exactly starts when candidate ends
        endTime: '18:00',
      },
    ];

    const result = checkStudentEnrollmentConflict(candidateGroup, studentGroups, 20);
    expect(result.hasConflict).toBe(false);
    expect(result.canEnroll).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('blocks duplicate enrollment if student is already in the exact same group', () => {
    const studentGroups = [
      {
        id: candidateGroup.id, // Same group
        nameAr: candidateGroup.nameAr,
        branchId: candidateGroup.branchId,
        scheduleDay: candidateGroup.scheduleDay,
        startTime: candidateGroup.startTime,
        endTime: candidateGroup.endTime,
      },
    ];

    const result = checkStudentEnrollmentConflict(candidateGroup, studentGroups, 10);
    expect(result.hasConflict).toBe(true);
    expect(result.canEnroll).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_ENROLLMENT')).toBe(true);
  });

  it('flags CAPACITY_OVERFLOW warning when group is fully booked (currentEnrolled >= maxStudents)', () => {
    const result = checkStudentEnrollmentConflict(candidateGroup, [], 30);
    expect(result.hasConflict).toBe(false); // Warning does not hard-block unless an error exists
    expect(result.canEnroll).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].code).toBe('CAPACITY_OVERFLOW');
    expect(result.capacityInfo.isFull).toBe(true);
    expect(result.capacityInfo.availableSeats).toBe(0);
  });

  it('warns when back-to-back classes are in DIFFERENT branches with tight transit time (<30 mins)', () => {
    const studentGroups = [
      {
        id: 'grp-other-branch',
        nameAr: 'مجموعة فرع المهندسين',
        branchId: 'branch-2', // Different branch
        scheduleDay: 1,
        startTime: '12:30',
        endTime: '13:45', // 15 mins before 14:00 in another branch
      },
    ];

    const result = checkStudentEnrollmentConflict(candidateGroup, studentGroups, 10);
    expect(result.hasConflict).toBe(false);
    expect(result.warnings.some((w) => w.code === 'CROSS_BRANCH_TRANSIT_TIGHT')).toBe(true);
  });

  it('rejects candidate group with invalid time range (endTime <= startTime)', () => {
    const invalidGroup = {
      ...candidateGroup,
      startTime: '16:00',
      endTime: '14:00',
    };

    const result = checkStudentEnrollmentConflict(invalidGroup, [], 5);
    expect(result.hasConflict).toBe(true);
    expect(result.canEnroll).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_TIME_RANGE');
  });
});
