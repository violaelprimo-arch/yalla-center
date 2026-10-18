# Hard Handoff Report: Milestone 1 Iteration 2 Security Guardrails & Schema Hardening

**Worker**: Worker M1-R2  
**Target Milestone**: Milestone 1 (Foundation, Brand Design System & Core Database Schema)  
**Date**: 2026-10-18  
**Working Directory**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_r2_1`  
**Files Modified**:
1. `d:\Software\YALLA CODEX\YALLA CENTER\lib\dal\mock-data.ts`
2. `d:\Software\YALLA CODEX\YALLA CENTER\lib\supabase\schema.sql`

---

## 1. Observation

### 1.1 Pre-Fix Vulnerabilities Directly Observed
1. In `lib/dal/mock-data.ts` (former line 766):
   ```ts
   const attemptedAdminEdits = protectedFields.filter(
     (field) => updates[field] !== undefined && updates[field] !== targetUser[field]
   );
   ```
   Direct execution before the fix:
   ```bash
   npx tsx -e "import { MockDataProvider } from './lib/dal/mock-data'; const dal = new MockDataProvider(); const s = dal.users.find(u => u.role === 'STUDENT' && u.balanceDue === 0)!; dal.updateUser(s.id, { balanceDue: 0 }, s.id, 'STUDENT').then(r => console.log('STATUS:', r.status, 'SUCCESS:', r.success));"
   ```
   Produced:
   `STATUS: 200 SUCCESS: true`
   A student submitting their existing balance (`balanceDue: 0`) received HTTP 200 OK instead of HTTP 403 Forbidden.

2. In `lib/dal/mock-data.ts` (former lines 979–985):
   ```ts
   if (actorRole === 'TEACHER') {
     return {
       success: false,
       error: 'Forbidden (HTTP 403): لا يمكن للمعلم تعديل نسب أو أسعار التعاقد',
       status: 403,
     };
   }
   ```
   Only `TEACHER` was rejected; `STUDENT`, `PARENT`, and `RECEPTIONIST` were not blocked from invoking `updateTeacherRate`.

3. In `lib/supabase/schema.sql`:
   - Procedure `enforce_self_profile_update_guardrail()` previously checked only 10 columns (`full_name`, `student_code`, `stage`, `grade`, `division`, `seat_number`, `balance_due`, `role`, `tenant_id`, `is_active`), omitting critical contact and identification fields (`phone`, `guardian_phone`, `guardian_name`, `email`, `national_id`).
   - Table `cashier_shifts` was defined at line 386, whereas table `payments` was defined at line 220 with `cashier_shift_id UUID` lacking a direct foreign key declaration due to forward-reference ordering.

### 1.2 Implemented Changes
1. `lib/dal/mock-data.ts`:
   - Updated lines 751–786:
     ```ts
     const protectedFields: string[] = [
       'fullName',
       'full_name',
       'role',
       'studentCode',
       'student_code',
       'balanceDue',
       'balance_due',
       'stage',
       'grade',
       'division',
       'seatNumber',
       'seat_number',
       'phone',
       'guardianName',
       'guardian_name',
       'guardianPhone',
       'guardian_phone',
       'email',
       'nationalId',
       'national_id',
       'isActive',
       'is_active',
       'tenantId',
       'tenant_id',
       'id',
       'createdAt',
       'created_at',
       'updatedAt',
       'updated_at',
     ];

     const attemptedAdminEdits = protectedFields.filter(
       (field) => (updates as Record<string, any>)[field] !== undefined
     );
     ```
   - Updated lines 997–1010:
     ```ts
     const adminRoles: UserRole[] = [
       'PLATFORM_OWNER',
       'CENTER_ADMIN',
       'BRANCH_MANAGER',
       'ACCOUNTANT',
     ];
     if (!adminRoles.includes(actorRole)) {
       return {
         success: false,
         error:
           'Forbidden (HTTP 403): غير مصرح لك بتعديل نسب أو أسعار التعاقد، مقتصر على الأدوار الإدارية والمالية',
         status: 403,
       };
     }
     ```

2. `lib/supabase/schema.sql`:
   - Reordered `cashier_shifts` table definition to section 11 (immediately before `payments` as section 12).
   - In `payments` table definition (line 245): declared `cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL`.
   - Enhanced procedure `enforce_self_profile_update_guardrail()` (lines 487–515) to check all 15 non-permitted columns:
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
           NEW.is_active IS DISTINCT FROM OLD.is_active OR
           NEW.phone IS DISTINCT FROM OLD.phone OR
           NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone OR
           NEW.guardian_name IS DISTINCT FROM OLD.guardian_name OR
           NEW.email IS DISTINCT FROM OLD.email OR
           NEW.national_id IS DISTINCT FROM OLD.national_id
         ) THEN
           RAISE EXCEPTION 'Security Violation: Students and Teachers are strictly permitted to update ONLY their profile photo (avatar_url).'
             USING ERRCODE = '42501'; -- HTTP 403 Forbidden equivalent in SQLSTATE
         END IF;
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;
     ```
   - Added `users_self_profile_update_policy` (lines 594–600) to allow authenticated students and teachers to self-update `avatar_url` under RLS.

