/**
 * Yalla Center - Multi-Sheet Real XLSX Exporter
 * Path: lib/saas/excel-export.ts
 *
 * Generates official, multi-sheet XLSX workbooks (NOT renamed CSVs)
 * conforming to Yalla Center financial specifications:
 * - Sheet 1: ملخص الحسابات (Center summaries & accounts sheet)
 * - Sheet 2: الفواتير (Subscription invoices)
 * - Sheet 3: التحصيلات والمدفوعات (Payment receipts & collections)
 * - Sheet 4: المصروفات (Platform operating & infrastructure expenses)
 * - Sheet 5: المبالغ المستحقة والمتأخرة (Overdue receivables & aging)
 * - Sheet 6: الأرباح والتقرير المالي (P&L statement & net SaaS cash flow)
 *
 * Features:
 * - Right-to-Left (RTL) Arabic worksheet views
 * - Auto-sized column widths
 * - AutoFilter headers
 * - Numeric types for calculations
 * - Totals rows with formula / sum
 */

import * as XLSX from 'xlsx';
import { SaasPlatformService } from './service';
import {
  CenterAccountSummaryRow,
  OwnerInvoice,
  OwnerPayment,
  OwnerExpense,
  CenterFinancialMovement,
} from './types';

export interface ExcelExportOptions {
  mode?: 'all' | 'filtered' | 'single' | 'overdue_only' | 'date_range';
  centerId?: string;
  startDate?: string;
  endDate?: string;
  filteredRows?: CenterAccountSummaryRow[];
  filenamePrefix?: string;
}

