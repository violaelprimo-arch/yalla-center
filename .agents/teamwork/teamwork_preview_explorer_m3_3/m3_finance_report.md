# YALLA CENTER — Financial Operations & Cashier Shifts Architecture Report (Milestone 3)

**Author**: Explorer M3-3 (`teamwork_preview_explorer_m3_3`)  
**Scope**: Milestone 3 — Student Enrollment & Dual Teacher Compensation Engine  
**Feature Focus**: FEAT-17 / FEAT-19 (Discount & Scholarship Engine), FEAT-21 (Cashier Shift Management & Drawer Reconciliation), FEAT-22 (Student Invoices, Receipts & Partial Payments), and `/center/[centerSlug]/finance` UI Architecture  
**Date**: 2026-10-18  
**Status**: APPROVED ARCHITECTURAL SPECIFICATION & BLUEPRINT FOR WORKER M3  

---

## 1. Executive Summary & Mission Alignment

The Yalla Center financial engine is the fiscal backbone of the educational center, linking student enrollment, reception attendance, cashier drawer control, and teacher compensation into a unified, zero-leakage financial workflow.

This report establishes the complete architectural blueprints, mathematical specifications, UI layouts, modal flows, and Data Access Layer (DAL) extensions for Worker M3 across three primary domains:

1. **Discount & Scholarship Calculation Engine (FEAT-17 / FEAT-19)**:
   - Universal discount handler supporting `NONE`, `PERCENT` (e.g. 15%), `FIXED` (e.g. 50 EGP), and `SCHOLARSHIP_100` (100% full waiver).
   - Strict invariants: Discount amount can never exceed gross base price; net balance can never be negative; zero rounding leakage down to the exact piastre (0.01 EGP).
   - Direct integration into group enrollment, student invoicing, and private lesson revenue splits.

2. **Cashier Shift Management & Drawer Reconciliations (FEAT-21)**:
   - Front-desk cashier shift lifecycle: Shift Opening with initial cash float float (`openingCash`), real-time tracking of active ledger inflows (cash vs. digital) and cash outflows (disbursements/expenses), and Shift Closing.
   - Comprehensive drawer reconciliation: Blind or itemized physical cash count (`actualCash`), automatic expected cash calculation ($\text{expectedCash} = \text{openingCash} + \text{cashCollected} - \text{cashDisbursed}$), variance/discrepancy detection (`cashDifference`), discrepancy justification capture, and official closing audit report.

3. **Student Invoices, Receipts & Partial Payments (FEAT-22)**:
   - Itemized student invoice generation (upon enrollment, session attendance, or batch monthly billing).
   - Partial payment collection mechanics: Student pays any valid amount ($0 < \text{amountPaid} \le \text{remainingBalance}$), real-time invoice status transitions (`pending` $\to$ `partially_paid` $\to$ `paid`), atomic student `balanceDue` adjustment, and active cashier shift drawer ledger sync.
   - Printable branded cash voucher: A4/slip layout in Arabic RTL adhering to official Yalla Center brand tokens (`BrandLogo theme="light"`), complete with student details, breakdown of gross/discount/net/prior/current/balance, Arabic spelled-out amount (Tafqeet), barcode/QR code placeholder, and print-ready CSS (`@media print`).

4. **Complete `/center/[centerSlug]/finance` UI Page Architecture**:
   - Upgrades current placeholder page to an interactive 5-tab financial dashboard:
     - **Tab 1: الورديات والخزينة (Cashier Shifts & Cash Drawer)**
     - **Tab 2: الفواتير والمطالبات (Student Invoices & Receivables)**
     - **Tab 3: إيصالات السداد والمقبوضات (Payment Receipts Ledger)**
     - **Tab 4: حسابات وكشوف المعلمين (Teacher Payroll & Dual Compensation)**
     - **Tab 5: المصروفات وجرد الكتب (Operating Expenses & Textbook Inventory)**
   - Top KPI summary ribbon (Gross Invoiced, Total Collected, Outstanding Receivables, Active Drawer Balance).
   - 6 fully articulated interactive modal dialogs for all cash and invoicing operations.

---

## 2. Discount & Scholarship Calculation Engine (FEAT-17 / FEAT-19)

### 2.1 Specification & Mathematical Invariants

The educational center allows four distinct tuition discount models configured per group enrollment:

| Discount Type | Canonical Token | Value Parameter | Mathematical Formula | Boundary Invariants |
|---|---|---|---|---|
| **بدون خصم (None)** | `NONE` / `'none'` | `0` | $\text{discountAmount} = 0$<br/>$\text{netPrice} = \text{basePrice}$ | $\text{netPrice} \equiv \text{basePrice}$ |
| **نسبة مئوية (Percentage)** | `PERCENT` / `'percentage'` | e.g. `15` ($15\%$) | $\text{discountAmount} = \text{round}_2(\text{basePrice} \times \frac{\text{val}}{100})$<br/>$\text{netPrice} = \text{basePrice} - \text{discountAmount}$ | $0 \le \text{val} \le 100$<br/>$\text{discountAmount} \le \text{basePrice}$ |
| **مبلغ ثابت (Fixed Amount)** | `FIXED` / `'fixed'` | e.g. `50` ($50\text{ EGP}$) | $\text{discountAmount} = \min(\text{basePrice}, \text{val})$<br/>$\text{netPrice} = \text{basePrice} - \text{discountAmount}$ | $\text{val} \ge 0$<br/>$\text{netPrice} \ge 0$ |
| **منحة كاملة 100% (Scholarship 100)** | `SCHOLARSHIP_100` / `'free_100'` | `0` (or ignored) | $\text{discountAmount} = \text{basePrice}$<br/>$\text{netPrice} = 0.00$ | $\text{netPrice} \equiv 0.00$<br/>$\text{teacherShare} = 0$<br/>$\text{centerShare} = 0$ |

### 2.2 Mathematical Proofs & Guardrails
1. **Non-Negativity Guarantee**:
   $$\forall \text{basePrice} \ge 0, \forall \text{discountType}, \forall \text{discountValue} \ge 0 \implies \text{netPrice} \ge 0$$
   Even if an administrator accidentally enters a fixed discount of $500\text{ EGP}$ on a $300\text{ EGP}$ course, the discount is capped at $\min(300, 500) = 300\text{ EGP}$, yielding $\text{netPrice} = 0.00\text{ EGP}$ (never negative).
2. **Zero Rounding Leakage Invariant**:
   $$\text{discountAmount} + \text{netPrice} \equiv \text{basePrice}$$
   $$\text{teacherShare} + \text{centerShare} \equiv \text{netPrice}$$
   Teacher share is rounded to 2 decimal places using half-up arithmetic (`Math.round(val * 100) / 100`), and Center share receives the exact remaining balance (`Math.round((netPrice - teacherShare) * 100) / 100`).

### 2.3 Proposed Implementation: `lib/finance/discounts.ts`
Worker M3 should create `lib/finance/discounts.ts` as a clean, reusable utility:

```typescript
// lib/finance/discounts.ts

export type DiscountType = 'none' | 'percentage' | 'fixed' | 'free_100';
export type CanonicalDiscountType = 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100';

export interface DiscountCalculationInput {
  basePrice: number;
  discountType: DiscountType | CanonicalDiscountType;
  discountValue: number;
}

export interface DiscountCalculationResult {
  basePrice: number;
  discountType: CanonicalDiscountType;
  discountValue: number;
  discountAmount: number;
  netPrice: number;
  isFullScholarship: boolean;
  effectiveDiscountPercentage: number;
}

/**
 * Normalizes input discount type to canonical uppercase format
 */
export function normalizeDiscountType(type: DiscountType | CanonicalDiscountType): CanonicalDiscountType {
  switch (type) {
    case 'percentage':
    case 'PERCENT':
      return 'PERCENT';
    case 'fixed':
    case 'FIXED':
      return 'FIXED';
    case 'free_100':
    case 'SCHOLARSHIP_100':
      return 'SCHOLARSHIP_100';
    case 'none':
    case 'NONE':
    default:
      return 'NONE';
  }
}

/**
 * Computes exact discount amount and net student price with zero leakage.
 */
export function calculateDiscount(input: DiscountCalculationInput): DiscountCalculationResult {
  const gross = Math.max(0, Math.round(input.basePrice * 100) / 100);
  const type = normalizeDiscountType(input.discountType);
  const rawValue = Math.max(0, input.discountValue || 0);

  if (gross === 0) {
    return {
      basePrice: 0,
      discountType: type,
      discountValue: rawValue,
      discountAmount: 0,
      netPrice: 0,
      isFullScholarship: true,
      effectiveDiscountPercentage: 100,
    };
  }

  let discountAmount = 0;
  let effectiveDiscountPercentage = 0;

  switch (type) {
    case 'SCHOLARSHIP_100': {
      discountAmount = gross;
      effectiveDiscountPercentage = 100;
      break;
    }
    case 'PERCENT': {
      const clampedPct = Math.min(100, rawValue);
      discountAmount = Math.round(gross * (clampedPct / 100) * 100) / 100;
      effectiveDiscountPercentage = clampedPct;
      break;
    }
    case 'FIXED': {
      discountAmount = Math.min(gross, Math.round(rawValue * 100) / 100);
      effectiveDiscountPercentage = Math.round((discountAmount / gross) * 10000) / 100;
      break;
    }
    case 'NONE':
    default: {
      discountAmount = 0;
      effectiveDiscountPercentage = 0;
      break;
    }
  }

  // Guarantees discount never exceeds gross and net price is never negative
  discountAmount = Math.min(gross, Math.max(0, discountAmount));
  const netPrice = Math.max(0, Math.round((gross - discountAmount) * 100) / 100);

  return {
    basePrice: gross,
    discountType: type,
    discountValue: rawValue,
    discountAmount,
    netPrice,
    isFullScholarship: netPrice === 0,
    effectiveDiscountPercentage,
  };
}
```

---

## 3. Cashier Shift Management & Drawer Reconciliations (FEAT-21)