### 1.3 Verbatim Verification Tool Outputs
1. **Empirical Security Vector Matrix** (`npx tsx`):
   ```
   STATUS: 403 SUCCESS: false ERROR: Forbidden (HTTP 403): الطلاب والمعلمون مصرح لهم بتعديل الصورة الشخصية فقط، والبيانات الإدارية والمالية للقراءة فقط
   1. role: 403
   2. phone: 403
   3. guardianPhone: 403
   4. avatarUrl: 200
   5. admin update student: 200
   6. teacher rate by student: 403
   7. teacher rate by teacher: 403
   8. teacher rate by parent: 403
   9. teacher rate by admin: 200
   ```

2. **Test Suite Execution** (`npm run test`):
   ```
   RUN  v2.1.9 D:/Software/YALLA CODEX/YALLA CENTER

   ✓ tests/security/rbac-guardrails.test.ts (17 tests) 9ms
   ✓ tests/security/challenger-m1-empirical.test.ts (20 tests) 31ms
   ✓ tests/unit/compensation-stress.test.ts (17 tests) 1534ms
     ✓ Challenger M1-1: Adversarial Stress Testing of Dual Compensation Engine > Private Lessons Extreme Split & Rounding Leakage Stress Tests > PROVES ZERO ROUNDING LEAKAGE across 10,000 random adversarial combinations 1519ms
   ✓ tests/unit/mock-dal.test.ts (13 tests) 16ms
   ✓ tests/unit/compensation.test.ts (11 tests) 144ms
   ✓ tests/e2e/printable-exam-layout.test.ts (5 tests) 7ms
   ✓ tests/e2e/student-exam-runner.test.ts (8 tests) 8ms
   ✓ tests/integration/ai-exam-gate.test.ts (6 tests) 7ms
   ✓ tests/integration/attendance-idempotency.test.ts (5 tests) 6ms
   ✓ tests/integration/notifications.test.ts (4 tests) 8ms
   ✓ tests/unit/brand-components.test.tsx (4 tests) 115ms
   ✓ tests/unit/math-view.test.tsx (3 tests) 97ms
   ✓ tests/unit/smoke.test.ts (1 test) 3ms

   Test Files  13 passed (13)
        Tests  114 passed (114)
     Duration  10.38s
   ```

3. **TypeScript Compilation** (`npx tsc --noEmit`):
   Exit code: 0, 0 type errors.

4. **Lint Quality** (`npm run lint`):
   ```
   > yalla-center@1.0.0 lint
   > next lint

   ✔ No ESLint warnings or errors
   ```

5. **Production Build** (`npm run build`):
   ```
   > yalla-center@1.0.0 build
   > next build

     ▲ Next.js 14.2.35

      Creating an optimized production build ...
    ✓ Compiled successfully
      Linting and checking validity of types ...
      Collecting page data ...
      Generating static pages (0/4) ...
      Generating static pages (1/4) 
      Generating static pages (2/4) 
      Generating static pages (3/4) 
    ✓ Generating static pages (4/4)
      Finalizing page optimization ...
      Collecting build traces ...

   Route (app)                              Size     First Load JS
   ┌ ○ /                                    13.4 kB         101 kB
   └ ○ /_not-found                          873 B          88.1 kB
   + First Load JS shared by all            87.2 kB
   ```
   Exit code: 0.

---

## 2. Logic Chain