export function buildFinancialWorkbook(options: ExcelExportOptions = {}): {
  workbook: XLSX.WorkBook;
  filename: string;
} {
  const {
    mode = 'all',
    centerId,
    startDate,
    endDate,
    filteredRows,
    filenamePrefix = 'Yalla_Center_Accounts',
  } = options;

  const todayIso = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  // 1. Determine which Center Rows to export
  let sheetRows: CenterAccountSummaryRow[] = [];
  if (filteredRows && mode === 'filtered') {
    sheetRows = filteredRows;
  } else {
    sheetRows = SaasPlatformService.getCenterAccountsSheet();
  }

  if (mode === 'single' && centerId) {
    sheetRows = sheetRows.filter(
      (r) => r.tenantId === centerId || r.slug === centerId
    );
  } else if (mode === 'overdue_only') {
    sheetRows = sheetRows.filter(
      (r) => r.remainingBalance > 0 && (r.paymentStatus === 'overdue' || r.nextDueDate < todayIso)
    );
  }

  // 2. Determine which Invoices to export
  let invoices: OwnerInvoice[] = SaasPlatformService.getInvoices();
  if (mode === 'single' && centerId) {
    invoices = invoices.filter((i) => i.tenantId === centerId || i.tenantSlug === centerId);
  }
  if (startDate) {
    invoices = invoices.filter((i) => i.periodStart >= startDate);
  }
  if (endDate) {
    invoices = invoices.filter((i) => i.periodEnd <= endDate);
  }

  // 3. Determine which Payments to export
  let payments: OwnerPayment[] = SaasPlatformService.getPayments();
  if (mode === 'single' && centerId) {
    payments = payments.filter((p) => p.tenantId === centerId);
  }
  if (startDate) {
    payments = payments.filter((p) => p.receivedAt.slice(0, 10) >= startDate);
  }
  if (endDate) {
    payments = payments.filter((p) => p.receivedAt.slice(0, 10) <= endDate);
  }

  // 4. Determine Expenses
  let expenses: OwnerExpense[] = SaasPlatformService.getExpenses();
  if (startDate) {
    expenses = expenses.filter((e) => e.date >= startDate);
  }
  if (endDate) {
    expenses = expenses.filter((e) => e.date <= endDate);
  }

  // Helper to format RTL & column widths on a sheet
  const applySheetFormatting = (
    ws: XLSX.WorkSheet,
    colWidths: number[],
    autoFilterRange?: string
  ) => {
    ws['!views'] = [{ rightToLeft: true }];
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
    if (autoFilterRange) {
      ws['!autofilter'] = { ref: autoFilterRange };
    }
  };

  // ==========================================================================
  // SHEET 1: ملخص الحسابات (Center Accounts Summary)
  // ==========================================================================
  const s1Headers = [
    'م',
    'كود السنتر',
    'اسم السنتر',
    'المسؤول',
    'هاتف المسؤول',
    'الباقة',
    'نوع الاشتراك',
    'بداية الاشتراك',
    'نهاية الاشتراك',
    'إجمالي الفواتير (ج.م)',
    'إجمالي الخصومات (ج.م)',
    'صافي المستحق (ج.م)',
    'إجمالي المدفوع (ج.م)',
    'المتبقي (ج.م)',
    'الرصيد الدائن (ج.م)',
    'آخر دفعة',
    'موعد الاستحقاق',
    'حالة الدفع',
    'حالة الاشتراك',
  ];

  let sumInvoiced = 0;
  let sumDiscounts = 0;
  let sumNetDue = 0;
  let sumPaid = 0;
  let sumRemaining = 0;
  let sumCredit = 0;

  const s1Data = sheetRows.map((r, idx) => {
    sumInvoiced += r.totalInvoiced;
    sumDiscounts += r.totalDiscounts;
    sumNetDue += r.netDue;
    sumPaid += r.totalPaid;
    sumRemaining += r.remainingBalance;
    sumCredit += r.creditBalance;

    const paymentLabel =
      r.paymentStatus === 'paid'
        ? 'مدفوع بالكامل'
        : r.paymentStatus === 'partial'
        ? 'سداد جزئي'
        : r.paymentStatus === 'overdue'
        ? 'متأخر'
        : 'غير مدفوع';

    const statusLabel =
      r.subscriptionStatus === 'active'
        ? 'نشط'
        : r.subscriptionStatus === 'trial'
        ? 'تجريبي'
        : r.subscriptionStatus === 'suspended'
        ? 'موقوف'
        : 'منتهي';

    return [
      idx + 1,
      r.slug,
      r.centerNameAr,
      r.adminName,
      r.adminPhone,
      r.planNameAr,
      r.billingFrequency === 'annual' ? 'سنوي' : 'شهري',
      r.subscriptionStartDate,
      r.subscriptionEndDate,
      r.totalInvoiced,
      r.totalDiscounts,
      r.netDue,
      r.totalPaid,
      r.remainingBalance,
      r.creditBalance,
      r.lastPaymentDate || '—',
      r.nextDueDate,
      paymentLabel,
      statusLabel,
    ];
  });

  // Footer Totals Row
  const s1Totals = [
    'الإجمالي',
    '—',
    `عدد السناتر: ${sheetRows.length}`,
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    Math.round(sumInvoiced * 100) / 100,
    Math.round(sumDiscounts * 100) / 100,
    Math.round(sumNetDue * 100) / 100,
    Math.round(sumPaid * 100) / 100,
    Math.round(sumRemaining * 100) / 100,
    Math.round(sumCredit * 100) / 100,
    '—',
    '—',
    '—',
    '—',
  ];

  const ws1 = XLSX.utils.aoa_to_sheet([s1Headers, ...s1Data, s1Totals]);
  applySheetFormatting(
    ws1,
    [5, 14, 25, 18, 14, 18, 12, 13, 13, 16, 16, 16, 16, 16, 16, 13, 13, 14, 12],
    `A1:S${s1Data.length + 1}`
  );
  XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الحسابات');

  // ==========================================================================
  // SHEET 2: الفواتير (Invoices)
  // ==========================================================================
  const s2Headers = [
    'م',
    'رقم الفاتورة',
    'اسم السنتر',
    'الباقة',
    'بداية الفترة',
    'نهاية الفترة',
    'قيمة الفاتورة (ج.م)',
    'الخصم (ج.م)',
    'صافي المستحق (ج.م)',
    'المسدد (ج.م)',
    'المتبقي (ج.م)',
    'تاريخ الإصدار',
    'تاريخ الاستحقاق',
    'تاريخ السداد',
    'حالة الفاتورة',
    'البيان والملاحظات',
  ];

  let sumInvAmount = 0;
  let sumInvDiscount = 0;
  let sumInvDue = 0;
  let sumInvPaid = 0;
  let sumInvRemain = 0;

  const s2Data = invoices.map((inv, idx) => {
    const remain = Math.max(0, inv.totalDue - inv.amountPaid);
    sumInvAmount += inv.amount;
    sumInvDiscount += inv.discount || 0;
    sumInvDue += inv.totalDue;
    sumInvPaid += inv.amountPaid;
    sumInvRemain += remain;

    const invStatusLabel =
      inv.status === 'paid'
        ? 'مدفوعة بالكامل'
        : inv.status === 'partially_paid'
        ? 'سداد جزئي'
        : inv.status === 'overdue'
        ? 'متأخرة'
        : inv.status === 'cancelled'
        ? 'ملغاة'
        : 'مستحقة';

    return [
      idx + 1,
      inv.invoiceNumber,
      inv.tenantNameAr,
      inv.planNameAr,
      inv.periodStart,
      inv.periodEnd,
      inv.amount,
      inv.discount || 0,
      inv.totalDue,
      inv.amountPaid,
      remain,
      inv.issuedAt.slice(0, 10),
      inv.dueDate,
      inv.paidAt ? inv.paidAt.slice(0, 10) : '—',
      invStatusLabel,
      inv.notes || '',
    ];
  });

  const s2Totals = [
    'الإجمالي',
    '—',
    `عدد الفواتير: ${invoices.length}`,
    '—',
    '—',
    '—',
    Math.round(sumInvAmount * 100) / 100,
    Math.round(sumInvDiscount * 100) / 100,
    Math.round(sumInvDue * 100) / 100,
    Math.round(sumInvPaid * 100) / 100,
    Math.round(sumInvRemain * 100) / 100,
    '—',
    '—',
    '—',
    '—',
    '—',
  ];

  const ws2 = XLSX.utils.aoa_to_sheet([s2Headers, ...s2Data, s2Totals]);
  applySheetFormatting(
    ws2,
    [5, 18, 25, 20, 13, 13, 16, 14, 16, 16, 16, 13, 13, 13, 15, 30],
    `A1:P${s2Data.length + 1}`
  );
  XLSX.utils.book_append_sheet(wb, ws2, 'الفواتير');

  // ==========================================================================
  // SHEET 3: التحصيلات والمدفوعات (Collections & Payments)
  // ==========================================================================
  const s3Headers = [
    'م',
    'رقم الإيصال / السند',
    'السنتر المستفيد',
    'كود الفاتورة المرتبطة',
    'المبلغ المحصل (ج.م)',
    'طريقة التحصيل',
    'رقم المرجع / الحوالة',
    'تاريخ التحصيل',
    'المحصل المسؤول',
    'ملاحظات',
  ];

  let sumPayments = 0;
  const s3Data = payments.map((pay, idx) => {
    sumPayments += pay.amount;
    const inv = invoices.find((i) => i.id === pay.invoiceId);
    const methodLabel =
      pay.paymentMethod === 'vodafone_cash'
        ? 'محفظة إلكترونية (فودافون كاش / إنستاباي)'
        : pay.paymentMethod === 'bank_transfer'
        ? 'تحويل بنكي'
        : pay.paymentMethod === 'cash'
        ? 'نقداً'
        : pay.paymentMethod === 'card'
        ? 'بطاقة دفع'
        : pay.paymentMethod;

    return [
      idx + 1,
      pay.receiptNumber,
      pay.tenantNameAr,
      inv?.invoiceNumber || pay.invoiceId,
      pay.amount,
      methodLabel,
      pay.referenceNumber || '—',
      pay.receivedAt.slice(0, 10),
      pay.recordedBy,
      pay.notes || '',
    ];
  });

  const s3Totals = [
    'الإجمالي',
    '—',
    `عدد السندات: ${payments.length}`,
    '—',
    Math.round(sumPayments * 100) / 100,
    '—',
    '—',
    '—',
    '—',
    '—',
  ];

  const ws3 = XLSX.utils.aoa_to_sheet([s3Headers, ...s3Data, s3Totals]);
  applySheetFormatting(
    ws3,
    [5, 18, 25, 20, 18, 25, 18, 14, 18, 30],
    `A1:J${s3Data.length + 1}`
  );
  XLSX.utils.book_append_sheet(wb, ws3, 'التحصيلات والمدفوعات');

  // ==========================================================================
  // SHEET 4: المصروفات (Platform Expenses)
  // ==========================================================================
  const s4Headers = [
    'م',
    'بيان المصروف',
    'التصنيف',
    'المبلغ (ج.م)',
    'التاريخ',
    'طريقة السداد',
    'الجهة المستفيدة',
    'رقم المرجع',
    'التكرار',
    'ملاحظات',
  ];

  let sumExpenses = 0;
  const s4Data = expenses.map((exp, idx) => {
    sumExpenses += exp.amount;
    return [
      idx + 1,
      exp.titleAr,
      exp.categoryNameAr || exp.category,
      exp.amount,
      exp.date,
      exp.paymentMethod || 'بطاقة بنكية',
      exp.paidTo,
      exp.referenceNumber || '—',
      exp.recurrence === 'monthly' ? 'شهري' : exp.recurrence === 'annual' ? 'سنوي' : 'مرة واحدة',
      exp.notes || '',
    ];
  });

  const s4Totals = [
    'الإجمالي',
    '—',
    `عدد المصروفات: ${expenses.length}`,
    Math.round(sumExpenses * 100) / 100,
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
  ];

  const ws4 = XLSX.utils.aoa_to_sheet([s4Headers, ...s4Data, s4Totals]);
  applySheetFormatting(
    ws4,
    [5, 30, 20, 16, 13, 16, 22, 16, 12, 30],
    `A1:J${s4Data.length + 1}`
  );
  XLSX.utils.book_append_sheet(wb, ws4, 'المصروفات');

  // ==========================================================================
  // SHEET 5: المبالغ المستحقة والمتأخرة (Overdue & Receivables)
  // ==========================================================================
  const s5Headers = [
    'م',
    'كود السنتر',
    'اسم السنتر',
    'المسؤول',
    'رقم الهاتف',
    'الباقة',
    'صافي المستحق (ج.م)',
    'المدفوع (ج.م)',
    'المتبقي المطلوب سداده (ج.م)',
    'موعد الاستحقاق',
    'حالة التأخير',
    'حالة الاشتراك',
  ];

  const overdueRows = sheetRows.filter((r) => r.remainingBalance > 0);
  let sumOverdueRemaining = 0;

  const s5Data = overdueRows.map((r, idx) => {
    sumOverdueRemaining += r.remainingBalance;
    const isOverdue = r.nextDueDate < todayIso;

    return [
      idx + 1,
      r.slug,
      r.centerNameAr,
      r.adminName,
      r.adminPhone,
      r.planNameAr,
      r.netDue,
      r.totalPaid,
      r.remainingBalance,
      r.nextDueDate,
      isOverdue ? 'متأخر عن الموعد المحدد ⚠️' : 'قيد الاستحقاق (سداد جزئي)',
      r.subscriptionStatus === 'active' ? 'نشط' : 'موقوف / تجريبي',
    ];
  });

  const s5Totals = [
    'الإجمالي',
    '—',
    `عدد السناتر المستحقة: ${overdueRows.length}`,
    '—',
    '—',
    '—',
    '—',
    '—',
    Math.round(sumOverdueRemaining * 100) / 100,
    '—',
    '—',
    '—',
  ];

  const ws5 = XLSX.utils.aoa_to_sheet([s5Headers, ...s5Data, s5Totals]);
  applySheetFormatting(
    ws5,
    [5, 14, 25, 18, 14, 18, 16, 16, 20, 14, 22, 16],
    `A1:L${s5Data.length + 1}`
  );
  XLSX.utils.book_append_sheet(wb, ws5, 'المبالغ المستحقة والمتأخرة');

  // ==========================================================================
  // SHEET 6: الأرباح والتقرير المالي (P&L and Financial Summary)
  // ==========================================================================
  const netCashFlow = sumPayments - sumExpenses;

  const s6Rows = [
    ['تقرير الأرباح والموقف المالي الشامل لمنصة يلا سنتر (Yalla Center SaaS)'],
    ['تاريخ التصدير:', todayIso],
    ['النطاق / الفلترة:', mode === 'single' ? `سنتر فردي (${centerId})` : mode === 'overdue_only' ? 'المتأخرات فقط' : 'كافة السناتر'],
    [''],
    ['البند المالي', 'القيمة بالجنيه المصري (EGP)', 'ملاحظات وتوضيحات'],
    ['إجمالي الاشتراكات المفوترة', Math.round(sumInvoiced * 100) / 100, 'إجمالي قيمة جميع الفواتير الصادرة'],
    ['إجمالي الخصومات والتسويات', Math.round(sumDiscounts * 100) / 100, 'الخصومات الممنوحة للسناتر'],
    ['صافي الإيرادات المستحقة', Math.round(sumNetDue * 100) / 100, 'صافي المطلوب فوترته (الفواتير - الخصومات)'],
    ['إجمالي التحصيلات الفعلية المودعة', Math.round(sumPayments * 100) / 100, 'النقدية المحصلة فعلياً بحسابات المنصة'],
    ['إجمالي المبالغ المتبقية على السناتر', Math.round(sumRemaining * 100) / 100, 'أرصدة مدينة لم يتم تحصيلها بعد'],
    ['إجمالي مصاريف وتشغيل المنصة', Math.round(sumExpenses * 100) / 100, 'خوادم، رسائل واتساب، ذكاء اصطناعي، وتسويق'],
    ['صافي التدفق النقدي والأرباح (Net SaaS Cash Flow)', Math.round(netCashFlow * 100) / 100, netCashFlow >= 0 ? 'فائض نقدي ربحي متاح' : 'عجز مؤقت'],
    ['إجمالي الأرصدة الدائنة للسناتر', Math.round(sumCredit * 100) / 100, 'أرصدة مسددة بالزيادة أو دفعات مقدمة'],
  ];

  const ws6 = XLSX.utils.aoa_to_sheet(s6Rows);
  applySheetFormatting(ws6, [35, 25, 45]);
  XLSX.utils.book_append_sheet(wb, ws6, 'الأرباح والتقرير المالي');

  const filename = `${filenamePrefix}_${todayIso}.xlsx`;
  return { workbook: wb, filename };
}

/**
 * Triggers a direct client-side download of the real .xlsx file.
 */
export function downloadFinancialExcelFile(options: ExcelExportOptions = {}): string {
  const { workbook, filename } = buildFinancialWorkbook(options);

  // Write as ArrayBuffer/blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 150);
  }

  return filename;
}
