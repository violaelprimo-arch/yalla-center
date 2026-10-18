import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';
import { getDataProvider } from '@/lib/dal/factory';

describe('Data Access Layer (DAL) & MockDataProvider Implementation', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  describe('Factory Pattern Resolution', () => {
    it('returns an instance implementing IDataProvider', () => {
      const provider = getDataProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getTenantBySlug).toBe('function');
      expect(typeof provider.recordAttendance).toBe('function');
    });
  });

  describe('Tenants & Structural Metadata', () => {
    it('resolves demo centers al-maher and al-rowad', async () => {
      const maher = await dal.getTenantBySlug('al-maher');
      expect(maher).not.toBeNull();
      expect(maher?.nameAr).toContain('الماهر');

      const rowad = await dal.getTenantBySlug('al-rowad');
      expect(rowad).not.toBeNull();
      expect(rowad?.nameAr).toContain('الرواد');
    });

    it('retrieves branches and classrooms for tenant', async () => {
      const branches = await dal.getBranches('tenant-maher-001');
      expect(branches.length).toBeGreaterThan(0);

      const classrooms = await dal.getClassrooms('tenant-maher-001');
      expect(classrooms.length).toBeGreaterThan(0);
      expect(classrooms[0].capacity).toBeGreaterThan(0);
    });
  });

  describe('Fast Reception Attendance Idempotency (AC-7)', () => {
    it('records attendance on first scan and marks duplicate on second scan without adding a second record', async () => {
      const session = dal.sessions[0];
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      // First scan
      const firstScan = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode || student.id,
      });

      expect(firstScan.success).toBe(true);
      expect(firstScan.isNewRecord).toBe(true);
      expect(firstScan.duplicate).toBe(false);
      expect(firstScan.attendance).toBeDefined();

      // Second scan (idempotent duplicate)
      const secondScan = await dal.recordAttendance({
        tenantId: session.tenantId,
        sessionId: session.id,
        studentIdOrCode: student.studentCode || student.id,
      });

      expect(secondScan.success).toBe(true);
      expect(secondScan.isNewRecord).toBe(false);
      expect(secondScan.duplicate).toBe(true);

      // Verify total attendance records for this session is exactly 1
      const attendanceList = await dal.getSessionAttendance(session.id);
      const studentRecords = attendanceList.filter((a) => a.studentId === student.id);
      expect(studentRecords.length).toBe(1);
    });
  });

  describe('Security Guardrails & RBAC (AC-4, AC-5, AC-6)', () => {
    it('allows student to update their own avatar URL (AC-4)', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;
      const newAvatar = 'https://example.com/new-avatar.jpg';

      const result = await dal.updateUserProfilePhoto(
        student.id,
        newAvatar,
        student.id,
        'STUDENT'
      );

      expect(result.success).toBe(true);
      expect(result.data?.avatarUrl).toBe(newAvatar);
    });

    it('rejects student attempting to update administrative or financial fields with HTTP 403 (AC-5)', async () => {
      const student = dal.users.find((u) => u.role === 'STUDENT')!;

      const result = await dal.updateUser(
        student.id,
        { fullName: 'اسم معدل بطريقة غير مصرحة', balanceDue: 0 },
        student.id,
        'STUDENT'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toContain('403');
    });

    it('rejects teacher attempting to update contractual salary rates with HTTP 403 (AC-6)', async () => {
      const rate = dal.teacherRates[0];

      const result = await dal.updateTeacherRate(
        rate.id,
        { fixedRatePerStudent: 100 },
        'TEACHER'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  describe('Dual Teacher Compensation Engine (AC-1 & AC-2)', () => {
    it('calculates Center Subscription compensation accurately (AC-1)', () => {
      const sessions = [
        { sessionId: 's1', sessionStatus: 'completed' as const, validAttendanceCount: 12 },
        { sessionId: 's2', sessionStatus: 'completed' as const, validAttendanceCount: 15 },
        { sessionId: 's3', sessionStatus: 'completed' as const, validAttendanceCount: 11 },
        { sessionId: 's4', sessionStatus: 'completed' as const, validAttendanceCount: 14 },
        { sessionId: 's5', sessionStatus: 'canceled' as const, validAttendanceCount: 20 },
      ];

      const result = dal.calculateCenterSubscriptionCompensation(sessions, 20);
      expect(result.conductedSessionsCount).toBe(4);
      expect(result.totalValidAttendance).toBe(52);
      expect(result.averageAttendance).toBe(13);
      expect(result.compensationAmount).toBe(260.0);
      expect(result.excludedSessionsCount).toBe(1);
    });

    it('calculates Private Lessons split with zero leakage (AC-2)', () => {
      const items = [
        {
          enrollmentId: 'e1',
          studentId: 'st1',
          basePrice: 100,
          discountType: 'none' as const,
          discountValue: 0,
          collectedAmount: 100,
        },
        {
          enrollmentId: 'e2',
          studentId: 'st2',
          basePrice: 100,
          discountType: 'percentage' as const,
          discountValue: 20,
          collectedAmount: 80,
        },
        {
          enrollmentId: 'e3',
          studentId: 'st3',
          basePrice: 100,
          discountType: 'free_100' as const,
          discountValue: 0,
          collectedAmount: 0,
        },
      ];

      const batch = dal.calculatePrivateLessonsSplit(items, 70);
      expect(batch.roundingLeakage).toBe(0);
      expect(batch.items[0].teacherShare).toBe(70);
      expect(batch.items[0].centerShare).toBe(30);
      expect(batch.items[1].teacherShare).toBe(56);
      expect(batch.items[1].centerShare).toBe(24);
      expect(batch.items[2].teacherShare).toBe(0);
      expect(batch.items[2].centerShare).toBe(0);
    });
  });

  describe('Grounded AI Exam Preflight Gate & Draft Review Workflow (AC-8)', () => {
    it('rejects exam generation if selected document is unindexed', async () => {
      const preflight = await dal.validateExamPreflight(['mat-ac-unindexed']);
      expect(preflight.allowed).toBe(false);
      expect(preflight.errorCode).toBe('UNINDEXED_SOURCE_DOCUMENTS');
    });

    it('rejects exam generation if selected document has fewer than 200 words', async () => {
      const preflight = await dal.validateExamPreflight(['mat-ohm-insufficient']);
      expect(preflight.allowed).toBe(false);
      expect(preflight.errorCode).toBe('INSUFFICIENT_SOURCE_DOCUMENTS');
    });

    it('allows exam generation when source document is indexed with >=200 words and sets status to draft', async () => {
      const preflight = await dal.validateExamPreflight(['mat-kirchhoff-complete']);
      expect(preflight.allowed).toBe(true);
      expect(preflight.totalWordCount).toBeGreaterThanOrEqual(200);

      const created = await dal.createExamDraft({
        tenantId: 'tenant-maher-001',
        groupId: 'grp-phys-sun',
        teacherId: 'user-teacher-phys',
        title: 'اختبار تجريبي لقوانين كيرشوف',
        durationMinutes: 25,
        sourceDocumentIds: ['mat-kirchhoff-complete'],
        questions: [
          {
            questionNumber: 1,
            questionText: 'ما هي وحدة قياس القوة الدافعة الكهربية؟',
            katexFormula: 'V = W / Q',
            questionType: 'mcq',
            options: ['فولت', 'أمبير', 'أوم', 'جول'],
            correctAnswer: 'فولت',
            marks: 5,
            orderIndex: 1,
          },
        ],
      });

      expect(created.exam.status).toBe('draft');
      expect(created.questions.length).toBe(1);
    });
  });

  describe('Financial Invoicing & Payment Receipts', () => {
    it('records partial payment and updates invoice paidAmount', async () => {
      const invoice = dal.invoices.find((i) => i.status === 'partially_paid')!;
      const initialPaid = invoice.paidAmount;

      const paymentResult = await dal.recordPayment({
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        amountPaid: 50,
        paymentMethod: 'cash',
        cashierUserId: 'user-recep-001',
      });

      expect(paymentResult.payment.amountPaid).toBe(50);
      expect(paymentResult.updatedInvoice.paidAmount).toBe(initialPaid + 50);
    });
  });
});
