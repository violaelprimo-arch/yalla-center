import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import type { GroupInput } from '@/lib/dal/types';
import {
  calculateCenterSubscriptionCompensation,
  calculatePrivateLessonsSplit,
  calculatePerSessionFixedSplit,
} from '@/lib/finance/compensation';
import { checkGroupScheduleConflicts, type ScheduleCandidate } from '@/lib/timetable/conflict-detector';

describe('Sessions & Groups Management, Multi-Session Timetables & 3 Financial Calculation Models', () => {
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  describe('1. Multi-Session Group Creation & Scheduling', () => {
    it('creates a group with multiple sessions per week (e.g. 2 sessions: Saturday and Tuesday)', async () => {
      const input: GroupInput = {
        nameAr: 'مجموعة النجوم - فيزياء متقدمة',
        stage: 'secondary',
        grade: '3_sec',
        subjectId: 'sub-phys-3sec',
        teacherId: 'user-teacher-phys',
        branchId: 'branch-nasr-city',
        pricingModel: 'average_monthly',
        teacherRatePerStudent: 25,
        monthlyFee: 200,
        maxStudents: 45,
        weeklySchedules: [
          {
            dayOfWeek: 6, // Saturday
            startTime: '14:00',
            endTime: '16:00',
            classroomId: 'room-102',
            branchId: 'branch-nasr-city',
          },
          {
            dayOfWeek: 2, // Tuesday
            startTime: '16:00',
            endTime: '18:00',
            classroomId: 'room-102',
            branchId: 'branch-nasr-city',
          },
        ],
      };

      const savedGroup = await dal.saveGroup(tenantId, input);

      expect(savedGroup.id).toBeDefined();
      expect(savedGroup.nameAr).toBe('مجموعة النجوم - فيزياء متقدمة');
      expect(savedGroup.weeklySchedules).toHaveLength(2);
      expect(savedGroup.weeklySchedules![0].dayOfWeek).toBe(6);
      expect(savedGroup.weeklySchedules![1].dayOfWeek).toBe(2);
      expect(savedGroup.pricingModel).toBe('average_monthly');
      expect(savedGroup.teacherRatePerStudent).toBe(25);

      // Verify that upcoming scheduled sessions were automatically generated for both weekly slots
      const groupSessions = await dal.getSessions(tenantId, { groupId: savedGroup.id });
      expect(groupSessions.length).toBeGreaterThanOrEqual(4);
      expect(groupSessions.some((s) => s.startTime === '14:00')).toBe(true);
      expect(groupSessions.some((s) => s.startTime === '16:00')).toBe(true);
    });

    it('creates a single-session group and maintains backward compatible fields', async () => {
      const input: GroupInput = {
        nameAr: 'مجموعة التفوق - كيمياء أسبوعية',
        stage: 'secondary',
        grade: '3_sec',
        subjectId: 'sub-chem-3sec',
        teacherId: 'user-teacher-math',
        branchId: 'branch-nasr-city',
        pricingModel: 'per_session_fixed',
        teacherSessionAmount: 50,
        centerSessionAmount: 25,
        weeklySchedules: [
          {
            dayOfWeek: 4, // Thursday
            startTime: '10:00',
            endTime: '12:00',
            classroomId: 'room-101',
          },
        ],
      };

      const saved = await dal.saveGroup(tenantId, input);
      expect(saved.scheduleDay).toBe(4);
      expect(saved.startTime).toBe('10:00');
      expect(saved.endTime).toBe('12:00');
      expect(saved.sessionFee).toBe(75); // 50 + 25
      expect(saved.teacherSessionAmount).toBe(50);
      expect(saved.centerSessionAmount).toBe(25);
    });

    it('deleting a group cleans up its future scheduled sessions', async () => {
      const input: GroupInput = {
        nameAr: 'مجموعة مؤقتة للحذف',
        stage: 'secondary',
        grade: '3_sec',
        subjectId: 'sub-math-3sec',
        teacherId: 'user-teacher-math',
        branchId: 'branch-nasr-city',
        pricingModel: 'average_monthly',
        weeklySchedules: [
          {
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '14:00',
            classroomId: 'room-101',
          },
        ],
      };

      const created = await dal.saveGroup(tenantId, input);
      const sessionsBefore = (await dal.getSessions(tenantId, { groupId: created.id })).length;
      expect(sessionsBefore).toBeGreaterThan(0);

      const deleteRes = await dal.deleteGroup(tenantId, created.id);
      expect(deleteRes.success).toBe(true);

      const groupAfter = await dal.getGroupById(tenantId, created.id);
      expect(groupAfter).toBeNull();

      const sessionsAfter = (await dal.getSessions(tenantId, { groupId: created.id })).filter(
        (s) => s.status === 'scheduled'
      );
      expect(sessionsAfter).toHaveLength(0);
    });
  });

  describe('2. Multi-Session Conflict Detection', () => {
    it('detects classroom collision on any of the weekly slots', () => {
      const classroomsMap = new Map([
        ['room-101', { nameAr: 'قاعة د. زويل (1)', capacity: 60 }],
        ['room-102', { nameAr: 'قاعة العقاد (2)', capacity: 40 }],
      ]);
      const teachersMap = new Map([
        ['user-teacher-math', { fullName: 'أ. أحمد الشناوي' }],
        ['user-teacher-phys', { fullName: 'د. هاني نبيل' }],
      ]);

      const existingGroups = [
        {
          id: 'grp-existing-1',
          tenantId,
          branchId: 'branch-nasr-city',
          classroomId: 'room-101',
          teacherId: 'user-teacher-math',
          nameAr: 'مجموعة الرياضيات الحالية',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
          weeklySchedules: [
            { dayOfWeek: 6, startTime: '14:00', endTime: '16:00', classroomId: 'room-101' },
            { dayOfWeek: 2, startTime: '16:00', endTime: '18:00', classroomId: 'room-101' },
          ],
        },
      ];

      // Candidate has 2 slots, slot 2 clashes on Tuesday 16:00-18:00 in room-101
      const candidate: ScheduleCandidate = {
        tenantId,
        branchId: 'branch-nasr-city',
        classroomId: 'room-101',
        teacherId: 'user-teacher-phys',
        startTime: '10:00',
        endTime: '12:00',
        weeklySchedules: [
          { dayOfWeek: 0, startTime: '10:00', endTime: '12:00', classroomId: 'room-101' },
          { dayOfWeek: 2, startTime: '16:30', endTime: '18:30', classroomId: 'room-101' }, // Overlaps 16:00-18:00
        ],
      };

      const result = checkGroupScheduleConflicts(candidate, existingGroups, classroomsMap, teachersMap);
      expect(result.hasConflict).toBe(true);
      expect(result.errors.some((e) => e.code === 'CLASSROOM_DOUBLE_BOOKING')).toBe(true);
    });

    it('detects teacher collision across different classrooms on the same day/time', () => {
      const classroomsMap = new Map([
        ['room-101', { nameAr: 'قاعة 1', capacity: 60 }],
        ['room-102', { nameAr: 'قاعة 2', capacity: 40 }],
      ]);
      const teachersMap = new Map([['user-teacher-math', { fullName: 'أ. أحمد الشناوي' }]]);

      const existingGroups = [
        {
          id: 'grp-existing-math',
          tenantId,
          branchId: 'branch-nasr-city',
          classroomId: 'room-101',
          teacherId: 'user-teacher-math',
          nameAr: 'مجموعة رياضيات أ',
          scheduleDay: 6,
          startTime: '14:00',
          endTime: '16:00',
          isActive: true,
        },
      ];

      // Same teacher scheduled in room-102 at the same time
      const candidate: ScheduleCandidate = {
        tenantId,
        branchId: 'branch-nasr-city',
        classroomId: 'room-102',
        teacherId: 'user-teacher-math',
        startTime: '14:30',
        endTime: '16:30',
        dayOfWeek: 6,
      };

      const result = checkGroupScheduleConflicts(candidate, existingGroups, classroomsMap, teachersMap);
      expect(result.hasConflict).toBe(true);
      expect(result.errors.some((e) => e.code === 'TEACHER_DOUBLE_BOOKING')).toBe(true);
    });
  });

  describe('3. Three Financial Calculation Models', () => {
    it('Model 1: نظام المتوسط — Average Attendance × Teacher Rate per Student', () => {
      // Example specified by user: 20 EGP rate per student, average 100 students = 2,000 EGP salary
      const mockSessions = [
        { validAttendanceCount: 90, isCanceled: false },
        { validAttendanceCount: 110, isCanceled: false },
        { validAttendanceCount: 100, isCanceled: false },
        { validAttendanceCount: 100, isCanceled: false },
      ];

      const ratePerStudent = 20; // 20 EGP
      const result = calculateCenterSubscriptionCompensation(mockSessions, ratePerStudent);

      expect(result.conductedSessions).toBe(4);
      expect(result.totalValidAttendance).toBe(400);
      expect(result.averageAttendance).toBe(100);
      expect(result.totalCompensation).toBe(2000); // 20 * 100 = 2000 EGP
    });

    it('Model 2: نظام البرايفت — Monthly Fee Split by Teacher % and Center % (Zero Leakage)', () => {
      // Example specified by user: Student pays 300 EGP, teacher gets 70% (210 EGP), center gets 30% (90 EGP)
      const studentMonthlyFee = 300;
      const teacherPercent = 70;
      const centerPercent = 30;

      const split = calculatePrivateLessonsSplit(
        studentMonthlyFee,
        'NONE',
        0,
        teacherPercent,
        centerPercent
      );

      expect(split.netRevenue).toBe(300);
      expect(split.teacherShare).toBe(210);
      expect(split.centerShare).toBe(90);
      expect(split.teacherShare + split.centerShare).toBe(split.netRevenue);
    });

    it('Model 3: نظام الدفع بالحصة — Fixed EGP Amounts for Teacher and Center per Session', () => {
      // Example specified by user: Fixed amounts in EGP agreed with administration
      // Teacher gets 40 EGP fixed, Center gets 20 EGP fixed, Total student fee = 60 EGP
      const teacherSessionAmount = 40;
      const centerSessionAmount = 20;
      const attendanceCount = 25;

      const result = calculatePerSessionFixedSplit(
        attendanceCount,
        teacherSessionAmount,
        centerSessionAmount
      );

      expect(result.sessionFee).toBe(60); // 40 + 20
      expect(result.grossRevenue).toBe(1500); // 25 * 60
      expect(result.totalTeacherDue).toBe(1000); // 25 * 40
      expect(result.totalCenterNet).toBe(500); // 25 * 20
      expect(result.totalTeacherDue + result.totalCenterNet).toBe(result.grossRevenue);
    });
  });
});
