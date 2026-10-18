## 2026-10-18T05:44:58Z
You are Worker M3 for Milestone 3 (Student Enrollment & Dual Teacher Compensation Engine) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m3_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Read the three Explorer M3 reports before implementing:
1. Student Enrollment Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_1\m3_enrollment_report.md`
2. Dual Compensation Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_2\m3_compensation_report.md`
3. Financial Operations Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_3\m3_finance_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. Domain Engines & Math:
   - Implement `lib/finance/discounts.ts`: `calculateDiscount(basePrice, discountType, discountValue)` supporting `NONE`, `PERCENT`, `FIXED`, `SCHOLARSHIP_100`. Invariants: discount <= basePrice, netPrice >= 0, zero rounding leakage.
   - Enhance `lib/timetable/conflict-detector.ts`: Add `checkStudentEnrollmentConflict(candidateGroup, studentActiveGroups, currentEnrolledCount)` enforcing interval collision $(s_1 < e_2) \land (s_2 < e_1)$, zero-gap allowance, and capacity overflow checks.
   - Refine `lib/finance/compensation.ts`: Ensure `calculateCenterSubscriptionCompensation` uses unrounded average for total compensation multiplication (`Math.round(rawAverage * ratePerStudent * 100) / 100`) while preserving existing tests and zero leakage in `calculatePrivateLessonsSplit`.
2. Data Access Layer & Types:
   - Update `lib/dal/types.ts`: Add interfaces `TeacherMonthlyStatement`, `TeacherAdvance`, `CashierShift` extensions if needed.
   - Update `lib/dal/index.ts` & `lib/dal/mock-data.ts`:
     - Implement `createStudent`, `enrollStudent`, `unenrollStudent`, `getStudentEnrollmentDetails`, `getStudentAttendanceHistory`.
     - Implement `createInvoice`, `getPayments`, `getActiveCashierShift`, `openCashierShift`, `closeCashierShift`, `recordExpense`.
     - Implement `calculateMonthlyTeacherPayroll`, `approveTeacherPayroll`, `disburseTeacherPayroll`, `recordTeacherAdvance`.
     - Enhance `recordPayment` to update invoice `paidAmount` & `status`, decrement student `balanceDue`, and update active cashier shift's `cashCollected` / `digitalCollected` and `expectedCash`.
3. User Interface Pages:
   - Implement `app/center/[centerSlug]/students/page.tsx`:
     - 4 KPI summary cards (Total Students, Active Enrollments, Overdue Tuition, Total Balance Due).
     - Search & multi-filter for Egyptian stages (`primary`, `preparatory`, `secondary`), grades (`1`, `2`, `3`), divisions (`general`, `scientific`, `literary`), and payment statuses.
     - Student table with avatar, studentCode, full details, and action buttons.
     - `StudentRegistrationModal`: intake form with auto-generated studentCode (`STD-100X`).
     - `StudentDetailDrawer`: 3 tabs: Enrolled Groups (with unenroll), Attendance History, and Financial Ledger.
     - `GroupEnrollmentModal`: Group selector with live Preflight Conflict Radar HUD and pricing breakdown.
     - `StudentIdCardModal`: Official printable Student ID Card with Cairo typography, logo, and Code 128 barcode SVG.
   - Implement `app/center/[centerSlug]/teachers/page.tsx`:
     - Teacher directory with subject, groups count, students count, and compensation model badge.
     - `TeacherRateModal`: Configure Center fixed rate per student and Private split % (validating teacher% + center% === 100%).
     - AC-6 Security lockout: Teacher role viewing page sees only read-only view.
   - Implement `app/center/[centerSlug]/finance/page.tsx`:
     - 5 Operational Tabs:
       1. الورديات والخزينة (Cashier Shifts & Drawer HUD, Open Shift modal, Close Shift modal with discrepancy detection).
       2. الفواتير والمطالبات (Student Invoices table, status badges, issue invoice modal).
       3. إيصالات السداد والمقبوضات (Payment Receipts Ledger, Record Payment modal, Printable Receipt Voucher modal with `BrandLogo theme="light"` and Tafqeet Arabic words).
       4. حسابات وكشوف المعلمين (Teacher Payroll & Dual Compensation breakdown, approve payroll, view/print monthly statement modal, UTF-8 BOM CSV export).
       5. المصروفات وجرد الكتب (Expenses ledger & books inventory).
4. Tests:
   - Implement unit and integration tests covering:
     - `tests/unit/discounts.test.ts`: test all discount types, overflow bounds, and zero leakage.
     - `tests/unit/student-enrollment-conflict.test.ts`: test student enrollment time collisions, zero-gap allowance, and group capacity limits.
     - `tests/unit/cashier-shifts.test.ts`: test shift opening float, cash vs digital collection, drawer variance on close.
     - `tests/integration/student-invoicing-flow.test.ts`: test enrollment -> invoice creation -> partial payment -> balance reduction -> receipt voucher.
5. Verification Gates:
   - Run `npx tsc --noEmit` and confirm exit code 0 (zero errors).
   - Run `npm run test` and confirm all test suites pass with 100% pass rate (exit code 0).
   - Run `npm run lint` and confirm exit code 0.
   - Run `npm run build` and confirm clean Next.js production build with exit code 0.
6. Write your complete handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m3_1\handoff.md`.
Notify the orchestrator via send_message when complete.
