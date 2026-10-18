import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Cashier Shifts & Cash Drawer Reconciliation (FEAT-21)', () => {
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';
  const branchId = 'branch-nasr-city';
  const cashierUserId = 'user-cashier-test-01';

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  it('opens a new cashier shift with initial opening float', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 500.0,
      notes: 'عهدة الصباح',
    });

    expect(shift).toBeDefined();
    expect(shift.status).toBe('open');
    expect(shift.openingCash).toBe(500.0);
    expect(shift.cashCollected).toBe(0.0);
    expect(shift.digitalCollected).toBe(0.0);
    expect(shift.expectedCash).toBe(500.0);
    expect(shift.cashierUserId).toBe(cashierUserId);
  });

  it('prevents opening multiple concurrent shifts for the same cashier user', async () => {
    await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 300.0,
    });

    await expect(
      dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId,
        openingCash: 200.0,
      })
    ).rejects.toThrow(/يوجد وردية كاشير مفتوحة بالفعل/);
  });

  it('correctly tracks cash collections in physical drawer while digital collections stay outside physical drawer', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 500.0,
    });

    // Create 2 test invoices
    const inv1 = await dal.createInvoice({
      tenantId,
      studentId: 'user-student-1001',
      totalAmount: 300.0,
      billingMonth: 10,
      billingYear: 2026,
      dueDate: '2026-10-25',
    });

    const inv2 = await dal.createInvoice({
      tenantId,
      studentId: 'user-student-1002',
      totalAmount: 200.0,
      billingMonth: 10,
      billingYear: 2026,
      dueDate: '2026-10-25',
    });

    // 1. Record Cash Payment of 150 EGP
    await dal.recordPayment({
      tenantId,
      invoiceId: inv1.id,
      amountPaid: 150.0,
      paymentMethod: 'cash',
      cashierUserId,
      shiftId: shift.id,
    });

    expect(shift.cashCollected).toBe(150.0);
    // expectedCash = opening (500) + cashCollected (150) = 650
    expect(shift.expectedCash).toBe(650.0);

    // 2. Record Digital Payment (InstaPay) of 200 EGP
    await dal.recordPayment({
      tenantId,
      invoiceId: inv2.id,
      amountPaid: 200.0,
      paymentMethod: 'instapay',
      cashierUserId,
      shiftId: shift.id,
    });

    expect(shift.digitalCollected).toBe(200.0);
    // Physical drawer expected cash MUST remain 650 (digital does NOT increase physical drawer float)
    expect(shift.expectedCash).toBe(650.0);
  });

  it('deducts operating expenses paid from drawer cash float', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 1000.0,
    });

    await dal.recordExpense({
      tenantId,
      branchId,
      category: 'أدوات مكتبية',
      description: 'شراء ورق A4',
      amount: 150.0,
      createdByUserId: cashierUserId,
      shiftId: shift.id,
    });

    expect(shift.cashDisbursed).toBe(150.0);
    expect(shift.expectedCash).toBe(850.0); // 1000 - 150 = 850
  });

  it('closes cashier shift with exact match (balanced drawer: variance = 0.00)', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 500.0,
    });

    const closedShift = await dal.closeCashierShift({
      shiftId: shift.id,
      actualCash: 500.0,
      notes: 'جرد تام ومطابق',
    });

    expect(closedShift.status).toBe('closed');
    expect(closedShift.actualCash).toBe(500.0);
    expect(closedShift.expectedCash).toBe(500.0);
    expect(closedShift.cashDifference).toBe(0.0);
    expect(closedShift.closedAt).toBeDefined();
  });

  it('detects drawer shortage (deficit / negative variance) and records audit note', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 500.0,
    });

    // Expected is 500, but physical count is 450 (deficit of 50 EGP)
    const closedShift = await dal.closeCashierShift({
      shiftId: shift.id,
      actualCash: 450.0,
      notes: 'عجز 50 ج.م جاري مراجعته',
    });

    expect(closedShift.cashDifference).toBe(-50.0);
    expect(closedShift.notes).toContain('عجز 50 ج.م');
  });

  it('detects drawer surplus (overage / positive variance)', async () => {
    const shift = await dal.openCashierShift({
      tenantId,
      branchId,
      cashierUserId,
      openingCash: 500.0,
    });

    // Expected is 500, physical count is 530 (surplus of 30 EGP)
    const closedShift = await dal.closeCashierShift({
      shiftId: shift.id,
      actualCash: 530.0,
      notes: 'زيادة 30 ج.م مجهولة المصدر',
    });

    expect(closedShift.cashDifference).toBe(30.0);
  });
});
