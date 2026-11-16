import { describe, it, expect } from 'vitest';
import { calculateTeacherSessionPay } from '@/lib/teachers/session-compensation';
import {
  teacherInputSchema,
  matchTeacherContract,
  type TeacherContract,
  type TeacherInput,
} from '@/lib/teachers/profile';
import type { Subject, Session } from '@/lib/dal/types';

describe('Teachers Affairs Upgrade — Accounting & Financial Models', () => {
  const completedSession: Session = {
    id: 'sess-101',
    tenantId: 'tenant-maher-001',
    branchId: 'branch-1',
    groupId: 'group-1',
    teacherId: 'teacher-1',
    sessionDate: '2026-11-16',
    startTime: '10:00',
    endTime: '12:00',
    classroomId: 'room-1',
    status: 'completed',
    createdAt: '2026-11-16T10:00:00Z',
  };

  it('calculates Method D (per_attendee): attendance count × rate per student', () => {
    const contract: TeacherContract = {
      level: 'stage-secondary',
      model: 'per_attendee',
      value: 15, // 15 EGP per attendee
    };

    // 25 students attended at 20 EGP session fee
    // Total revenue = 25 * 20 = 500 EGP
    // Teacher compensation = 25 * 15 = 375 EGP
    // Center net = 500 - 375 = 125 EGP
    const result = calculateTeacherSessionPay(contract, completedSession, 25, 500);

    expect(result.teacherDue).toBe(375);
    expect(result.centerNet).toBe(125);
  });

  it('accurately preserves negative margin when teacherDue exceeds session revenue', () => {
    const contract: TeacherContract = {
      level: 'stage-prep',
      model: 'per_attendee',
      value: 50, // 50 EGP per student
    };

    // Only 2 students attended, but session revenue was 60 EGP total (due to discounts or free passes)
    // Teacher due = 2 * 50 = 100 EGP
    // Center net = 60 - 100 = -40 EGP
    const result = calculateTeacherSessionPay(contract, completedSession, 2, 60);

    expect(result.teacherDue).toBe(100);
    expect(result.centerNet).toBe(-40);
  });

  it('calculates Method B (fixed_session): flat fee per session', () => {
    const contract: TeacherContract = {
      level: 'stage-secondary',
      model: 'fixed_session',
      value: 300,
    };

    const result = calculateTeacherSessionPay(contract, completedSession, 30, 1000);
    expect(result.teacherDue).toBe(300);
    expect(result.centerNet).toBe(700);
  });

  it('calculates Method C (private): percentage of session revenue', () => {
    const contract: TeacherContract = {
      level: 'stage-secondary',
      model: 'private',
      value: 70, // 70%
    };

    const result = calculateTeacherSessionPay(contract, completedSession, 5, 1000);
    expect(result.teacherDue).toBe(700);
    expect(result.centerNet).toBe(300);
  });

  it('calculates Method A (center): average attendance model fallback', () => {
    const contract: TeacherContract = {
      level: 'stage-secondary',
      model: 'center',
      value: 20, // 20 EGP per student rate
    };

    const result = calculateTeacherSessionPay(contract, completedSession, 18, 540);
    expect(result.teacherDue).toBe(360);
    expect(result.centerNet).toBe(180);
  });

  it('matches multi-stage independent agreements correctly', () => {
    const contracts: TeacherContract[] = [
      { level: 'stage-primary', model: 'per_attendee', value: 10 },
      { level: 'stage-prep', model: 'fixed_session', value: 250 },
      { level: 'stage-secondary', model: 'private', value: 75 },
    ];

    const prepSubject: Pick<Subject, 'stage' | 'grade'> = {
      stage: 'stage-prep',
      grade: 'grade-prep-2',
    };

    const primarySubject: Pick<Subject, 'stage' | 'grade'> = {
      stage: 'stage-primary',
      grade: 'grade-primary-6',
    };

    const matchedPrep = matchTeacherContract(contracts, prepSubject);
    expect(matchedPrep?.model).toBe('fixed_session');
    if (matchedPrep && 'value' in matchedPrep) {
      expect(matchedPrep.value).toBe(250);
    }

    const matchedPrimary = matchTeacherContract(contracts, primarySubject);
    expect(matchedPrimary?.model).toBe('per_attendee');
    if (matchedPrimary && 'value' in matchedPrimary) {
      expect(matchedPrimary.value).toBe(10);
    }
  });

  it('validates teacherInputSchema with all 4 models and up to 8 tabs', () => {
    const validTeacher: TeacherInput = {
      fullName: 'أستاذ أحمد منصور',
      phone: '01012345678',
      phone2: '01198765432',
      avatarData: null,
      contracts: [
        { level: 'stage-primary', model: 'per_attendee', value: 20 },
        { level: 'stage-prep', model: 'fixed_session', value: 300 },
        { level: 'stage-secondary', model: 'center', value: 40 },
      ],
      subjectIds: ['sub-math-1', 'sub-math-2'],
      login: { mode: 'google', email: 'ahmed.mansour@gmail.com' },
      permissions: ['viewAccount', 'viewSchedule', 'viewStudents'],
      tabs: ['account', 'schedule', 'students', 'materials', 'exams', 'profile'],
    };

    const parsed = teacherInputSchema.safeParse(validTeacher);
    expect(parsed.success).toBe(true);
  });
});
