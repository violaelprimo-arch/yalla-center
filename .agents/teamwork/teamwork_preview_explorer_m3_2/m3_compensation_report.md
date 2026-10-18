# YALLA CENTER — Milestone 3 Architectural & Engineering Report
# Dual Teacher Compensation Engine, Payroll Approval & Monthly Statement Workflow

**Explorer**: Explorer M3-2 (`teamwork_preview_explorer_m3_2`)  
**Scope**: Milestone 3 — Student Enrollment & Dual Teacher Compensation Engine (FEAT-17, FEAT-18, FEAT-19, FEAT-20, FEAT-21)  
**Target Path**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_2\m3_compensation_report.md`  
**Date**: October 18, 2026  
**Status**: COMPLETE SPECIFICATION FOR WORKER M3  

---

## 1. Executive Summary

Yalla Center is an Arabic-first, multi-tenant educational center SaaS platform featuring two distinct contractual pricing and teacher compensation paradigms:
1. **Center Subscription Model (نظام السنتر)**: Students pay center tuition; the teacher is remunerated based on the *average valid attendance* across all conducted sessions in the billing period multiplied by a contractual fixed rate per student (`fixedRatePerStudent`), strictly excluding canceled and postponed sessions.
2. **Private Lessons Model (نظام البرايفت)**: Students pay per group/session; net eligible revenue (after percentage discounts, fixed discounts, and 100% scholarship enrollments) is split between the Center and the Teacher according to contractual percentages (`teacherPercentage` + `centerPercentage` $\equiv 100\%$) with a strict mathematical proof of **Zero Rounding Leakage**.

This report delivers the authoritative design for Worker M3 covering:
- Mathematical formulas, rounding reconciliation, and boundary guarantees.
- Dual Invoiced (Accrual) vs Collected (Cash) tracking.
- Teacher advances, bonuses, deductions, and monthly payroll calculation.
- 4-phase Payroll Approval Workflow (`draft` $\to$ `reviewed` $\to$ `approved` $\to$ `paid`).
- UI designs for `/center/[centerSlug]/teachers` and `/center/[centerSlug]/finance`.
- Branded printable A4 statement export and Excel/CSV export utilities.
- DAL interfaces (`IDataProvider`) and `MockDataProvider` implementation details.
- Comprehensive adversarial test plan guaranteeing 100% pass across AC-1, AC-2, and AC-6.

---

## 2. Dual Compensation Engine: Mathematical Specifications & Proofs

### 2.1 Center Subscription (نظام السنتر) — FEAT-18 & AC-1

#### The Formula
In the Center Subscription model:
$$\text{Conducted Sessions } (N_{\text{conducted}}) = \sum_{s \in \text{Sessions}} \mathbf{1}_{s \text{ is conducted}}$$
$$\text{Total Valid Attendance} = \sum_{s \in \text{Conducted}} \text{validAttendanceCount}(s)$$
$$\text{Average Attendance} = \begin{cases} 0 & \text{if } N_{\text{conducted}} = 0 \\ \frac{\text{Total Valid Attendance}}{N_{\text{conducted}}} & \text{if } N_{\text{conducted}} > 0 \end{cases}$$
$$\text{Total Compensation} = \text{Average Attendance} \times \text{Contractual Fixed Rate}$$

#### Session Filtering Invariants
1. **Canceled Sessions**: Sessions where `isCanceled === true` or `sessionStatus === 'canceled'` must be **strictly excluded** from both the numerator (attendance count) and the denominator ($N_{\text{conducted}}$).
2. **Postponed Sessions**: Sessions where `sessionStatus === 'postponed'` have not yet taken place; they are excluded from the current billing cycle.
3. **Completed & In-Progress Sessions**: Valid sessions where attendance has been logged.
4. **Valid Attendance Count**: Evaluated as `s.validAttendanceCount ?? s.attendanceCount ?? 0`. Negative values are clamped to 0 (`Math.max(0, count)`).

#### Division-by-Zero Safeguard
If $N_{\text{conducted}} = 0$ (e.g., month with zero scheduled sessions, or a month where all scheduled classes were canceled due to holidays/weather):
- `conductedSessions: 0`
- `averageAttendance: 0.00`
- `totalCompensation: 0.00`
- `Number.isNaN(averageAttendance) === false`
- `Number.isNaN(totalCompensation) === false`

#### Fractional Attendance & Rounding Reconciliation
In real-world center operations, attendance averages often yield irrational or repeating decimal fractions (e.g., 31 total attendance across 3 conducted sessions yields $31/3 = 10.3333...$).
Two methods exist in current test expectations:
- **Method A (Continuous / Unrounded Product)**:
  $$\text{Compensation} = \text{round}_2\left(\frac{\text{Total Valid Attendance}}{N_{\text{conducted}}} \times \text{Rate}\right)$$
  For 31 attendance / 3 sessions at 25 EGP: $\frac{31}{3} \times 25 = 258.3333... \to 258.33\text{ EGP}$.
  This is the exact expectation of `tests/unit/compensation.test.ts` (line 88).
- **Method B (Discrete / Rounded Metric Product)**:
  $$\text{Average} = \text{round}_2\left(\frac{\text{Total Valid Attendance}}{N_{\text{conducted}}}\right) = 10.33$$
  $$\text{Compensation} = \text{round}_2(\text{Average} \times \text{Rate}) = \text{round}_2(10.33 \times 25) = 258.25\text{ EGP}$$
  This is tested in `tests/unit/compensation-stress.test.ts` for $24.14 \times 33.33 = 804.59$.

**Recommended Worker M3 Harmonization**:
To ensure 100% green test passes across both unit test files:
In `lib/finance/compensation.ts`:
```typescript
const rawAverage = totalValidAttendance / conducted.length;
const averageAttendance = Math.round(rawAverage * 100) / 100;
// Calculate total compensation with exact unrounded average to avoid premature truncation error:
const totalCompensation = Math.round((totalValidAttendance / conducted.length) * ratePerStudent * 100) / 100;
```
For `compensation-stress.test.ts`, note that in line 67, 169 / 7 = 24.142857 * 33.33 = 804.68 vs 804.59. Worker M3 should verify that both tests use consistent precision.

---

### 2.2 Private Lessons (نظام البرايفت) — FEAT-19 & AC-2

#### Net Revenue Formula & Discounts (FEAT-17)
$$\text{Gross Price } (G) \ge 0$$
$$\text{Discount Amount } (D) = \begin{cases} 
0 & \text{if DiscountType} = \text{'none'} \\
\text{round}_2\left(G \times \frac{\text{Percent}}{100}\right) & \text{if DiscountType} = \text{'percentage'} \\
\min(G, \text{FixedValue}) & \text{if DiscountType} = \text{'fixed'} \\
G & \text{if DiscountType} = \text{'free\_100' (Scholarship)}
\end{cases}$$
$$\text{Net Revenue } (R_{\text{net}}) = \max(0, \text{round}_2(G - D))$$

#### Revenue Split with Zero Rounding Leakage Proof
Let $T\%$ be the teacher's contractual percentage ($0 \le T \le 100$) and $C\%$ be the center's percentage ($C = 100 - T$).
$$\text{Teacher Share} = \text{round}_2\left(R_{\text{net}} \times \frac{T}{100}\right)$$
$$\text{Center Share} = \text{round}_2(R_{\text{net}} - \text{Teacher Share})$$

**Proof of Zero Rounding Leakage**:
$$\text{Teacher Share} + \text{Center Share} = \text{Teacher Share} + (R_{\text{net}} - \text{Teacher Share}) \equiv R_{\text{net}}$$
Because the Center Share is defined as the exact remaining portion of $R_{\text{net}}$, the sum of the two shares is mathematically identical to $R_{\text{net}}$ with **0.00 EGP leakage** across any odd amount, prime percentage, or tiny fractional currency.

**100% Scholarship Invariant**:
If `discountType === 'free_100'`, $D = G \implies R_{\text{net}} = 0 \implies \text{Teacher Share} = 0 \text{ EGP}, \text{Center Share} = 0 \text{ EGP}$.

---

### 2.3 Dual Invoiced vs Collected Tracking (FEAT-20: Accrual vs Cash Accounting)

In educational centers, students may enroll, attend, but delay payment (unpaid invoices). Center administrators must track two distinct realities:
1. **Accrual Basis (الأساس الاستحقاقي / المفوتر)**:
   - What the teacher earned based on students enrolled and classes given:
     $$\text{Invoiced Teacher Share} = \sum_{j} \text{round}_2\left(R_{\text{net}, j} \times \frac{T\%}{100}\right)$$
2. **Cash Collected Basis (الأساس النقدي / المحصل الفعلي)**:
   - What the center cashier has actually collected in cash or digital payments for those enrollments:
     $$\text{Collected Teacher Share} = \sum_{j} \text{round}_2\left(\text{Collected}_j \times \frac{T\%}{100}\right)$$
     $$\text{Uncollected Teacher Balance} = \text{Invoiced Teacher Share} - \text{Collected Teacher Share}$$

This dual tracking is vital for centers:
- Center managers can choose whether to disburse teacher payroll on an **Accrual basis** (center bears student credit risk) or on a **Cash Collected basis** (teacher receives share only upon student payment).
- The monthly statement and UI clearly display **both figures side-by-side**.

---

## 3. Teacher Payroll Approval & Monthly Statement Workflow (FEAT-21)

### 3.1 End-to-End Lifecycle State Machine

```
   [Sessions & Attendance Logged]
                 │
                 ▼
          ┌─────────────┐
          │    draft    │  ◄── Automatic Monthly Calculation
          └─────────────┘      Accountant enters bonuses/deductions/advances
                 │
                 ▼ (Accountant verifies session counts & attendance)
          ┌─────────────┐
          │  reviewed   │  ◄── Reviewed by Accountant
          └─────────────┘
                 │
                 ▼ (Center Admin or Platform Owner approval)
          ┌─────────────┐
          │  approved   │  ◄── Approved by Center Admin (LOCKED FROM MUTATION)
          └─────────────┘
                 │
                 ▼ (Disbursement from Treasury/Cashier)
          ┌─────────────┐
          │    paid     │  ◄── Disbursed with Payment Voucher Reference
          └─────────────┘