### 3.1 Cashier Shift Lifecycle State Machine

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       [UNOPENED]                            │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  │ Action: openCashierShift(openingCash)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                         [OPEN]                              │
   │  - Status: 'open'                                           │
   │  - Opening Cash float recorded                              │
   │  - Real-time Ledger tracks Cash/Digital collections         │
   │  - Cash Disbursements / Petty Cash deducted                 │
   │  - Expected Cash dynamically calculated                     │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  │ Action: closeCashierShift(actualCash, notes)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                        [CLOSED]                             │
   │  - Status: 'closed', closedAt recorded                      │
   │  - cashDifference = actualCash - expectedCash               │
   │  - Audit flag: Balanced / Shortage / Surplus                │
   │  - Printable Shift Closing Audit Voucher issued             │
   └─────────────────────────────────────────────────────────────┘
```

### 3.2 Key Operational Formulas

$$\text{expectedCash} = \text{openingCash} + \text{cashCollected} - \text{cashDisbursed}$$
$$\text{cashDifference} = \text{actualCash} - \text{expectedCash}$$

1. **Opening Cash (`openingCash`)**:
   - Initial physical cash float in drawer when starting the shift (e.g., 500 EGP for providing change to students).
   - Invariant: Only one active open shift permitted per cashier at any given time.
2. **Cash Collections (`cashCollected`)**:
   - Sum of all student payments received where `paymentMethod === 'cash'` during this shift's duration.
3. **Digital Collections (`digitalCollected`)**:
   - Sum of payments received via non-cash methods: `vodafone_cash`, `instapay`, `card`, `fawry`.
   - **Crucial Invariant**: Digital payments increase center revenue but do NOT increase physical drawer cash! They are audited separately so the physical drawer is not expected to contain digital funds.
4. **Cash Disbursements (`cashDisbursed`)**:
   - Physical cash paid out of the drawer for center operating expenses (e.g. 50 EGP office supplies) or teacher cash advances during this shift.
5. **Actual Cash Count (`actualCash`)**:
   - Cash count performed by cashier at end of shift (can be entered directly or calculated via denomination count).
6. **Variance & Discrepancy Classification (`cashDifference`)**:
   - **Case A: $\text{cashDifference} === 0.00$ (مطابقة تامة - Balanced)**:
     - Physical drawer matches mathematical ledger to the exact piastre.
   - **Case B: $\text{cashDifference} < 0.00$ (عجز في الخزينة - Deficit/Shortage)**:
     - Cashier has less physical cash than expected (e.g. $-50.00\text{ EGP}$).
     - System displays prominent warning badge and mandates entering an explanatory note (`notes`).
   - **Case C: $\text{cashDifference} > 0.00$ (زيادة في الخزينة - Surplus/Overage)**:
     - Cashier has more physical cash than expected (e.g. $+30.00\text{ EGP}$).
     - System logs surplus as unallocated cash receipt requiring supervisor review.

### 3.3 Enhanced `CashierShift` Data Structure
To accurately support disbursements and denominations, `CashierShift` in `lib/dal/types.ts` should be expanded with optional convenience fields:

```typescript
export interface CashierShift {
  id: string;
  tenantId: string;
  branchId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashCollected: number;
  digitalCollected: number;
  cashDisbursed?: number; // Petty cash expenses / advances paid from drawer
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'open' | 'closed';
  notes?: string;
  denominations?: {
    bill200?: number;
    bill100?: number;
    bill50?: number;
    bill20?: number;
    bill10?: number;
    bill5?: number;
    coins?: number;
  };
}
```

---

## 4. Student Invoices, Receipts & Partial Payments (FEAT-22)

### 4.1 Invoicing Mechanics & Data Flow

1. **Invoice Trigger Mechanisms**:
   - **Manual Single Invoice**: Receptionist/Accountant issues an invoice for a specific student and group.
   - **Enrollment Auto-Invoice**: When a student enrolls in a group, an initial invoice is generated based on `groups.monthlyFee` or `groups.sessionFee` minus student's approved discount.
   - **Monthly Group Batch Billing**: Center Admin runs recurring billing for the 1st of each month across all active students in a group.
2. **Invoice Numbering Convention**:
   `INV-{YEAR}-{SEQUENTIAL_NUMBER}` (e.g. `INV-2026-0042`), unique per tenant.
3. **Invoice Status Lifecycle**:
   - `pending`: `paidAmount === 0`
   - `partially_paid`: `0 < paidAmount < netAmount`
   - `paid`: `paidAmount >= netAmount`
   - `void`: Canceled/voided by management

### 4.2 Partial Payment Execution & Cascade Synchronizations

When a payment of `amountPaid` is recorded against an invoice:

```
[Student Payment Action]
       │
       ├── 1. Validation Guard: 0 < amountPaid <= (netAmount - paidAmount)
       │
       ├── 2. Payment Record Inserted:
       │      - id: pay-{timestamp}
       │      - receiptNumber: REC-{timestamp_or_seq}
       │      - amountPaid: e.g. 150.00 EGP
       │      - paymentMethod: 'cash' | 'vodafone_cash' | 'instapay' | 'card' | 'fawry'
       │      - cashierShiftId: activeShift.id
       │      - paidAt: ISO timestamp
       │
       ├── 3. Invoice Updated:
       │      - paidAmount += amountPaid
       │      - status: (paidAmount >= netAmount) ? 'paid' : 'partially_paid'
       │
       ├── 4. Student Profile Updated:
       │      - student.balanceDue = max(0, student.balanceDue - amountPaid)
       │
       └── 5. Active Cashier Shift Drawer Updated:
              - If paymentMethod === 'cash':
                  shift.cashCollected += amountPaid
                  shift.expectedCash += amountPaid
              - If paymentMethod !== 'cash':
                  shift.digitalCollected += amountPaid
