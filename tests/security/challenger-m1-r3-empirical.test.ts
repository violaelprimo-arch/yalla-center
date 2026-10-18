import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { IDataProvider, TeacherRate, NotificationRecord, NotificationLog, UserRole } from '@/lib/dal';

describe('Challenger M1-R3-1: Empirical Verification of DAL Convenience Aliases and Typing', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  // =========================================================================
  // 1. Notification Aliases & Methods (getNotifications vs getNotificationLogs)
  // =========================================================================
  describe('1. dal.getNotifications vs dal.getNotificationLogs Parity', () => {
    it('verifies dal implements both getNotifications and getNotificationLogs', () => {
      expect(typeof dal.getNotificationLogs).toBe('function');
      expect(typeof dal.getNotifications).toBe('function');
    });

    it('returns identical empty arrays when no notifications exist for a tenant', async () => {
      const tenantId = 'empty-tenant-999';
      const fromLogs = await dal.getNotificationLogs(tenantId);
      const fromAlias = await dal.getNotifications(tenantId);

      expect(fromLogs).toEqual([]);
      expect(fromAlias).toEqual([]);
      expect(fromAlias).toEqual(fromLogs);
    });

    it('returns identical notification records after single notification enqueue', async () => {
      const tenantId = 'tenant-maher-001';

      const enqueued = await dal.enqueueNotification({
        tenantId,
        recipientPhone: '+201000000001',
        channel: 'whatsapp',
        templateName: 'attendance_checkin',
        payload: { studentName: 'أحمد علي', sessionName: 'رياضيات 3 ثانوي' },
      });

      const fromLogs = await dal.getNotificationLogs(tenantId);
      const fromAlias = await dal.getNotifications(tenantId);

      expect(fromLogs.length).toBe(1);
      expect(fromAlias.length).toBe(1);
      expect(fromAlias[0]).toEqual(fromLogs[0]);
      expect(fromAlias[0].id).toBe(enqueued.id);
      expect(fromAlias[0].templateName).toBe('attendance_checkin');
    });

    it('returns identical notification records across multi-item datasets and preserves ordering', async () => {
      const tenantId = 'tenant-maher-001';

      const createdIds: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const notif = await dal.enqueueNotification({
          tenantId,
          recipientPhone: `+20100000000${i}`,
          channel: i % 2 === 0 ? 'fcm' : 'whatsapp',
          templateName: `template_${i}`,
          payload: { index: i },
        });
        createdIds.push(notif.id);
      }

      const logs = await dal.getNotificationLogs(tenantId);
      const notifs = await dal.getNotifications(tenantId);

      expect(logs.length).toBe(7);
      expect(notifs.length).toBe(7);
      expect(notifs).toEqual(logs);

      for (let i = 0; i < logs.length; i++) {
        expect(notifs[i]).toStrictEqual(logs[i]);
        expect(notifs[i].id).toBe(createdIds[i]);
      }
    });

    it('verifies identical behavior under limit filtering (limit=1, limit=3, limit=0, limit=-1, limit=100)', async () => {
      const tenantId = 'tenant-limit-test';

      for (let i = 1; i <= 5; i++) {
        await dal.enqueueNotification({
          tenantId,
          recipientPhone: `+20100000001${i}`,
          channel: 'whatsapp',
          templateName: `batch_${i}`,
          payload: { step: i },
        });
      }

      // Test limit = 1
      const logs1 = await dal.getNotificationLogs(tenantId, 1);
      const notifs1 = await dal.getNotifications(tenantId, 1);
      expect(logs1.length).toBe(1);
      expect(notifs1.length).toBe(1);
      expect(notifs1).toEqual(logs1);

      // Test limit = 3
      const logs3 = await dal.getNotificationLogs(tenantId, 3);
      const notifs3 = await dal.getNotifications(tenantId, 3);
      expect(logs3.length).toBe(3);
      expect(notifs3.length).toBe(3);
      expect(notifs3).toEqual(logs3);

      // Test limit = 0 (limit not > 0 returns full array)
      const logs0 = await dal.getNotificationLogs(tenantId, 0);
      const notifs0 = await dal.getNotifications(tenantId, 0);
      expect(logs0.length).toBe(5);
      expect(notifs0.length).toBe(5);
      expect(notifs0).toEqual(logs0);

      // Test limit = -1
      const logsNeg = await dal.getNotificationLogs(tenantId, -1);
      const notifsNeg = await dal.getNotifications(tenantId, -1);
      expect(logsNeg.length).toBe(5);
      expect(notifsNeg.length).toBe(5);
      expect(notifsNeg).toEqual(logsNeg);

      // Test limit > length (100)
      const logs100 = await dal.getNotificationLogs(tenantId, 100);
      const notifs100 = await dal.getNotifications(tenantId, 100);
      expect(logs100.length).toBe(5);
      expect(notifs100.length).toBe(5);
      expect(notifs100).toEqual(logs100);
    });

    it('verifies strict tenant isolation between getNotifications and getNotificationLogs', async () => {
      const tenantA = 'tenant-alpha-001';
      const tenantB = 'tenant-beta-002';

      await dal.enqueueNotification({
        tenantId: tenantA,
        recipientPhone: '+201111111111',
        channel: 'whatsapp',
        templateName: 'alpha_msg',
        payload: { scope: 'alpha' },
      });

      await dal.enqueueNotification({
        tenantId: tenantB,
        recipientPhone: '+202222222222',
        channel: 'fcm',
        templateName: 'beta_msg',
        payload: { scope: 'beta' },
      });

      const notifsA = await dal.getNotifications(tenantA);
      const logsA = await dal.getNotificationLogs(tenantA);
      expect(notifsA.length).toBe(1);
      expect(logsA.length).toBe(1);
      expect(notifsA[0].tenantId).toBe(tenantA);
      expect(notifsA).toEqual(logsA);

      const notifsB = await dal.getNotifications(tenantB);
      const logsB = await dal.getNotificationLogs(tenantB);
      expect(notifsB.length).toBe(1);
      expect(logsB.length).toBe(1);
      expect(notifsB[0].tenantId).toBe(tenantB);
      expect(notifsB).toEqual(logsB);
    });

    it('verifies static typing: NotificationLog is identical to NotificationRecord', () => {
      const sample: NotificationRecord = {
        id: 'notif-1',
        tenantId: 'tenant-1',
        recipientPhone: '+201000000000',
        channel: 'whatsapp',
        templateName: 'test',
        payload: {},
        status: 'sent',
        retryCount: 0,
        scheduledAt: '2026-10-18T00:00:00Z',
      };

      const asLog: NotificationLog = sample;
      const asRecord: NotificationRecord = asLog;
      expect(asLog).toBe(asRecord);
    });
  });

  // =========================================================================
  // 2. TeacherRate splitPercentage Property & Dual Synchronization
  // =========================================================================
  describe('2. TeacherRate.splitPercentage Verification & Synchronization', () => {
    it('verifies all initially seeded teacher rates have splitPercentage equal to teacherPercentage', () => {
      const seededRates = dal.teacherRates;
      expect(seededRates.length).toBeGreaterThanOrEqual(2);

      for (const rate of seededRates) {
        expect(rate.splitPercentage).toBeDefined();
        expect(rate.splitPercentage).toBe(rate.teacherPercentage);
      }

      // Explicit check on math rate (center subscription: 0% split)
      const mathRate = seededRates.find((r) => r.id === 'rate-teacher-math')!;
      expect(mathRate.splitPercentage).toBe(0);
      expect(mathRate.teacherPercentage).toBe(0);

      // Explicit check on phys rate (private lesson: 70% split)
      const physRate = seededRates.find((r) => r.id === 'rate-teacher-phys')!;
      expect(physRate.splitPercentage).toBe(70.0);
      expect(physRate.teacherPercentage).toBe(70.0);
      expect(physRate.centerPercentage).toBe(30.0);
    });

    it('updates teacherPercentage and centerPercentage when splitPercentage is provided alone', async () => {
      const rate = dal.teacherRates[0];

      const res = await dal.updateTeacherRate(
        rate.id,
        { splitPercentage: 80 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data?.splitPercentage).toBe(80);
      expect(res.data?.teacherPercentage).toBe(80);
      expect(res.data?.centerPercentage).toBe(20);

      // Verify persisted state in dal
      const updated = dal.teacherRates.find((r) => r.id === rate.id)!;
      expect(updated.splitPercentage).toBe(80);
      expect(updated.teacherPercentage).toBe(80);
      expect(updated.centerPercentage).toBe(20);
    });

    it('handles boundary value splitPercentage = 0 correctly (falsy zero boundary check)', async () => {
      const rate = dal.teacherRates[1]; // Initially 70%

      const res = await dal.updateTeacherRate(
        rate.id,
        { splitPercentage: 0 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.splitPercentage).toBe(0);
      expect(res.data?.teacherPercentage).toBe(0);
      expect(res.data?.centerPercentage).toBe(100);
    });

    it('handles boundary value splitPercentage = 100 correctly', async () => {
      const rate = dal.teacherRates[0];

      const res = await dal.updateTeacherRate(
        rate.id,
        { splitPercentage: 100 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.splitPercentage).toBe(100);
      expect(res.data?.teacherPercentage).toBe(100);
      expect(res.data?.centerPercentage).toBe(0);
    });

    it('handles floating point splitPercentage (e.g., 66.5% split)', async () => {
      const rate = dal.teacherRates[0];

      const res = await dal.updateTeacherRate(
        rate.id,
        { splitPercentage: 66.5 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.splitPercentage).toBe(66.5);
      expect(res.data?.teacherPercentage).toBe(66.5);
      expect(res.data?.centerPercentage).toBeCloseTo(33.5, 5);
    });

    it('synchronizes splitPercentage when teacherPercentage is updated alone', async () => {
      const rate = dal.teacherRates[0];

      const res = await dal.updateTeacherRate(
        rate.id,
        { teacherPercentage: 85, centerPercentage: 15 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.teacherPercentage).toBe(85);
      expect(res.data?.centerPercentage).toBe(15);
      expect(res.data?.splitPercentage).toBe(85);
    });

    it('preserves splitPercentage when updating unrelated properties', async () => {
      const rate = dal.teacherRates[1];
      const previousSplit = rate.splitPercentage;
      expect(previousSplit).toBeDefined();

      const res = await dal.updateTeacherRate(
        rate.id,
        { fixedRatePerStudent: 45.0, isActive: false },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.fixedRatePerStudent).toBe(45.0);
      expect(res.data?.isActive).toBe(false);
      expect(res.data?.splitPercentage).toBe(previousSplit);
      expect(res.data?.teacherPercentage).toBe(previousSplit);
    });

    it('respects both splitPercentage and explicit centerPercentage if both are provided', async () => {
      const rate = dal.teacherRates[0];

      const res = await dal.updateTeacherRate(
        rate.id,
        { splitPercentage: 75, centerPercentage: 25 },
        'CENTER_ADMIN'
      );

      expect(res.success).toBe(true);
      expect(res.data?.splitPercentage).toBe(75);
      expect(res.data?.teacherPercentage).toBe(75);
      expect(res.data?.centerPercentage).toBe(25);
    });
  });

  // =========================================================================
  // 3. Security & RBAC Enforcement on splitPercentage
  // =========================================================================
  describe('3. RBAC Enforcement on splitPercentage Mutation', () => {
    const forbiddenRoles: UserRole[] = ['TEACHER', 'STUDENT', 'PARENT', 'RECEPTIONIST'];
    const authorizedRoles: UserRole[] = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT'];

    it.each(forbiddenRoles)(
      'rejects unauthorized role %s attempting to mutate splitPercentage with HTTP 403',
      async (role) => {
        const rate = dal.teacherRates[0];
        const originalTeacherPercent = rate.teacherPercentage;
        const originalSplitPercent = rate.splitPercentage;

        const res = await dal.updateTeacherRate(
          rate.id,
          { splitPercentage: 95 },
          role
        );

        expect(res.status).toBe(403);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Forbidden|HTTP 403|غير مصرح لك/i);

        // Verify state is unmodified
        const fresh = dal.teacherRates.find((r) => r.id === rate.id)!;
        expect(fresh.teacherPercentage).toBe(originalTeacherPercent);
        expect(fresh.splitPercentage).toBe(originalSplitPercent);
      }
    );

    it.each(authorizedRoles)(
      'permits authorized role %s to mutate splitPercentage with HTTP 200',
      async (role) => {
        const rate = dal.teacherRates[0];

        const res = await dal.updateTeacherRate(
          rate.id,
          { splitPercentage: 72 },
          role
        );

        expect(res.status).toBe(200);
        expect(res.success).toBe(true);
        expect(res.data?.splitPercentage).toBe(72);
        expect(res.data?.teacherPercentage).toBe(72);
      }
    );
  });
});
