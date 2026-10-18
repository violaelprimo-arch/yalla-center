# E2E Test Suite Creation Task

Assigned to: test_writer_e2e_1
Role: E2E Test Writer
Scope: E2E Testing Track — Create TEST_INFRA.md, Vitest test suites (Tiers 1-4) covering all Acceptance Criteria (AC-1 to AC-10), and publish TEST_READY.md.
## 2026-10-18T01:43:03Z
You are Test Writer E2E 1 for the E2E Testing Track of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\test_writer_e2e_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER
The authoritative user request is at: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
The project scope document is at: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
Reference domain survey: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_domain_report.md

Your mission:
You are the primary author of the comprehensive E2E Testing Track. You must design and implement the complete opaque-box, requirement-driven test suite for Yalla Center derived strictly from ORIGINAL_REQUEST.md and PROJECT.md:
1. Create `TEST_INFRA.md` at project root (`d:\Software\YALLA CODEX\YALLA CENTER\TEST_INFRA.md`) following the required format (Test Philosophy, Feature Inventory mapping, Test Architecture, Real-World Scenarios, Coverage Thresholds).
2. Configure the testing framework: create `vitest.config.ts` (or equivalent test runner config) and test setup scripts.
3. Write comprehensive test suites in `tests/`:
   - `tests/unit/compensation.test.ts` (Tier 1: AC-1 Center Subscription calculation with attendances [12, 15, 11, 14] at 20 EGP = 260 EGP, zero conducted sessions = 0 without error, canceled sessions excluded; AC-2 Private Lessons calculation 100 EGP at 70/30 = 70/30, 20% discount = 56/24, 100% free = 0/0, zero rounding leakage).
   - `tests/security/rbac-guardrails.test.ts` (Tier 2: AC-3 Multi-tenant isolation Center A vs Center B; AC-4 Student avatar update allowed; AC-5 Student admin fields update rejected with HTTP 403 Forbidden; AC-6 Teacher salary rates & peer statements rejected with HTTP 403 Forbidden).
   - `tests/integration/attendance-idempotency.test.ts` (Tier 3: AC-7 Idempotent attendance scanning verifying duplicate scans in the same session produce exactly one attendance record).
   - `tests/integration/ai-exam-gate.test.ts` (Tier 3: AC-8 Grounded AI exam generation rejects unindexed or <200 word documents, defaults generated exams to teacher review draft).
   - `tests/integration/notifications.test.ts` (Tier 3: Non-blocking notification queue and delivery).
   - `tests/e2e/printable-exam-layout.test.ts` (Tier 4: AC-9 Printable A4 exam layout verifying Yalla Center logo top-left, teacher name top-right, student name/code inputs, KaTeX equations).
   - `tests/e2e/student-exam-runner.test.ts` (Tier 4: Online student exam runner with countdown timer, autosave, and auto-graded MCQs).
4. Verify tests run with the test runner (e.g. `npx vitest run` or equivalent once dependencies exist, or verify static test suite validity).
5. When the full test suite is written and ready, create `TEST_READY.md` at project root (`d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md`) summarizing the test runner command, coverage count per tier (Tiers 1-4), and feature checklist.
6. Write a full handoff report in `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\test_writer_e2e_1\handoff.md`.
Notify the orchestrator via send_message when complete.
