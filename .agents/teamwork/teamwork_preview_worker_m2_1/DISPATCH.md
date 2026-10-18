## 2026-10-18T03:25:54Z
You are Worker M2 for Milestone 2 (Multi-Tenant Architecture, Portals & Strict Security Guardrails) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m2_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Read the three Explorer M2 reports before implementing:
1. Portal Architecture Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m2_1\m2_portal_report.md`
2. Security Guardrails Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m2_2\m2_security_report.md`
3. Branch Timetable & Conflict Report: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m2_3\m2_timetable_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. Multi-Tenant Portals & Routing:
   - Implement `app/owner/layout.tsx` and `app/owner/page.tsx` (Platform Owner Super-Admin portal with platform metrics, center management table, subscriptions).
   - Implement `app/center/[centerSlug]/layout.tsx` (Dynamic tenant resolution, custom Arabic 404 fallback for unknown slugs, `TenantProvider` context integration, persistent Midnight Navy `#0B132B` sidebar, Electric Cyan `#00A3FF` active glow indicators, Cairo RTL layout).
   - Implement `app/center/[centerSlug]/page.tsx` (Educational Center overview dashboard with KPI stats, active classes, branch summary).
   - Implement components in `components/layout/`:
     - `tenant-provider.tsx`: Client context storing tenant, active branch, active role, and 1-click role switcher.
     - `sidebar.tsx`: Persistent right sidebar filtering nav items dynamically based on the 8 platform roles (`PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `TEACHER`, `STUDENT`, `PARENT`).
     - `header.tsx`: Header with tenant title, branch switcher, and role switcher for demo/testing.
2. 3-Tier Security Guardrails & Profile View:
   - Implement `lib/security/rbac.ts`: Strict role authorization matrix and whitelist validator (`ALLOWED_MUTATION_KEYS = ['avatar_url', 'avatarUrl', 'userId', 'targetUserId']`).
   - Implement `middleware.ts`: Next.js middleware enforcing tenant isolation (cross-tenant access returns HTTP 403 Forbidden unless `PLATFORM_OWNER`) and `/owner` route guarding.
   - Implement `app/api/profile/update-photo/route.ts`: Dedicated POST endpoint enforcing HTTP 403 Forbidden if student/teacher attempts to update non-avatar fields or target another user, and HTTP 200 OK for valid photo updates.
   - Implement `app/center/[centerSlug]/profile/page.tsx`: Dedicated profile page where students and teachers have administrative fields disabled (`disabled={true}`, `readOnly={true}`) with lock badges (`🔒 للقراءة فقط (مغلق أمنياً)`), while avatar photo upload remains active with live image preview and instant submission.
3. Multi-Branch & Timetable Conflict Prevention:
   - Implement `lib/timetable/conflict-detector.ts`: Interval collision detection algorithm $(s_1 < e_2) \land (s_2 < e_1)$ preventing classroom double-booking and teacher double-booking across rooms/branches, supporting back-to-back classes ($s_2 = e_1$), canceled session bypass, and self-exclusion on edit.
   - Implement `app/center/[centerSlug]/branches/page.tsx`: Multi-branch classroom management with 4 tabs (Branches & Classrooms, Weekly Timetable Matrix, Conflict Prevention & Smart Scheduler, Daily Operational Sessions).
4. Data Layer & Type Harmonization:
   - In `lib/dal/types.ts`: Update `NotificationChannel` union to accept uppercase `'WHATSAPP' | 'FCM' | 'SMS'` alongside lowercase variants `'whatsapp' | 'fcm' | 'sms'`.
   - In `lib/dal/mock-data.ts`: Add `BRANCH_MANAGER` (`user-bm-nasr`) and `PARENT` (`user-parent-ahmed`) to `INITIAL_SEEDED_DATA.users` for 100% 8-role coverage.
5. Unit & Security Tests:
   - Implement `tests/security/m2-profile-guardrails.test.ts` (validating AC-3, AC-4, AC-5, AC-6, 8-role matrix, photo updates, 403 forbidden responses).
   - Implement `tests/unit/conflict-detector.test.ts` (validating classroom collisions, teacher collisions across branches, back-to-back zero gap, canceled sessions, and capacity warnings).
6. Verification Gates:
   - Run `npx tsc --noEmit` and confirm exit code 0 (zero errors).
   - Run `npm run test` and confirm all test suites pass with 100% pass rate (exit code 0).
   - Run `npm run lint` and confirm exit code 0.
   - Run `npm run build` and confirm Next.js production build compiles with exit code 0.
7. Record all exact outputs and write your handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m2_1\handoff.md`.
Notify the orchestrator via send_message when complete.