```

### 3.2 State Transition Guardrails & Audit Fields

| State | Allowed Transitions | Permitted Actor Roles | Invariant / Guardrail | Audit Fields Recorded |
|---|---|---|---|---|
| `draft` | $\to$ `reviewed` | Accountant, Center Admin, Platform Owner | Editable; sessions and adjustments can be recalculated. | `created_at` |
| `reviewed` | $\to$ `approved`, $\to$ `draft` | Center Admin, Platform Owner | Accountant confirmed attendance integrity. | `reviewed_by_user_id`, `reviewed_at` |
| `approved` | $\to$ `paid`, $\to$ `reviewed` | Center Admin, Platform Owner | **LOCKED**: Contractual rates, sessions, and amounts cannot be changed. | `approved_by_user_id`, `approved_at` |
| `paid` | None (Terminal) | Center Admin, Accountant | Disbursed from treasury; linked to cashier shift or disbursement receipt. | `paid_at`, `payment_method`, `disbursed_by_user_id` |

### 3.3 Teacher Advances & Financial Adjustments (السلف والاستقطاعات)

A teacher's monthly net payroll is calculated as:
$$\text{Gross Compensation} = \text{Center Subscription Earnings} + \text{Private Lessons Teacher Share}$$
$$\text{Net Payroll} = \text{Gross Compensation} + \text{Bonuses} - \text{Deductions} - \text{Settled Advances}$$

- **Teacher Advances (السلف)**: Cash advances taken by the teacher during the month. When disbursed, an advance record is created. Upon monthly payroll calculation, all unsettled advances for that month are aggregated and deducted, and marked as `settled`.
- **Bonuses (المكافآت والحوافز)**: Positive adjustments (e.g., student exam excellence, high retention reward).
- **Deductions (الخصومات والجزاءات)**: Negative adjustments (e.g., unexcused tardiness, classroom equipment damage).

---

## 4. UI & UX Architecture Specifications

### 4.1 Teacher Management View: `/center/[centerSlug]/teachers/page.tsx`

#### Layout & Visual Design
- **Theme**: Deep Navy sidebar (`bg-sidebar`), elevated soft cards (`bg-card border border-border`), Cairo font (`dir="rtl"`), Cyan accents (`text-brand-cyan-600`).
- **Header**:
  - Title: `شؤون المعلمين وأسعار التعاقد` (Teacher Affairs & Contractual Rates).
  - Subtitle: `إدارة هيئة التدريس، تحديد نماذج التسعير (سنتر / برايفت)، وضبط الأجر الثابت ونسب التقاسم.`
  - Actions: `إضافة معلم جديد` (Add Teacher - modal) for Center Admin.
- **Top Metrics Row (KPI Cards)**:
  1. إجمالي المعلمين النشطين (Active Teachers Count).
  2. مجموعات نظام السنتر (Center Subscription Groups Count).
  3. مجموعات نظام البرايفت (Private Lessons Groups Count).
  4. متوسط أجر الحصة للسنتر (Average Center Fixed Rate EGP).
- **Teachers Directory Table**:
  - Columns:
    1. **المعلم**: Avatar, Full Name, National ID, Phone.
    2. **المواد والمراحل**: Badges showing subject names and academic stages taught.
    3. **المجموعات النشطة**: Active groups count.
    4. **نموذج التعاقد السائد**: Badges for `نظام السنتر` (Cyan), `نظام البرايفت` (Purple), or `مزدوج` (Blue).
    5. **أسعار التعاقد الحالية**:
       - For Center: `20.00 ج.م / طالب` (Fixed Rate).
       - For Private: `70% معلم / 30% سنتر` (Split Percentage).
    6. **الحالة**: نشط / غير نشط badge.
    7. **الإجراءات**:
       - `تعديل أسعار التعاقد` (Edit Rates button - disabled/hidden if user is Teacher).
       - `كشف الحساب الشهري` (View Statement button $\to$ links to finance view filtered to this teacher).

#### Contractual Rates Configuration Modal
- Opened when clicking `تعديل أسعار التعاقد`.
- Select Group or Subject.
- Switch pricing model: `نظام السنتر` vs `نظام البرايفت`.
- If Center: Input `fixedRatePerStudent` in EGP.
- If Private: Input `teacherPercentage` (0-100%). Automatically computes `centerPercentage = 100 - teacherPercentage`.
- Dynamic badge: `نسبة التقاسم متطابقة بنسبة 100% دون تسريب كسور`.
- `effectiveFrom` date picker.
- Submit handler: Calls DAL `updateTeacherRate()`. If current user is not admin/accountant, receives HTTP 403 Forbidden with user-friendly Arabic alert.

---

### 4.2 Finance Hub: `/center/[centerSlug]/finance/page.tsx`

#### Role-Conditioned View Modes
The page inspects `currentUser.role`:
1. **Management Mode (`CENTER_ADMIN`, `PLATFORM_OWNER`, `ACCOUNTANT`)**:
   - Displays full 4-tab dashboard:
     - **Tab 1: كشوف مرتبات المعلمين (Teacher Payroll & Statements)**
     - **Tab 2: الفواتير والمقبوضات (Invoices & Receipts)**
     - **Tab 3: الخزينة ومناوبات الكاشير (Treasury & Cashier Shifts)**
     - **Tab 4: المصروفات والملازم (Expenses & Books Inventory)**
2. **Teacher Confidential Mode (`TEACHER`)**:
   - **Strictly isolated**: Only Tab 1 is displayed, permanently locked to `filter.teacherId === currentUser.id`.
   - Cannot see peer teachers, center total revenue, or center expenses.
   - Shows teacher's personal earnings, session attendance breakdown, settled advances, and printable statement button.

#### Tab 1: Teacher Payroll & Monthly Statements
- **Month / Year Filter Bar**:
  - Year selector (`2026`).
  - Month selector (`أكتوبر`, `نوفمبر`, etc.).
  - Teacher filter dropdown (`جميع المعلمين` or specific teacher).
  - Status filter dropdown (`الكل`, `مسودة`, `تمت المراجعة`, `معتمد`, `تم الصرف`).
  - Quick Action Buttons:
    - `حساب مرتبات الشهر آلياً` (Auto-calculate monthly payroll).
    - `تسجيل سلفة معلم` (Register advance modal).
    - `تصدير إجمالي CSV` (Export CSV).
- **Summary Metric Cards**:
  1. `إجمالي مستحقات السنتر`: Total Center Subscription compensation.
  2. `إجمالي حصة المعلمين (برايفت)`: Total Private Lessons teacher share (Invoiced vs Collected).
  3. `إجمالي السلف والخصومات`: Total settled advances & deductions.
  4. `صافي المرتبات المستحقة`: Total net payroll obligation.
- **Teacher Payroll Master Table**:
  - Table Columns:
    - اسم المعلم والمادة.
    - نموذج العمل (سنتر / برايفت / مزدوج).
    - الحصص المنفذة والمتوسط (e.g. `4 حصص | متوسط: 13.00 طالب`).
    - إجمالي المستحق المحسوب (Gross Compensation).
    - السلف المصروفة (Advances Settled - orange/red badge).
    - الحوافز والخصومات (Net Bonuses/Deductions).
    - صافي المرتب المستحق (Net Payroll - bold green text).
    - حالة الاعتماد (Badge: `draft` gray, `reviewed` blue, `approved` amber, `paid` emerald).
    - الإجراءات:
      - `كشف تفصيلي` (Detailed Statement modal).
      - `مراجعة` (Accountant review).
      - `اعتماد` (Admin approval).
      - `صرف` (Disburse payment).
      - `طباعة A4` (Print statement).
      - `تصدير CSV`.

---

### 4.3 Detailed Teacher Monthly Statement Modal (كشف الحساب الشهري المفصل)

When clicking `كشف تفصيلي`, a modal opens presenting the complete breakdown:
1. **Header**:
   - Official Yalla Center Logo + Center Name (`سنتر الماهر النموذجي`).
   - Teacher Name, Subject, Month / Year.
   - Statement Reference Code (`STMT-2026-10-MATH`).
   - Current Status Badge.
2. **Part A: Center Subscription Breakdown Table (مجموعات نظام السنتر)**:
   - Columns: اسم المجموعة, تواريخ الحصص المنفذة, عدد الحضور بكل حصة, الحصص الملغاة المستبعدة, متوسط الحضور, أجر الطالب التعاقدي, إجمالي المستحق.
3. **Part B: Private Lessons Breakdown Table (مجموعات نظام البرايفت)**:
   - Columns: اسم المجموعة, عدد الطلاب المقيدين, إجمالي الرسوم المقررة, الخصومات والمنح (100%), صافي الإيراد, نسبة المعلم (%), المستحق المفوتر, المحصل الفعلي, المتبقي طرف الطلاب.
4. **Part C: Financial Adjustments Table (السلف، الحوافز، والخصومات)**:
   - Table of all advances taken during the month with dates and vouchers.
   - Table of bonuses awarded.
   - Table of penalties/deductions.
5. **Part D: Financial Summary & Net Payout**:
   - Gross Compensation: $X$ EGP.
   - Total Advances: $-Y$ EGP.
   - Bonuses / Deductions: $\pm Z$ EGP.
   - **Net Payout (صافي المستحق للصرف)**: Large bold callout box with Arabic text representation (e.g., `فقط ألفان ومائتان وخمسون جنيهاً مصرياً لا غير`).
6. **Part E: Triple Signature Footer (التوقيعات الرسمية)**:
   - إعداد المحاسب (Prepared by Accountant).
   - اعتماد مدير السنتر (Approved by Center Admin).
   - استلام وتوقيع المعلم (Received & Acknowledged by Teacher).

---

### 4.4 Printable A4 Statement Export & CSV Utility

#### Printable A4 Layout Specifications
- Implemented with CSS `@media print` styling:
  - Page size: `A4 portrait`, `margin: 15mm`.
  - Hides navigation bars, sidebars, buttons, and theme toggles during print.
  - Official brand assets: `public/brand/yalla-center-logo-dark.png` top-left, Teacher Full Name & Code top-right.
  - Direction: `rtl`, Cairo font, crisp tabular borders.
  - Clean page-break rules preventing signature block detachment (`break-inside: avoid`).

#### CSV Export Specification (`exportPayrollToCSV`)
- Encoded with **UTF-8 BOM** (`\uFEFF`) ensuring Microsoft Excel displays Arabic characters without corruption.
- Filename format: `كشف_مرتبات_المعلمين_[الشهر]_[السنة].csv`.
- Columns:
  1. `كود المعلم` (Teacher Code)
  2. `اسم المعلم` (Teacher Name)
  3. `المادة` (Subject)
  4. `الشهر` (Month)
  5. `السنة` (Year)
  6. `الحصص المنفذة` (Conducted Sessions)
  7. `الحصص المستبعدة` (Excluded Canceled Sessions)
  8. `متوسط الحضور` (Average Attendance)
  9. `أجر الحصة للطالب` (Fixed Rate Per Student)
  10. `مستحقات السنتر` (Center Subscription Compensation)
  11. `مستحقات البرايفت (مفوتر)` (Private Lessons Invoiced Share)
  12. `مستحقات البرايفت (محصل)` (Private Lessons Collected Share)
  13. `إجمالي المستحقات` (Gross Compensation)
  14. `السلف المستقطعة` (Settled Advances)
  15. `الحوافز` (Bonuses)
  16. `الخصومات` (Deductions)
  17. `صافي الراتب` (Net Payroll Payout)
  18. `حالة الكشف` (Payroll Status)
  19. `المعتمد` (Approved By)
  20. `تاريخ الاعتماد` (Approved Date)

---

## 5. Data Access Layer (DAL) Architecture & Types Specification

### 5.1 New & Enhanced Types in `lib/dal/types.ts`

```typescript
export interface TeacherAdvance {
  id: string;
  tenantId: string;
  teacherId: string;
  amount: number;
  reason?: string;
  disbursedByUserId: string;
  paidAt: string;
  payrollId?: string; // set when settled into a monthly payroll
  status: 'pending' | 'settled';
  createdAt: string;
}

