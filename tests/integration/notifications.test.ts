import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationQueueEngine } from '../fixtures/contract-bridge';

describe('Tier 3: Asynchronous Non-Blocking Notification Queue & Delivery', () => {
  let queueEngine: NotificationQueueEngine;

  beforeEach(() => {
    queueEngine = new NotificationQueueEngine();
  });

  it('enqueues notification within <20ms execution budget without blocking', () => {
    const { jobId, durationMs } = queueEngine.enqueue(
      'center-alpha',
      '+201001234567',
      'WHATSAPP',
      'student_attendance_ar',
      {
        studentName: 'محمود حسن',
        subject: 'كيمياء',
        teacher: 'أ/ خالد فهمي',
        time: '04:30 م',
      }
    );

    expect(jobId).toBeDefined();
    // Non-blocking requirement: enqueue transaction is sub-20ms
    expect(durationMs).toBeLessThan(20);

    const jobs = queueEngine.getJobs();
    expect(jobs.length).toBe(1);
    expect(jobs[0].status).toBe('QUEUED');
    expect(jobs[0].recipient).toBe('+201001234567');
    expect(jobs[0].channel).toBe('WHATSAPP');
    expect(jobs[0].templateId).toBe('student_attendance_ar');
  });

  it('supports Firebase Cloud Messaging (Web Push) channel alongside WhatsApp', () => {
    queueEngine.enqueue(
      'center-alpha',
      'fcm-device-token-abc123xyz',
      'FCM',
      'exam_published_alert',
      {
        examTitle: 'امتحان الفيزياء الشهري',
        link: '/center/center-alpha/exams/runner/ex-101',
      }
    );

    const jobs = queueEngine.getJobs();
    expect(jobs.length).toBe(1);
    expect(jobs[0].channel).toBe('FCM');
    expect(jobs[0].recipient).toBe('fcm-device-token-abc123xyz');
  });

  it('safely processes queue in sandboxed mode when live API credentials are unset', () => {
    // Enqueue 3 notifications
    queueEngine.enqueue('center-alpha', '+201001111111', 'WHATSAPP', 'attendance_alert', { id: 1 });
    queueEngine.enqueue('center-alpha', '+201002222222', 'WHATSAPP', 'receipt_alert', { id: 2 });
    queueEngine.enqueue('center-alpha', 'fcm-token-3', 'FCM', 'grade_alert', { id: 3 });

    expect(queueEngine.getJobs().length).toBe(3);
    expect(queueEngine.getJobs().every((j) => j.status === 'QUEUED')).toBe(true);

    // Process in sandbox fallback mode
    const processed = queueEngine.processQueueSandbox();

    expect(processed.length).toBe(3);
    expect(processed.every((j) => j.status === 'SIMULATED_DELIVERED')).toBe(true);
    expect(processed.every((j) => j.processedAt !== undefined)).toBe(true);
  });

  it('isolates notification queue failures from reception attendance transactions', () => {
    // Primary operational transactions must complete regardless of notification queue state
    const enqueueAction = () => {
      return queueEngine.enqueue(
        'center-alpha',
        '+201099999999',
        'WHATSAPP',
        'attendance_confirm',
        { session: 'S-99' }
      );
    };

    expect(enqueueAction).not.toThrow();
    const jobs = queueEngine.getJobs();
    expect(jobs.length).toBe(1);
  });
});
