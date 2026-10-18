## 2026-10-18T05:36:08Z
You are Explorer M3-2 (Dual Compensation & Payroll Engine Explorer) for Milestone 3 of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_2
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Your mission for Milestone 3 (Student Enrollment & Dual Teacher Compensation Engine):
1. Explore the Dual Teacher Compensation Engine (FEAT-17, FEAT-18, FEAT-20):
   - Inspect existing implementation in `lib/finance/compensation.ts`.
   - Center Subscription (نظام السنتر) formula:
     Average Attendance = (Sum of Valid Attendance) / (N conducted sessions, excluding canceled).
     Total Compensation = Average Attendance * Contractual Fixed Rate.
     Safe zero division when N conducted = 0.
   - Private Lessons (نظام البرايفت) formula:
     Net revenue split: Teacher Share + Center Share === Net Revenue (PROVES ZERO ROUNDING LEAKAGE).
   - Teacher Payroll Approval & Monthly Statement Workflow:
     Reviewing monthly session attendance, calculating monthly payroll breakdown, approving payroll, generating monthly statements with printable/CSV export.
2. Inspect teacher management view at `/center/[centerSlug]/teachers` and finance view at `/center/[centerSlug]/finance`.
3. Design complete UI workflows, financial calculations, export utilities, and DAL methods for Worker M3.
4. Formulate the exact implementation plan and adversarial test cases for zero leakage and payroll integrity.
5. Write your complete findings report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m3_2\m3_compensation_report.md`
and write a standard handoff report `handoff.md` in your working directory.
Notify the orchestrator via send_message when complete.