```

### 4.3 Branded Printable Payment Receipt Voucher

The payment receipt must follow the brand design system (Cairo font, Arabic RTL, official Yalla Center logo, and clear financial breakdown).

#### Layout Structure:
- **Header**:
  - Right: Official Yalla Center Logo (`BrandLogo theme="light"`).
  - Center: Center Name (`tenant.nameAr`), Branch Name, Commercial Tax / Reg #.
  - Left: Receipt # (`REC-2026-0042`) and Barcode / QR Code representation.
- **Title**:
  - `إيصال استلام نقدية رسمي (Official Payment Receipt)`
- **Student & Academic Metadata**:
  - اسم الطالب: `مريم خالد حسن` | كود الطالب: `STD-1002`
  - المرحلة والصف: `الثانوية العامة — الصف الثالث الثانوي` | المادة: `فيزياء 3 ثانوي`
  - المجموعة: `مجموعة النخبة` | اسم المعلم: `د. هاني نبيل`
- **Transaction Details**:
  - تاريخ وساعة السداد: `18/10/2026 - 10:45 ص`
  - طريقة الدفع: `نقداً بالخزينة (Cash)` (أو فودافون كاش / إنستاباي)
  - مسؤول الاستلام: `سارة الشافعي (الاستقبال)`
- **Financial Breakdown Grid**:
  | البيان | المبلغ بالجنيه المصري (EGP) |
  |---|---|
  | إجمالي قيمة الاشتراك (Gross Invoiced) | 300.00 ج.م |
  | الخصم المعتمد (Approved Discount) | 0.00 ج.م |
  | صافي المستحق الأصلي (Net Invoiced) | 300.00 ج.م |
  | المسدد سابقاً (Previously Paid) | 0.00 ج.م |
  | **المبلغ المسدد الآن (Amount Paid Now)** | **150.00 ج.م** |
  | **المتبقي المستحق على الطالب (Remaining Balance)** | **150.00 ج.م** |
- **Tafqeet (Amount in Arabic Words)**:
  `فقط مائة وخمسون جنيهاً مصرياً لا غير`
- **Notice & Signatures**:
  - "هذا الإيصال سند رسمي صادر من النظام الإلكتروني لسنتر الماهر النموذجي. يرجى الاحتفاظ به."
  - توقيع المستلم (المحصل) | توقيع ولي الأمر / الطالب | ختم السنتر الإلكتروني
- **Print Optimization**:
  - Print trigger button (`window.print()`).
  - `@media print` CSS rules hiding navbar, sidebar, buttons, and adjusting margins for A5/A4 receipt printers.

---

## 5. UI Architecture for `/center/[centerSlug]/finance/page.tsx`

### 5.1 Page Layout & Component Hierarchy

```
FinancePage (/center/[centerSlug]/finance)
├── Top Page Header
│   ├── Title: "الخزينة والمالية وحسابات المعلمين"
│   ├── Subtitle & Center Name
│   └── Header Actions:
│       ├── Button: "فتح / إغلاق وردية الكاشير"
│       ├── Button: "تحصيل نقدية سريع"
│       ├── Button: "إصدار فاتورة جديدة"
│       └── Button: "تسجيل مصروفات"
│
├── Top KPI Ribbon (4 Elevated Metric Cards)
│   ├── Card 1: إجمالي إيرادات الشهر (Gross Monthly Invoiced)
│   ├── Card 2: المتحصلات الفعلية (Total Cash & Digital Collected)
│   ├── Card 3: المتأخرات والمستحقات (Outstanding Student Receivables)
│   └── Card 4: رصيد الدرج النشط (Active Cash Drawer Balance & Shift State)
│
├── Main Navigation Tabs (5 Tabs)
│   ├── Tab 1: [الورديات والخزينة] (Cashier Shifts & Cash Drawer)
│   │   ├── Active Shift Banner & Live Real-Time Drawer HUD
│   │   ├── Shift Cash Ledger (Real-time chronological inflows/outflows)
│   │   └── Shift Archive Table (Past closed shifts with discrepancy audits)
│   │
│   ├── Tab 2: [الفواتير والمطالبات] (Student Invoices & Receivables)
│   │   ├── Filter Bar (Status: All/Pending/Partially Paid/Paid, Search, Group)
│   │   └── Invoices Table (Invoice #, Student, Group, Gross, Discount, Net, Paid, Balance, Status, Actions)
│   │
│   ├── Tab 3: [إيصالات السداد والمقبوضات] (Payment Receipts Ledger)
│   │   ├── Search & Filter Bar (Receipt #, Student, Method, Date Range)
│   │   └── Payments Table (Receipt #, Invoice #, Student, Amount, Method, Cashier, Timestamp, Print Action)
│   │
│   ├── Tab 4: [حسابات وكشوف المعلمين] (Teacher Payroll & Dual Compensation)
│   │   ├── Dual Compensation Simulator (Center Subscription vs Private Lessons)
│   │   ├── Teacher Rates Reference Table
│   │   ├── Invoiced vs. Collected Accrual Breakdown
│   │   └── Monthly Payroll Review & Approval Table (Draft/Reviewed/Approved/Paid)
│   │
│   └── Tab 5: [المصروفات وجرد الكتب] (Operating Expenses & Textbook Inventory)
│       ├── Center Operating Expenses Ledger (Rent, Utilities, Supplies, Maintenance)
│       └── Textbook Inventory Table (Book Title, Subject, Grade, Cost, Price, Stock, Profit Margin)
│
└── Interactive Modals
    ├── Modal 1: OpenCashierShiftModal (Opening cash, cashier user, branch)
    ├── Modal 2: CloseCashierShiftModal (Denominations, actual cash, variance detector, notes)
    ├── Modal 3: RecordPaymentModal (Invoice selector, amount paid, payment method, notes)
    ├── Modal 4: CreateInvoiceModal (Student selector, group, gross price, discount calculator, due date)
    ├── Modal 5: PrintableReceiptModal (Branded A4/Voucher slip preview with window.print() trigger)
    └── Modal 6: RecordExpenseModal (Category, amount, description, drawer deduction toggle)
```

### 5.2 Modal Specifications & Wireframe Interactions

#### Modal 1: Open Cashier Shift Modal (`OpenCashierShiftModal`)
- **Trigger**: Click "فتح وردية جديدة" when no shift is open.
- **Fields**:
  - الفرع: Select active branch (defaults to current tenant branch).
  - مسؤول الخزينة: Current user (read-only attribution).
  - عهدة الدرج الافتتاحية: Number input in EGP (e.g. 500.00). Must be $\ge 0$.
  - ملاحظات الاستلام: Textarea (e.g. "استلام عهدة الصباح فئات نقدية صغيرة").
- **Submit**: Calls `dal.openCashierShift()`.

#### Modal 2: Close Cashier Shift & Drawer Reconciliation Modal (`CloseCashierShiftModal`)
- **Trigger**: Click "إغلاق الوردية وجرد الخزينة" when a shift is active.
- **Guided Multi-Step Flow**:
  1. **ملخص النظام الرقمي (System Expected Summary)**:
     - عهدة البداية: 500.00 ج.م
     - المقبوضات النقدية: +1,250.00 ج.م
     - المصروفات النقدية: -150.00 ج.م
     - **النقدية المتوقعة بالدرج**: **1,600.00 ج.م**
     - المقبوضات الإلكترونية (خارج الدرج): 650.00 ج.م
  2. **جرد النقدية الفعلي (Actual Cash Count)**:
     - Direct count entry or breakdown by bill:
       - $200 \times \dots$ | $100 \times \dots$ | $50 \times \dots$ | $20 \times \dots$ | $10 \times \dots$ | فكة ومعدن
     - Calculated total = `actualCash`.
  3. **كاشف الفروقات والعجز (Variance Detection)**:
     - `cashDifference = actualCash - expectedCash`.
     - Live reactive badge:
       - If $0$: "✅ مطابقة تامة - لا يوجد عجز أو زيادة"
       - If $< 0$: "⚠️ عجز في الخزينة بقيمة X جنيه" (Red alert box requiring mandatory explanation).
       - If $> 0$: "ℹ️ زيادة نقدية غير مقيدة بقيمة X جنيه" (Amber alert box).
  4. **ملاحظات الإغلاق والتسليم**:
     - Textarea for cashier closing remarks.
- **Submit**: Calls `dal.closeCashierShift()`, switches status to `'closed'`, and displays the printable Shift Closing Audit Report.

#### Modal 3: Collect Partial Payment Modal (`RecordPaymentModal`)
- **Trigger**: Click "تحصيل نقدية سريع" or click "تحصيل" next to any pending/partially paid invoice.
- **Fields**:
  - الفاتورة المستهدفة: Dropdown of student invoices with current balance.
  - بيانات الفاتورة: Displays Gross, Discount, Net, Already Paid, and Remaining Balance Due.
  - المبلغ المسدد: Numeric input.
    - Default = remaining balance.
    - User can enter partial amount (e.g. 100 EGP).
    - Validation error if amount $\le 0$ or amount $>$ remaining balance.
  - وسيلة السداد: Radio pills:
    - 💵 نقداً (Cash)
    - 📱 فودافون كاش (Vodafone Cash)
    - ⚡ إنستاباي (InstaPay)
    - 💳 بطاقة بنكية (Card)
    - 🧾 فوري (Fawry)
  - ملاحظات السداد: Optional text note.
- **Submit**: Calls `dal.recordPayment()`, auto-updates invoice status, deducts from student balance, updates active drawer, and immediately opens Modal 5 (Printable Receipt Modal).

#### Modal 4: Issue Student Invoice Modal (`CreateInvoiceModal`)
- **Trigger**: Click "إصدار فاتورة جديدة".
- **Fields**:
  - الطالب: Searchable student dropdown (displays name, code, current balance).
  - المجموعة الدراسية: Group selector (auto-fills base price).
  - شهر وسنة الفاتورة: Month (1-12) & Year (e.g. 10 / 2026).
  - تاريخ الاستحقاق: Due date picker (default = +10 days).
  - المبلغ الأساسي (Gross): Number input in EGP.
  - نوع الخصم (Discount Type): Dropdown (`none`, `percentage`, `fixed`, `free_100`).
  - قيمة الخصم (Discount Value): Percentage (e.g. 20%) or Fixed amount (e.g. 50 EGP).
  - **Live Reactive Calculation Summary**:
    - إجمالي الفاتورة: Gross
    - قيمة الخصم المحسوبة: Discount Amount
    - صافي الفاتورة المستحق: Net Amount
- **Submit**: Calls `dal.createInvoice()`.

#### Modal 5: Printable Branded Payment Receipt Voucher (`PrintableReceiptModal`)
- Fullscreen or elevated dialog showing the A4/Slip voucher.
- Features:
  - Official Yalla Center light logo.
  - Full itemized billing breakdown.
  - Tafqeet Arabic spelled-out amount.
  - Receipt Barcode representation.
  - Print button (`window.print()`).

---

## 6. Data Access Layer (DAL) Extensions for Worker M3

### 6.1 Required Additions to `IDataProvider` (`lib/dal/index.ts`)

Worker M3 should expand `IDataProvider` in `lib/dal/index.ts` with these method signatures:

```typescript
// Additions to IDataProvider in lib/dal/index.ts:

// Financial Invoicing & Payments
getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null>;
createInvoice(params: {
  tenantId: string;
  studentId: string;
  groupId?: string;
  totalAmount: number;
  discountType?: DiscountType;
  discountValue?: number;
  billingMonth: number;
  billingYear: number;
  dueDate: string;
}): Promise<Invoice>;

getPayments(tenantId: string, filter?: { invoiceId?: string; studentId?: string; shiftId?: string }): Promise<Payment[]>;
getPaymentById(tenantId: string, paymentId: string): Promise<Payment | null>;

// Enhanced recordPayment return signature (preserves backward compatibility while adding updatedStudent)
recordPayment(params: {
  tenantId: string;
  invoiceId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  cashierUserId: string;
  shiftId?: string;
  notes?: string;
}): Promise<{ payment: Payment; updatedInvoice: Invoice; updatedStudent?: User }>;

// Cashier Shifts Management
getActiveCashierShift(tenantId: string, cashierUserId?: string, branchId?: string): Promise<CashierShift | null>;
openCashierShift(params: {
  tenantId: string;
  branchId: string;
  cashierUserId: string;
  openingCash: number;
  notes?: string;
}): Promise<CashierShift>;
closeCashierShift(params: {
  shiftId: string;
  actualCash: number;
  notes?: string;
  denominations?: Record<string, number>;
}): Promise<CashierShift>;

// Operating Expenses
recordExpense(params: {
  tenantId: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  createdByUserId: string;
  shiftId?: string;
}): Promise<Expense>;

// Teacher Payroll Approval
updateTeacherPayrollStatus(params: {
  payrollId: string;
  status: PayrollStatus;
  approvedByUserId?: string;
}): Promise<TeacherPayroll>;
```

### 6.2 Implementation Blueprint for `MockDataProvider` (`lib/dal/mock-data.ts`)

Worker M3 should implement these methods in `MockDataProvider`:

```typescript
  // 1. Create Invoice with Automatic Discount Calculation
  async createInvoice(params: {
    tenantId: string;
    studentId: string;
    groupId?: string;
    totalAmount: number;
    discountType?: DiscountType;
    discountValue?: number;
    billingMonth: number;
    billingYear: number;
    dueDate: string;
  }): Promise<Invoice> {
    const discount = calculateDiscount({
      basePrice: params.totalAmount,
      discountType: params.discountType || 'none',
      discountValue: params.discountValue || 0,
    });

    const invoiceNumber = `INV-${params.billingYear}-${String(this.invoices.length + 1).padStart(4, '0')}`;
    const invoice: Invoice = {
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: params.tenantId,
      studentId: params.studentId,
      groupId: params.groupId,
      invoiceNumber,
      billingMonth: params.billingMonth,
      billingYear: params.billingYear,
      totalAmount: discount.basePrice,
      discountAmount: discount.discountAmount,
      netAmount: discount.netPrice,
      paidAmount: 0.0,
      status: discount.netPrice === 0 ? 'paid' : 'pending',
      dueDate: params.dueDate,
      createdAt: new Date().toISOString(),
    };

    this.invoices.push(invoice);

    // Update student balanceDue
    const student = this.users.find((u) => u.id === params.studentId);
    if (student) {
      student.balanceDue = Math.round((student.balanceDue + discount.netPrice) * 100) / 100;
    }

    return invoice;
  }

  // 2. Enhanced recordPayment syncing Invoices, Payments, Students, and Active Shift
  async recordPayment(params: {
    tenantId: string;
    invoiceId: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    shiftId?: string;
    notes?: string;
  }): Promise<{ payment: Payment; updatedInvoice: Invoice; updatedStudent?: User }> {
    const invoice = this.invoices.find(
      (inv) => inv.id === params.invoiceId && inv.tenantId === params.tenantId
    );
    if (!invoice) throw new Error('الفاتورة غير موجودة');

    const remainingBalance = Math.round((invoice.netAmount - invoice.paidAmount) * 100) / 100;
    if (params.amountPaid <= 0) {
      throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر');
    }
    if (params.amountPaid > remainingBalance) {
      throw new Error(`مبلغ السداد (${params.amountPaid}) أكبر من الرصيد المتبقي على الفاتورة (${remainingBalance})`);
    }

    // Determine active cashier shift if not explicitly provided
    let shift = this.cashierShifts.find((s) => s.id === params.shiftId);
    if (!shift) {
      shift = this.cashierShifts.find(
        (s) => s.tenantId === params.tenantId && s.status === 'open' && s.cashierUserId === params.cashierUserId
      ) || this.cashierShifts.find((s) => s.tenantId === params.tenantId && s.status === 'open');
    }

    const receiptNumber = `REC-${new Date().getFullYear()}-${String(this.payments.length + 1).padStart(4, '0')}`;
    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: params.tenantId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      cashierShiftId: shift?.id,
      receiptNumber,
      amountPaid: Math.round(params.amountPaid * 100) / 100,
      paymentMethod: params.paymentMethod,
      receivedByUserId: params.cashierUserId,
      notes: params.notes,
      paidAt: new Date().toISOString(),
    };

    // Update invoice
    invoice.paidAmount = Math.round((invoice.paidAmount + params.amountPaid) * 100) / 100;
    if (invoice.paidAmount >= invoice.netAmount) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partially_paid';
    }

    // Update student balanceDue
    const student = this.users.find((u) => u.id === invoice.studentId);
    if (student) {
      student.balanceDue = Math.max(0, Math.round((student.balanceDue - params.amountPaid) * 100) / 100);
    }

    // Update active cashier shift drawer
    if (shift && shift.status === 'open') {
      if (params.paymentMethod === 'cash') {
        shift.cashCollected = Math.round((shift.cashCollected + params.amountPaid) * 100) / 100;
        shift.expectedCash = Math.round((shift.openingCash + shift.cashCollected - (shift.cashDisbursed || 0)) * 100) / 100;
      } else {
        shift.digitalCollected = Math.round((shift.digitalCollected + params.amountPaid) * 100) / 100;
      }
    }

    this.payments.push(payment);
    return { payment, updatedInvoice: invoice, updatedStudent: student };
  }

  // 3. Open Cashier Shift
  async openCashierShift(params: {
    tenantId: string;
    branchId: string;
    cashierUserId: string;
    openingCash: number;
    notes?: string;
  }): Promise<CashierShift> {
    const existingOpen = this.cashierShifts.find(
      (s) => s.tenantId === params.tenantId && s.cashierUserId === params.cashierUserId && s.status === 'open'
    );
    if (existingOpen) {
      throw new Error('يوجد وردية كاشير مفتوحة بالفعل لهذا المستخدم، يرجى إغلاقها أولاً');
    }

    const shift: CashierShift = {
      id: `shift-${Date.now()}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      cashierUserId: params.cashierUserId,
      openedAt: new Date().toISOString(),
      openingCash: Math.max(0, Math.round(params.openingCash * 100) / 100),
      cashCollected: 0.0,
      digitalCollected: 0.0,
      cashDisbursed: 0.0,
      expectedCash: Math.max(0, Math.round(params.openingCash * 100) / 100),
      status: 'open',
      notes: params.notes,
    };

    this.cashierShifts.push(shift);
    return shift;
  }

  // 4. Close Cashier Shift & Drawer Reconciliation
  async closeCashierShift(params: {
    shiftId: string;
    actualCash: number;
    notes?: string;
    denominations?: Record<string, number>;
  }): Promise<CashierShift> {
    const shift = this.cashierShifts.find((s) => s.id === params.shiftId);
    if (!shift) throw new Error('الوردية غير موجودة');
    if (shift.status === 'closed') throw new Error('هذه الوردية مغلقة بالفعل');

    const expectedCash = Math.round((shift.openingCash + shift.cashCollected - (shift.cashDisbursed || 0)) * 100) / 100;
    const actualCash = Math.round(params.actualCash * 100) / 100;
    const cashDifference = Math.round((actualCash - expectedCash) * 100) / 100;

    shift.actualCash = actualCash;
    shift.expectedCash = expectedCash;
    shift.cashDifference = cashDifference;
    shift.status = 'closed';
    shift.closedAt = new Date().toISOString();
    if (params.notes) {
      shift.notes = shift.notes ? `${shift.notes} | إغلاق: ${params.notes}` : params.notes;
    }
    if (params.denominations) {
      shift.denominations = params.denominations;
    }

    return shift;
  }

  // 5. Record Expense & Link to Active Shift Drawer
  async recordExpense(params: {
    tenantId: string;
    branchId: string;
    category: string;
    description: string;
    amount: number;
    createdByUserId: string;
    shiftId?: string;
  }): Promise<Expense> {
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      category: params.category,
      description: params.description,
      amount: Math.round(params.amount * 100) / 100,
      createdByUserId: params.createdByUserId,
      createdAt: new Date().toISOString(),
    };

    this.expenses.push(expense);

    // Deduct from active shift if paid from drawer
    const shift = this.cashierShifts.find(
      (s) => s.id === params.shiftId || (s.tenantId === params.tenantId && s.status === 'open')
    );
    if (shift) {
      shift.cashDisbursed = Math.round(((shift.cashDisbursed || 0) + expense.amount) * 100) / 100;
      shift.expectedCash = Math.round((shift.openingCash + shift.cashCollected - shift.cashDisbursed) * 100) / 100;
    }

    return expense;
  }
```

---

## 7. Implementation Checklist & Action Plan for Worker M3

Worker M3 can implement Milestone 3 Financial Operations following this ordered plan:

### Task 1: Create Discount Utility Module (`lib/finance/discounts.ts`)
- [ ] Create `lib/finance/discounts.ts` with `calculateDiscount`, `normalizeDiscountType`, and unit tests.
- [ ] Verify test cases for 0%, 20%, fixed 50 EGP, 100% scholarship, and fixed discount exceeding gross price.

### Task 2: Extend DAL Interfaces & Mock Implementation
- [ ] Update `lib/dal/index.ts`: Add `createInvoice`, `getPayments`, `getActiveCashierShift`, `openCashierShift`, `closeCashierShift`, `recordExpense`.
- [ ] Update `lib/dal/mock-data.ts`: Implement new methods with atomic student `balanceDue` updates and cashier shift drawer sync.
- [ ] Add unit tests in `tests/unit/mock-dal.test.ts` verifying `openCashierShift`, `recordPayment`, and `closeCashierShift` with variance detection.

### Task 3: Build Finance Page Tab Components (`app/center/[centerSlug]/finance/`)
- [ ] `app/center/[centerSlug]/finance/page.tsx`: Main page layout, top KPI ribbon, tab switcher.
- [ ] `components/finance/shifts-tab.tsx`: Real-time active drawer HUD, shift ledger table, shift history table.
- [ ] `components/finance/invoices-tab.tsx`: Invoices list, status badges, remaining balance calculation, payment trigger.
- [ ] `components/finance/receipts-tab.tsx`: Payments list, search by receipt number/student, voucher print trigger.
- [ ] `components/finance/payroll-tab.tsx`: Teacher compensation dual engine review, invoiced vs collected comparison.
- [ ] `components/finance/expenses-tab.tsx`: Center expenses and book inventory tracker.

### Task 4: Build Financial Modal Dialogs (`components/finance/modals/`)
- [ ] `open-shift-modal.tsx`: Opening float input, cashier verification, branch scoping.
- [ ] `close-shift-modal.tsx`: Denominations breakdown, variance detector (`cashDifference`), discrepancy justification note.
- [ ] `record-payment-modal.tsx`: Partial payment input, payment method pills (Cash, Vodafone Cash, InstaPay), remaining balance validator.
- [ ] `create-invoice-modal.tsx`: Student lookup, group fee selection, live discount calculator preview.
- [ ] `printable-receipt-modal.tsx`: Official branded voucher with `BrandLogo theme="light"`, itemized grid, Tafqeet Arabic words, print CSS.
- [ ] `record-expense-modal.tsx`: Category selector, amount, petty cash drawer deduction toggle.

### Task 5: Verification & Quality Assurance
- [ ] Run full Vitest suite (`npx vitest run`) ensuring all 308+ existing tests pass.
- [ ] Write integration test verifying shift opening $\to$ partial payment collection $\to$ drawer expected cash update $\to$ shift closing with variance audit.
- [ ] Test browser rendering of printable receipt voucher in dark and light themes.

---

## 8. Conclusion

Milestone 3's financial engine bridges student enrollment and teacher compensation through rigorous accounting principles:
1. **Mathematical safety**: Non-negative balances, zero rounding leakage, and strict bounds on discounts.
2. **Cashier drawer accountability**: Shift opening float, separate cash vs. digital collection streams, cash disbursement deductions, and variance audits upon shift closing.
3. **Student transparency**: Instant partial payment registration, dynamic balance deduction, and official branded printable payment vouchers.
4. **Clean code architecture**: Reusable discount helpers, standard DAL interfaces, and modular UI components styled with Cairo RTL typography and Yalla Center branding.