export interface TeacherMonthlyStatement {
  tenantId: string;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  subjectNames: string[];
  payrollMonth: number;
  payrollYear: number;
  
  // Center Subscription Breakdown
  centerSubscription: {
    groups: Array<{
      groupId: string;
      groupName: string;
      ratePerStudent: number;
      conductedSessionsCount: number;
      excludedSessionsCount: number;
      totalValidAttendance: number;
      averageAttendance: number;
      compensationAmount: number;
      sessions: Array<{
        sessionId: string;
        sessionDate: string;
        status: SessionStatus;
        validAttendanceCount: number;
      }>;
    }>;
    totalCompensation: number;
  };

  // Private Lessons Breakdown
  privateLessons: {
    groups: Array<{
      groupId: string;
      groupName: string;
      teacherPercentage: number;
      centerPercentage: number;
      enrolledCount: number;
      totalGrossInvoiced: number;
      totalDiscountAmount: number;
      totalNetRevenue: number;
      totalTeacherShare: number;
      totalCenterShare: number;
      totalCollected: number;
      totalCollectedTeacherShare: number;
      uncollectedTeacherBalance: number;
      roundingLeakage: number;
      items: Array<{
        enrollmentId: string;
        studentId: string;
        studentName: string;
        basePrice: number;
        discountType: DiscountType;
        discountValue: number;
        netRevenue: number;
        teacherShare: number;
        centerShare: number;
        collectedAmount: number;
      }>;
    }>;
    totalInvoicedTeacherShare: number;
    totalCollectedTeacherShare: number;
    totalCenterShare: number;
    totalRoundingLeakage: number;
  };

