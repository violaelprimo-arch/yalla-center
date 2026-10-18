import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import {
  formatWhatsAppAttendanceMessage,
  formatWhatsAppReceiptMessage,
  formatWhatsAppExamResultMessage,
  renderNotificationContent,
} from '@/lib/notifications/formatter';
import {
  setMuted,
  getMuted,
  toggleMuted,
  playSuccessChime,
  playWarningChime,
  playErrorChime,
  getAudioContext,
} from '@/lib/attendance/audio';
import {
  recordReceptionScan,
  calculateSessionStats,
  ReceptionAttendanceStore,
} from '@/lib/attendance/checkin';

describe('Milestone 4: Fast Reception Attendance & Async Notification Engine', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
    setMuted(false);
  });

  // =========================================================================
  // 1. Barcode & Buffer Timing Logic
  // =========================================================================
  describe('1. Barcode & Buffer Timing Logic', () => {
    it('verifies rapid scan burst (<50ms avg delta) terminates on Enter', () => {
      const buffer = [
        { char: 'S', time: 100 },
        { char: 'T', time: 115 },
        { char: 'D', time: 130 },
        { char: '-', time: 145 },
        { char: '1', time: 160 },
        { char: '0', time: 175 },
        { char: '0', time: 190 },
        { char: '1', time: 205 },
      ];

      const totalDuration = buffer[buffer.length - 1].time - buffer[0].time;
      const avgDelta = totalDuration / (buffer.length - 1);

      expect(avgDelta).toBeLessThan(50);
      expect(totalDuration).toBeLessThan(300);

      const code = buffer.map((b) => b.char).join('');
      expect(code).toBe('STD-1001');
    });

    it('clears buffer when interval exceeds 80ms inactivity timeout (slow human typing)', () => {
      let buffer: Array<{ char: string; time: number }> = [];
      let lastTime = 0;

      const pushChar = (char: string, time: number) => {
        if (lastTime > 0 && time - lastTime > 80) {
          buffer = [];
        }
        buffer.push({ char, time });
        lastTime = time;
      };

      // Slow typing: 150ms delay between keys
      pushChar('S', 100);
      pushChar('T', 250); // delta 150 > 80 => buffer resets, only 'T' remains
      expect(buffer.length).toBe(1);
      expect(buffer[0].char).toBe('T');
    });
  });

  // =========================================================================
  // 2. HUD States & Overdue Balance Warnings
  // =========================================================================
  describe('2. HUD States & Overdue Balance Warnings', () => {
    it('generates Green Success state with balanceDue = 0 and "حضور مؤكد"', async () => {
      const session = dal.sessions[0];
      const studentZeroBalance = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.balanceDue === 0
      )!;

      const scanResult = await recordReceptionScan({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentCodeOrBarcode: studentZeroBalance.id,
        verificationMethod: 'barcode',
      });

      expect(scanResult.success).toBe(true);
      expect(scanResult.isNewRecord).toBe(true);
      expect(scanResult.duplicate).toBe(false);
      expect(scanResult.status).toBe('present');
      expect(scanResult.balanceAlert?.hasBalance).toBe(false);
      expect(scanResult.balanceAlert?.balanceDue).toBe(0);
      expect(scanResult.messageAr).toBe('تم تسجيل الحضور بنجاح');
    });

    it('generates Amber Warning state with balanceDue > 0 and overdue warning message', async () => {
      const session = dal.sessions[0];
      const studentWithBalance = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.balanceDue > 0
      )!;

      const scanResult = await recordReceptionScan({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentCodeOrBarcode: studentWithBalance.studentCode || studentWithBalance.id,
        verificationMethod: 'qr',
      });

      expect(scanResult.success).toBe(true);
      expect(scanResult.balanceAlert?.hasBalance).toBe(true);
      expect(scanResult.balanceAlert?.balanceDue).toBe(studentWithBalance.balanceDue);
      expect(scanResult.balanceAlert?.messageAr).toContain(String(studentWithBalance.balanceDue));
    });

    it('formats WhatsApp Arabic attendance message with overdue balance warning suffix', () => {
      const msgNoBalance = formatWhatsAppAttendanceMessage({
        studentName: 'محمود حسن',
        subject: 'كيمياء',
        time: '04:30 م',
        centerName: 'سنتر الماهر',
        balanceDue: 0,
      });

      expect(msgNoBalance).toContain('تم تسجيل حضور الطالب محمود حسن في حصة كيمياء');
      expect(msgNoBalance).not.toContain('⚠️ تنبيه: متبقي مبلغ');

      const msgWithBalance = formatWhatsAppAttendanceMessage({
        studentName: 'أحمد محمود',
        subject: 'الفيزياء',
        time: '04:30 م',
        centerName: 'سنتر الماهر',
        balanceDue: 150,
      });

      expect(msgWithBalance).toContain('تم تسجيل حضور الطالب أحمد محمود في حصة الفيزياء');
      expect(msgWithBalance).toContain('⚠️ تنبيه: متبقي مبلغ 150.00 ج.م مطلوب سداده.');
    });

    it('formats WhatsApp receipt and exam result messages correctly in Arabic', () => {
      const receiptMsg = formatWhatsAppReceiptMessage({
        studentName: 'سارة خالد',
        amount: 300,
        receiptNumber: 'REC-2026-0099',
        description: 'رسوم شهر أكتوبر',
        centerName: 'سنتر الماهر',
      });

      expect(receiptMsg).toContain('تم استلام مبلغ 300.00 ج.م');
      expect(receiptMsg).toContain('REC-2026-0099');

      const examMsg = formatWhatsAppExamResultMessage({
        studentName: 'كريم عادل',
        examTitle: 'امتحان كيرشوف',
        score: 48,
        totalMarks: 50,
        percentage: 96,
        centerName: 'سنتر الماهر',
      });

      expect(examMsg).toContain('48/50 بنسبة 96%');
    });

    it('universal renderer dispatches correct Arabic format for any template name', () => {
      const rendered = renderNotificationContent('student_attendance_ar', {
        studentName: 'ياسر محمد',
        subject: 'أحياء',
        balanceDue: 75,
      });

      expect(rendered).toContain('ياسر محمد');
      expect(rendered).toContain('أحياء');
      expect(rendered).toContain('75.00 ج.م');
    });
  });

  // =========================================================================
  // 3. Procedural Web Audio API Synthesis Engine
  // =========================================================================
  describe('3. Procedural Web Audio API Synthesis Engine', () => {
    it('manages mute and unmute persistence', () => {
      setMuted(true);
      expect(getMuted()).toBe(true);

      const toggled = toggleMuted();
      expect(toggled).toBe(false);
      expect(getMuted()).toBe(false);
    });

    it('safely handles audio synthesis when muted or AudioContext is available', () => {
      // In Node.js / jsdom test environment, window.AudioContext might not be a real hardware sound card
      // Calling playSuccessChime, playWarningChime, playErrorChime should execute cleanly without throwing
      expect(() => playSuccessChime()).not.toThrow();
      expect(() => playWarningChime()).not.toThrow();
      expect(() => playErrorChime()).not.toThrow();

      // When muted, early return without scheduling oscillators
      setMuted(true);
      expect(() => playSuccessChime()).not.toThrow();
      expect(() => playWarningChime()).not.toThrow();
      expect(() => playErrorChime()).not.toThrow();
    });
  });

  // =========================================================================
  // 4. Session Attendance Statistics & Fee Calculations
  // =========================================================================
  describe('4. Session Attendance Statistics & Fee Calculations', () => {
    it('calculates session statistics, percentages, and fee tallies accurately', async () => {
      const session = dal.sessions[0];

      // Record 2 distinct student attendances
      const student1 = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode === 'STD-1001'
      )!;
      const student2 = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId && u.studentCode === 'STD-1002'
      )!;

      await recordReceptionScan({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentCodeOrBarcode: student1.id,
      });

      await recordReceptionScan({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentCodeOrBarcode: student2.id,
      });

      const stats = await calculateSessionStats(session.tenantId, session.id);

      expect(stats.sessionId).toBe(session.id);
      expect(stats.presentCount).toBeGreaterThanOrEqual(2);
      expect(stats.records.length).toBeGreaterThanOrEqual(2);
      expect(stats.attendanceRatePercentage).toBeGreaterThan(0);
      expect(stats.lastScannedAt).toBeDefined();

      // Check student with balance due is counted in statistics
      if (student2.balanceDue > 0) {
        expect(stats.studentsWithBalanceDueCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('enriches student attendance history with session, group, subject, and teacher', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find(
        (u) => u.role === 'STUDENT' && u.tenantId === session.tenantId
      )!;

      await dal.recordAttendanceScan(session.tenantId, session.id, student.id);

      const history = await dal.getStudentAttendanceHistory(session.tenantId, student.id);
      expect(history.length).toBeGreaterThanOrEqual(1);

      const record = history[0];
      expect(record.session).toBeDefined();
      expect(record.sessionId).toBe(session.id);
      expect(record.group).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Idempotent Invariant & ReceptionAttendanceStore
  // =========================================================================
  describe('5. Idempotency Invariants & Store', () => {
    it('verifies ReceptionAttendanceStore maintains identical contract to contract-bridge', () => {
      const store = new ReceptionAttendanceStore();
      const sessionId = 'test-session-1';
      const studentId = 'test-student-1';
      const code = 'STD-99';

      const scan1 = store.recordScan(sessionId, studentId, code);
      expect(scan1.isNewRecord).toBe(true);
      expect(scan1.duplicate).toBe(false);
      expect(store.getAttendanceCount(sessionId)).toBe(1);

      const scan2 = store.recordScan(sessionId, studentId, code);
      expect(scan2.isNewRecord).toBe(false);
      expect(scan2.duplicate).toBe(true);
      expect(scan2.recordedAt).toBe(scan1.recordedAt);
      expect(store.getAttendanceCount(sessionId)).toBe(1);
    });

    it('resends failed notifications and updates status to delivered', async () => {
      // Find a notification or enqueue one
      const notif = await dal.enqueueNotification({
        tenantId: 'tenant-test-resend',
        recipientPhone: '+201099999999',
        channel: 'whatsapp',
        templateName: 'student_attendance_ar',
        payload: { studentName: 'طارق' },
      });

      notif.status = 'failed';
      notif.errorMessage = 'Simulated timeout';

      const resent = await dal.resendNotification(notif.id);
      expect(resent.status).toBe('delivered');
      expect(resent.retryCount).toBe(1);
      expect(resent.errorMessage).toBeUndefined();
    });
  });
});