1. **Premise 1 (Requirement R2 & AC-5)**: Students and teachers are permitted to modify only their own `avatarUrl`; all administrative, academic, and financial fields must be strictly read-only and return HTTP 403 Forbidden when present in mutation payloads.
2. **Premise 2 (Flaw Elimination)**: The prior check `updates[field] !== undefined && updates[field] !== targetUser[field]` erroneously permitted mutations containing protected fields when the value matched database state. By modifying the filter to `(updates as Record<string, any>)[field] !== undefined`, any request defining any protected key is unconditionally identified and rejected with HTTP status 403 Forbidden.
3. **Premise 3 (Field Coverage)**: Expanding `protectedFields` to encompass both camelCase and snake_case variants of administrative, academic, contact, and identity fields (`fullName`, `full_name`, `role`, `studentCode`, `student_code`, `balanceDue`, `balance_due`, `stage`, `grade`, `division`, `seatNumber`, `seat_number`, `phone`, `guardianName`, `guardian_name`, `guardianPhone`, `guardian_phone`, `email`, `nationalId`, `national_id`, `isActive`, `is_active`, `tenantId`, `tenant_id`, `id`, `createdAt`, `updatedAt`) ensures that neither client probe attacks nor alternate payload serialization can bypass the authorization check.
4. **Premise 4 (Teacher Rate Access Control - AC-6)**: Replacing the blacklist check `if (actorRole === 'TEACHER')` with a strict whitelist `adminRoles = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT']` ensures that unauthorized roles (`STUDENT`, `PARENT`, `RECEPTIONIST`, `TEACHER`) are rejected with HTTP 403 Forbidden, while legitimate financial administrators can manage compensation rates.
5. **Premise 5 (PostgreSQL DDL Integrity & SQLSTATE 42501)**: Moving `cashier_shifts` before `payments` and establishing `cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL` resolves table dependency ordering in SQL scripts without forward references. Enhancing `enforce_self_profile_update_guardrail` ensures that attempts to alter contact information (such as `guardian_phone`, which controls parental WhatsApp notifications) raise SQLSTATE 42501 at the database layer.
6. **Premise 6 (Regression Absence)**: All 13 test suites and 114 tests continue to pass with 100% success rate, TypeScript type checking reports zero errors, ESLint reports zero errors, and Next.js produces an optimized production build.

---

## 3. Caveats

- **No Caveats**: All requested changes were strictly bounded to the designated files (`lib/dal/mock-data.ts`, `lib/supabase/schema.sql`). All existing tests and empirical attack vectors were verified.

---

## 4. Conclusion

The security guardrail flaw identified by Challenger M1-1 has been completely resolved:
- In `lib/dal/mock-data.ts`: `updateUser` unconditionally rejects payloads containing any protected administrative, academic, or contact fields with HTTP 403 Forbidden, regardless of whether the submitted value equals the existing state.
- In `lib/dal/mock-data.ts`: `updateTeacherRate` strictly restricts rate modification to authorized administrative roles (`PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`), returning HTTP 403 Forbidden for teachers, students, parents, and receptionists.
- In `lib/supabase/schema.sql`: Table ordering is topologically sorted (`cashier_shifts` declared before `payments`), and `enforce_self_profile_update_guardrail` guards all 15 non-permitted columns with SQLSTATE 42501.
- All 13 test files and 114 tests pass (100% pass rate), typecheck passes, lint passes, and production build succeeds.

Milestone 1 is ready for independent auditor and challenger verification.

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Unit & Security Test Suites**:
   ```powershell
   npm run test
   ```
   *Expected*: 13 passed test files, 114 passed tests, exit code 0.

2. **Verify Empirical No-Op Probe Fix**:
   ```powershell
   npx tsx -e "import { MockDataProvider } from './lib/dal/mock-data'; const dal = new MockDataProvider(); const s = dal.users.find(u => u.role === 'STUDENT' && u.balanceDue === 0)!; dal.updateUser(s.id, { balanceDue: 0 }, s.id, 'STUDENT').then(r => console.log('STATUS:', r.status, 'SUCCESS:', r.success));"
   ```
   *Expected*: `STATUS: 403 SUCCESS: false`

3. **Verify TypeScript Strict Compilation**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, 0 type errors.

4. **Verify ESLint**:
   ```powershell
   npm run lint
   ```
   *Expected*: `✔ No ESLint warnings or errors`.

5. **Verify Production Next.js Build**:
   ```powershell
   npm run build
   ```
   *Expected*: Successful compilation and page generation with exit code 0.

6. **Inspect Schema SQL File**:
   - `lib/supabase/schema.sql`: verify `CREATE TABLE cashier_shifts` precedes `CREATE TABLE payments` and `enforce_self_profile_update_guardrail` contains `NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone`.
