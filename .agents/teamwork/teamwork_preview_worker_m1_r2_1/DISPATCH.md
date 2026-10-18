## 2026-10-18T02:24:31Z
You are Worker M1-R2 for Milestone 1 (Foundation, Brand Design System & Core Database Schema) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_r2_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).

Read the Iteration 2 Explorer reports before implementing:
1. Guardrail Explorer Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r2_1\m1_r2_guardrail_report.md`
2. Schema Trigger Explorer Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r2_2\m1_r2_schema_report.md`
3. Regression Explorer Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r2_3\m1_r2_regression_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. `lib/dal/mock-data.ts`:
   - Line 766: Fix the protected fields check. Change from:
     ```ts
     const attemptedAdminEdits = protectedFields.filter(
       (field) => updates[field] !== undefined && updates[field] !== targetUser[field]
     );
     ```
     to:
     ```ts
     const attemptedAdminEdits = protectedFields.filter(
       (field) => updates[field] !== undefined
     );
     ```
   - Expand `protectedFields` list to explicitly cover all administrative, academic, and contact fields:
     `'fullName', 'full_name', 'role', 'studentCode', 'student_code', 'balanceDue', 'balance_due', 'stage', 'grade', 'division', 'seatNumber', 'seat_number', 'phone', 'guardianPhone', 'guardian_phone', 'email', 'nationalId', 'national_id', 'isActive', 'is_active', 'tenantId', 'tenant_id'`.
   - In `updateTeacherRate`: enforce that only administrative roles (`PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`) can modify teacher rates; teachers, students, parents, receptionists are rejected with status 403 Forbidden.
2. `lib/supabase/schema.sql`:
   - Enhance `enforce_self_profile_update_guardrail()` procedure and `trg_enforce_user_guardrail` trigger to cover all non-permitted columns (`full_name`, `student_code`, `stage`, `grade`, `division`, `seat_number`, `balance_due`, `role`, `tenant_id`, `is_active`, `phone`, `guardian_phone`, `guardian_name`, `email`, `national_id`).
   - Ensure foreign key declarations are ordered properly (e.g. `cashier_shifts` before `payments.cashier_shift_id`).
3. Verification:
   - Run `npm run test` and verify that all test files pass (100% pass rate, exit code 0).
   - Run `npx tsc --noEmit` and `npm run lint` (exit code 0).
   - Run `npm run build` (exit code 0).
4. Record exact verification outputs and write your complete handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_r2_1\handoff.md`.
Notify the orchestrator via send_message when complete.
