/**
 * Challenger M4-2: Empirical Stress Test Suite for Milestone 4
 *
 * Focus Areas:
 * 1. Enqueue Latency Guarantee (< 20ms) under single and 1,000-iteration burst conditions
 * 2. Duplicate Scan Notification Suppression (preventing duplicate guardian alerts on repeated scans)
 * 3. Standardized Arabic WhatsApp Formatting (accurate metadata + balanceDue alert if and only if balanceDue > 0)
 * 4. Sandboxed Processing Mode (transition from QUEUED to SIMULATED_DELIVERED with valid timestamp)
 * 5. 1-Click Resend Workflow (retryCount increment, status reset to delivered, error clearing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotificationQueueEngine,
  getNotificationQueueEngine,
} from '@/lib/notifications/queue';
import {
  formatWhatsAppAttendanceMessage,
  formatWhatsAppReceiptMessage,
  formatWhatsAppExamResultMessage,
  formatWhatsAppExamPublishedMessage,
  formatWhatsAppAbsenceMessage,
  formatFCMPushPayload,
  renderNotificationContent,
} from '@/lib/notifications/formatter';
import { getDataProvider } from '@/lib/dal/factory';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { recordReceptionScan } from '@/lib/attendance/checkin';

describe('Challenger M4-2: Empirical Stress Test Suite', () => {
  let queueEngine: NotificationQueueEngine;
  let dal: MockDataProvider;

  beforeEach(() => {
    queueEngine = new NotificationQueueEngine();
    dal = new MockDataProvider();
  });

  // =========================================================================
  // Mission 1: Enqueue Latency Guarantee (< 20ms Budget)
  // =========================================================================
  describe('Mission 1: Enqueue Latency Budget Guarantee (< 20ms)', () => {
    it('verifies single enqueue executes strictly under 20ms budget', () => {
      const { jobId, durationMs } = queueEngine.enqueue(
        'center-alpha',
        '+201012345678',
        'WHATSAPP',
        'student_attendance_ar',
        { studentName: 'أحمد محمود', sessionName: 'الفيزياء' }
      );

      expect(jobId).toBeDefined();
      expect(jobId.startsWith('notif-')).toBe(true);
      expect(durationMs).toBeLessThan(20);

      const jobs = queueEngine.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe('QUEUED');
    });

    it('empirically verifies 1,000 rapid burst enqueues all satisfy the <20ms budget', () => {
      const iterations = 1000;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { durationMs } = queueEngine.enqueue(
          'center-alpha',
          `+20100000${(i % 9000) + 1000}`,
          i % 2 === 0 ? 'WHATSAPP' : 'FCM',
          'attendance_alert',
          { index: i, timestamp: Date.now() }
        );
        durations.push(durationMs);
      }

      // Assert all 1000 operations took less than 20ms
      const violations = durations.filter((d) => d >= 20);
      expect(violations.length).toBe(0);

      const maxDuration = Math.max(...durations);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // P99 latency
      const sorted = [...durations].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(iterations * 0.99)];

      expect(maxDuration).toBeLessThan(20);
      expect(p99).toBeLessThan(5);
      expect(avgDuration).toBeLessThan(1);
      expect(queueEngine.getJobs().length).toBe(iterations);
    });

    it('verifies DAL enqueueNotification operates strictly under 20ms budget across 100 sequential calls', async () => {
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await dal.enqueueNotification({
          tenantId: 'center-alpha',
          recipientPhone: `+20110000${(i % 9000) + 1000}`,
          channel: 'whatsapp',
          templateName: 'student_attendance_ar',
          payload: { index: i },
        });
        const elapsed = performance.now() - start;
        durations.push(elapsed);
      }

      const violations = durations.filter((d) => d >= 20);
      expect(violations.length).toBe(0);

      const maxDuration = Math.max(...durations);
      expect(maxDuration).toBeLessThan(20);
    });
  });

  // =========================================================================
  // Mission 2: Duplicate Scan Notification Suppression
  // =========================================================================
  describe('Mission 2: Duplicate Scan Notification Suppression', () => {
    it('verifies duplicate attendance scan does NOT enqueue a second notification to the guardian', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find(
        (u) =>
          u.role === 'STUDENT' &&
          u.tenantId === session.tenantId &&
          Boolean(u.guardianPhone)
      )!;

      expect(student).toBeDefined();
      expect(student.guardianPhone).toBeTruthy();

      // Count baseline notifications for this guardian
      const initialLogs = await dal.getNotificationLogs(session.tenantId);
      const baselineCount = initialLogs.filter(
        (n) => n.recipientPhone === student.guardianPhone
      ).length;

      // --- FIRST SCAN (New Attendance) ---
      const scan1 = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        student.id
      );

      expect(scan1.success).toBe(true);
      expect(scan1.isNewRecord).toBe(true);
      expect(scan1.duplicate).toBe(false);

      // Verify exactly 1 new notification was enqueued
      const afterFirstScanLogs = await dal.getNotificationLogs(session.tenantId);
      const afterFirstCount = afterFirstScanLogs.filter(
        (n) => n.recipientPhone === student.guardianPhone
      ).length;
      expect(afterFirstCount).toBe(baselineCount + 1);

      // --- SECOND SCAN (Duplicate Attendance Scan) ---
      const scan2 = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        student.id
      );

      expect(scan2.success).toBe(true);
      expect(scan2.isNewRecord).toBe(false);
      expect(scan2.duplicate).toBe(true);
      expect(scan2.isDuplicate).toBe(true);

      // CRITICAL INVARIANT: Duplicate scan must NOT enqueue another notification
      const afterSecondScanLogs = await dal.getNotificationLogs(session.tenantId);
      const afterSecondCount = afterSecondScanLogs.filter(
        (n) => n.recipientPhone === student.guardianPhone
      ).length;
      expect(afterSecondCount).toBe(afterFirstCount); // Zero increase!

      // --- THIRD TO FIFTH SCANS (Repeated duplicate spam) ---
      for (let i = 0; i < 3; i++) {
        const repeatScan = await dal.recordAttendanceScan(
          session.tenantId,
          session.id,
          student.id
        );
        expect(repeatScan.duplicate).toBe(true);
      }

      const finalLogs = await dal.getNotificationLogs(session.tenantId);
      const finalCount = finalLogs.filter(
        (n) => n.recipientPhone === student.guardianPhone
      ).length;
      expect(finalCount).toBe(afterFirstCount);
    });

    it('empirically verifies concurrent burst scans yield exactly 1 notification under race conditions', async () => {
      const session = dal.sessions[1] || dal.sessions[0];
      const student = dal.users.find(
        (u) =>
          u.role === 'STUDENT' &&
          u.tenantId === session.tenantId &&
          Boolean(u.guardianPhone)
      )!;

      // Clean existing attendance for this student/session to test fresh burst
      dal.attendance = dal.attendance.filter(
        (a) => !(a.sessionId === session.id && a.studentId === student.id)
      );

      const logsBefore = await dal.getNotificationLogs(session.tenantId);
      const countBefore = logsBefore.filter((n) => n.recipientPhone === student.guardianPhone).length;

      // Fire 20 simultaneous concurrent scan requests
      const burstPromises = Array.from({ length: 20 }, () =>
        dal.recordAttendanceScan(session.tenantId, session.id, student.id)
      );

      const results = await Promise.all(burstPromises);

      const newRecordResults = results.filter((r) => r.isNewRecord === true);
      const duplicateResults = results.filter((r) => r.duplicate === true);

      // Invariant: Exactly 1 record inserted, 19 detected as duplicate
      expect(newRecordResults.length).toBe(1);
      expect(duplicateResults.length).toBe(19);

      // Invariant: Exactly 1 notification enqueued to guardian
      const logsAfter = await dal.getNotificationLogs(session.tenantId);
      const countAfter = logsAfter.filter((n) => n.recipientPhone === student.guardianPhone).length;
      expect(countAfter).toBe(countBefore + 1);
    });

    it('gracefully handles students without guardian phone without throwing or enqueuing', async () => {
      const session = dal.sessions[0];
      // Create student without guardian phone
      const studentWithoutPhone = await dal.createStudent(session.tenantId, {
        fullName: 'طالب بدون ولي أمر مسجل',
        grade: 'الصف الأول الثانوي',
        stage: 'المرحلة الثانوية',
      } as any);

      const logsBefore = (await dal.getNotificationLogs(session.tenantId)).length;

      const scanResult = await dal.recordAttendanceScan(
        session.tenantId,
        session.id,
        studentWithoutPhone.id
      );

      expect(scanResult.success).toBe(true);
      expect(scanResult.isNewRecord).toBe(true);

      const logsAfter = (await dal.getNotificationLogs(session.tenantId)).length;
      expect(logsAfter).toBe(logsBefore); // No notification enqueued
    });
  });

  // =========================================================================
  // Mission 3: Arabic WhatsApp Message Formatting
  // =========================================================================
  describe('Mission 3: Arabic Message Formatting & Balance Due Suffix', () => {
    it('formats attendance message with all core details accurately in Arabic', () => {
      const message = formatWhatsAppAttendanceMessage({
        studentName: 'محمود حسن',
        subject: 'كيمياء',
        time: '04:30 م',
        centerName: 'سنتر الأوائل',
        balanceDue: 0,
      });

      expect(message).toContain('محمود حسن');
      expect(message).toContain('كيمياء');
      expect(message).toContain('04:30 م');
      expect(message).toContain('سنتر الأوائل');
      expect(message).toContain('تم تسجيل حضور الطالب محمود حسن في حصة كيمياء بتاريخ 04:30 م - سنتر سنتر الأوائل');
    });

    it('appends overdue balance alert if and only if balanceDue > 0', () => {
      // 1. balanceDue = 0 -> MUST NOT contain alert
      const zeroBalance = formatWhatsAppAttendanceMessage({
        studentName: 'سارة طارق',
        subject: 'لغة عربية',
        time: '10:00 ص',
        centerName: 'سنتر النور',
        balanceDue: 0,
      });
      expect(zeroBalance).not.toContain('⚠️ تنبيه: متبقي مبلغ');
      expect(zeroBalance).not.toContain('مطلوب سداده');

      // 2. balanceDue < 0 (credit balance) -> MUST NOT contain alert
      const creditBalance = formatWhatsAppAttendanceMessage({
        studentName: 'خالد إبراهيم',
        subject: 'رياضيات',
        time: '11:00 ص',
        centerName: 'سنتر النور',
        balanceDue: -50,
      });
      expect(creditBalance).not.toContain('⚠️ تنبيه: متبقي مبلغ');
      expect(creditBalance).not.toContain('مطلوب سداده');

      // 3. balanceDue > 0 -> MUST append '\n⚠️ تنبيه: متبقي مبلغ [المبلغ] ج.م مطلوب سداده'
      const withBalance = formatWhatsAppAttendanceMessage({
        studentName: 'علي أحمد',
        subject: 'فيزياء',
        time: '02:00 م',
        centerName: 'سنتر النور',
        balanceDue: 150,
      });

      expect(withBalance).toContain('\n⚠️ تنبيه: متبقي مبلغ 150.00 ج.م مطلوب سداده');
      expect(withBalance.endsWith('مطلوب سداده.')).toBe(true);
    });

    it('formats decimal and high balance values with two decimal precision', () => {
      const decimalBalance = formatWhatsAppAttendanceMessage({
        studentName: 'عمر شريف',
        balanceDue: 87.5,
      });
      expect(decimalBalance).toContain('87.50 ج.م مطلوب سداده');

      const highBalance = formatWhatsAppAttendanceMessage({
        studentName: 'ياسمين كمال',
        balanceDue: 1250,
      });
      expect(highBalance).toContain('1250.00 ج.م مطلوب سداده');
    });

    it('provides fallback defaults when optional parameters are omitted', () => {
      const defaultMessage = formatWhatsAppAttendanceMessage({
        studentName: 'طالب بدون بيانات إضافية',
      });

      expect(defaultMessage).toContain('طالب بدون بيانات إضافية');
      expect(defaultMessage).toContain('الحصة المقررة');
      expect(defaultMessage).toContain('يلا سنتر');
      expect(defaultMessage).not.toContain('⚠️ تنبيه: متبقي مبلغ');
    });

    it('formats payment receipts, exam results, absences, and FCM push correctly', () => {
      // Payment Receipt
      const receipt = formatWhatsAppReceiptMessage({
        studentName: 'كريم عادل',
        amount: 250,
        receiptNumber: 'REC-2026-0042',
        description: 'اشتراك شهر أكتوبر',
        centerName: 'سنتر النجاح',
      });
      expect(receipt).toContain('250.00 ج.م');
      expect(receipt).toContain('REC-2026-0042');
      expect(receipt).toContain('كريم عادل');
      expect(receipt).toContain('سنتر النجاح');

      // Exam Result
      const exam = formatWhatsAppExamResultMessage({
        studentName: 'مريم محمد',
        examTitle: 'الشامل في التفاضل',
        score: 48,
        totalMarks: 50,
        percentage: 96,
        centerName: 'سنتر النجاح',
      });
      expect(exam).toContain('الشامل في التفاضل');
      expect(exam).toContain('48/50 بنسبة 96%');
      expect(exam).toContain('مريم محمد');

      // Exam Published
      const published = formatWhatsAppExamPublishedMessage({
        examTitle: 'امتحان كيرشوف للفيزياء',
        link: 'https://yallacenter.com/exams/101',
        centerName: 'سنتر النجاح',
      });
      expect(published).toContain('امتحان كيرشوف للفيزياء');
      expect(published).toContain('https://yallacenter.com/exams/101');

      // Absence Alert
      const absence = formatWhatsAppAbsenceMessage({
        studentName: 'زياد هاني',
        subject: 'الأحياء',
        centerName: 'سنتر النجاح',
      });
      expect(absence).toContain('تنبيه لولي الأمر: تغيب الطالب زياد هاني');
      expect(absence).toContain('الأحياء');

      // FCM Web Push Payload
      const push = formatFCMPushPayload({
        deviceToken: 'device-token-12345',
        title: 'إشعار حضور',
        body: 'تم تسجيل حضور الطالب',
      });
      expect(push.to).toBe('device-token-12345');
      expect(push.notification.dir).toBe('rtl');
      expect(push.notification.lang).toBe('ar');
      expect(push.notification.title).toBe('إشعار حضور');
    });

    it('universal renderNotificationContent dispatches properly according to templateName', () => {
      const renderedWithBalance = renderNotificationContent('student_attendance_ar', {
        studentName: 'أنس مصطفى',
        subject: 'اللغة الإنجليزية',
        centerName: 'سنتر الفا',
        balanceDue: 200,
      });
      expect(renderedWithBalance).toContain('أنس مصطفى');
      expect(renderedWithBalance).toContain('200.00 ج.م مطلوب سداده');

      const renderedWithoutBalance = renderNotificationContent('student_attendance_ar', {
        studentName: 'أنس مصطفى',
        subject: 'اللغة الإنجليزية',
        centerName: 'سنتر الفا',
        balanceDue: 0,
      });
      expect(renderedWithoutBalance).not.toContain('⚠️ تنبيه: متبقي مبلغ');
    });
  });

  // =========================================================================
  // Mission 4: Sandboxed Processing Mode
  // =========================================================================
  describe('Mission 4: Sandboxed Processing Mode', () => {
    it('transitions queued notifications to SIMULATED_DELIVERED with valid timestamps', () => {
      // Enqueue 5 jobs across different channels
      queueEngine.enqueue('center-alpha', '+201011111111', 'WHATSAPP', 'attendance_alert', { id: 1 });
      queueEngine.enqueue('center-alpha', '+201022222222', 'WHATSAPP', 'receipt_alert', { id: 2 });
      queueEngine.enqueue('center-alpha', 'token-fcm-3', 'FCM', 'exam_published', { id: 3 });
      queueEngine.enqueue('center-alpha', '+201044444444', 'SMS', 'absence_alert', { id: 4 });
      queueEngine.enqueue('center-alpha', 'token-fcm-5', 'FCM', 'grade_alert', { id: 5 });

      const before = queueEngine.getJobs();
      expect(before.length).toBe(5);
      expect(before.every((j) => j.status === 'QUEUED')).toBe(true);
      expect(before.every((j) => j.processedAt === undefined)).toBe(true);

      const beforeTimestamp = new Date().toISOString();

      // Process sandbox queue
      const processed = queueEngine.processQueueSandbox();

      expect(processed.length).toBe(5);
      expect(processed.every((j) => j.status === 'SIMULATED_DELIVERED')).toBe(true);

      for (const job of processed) {
        expect(job.status).toBe('SIMULATED_DELIVERED');
        expect(job.processedAt).toBeDefined();
        expect(typeof job.processedAt).toBe('string');
        // Valid ISO date
        expect(new Date(job.processedAt!).toISOString()).toBe(job.processedAt);
        expect(job.processedAt! >= beforeTimestamp).toBe(true);
      }

      // Check stats reflect 0 pending and 5 sent/delivered
      const stats = queueEngine.getStats();
      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(0);
      expect(stats.sent).toBe(5);
      expect(stats.failed).toBe(0);
    });

    it('handles idempotent replay of processQueueSandbox safely without duplicate or corrupt states', () => {
      queueEngine.enqueue('center-alpha', '+201055555555', 'WHATSAPP', 'alert', {});
      queueEngine.processQueueSandbox();

      const jobsAfterFirst = queueEngine.getJobs();
      const firstProcessedAt = jobsAfterFirst[0].processedAt;

      // Re-run sandbox processing
      const replay = queueEngine.processQueueSandbox();

      expect(replay.length).toBe(1);
      expect(replay[0].status).toBe('SIMULATED_DELIVERED');
      // Already delivered jobs are preserved
      expect(replay[0].processedAt).toBe(firstProcessedAt);
    });
  });

  // =========================================================================
  // Mission 5: 1-Click Resend Workflow
  // =========================================================================
  describe('Mission 5: 1-Click Resend Workflow', () => {
    it('verifies resendNotification increments retry count, updates sentAt, and resets status to delivered', async () => {
      // 1. Enqueue test notification in DAL
      const notif = await dal.enqueueNotification({
        tenantId: 'center-resend-test',
        recipientPhone: '+201099887766',
        channel: 'whatsapp',
        templateName: 'student_attendance_ar',
        payload: { studentName: 'أحمد سعيد', balanceDue: 0 },
      });

      // Simulate a failed delivery state
      notif.status = 'failed';
      notif.errorMessage = 'WhatsApp API Gateway timeout (simulated 504)';
      notif.retryCount = 0;

      // First resend attempt
      const resent1 = await dal.resendNotification(notif.id);

      expect(resent1.id).toBe(notif.id);
      expect(resent1.status).toBe('delivered');
      expect(resent1.retryCount).toBe(1);
      expect(resent1.errorMessage).toBeUndefined();
      expect(resent1.sentAt).toBeDefined();

      // Second resend attempt
      const resent2 = await dal.resendNotification(notif.id);
      expect(resent2.retryCount).toBe(2);
      expect(resent2.status).toBe('delivered');

      // Third resend attempt
      const resent3 = await dal.resendNotification(notif.id);
      expect(resent3.retryCount).toBe(3);
    });

    it('rejects resend for non-existent notification ID with descriptive Arabic error', async () => {
      await expect(dal.resendNotification('non-existent-id-99999')).rejects.toThrow(
        'الإشعار غير موجود'
      );
    });

    it('verifies queue engine resendJob resets status and updates processedAt', () => {
      const { jobId } = queueEngine.enqueue(
        'center-alpha',
        '+201077777777',
        'WHATSAPP',
        'test_alert',
        {}
      );

      // Resend job
      const resent = queueEngine.resendJob(jobId);
      expect(resent).not.toBeNull();
      expect(resent!.id).toBe(jobId);
      expect(resent!.status).toBe('SIMULATED_DELIVERED');
      expect(resent!.processedAt).toBeDefined();

      // Non-existent job
      const nonExistent = queueEngine.resendJob('fake-job-id');
      expect(nonExistent).toBeNull();
    });
  });

  // =========================================================================
  // Mission 6: API Route Handlers Integration & Error Boundaries
  // =========================================================================
  describe('Mission 6: API Route Handlers Integration & Error Boundaries', () => {
    it('verifies resend API endpoint increments retry count and returns 200', async () => {
      const { POST: resendRoute } = await import(
        '@/app/api/center/[centerSlug]/notifications/resend/route'
      );
      const { NextRequest } = await import('next/server');
      const sharedDal = getDataProvider();

      // Create a test notification in DAL with valid tenant
      const notif = await sharedDal.enqueueNotification({
        tenantId: 'tenant-maher-001',
        recipientPhone: '+201012341234',
        channel: 'whatsapp',
        templateName: 'student_attendance_ar',
        payload: { studentName: 'طارق' },
      });
      notif.status = 'failed';

      const req = new NextRequest(
        'http://localhost/api/center/al-maher/notifications/resend',
        {
          method: 'POST',
          body: JSON.stringify({ notificationId: notif.id }),
        }
      );

      const res = await resendRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.notification.retryCount).toBeGreaterThanOrEqual(1);
      expect(json.notification.status).toBe('delivered');
    });

    it('verifies resend API validates missing notification ID with HTTP 400', async () => {
      const { POST: resendRoute } = await import(
        '@/app/api/center/[centerSlug]/notifications/resend/route'
      );
      const { NextRequest } = await import('next/server');

      const req = new NextRequest(
        'http://localhost/api/center/al-maher/notifications/resend',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );

      const res = await resendRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('MISSING_ID');
    });

    it('verifies attendance scan API rejects missing fields with HTTP 400', async () => {
      const { POST: scanRoute } = await import(
        '@/app/api/center/[centerSlug]/attendance/scan/route'
      );
      const { NextRequest } = await import('next/server');

      const req = new NextRequest(
        'http://localhost/api/center/al-maher/attendance/scan',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId: 'session-1' }),
        }
      );

      const res = await scanRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('MISSING_FIELDS');
    });

    it('verifies attendance scan API rejects non-existent center with HTTP 404', async () => {
      const { POST: scanRoute } = await import(
        '@/app/api/center/[centerSlug]/attendance/scan/route'
      );
      const { NextRequest } = await import('next/server');

      const req = new NextRequest(
        'http://localhost/api/center/fake-center-slug/attendance/scan',
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'session-1',
            studentCodeOrBarcode: 'STD-1',
          }),
        }
      );

      const res = await scanRoute(req, {
        params: Promise.resolve({ centerSlug: 'fake-center-slug' }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('CENTER_NOT_FOUND');
    });

    it('verifies notifications list API returns logs and calculated KPI stats', async () => {
      const { GET: notificationsRoute } = await import(
        '@/app/api/center/[centerSlug]/notifications/route'
      );
      const { NextRequest } = await import('next/server');

      const req = new NextRequest(
        'http://localhost/api/center/al-maher/notifications',
        { method: 'GET' }
      );

      const res = await notificationsRoute(req, {
        params: Promise.resolve({ centerSlug: 'al-maher' }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.logs)).toBe(true);
      expect(json.stats).toBeDefined();
      expect(typeof json.stats.total).toBe('number');
      expect(typeof json.stats.pending).toBe('number');
      expect(typeof json.stats.sent).toBe('number');
      expect(typeof json.stats.failed).toBe('number');
    });
  });
});