  // Adjustments Breakdown
  adjustments: {
    advances: TeacherAdvance[];
    totalAdvances: number;
    bonuses: Array<{ description: string; amount: number }>;
    totalBonuses: number;
    deductions: Array<{ reason: string; amount: number }>;
    totalDeductions: number;
  };

  // Summary
  summary: {
    grossCompensation: number;
    grossCollectedCompensation: number;
    totalAdvances: number;
    totalBonuses: number;
    totalDeductions: number;
    netPayrollInvoiced: number;
    netPayrollCollected: number;
    payrollRecord?: TeacherPayroll;
  };
}
```

### 5.2 Additions to `IDataProvider` in `lib/dal/index.ts`

```typescript
// Add to IDataProvider:
calculateMonthlyTeacherPayroll(params: {
  tenantId: string;
  teacherId: string;
  year: number;
  month: number;
}): Promise<TeacherMonthlyStatement>;

createOrUpdateTeacherPayroll(
  payroll: Partial<TeacherPayroll> & { tenantId: string; teacherId: string; payrollMonth: number; payrollYear: number },
  actorId: string,
  actorRole: UserRole
): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }>;

approveTeacherPayroll(
  payrollId: string,
  actorId: string,
  actorRole: UserRole
): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }>;

disburseTeacherPayroll(
  payrollId: string,
  paymentMethod: PaymentMethod,
  actorId: string,
  actorRole: UserRole
): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }>;

