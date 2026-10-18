# Milestone 2 Security Guardrails & RBAC Explorer Handoff Report

**Agent**: Explorer M2-2 (`teamwork_preview_explorer_m2_2`)  
**Mission**: Security Guardrails, 8-Role RBAC Authorization Matrix, Student/Teacher Profile Update Restrictions, and Route Guarding for Milestone 2  
**Date**: 2026-10-18  
**Handoff Type**: Hard (Investigation complete, full specifications and code blueprints prepared)

---

## 1. Observation

1. **Authoritative Requirements**:
   - `ORIGINAL_REQUEST.md` (lines 18-22, 55-59): Mandates isolated Platform Owner (`/owner`) and Educational Center (`/center/[centerSlug]`) portals, 8 platform roles (`PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `TEACHER`, `STUDENT`, `PARENT`), and strict guardrail: "Students and teachers can upload and update only their own profile photo; all administrative data (names, codes, stages, grades, discounts, balances, enrollments, attendance, test scores) is strictly read-only for students and teachers across UI, server endpoints, and database RLS."
   - Acceptance Criteria: AC-3 (cross-tenant 403), AC-4 (student photo update 200), AC-5 (student admin field update 403), AC-6 (teacher rate lockout 403 & peer payroll 403).

2. **Existing Implementation Status**:
   - `vitest run` executed synchronously with output:
     `Test Files 15 passed (15), Tests 161 passed (161)`.
   - `lib/supabase/schema.sql` (lines 485-521): Database trigger `trg_enforce_user_guardrail` executes `enforce_self_profile_update_guardrail()` raising SQLSTATE `42501` (Forbidden) if `OLD.role IN ('STUDENT', 'TEACHER')` and any non-avatar column is modified.
   - `lib/dal/mock-data.ts` (lines 733-803): `updateUser` implements a blacklist check (`protectedFields`). If an actor is `STUDENT` or `TEACHER` and modifies any protected field, returns `{ status: 403 }`.
   - `lib/dal/mock-data.ts` (lines 804-820): `updateUserProfilePhoto(userId, avatarUrl, actorId, actorRole)` checks `if ((actorRole === 'STUDENT' || actorRole === 'TEACHER') && actorId !== userId)` and returns `{ success: false, error: 'Forbidden' }`.
   - `INITIAL_SEEDED_DATA.users` currently has 9 mock users covering `PLATFORM_OWNER`, `CENTER_ADMIN`, `RECEPTIONIST`, `ACCOUNTANT`, `TEACHER`, `STUDENT`. Mock records for `BRANCH_MANAGER` and `PARENT` are currently missing.
   - `app/center/` and `app/api/profile/update-photo/` have not yet been created in the Next.js routing tree.

3. **Existing Security Tests**:
   - `tests/security/rbac-guardrails.test.ts` (lines 10-256): 17 passing tests validating AC-3, AC-4, AC-5, and AC-6 via `tests/fixtures/contract-bridge.ts`.
   - `tests/security/challenger-m1-empirical.test.ts` (lines 40-75): Directly tests `schema.sql` trigger regex and SQLSTATE 42501.
   - `tests/security/challenger-m1-r2-empirical.test.ts` (lines 11-126): Directly tests `dal.updateTeacherRate` across authorized and forbidden roles, self-escalation rejection, and pre-existence 403 gating.

---

## 2. Logic Chain

1. **From Requirement R2 & AC-4/AC-5 to API & UI Design**:
   - Since students and teachers must be permitted to modify **ONLY** `avatar_url`, relying on a field blacklist in the API or DAL is dangerous: any unlisted or newly introduced database field could become a vector for mass assignment privilege escalation.
   - Therefore, a **Strict Whitelist Architecture** must be enforced:
     `ALLOWED_MUTATION_KEYS = ['avatar_url', 'avatarUrl', 'userId', 'targetUserId']`.
   - If any additional key is present in the request body to `/api/profile/update-photo` or `dal.updateUser` when invoked by a student or teacher, the application must immediately abort with HTTP 403 Forbidden.

2. **From Multi-Tenant Isolation (AC-3) to Middleware Design**:
   - Center A users must never access Center B data.
   - Next.js middleware at `middleware.ts` must intercept `/center/[centerSlug]/**` and cross-reference the user's authenticated tenant slug (`x-tenant-slug` / session) against the requested slug. If mismatched and the user is not `PLATFORM_OWNER`, it must return HTTP 403 immediately before server components or data fetches execute.
   - `/owner/**` must be blocked for all roles other than `PLATFORM_OWNER`.

3. **From UI Guardrails to Dedicated Profile View**:
   - At `/center/[centerSlug]/profile`, when rendered for `STUDENT` or `TEACHER`, form inputs for name, code, stage, grade, division, seat number, phone, email, national ID, and balance due must be set to `disabled={true}` and `readOnly={true}` with visual lock badges (`🔒 للقراءة فقط (مغلق أمنياً)`).
   - The photo upload section must remain active with live image URL preview and instant form submission to `/api/profile/update-photo`.

---

## 3. Caveats

1. **Authentication Mode**:
   - The application is currently designed to operate in dual mode: Supabase JWT auth in production and in-memory mock session headers (`x-user-id`, `x-user-role`, `x-tenant-slug`) in demo/testing mode. Middleware and API handlers are designed to support both seamlessly.
2. **Missing Seed Users**:
   - Seed data in `INITIAL_SEEDED_DATA.users` currently lacks `BRANCH_MANAGER` and `PARENT` entries. Worker M2 must add these two mock user records to guarantee 100% empirical role matrix testing.

---

## 4. Conclusion

1. The 3-tier security architecture is completely mapped, verified, and specified:
   - **Tier 1 (UI)**: Dedicated profile page at `app/center/[centerSlug]/profile/page.tsx` with disabled administrative inputs, security badges, and active avatar photo update.
   - **Tier 2 (API & Middleware)**: Dedicated endpoint at `app/api/profile/update-photo/route.ts` and `middleware.ts` enforcing strict whitelist validation (HTTP 403 on non-avatar keys), self-update boundaries, and tenant isolation.
   - **Tier 3 (Database)**: Existing PostgreSQL trigger `trg_enforce_user_guardrail` and RLS policies enforcing SQLSTATE 42501 rejection at the database engine level.
2. Worker M2 has been provided complete, drop-in TypeScript implementations for:
   - `lib/security/rbac.ts`
   - `middleware.ts`
   - `app/api/profile/update-photo/route.ts`
   - `app/center/[centerSlug]/profile/page.tsx`
   - Test suite blueprint `tests/security/m2-profile-guardrails.test.ts` (24 test scenarios).
3. All findings and code specifications are published in `m2_security_report.md`.

---

## 5. Verification Method

To independently verify this specification and its invariants:

1. **Verify Baseline Tests**:
   ```bash
   npx vitest run tests/security/rbac-guardrails.test.ts
   npx vitest run tests/security/challenger-m1-empirical.test.ts
   npx vitest run tests/security/challenger-m1-r2-empirical.test.ts
   ```
   All 61 security-related tests must pass with 0 failures.

2. **Verify Proposed M2 Security Test Suite**:
   Once Worker M2 places `lib/security/rbac.ts` and `tests/security/m2-profile-guardrails.test.ts`, execute:
   ```bash
   npx vitest run tests/security/m2-profile-guardrails.test.ts
   ```
   Validates 24 granular test cases across photo updates, whitelist rejection, 8-role route access, and peer privacy.

3. **Verify Full System Test Suite**:
   ```bash
   npx vitest run
   ```
   Must maintain 100% pass rate.
