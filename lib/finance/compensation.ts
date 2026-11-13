import { SessionStatus } from '../dal/types';

export interface SessionRecord {
  id?: string;
  sessionId?: string;
  attendanceCount?: number;
  validAttendanceCount?: number;
  isCanceled?: boolean;
  sessionStatus?: SessionStatus;
}

export interface CenterSubscriptionResult {
  conductedSessions: number;
  averageAttendance: number;
  totalCompensation: number;
  totalValidAttendance?: number;
  excludedSessionsCount?: number;
}

export type CompensationDiscountType = 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100';

export interface PrivateLessonsSplitResult {
  grossPrice: number;
  discountAmount: number;
  netRevenue: number;
  teacherShare: number;
  centerShare: number;
}

/**
 * Calculates teacher compensation under Center Subscription (نظام السنتر) (AC-1)
 * Formula: Average Attendance = Total Valid Attendance / Conducted Sessions
 * Total Compensation = Average Attendance × Contractual Fixed Rate
 * Invariants: Canceled & Postponed sessions are strictly excluded.
 * Zero conducted sessions returns 0 without division-by-zero errors.
 */
export function calculateCenterSubscriptionCompensation(
  sessions: SessionRecord[],
  ratePerStudent: number
): CenterSubscriptionResult {
  if (ratePerStudent < 0) {
    throw new Error('Contractual fixed rate cannot be negative');
  }

  // Filter only conducted sessions
  const conducted = sessions.filter((s) => {
    if (s.isCanceled === true) return false;
    if (s.sessionStatus === 'canceled' || s.sessionStatus === 'postponed') return false;
    return true;
  });

  const excludedCount = sessions.length - conducted.length;

  if (conducted.length === 0) {
    return {
      conductedSessions: 0,
      averageAttendance: 0,
      totalCompensation: 0,
      totalValidAttendance: 0,
      excludedSessionsCount: excludedCount,
    };
  }

  const totalValidAttendance = conducted.reduce((acc, s) => {
    const count = s.validAttendanceCount ?? s.attendanceCount ?? 0;
    return acc + Math.max(0, count);
  }, 0);

  const rawAverage = totalValidAttendance / conducted.length;
  const averageAttendance = Math.round(rawAverage * 100) / 100;
  // Total compensation calculated using unrounded raw average to avoid premature truncation error
  const totalCompensation = Math.round(rawAverage * ratePerStudent * 100) / 100;

  return {
    conductedSessions: conducted.length,
    averageAttendance,
    totalCompensation,
    totalValidAttendance,
    excludedSessionsCount: excludedCount,
  };
}

/**
 * Calculates revenue split under Private Lessons (نظام البرايفت) (AC-2)
 * Formula: Net Revenue = Gross - Discount.
 * Split between Teacher and Center according to contractual percentages.
 * Invariants: teacherShare + centerShare === netRevenue (Zero rounding leakage).
 * 100% scholarship yields netRevenue: 0, teacherShare: 0, centerShare: 0.
 */
export function calculatePrivateLessonsSplit(
  grossPrice: number,
  discountType: CompensationDiscountType,
  discountValue: number,
  teacherPercent: number,
  centerPercent: number
): PrivateLessonsSplitResult {
  if (Math.round(teacherPercent + centerPercent) !== 100) {
    throw new Error('Teacher and Center percentages must sum to 100%');
  }

  if (teacherPercent < 0 || centerPercent < 0) {
    throw new Error('Percentages cannot be negative');
  }

  let discountAmount = 0;
  const gross = Math.max(0, grossPrice);

  if (discountType === 'SCHOLARSHIP_100') {
    discountAmount = gross;
  } else if (discountType === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, discountValue));
    discountAmount = Math.round(gross * (pct / 100) * 100) / 100;
  } else if (discountType === 'FIXED') {
    discountAmount = Math.min(gross, Math.max(0, discountValue));
  }

  const netRevenue = Math.max(0, Math.round((gross - discountAmount) * 100) / 100);

  if (netRevenue === 0) {
    return {
      grossPrice: gross,
      discountAmount: Math.round(discountAmount * 100) / 100,
      netRevenue: 0,
      teacherShare: 0,
      centerShare: 0,
    };
  }

  // Zero Rounding Leakage Invariant:
  // Teacher share rounded to 2 decimal places; Center gets the exact remainder.
  const teacherShare = Math.round(netRevenue * (teacherPercent / 100) * 100) / 100;
  const centerShare = Math.round((netRevenue - teacherShare) * 100) / 100;

  return {
    grossPrice: gross,
    discountAmount: Math.round(discountAmount * 100) / 100,
    netRevenue,
    teacherShare,
    centerShare,
  };
}

export interface PerSessionFixedResult {
  sessionFee: number;
  attendanceCount: number;
  grossRevenue: number;
  teacherSessionAmount: number;
  centerSessionAmount: number;
  totalTeacherDue: number;
  totalCenterNet: number;
}

/**
 * Calculates per-session fixed amounts compensation (نظام الدفع بالحصة)
 * Fixed amounts agreed between teacher and center administration.
 * Teacher receives fixed amount and Center receives fixed amount.
 * Invariant: totalTeacherDue + totalCenterNet === grossRevenue (Zero rounding leakage).
 */
export function calculatePerSessionFixedSplit(
  attendanceCount: number,
  teacherSessionAmount: number,
  centerSessionAmount: number
): PerSessionFixedResult {
  if (teacherSessionAmount < 0 || centerSessionAmount < 0) {
    throw new Error('Session amounts cannot be negative');
  }
  const count = Math.max(0, attendanceCount);
  const teacherAmt = Math.round(teacherSessionAmount * 100) / 100;
  const centerAmt = Math.round(centerSessionAmount * 100) / 100;
  const sessionFee = Math.round((teacherAmt + centerAmt) * 100) / 100;
  const grossRevenue = Math.round(count * sessionFee * 100) / 100;
  const totalTeacherDue = Math.round(count * teacherAmt * 100) / 100;
  const totalCenterNet = Math.round((grossRevenue - totalTeacherDue) * 100) / 100;

  return {
    sessionFee,
    attendanceCount: count,
    grossRevenue,
    teacherSessionAmount: teacherAmt,
    centerSessionAmount: centerAmt,
    totalTeacherDue,
    totalCenterNet,
  };
}