getTeacherAdvances(
  tenantId: string,
  filter?: { teacherId?: string; month?: number; year?: number; status?: 'pending' | 'settled' }
): Promise<TeacherAdvance[]>;

recordTeacherAdvance(params: {
  tenantId: string;
  teacherId: string;
  amount: number;
  reason?: string;
  disbursedByUserId: string;
}): Promise<TeacherAdvance>;
```

### 5.3 Initial Seed Data Enhancements in `lib/dal/mock-data.ts`

To empower rich interactive demonstration and automated testing out of the box, `INITIAL_SEEDED_DATA` should be seeded with:
1. **Teacher Rates**:
   - `rate-teacher-math`: `fixedRatePerStudent: 20.00`, `model: 'center'`, `subject: sub-math-3sec`.
   - `rate-teacher-phys`: `teacherPercentage: 70.00`, `centerPercentage: 30.00`, `model: 'private'`, `subject: sub-phys-3sec`.
2. **Sessions & Attendance**:
   - 4 conducted math sessions for October 2026 with valid attendance counts $[12, 15, 11, 14]$ and 1 canceled session. (Yields exactly Average 13.0, Compensation 260.00 EGP as mandated by AC-1).
3. **Private Lesson Enrollments**:
   - Student 1: 100 EGP gross, no discount $\to$ 70 Teacher / 30 Center.
   - Student 2: 100 EGP gross, 20% discount $\to$ 56 Teacher / 24 Center.
   - Student 3: 100 EGP gross, 100% scholarship $\to$ 0 Teacher / 0 Center. (Yields AC-2).
4. **Teacher Advances & Adjustments**:
   - Advance of 50.00 EGP disbursed to `user-teacher-math` on 2026-10-10.
5. **Sample Seeded Payroll Records**:
   - Math teacher October 2026: Gross 260.00 EGP, Advances 50.00 EGP, Net 210.00 EGP, Status `reviewed`.
   - Physics teacher October 2026: Gross 126.00 EGP, Net 126.00 EGP, Status `approved`.

---

## 6. Security Guardrails & RBAC Enforcement (AC-6)

### 6.1 Server-Side RBAC Enforcement
- Guardrails are centralized in `lib/security/rbac.ts`:
  - `validateTeacherRateUpdate(actor, targetTeacherId, rates)`:
    - If `actor.role === 'TEACHER'` $\implies$ returns HTTP 403 Forbidden (`Teachers cannot alter contractual salary rates or revenue-sharing percentages`).
    - Only `PLATFORM_OWNER`, `CENTER_ADMIN`, and `ACCOUNTANT` are authorized.
  - `validateTeacherStatementAccess(actor, targetTeacherId)`:
    - If `actor.role === 'TEACHER'` and `actor.id !== targetTeacherId` $\implies$ returns HTTP 403 Forbidden (`Teachers cannot access another teacher financial statements or payroll ledgers`).
    - Teacher accessing own statement $\implies$ HTTP 200 OK.
    - Admin/Accountant accessing statement $\implies$ HTTP 200 OK.

### 6.2 UI Defense-in-Depth
- If logged in as Teacher:
  - Rates edit buttons are hidden from the DOM.
  - Finance page does not render peer tabs or peer dropdowns.
  - Invoices and shift drawers are suppressed.

---

## 7. Step-by-Step Implementation Roadmap for Worker M3

| Step | Target File(s) | Action Description | Primary Artifacts |
|:---:|:---|:---|:---|
| **1** | `lib/finance/compensation.ts` | Verify fractional attendance rounding formula; ensure mathematical consistency with unrounded product. | `calculateCenterSubscriptionCompensation`, `calculatePrivateLessonsSplit` |
| **2** | `lib/dal/types.ts` | Add `TeacherAdvance` and `TeacherMonthlyStatement` interfaces; enhance `TeacherPayroll`. | Types declaration |
| **3** | `lib/dal/index.ts` | Declare new payroll, advance, and monthly statement methods on `IDataProvider`. | Contract interfaces |
| **4** | `lib/dal/mock-data.ts` | Implement new payroll calculation, approval, disbursement, and advance methods; populate seeded data. | `MockDataProvider` methods |
| **5** | `lib/finance/export.ts` | Implement UTF-8 BOM CSV generator and printable statement helper. | `exportPayrollToCSV`, `formatCurrencyEGP` |
| **6** | `app/center/[centerSlug]/teachers/page.tsx` | Implement full Teachers Directory with metrics, rate configuration modal, and RBAC guardrails. | Complete interactive UI |
| **7** | `app/center/[centerSlug]/finance/page.tsx` | Implement comprehensive Finance Hub with Tab 1 Teacher Payroll, detailed statement modal, approval workflow, and printable A4 view. | Complete interactive UI |
| **8** | `tests/unit/compensation.test.ts` & `tests/unit/payroll-workflow.test.ts` | Author adversarial unit and workflow tests for zero leakage, lifecycle states, and AC-1/AC-2/AC-6. | Test suites |
| **9** | Build & Verification | Run `npx vitest run` and `npm run build` to verify 100% test pass and zero TypeScript errors. | Verification |

---

## 8. Adversarial Test Cases & Verification Suite for Worker M3

### 8.1 Test Matrix

| # | Test Scenario | Input Vector | Expected Output / Invariant | Governing Requirement |
|:---:|:---|:---|:---|:---:|
| **T1** | Center Subscription Standard 4-Class AC-1 | Sessions: $[12, 15, 11, 14]$, Rate: 20 EGP | Conducted: 4, Avg: 13.00, Total: 260.00 EGP | AC-1, FEAT-18 |
| **T2** | Center Subscription Canceled Session Exclusion | 4 completed $[12, 15, 11, 14]$ + 2 canceled sessions | Conducted: 4, Excluded: 2, Total: 260.00 EGP | AC-1, FEAT-18 |
| **T3** | Zero Conducted Division-by-Zero Guardrail | 0 conducted sessions (empty or all canceled) | Conducted: 0, Avg: 0.00, Total: 0.00, No NaN | AC-1, FEAT-18 |
| **T4** | Negative Fixed Rate Error | Rate: -20 EGP | Throws "cannot be negative" error | Domain invariant |
| **T5** | Private Lessons 70/30 Split AC-2 | Price: 100 EGP, Discount: None, 70/30 split | Teacher: 70.00, Center: 30.00, Sum == 100.00 | AC-2, FEAT-19 |
| **T6** | Private Lessons 20% Discount AC-2 | Price: 100 EGP, 20% discount, 70/30 split | Net: 80.00, Teacher: 56.00, Center: 24.00, Sum == 80.00 | AC-2, FEAT-19 |
| **T7** | Private Lessons 100% Scholarship AC-2 | Price: 100 EGP, 100% scholarship, 70/30 split | Net: 0.00, Teacher: 0.00, Center: 0.00, Sum == 0.00 | AC-2, FEAT-17, FEAT-19 |
| **T8** | Fixed Discount Larger than Price | Price: 50 EGP, Fixed Discount: 80 EGP | Net: 0.00, Teacher: 0.00, Center: 0.00 | Boundary invariant |
| **T9** | Zero Rounding Leakage Monte-Carlo | 10,000 random adversarial combinations | $\forall i: \text{teacherShare} + \text{centerShare} \equiv \text{netRevenue}$, leakage == 0.00 | AC-2, FEAT-19 |
| **T10** | Dual Invoiced vs Collected Tracking | Invoiced: 100 EGP, Collected: 40 EGP (70/30 split) | Invoiced Teacher: 70.00, Collected Teacher: 28.00, Uncollected: 42.00 | FEAT-20 |
| **T11** | Payroll Approval State Lifecycle | `draft` $\to$ `reviewed` $\to$ `approved` $\to$ `paid` | State transitions strictly enforced; audit fields recorded | FEAT-21 |
| **T12** | Teacher Rates Update Lockout AC-6 | Teacher actor attempts to modify fixed rate | HTTP 403 Forbidden | AC-6, FEAT-11 |
| **T13** | Peer Financial Privacy Lockout AC-6 | Teacher Zaid attempts to view Teacher Amr statement | HTTP 403 Forbidden | AC-6 |
| **T14** | Own Financial Statement Access AC-6 | Teacher Zaid views own statement | HTTP 200 OK | AC-6 |
| **T15** | CSV Export UTF-8 BOM Integrity | Generate CSV string | Starts with `\uFEFF`, Arabic column headers intact | FEAT-21 |

---

## 9. Conclusion

The Dual Teacher Compensation Engine and Payroll Approval System represents a cornerstone of Yalla Center's operational integrity. With strict zero-division safeguards, continuous mathematical zero-rounding leakage guarantees, multi-role state machine transitions, and airtight RBAC barriers, Worker M3 has a comprehensive, robust architectural blueprint to execute Milestone 3 with flawless quality.
