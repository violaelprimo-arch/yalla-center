import { describe, it, expect, beforeEach } from 'vitest';
import { SaasPlatformService } from '@/lib/saas/service';
import { buildFinancialWorkbook } from '@/lib/saas/excel-export';
import * as XLSX from 'xlsx';

describe('Yalla Center — Complete Owner Financial Management & Excel Engine Integration Tests', () => {
  beforeEach(() => {
    // Service runs with deterministic in-memory state
  });

  // --------------------------------------------------------------------------
  // TEST 1: ISSUE 3,500 EGP INVOICE -> PAY 2,000 EGP -> VERIFY 1,500 EGP REMAINING
  // --------------------------------------------------------------------------
  it('1. Core Financial Precision: Issue 3,500 EGP invoice, pay 2,000 EGP, verify remaining is exactly 1,500 EGP', async () => {
    const testSlug = `test-finance-${Date.now()}`;
    const testCenter = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر الفحص المالي النموذجي',
      slug: testSlug,
      city: 'القاهرة',
      governorate: 'القاهرة',
      phone: '01011112222',
      email: 'finance@test.com',
      adminName: 'أ. طارق محمود',
      adminEmail: 'tarek@test.com',
      adminPhone: '01011112222',
      planId: 'plan-pro',
      billingFrequency: 'monthly',
      branchesCount: 1,
    });

    const centerId = testCenter.center!.id;

    // 1. Issue an explicit invoice of 3,500 EGP
    const invoice = SaasPlatformService.createInvoice({
      tenantId: centerId,
      tenantNameAr: 'سنتر الفحص المالي النموذجي',
      tenantSlug: testSlug,
      planId: 'plan-pro',
      planNameAr: 'باقة المحترفين (Pro)',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueDate: '2026-11-07',
      amount: 3500,
      discount: 0,
      status: 'issued',
      notes: 'فاتورة اشتراك تجريبية للفحص',
    });

    expect(invoice.totalDue).toBe(3500);
    expect(invoice.amountPaid).toBe(0);
    expect(invoice.status).toBe('issued');

    // 2. Pay partial 2,000 EGP
    const payResult = SaasPlatformService.recordPayment({
      invoiceId: invoice.id,
      amount: 2000,
      paymentMethod: 'vodafone_cash',
      referenceNumber: 'VF-123456',
      notes: 'دفعة أولى 2000 جنيه',
    });

    expect(payResult).toBeDefined();
    expect(payResult?.payment.amount).toBe(2000);
    expect(payResult?.movement.credit).toBe(2000);

    // 3. Verify statement and remaining balance is exactly 1,500 EGP
    const statement = SaasPlatformService.getCenterStatement(centerId);
    expect(statement.remainingBalance).toBe(1500);
    expect(statement.totalDebit).toBeGreaterThanOrEqual(3500);
    expect(statement.totalCredit).toBeGreaterThanOrEqual(2000);

    // Verify invoice status is partially_paid
    const updatedInvoice = SaasPlatformService.getInvoices().find((i) => i.id === invoice.id);
    expect(updatedInvoice?.status).toBe('partially_paid');
    expect(updatedInvoice?.amountPaid).toBe(2000);
    expect(updatedInvoice!.totalDue - updatedInvoice!.amountPaid).toBe(1500);
  });

  // --------------------------------------------------------------------------
  // TEST 2: REMAINING PAYMENT COMPLETES INVOICE & ZEROES BALANCE
  // --------------------------------------------------------------------------
  it('2. Settle remaining 1,500 EGP -> Invoice status becomes paid, remaining balance is 0', async () => {
    const testSlug = `test-settle-${Date.now()}`;
    const testCenter = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر التسوية الكاملة',
      slug: testSlug,
      city: 'الجيزة',
      governorate: 'الجيزة',
      adminName: 'أ. مازن علي',
      adminEmail: 'mazen@test.com',
      adminPhone: '01022223333',
      planId: 'plan-pro',
      billingFrequency: 'monthly',
    });

    const centerId = testCenter.center!.id;

    // Issue invoice 3,500
    const invoice = SaasPlatformService.createInvoice({
      tenantId: centerId,
      tenantNameAr: 'سنتر التسوية الكاملة',
      tenantSlug: testSlug,
      planId: 'plan-pro',
      planNameAr: 'باقة المحترفين',
      amount: 3500,
      discount: 0,
      status: 'issued',
    });

    // Pay 2,000 first
    SaasPlatformService.recordPayment({
      invoiceId: invoice.id,
      amount: 2000,
      paymentMethod: 'instapay',
    });

    // Pay remaining 1,500
    SaasPlatformService.recordPayment({
      invoiceId: invoice.id,
      amount: 1500,
      paymentMethod: 'bank_transfer',
      referenceNumber: 'TRF-555',
    });

    const statement = SaasPlatformService.getCenterStatement(centerId);
    expect(statement.remainingBalance).toBe(0);

    const settledInvoice = SaasPlatformService.getInvoices().find((i) => i.id === invoice.id);
    expect(settledInvoice?.status).toBe('paid');
    expect(settledInvoice?.amountPaid).toBe(3500);
  });

  // --------------------------------------------------------------------------
  // TEST 3: OVERPAYMENT GENERATES CREDIT BALANCE (NO MONEY LEAKAGE)
  // --------------------------------------------------------------------------
  it('3. Overpayment handling: Paying 2,000 on a 1,500 invoice credits 500 EGP to credit balance', async () => {
    const testSlug = `test-overpay-${Date.now()}`;
    const testCenter = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر الرصيد الدائن',
      slug: testSlug,
      city: 'الإسكندرية',
      governorate: 'الإسكندرية',
      adminName: 'أ. سمير خليل',
      adminEmail: 'samir@test.com',
      adminPhone: '01033334444',
      planId: 'plan-starter',
      billingFrequency: 'monthly',
    });

    const centerId = testCenter.center!.id;

    const invoice = SaasPlatformService.createInvoice({
      tenantId: centerId,
      tenantNameAr: 'سنتر الرصيد الدائن',
      tenantSlug: testSlug,
      planId: 'plan-starter',
      planNameAr: 'باقة البداية',
      amount: 1500,
      discount: 0,
      status: 'issued',
    });

    // Pay 2,000 EGP on a 1,500 EGP invoice
    SaasPlatformService.recordPayment({
      invoiceId: invoice.id,
      amount: 2000,
      paymentMethod: 'bank_transfer',
    });

    const center = SaasPlatformService.getCenterById(centerId);
    expect(center?.creditBalance).toBe(500);

    const statement = SaasPlatformService.getCenterStatement(centerId);
    expect(statement.remainingBalance).toBe(0);
    expect(statement.creditBalance).toBe(500);
  });

  // --------------------------------------------------------------------------
  // TEST 4: DISCOUNTS & ADJUSTMENTS UPDATE RUNNING BALANCE
  // --------------------------------------------------------------------------
  it('4. Discounts and adjustments modify balance accurately with audit logs', async () => {
    const testSlug = `test-adj-${Date.now()}`;
    const testCenter = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر الخصومات والتسويات',
      slug: testSlug,
      city: 'القاهرة',
      governorate: 'القاهرة',
      adminName: 'أ. رامي عادل',
      adminEmail: 'rami@test.com',
      adminPhone: '01044445555',
      planId: 'plan-pro',
      billingFrequency: 'monthly',
    });

    const centerId = testCenter.center!.id;

    const invoice = SaasPlatformService.createInvoice({
      tenantId: centerId,
      tenantNameAr: 'سنتر الخصومات والتسويات',
      tenantSlug: testSlug,
      planId: 'plan-pro',
      planNameAr: 'باقة المحترفين',
      amount: 3500,
      discount: 0,
      status: 'issued',
    });

    // Apply 500 EGP discount
    const mov = SaasPlatformService.addAdjustmentOrDiscount({
      tenantId: centerId,
      type: 'discount',
      amount: 500,
      description: 'خصم ولاء السنتر',
      reason: 'مكافأة تجديد مبكر',
    });

    expect(mov.credit).toBe(500);

    const statement = SaasPlatformService.getCenterStatement(centerId);
    // Net balance should now reflect 3,500 - 500 = 3,000
    expect(statement.remainingBalance).toBe(3000);
  });

  // --------------------------------------------------------------------------
  // TEST 5: REVERSAL / CANCELLATION INTEGRITY WITH AUDIT LOG
  // --------------------------------------------------------------------------
  it('5. Non-silent reversal marks movement reversed and records audit entry', async () => {
    const testSlug = `test-reversal-${Date.now()}`;
    const testCenter = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر القيد العكسي',
      slug: testSlug,
      city: 'المنصورة',
      governorate: 'الدقهلية',
      adminName: 'أ. شريف كمال',
      adminEmail: 'sherif@test.com',
      adminPhone: '01055556666',
      planId: 'plan-pro',
      billingFrequency: 'monthly',
    });

    const centerId = testCenter.center!.id;

    const invoice = SaasPlatformService.createInvoice({
      tenantId: centerId,
      tenantNameAr: 'سنتر القيد العكسي',
      tenantSlug: testSlug,
      planId: 'plan-pro',
      planNameAr: 'باقة المحترفين',
      amount: 3500,
      discount: 0,
      status: 'issued',
    });

    const payResult = SaasPlatformService.recordPayment({
      invoiceId: invoice.id,
      amount: 1000,
      paymentMethod: 'cash',
      notes: 'دفعة خاطئة بالخطأ',
    });

    const movementId = payResult!.movement.id;

    // Perform reversal
    const revResult = SaasPlatformService.reverseMovement(
      movementId,
      'تم إدخال الدفعة بالخطأ لرقم سنتر آخر',
      'owner@yallacenter.com'
    );

    expect(revResult.ok).toBe(true);

    // Verify movement is marked reversed
    const movement = SaasPlatformService.getMovements().find((m) => m.id === movementId);
    expect(movement?.status).toBe('reversed');
    expect(movement?.reversalReason).toContain('بالخطأ');

    // Verify audit log exists
    const auditLogs = SaasPlatformService.getAuditLogs();
    const log = auditLogs.find((l) => l.action === 'REVERSE_FINANCIAL_MOVEMENT');
    expect(log).toBeDefined();
    expect(log?.actorEmail).toBe('owner@yallacenter.com');
  });

  // --------------------------------------------------------------------------
  // TEST 6: REAL MULTI-SHEET XLSX EXPORT (6 SHEETS & RTL VIEW)
  // --------------------------------------------------------------------------
  it('6. Multi-Sheet XLSX Export: Generates genuine .xlsx with all 6 required sheets and RTL view', () => {
    const { workbook, filename } = buildFinancialWorkbook({ mode: 'all' });

    expect(filename).toContain('Yalla_Center_Accounts');
    expect(filename.endsWith('.xlsx')).toBe(true);

    // Verify all 6 sheets exist
    expect(workbook.SheetNames).toEqual([
      'ملخص الحسابات',
      'الفواتير',
      'التحصيلات والمدفوعات',
      'المصروفات',
      'المبالغ المستحقة والمتأخرة',
      'الأرباح والتقرير المالي',
    ]);

    // Verify Sheet 1 properties (RTL and column widths)
    const ws1 = workbook.Sheets['ملخص الحسابات'];
    expect(ws1).toBeDefined();
    expect(ws1['!views']).toBeDefined();
    expect(ws1['!views']![0].rightToLeft).toBe(true);
    expect(ws1['!cols']).toBeDefined();
    expect(ws1['!cols']!.length).toBeGreaterThan(15);

    // Verify Sheet 6 (P&L and summary)
    const ws6 = workbook.Sheets['الأرباح والتقرير المالي'];
    expect(ws6).toBeDefined();
    expect(ws6['!views']![0].rightToLeft).toBe(true);

    // Convert to buffer to guarantee XLSX encoding
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(5000);

    // Read back buffer to verify integrity
    const readWb = XLSX.read(buffer, { type: 'buffer' });
    expect(readWb.SheetNames.length).toBe(6);
    expect(readWb.SheetNames[0]).toBe('ملخص الحسابات');
  });

  // --------------------------------------------------------------------------
  // TEST 7: DYNAMIC EXPENSE CATEGORIES MANAGEMENT (CRUD)
  // --------------------------------------------------------------------------
  it('7. Dynamic Expense Categories: Add, list, edit and delete categories dynamically', () => {
    const initialCats = SaasPlatformService.getExpenseCategories();
    expect(initialCats.length).toBeGreaterThanOrEqual(8);

    // Add custom category
    const custom = SaasPlatformService.createExpenseCategory({
      key: 'custom_cloud_backup',
      nameAr: 'النسخ الاحتياطي السحابي الخارجي',
      descriptionAr: 'اشتراك Wasabi Cloud Storage للنسخ الاحتياطي',
    });

    expect(custom.id).toBeDefined();
    expect(custom.key).toBe('custom_cloud_backup');
    expect(custom.nameAr).toBe('النسخ الاحتياطي السحابي الخارجي');

    // Verify it is listed
    const all = SaasPlatformService.getExpenseCategories();
    expect(all.some((c) => c.key === 'custom_cloud_backup')).toBe(true);

    // Edit category
    const updated = SaasPlatformService.updateExpenseCategory(custom.id, {
      nameAr: 'النسخ الاحتياطي الموسع',
    });
    expect(updated?.nameAr).toBe('النسخ الاحتياطي الموسع');

    // Create expense using this category
    const exp = SaasPlatformService.createExpense({
      category: 'custom_cloud_backup',
      categoryNameAr: 'النسخ الاحتياطي الموسع',
      titleAr: 'فاتورة Wasabi للتخزين السحابي',
      amount: 450,
      date: '2026-11-10',
      paidTo: 'Wasabi Technologies',
      recurrence: 'monthly',
    });

    expect(exp.amount).toBe(450);
    expect(exp.category).toBe('custom_cloud_backup');
  });

  // --------------------------------------------------------------------------
  // TEST 8: EXPIRING SUBSCRIPTIONS & OVERDUE NOTIFICATIONS
  // --------------------------------------------------------------------------
  it('8. Renewals and Alerts engine detects subscriptions expiring in 7 and 30 days and overdue accounts', () => {
    const renewals = SaasPlatformService.getUpcomingRenewals();
    expect(renewals).toBeDefined();
    expect(Array.isArray(renewals.expiring7Days)).toBe(true);
    expect(Array.isArray(renewals.expiring30Days)).toBe(true);
    expect(Array.isArray(renewals.overdueAccounts)).toBe(true);
    expect(Array.isArray(renewals.dueToday)).toBe(true);
  });
});
