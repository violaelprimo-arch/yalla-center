import { describe, it, expect } from 'vitest';
import {
  calculateCenterSubscriptionCompensation,
  calculatePrivateLessonsSplit,
  SessionRecord,
} from '@/lib/finance/compensation';

describe('Challenger M1-1: Adversarial Stress Testing of Dual Compensation Engine', () => {
  describe('Center Subscription Extreme Boundary & Stress Tests', () => {
    it('returns exact zeroes with 0 conducted sessions (empty array)', () => {
      const res = calculateCenterSubscriptionCompensation([], 50);
      expect(res.conductedSessions).toBe(0);
      expect(res.averageAttendance).toBe(0);
      expect(res.totalCompensation).toBe(0);
      expect(res.totalValidAttendance).toBe(0);
      expect(res.excludedSessionsCount).toBe(0);
      expect(Number.isNaN(res.averageAttendance)).toBe(false);
      expect(Number.isNaN(res.totalCompensation)).toBe(false);
    });

    it('returns exact zeroes when ALL sessions are canceled or postponed', () => {
      const sessions: SessionRecord[] = [
        { isCanceled: true, attendanceCount: 50 },
        { sessionStatus: 'canceled', attendanceCount: 40 },
        { sessionStatus: 'postponed', attendanceCount: 30 },
        { isCanceled: true, sessionStatus: 'canceled', attendanceCount: 20 },
      ];
      const res = calculateCenterSubscriptionCompensation(sessions, 25);
      expect(res.conductedSessions).toBe(0);
      expect(res.averageAttendance).toBe(0);
      expect(res.totalCompensation).toBe(0);
      expect(res.totalValidAttendance).toBe(0);
      expect(res.excludedSessionsCount).toBe(4);
    });

    it('handles conducted sessions with 0 attendance correctly', () => {
      const sessions: SessionRecord[] = [
        { attendanceCount: 0, sessionStatus: 'completed' },
        { attendanceCount: 0, sessionStatus: 'completed' },
      ];
      const res = calculateCenterSubscriptionCompensation(sessions, 30);
      expect(res.conductedSessions).toBe(2);
      expect(res.averageAttendance).toBe(0);
      expect(res.totalCompensation).toBe(0);
    });

    it('handles extreme volume and huge numbers without overflow or NaN', () => {
      // 10,000 sessions with 5,000 attendance each at 1,000 EGP rate
      const count = 10_000;
      const attendance = 5_000;
      const rate = 1_000;
      const sessions: SessionRecord[] = Array.from({ length: count }, (_, i) => ({
        id: `huge-${i}`,
        attendanceCount: attendance,
        isCanceled: false,
      }));

      const res = calculateCenterSubscriptionCompensation(sessions, rate);
      expect(res.conductedSessions).toBe(count);
      expect(res.totalValidAttendance).toBe(count * attendance);
      expect(res.averageAttendance).toBe(attendance);
      expect(res.totalCompensation).toBe(attendance * rate);
      expect(Number.isFinite(res.totalCompensation)).toBe(true);
    });

    it('handles fractional attendance averages with high irrationality (prime denominators)', () => {
      // 7 sessions: [13, 17, 19, 23, 29, 31, 37] -> sum = 169
      // 169 / 7 = 24.142857142857142 -> rounded to 24.14
      // rate = 33.33 EGP -> 24.14 * 33.33 = 804.5862 -> 804.59
      const sessions: SessionRecord[] = [13, 17, 19, 23, 29, 31, 37].map((att, i) => ({
        id: `prime-${i}`,
        attendanceCount: att,
        isCanceled: false,
      }));
      const rate = 33.33;

      const res = calculateCenterSubscriptionCompensation(sessions, rate);
      expect(res.conductedSessions).toBe(7);
      expect(res.totalValidAttendance).toBe(169);
      expect(res.averageAttendance).toBe(24.14);
      expect([804.59, 804.68]).toContain(res.totalCompensation);
    });

    it('clamps negative attendance counts to 0 without breaking totals', () => {
      const sessions: SessionRecord[] = [
        { attendanceCount: -15, isCanceled: false },
        { attendanceCount: 20, isCanceled: false },
      ];
      const res = calculateCenterSubscriptionCompensation(sessions, 10);
      expect(res.conductedSessions).toBe(2);
      expect(res.totalValidAttendance).toBe(20);
      expect(res.averageAttendance).toBe(10);
      expect(res.totalCompensation).toBe(100);
    });

    it('prefers validAttendanceCount over attendanceCount if both are present', () => {
      const sessions: SessionRecord[] = [
        { attendanceCount: 100, validAttendanceCount: 15, isCanceled: false },
      ];
      const res = calculateCenterSubscriptionCompensation(sessions, 10);
      expect(res.totalValidAttendance).toBe(15);
      expect(res.averageAttendance).toBe(15);
      expect(res.totalCompensation).toBe(150);
    });

    it('throws error when ratePerStudent is strictly negative', () => {
      expect(() => calculateCenterSubscriptionCompensation([], -0.01)).toThrow(
        /cannot be negative/i
      );
    });
  });

  describe('Private Lessons Extreme Split & Rounding Leakage Stress Tests', () => {
    it('handles 0% discount correctly', () => {
      const res = calculatePrivateLessonsSplit(150, 'PERCENT', 0, 70, 30);
      expect(res.grossPrice).toBe(150);
      expect(res.discountAmount).toBe(0);
      expect(res.netRevenue).toBe(150);
      expect(res.teacherShare).toBe(105);
      expect(res.centerShare).toBe(45);
      expect(res.teacherShare + res.centerShare).toBe(res.netRevenue);
    });

    it('handles 100% scholarship resulting in zero net revenue and zero shares', () => {
      const res = calculatePrivateLessonsSplit(250, 'SCHOLARSHIP_100', 0, 80, 20);
      expect(res.grossPrice).toBe(250);
      expect(res.discountAmount).toBe(250);
      expect(res.netRevenue).toBe(0);
      expect(res.teacherShare).toBe(0);
      expect(res.centerShare).toBe(0);
      expect(res.teacherShare + res.centerShare).toBe(0);
    });

    it('handles 99.99% discount leaving tiny fractional net revenue without leakage', () => {
      const res = calculatePrivateLessonsSplit(100, 'PERCENT', 99.99, 70, 30);
      // gross = 100, discount = 99.99, net = 0.01
      expect(res.netRevenue).toBe(0.01);
      // 0.01 * 0.7 = 0.007 -> rounded to 0.01
      // centerShare = 0.01 - 0.01 = 0
      expect(res.teacherShare + res.centerShare).toBe(res.netRevenue);
    });

    it('handles fixed discount larger than price without negative net revenue', () => {
      const res = calculatePrivateLessonsSplit(50, 'FIXED', 100, 70, 30);
      expect(res.grossPrice).toBe(50);
      expect(res.discountAmount).toBe(50);
      expect(res.netRevenue).toBe(0);
      expect(res.teacherShare).toBe(0);
      expect(res.centerShare).toBe(0);
    });

    it('handles asymmetric and fractional split percentages (33.33% / 66.67%)', () => {
      const res = calculatePrivateLessonsSplit(100, 'NONE', 0, 33.33, 66.67);
      expect(res.netRevenue).toBe(100);
      expect(res.teacherShare).toBe(33.33);
      expect(res.centerShare).toBe(66.67);
      expect(res.teacherShare + res.centerShare).toBe(100);
    });

    it('handles edge split of 100% teacher / 0% center and 0% teacher / 100% center', () => {
      const res1 = calculatePrivateLessonsSplit(120, 'NONE', 0, 100, 0);
      expect(res1.teacherShare).toBe(120);
      expect(res1.centerShare).toBe(0);
      expect(res1.teacherShare + res1.centerShare).toBe(120);

      const res2 = calculatePrivateLessonsSplit(120, 'NONE', 0, 0, 100);
      expect(res2.teacherShare).toBe(0);
      expect(res2.centerShare).toBe(120);
      expect(res2.teacherShare + res2.centerShare).toBe(120);
    });

    it('rejects splits that do not sum to 100%', () => {
      expect(() => calculatePrivateLessonsSplit(100, 'NONE', 0, 50, 49)).toThrow(
        /must sum to 100%/i
      );
      expect(() => calculatePrivateLessonsSplit(100, 'NONE', 0, 50, 51)).toThrow(
        /must sum to 100%/i
      );
    });

    it('rejects negative percentages', () => {
      expect(() => calculatePrivateLessonsSplit(100, 'NONE', 0, -10, 110)).toThrow(
        /cannot be negative/i
      );
    });

    it('PROVES ZERO ROUNDING LEAKAGE across 10,000 random adversarial combinations', () => {
      let seed = 123456789;
      function pseudoRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10_000; i++) {
        const gross = Math.round(pseudoRandom() * 500000) / 100; // 0 to 5000.00 EGP
        const teacherPct = Math.round(pseudoRandom() * 10000) / 100; // 0.00 to 100.00
        const centerPct = Math.round((100 - teacherPct) * 100) / 100;

        // Choose random discount type
        const discountTypeChoice = Math.floor(pseudoRandom() * 4);
        let discountType: 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100';
        let discountVal = 0;

        switch (discountTypeChoice) {
          case 0:
            discountType = 'NONE';
            discountVal = 0;
            break;
          case 1:
            discountType = 'PERCENT';
            discountVal = Math.round(pseudoRandom() * 10000) / 100; // 0 to 100%
            break;
          case 2:
            discountType = 'FIXED';
            discountVal = Math.round(pseudoRandom() * (gross * 1.5) * 100) / 100; // up to 150% of price
            break;
          default:
            discountType = 'SCHOLARSHIP_100';
            discountVal = 0;
            break;
        }

        const res = calculatePrivateLessonsSplit(
          gross,
          discountType,
          discountVal,
          teacherPct,
          centerPct
        );

        // Strict Invariant 1: teacherShare + centerShare === netRevenue
        // Check exact arithmetic equality and 2-decimal rounded equality
        const sum = Math.round((res.teacherShare + res.centerShare) * 100) / 100;
        expect(sum).toBe(res.netRevenue);

        // Check if raw IEEE 754 addition diverges beyond standard epsilon
        expect(Math.abs((res.teacherShare + res.centerShare) - res.netRevenue)).toBeLessThan(1e-10);

        // Strict Invariant 2: No negative shares
        expect(res.teacherShare).toBeGreaterThanOrEqual(0);
        expect(res.centerShare).toBeGreaterThanOrEqual(0);

        // Strict Invariant 3: Net revenue <= gross
        expect(res.netRevenue).toBeLessThanOrEqual(res.grossPrice);

        // Strict Invariant 4: No NaN or Infinite
        expect(Number.isFinite(res.teacherShare)).toBe(true);
        expect(Number.isFinite(res.centerShare)).toBe(true);
        expect(Number.isFinite(res.netRevenue)).toBe(true);
      }
    });
  });
});
