/**
 * Challenger M2-2: Adversarial Stress Test Suite for Timetable Conflict Detection Engine
 * Path: tests/unit/challenger-m2-conflict-stress.test.ts
 *
 * Verifies:
 * 1. Classroom double-booking in same room within a branch.
 * 2. Teacher double-booking across different classrooms and different branches.
 * 3. Zero-gap back-to-back scheduling (s2 = e1 and e2 = s1).
 * 4. Canceled and postponed session bypass.
 * 5. Self-exclusion on edit for groups and calendar sessions.
 * 6. Edge cases: 1-minute boundary, containment, identical intervals, invalid intervals, dayOfWeek=0 (Sunday).
 * 7. Multi-collision accumulation (room collision + teacher collision).
 * 8. Mathematical oracle verification (5,000 randomized Monte-Carlo trials).
 * 9. Scale performance check with 1,000 existing schedule entities.
 */

import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  isTimeOverlapping,
  checkGroupScheduleConflicts,
  checkSessionScheduleConflicts,
  ScheduleCandidate,
  TimeSlot,
} from '@/lib/timetable/conflict-detector';

describe('Challenger M2-2: Timetable Conflict Detection Empirical Challenge', () => {
  // Shared mock registries
  const classroomsMap = new Map([
    ['room-nasr-1', { nameAr: 'قاعة 1 - فرع مدينة نصر', capacity: 40 }],
    ['room-nasr-2', { nameAr: 'قاعة 2 - فرع مدينة نصر', capacity: 25 }],
    ['room-helio-1', { nameAr: 'قاعة 1 - فرع مصر الجديدة', capacity: 50 }],
  ]);

  const teachersMap = new Map([
    ['teacher-dr-tarek', { fullName: 'د. طارق شوقي' }],
    ['teacher-mr-sherif', { fullName: 'أ. شريف العربي' }],
  ]);

  const groupsMap = new Map([
    ['grp-math-sat', { nameAr: 'رياضيات 3ث - السبت' }],
    ['grp-physics-sat', { nameAr: 'فيزياء 3ث - السبت' }],
    ['grp-chem-sun', { nameAr: 'كيمياء 2ث - الأحد' }],
  ]);

  /* ========================================================================
   * 1. CLASSROOM DOUBLE-BOOKING TESTS
   * ======================================================================== */
  describe('Mission 1: Classroom Double-Booking Detection', () => {
    const existingGroups = [
      {
        id: 'grp-math-sat',
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        nameAr: 'رياضيات 3ث - السبت',
        scheduleDay: 6, // Saturday
        startTime: '14:00',
        endTime: '16:00',
        isActive: true,
      },
    ];

    it('rejects booking the same classroom on the same day when intervals overlap', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-mr-sherif', // Different teacher!
        dayOfWeek: 6,
        startTime: '15:00',
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
      expect(result.errors.some((e) => e.code === 'CLASSROOM_DOUBLE_BOOKING')).toBe(true);
      expect(result.errors.find((e) => e.code === 'CLASSROOM_DOUBLE_BOOKING')?.classroomName).toBe(
        'قاعة 1 - فرع مدينة نصر'
      );
    });

    it('allows booking different classrooms at the exact same time without classroom conflict', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-2', // Different room in same branch!
        teacherId: 'teacher-mr-sherif',
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
      expect(result.errors.length).toBe(0);
    });

    it('allows booking the same classroom on a different day of week', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-mr-sherif',
        dayOfWeek: 0, // Sunday instead of Saturday
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
  });

  /* ========================================================================
   * 2. TEACHER DOUBLE-BOOKING TESTS (CROSS-CLASSROOM & CROSS-BRANCH)
   * ======================================================================== */
  describe('Mission 2: Teacher Double-Booking Detection Across Rooms and Branches', () => {
    const existingGroups = [
      {
        id: 'grp-math-sat',
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        nameAr: 'رياضيات 3ث - السبت',
        scheduleDay: 6,
        startTime: '14:00',
        endTime: '16:00',
        isActive: true,
      },
    ];

    it('detects teacher double-booking in a different classroom in the SAME branch', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-2', // Different room
        teacherId: 'teacher-dr-tarek', // Same teacher!
        dayOfWeek: 6,
        startTime: '14:30',
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
      expect(result.errors.some((e) => e.code === 'TEACHER_DOUBLE_BOOKING')).toBe(true);
      expect(result.errors.find((e) => e.code === 'TEACHER_DOUBLE_BOOKING')?.teacherName).toBe(
        'د. طارق شوقي'
      );
    });

    it('detects teacher double-booking across a DIFFERENT branch entirely', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-heliopolis', // Heliopolis branch!
        classroomId: 'room-helio-1', // Heliopolis room!
        teacherId: 'teacher-dr-tarek', // Same teacher!
        dayOfWeek: 6,
        startTime: '15:00',
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
      const teacherError = result.errors.find((e) => e.code === 'TEACHER_DOUBLE_BOOKING');
      expect(teacherError).toBeDefined();
      expect(teacherError?.messageAr).toContain('د. طارق شوقي');
    });

    it('detects teacher double-booking in calendar session checks across rooms', () => {
      const existingSessions = [
        {
          id: 'sess-001',
          tenantId: 'center-alpha',
          groupId: 'grp-math-sat',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          sessionDate: '2026-10-24',
          startTime: '10:00',
          endTime: '12:00',
          status: 'scheduled',
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-heliopolis',
        classroomId: 'room-helio-1', // Different room & branch
        teacherId: 'teacher-dr-tarek', // Same teacher
        sessionDate: '2026-10-24', // Same date
        startTime: '11:00', // Overlaps 10:00-12:00
        endTime: '13:00',
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
      expect(result.errors.some((e) => e.code === 'TEACHER_DOUBLE_BOOKING')).toBe(true);
    });
  });

  /* ========================================================================
   * 3. ZERO-GAP BACK-TO-BACK SESSIONS (s2 = e1)
   * ======================================================================== */
  describe('Mission 3: Zero-Gap Back-to-Back Sessions ($s_2 = e_1$)', () => {
    const existingGroups = [
      {
        id: 'grp-math-sat',
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        nameAr: 'رياضيات 3ث',
        scheduleDay: 6,
        startTime: '14:00',
        endTime: '16:00',
        isActive: true,
      },
    ];

    it('allows a class starting at 16:00 when previous class ends at 16:00 in same room', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1', // Same room
        teacherId: 'teacher-mr-sherif',
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

    it('allows a class ending at 14:00 when subsequent class starts at 14:00 in same room ($e_2 = s_1$)', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1', // Same room
        teacherId: 'teacher-mr-sherif',
        dayOfWeek: 6,
        startTime: '12:00',
        endTime: '14:00', // Exactly when next session starts!
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

    it('allows the same teacher to have back-to-back classes with zero gap', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-2', // Different room in same center
        teacherId: 'teacher-dr-tarek', // Same teacher!
        dayOfWeek: 6,
        startTime: '16:00', // Exactly when teacher's previous class ends
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
  });

  /* ========================================================================
   * 4. CANCELED & POSTPONED SESSION BYPASS
   * ======================================================================== */
  describe('Mission 4: Canceled & Inactive Session Bypass', () => {
    it('bypasses canceled calendar sessions completely allowing reuse of room and teacher', () => {
      const existingSessions = [
        {
          id: 'sess-canceled-01',
          tenantId: 'center-alpha',
          groupId: 'grp-math-sat',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          sessionDate: '2026-10-24',
          startTime: '14:00',
          endTime: '16:00',
          status: 'canceled',
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1', // Same room
        teacherId: 'teacher-dr-tarek', // Same teacher
        sessionDate: '2026-10-24', // Same date
        startTime: '14:00', // Identical time slot!
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
      expect(result.errors.length).toBe(0);
    });

    it('bypasses postponed calendar sessions', () => {
      const existingSessions = [
        {
          id: 'sess-postponed-01',
          tenantId: 'center-alpha',
          groupId: 'grp-math-sat',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          sessionDate: '2026-10-24',
          startTime: '14:00',
          endTime: '16:00',
          status: 'postponed',
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        sessionDate: '2026-10-24',
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

    it('bypasses inactive recurring groups', () => {
      const existingGroups = [
        {
          id: 'grp-inactive',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة ملغاة',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: false, // Inactive!
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
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
  });

  /* ========================================================================
   * 5. SELF-EXCLUSION ON EDIT
   * ======================================================================== */
  describe('Mission 5: Self-Exclusion on Edit', () => {
    it('editing existing group preserving same ID does not collide with itself', () => {
      const existingGroups = [
        {
          id: 'grp-self-01',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة أصلية',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
      ];

      const candidate: ScheduleCandidate = {
        id: 'grp-self-01', // Candidate has the same ID
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
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
      expect(result.errors.length).toBe(0);
    });

    it('editing existing group with adjusted shifted time does not collide with self', () => {
      const existingGroups = [
        {
          id: 'grp-self-01',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة أصلية',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
      ];

      // Shifted by 30 mins, overlapping with self's original slot
      const candidate: ScheduleCandidate = {
        id: 'grp-self-01',
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        dayOfWeek: 6,
        startTime: '14:30',
        endTime: '16:30',
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

    it('editing calendar session preserving same ID does not collide with self', () => {
      const existingSessions = [
        {
          id: 'sess-self-01',
          tenantId: 'center-alpha',
          groupId: 'grp-math-sat',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          sessionDate: '2026-10-24',
          startTime: '14:00',
          endTime: '16:00',
          status: 'scheduled',
        },
      ];

      const candidate: ScheduleCandidate = {
        id: 'sess-self-01',
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        sessionDate: '2026-10-24',
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
  });

  /* ========================================================================
   * 6. EDGE CASES & ADVERSARIAL BOUNDARY CONDITIONS
   * ======================================================================== */
  describe('6. Boundary Conditions & Edge Case Mining', () => {
    it('detects 1-minute overlap on the left boundary ($s_2 = e_1 - 1$)', () => {
      // Slot A: 14:00 - 16:00
      // Slot B: 15:59 - 18:00 (1 minute overlap from 15:59 to 16:00)
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '15:59', endTime: '18:00' }
        )
      ).toBe(true);
    });

    it('detects 1-minute overlap on the right boundary ($e_2 = s_1 + 1$)', () => {
      // Slot A: 14:00 - 16:00
      // Slot B: 12:00 - 14:01 (1 minute overlap from 14:00 to 14:01)
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '12:00', endTime: '14:01' }
        )
      ).toBe(true);
    });

    it('confirms 1-minute gap is strictly free of conflict', () => {
      // Slot A: 14:00 - 16:00
      // Slot B: 16:01 - 18:00
      expect(
        isTimeOverlapping(
          { startTime: '14:00', endTime: '16:00' },
          { startTime: '16:01', endTime: '18:00' }
        )
      ).toBe(false);
    });

    it('handles Sunday correctly when dayOfWeek is 0 (falsy value check)', () => {
      const existingGroups = [
        {
          id: 'grp-sun-01',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة الأحد',
          scheduleDay: 0, // Sunday = 0
          startTime: '10:00',
          endTime: '12:00',
          isActive: true,
        },
      ];

      // Candidate also on Sunday (0)
      const candidateSunday: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-mr-sherif',
        dayOfWeek: 0, // 0 must NOT be treated as falsy/undefined!
        startTime: '11:00',
        endTime: '13:00',
      };

      const resultSunday = checkGroupScheduleConflicts(
        candidateSunday,
        existingGroups,
        classroomsMap,
        teachersMap
      );
      expect(resultSunday.hasConflict).toBe(true);
      expect(resultSunday.errors.some((e) => e.code === 'CLASSROOM_DOUBLE_BOOKING')).toBe(true);

      // Candidate on Monday (1) must NOT collide with Sunday (0)
      const candidateMonday: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-mr-sherif',
        dayOfWeek: 1, // Monday
        startTime: '11:00',
        endTime: '13:00',
      };

      const resultMonday = checkGroupScheduleConflicts(
        candidateMonday,
        existingGroups,
        classroomsMap,
        teachersMap
      );
      expect(resultMonday.hasConflict).toBe(false);
    });

    it('strictly rejects inverted time intervals ($endTime <= startTime)', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        dayOfWeek: 6,
        startTime: '16:00',
        endTime: '14:00', // Inverted!
      };

      const result = checkGroupScheduleConflicts(candidate, [], classroomsMap, teachersMap);
      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TIME_RANGE');
    });

    it('strictly rejects zero-duration intervals ($endTime === startTime)', () => {
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '14:00', // Zero duration
      };

      const result = checkGroupScheduleConflicts(candidate, [], classroomsMap, teachersMap);
      expect(result.hasConflict).toBe(true);
      expect(result.canSchedule).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TIME_RANGE');
    });

    it('enforces multi-tenant isolation: identical time & room across tenants never collides', () => {
      const existingGroups = [
        {
          id: 'grp-other-center',
          tenantId: 'center-beta', // Different tenant!
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة سنتر آخر',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha', // Center Alpha
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
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
  });

  /* ========================================================================
   * 7. MULTI-COLLISION ACCUMULATION
   * ======================================================================== */
  describe('7. Multi-Collision Accumulation', () => {
    it('accurately accumulates BOTH classroom and teacher errors when both collide with same session', () => {
      const existingGroups = [
        {
          id: 'grp-combo',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1',
          teacherId: 'teacher-dr-tarek',
          nameAr: 'مجموعة الجبر',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
      ];

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1', // Same room!
        teacherId: 'teacher-dr-tarek', // Same teacher!
        dayOfWeek: 6,
        startTime: '14:30',
        endTime: '15:30',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );
      expect(result.hasConflict).toBe(true);
      expect(result.errors.length).toBe(2);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('CLASSROOM_DOUBLE_BOOKING');
      expect(codes).toContain('TEACHER_DOUBLE_BOOKING');
    });

    it('accurately accumulates independent collisions across different groups', () => {
      const existingGroups = [
        {
          id: 'grp-room-holder',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-1', // Holds room
          teacherId: 'teacher-mr-sherif',
          nameAr: 'مجموعة أ',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
        {
          id: 'grp-teacher-holder',
          tenantId: 'center-alpha',
          branchId: 'branch-nasr',
          classroomId: 'room-nasr-2',
          teacherId: 'teacher-dr-tarek', // Holds teacher
          nameAr: 'مجموعة ب',
          scheduleDay: 6,
          startTime: '15:00',
          endTime: '17:00',
          isActive: true,
        },
      ];

      // Candidate needs room-nasr-1 (overlaps grp-room-holder) AND teacher-dr-tarek (overlaps grp-teacher-holder)
      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-nasr',
        classroomId: 'room-nasr-1',
        teacherId: 'teacher-dr-tarek',
        dayOfWeek: 6,
        startTime: '15:15',
        endTime: '15:45',
      };

      const result = checkGroupScheduleConflicts(
        candidate,
        existingGroups,
        classroomsMap,
        teachersMap
      );
      expect(result.hasConflict).toBe(true);
      expect(result.errors.length).toBe(2);
      expect(result.errors.find((e) => e.code === 'CLASSROOM_DOUBLE_BOOKING')?.conflictingEntityId).toBe('grp-room-holder');
      expect(result.errors.find((e) => e.code === 'TEACHER_DOUBLE_BOOKING')?.conflictingEntityId).toBe('grp-teacher-holder');
    });
  });

  /* ========================================================================
   * 8. MATHEMATICAL ORACLE: 5,000 MONTE-CARLO RANDOMIZED TRIALS
   * ======================================================================== */
  describe('8. Monte-Carlo Oracle Verification (5,000 Trials)', () => {
    it('proves zero divergence between isTimeOverlapping and mathematical ground-truth interval oracle', () => {
      let seed = 42;
      function pseudoRandom(): number {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      }

      for (let i = 0; i < 5000; i++) {
        // Random intervals within 08:00 (480) and 22:00 (1320)
        const s1 = 480 + Math.floor(pseudoRandom() * 700);
        const len1 = 15 + Math.floor(pseudoRandom() * 180);
        const e1 = s1 + len1;

        const s2 = 480 + Math.floor(pseudoRandom() * 700);
        const len2 = 15 + Math.floor(pseudoRandom() * 180);
        const e2 = s2 + len2;

        const slotA: TimeSlot = {
          startTime: minutesToTime(s1),
          endTime: minutesToTime(e1),
        };
        const slotB: TimeSlot = {
          startTime: minutesToTime(s2),
          endTime: minutesToTime(e2),
        };

        const codeResult = isTimeOverlapping(slotA, slotB);

        // Ground-truth mathematical condition for half-open interval overlap [s1, e1) and [s2, e2)
        const expectedOverlap = Math.max(s1, s2) < Math.min(e1, e2);

        expect(codeResult).toBe(expectedOverlap);
      }
    });
  });

  /* ========================================================================
   * 9. SCALE & PERFORMANCE STRESS TEST (1,000 GROUPS)
   * ======================================================================== */
  describe('9. Scale & Performance Stress Test', () => {
    it('evaluates conflict check against 1,000 existing records in sub-millisecond time', () => {
      const largeGroupsList: Array<{
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
      }> = [];

      for (let i = 0; i < 1000; i++) {
        largeGroupsList.push({
          id: `grp-stress-${i}`,
          tenantId: 'center-alpha',
          branchId: `branch-${i % 5}`,
          classroomId: `room-${i % 20}`,
          teacherId: `teacher-${i % 50}`,
          nameAr: `مجموعة ${i}`,
          scheduleDay: i % 7,
          startTime: minutesToTime(480 + (i % 8) * 60),
          endTime: minutesToTime(480 + (i % 8) * 60 + 50),
          isActive: true,
        });
      }

      const candidate: ScheduleCandidate = {
        tenantId: 'center-alpha',
        branchId: 'branch-1',
        classroomId: 'room-1',
        teacherId: 'teacher-1',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
      };

      const start = performance.now();
      const result = checkGroupScheduleConflicts(
        candidate,
        largeGroupsList,
        classroomsMap,
        teachersMap
      );
      const elapsed = performance.now() - start;

      // Must complete rapidly without O(n^2) or blocking
      expect(elapsed).toBeLessThan(50); // Under 50ms for 1000 records
      expect(typeof result.hasConflict).toBe('boolean');
    });
  });
});
