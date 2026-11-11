/**
 * Challenger M4-1: Fast Scanning, Burst Concurrency & Attendance Idempotency Stress Test Suite
 * Path: tests/unit/challenger-m4-scanning-stress.test.ts
 *
 * Empirically stress-tests:
 * 1. Rapid Burst Scans & Concurrency Idempotency (AC-7):
 *    - 50 concurrent Promise.all scans for same student in same session -> exactly 1 record created.
 *    - Duplicate scans return isDuplicate: true (and duplicate: true, isNewRecord: false).
 *    - Initial scannedAt timestamp is strictly preserved and never mutated by duplicate scans.
 *    - 100 rapid sequential scans in a loop with zero record leakage.
 *    - Multi-student concurrent burst (10 distinct students x 5 concurrent scans = 50 calls).
 *    - ReceptionAttendanceStore contract bridge verification.
 * 2. Cross-Session Scanning (Same Student, Same Date):
 *    - Student attends 3 distinct sessions on the same date (morning, afternoon, evening).
 *    - Confirms zero cross-session collision: each session creates an independent record.
 *    - Re-scanning only flags duplicate within that specific session.
 *    - Tenant isolation: cross-tenant session scanning rejected.
 * 3. Overdue Balance Detection & Alerts:
 *    - Scanning student STD-1002 (Mariam Khaled, balanceDue: 150 EGP).
 *    - Confirms balanceAlert.hasBalance === true and balanceDue === 150.
 *    - Confirms Arabic warning message includes 150.
 *    - Confirms notification payload contains balanceDue: 150.
 *    - Scanning zero-balance student STD-1001 (balanceDue: 0) -> hasBalance === false.
 *    - Balance alert persists across duplicate scans.
 * 4. Manual Check-in Fallback & Identifier Equivalence:
 *    - Equivalence of student ID (user-student-1002) and student code (STD-1002).
 *    - Scanning with student ID followed by student code -> duplicate: true, original timestamp preserved.
 *    - Scanning with student code followed by student ID -> duplicate: true, original timestamp preserved.
 *    - VerificationMethod tracking ('manual' vs 'barcode' vs 'qr').
 *    - Error handling on unknown student code or non-existent session.
 * 5. Procedural Web Audio Engine Robustness:
 *    - Safe headless execution of playSuccessChime, playWarningChime, playErrorChime without throwing.
 *    - Mocked AudioContext: node routing, oscillator types, frequency scheduling.
 *    - Mute state persistence and bypass.
 *    - Burst invocation of 200 consecutive chimes without unhandled errors.
 * 6. API Route Integration:
 *    - POST /api/center/[centerSlug]/attendance/scan with concurrent requests.
 *    - Validation for missing fields, unknown center, unknown student/session.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MockDataProvider } from '@/lib/dal/mock-data';
import {
  recordReceptionScan,
  calculateSessionStats,
  ReceptionAttendanceStore,
} from '@/lib/attendance/checkin';
import {
  setMuted,
  getMuted,
  toggleMuted,
  playSuccessChime,
  playWarningChime,
  playErrorChime,
  getAudioContext,
} from '@/lib/attendance/audio';
import { POST as scanApiRoute } from '@/app/api/center/[centerSlug]/attendance/scan/route';

describe('Challenger M4-1: Scanning & Attendance Idempotency Empirical Stress Tests', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
    setMuted(false);
  });

  afterEach(() => {
    setMuted(false);
    vi.restoreAllMocks();
  });

  /* ========================================================================
   * 1. RAPID BURST SCANS & CONCURRENCY IDEMPOTENCY
   * ======================================================================== */
  describe('Mission 1: Rapid Burst Scans & Concurrency Idempotency (AC-7)', () => {
    it('handles 50 concurrent Promise.all scans for same student: exactly 1 created, 49 duplicates, timestamp strictly preserved', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode === 'STD-1001'
      )!;

      // Ensure clean attendance state for this session/student
      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === student.id)
      );

      // Launch 50 concurrent scans simultaneously
      const burstPromises = Array.from({ length: 50 }, () =>
        dal.recordAttendanceScan(session.tenantId, session.id, student.studentCode!)
      );

      const results = await Promise.all(burstPromises);

      // 1. Exactly 1 scan is a new record
      const newRecords = results.filter((r) => r.isNewRecord === true);
      const duplicates = results.filter((r) => r.isDuplicate === true);

      expect(newRecords.length).toBe(1);
      expect(duplicates.length).toBe(49);

      // 2. Database contains EXACTLY 1 attendance row for this (sessionId, studentId)
      const matchingDbRows = dal.attendance.filter(
        (a) => a.sessionId === session.id && a.studentId === student.id
      );
      expect(matchingDbRows.length).toBe(1);

      // 3. The initial scannedAt timestamp is STRICTLY preserved across all 50 results
      const initialTimestamp = newRecords[0].scannedAt;
      expect(initialTimestamp).toBeDefined();

      duplicates.forEach((dup) => {
        expect(dup.scannedAt).toBe(initialTimestamp);
        expect(dup.recordedAt).toBe(initialTimestamp);
        expect(dup.duplicate).toBe(true);
        expect(dup.isNewRecord).toBe(false);
      });
    });

    it('handles 100 rapid sequential scans in a loop with 0 duplicate records leaked', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode === 'STD-1003'
      )!;

      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === student.id)
      );

      let firstScannedAt = '';

      for (let i = 0; i < 100; i++) {
        const res = await dal.recordAttendanceScan(
          session.tenantId,
          session.id,
          student.id
        );

        if (i === 0) {
          expect(res.isNewRecord).toBe(true);
          expect(res.isDuplicate).toBe(false);
          expect(res.duplicate).toBe(false);
          firstScannedAt = res.scannedAt;
        } else {
          expect(res.isNewRecord).toBe(false);
          expect(res.isDuplicate).toBe(true);
          expect(res.duplicate).toBe(true);
          expect(res.scannedAt).toBe(firstScannedAt);
        }
      }

      const count = dal.attendance.filter(
        (a) => a.sessionId === session.id && a.studentId === student.id
      ).length;
      expect(count).toBe(1);
    });

    it('handles multi-student burst concurrency (10 distinct students x 5 concurrent scans = 50 calls)', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const students = dal.users
        .filter((u) => u.role === 'STUDENT' && u.tenantId === session.tenantId)
        .slice(0, 10);

      // Clear attendance for all 10 students
      const studentIds = new Set(students.map((s) => s.id));
      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && studentIds.has(a.studentId))
      );

      // Fire 5 concurrent requests for each of the 10 students
      const allPromises = students.flatMap((student) =>
        Array.from({ length: 5 }, () =>
          dal.recordAttendanceScan(session.tenantId, session.id, student.studentCode || student.id)
        )
      );

      const allResults = await Promise.all(allPromises);
      expect(allResults.length).toBe(students.length * 5);

      // Exactly 1 new record per student
      students.forEach((student) => {
        const studentResults = allResults.filter((r) => r.studentId === student.id);
        expect(studentResults.length).toBe(5);

        const newRecs = studentResults.filter((r) => r.isNewRecord);
        const dups = studentResults.filter((r) => r.isDuplicate);

        expect(newRecs.length).toBe(1);
        expect(dups.length).toBe(4);

        const expectedTime = newRecs[0].scannedAt;
        dups.forEach((d) => expect(d.scannedAt).toBe(expectedTime));

        const inDb = dal.attendance.filter(
          (a) => a.sessionId === session.id && a.studentId === student.id
        );
        expect(inDb.length).toBe(1);
      });
    });

    it('proves ReceptionAttendanceStore handles burst calls idempotently with exact contract matching', () => {
      const store = new ReceptionAttendanceStore();
      const sessionId = 'burst-sess-99';
      const studentId = 'std-burst-1';
      const studentCode = 'CODE-BURST-1';

      const results = Array.from({ length: 50 }, () =>
        store.recordScan(sessionId, studentId, studentCode, 'طالب تجريبي')
      );

      const newRecs = results.filter((r) => r.isNewRecord);
      const dups = results.filter((r) => r.duplicate);

      expect(newRecs.length).toBe(1);
      expect(dups.length).toBe(49);
      expect(store.getAttendanceCount(sessionId)).toBe(1);

      const initialTime = newRecs[0].recordedAt;
      dups.forEach((d) => {
        expect(d.recordedAt).toBe(initialTime);
      });
    });
  });

  /* ========================================================================
   * 2. CROSS-SESSION SCANNING (SAME STUDENT, SAME DATE)
   * ======================================================================== */
  describe('Mission 2: Cross-Session Scanning (Same Student, Same Date)', () => {
    it('allows a student to attend 3 distinct sessions on the same date without collision', async () => {
      const tenantId = 'tenant-maher-001';
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === tenantId && u.studentCode === 'STD-1001'
      )!;

      const dateToday = '2026-10-18';
      const sessionMorning = {
        id: 'sess-chal-morning-1',
        tenantId,
        groupId: 'grp-math-sat',
        classroomId: 'room-101',
        teacherId: 'user-teacher-math',
        sessionDate: dateToday,
        startTime: '09:00',
        endTime: '11:00',
        status: 'completed' as const,
        createdAt: '2026-10-18T00:00:00Z',
      };
      const sessionAfternoon = {
        id: 'sess-chal-afternoon-2',
        tenantId,
        groupId: 'grp-phys-sun',
        classroomId: 'room-102',
        teacherId: 'user-teacher-phys',
        sessionDate: dateToday,
        startTime: '13:00',
        endTime: '15:00',
        status: 'in_progress' as const,
        createdAt: '2026-10-18T00:00:00Z',
      };
      const sessionEvening = {
        id: 'sess-chal-evening-3',
        tenantId,
        groupId: 'grp-chem-mon',
        classroomId: 'room-103',
        teacherId: 'user-teacher-chem',
        sessionDate: dateToday,
        startTime: '17:00',
        endTime: '19:00',
        status: 'scheduled' as const,
        createdAt: '2026-10-18T00:00:00Z',
      };

      dal.sessions.push(sessionMorning, sessionAfternoon, sessionEvening);

      // Scan Morning
      const resMorning = await dal.recordAttendanceScan(
        tenantId,
        sessionMorning.id,
        student.studentCode!
      );
      expect(resMorning.success).toBe(true);
      expect(resMorning.isNewRecord).toBe(true);
      expect(resMorning.duplicate).toBe(false);

      // Scan Afternoon
      const resAfternoon = await dal.recordAttendanceScan(
        tenantId,
        sessionAfternoon.id,
        student.studentCode!
      );
      expect(resAfternoon.success).toBe(true);
      expect(resAfternoon.isNewRecord).toBe(true);
      expect(resAfternoon.duplicate).toBe(false);

      // Scan Evening
      const resEvening = await dal.recordAttendanceScan(
        tenantId,
        sessionEvening.id,
        student.studentCode!
      );
      expect(resEvening.success).toBe(true);
      expect(resEvening.isNewRecord).toBe(true);
      expect(resEvening.duplicate).toBe(false);

      // Check session attendance isolation
      const attMorning = dal.attendance.filter((a) => a.sessionId === sessionMorning.id);
      const attAfternoon = dal.attendance.filter((a) => a.sessionId === sessionAfternoon.id);
      const attEvening = dal.attendance.filter((a) => a.sessionId === sessionEvening.id);

      expect(attMorning.length).toBe(1);
      expect(attAfternoon.length).toBe(1);
      expect(attEvening.length).toBe(1);

      // Duplicate scan on afternoon session affects ONLY afternoon session
      const dupAfternoon = await dal.recordAttendanceScan(
        tenantId,
        sessionAfternoon.id,
        student.studentCode!
      );
      expect(dupAfternoon.isDuplicate).toBe(true);
      expect(dupAfternoon.scannedAt).toBe(resAfternoon.scannedAt);

      // Other sessions are unchanged
      expect(dal.attendance.filter((a) => a.sessionId === sessionMorning.id).length).toBe(1);
      expect(dal.attendance.filter((a) => a.sessionId === sessionAfternoon.id).length).toBe(1);
      expect(dal.attendance.filter((a) => a.sessionId === sessionEvening.id).length).toBe(1);
    });

    it('rejects cross-tenant session check-in with informative error', async () => {
      const studentCenterA = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === 'tenant-maher-001'
      )!;
      const sessionCenterB = dal.sessions.find(
        (s) => s.tenantId === 'tenant-rowad-002'
      ) || {
        id: 'sess-rowad-isolated',
        tenantId: 'tenant-rowad-002',
        groupId: 'grp-rowad-1',
        classroomId: 'room-r1',
        teacherId: 'user-t-rowad',
        sessionDate: '2026-10-18',
        startTime: '10:00',
        endTime: '12:00',
        status: 'in_progress' as const,
        createdAt: '2026-10-18T00:00:00Z',
      };

      if (!dal.sessions.some((s) => s.id === sessionCenterB.id)) {
        dal.sessions.push(sessionCenterB);
      }

      // Center A attempts to scan into Center B's session ID -> session not found in Center A
      await expect(
        dal.recordAttendanceScan(
          'tenant-maher-001',
          sessionCenterB.id,
          studentCenterA.studentCode || studentCenterA.id
        )
      ).rejects.toThrow(/الحصة غير موجودة في هذا السنتر/);
    });
  });

  /* ========================================================================
   * 3. OVERDUE BALANCE DETECTION & NOTIFICATION ACCURACY
   * ======================================================================== */
  describe('Mission 3: Overdue Balance Detection & Alerts', () => {
    it('accurately detects student STD-1002 (Mariam Khaled) with balanceDue === 150 EGP', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const mariam = dal.users.find(
        (u) => u.tenantId === session.tenantId && u.studentCode === 'STD-1002'
      )!;

      expect(mariam).toBeDefined();
      expect(mariam.fullName).toContain('مريم خالد');
      expect(mariam.balanceDue).toBe(150);

      // Clean attendance
      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === mariam.id)
      );

      const scanResult = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        'STD-1002'
      );

      // Verify returned payload
      expect(scanResult.success).toBe(true);
      expect(scanResult.studentId).toBe(mariam.id);
      expect(scanResult.studentName).toContain('مريم خالد');
      expect(scanResult.balanceAlert).toBeDefined();
      expect(scanResult.balanceAlert!.hasBalance).toBe(true);
      expect(scanResult.balanceAlert!.balanceDue).toBe(150);
      expect(scanResult.balanceAlert!.messageAr).toContain('150');

      // Verify notification enqueued has balance alert
      const enqueuedNotif = dal.notifications
        .filter((n) => n.recipientPhone === mariam.guardianPhone)
        .pop();

      expect(enqueuedNotif).toBeDefined();
      expect(enqueuedNotif?.payload?.balanceDue).toBe(150);
      expect(enqueuedNotif?.payload?.studentName).toBe(mariam.fullName);
    });

    it('accurately verifies zero-balance student STD-1001: hasBalance === false, balanceDue === 0', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const ahmed = dal.users.find(
        (u) => u.tenantId === session.tenantId && u.studentCode === 'STD-1001'
      )!;

      expect(ahmed).toBeDefined();
      expect(ahmed.balanceDue).toBe(0);

      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === ahmed.id)
      );

      const scanResult = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        'STD-1001'
      );

      expect(scanResult.balanceAlert!.hasBalance).toBe(false);
      expect(scanResult.balanceAlert!.balanceDue).toBe(0);
      expect(scanResult.balanceAlert!.messageAr).toBe('جميع الرسوم مسددة بالكامل');
    });

    it('persists overdue balance alert on duplicate scans so receptionist HUD stays aware', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];

      // First scan
      const first = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        'STD-1002'
      );
      expect(first.balanceAlert!.hasBalance).toBe(true);
      expect(first.balanceAlert!.balanceDue).toBe(150);

      // Second duplicate scan
      const second = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        'STD-1002'
      );
      expect(second.isDuplicate).toBe(true);
      expect(second.balanceAlert!.hasBalance).toBe(true);
      expect(second.balanceAlert!.balanceDue).toBe(150);
    });
  });

  /* ========================================================================
   * 4. MANUAL CHECK-IN FALLBACK & IDENTIFIER EQUIVALENCE
   * ======================================================================== */
  describe('Mission 4: Manual Check-In Fallback & Identifier Equivalence', () => {
    it('verifies student ID (user-student-1002) and student code (STD-1002) are fully interchangeable and deduplicated', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const studentId = 'user-student-1002';
      const studentCode = 'STD-1002';

      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === studentId)
      );

      // Check-in via student ID first
      const firstScan = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        studentId,
        'cashier-1',
        'manual'
      );
      expect(firstScan.success).toBe(true);
      expect(firstScan.isNewRecord).toBe(true);
      expect(firstScan.isDuplicate).toBe(false);
      expect(firstScan.attendance.verificationMethod).toBe('manual');

      // Duplicate check-in via student code
      const secondScan = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        studentCode,
        'cashier-1',
        'manual'
      );
      expect(secondScan.success).toBe(true);
      expect(secondScan.isNewRecord).toBe(false);
      expect(secondScan.isDuplicate).toBe(true);
      expect(secondScan.scannedAt).toBe(firstScan.scannedAt);

      // Exactly 1 record in database
      const records = dal.attendance.filter(
        (a) => a.sessionId === session.id && a.studentId === studentId
      );
      expect(records.length).toBe(1);
    });

    it('verifies reverse order: check-in via student code first, then student ID', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const studentId = 'user-student-1001';
      const studentCode = 'STD-1001';

      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === studentId)
      );

      // Check-in via student code first
      const firstScan = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        studentCode,
        'cashier-2',
        'barcode'
      );
      expect(firstScan.isNewRecord).toBe(true);
      expect(firstScan.attendance.verificationMethod).toBe('barcode');

      // Check-in via student ID
      const secondScan = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        studentId,
        'cashier-2',
        'qr'
      );
      expect(secondScan.isNewRecord).toBe(false);
      expect(secondScan.isDuplicate).toBe(true);
      expect(secondScan.scannedAt).toBe(firstScan.scannedAt);

      const records = dal.attendance.filter(
        (a) => a.sessionId === session.id && a.studentId === studentId
      );
      expect(records.length).toBe(1);
    });

    it('properly throws error for non-existent student code or ID', async () => {
      const session = dal.sessions[0];

      await expect(
        dal.recordAttendanceScan(session.tenantId, session.id, 'UNKNOWN-999999')
      ).rejects.toThrow(/لم يتم العثور على طالب مطابق/);
    });

    it('properly throws error for non-existent session ID', async () => {
      await expect(
        dal.recordAttendanceScan('tenant-maher-001', 'sess-ghost-404', 'STD-1001')
      ).rejects.toThrow(/الحصة غير موجودة في هذا السنتر/);
    });
  });

  /* ========================================================================
   * 5. PROCEDURAL WEB AUDIO ENGINE ROBUSTNESS
   * ======================================================================== */
  describe('Mission 5: Procedural Web Audio Engine Robustness', () => {
    it('executes playSuccessChime, playWarningChime, playErrorChime cleanly without throwing in headless jsdom', () => {
      expect(() => playSuccessChime()).not.toThrow();
      expect(() => playWarningChime()).not.toThrow();
      expect(() => playErrorChime()).not.toThrow();
    });

    it('correctly tracks and persists mute / unmute state', () => {
      setMuted(true);
      expect(getMuted()).toBe(true);

      expect(() => playSuccessChime()).not.toThrow();
      expect(() => playWarningChime()).not.toThrow();
      expect(() => playErrorChime()).not.toThrow();

      const toggled = toggleMuted();
      expect(toggled).toBe(false);
      expect(getMuted()).toBe(false);
    });

    it('schedules correct oscillator frequencies when Web Audio AudioContext is present', () => {
      const createdOscillators: Array<{
        type: OscillatorType;
        frequencies: Array<{ freq: number; time: number }>;
      }> = [];

      class MockOscillator {
        type: OscillatorType = 'sine';
        frequency = {
          setValueAtTime: (freq: number, time: number) => {
            this.frequencies.push({ freq, time });
          },
          exponentialRampToValueAtTime: vi.fn(),
        };
        frequencies: Array<{ freq: number; time: number }> = [];
        connect = vi.fn();
        start = vi.fn();
        stop = vi.fn();

        constructor() {
          createdOscillators.push(this);
        }
      }

      class MockGainNode {
        gain = {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        };
        connect = vi.fn();
      }

      class MockBiquadFilter {
        type = 'lowpass';
        frequency = { setValueAtTime: vi.fn() };
        connect = vi.fn();
      }

      const mockAudioContextInstance = {
        state: 'running',
        currentTime: 10.0,
        destination: {},
        createOscillator: () => new MockOscillator(),
        createGain: () => new MockGainNode(),
        createBiquadFilter: () => new MockBiquadFilter(),
        resume: vi.fn().mockResolvedValue(undefined),
      };

      // Mock window.AudioContext
      const originalWindowAudioContext = (window as any).AudioContext;
      (window as any).AudioContext = vi.fn(() => mockAudioContextInstance);

      try {
        setMuted(false);

        // 1. Success Chime -> should create 3 oscillators (C6=1046.5, E6=1318.5, G6=1568.0)
        createdOscillators.length = 0;
        playSuccessChime();
        expect(createdOscillators.length).toBe(3);
        expect(createdOscillators[0].frequencies[0].freq).toBe(1046.5);
        expect(createdOscillators[1].frequencies[0].freq).toBe(1318.5);
        expect(createdOscillators[2].frequencies[0].freq).toBe(1568.0);

        // 2. Warning Chime -> should create 2 oscillators (580Hz, 720Hz)
        createdOscillators.length = 0;
        playWarningChime();
        expect(createdOscillators.length).toBe(2);
        expect(createdOscillators[0].type).toBe('triangle');
        expect(createdOscillators[0].frequencies[0].freq).toBe(580);
        expect(createdOscillators[1].frequencies[0].freq).toBe(720);

        // 3. Error Chime -> should create 1 sawtooth oscillator
        createdOscillators.length = 0;
        playErrorChime();
        expect(createdOscillators.length).toBe(1);
        expect(createdOscillators[0].type).toBe('sawtooth');
        expect(createdOscillators[0].frequencies[0].freq).toBe(220);
      } finally {
        if (originalWindowAudioContext) {
          (window as any).AudioContext = originalWindowAudioContext;
        } else {
          delete (window as any).AudioContext;
        }
      }
    });

    it('survives a rapid burst of 200 consecutive chimes without throwing', () => {
      expect(() => {
        for (let i = 0; i < 200; i++) {
          if (i % 3 === 0) playSuccessChime();
          else if (i % 3 === 1) playWarningChime();
          else playErrorChime();
        }
      }).not.toThrow();
    });
  });

  /* ========================================================================
   * 6. SCAN API ENDPOINT INTEGRATION (/api/center/[centerSlug]/attendance/scan)
   * ======================================================================== */
  describe('Mission 6: Fast Scan API Route Integration', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T12:00:00Z')); });
    afterEach(() => { vi.useRealTimers(); });

    it('rejects new check-ins for a completed session', async () => {
      const req = new NextRequest('http://localhost/api/center/al-maher/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'sess-math-1', studentCodeOrBarcode: 'STD-1001' }),
      });
      const result = await scanApiRoute(req, { params: { centerSlug: 'al-maher' } });
      expect(result.status).toBe(409);
    });

    it('returns 200 with idempotent scan result for valid student and session', async () => {
      const session = dal.sessions.find((s) => s.id === 'sess-live-today') || dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode === 'STD-1002'
      )!;

      // Clean attendance
      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === student.id)
      );

      // First API call
      const req1 = new NextRequest('http://localhost:3000/api/center/al-maher/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          studentCodeOrBarcode: student.studentCode,
          verificationMethod: 'barcode',
        }),
      });

      const res1 = await scanApiRoute(req1, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });

      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.isNewRecord).toBe(true);
      expect(data1.isDuplicate).toBe(false);
      expect(data1.balanceAlert.hasBalance).toBe(true);
      expect(data1.balanceAlert.balanceDue).toBe(150);

      // Second API call with same body -> duplicate: true
      const req2 = new NextRequest('http://localhost:3000/api/center/al-maher/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          studentCodeOrBarcode: student.studentCode,
          verificationMethod: 'barcode',
        }),
      });

      const res2 = await scanApiRoute(req2, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });

      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.isNewRecord).toBe(false);
      expect(data2.isDuplicate).toBe(true);
      expect(data2.scannedAt).toBe(data1.scannedAt);
    });

    it('returns 400 when missing required fields (sessionId or studentCodeOrBarcode)', async () => {
      const req = new NextRequest('http://localhost:3000/api/center/al-maher/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess-1',
          // studentCodeOrBarcode omitted
        }),
      });

      const res = await scanApiRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('MISSING_FIELDS');
    });

    it('returns 404 when center slug is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/center/unknown-center/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess-1',
          studentCodeOrBarcode: 'STD-1001',
        }),
      });

      const res = await scanApiRoute(req, {
        params: Promise.resolve({ centerSlug: 'unknown-center' }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('CENTER_NOT_FOUND');
    });

    it('returns 404 when student or session does not exist in center', async () => {
      const req = new NextRequest('http://localhost:3000/api/center/al-maher/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess-live-today',
          studentCodeOrBarcode: 'NON-EXISTENT-CODE',
        }),
      });

      const res = await scanApiRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('STUDENT_OR_SESSION_NOT_FOUND');
    });
  });
});
