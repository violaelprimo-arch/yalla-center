/**
 * Challenger M3-2: Financial Engine, Cashier Shifts & Payroll Stress Test Suite
 * Path: tests/unit/challenger-m3-financial-stress.test.ts
 *
 * Verifies:
 * 1. Discount Engine Bounds: 1,000 randomized Monte-Carlo inputs testing invariants:
 *    discountAmount <= basePrice, netPrice >= 0, discountAmount + netPrice === basePrice,
 *    fixed discounts exceeding base price, percentage discounts > 100%.
 * 2. Dual Compensation Zero Leakage: 10,000 adversarial trials verifying:
 *    teacherShare + centerShare === netRevenue with exact 0.00 EGP rounding leakage.
 * 3. Cashier Shift Reconciliation: Opening float, physical cash vs digital separation,
 *    cash expense disbursements, closing variance (cashDifference = actualCash - expectedCash),
 *    surplus and shortage detection.
 * 4. Partial Payment Cascade: Paying 150 EGP on a 500 EGP invoice:
 *    invoice paidAmount = 150, remaining = 350, student balanceDue decremented by 150,
 *    cashier shift drawer expected cash incremented by 150, subsequent full settlement.
 * 5. UTF-8 BOM CSV Export: BOM \uFEFF prefix, valid Arabic headers, RFC-4180 CRLF format.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDiscount, normalizeDiscountType, DiscountType } from '@/lib/finance/discounts';
import {
  calculateCenterSubscriptionCompensation,
  calculatePrivateLessonsSplit,
  CompensationDiscountType,
} from '@/lib/finance/compensation';
import { generatePayrollCSV, TeacherPayrollExportRecord } from '@/lib/finance/export';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Challenger M3-2: Financial Engine & Leakage Stress Verification', () => {
  /* ========================================================================
   * 1. DISCOUNT ENGINE BOUNDS & 1,000 MONTE-CARLO RANDOM INPUTS
   * ======================================================================== */
  describe('Mission 1: Discount Engine Bounds & 1,000 Monte-Carlo Trials', () => {
    it('enforces bounds when fixed discount exceeds base price (500 EGP discount on 300 EGP course)', () => {
      const res = calculateDiscount(300, 'FIXED', 500);
      expect(res.basePrice).toBe(300);
      expect(res.discountAmount).toBe(300); // capped at basePrice
      expect(res.netPrice).toBe(0); // net cannot go negative
      expect(res.isFullScholarship).toBe(true);
      expect(res.discountAmount + res.netPrice).toBe(res.basePrice);
    });

    it('enforces bounds when percentage discount exceeds 100% (150% on 200 EGP)', () => {
      const res = calculateDiscount(200, 'PERCENT', 150);
      expect(res.basePrice).toBe(200);
      expect(res.discountAmount).toBe(200);
      expect(res.netPrice).toBe(0);
      expect(res.isFullScholarship).toBe(true);
      expect(res.discountAmount + res.netPrice).toBe(res.basePrice);
    });

    it('empirically verifies 1,000 randomized trials across all discount types and bounds', () => {
      let seed = 987654321;
      function pseudoRandom() {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      }

      const discountTypes: DiscountType[] = [
        'none',
        'NONE',
        'percentage',
        'PERCENT',
        'fixed',
        'FIXED',
        'free_100',
        'SCHOLARSHIP_100',
      ];

      for (let i = 0; i < 1000; i++) {
        // Base price: 0.00 to 10,000.00 EGP
        const basePrice = Math.round(pseudoRandom() * 1000000) / 100;
        const discountType = discountTypes[Math.floor(pseudoRandom() * discountTypes.length)];
        // Discount value: 0 to 200 (for percent) or up to 2x basePrice (for fixed)
        const discountValue = Math.round(pseudoRandom() * 500000) / 100;

        const res = calculateDiscount(basePrice, discountType, discountValue);

        // Invariant 1: discountAmount <= basePrice
        expect(res.discountAmount).toBeLessThanOrEqual(res.basePrice);

        // Invariant 2: netPrice >= 0
        expect(res.netPrice).toBeGreaterThanOrEqual(0);

        // Invariant 3: discountAmount >= 0
        expect(res.discountAmount).toBeGreaterThanOrEqual(0);

        // Invariant 4: Zero Rounding Leakage: discountAmount + netPrice === basePrice
        const sum = Math.round((res.discountAmount + res.netPrice) * 100) / 100;
        expect(sum).toBe(res.basePrice);

        // Invariant 5: Numerical stability (no NaN, finite numbers)
        expect(Number.isFinite(res.basePrice)).toBe(true);
        expect(Number.isFinite(res.discountAmount)).toBe(true);
        expect(Number.isFinite(res.netPrice)).toBe(true);
        expect(Number.isNaN(res.netPrice)).toBe(false);
      }
    });
  });

  /* ========================================================================
   * 2. DUAL COMPENSATION ZERO LEAKAGE (10,000 ADVERSARIAL TRIALS)
   * ======================================================================== */
  describe('Mission 2: Dual Compensation Zero Leakage across 10,000 Adversarial Trials', () => {
    it('empirically verifies 10,000 adversarial trials with 0.00 EGP variance', () => {
      let seed = 135792468;
      function pseudoRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      const discountTypes: CompensationDiscountType[] = ['NONE', 'PERCENT', 'FIXED', 'SCHOLARSHIP_100'];

      for (let i = 0; i < 10000; i++) {
        // Gross price between 0.00 and 15,000.00 EGP
        const grossPrice = Math.round(pseudoRandom() * 1500000) / 100;

        // Random teacher percent between 0.00 and 100.00%
        const teacherPercent = Math.round(pseudoRandom() * 10000) / 100;
        const centerPercent = Math.round((100 - teacherPercent) * 100) / 100;

        const discountType = discountTypes[Math.floor(pseudoRandom() * discountTypes.length)];
        let discountValue = 0;
        if (discountType === 'PERCENT') {
          discountValue = Math.round(pseudoRandom() * 10000) / 100;
        } else if (discountType === 'FIXED') {
          discountValue = Math.round(pseudoRandom() * grossPrice * 1.5 * 100) / 100;
        }

        const res = calculatePrivateLessonsSplit(
          grossPrice,
          discountType,
          discountValue,
          teacherPercent,
          centerPercent
        );

        // Zero Leakage: teacherShare + centerShare must exactly equal netRevenue
        const sharesSum = Math.round((res.teacherShare + res.centerShare) * 100) / 100;
        expect(sharesSum).toBe(res.netRevenue);

        // Delta check for IEEE 754 precision
        const delta = Math.abs((res.teacherShare + res.centerShare) - res.netRevenue);
        expect(delta).toBeLessThan(1e-9);

        // Share bounds
        expect(res.teacherShare).toBeGreaterThanOrEqual(0);
        expect(res.centerShare).toBeGreaterThanOrEqual(0);
        expect(res.netRevenue).toBeLessThanOrEqual(res.grossPrice);
      }
    });

    it('verifies Center Subscription compensation calculation and canceled session exclusions', () => {
      // 4 classes with attendances [12, 15, 11, 14] at 20 EGP rate = 260 EGP
      const sessions = [
        { id: 's1', attendanceCount: 12, isCanceled: false },
        { id: 's2', attendanceCount: 15, isCanceled: false },
        { id: 's3', attendanceCount: 11, isCanceled: false },
        { id: 's4', attendanceCount: 14, isCanceled: false },
        { id: 's5', attendanceCount: 20, isCanceled: true }, // Canceled session excluded!
      ];

      const res = calculateCenterSubscriptionCompensation(sessions, 20);
      expect(res.conductedSessions).toBe(4);
      expect(res.excludedSessionsCount).toBe(1);
      expect(res.totalValidAttendance).toBe(52);
      expect(res.averageAttendance).toBe(13);
      expect(res.totalCompensation).toBe(260.0);
    });

    it('handles zero conducted sessions without division-by-zero or NaN', () => {
      const res = calculateCenterSubscriptionCompensation([], 50);
      expect(res.conductedSessions).toBe(0);
      expect(res.averageAttendance).toBe(0);
      expect(res.totalCompensation).toBe(0);
      expect(Number.isNaN(res.averageAttendance)).toBe(false);
      expect(Number.isNaN(res.totalCompensation)).toBe(false);
    });
  });

  /* ========================================================================
   * 3. CASHIER SHIFT RECONCILIATION & VARIANCE TESTING
   * ======================================================================== */
  describe('Mission 3: Cashier Shift Reconciliation & Inflow Separation', () => {
    let dal: MockDataProvider;
    const tenantId = 'tenant-test-challenger';
    const branchId = 'branch-test-nasr';
    const cashierUserId = 'user-cashier-01';

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    it('verifies shift opening float, cash vs digital collection separation, and expense deduction', async () => {
      // 1. Open shift with 1,000 EGP float
      const shift = await dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId,
        openingCash: 1000.0,
        notes: 'وردية التحدي التجريبي',
      });

      expect(shift.openingCash).toBe(1000.0);
      expect(shift.expectedCash).toBe(1000.0);
      expect(shift.cashCollected).toBe(0.0);
      expect(shift.digitalCollected).toBe(0.0);

      // Create test invoice 1 (300 EGP)
      const inv1 = await dal.createInvoice({
        tenantId,
        studentId: 'user-student-1001',
        totalAmount: 300.0,
        billingMonth: 10,
        billingYear: 2026,
        dueDate: '2026-10-25',
      });

      // Create test invoice 2 (400 EGP)
      const inv2 = await dal.createInvoice({
        tenantId,
        studentId: 'user-student-1002',
        totalAmount: 400.0,
        billingMonth: 10,
        billingYear: 2026,
        dueDate: '2026-10-25',
      });

      // 2. Collect 300 EGP in physical Cash
      await dal.recordPayment({
        tenantId,
        invoiceId: inv1.id,
        amountPaid: 300.0,
        paymentMethod: 'cash',
        cashierUserId,
        shiftId: shift.id,
      });

      // Physical cash collected increases by 300, expectedCash becomes 1000 + 300 = 1300
      expect(shift.cashCollected).toBe(300.0);
      expect(shift.expectedCash).toBe(1300.0);
      expect(shift.digitalCollected).toBe(0.0);

      // 3. Collect 400 EGP via Digital Payment (InstaPay)
      await dal.recordPayment({
        tenantId,
        invoiceId: inv2.id,
        amountPaid: 400.0,
        paymentMethod: 'instapay',
        cashierUserId,
        shiftId: shift.id,
      });

      // Digital collected increases by 400, but physical drawer expected cash remains 1300!
      expect(shift.digitalCollected).toBe(400.0);
      expect(shift.cashCollected).toBe(300.0);
      expect(shift.expectedCash).toBe(1300.0);

      // 4. Record Cash Expense Disbursement of 250 EGP from drawer
      await dal.recordExpense({
        tenantId,
        branchId,
        category: 'صيانة ومرافق',
        description: 'شراء كابلات كهربائية',
        amount: 250.0,
        createdByUserId: cashierUserId,
        shiftId: shift.id,
      });

      expect(shift.cashDisbursed).toBe(250.0);
      // Expected cash becomes: 1000 opening + 300 cash collected - 250 disbursed = 1050 EGP
      expect(shift.expectedCash).toBe(1050.0);

      // 5. Shift closing with exact match (balanced drawer)
      const closedShift = await dal.closeCashierShift({
        shiftId: shift.id,
        actualCash: 1050.0,
        notes: 'مطابقة تامة',
      });

      expect(closedShift.status).toBe('closed');
      expect(closedShift.actualCash).toBe(1050.0);
      expect(closedShift.expectedCash).toBe(1050.0);
      expect(closedShift.cashDifference).toBe(0.0);
    });

    it('verifies shift closing shortage (deficit / negative variance)', async () => {
      const shift = await dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId,
        openingCash: 500.0,
      });

      // Expected is 500, but physical count is 460 (-40 EGP difference)
      const closed = await dal.closeCashierShift({
        shiftId: shift.id,
        actualCash: 460.0,
        notes: 'عجز 40 ج.م',
      });

      expect(closed.cashDifference).toBe(-40.0);
      expect(closed.actualCash).toBe(460.0);
      expect(closed.actualCash! - closed.expectedCash).toBe(-40.0);
    });

    it('verifies shift closing surplus (overage / positive variance)', async () => {
      const shift = await dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId,
        openingCash: 500.0,
      });

      // Expected is 500, physical count is 575 (+75 EGP difference)
      const closed = await dal.closeCashierShift({
        shiftId: shift.id,
        actualCash: 575.0,
        notes: 'زيادة 75 ج.م',
      });

      expect(closed.cashDifference).toBe(75.0);
      expect(closed.actualCash).toBe(575.0);
      expect(closed.actualCash! - closed.expectedCash).toBe(75.0);
    });
  });

  /* ========================================================================
   * 4. PARTIAL PAYMENT CASCADE TESTING
   * ======================================================================== */
  describe('Mission 4: Partial Payment Cascade on Student Invoice', () => {
    let dal: MockDataProvider;
    const tenantId = 'tenant-test-cascade';
    const branchId = 'branch-test-nasr';
    const cashierUserId = 'user-cashier-cascade';

    beforeEach(() => {
      dal = new MockDataProvider();
    });

    it('tests student invoice payment cascade: paying 150 on 500 invoice -> paidAmount: 150, remaining: 350, balanceDue: decremented by 150, drawer: incremented by 150', async () => {
      // 1. Create a student with initial balance 0
      const student = await dal.createStudent(tenantId, {
        fullName: 'طارق مصطفى فهمي',
        stage: 'secondary',
        grade: '3_sec',
        phone: '01055566677',
      });

      expect(student.balanceDue).toBe(0.0);

      // 2. Issue a 500 EGP invoice (no discount)
      const invoice = await dal.createInvoice({
        tenantId,
        studentId: student.id,
        totalAmount: 500.0,
        billingMonth: 10,
        billingYear: 2026,
        dueDate: '2026-10-30',
      });

      expect(invoice.totalAmount).toBe(500.0);
      expect(invoice.netAmount).toBe(500.0);
      expect(invoice.paidAmount).toBe(0.0);
      expect(invoice.status).toBe('pending');

      // Student balanceDue is now 500.0
      expect(student.balanceDue).toBe(500.0);

      // 3. Open Cashier Shift with 200 EGP float
      const shift = await dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId,
        openingCash: 200.0,
      });

      expect(shift.openingCash).toBe(200.0);
      expect(shift.expectedCash).toBe(200.0);

      // 4. Pay partial amount: 150 EGP in Cash
      const paymentRes = await dal.recordPayment({
        tenantId,
        invoiceId: invoice.id,
        amountPaid: 150.0,
        paymentMethod: 'cash',
        cashierUserId,
        shiftId: shift.id,
      });

      // Verification A: Invoice paidAmount becomes 150
      expect(paymentRes.updatedInvoice.paidAmount).toBe(150.0);

      // Verification B: Invoice remaining balance becomes 350
      const remainingBalance = Math.round((invoice.netAmount - invoice.paidAmount) * 100) / 100;
      expect(remainingBalance).toBe(350.0);

      // Verification C: Invoice status becomes 'partially_paid'
      expect(paymentRes.updatedInvoice.status).toBe('partially_paid');

      // Verification D: Student balanceDue decrements by 150 (from 500 to 350)
      expect(student.balanceDue).toBe(350.0);

      // Verification E: Cashier shift drawer increments by 150 (from 200 to 350)
      expect(shift.cashCollected).toBe(150.0);
      expect(shift.expectedCash).toBe(350.0);

      // 5. Subsequent payment: Pay remaining 350 EGP via Vodafone Cash (digital)
      const finalPayment = await dal.recordPayment({
        tenantId,
        invoiceId: invoice.id,
        amountPaid: 350.0,
        paymentMethod: 'vodafone_cash',
        cashierUserId,
        shiftId: shift.id,
      });

      // Verification F: Invoice is now fully paid
      expect(finalPayment.updatedInvoice.paidAmount).toBe(500.0);
      expect(finalPayment.updatedInvoice.status).toBe('paid');

      // Verification G: Student balanceDue is now exactly 0.00 EGP
      expect(student.balanceDue).toBe(0.0);

      // Verification H: Digital collection tracks 350, physical cash drawer remains 350
      expect(shift.digitalCollected).toBe(350.0);
      expect(shift.expectedCash).toBe(350.0);
    });

    it('rejects overpayment exceeding remaining invoice balance', async () => {
      const student = await dal.createStudent(tenantId, {
        fullName: 'سامي كمال',
        stage: 'preparatory',
        grade: '2_prep',
        phone: '01011199988',
      });

      const invoice = await dal.createInvoice({
        tenantId,
        studentId: student.id,
        totalAmount: 200.0,
        billingMonth: 10,
        billingYear: 2026,
        dueDate: '2026-10-30',
      });

      await expect(
        dal.recordPayment({
          tenantId,
          invoiceId: invoice.id,
          amountPaid: 250.0, // Exceeds 200.0!
          paymentMethod: 'cash',
          cashierUserId,
        })
      ).rejects.toThrow(/أكبر من الرصيد المتبقي/);
    });

    it('rejects zero or negative payment amounts', async () => {
      const student = await dal.createStudent(tenantId, {
        fullName: 'نور الدين',
        stage: 'primary',
        grade: '5_prim',
        phone: '01022233344',
      });

      const invoice = await dal.createInvoice({
        tenantId,
        studentId: student.id,
        totalAmount: 100.0,
        billingMonth: 10,
        billingYear: 2026,
        dueDate: '2026-10-30',
      });

      await expect(
        dal.recordPayment({
          tenantId,
          invoiceId: invoice.id,
          amountPaid: 0,
          paymentMethod: 'cash',
          cashierUserId,
        })
      ).rejects.toThrow(/يجب أن يكون أكبر من الصفر/);

      await expect(
        dal.recordPayment({
          tenantId,
          invoiceId: invoice.id,
          amountPaid: -50,
          paymentMethod: 'cash',
          cashierUserId,
        })
      ).rejects.toThrow(/يجب أن يكون أكبر من الصفر/);
    });
  });

  /* ========================================================================
   * 5. UTF-8 BOM CSV EXPORT & ARABIC HEADERS
   * ======================================================================== */
  describe('Mission 5: UTF-8 BOM CSV Export & Arabic Headers', () => {
    const records: TeacherPayrollExportRecord[] = [
      {
        teacherName: 'أ. حسام خليل (مدرس الكيمياء)',
        month: 10,
        year: 2026,
        conductedSessions: 8,
        totalAttendance: 160,
        averageAttendance: 20.0,
        calculatedCompensation: 3200.0,
        bonuses: 300.0,
        deductions: 150.0,
        netPayroll: 3350.0,
        status: 'معتمد ومصروف',
      },
    ];

    it('verifies CSV begins with UTF-8 BOM \\uFEFF (0xFEFF)', () => {
      const csv = generatePayrollCSV(records);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.startsWith('\uFEFF')).toBe(true);
    });

    it('verifies exact Arabic header columns and RFC-4180 CRLF newline structure', () => {
      const csv = generatePayrollCSV(records);
      const lines = csv.slice(1).split('\r\n'); // strip BOM and split by CRLF

      const expectedHeaders = [
        'اسم المعلم',
        'الشهر',
        'السنة',
        'الحصص المنفذة',
        'إجمالي الحضور',
        'متوسط الحضور',
        'المستحق المحسوب (ج.م)',
        'المكافآت (ج.م)',
        'الخصومات والسلف (ج.م)',
        'صافي المستحق (ج.م)',
        'حالة الاعتماد',
      ].join(',');

      expect(lines[0]).toBe(expectedHeaders);

      // Verify row formatting
      const dataRow = lines[1];
      expect(dataRow).toContain('"أ. حسام خليل (مدرس الكيمياء)"');
      expect(dataRow).toContain('10,2026,8,160,20.00,3200.00,300.00,150.00,3350.00,"معتمد ومصروف"');
    });

    it('handles empty records array gracefully returning BOM and header line', () => {
      const csv = generatePayrollCSV([]);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      const lines = csv.slice(1).split('\r\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('اسم المعلم');
    });

    it('escapes embedded quotes in teacher names properly with double double-quotes', () => {
      const customRecords: TeacherPayrollExportRecord[] = [
        {
          teacherName: 'أ. أحمد "البرنس" علي',
          month: 10,
          year: 2026,
          conductedSessions: 4,
          totalAttendance: 80,
          averageAttendance: 20.0,
          calculatedCompensation: 1600.0,
          bonuses: 0.0,
          deductions: 0.0,
          netPayroll: 1600.0,
          status: 'قيد المراجعة',
        },
      ];

      const csv = generatePayrollCSV(customRecords);
      expect(csv).toContain('"أ. أحمد ""البرنس"" علي"');
    });
  });
});
