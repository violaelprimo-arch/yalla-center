import { describe, it, expect, beforeEach } from 'vitest';
import { ReceptionAttendanceStore } from '../fixtures/contract-bridge';

describe('Tier 3: Fast Reception Attendance Idempotency Engine (AC-7)', () => {
  let store: ReceptionAttendanceStore;

  beforeEach(() => {
    store = new ReceptionAttendanceStore();
  });

  it('records attendance on first valid barcode/code scan (isNewRecord: true, duplicate: false)', () => {
    const sessionId = 'session-physics-101';
    const studentId = 'student-ahmed-01';
    const studentCode = 'PHY-001';

    const result = store.recordScan(sessionId, studentId, studentCode, 'أحمد محمود');

    expect(result.success).toBe(true);
    expect(result.isNewRecord).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.sessionId).toBe(sessionId);
    expect(result.studentId).toBe(studentId);
    expect(result.studentCode).toBe(studentCode);
    expect(result.recordedAt).toBeDefined();
    expect(store.getAttendanceCount(sessionId)).toBe(1);
  });

  it('AC-7: returns duplicate: true and records exactly ONE record when scanned twice in the same session', () => {
    const sessionId = 'session-math-202';
    const studentId = 'student-nour-02';
    const studentCode = 'MTH-002';

    // First scan
    const firstScan = store.recordScan(sessionId, studentId, studentCode, 'نور الهدى');
    expect(firstScan.success).toBe(true);
    expect(firstScan.isNewRecord).toBe(true);
    expect(firstScan.duplicate).toBe(false);
    expect(store.getAttendanceCount(sessionId)).toBe(1);

    // Second scan (duplicate in same session)
    const secondScan = store.recordScan(sessionId, studentId, studentCode, 'نور الهدى');
    expect(secondScan.success).toBe(true);
    expect(secondScan.isNewRecord).toBe(false);
    expect(secondScan.duplicate).toBe(true);
    expect(secondScan.recordedAt).toBe(firstScan.recordedAt);
    expect(secondScan.message).toMatch(/مسبقاً/);

    // Verify session count has NOT incremented
    expect(store.getAttendanceCount(sessionId)).toBe(1);
  });

  it('handles rapid burst scanning idempotently (5 consecutive scans produce exactly 1 record)', () => {
    const sessionId = 'session-chem-303';
    const studentId = 'student-salma-03';
    const studentCode = 'CHM-003';

    const scans = [
      store.recordScan(sessionId, studentId, studentCode),
      store.recordScan(sessionId, studentId, studentCode),
      store.recordScan(sessionId, studentId, studentCode),
      store.recordScan(sessionId, studentId, studentCode),
      store.recordScan(sessionId, studentId, studentCode),
    ];

    const newRecords = scans.filter((s) => s.isNewRecord);
    const duplicates = scans.filter((s) => s.duplicate);

    expect(newRecords.length).toBe(1);
    expect(duplicates.length).toBe(4);
    expect(store.getAttendanceCount(sessionId)).toBe(1);
  });

  it('allows same student to check in across different sessions', () => {
    const studentId = 'student-tarek-04';
    const studentCode = 'BIO-004';
    const morningSession = 'session-morning-1';
    const eveningSession = 'session-evening-2';

    const scanMorning = store.recordScan(morningSession, studentId, studentCode);
    const scanEvening = store.recordScan(eveningSession, studentId, studentCode);

    expect(scanMorning.isNewRecord).toBe(true);
    expect(scanEvening.isNewRecord).toBe(true);
    expect(store.getAttendanceCount(morningSession)).toBe(1);
    expect(store.getAttendanceCount(eveningSession)).toBe(1);
  });

  it('records multiple distinct students in the same session correctly', () => {
    const sessionId = 'session-lecture-500';

    const scan1 = store.recordScan(sessionId, 'student-1', 'CODE-1');
    const scan2 = store.recordScan(sessionId, 'student-2', 'CODE-2');
    const scan3 = store.recordScan(sessionId, 'student-3', 'CODE-3');

    expect(scan1.isNewRecord).toBe(true);
    expect(scan2.isNewRecord).toBe(true);
    expect(scan3.isNewRecord).toBe(true);
    expect(store.getAttendanceCount(sessionId)).toBe(3);
  });
});
