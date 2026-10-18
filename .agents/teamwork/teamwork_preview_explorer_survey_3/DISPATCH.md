# Domain Logic & Testing Explorer Survey Task

Assigned to: teamwork_preview_explorer_survey_3
Role: Domain Logic & Testing Explorer
Scope: Financial compensation calculations (dual model), reception attendance idempotency, AI exam generation & A4 printable rendering, async notification engine, and acceptance criteria test design.

## 2026-10-18T01:36:25Z
You are Domain Logic & Testing Explorer Survey 3.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3
The authoritative user request is at: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project root: d:\Software\YALLA CODEX\YALLA CENTER

Your objective is to investigate the core domain logic, algorithms, and test architecture:
1. Dual Teacher Compensation Engine:
   - Center Subscription formula: Average Attendance = (Total Valid Attendance across Conducted Sessions) / (Conducted Sessions), Compensation = Average Attendance × Contractual Fixed Rate. Handling zero conducted sessions (returns 0 without error), excluding canceled sessions.
   - Private Lessons formula: Splitting net eligible revenue (after percentage/fixed discounts and 100% free enrollments) between Center and Teacher based on contractual percentages, tracking invoiced vs. collected amounts without rounding leakage.
2. Fast Reception Attendance System:
   - Barcode/QR scanning, student code lookup, fast verification (photo, group, class status, payment alerts).
   - Idempotent logging: exact mechanism to prevent duplicate attendance scans within the same session.
   - Automatic reactive updates (student history, session stats, teacher tallies, async parent alerts).
3. Hierarchical Teacher Materials & AI Exam Generation Platform:
   - Material hierarchy (Stage → Grade → Subject → Unit → Lesson → Documents), Google Drive folder linking, document text indexing.
   - Grounded AI exam generation: rejecting exam creation if source documents are unindexed or insufficient, placing generated exams into teacher review before publishing, KaTeX math notation.
   - Branded printable A4 exam layout: Yalla Center logo top-left, teacher name top-right, student name/code inputs, KaTeX equations.
   - Online student exam platform: countdown timer, autosave, automated MCQ grading.
4. Asynchronous Notification Engine:
   - WhatsApp Business Cloud API & Web Push FCM integration.
   - Non-blocking queuing architecture and delivery logs, with sandboxed fallbacks.
5. E2E Testing Track Strategy:
   - Define test runner, test framework (Vitest/Jest/Playwright), and structure for Tiers 1-4 tests covering all acceptance criteria.
6. Write your complete findings to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_domain_report.md`
and write a standard handoff report `handoff.md` in your working directory.
When finished, notify the orchestrator via send_message.
