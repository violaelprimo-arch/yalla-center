import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Student Invoicing & Payment Collection Integration Flow (FEAT-15 & FEAT-22)', () => {
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';
  const cashierUserId = 'user-recep-001';

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  it('completes full cycle: register student -> enroll in group with discount -> issue invoice -> partial payment -> balance reduction', async () => {
    // 1. Create a brand new student
    const student = await dal.createStudent(tenantId, {
      fullName: 'أحمد محمود السعيد',
      stage: 'secondary',
      grade: '3_sec',
      division: 'scientific_math',
      phone: '01011122233',
      guardianName: 'محمود السعيد',
      guardianPhone: '01099988877',
    });

    expect(student.id).toBeDefined();
    expect(student.studentCode).toMatch(/^STD-\d{4}$/);
    expect(student.balanceDue).toBe(0.0);

    // 2. Enroll student into Physics group (Monthly fee: 400 EGP) with 20% discount
    // Group monthlyFee: grp-phys-sun = 400.0 EGP
    // 20% discount on 400 EGP = 80 EGP discount, Net Invoice = 320 EGP
    const enrollmentResult = await dal.enrollStudent({
      tenantId,
      studentId: student.id,
      groupId: 'grp-phys-sun',
      pricingModel: 'private',
      discountType: 'percentage',
      discountValue: 20,
    });

    expect(enrollmentResult.success).toBe(true);
    expect(enrollmentResult.enrollment).toBeDefined();
    expect(enrollmentResult.invoice).toBeDefined();

    const invoice = enrollmentResult.invoice!;
    expect(invoice.totalAmount).toBe(400.0);
    expect(invoice.discountAmount).toBe(80.0);
    expect(invoice.netAmount).toBe(320.0);
    expect(invoice.paidAmount).toBe(0.0);
    expect(invoice.status).toBe('pending');

    // Verify student balanceDue was atomically updated to 320.0 EGP
    expect(student.balanceDue).toBe(320.0);

    // 3. Open Cashier Shift to receive payments
    const shift = await dal.openCashierShift({
      tenantId,
      branchId: 'branch-nasr-city',
      cashierUserId: 'user-flow-cashier',
      openingCash: 500.0,
      notes: 'وردية اختبار الدورة المالية',
    });

    // 4. Record Partial Payment: Student pays 200.0 EGP in Cash
    const paymentResult = await dal.recordPayment({
      tenantId,
      invoiceId: invoice.id,
      amountPaid: 200.0,
      paymentMethod: 'cash',
      cashierUserId: 'user-flow-cashier',
      shiftId: shift.id,
      notes: 'سداد دفعة أولى من المصروفات',
    });

    // Verify Payment Receipt
    expect(paymentResult.payment).toBeDefined();
    expect(paymentResult.payment.receiptNumber).toMatch(/^REC-\d{4}-\d{4}$/);
    expect(paymentResult.payment.amountPaid).toBe(200.0);
    expect(paymentResult.payment.studentId).toBe(student.id);

    // Verify Invoice state transitioned to 'partially_paid'
    expect(paymentResult.updatedInvoice.paidAmount).toBe(200.0);
    expect(paymentResult.updatedInvoice.status).toBe('partially_paid');

    // Verify Student balanceDue is reduced from 320.0 to 120.0 EGP
    expect(student.balanceDue).toBe(120.0);

    // Verify Cashier physical drawer expectedCash updated: 500 opening + 200 cash = 700 EGP
    expect(shift.cashCollected).toBe(200.0);
    expect(shift.expectedCash).toBe(700.0);

    // 5. Record Remaining Payment: Student pays final 120.0 EGP via Vodafone Cash (digital)
    const finalPayment = await dal.recordPayment({
      tenantId,
      invoiceId: invoice.id,
      amountPaid: 120.0,
      paymentMethod: 'vodafone_cash',
      cashierUserId: 'user-flow-cashier',
      shiftId: shift.id,
      notes: 'سداد باقي الرسوم فودافون كاش',
    });

    // Verify Invoice is fully paid
    expect(finalPayment.updatedInvoice.paidAmount).toBe(320.0);
    expect(finalPayment.updatedInvoice.status).toBe('paid');

    // Verify Student balanceDue is now exactly 0.00 EGP
    expect(student.balanceDue).toBe(0.0);

    // Verify Digital collection increased without altering physical cash in drawer
    expect(shift.digitalCollected).toBe(120.0);
    expect(shift.cashCollected).toBe(200.0);
    expect(shift.expectedCash).toBe(700.0);

    // 6. Verify enrollment details join
    const details = await dal.getStudentEnrollmentDetails(tenantId, student.id);
    expect(details.length).toBe(1);
    expect(details[0].group.nameAr).toContain('فيزياء');
    expect(details[0].teacher?.fullName).toContain('نبيل');

    // 7. Verify payments query for this student
    const studentPayments = await dal.getPayments(tenantId, { studentId: student.id });
    expect(studentPayments.length).toBe(2);
    expect(studentPayments[0].amountPaid + studentPayments[1].amountPaid).toBe(320.0);
  });
});
