# Milestone 1 (M1-R2) Handoff Report: Schema Trigger & Guardrail Deep-Dive

**Agent ID**: Explorer M1-R2-2 (Schema Trigger Explorer)  
**Project**: Yalla Center SaaS Platform  
**Target Milestone**: Milestone 1 (Foundation, Brand Design System & Core Database Schema)  
**Date**: 2026-10-18  
**Working Directory**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r2_2`  
**Handoff Type**: Hard (Investigation Complete)  

---

## 1. Observation

1. **Trigger & Procedure Presence in `lib/supabase/schema.sql` (Lines 486–515)**:
   - Direct inspection of `lib/supabase/schema.sql` confirmed the presence of `enforce_self_profile_update_guardrail()` procedure and `trg_enforce_user_guardrail` trigger:
     ```sql
     CREATE OR REPLACE FUNCTION enforce_self_profile_update_guardrail()
     RETURNS TRIGGER AS $$
     BEGIN
       -- If actor role is STUDENT or TEACHER
       IF (OLD.role IN ('STUDENT', 'TEACHER')) THEN
         IF (
           NEW.full_name IS DISTINCT FROM OLD.full_name OR
           NEW.student_code IS DISTINCT FROM OLD.student_code OR
           NEW.stage IS DISTINCT FROM OLD.stage OR
           NEW.grade IS DISTINCT FROM OLD.grade OR
           NEW.division IS DISTINCT FROM OLD.division OR
           NEW.seat_number IS DISTINCT FROM OLD.seat_number OR
           NEW.balance_due IS DISTINCT FROM OLD.balance_due OR
           NEW.role IS DISTINCT FROM OLD.role OR
           NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
           NEW.is_active IS DISTINCT FROM OLD.is_active
         ) THEN
           RAISE EXCEPTION 'Security Violation: Students and Teachers are strictly permitted to update ONLY their profile photo (avatar_url).'
             USING ERRCODE = '42501'; -- HTTP 403 Forbidden equivalent in SQLSTATE
         END IF;
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER trg_enforce_user_guardrail
       BEFORE UPDATE ON users
       FOR EACH ROW
       EXECUTE FUNCTION enforce_self_profile_update_guardrail();
     ```
   - Trigger timing: `BEFORE UPDATE ON users FOR EACH ROW`.
   - Error code raised: `USING ERRCODE = '42501'`.

2. **Column Inventory and Guardrail Gap on Table `users` (Lines 86–107)**:
   - Table `users` contains 19 columns:
     `id`, `tenant_id`, `role`, `full_name`, `email`, `phone`, `avatar_url`, `student_code`, `national_id`, `stage`, `grade`, `division`, `seat_number`, `guardian_name`, `guardian_phone`, `balance_due`, `is_active`, `created_at`, `updated_at`.
   - The trigger condition checks only 10 columns: `full_name`, `student_code`, `stage`, `grade`, `division`, `seat_number`, `balance_due`, `role`, `tenant_id`, and `is_active`.
   - The trigger **omits** 7 non-permitted columns:
     - `guardian_phone` (Critical: student can modify guardian contact to circumvent parent notifications).
     - `phone` (Login / communication contact).
     - `email` (Contact / authentication identifier).
     - `national_id` (Official identity record).
     - `guardian_name` (Guardian identity record).
     - `id` (Primary key).
     - `created_at` (Audit record timestamp).

3. **Actor Scoping Defect in Trigger (Line 490)**:
   - Line 490 tests `IF (OLD.role IN ('STUDENT', 'TEACHER'))`.
   - `OLD.role` evaluates the role of the *target row* being modified, not the *calling actor*.
   - A `CENTER_ADMIN` or `BRANCH_MANAGER` executing an UPDATE on a student's row will trigger this exception unless executing with a role check or bypassing triggers via service role.

4. **Table Constraints & Normalization (22 Tables)**:
   - All 22 tables are defined with UUID primary keys (`gen_random_uuid()`).
   - Attendance idempotency invariant (AC-7) is present in `attendance` (line 193):
     `CONSTRAINT unique_session_student_attendance UNIQUE (session_id, student_id)`.
   - Other critical unique constraints:
     - `tenants`: `slug UNIQUE NOT NULL` (line 44).
     - `users`: `CONSTRAINT unique_student_code_per_tenant UNIQUE (tenant_id, student_code)` (line 106).
     - `enrollments`: `CONSTRAINT unique_student_group_enrollment UNIQUE (student_id, group_id)` (line 176).
     - `invoices`: `CONSTRAINT unique_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)` (line 214).
     - `payments`: `CONSTRAINT unique_receipt_number_per_tenant UNIQUE (tenant_id, receipt_number)` (line 232).
     - `teacher_payroll`: `CONSTRAINT unique_teacher_monthly_payroll UNIQUE (tenant_id, teacher_id, payroll_month, payroll_year)` (line 273).
     - `exam_submissions`: `CONSTRAINT unique_student_exam_attempt UNIQUE (exam_id, student_id)` (line 349).
   - Foreign key sequencing gap: Table `payments` (line 225) defines `cashier_shift_id UUID` without `REFERENCES cashier_shifts(id)` because `cashier_shifts` is created later (Table 20, line 386).

5. **Composite & Single-Column Indexes (Lines 436–463)**:
   - 27 explicit performance indexes covering tenant scoping, student barcode lookups, attendance scanning, session schedules, and exam hierarchy.

6. **Row Level Security (RLS) Policies (Lines 520–618)**:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` is present for all 22 tables.
   - `users_admin_update_policy` (line 581) permits updates only for `PLATFORM_OWNER`, `CENTER_ADMIN`, and `BRANCH_MANAGER`.
   - There is NO policy granting `UPDATE` permissions on `users` for authenticated students or teachers to update their own `avatar_url`.

