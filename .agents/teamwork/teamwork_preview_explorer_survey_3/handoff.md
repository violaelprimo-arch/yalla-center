# Handoff Report — Domain Logic & Testing Architecture Survey

**Agent**: Domain Logic & Testing Explorer Survey 3 (`teamwork_preview_explorer_survey_3`)  
**Date**: 2026-10-18T01:40:30Z  
**Recipient**: Orchestrator (`0d5db91a-81d9-4bcf-b33d-469b23b0c2c8`)  
**Report Type**: Hard Handoff (Task Complete)  
**Primary Deliverable**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_domain_report.md`

---

## 1. Observation

1. **Source Requirements (`ORIGINAL_REQUEST.md`)**:
   - Lines 23-28: Specifies R3 Student Enrollment & Dual Teacher Compensation Engine:
     - Center Subscription: `Average Attendance = (Total Valid Attendance across Conducted Sessions) / (Conducted Sessions)`, `Compensation = Average Attendance × Contractual Fixed Rate`. Zero conducted sessions must return 0 without division-by-zero; canceled sessions must be excluded.
     - Private Lessons: Split net eligible revenue (after percentage/fixed discounts and 100% free enrollments) between Center and Teacher based on contractual percentages, tracking invoiced vs. collected amounts without rounding leakage.
   - Lines 29-33: Specifies R4 Fast Reception Attendance System: Barcode/QR scanning, student code lookup, fast verification HUD (photo, group, class status, payment alerts), idempotent logging preventing duplicate attendance scans in same session, reactive live updates.
   - Lines 34-38: Specifies R5 Hierarchical Teacher Materials & AI Exam Platform: Stage → Grade → Subject → Unit → Lesson → Documents, Google Drive linking, text indexing, grounded AI exam generation rejecting unindexed/insufficient documents, teacher review workflow, printable A4 exam layout with logo top-left and teacher top-right, KaTeX math equations, and online exam platform with countdown timer and autosave.
   - Lines 39-42: Specifies R6 Asynchronous Notification Engine: WhatsApp Business Cloud API & Web Push FCM, guaranteed non-blocking execution.
   - Lines 43-47: Specifies R7 Controlled Infrastructure: Supabase PostgreSQL, normalized schema, sandboxed/test modes for external APIs.
   - Lines 50-64: Acceptance Criteria (AC-1 through AC-10) defining explicit test scenarios for financial calculations, multi-tenant isolation, RBAC guardrails, idempotency, AI exam preflight rejection, and A4 print layout.

2. **Workspace & Runtime State**:
   - Project directory: `d:\Software\YALLA CODEX\YALLA CENTER`.
   - Node runtime: `v24.18.0`, pnpm: `12.11.2`, npm: `11.16.0`.
   - Brand assets present in `public/brand/`:
     - `yalla-center-icon.png` (726 KB)
     - `yalla-center-logo-dark.png` (225 KB)
     - `yalla-center-logo-light.png` (192 KB)
     - `yalla-center-wireframes.jpg` (342 KB)

3. **Orchestrator Architecture (`orchestrator_1/BRIEFING.md`)**:
   - Lines 14-23: Defines Project Pattern with Dual Track (Implementation Track + E2E Testing Track) progressing through Tiers 1-4 tests covering 100% acceptance criteria.

---

## 2. Logic Chain

1. **Dual Compensation Calculation**:
   - From Observation 1 (Lines 23-28 & 51-52), the Center Subscription model requires:
     $$\text{Average Attendance} = \frac{\sum \text{Valid Attendance}}{|\text{Conducted Sessions}|}$$
     For attendances $[12, 15, 11, 14]$ at $20\text{ EGP}$: Sum $= 52$, Conducted $= 4$, Average $= 13.00$, Compensation $= 13 \times 20 = 260.00\text{ EGP}$.
   - If $|\text{Conducted Sessions}| = 0$, evaluating $\frac{0}{0}$ directly causes `NaN` or unhandled exceptions. Therefore, an explicit guard `if (conducted.length === 0) return 0` is required.
   - In Private Lessons, rounding leakage occurs if both teacher and center shares are rounded independently (e.g. $75 \times 0.3333$). To mathematically eliminate rounding leakage, the center share must be computed as `netRevenue - teacherShare`, guaranteeing the invariant:
     $$\text{Teacher Share} + \text{Center Share} \equiv \text{Net Eligible Revenue}$$

2. **Reception Attendance Idempotency**:
   - From Observation 1 (Lines 29-33 & 61), duplicate scans must not create multiple records or trigger duplicate notifications.
   - Application-only in-memory locks fail under multi-turnstile concurrency or process restarts.
   - Therefore, idempotency must be anchored in PostgreSQL via `UNIQUE (session_id, student_id)` and atomic `ON CONFLICT (session_id, student_id) DO UPDATE SET updated_at = NOW() RETURNING (xmax = 0) AS is_new_record`. If `is_new_record === false`, the API responds with HTTP 200 `{ duplicate: true }` without enqueuing duplicate notifications or incrementing counters.

3. **Grounded AI Exam Generation & Printable A4 Layout**:
   - From Observation 1 (Lines 34-38 & 62-63), generating exams from unindexed documents produces hallucinations.
   - Therefore, a preflight validation gate must inspect all source documents: if any document has `indexing_status !== 'indexed'` or `total_words < 200`, it immediately returns HTTP 400 with `UNINDEXED_SOURCE_DOCUMENTS` or `INSUFFICIENT_SOURCE_DOCUMENTS`.
   - The generated exam is persisted with `review_status = 'pending_teacher_review'` and `is_published = false`.
   - For printable A4 exports, CSS `@media print` with ISO A4 dimensions (210×297mm) places the official Yalla Center logo top-left, teacher name top-right, student name/code inputs, and KaTeX mathematical notation pre-rendered via `katex.renderToString`.

4. **Asynchronous Non-Blocking Notifications**:
   - From Observation 1 (Lines 39-42), attendance and payment transactions must never block on WhatsApp/FCM API calls.
   - An event-driven database queue pattern (`notification_queue`) commits locally within $<20\text{ms}$. A background worker handles external dispatch. In demo/test mode, a sandboxed fallback logs messages with status `simulated_delivered` and broadcasts to a Live Notification Inspector UI.

5. **E2E Testing Track Strategy**:
   - To guarantee complete coverage of all 10 acceptance criteria, testing must be structured into 4 hierarchical tiers:
     - **Tier 1 (Unit)**: Mathematical proofs for compensation formulas, zero leakage, zero conducted classes, and grading.
     - **Tier 2 (Security/RBAC)**: Multi-tenant isolation (Center A vs B), student avatar edit allowed vs admin fields HTTP 403, teacher salary lock HTTP 403.
     - **Tier 3 (Integration/Workflows)**: Fast reception attendance idempotent scanning, AI exam generation preflight rejection, non-blocking notification queue.
     - **Tier 4 (E2E Browser/Playwright)**: Arabic RTL layout across viewports, printable A4 exam preview layout, and online student exam execution.

---

## 3. Caveats

- **External API Credentials**: In demo mode or offline development, live Meta WhatsApp API and Google Drive OAuth credentials will not be present. The implementation MUST implement the sandboxed provider documented in `survey_domain_report.md` Section 5.4.
- **Floating Point Arithmetic**: JavaScript's native IEEE 754 floating point numbers can produce minute precision artifacts (e.g. `0.1 + 0.2 = 0.30000000000000004`). Financial fields must be stored in piastres (integers) or manipulated using a decimal rounding helper (`Math.round(val * 100) / 100`) as specified in the report.

---

## 4. Conclusion

The domain logic, algorithms, concurrency controls, and test architecture have been fully analyzed and documented in `survey_domain_report.md`. All requirements from `ORIGINAL_REQUEST.md` (R3, R4, R5, R6, R7) and all Acceptance Criteria (AC-1 through AC-10) now have concrete mathematical formulations, TypeScript implementations, SQL constraints, and ready-to-implement test suite blueprints. The orchestrator can directly ingest this report to synthesize `PROJECT.md` and initialize the Implementation and E2E Testing Tracks.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Inspect Deliverable**:
   ```powershell
   Get-Content "d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_3\survey_domain_report.md" -Head 120
   ```
   Confirm presence of executive summary, compensation formulas, attendance idempotency SQL, AI exam validation gate, and test blueprints.

2. **Verify Mathematical Calculations**:
   - Center Subscription: Check `(12 + 15 + 11 + 14) / 4 * 20 = 52 / 4 * 20 = 13 * 20 = 260.00 EGP`.
   - Private Lessons: Check $100$ at $70/30 = 70 / 30$, $20\%$ discount on $100 = 80$, $70/30$ of $80 = 56 / 24$, $100\%$ free $= 0 / 0$.
   - Leakage Invariant: Check that $\text{teacherShare} + \text{centerShare} \equiv \text{netRevenue}$.

3. **Verify Acceptance Criteria Mapping**:
   Inspect Section 6 of `survey_domain_report.md` to verify 1-to-1 traceability from AC-1 through AC-10 to the corresponding Tier 1-4 test files.
