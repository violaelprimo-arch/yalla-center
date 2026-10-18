import { describe, it, expect } from 'vitest';
import {
  calculateCenterSubscriptionCompensation,
  calculatePrivateLessonsSplit,
  SessionRecord,
} from '../fixtures/contract-bridge';

describe('Tier 1: Dual Teacher Compensation Engine (AC-1 & AC-2)', () => {
  describe('AC-1: Center Subscription Compensation Formula (نظام السنتر)', () => {
    it('calculates exactly 260 EGP for 4 conducted classes [12, 15, 11, 14] at rate 20 EGP', () => {
      const sessions: SessionRecord[] = [
        { sessionId: 'sess-01', attendanceCount: 12, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-02', attendanceCount: 15, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-03', attendanceCount: 11, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-04', attendanceCount: 14, isCanceled: false, sessionStatus: 'completed' },
      ];
      const ratePerStudent = 20;

      const result = calculateCenterSubscriptionCompensation(sessions, ratePerStudent);

      expect(result.conductedSessions).toBe(4);
      expect(result.totalValidAttendance).toBe(52);
      expect(result.averageAttendance).toBe(13);
      expect(result.totalCompensation).toBe(260.0);
    });

    it('strictly excludes canceled and postponed sessions from numerator and denominator', () => {
      const sessions: SessionRecord[] = [
        { sessionId: 'sess-01', attendanceCount: 12, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-02', attendanceCount: 15, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-03', attendanceCount: 11, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-04', attendanceCount: 14, isCanceled: false, sessionStatus: 'completed' },
        // Canceled sessions must NOT skew the average or count toward conducted sessions
        { sessionId: 'sess-05', attendanceCount: 18, isCanceled: true, sessionStatus: 'canceled' },
        { sessionId: 'sess-06', attendanceCount: 22, isCanceled: false, sessionStatus: 'canceled' },
        { sessionId: 'sess-07', attendanceCount: 0, isCanceled: false, sessionStatus: 'postponed' },
      ];
      const ratePerStudent = 20;

      const result = calculateCenterSubscriptionCompensation(sessions, ratePerStudent);

      expect(result.conductedSessions).toBe(4);
      expect(result.excludedSessionsCount).toBe(3);
      expect(result.totalValidAttendance).toBe(52);
      expect(result.averageAttendance).toBe(13);
      expect(result.totalCompensation).toBe(260.0);
    });

    it('returns 0 without error when zero sessions conducted (division-by-zero safeguard)', () => {
      const emptySessions: SessionRecord[] = [];
      const ratePerStudent = 20;

      const resultEmpty = calculateCenterSubscriptionCompensation(emptySessions, ratePerStudent);
      expect(resultEmpty.conductedSessions).toBe(0);
      expect(resultEmpty.averageAttendance).toBe(0);
      expect(resultEmpty.totalCompensation).toBe(0);
      expect(Number.isNaN(resultEmpty.averageAttendance)).toBe(false);
      expect(Number.isNaN(resultEmpty.totalCompensation)).toBe(false);

      const allCanceledSessions: SessionRecord[] = [
        { sessionId: 'sess-c1', attendanceCount: 0, isCanceled: true, sessionStatus: 'canceled' },
        { sessionId: 'sess-c2', attendanceCount: 0, isCanceled: false, sessionStatus: 'postponed' },
      ];

      const resultCanceled = calculateCenterSubscriptionCompensation(
        allCanceledSessions,
        ratePerStudent
      );
      expect(resultCanceled.conductedSessions).toBe(0);
      expect(resultCanceled.averageAttendance).toBe(0);
      expect(resultCanceled.totalCompensation).toBe(0);
    });

    it('handles fractional average attendances with exact 2-decimal rounding', () => {
      // 3 conducted sessions with attendances [10, 11, 10] -> Total = 31, Average = 10.3333...
      const sessions: SessionRecord[] = [
        { sessionId: 'sess-f1', attendanceCount: 10, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-f2', attendanceCount: 11, isCanceled: false, sessionStatus: 'completed' },
        { sessionId: 'sess-f3', attendanceCount: 10, isCanceled: false, sessionStatus: 'completed' },
      ];
      const ratePerStudent = 25; // 31 / 3 * 25 = 775 / 3 = 258.3333...

      const result = calculateCenterSubscriptionCompensation(sessions, ratePerStudent);

      expect(result.conductedSessions).toBe(3);
      expect(result.totalValidAttendance).toBe(31);
      expect(result.averageAttendance).toBe(10.33);
      expect(result.totalCompensation).toBe(258.33);
    });

    it('throws error when contractual fixed rate is negative', () => {
      const sessions: SessionRecord[] = [
        { sessionId: 'sess-neg', attendanceCount: 10, isCanceled: false, sessionStatus: 'completed' },
      ];
      expect(() => calculateCenterSubscriptionCompensation(sessions, -15)).toThrow(
        /cannot be negative/i
      );
    });
  });

  describe('AC-2: Private Lessons Compensation Split Formula (نظام البرايفت)', () => {
    it('calculates exact 70 EGP Teacher / 30 EGP Center split for 100 EGP gross with 70/30 split and no discount', () => {
      const result = calculatePrivateLessonsSplit(100, 'NONE', 0, 70, 30);

      expect(result.grossPrice).toBe(100);
      expect(result.discountAmount).toBe(0);
      expect(result.netRevenue).toBe(100);
      expect(result.teacherShare).toBe(70.0);
      expect(result.centerShare).toBe(30.0);
      expect(result.teacherShare + result.centerShare).toBe(result.netRevenue);
    });

    it('calculates exact 56 EGP Teacher / 24 EGP Center for 100 EGP gross with 20% discount and 70/30 split', () => {
      const result = calculatePrivateLessonsSplit(100, 'PERCENT', 20, 70, 30);

      expect(result.grossPrice).toBe(100);
      expect(result.discountAmount).toBe(20.0);
      expect(result.netRevenue).toBe(80.0);
      expect(result.teacherShare).toBe(56.0);
      expect(result.centerShare).toBe(24.0);
      expect(result.teacherShare + result.centerShare).toBe(result.netRevenue);
    });

    it('calculates exact 0 EGP Teacher / 0 EGP Center for 100% free scholarship enrollment with zero leakage', () => {
      const result = calculatePrivateLessonsSplit(100, 'SCHOLARSHIP_100', 0, 70, 30);

      expect(result.grossPrice).toBe(100);
      expect(result.discountAmount).toBe(100);
      expect(result.netRevenue).toBe(0);
      expect(result.teacherShare).toBe(0);
      expect(result.centerShare).toBe(0);
      expect(result.teacherShare + result.centerShare).toBe(0);
    });

    it('calculates fixed amount discount correctly (e.g. 100 EGP with 35 EGP fixed discount)', () => {
      const result = calculatePrivateLessonsSplit(100, 'FIXED', 35, 70, 30);

      expect(result.grossPrice).toBe(100);
      expect(result.discountAmount).toBe(35);
      expect(result.netRevenue).toBe(65);
      expect(result.teacherShare).toBe(45.5);
      expect(result.centerShare).toBe(19.5);
      expect(result.teacherShare + result.centerShare).toBe(65);
    });

    it('guarantees ZERO rounding leakage across adversarial odd amounts and fractions', () => {
      const testCases = [
        { price: 99.99, type: 'NONE' as const, val: 0, teacher: 70, center: 30 },
        { price: 133.33, type: 'PERCENT' as const, val: 15, teacher: 65, center: 35 },
        { price: 250.0, type: 'PERCENT' as const, val: 33.33, teacher: 75, center: 25 },
        { price: 47.5, type: 'FIXED' as const, val: 12.75, teacher: 80, center: 20 },
        { price: 189.95, type: 'PERCENT' as const, val: 17.5, teacher: 70, center: 30 },
        { price: 333.33, type: 'FIXED' as const, val: 45.45, teacher: 60, center: 40 },
      ];

      for (const tc of testCases) {
        const result = calculatePrivateLessonsSplit(
          tc.price,
          tc.type,
          tc.val,
          tc.teacher,
          tc.center
        );

        // Strict Invariant: teacherShare + centerShare MUST EXACTLY equal netRevenue
        const sum = Math.round((result.teacherShare + result.centerShare) * 100) / 100;
        expect(sum).toBe(result.netRevenue);
        expect(result.teacherShare).toBeGreaterThanOrEqual(0);
        expect(result.centerShare).toBeGreaterThanOrEqual(0);
      }
    });

    it('throws error if teacher and center percentages do not sum to 100%', () => {
      expect(() => calculatePrivateLessonsSplit(100, 'NONE', 0, 70, 40)).toThrow(
        /must sum to 100%/i
      );
    });
  });
});
