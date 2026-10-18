/**
 * Unit Tests for Timetable & Conflict Detection Engine
 * Path: tests/unit/conflict-detector.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  isTimeOverlapping,
  checkGroupScheduleConflicts,
  checkSessionScheduleConflicts,
  ScheduleCandidate,
} from '@/lib/timetable/conflict-detector';

describe('Timetable Conflict Detection Engine', () => {
  describe('1. Time Conversion & Overlap Primitive Math', () => {
    it('accurately converts "HH:mm" to minutes from midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:30')).toBe(90);
      expect(timeToMinutes('14:00')).toBe(840);
      expect(timeToMinutes('16:15')).toBe(975);
      expect(timeToMinutes('23:59')).toBe(1439);
      expect(timeToMinutes('')).toBe(0);
    });

    it('accurately converts minutes from midnight back to "HH:mm"', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(840)).toBe('14:00');
      expect(minutesToTime(975)).toBe('16:15');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('correctly detects interval overlap: (s1 < e2) && (s2 < e1)', () => {
      // Partial overlap
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '15:00', endTime: '17:00' }
        )
      ).toBe(true);

      // Complete containment (B inside A)
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '14:30', endTime: '15:30' }
        )
      ).toBe(true);

      // Disjoint separate intervals
      expect(
        isTimeOverlapping(
          { startTime: '10:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '16:00' }
        )
      ).toBe(false);

      // Back-to-back with zero gap (endA === startB): MUST NOT OVERLAP
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '16:00', endTime: '18:00' }
        )
      ).toBe(false);

      // Back-to-back inverted (endB === startA): MUST NOT OVERLAP
      expect(
        isTimeOverlapping(
          { startTime: '16:00', endTime: '18:00' },
          { startTime: '14:00', endTime: '16:00' }
        )
      ).toBe(false);
    });
  });

  describe('2. Weekly Recurring Group Conflict Detection', () => {
    const classroomsMap = new Map([
      ['room-101', { nameAr: 'قاعة د. زويل (1)', capacity: 50 }],
      ['room-102', { nameAr: 'قاعة العقاد (2)', capacity: 30 }],
    ]);

    const teachersMap = new Map([
      ['teacher-ahmed', { fullName: 'أ. أحمد الشناوي' }],
      ['teacher-hani', { fullName: 'د. هاني نبيل' }],
    ]);

    const existingGroups = [
      {
        id: 'grp-1',
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        nameAr: 'مجموعة الجبر 3 ثانوي',
        scheduleDay: 6, // Saturday
        startTime: '14:00',
        endTime: '16:00',
        isActive: true,
      },
    ];

    it('rejects classroom double-booking on same day and overlapping time with error', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101', // Same room!
        teacherId: 'teacher-hani', // Different teacher
        dayOfWeek: 6, // Same day
        startTime: '15:00', // Overlaps with 14:00-16:00
        endTime: '17:00',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].code).toBe('CLASSROOM_DOUBLE_BOOKING');
      expect(result.errors[0].messageAr).toContain('قاعة د. زويل (1)');
    });

    it('rejects teacher double-booking even in a DIFFERENT classroom or branch', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-heliopolis', // Different branch!
        classroomId: 'room-102', // Different room!
        teacherId: 'teacher-ahmed', // Same teacher!
        dayOfWeek: 6, // Saturday
        startTime: '14:30', // Overlaps with 14:00-16:00
        endTime: '16:30',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].code).toBe('TEACHER_DOUBLE_BOOKING');
      expect(result.errors[0].messageAr).toContain('أ. أحمد الشناوي');
    });

    it('allows back-to-back scheduling with zero gap in same classroom without conflict', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101', // Same room
        teacherId: 'teacher-hani',
        dayOfWeek: 6,
        startTime: '16:00', // Exactly when previous session ends!
        endTime: '18:00',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(false);
      expect(result.canSchedule).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('allows self-exclusion when updating existing group record', () => {
      const candidate: ScheduleCandidate = {
        id: 'grp-1', // Same id as existing!
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '16:00',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(false);
      expect(result.canSchedule).toBe(true);
    });

    it('produces capacity overflow warning if maxStudents exceeds room capacity', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-102', // capacity: 30
        teacherId: 'teacher-hani',
        dayOfWeek: 0, // Sunday (no existing group)
        startTime: '14:00',
        endTime: '16:00',
        maxStudents: 45, // Exceeds 30!
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(false); // Warning does NOT block
      expect(result.canSchedule).toBe(true);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].code).toBe('CAPACITY_OVERFLOW');
    });

    it('rejects invalid time range where endTime <= startTime', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        dayOfWeek: 6,
        startTime: '16:00',
        endTime: '14:00', // Invalid!
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TIME_RANGE');
    });
  });

  describe('3. Calendar Operational Session Conflict Detection', () => {
    const groupsMap = new Map([
      ['grp-1', { nameAr: 'مجموعة التفاضل والتكامل' }],
      ['grp-2', { nameAr: 'مجموعة الكيمياء' }],
    ]);

    const classroomsMap = new Map([
      ['room-101', { nameAr: 'قاعة د. زويل (1)' }],
    ]);

    const teachersMap = new Map([
      ['teacher-ahmed', { fullName: 'أ. أحمد الشناوي' }],
    ]);

    const existingSessions = [
      {
        id: 'sess-active',
        tenantId: 'tenant-maher-001',
        groupId: 'grp-1',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        sessionDate: '2026-10-24',
        startTime: '14:00',
        endTime: '16:00',
        status: 'scheduled',
      },
      {
        id: 'sess-canceled',
        tenantId: 'tenant-maher-001',
        groupId: 'grp-2',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        sessionDate: '2026-10-25',
        startTime: '14:00',
        endTime: '16:00',
        status: 'canceled', // Canceled!
      },
    ];

    it('bypasses canceled sessions allowing room and teacher re-booking without conflict', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        sessionDate: '2026-10-25', // Same date as canceled session!
        startTime: '14:00',
        endTime: '16:00',
      };

      const result = checkSessionScheduleConflicts(
        candidate,
        existingSessions,
        groupsMap,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(false);
      expect(result.canSchedule).toBe(true);
    });

    it('rejects double-booking active operational calendar session', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'tenant-maher-001',
        branchId: 'branch-nasr',
        classroomId: 'room-101',
        teacherId: 'teacher-ahmed',
        sessionDate: '2026-10-24',
        startTime: '14:30',
        endTime: '16:30',
      };

      const result = checkSessionScheduleConflicts(
        candidate,
        existingSessions,
        groupsMap,
        classroomsMap,
        teachersMap
      );

      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});