7. **Test Suite Status**:
   - `npm run test` was executed and completed with exit code `0`: 13 test files passed, 114 tests passed (including `tests/security/challenger-m1-empirical.test.ts` with 20/20 passed tests).

---

## 2. Logic Chain

1. **Trigger Presence vs. Functional Completeness**:
   - Observation 1 confirmed the procedure and trigger exist in `schema.sql`.
   - However, Observation 2 proved that 7 columns (`guardian_phone`, `phone`, `email`, `national_id`, `guardian_name`, `id`, `created_at`) are omitted from the trigger's `IS DISTINCT FROM` condition.
   - Requirement R2 states: *"Students and teachers can upload and update only their own profile photo; all administrative data... is strictly read-only"*.
   - Mission Goal 3 requires verifying that the trigger raises SQLSTATE 42501 when *any column other than `avatar_url` or `updated_at` is altered*.
   - Because changing `guardian_phone` does not trigger SQLSTATE 42501, the database layer currently permits students to tamper with parent contact numbers, breaking the security guarantee.
   - Therefore, the trigger requires an update to include all remaining columns.

2. **Trigger Calling Actor Scoping**:
   - Observation 3 showed that line 490 evaluates `OLD.role` rather than `current_user_role()`.
   - If an administrator updates a student's `grade`, `OLD.role` is `'STUDENT'`, causing the trigger to block administrative updates.
   - Therefore, scoping with `COALESCE(current_user_role(), OLD.role::text) IN ('STUDENT', 'TEACHER')` is necessary.

3. **RLS Policy Completeness**:
   - Observation 6 showed that `users` has RLS enabled but only provides an UPDATE policy for administrative roles.
   - In Supabase, if RLS is enabled and no policy allows UPDATE for a student/teacher role on their own row, any direct UPDATE by that user is denied by RLS before triggers are even evaluated.
   - Therefore, `users_self_profile_update_policy` must be added.

4. **Foreign Key Integrity**:
   - Observation 4 showed `cashier_shift_id UUID` lacks a foreign key constraint.
   - Adding `ALTER TABLE payments ADD CONSTRAINT fk_payments_cashier_shift FOREIGN KEY (cashier_shift_id) REFERENCES cashier_shifts(id) ON DELETE SET NULL;` resolves this dangling reference.

---

## 3. Caveats

1. **Test Suite Current Expectations**:
   - `tests/security/challenger-m1-empirical.test.ts` lines 55–71 explicitly checks that the 10 existing columns (`full_name`, `student_code`, `stage`, `grade`, `division`, `seat_number`, `balance_due`, `role`, `tenant_id`, `is_active`) are present in the trigger function using regex matches.
   - Expanding the trigger function to include the 7 missing columns (`guardian_phone`, `phone`, `email`, `national_id`, `guardian_name`, `id`, `created_at`) is strictly additive and will not break the existing test assertions.
2. **Offline/Mock Execution**:
   - The current application utilizes `MockDataProvider` for offline execution. The SQL schema changes affect live Supabase PostgreSQL deployments (Milestone 2+), while the mock DAL condition in `lib/dal/mock-data.ts:766` handles the in-memory emulation.

---

## 4. Conclusion

The schema `lib/supabase/schema.sql` satisfies 3NF normalization, contains all 22 tables, critical unique constraints (specifically `UNIQUE (session_id, student_id)` on `attendance`), and 27 composite indexes.

However, three key improvements are required for Worker M1:
1. **Trigger Column Expansion**: Add the 7 omitted columns (`guardian_phone`, `phone`, `email`, `national_id`, `guardian_name`, `id`, `created_at`) to `enforce_self_profile_update_guardrail()` so that any non-avatar update raises SQLSTATE 42501.
2. **Trigger Actor Scoping**: Scope the role check to `COALESCE(current_user_role(), OLD.role::text) IN ('STUDENT', 'TEACHER')` so that center administrators can update student records.
3. **Add Self-Update RLS Policy**: Add `users_self_profile_update_policy` allowing `auth.uid() = id` self-updates on `users` when actor role is `STUDENT` or `TEACHER`.
4. **Link `payments.cashier_shift_id`**: Add the missing foreign key constraint to `cashier_shifts(id)`.

A full report with drop-in code snippets has been written to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r2_2\m1_r2_schema_report.md`.

---

## 5. Verification Method

To independently verify all observations and test results:

1. **Verify Trigger & Procedure in Schema**:
   ```powershell
   Select-String -Path lib/supabase/schema.sql -Pattern "enforce_self_profile_update_guardrail"
   Select-String -Path lib/supabase/schema.sql -Pattern "trg_enforce_user_guardrail"
   ```

2. **Verify Attendance Idempotency Constraint**:
   ```powershell
   Select-String -Path lib/supabase/schema.sql -Pattern "unique_session_student_attendance"
   ```

3. **Verify Omitted Columns in Trigger**:
   ```powershell
   Select-String -Path lib/supabase/schema.sql -Pattern "guardian_phone"
   ```
   *Expected*: Found on table `users` definition (line 101), but absent between lines 486 and 510.

4. **Execute Full Test Suite**:
   ```powershell
   npm run test
   ```
   *Expected*: 13 test files passed, 114 passed tests, exit code 0.
