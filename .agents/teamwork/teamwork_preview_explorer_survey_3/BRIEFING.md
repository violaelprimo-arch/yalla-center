# BRIEFING — 2026-10-18T01:40:00Z

## Mission
Investigate and formulate the domain logic algorithms, reception attendance idempotency, materials/AI exam generation with KaTeX & A4 export, async notifications, and E2E testing track strategy for Yalla Center.

## 🔒 My Identity
- Archetype: explorer
- Roles: domain_explorer, testing_architect
- Working directory: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3
- Original parent: 0d5db91a-81d9-4bcf-b33d-469b23b0c2c8
- Milestone: survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files.
- Produce comprehensive survey domain report and handoff report.
- Deliver results via send_message to orchestrator.

## Current Parent
- Conversation ID: 0d5db91a-81d9-4bcf-b33d-469b23b0c2c8
- Updated: 2026-10-18T01:40:00Z

## Investigation State
- **Explored paths**: `ORIGINAL_REQUEST.md`, `public/brand/`, orchestrator briefing, peer dispatch files.
- **Key findings**:
  1. Center Subscription formula: `Average Attendance = (Total Valid Attendance across Conducted Sessions) / (Conducted Sessions)`, `Compensation = Average Attendance × Contractual Fixed Rate`. 4 sessions [12, 15, 11, 14] at 20 EGP = exactly 260 EGP. Handled zero conducted sessions returning 0 without division-by-zero, canceled sessions excluded.
  2. Private Lessons formula: Net eligible revenue split between Center and Teacher based on contractual percentage with zero rounding leakage invariant (`teacher_share + center_share === net_revenue`).
  3. Fast Reception Attendance System: Barcode/QR scan, sub-300ms verification HUD, compound database unique constraint `(session_id, student_id)` with `(xmax = 0)` new-record detection for idempotency.
  4. Materials & AI Exam Platform: 8-level hierarchy, preflight validation gate rejecting unindexed/insufficient (<200 words) docs, teacher review draft status, printable A4 layout specs (logo top-left, teacher top-right, KaTeX math), online exam platform with timer and autosave.
  5. Asynchronous Notification Engine: Meta WhatsApp Business Cloud API & Web Push FCM, non-blocking DB queue worker pattern, sandboxed outbox fallback for demo/test mode.
  6. E2E Testing Strategy: 4-Tier test hierarchy covering AC-1 through AC-10 using Vitest and Playwright.
- **Unexplored areas**: None within the survey scope; complete domain blueprints provided.

## Key Decisions Made
- Authored comprehensive domain specification report at `survey_domain_report.md` (947 lines, 48 KB) covering formulas, algorithms, database query patterns, and test suites.
- Established strict zero-leakage invariant formulation for financial revenue splitting.
- Established 4-Tier test hierarchy mapped 1-to-1 to all acceptance criteria.

## Artifact Index
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md — Source requirements
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\DISPATCH.md — Dispatch log
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\BRIEFING.md — Working memory
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\progress.md — Liveness heartbeat
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_domain_report.md — Authoritative domain & test architecture report
- d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md — Handoff report
