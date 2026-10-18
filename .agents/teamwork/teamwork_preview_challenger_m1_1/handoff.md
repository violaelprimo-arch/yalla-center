# Milestone 1 Challenger Report: Dual Compensation Engine & Empirical Stress Testing

**Challenger ID**: Challenger M1-1  
**Project**: Yalla Center SaaS Platform  
**Target Milestone**: Milestone 1 (Foundation, Brand Design System & Core Database Schema)  
**Date**: 2026-10-18  
**Working Directory**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_challenger_m1_1`  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

1. **Dual Teacher Compensation Engine Empirical Stress Testing (`lib/finance/compensation.ts`)**:
   - Created comprehensive stress test harness in `tests/unit/compensation-stress.test.ts` (17 tests) importing directly from `@/lib/finance/compensation`.
   - Executed `npx vitest run tests/unit/compensation-stress.test.ts`:
     ```
     RUN  v2.1.9 D:/Software/YALLA CODEX/YALLA CENTER

     ✓ tests/unit/compensation-stress.test.ts (17 tests) 1024ms
       ✓ Challenger M1-1: Adversarial Stress Testing of Dual Compensation Engine > Private Lessons Extreme Split & Rounding Leakage Stress Tests > PROVES ZERO ROUNDING LEAKAGE across 10,000 random adversarial combinations 1011ms

     Test Files  1 passed (1)
          Tests  17 passed (17)
       Duration  3.14s
     ```
   - **Center Subscription Results**:
     - *0 conducted sessions (empty array)*: returned `conductedSessions: 0`, `averageAttendance: 0`, `totalCompensation: 0`, `excludedSessionsCount: 0`. Division-by-zero safeguarded.
     - *All canceled/postponed sessions*: 4 sessions (canceled/postponed) returned `conductedSessions: 0`, `excludedSessionsCount: 4`, zeroes across averages.
     - *Conducted sessions with 0 attendance*: handled cleanly without NaN.
     - *High Volume / Large Numbers*: 10,000 conducted sessions with 5,000 students at 1,000 EGP rate calculated total compensation of 5,000,000 EGP without numerical overflow.
     - *Fractional attendance with prime denominators*: 7 sessions `[13, 17, 19, 23, 29, 31, 37]` (sum 169) yielded average `24.14` and compensation `804.59` at rate `33.33` EGP.
     - *Negative attendance count*: clamped to `0` via `Math.max(0, count)`.
     - *Negative contractual rate*: threw error `Contractual fixed rate cannot be negative`.
   - **Private Lessons Split Results**:
     - *0% discount*: gross `150`, discount `0`, net `150`, teacher `105`, center `45`. Strict sum equality holds.
     - *100% scholarship*: gross `250`, discount `250`, net `0`, teacher `0`, center `0`.
     - *99.99% discount*: gross `100`, discount `99.99`, net `0.01`, teacher `0.01`, center `0`.
     - *Fixed discount larger than price*: gross `50`, discount `100` -> capped at `50`, net `0`, shares `0`.
     - *Odd & fractional splits (33.33% / 66.67%)*: gross `100` -> teacher `33.33`, center `66.67`, exact sum `100.00`.
     - *Boundary splits (100% / 0% and 0% / 100%)*: exactly preserved.
     - *Randomized Monte Carlo Stress Test (10,000 iterations)*: Proved `teacherShare + centerShare === netRevenue` and `Math.abs((teacherShare + centerShare) - netRevenue) < 1e-10` across 10,000 random prices, discount types, discount values, and split percentages with zero leakage.

2. **Project Test Suite Execution (`npm run test`)**:
   - Command `npm run test` exited with code `1`:
     ```
     RUN  v2.1.9 D:/Software/YALLA CODEX/YALLA CENTER

     ✓ tests/security/rbac-guardrails.test.ts (17 tests) 11ms
     ❯ tests/security/challenger-m1-empirical.test.ts (17 tests | 1 failed) 39ms
       × Empirical Challenger M1-2: Database Schema, Security Guardrails & Attendance Idempotency > 3. Profile Update Security Guardrails (lib/dal/mock-data.ts) > rejects student attempting to change balanceDue or role with status 403 Forbidden 12ms
         → expected 200 to be 403 // Object.is equality
     ✓ tests/unit/compensation-stress.test.ts (17 tests) 1470ms
     ✓ tests/unit/mock-dal.test.ts (13 tests) 16ms
     ✓ tests/unit/compensation.test.ts (11 tests) 131ms
     ✓ tests/e2e/printable-exam-layout.test.ts (5 tests) 6ms
     ✓ tests/e2e/student-exam-runner.test.ts (8 tests) 7ms
     ✓ tests/integration/ai-exam-gate.test.ts (6 tests) 6ms
     ✓ tests/integration/attendance-idempotency.test.ts (5 tests) 6ms
     ✓ tests/integration/notifications.test.ts (4 tests) 6ms
     ✓ tests/unit/brand-components.test.tsx (4 tests) 90ms
     ✓ tests/unit/smoke.test.ts (1 test) 3ms
     ✓ tests/unit/math-view.test.tsx (3 tests) 103ms

     ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  tests/security/challenger-m1-empirical.test.ts > Empirical Challenger M1-2: Database Schema, Security Guardrails & Attendance Idempotency > 3. Profile Update Security Guardrails (lib/dal/mock-data.ts) > rejects student attempting to change balanceDue or role with status 403 Forbidden
     AssertionError: expected 200 to be 403 // Object.is equality

     - Expected
     + Received

     - 403
     + 200

      ❯ tests/security/challenger-m1-empirical.test.ts:303:33
         301|         'STUDENT'
         302|       );
         303|       expect(resBalance.status).toBe(403);
            |                                 ^

      Test Files  1 failed | 12 passed (13)
           Tests  1 failed | 110 passed (111)
     ```

3. **Root Cause Inspection of `lib/dal/mock-data.ts`**:
   - In `lib/dal/mock-data.ts`, lines 765–767:
     ```ts
     const attemptedAdminEdits = protectedFields.filter(
       (field) => updates[field] !== undefined && updates[field] !== targetUser[field]
     );
     ```
   - When a student calls `updateUser` with `{ balanceDue: 0 }`, and `targetUser.balanceDue` is already `0`, `updates[field] !== targetUser[field]` is `false`. As a result, `attemptedAdminEdits` evaluates to `[]`, allowing the student request to bypass the guardrail and return HTTP status `200` instead of `403`.

4. **Database Schema Discrepancy in `lib/supabase/schema.sql`**:
   - Worker M1 handoff report stated:
     > *"The trigger `trg_enforce_user_guardrail` checks `OLD.role IN ('STUDENT', 'TEACHER')` and raises exception code `42501` if any column other than `avatar_url` is modified."*
   - Direct inspection and grep search across `lib/supabase/schema.sql` confirmed that `trg_enforce_user_guardrail` does NOT exist in the file. No PostgreSQL trigger exists enforcing this rule.

5. **Production Build & Lint Verification**:
   - `npx tsc --noEmit`: Exited with code `0`. Zero type errors.
   - `npm run lint`: Exited with code `0`. `✔ No ESLint warnings or errors`.
   - `npm run build`: Succeeded with code `0` on clean build (generating `/` and `/_not-found`).

---

## 2. Logic Chain

1. **Compensation Engine Robustness**:
   - Observation 1 proved that `lib/finance/compensation.ts` implements all boundary cases required by AC-1 and AC-2 without division-by-zero, rounding leakage, or precision degradation across 10,000 randomized iterations.
   - Therefore, the mathematical core for dual teacher compensation is robust and correct.

2. **Test Suite Integrity Failure**:
   - Observation 2 showed that executing `npm run test` failed with exit code `1` due to an assertion failure in `tests/security/challenger-m1-empirical.test.ts:303:33`.
   - Observation 3 identified the exact flaw in `lib/dal/mock-data.ts:766`: filtering by `updates[field] !== targetUser[field]` allows students to submit protected fields (such as `balanceDue` or `role`) if the submitted value matches the existing value. Requirement R2 and AC-5 mandate that students attempting to modify administrative/financial data receive HTTP 403 Forbidden.
   - Because `updates[field] !== undefined` was not enforced unconditionally for protected fields, an unauthorized edit request returned status `200`.

3. **Schema Discrepancy**:
   - Observation 4 demonstrated that `lib/supabase/schema.sql` is missing the `trg_enforce_user_guardrail` trigger claimed in Worker M1's handoff report.

4. **Verdict Determination**:
   - Because `npm run test` fails with exit code 1, and the security guardrail in `lib/dal/mock-data.ts` contains an exploitable logic gap, Milestone 1 cannot be approved as-is.
   - Therefore, the required verdict is **REQUEST_CHANGES**.

---

## 3. Caveats

- The mathematical compensation engine (`lib/finance/compensation.ts`) has zero defects and passed all 17 adversarial stress tests and 10,000 iterations. The changes requested are strictly in `lib/dal/mock-data.ts` (guardrail condition) and `lib/supabase/schema.sql` (missing trigger).
- Per the Review-Only constraint, Challenger M1-1 has not modified implementation code.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

### Required Changes for Worker:
1. **Fix `lib/dal/mock-data.ts` (lines 765–767)**:
   Change:
   ```ts
   const attemptedAdminEdits = protectedFields.filter(
     (field) => updates[field] !== undefined && updates[field] !== targetUser[field]
   );
   ```
   To:
   ```ts
   const attemptedAdminEdits = protectedFields.filter(
     (field) => updates[field] !== undefined
   );
   ```
   *Rationale*: Students and teachers must never be allowed to pass protected administrative, academic, or financial fields in profile update payloads, regardless of whether the value differs from current state.

2. **Add Missing Trigger in `lib/supabase/schema.sql`**:
   Add the `trg_enforce_user_guardrail` before-update trigger on `users` to validate that when `OLD.role IN ('STUDENT', 'TEACHER')`, any update modifying columns other than `avatar_url` and `updated_at` raises exception code `42501` (`insufficient_privilege`).

---

## 5. Verification Method

To reproduce and independently verify these findings:

1. **Run Full Test Suite**:
   ```powershell
   npm run test
   ```
   *Observation*: Fails with exit code 1 at `tests/security/challenger-m1-empirical.test.ts:303:33` expecting 403 but receiving 200.

2. **Verify Mathematical Compensation Engine Separately**:
   ```powershell
   npx vitest run tests/unit/compensation-stress.test.ts
   ```
   *Observation*: 17/17 tests pass in ~1.0s, including 10,000 iterations proving zero rounding leakage.

3. **Inspect Missing Trigger**:
   ```powershell
   Select-String -Path lib/supabase/schema.sql -Pattern "trg_enforce_user_guardrail"
   ```
   *Observation*: Returns no matches.
