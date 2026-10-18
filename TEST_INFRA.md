# YALLA CENTER — Comprehensive Test Infrastructure & Verification Architecture (TEST_INFRA)

**Document Version**: 1.0.0  
**Author**: Test Writer E2E 1 (`test_writer_e2e_1`)  
**Project**: Yalla Center SaaS Platform  
**Authoritative Sources**: `ORIGINAL_REQUEST.md`, `PROJECT.md`  
**Execution Target**: Vitest 1.x/2.x / Node.js 20+ / TypeScript Strict Mode

---

## 1. Test Philosophy & Principles

The testing architecture of Yalla Center is engineered according to five foundational principles:

### 1.1 Opaque-Box, Requirement-Driven Verification
All tests are strictly specified against requirements defined in `ORIGINAL_REQUEST.md` and the formal architectural contracts in `PROJECT.md`. Tests treat implementation units as opaque modules evaluated through public interface boundaries, database invariants, and HTTP response contracts.

### 1.2 Zero-Facade Policy
Facade tests—tests that unconditionally pass without asserting genuine domain constraints—are strictly prohibited. Every test case contains definitive assertions evaluating observable outputs (numerical totals, HTTP status codes, entity states, DOM hierarchy) against authoritative expected values.

### 1.3 Progressive Testability & Strict Tiering
The test suite is organized into four hierarchical tiers:
- **Tier 1 (Unit & Mathematical Invariants)**: Pure functional domain logic, rounding leakage prevention, arithmetic edge conditions.
- **Tier 2 (Security Guardrails & Multi-Tenant Isolation)**: RBAC 403 Forbidden enforcement, student/teacher profile lockdowns, cross-tenant isolation.
- **Tier 3 (Operational Workflows & Concurrency)**: Idempotent reception attendance check-in, AI exam grounding preflight gate, non-blocking notification queuing.
- **Tier 4 (End-to-End System & Layout)**: Branded printable A4 exam layout with KaTeX equations, online timed student exam runner with autosave and auto-grading.

### 1.4 Test Independence & State Isolation
Each test is self-contained. Tests set up isolated fixtures, do not rely on side-effects of preceding tests, execute deterministically under parallel test runners, and perform clean teardowns.

### 1.5 Adversarial Hardening
Tests actively inject adversarial inputs: division-by-zero vectors ($0$ conducted sessions), fractional discounts with repeating decimals (70/30 split on odd piastres), rapid concurrent duplicate attendance scans, empty and sub-200-word documents to AI generators, and unauthorized role payload injection (students modifying balances).

---

## 2. Feature Inventory Mapping

The following matrix maps every feature defined in `PROJECT.md` (FEAT-01 to FEAT-42) to its testing tier, test suite file, and authoritative acceptance criteria (AC-1 to AC-10).

| Feature ID | Feature Name | Tier | Test File Target | Acceptance Criteria | Primary Invariant / Assertion |
|:---|:---|:---:|:---|:---:|:---|
| **FEAT-01** | Brand Assets Preservation | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-9, AC-10 | Official logo files present and unmodified in `public/brand/` |
| **FEAT-02** | Arabic Cairo RTL Typography | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-10 | RTL layout attributes (`dir="rtl"`) and Cairo typography tokens |
| **FEAT-03** | Deep Navy & Cyan Design System | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-10 | Color tokens: Midnight Navy sidebar, Electric Cyan badges |
| **FEAT-04** | Dual Theme Engine | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-10 | Light/Dark theme token compatibility |
| **FEAT-05** | Responsive Viewports | Tier 4 | `tests/e2e/student-exam-runner.test.ts` | AC-10 | Responsive container layouts (mobile, tablet, desktop) |
| **FEAT-06** | KaTeX Math Typesetting | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-9 | Correct rendering of math formulas inside LTR wrappers in RTL context |
| **FEAT-07** | Multi-Tenant URL Routing | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | URL partition `/owner` vs `/center/[centerSlug]` |
| **FEAT-08** | Tenant Resolution Middleware | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | Rejection of invalid tenant slugs and cross-tenant access |
| **FEAT-09** | 8-Role RBAC Model | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3, AC-5, AC-6 | Distinct permission matrix for all 8 roles |
| **FEAT-10** | Student Profile Guardrail | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-4, AC-5 | Student updates `avatar_url` (200 OK); admin fields return 403 Forbidden |
| **FEAT-11** | Teacher Profile Guardrail | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-6 | Teacher updates `avatar_url` (200 OK); salary rate / peers return 403 Forbidden |
| **FEAT-12** | Center-to-Center Tenant Isolation | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | Center A credentials cannot read or query Center B data |
| **FEAT-13** | Multi-Branch Management | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | Branch data strictly partitioned by center tenant ID |
| **FEAT-14** | Classroom Timetable Conflicts | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | Room booking collision detection |
| **FEAT-15** | Student Enrollment Engine | Tier 1 | `tests/unit/compensation.test.ts` | AC-1, AC-2 | Enrollment status linked to billing model |
| **FEAT-16** | Dual Model Configuration | Tier 1 | `tests/unit/compensation.test.ts` | AC-1, AC-2 | Model A (Center Subscription) vs Model B (Private Lessons) |
| **FEAT-17** | Discount & Scholarship Engine | Tier 1 | `tests/unit/compensation.test.ts` | AC-2 | Percentage, fixed, and 100% free scholarship calculations |
| **FEAT-18** | Center Subscription Calculation | Tier 1 | `tests/unit/compensation.test.ts` | AC-1 | $[12, 15, 11, 14]$ @ 20 EGP = 260 EGP; 0 sessions = 0; canceled excluded |
| **FEAT-19** | Private Lessons Calculation | Tier 1 | `tests/unit/compensation.test.ts` | AC-2 | 100 EGP 70/30 = 70/30; 20% disc = 56/24; free = 0/0; zero rounding leakage |
| **FEAT-20** | Dual Invoiced vs Collected Tracking | Tier 1 | `tests/unit/compensation.test.ts` | AC-2 | Invoiced accrual vs collected cash settlement |
| **FEAT-21** | Teacher Advances & Payroll | Tier 1 | `tests/unit/compensation.test.ts` | AC-2, AC-6 | Advance deductions from final net payout |
| **FEAT-22** | Center Financial Management | Tier 1 | `tests/unit/compensation.test.ts` | AC-2 | Invoices, receipts, cashier shift balance reconciliation |
| **FEAT-23** | Reception Barcode/QR Scanner | Tier 3 | `tests/integration/attendance-idempotency.test.ts` | AC-7 | Barcode / QR student code ingestion |
| **FEAT-24** | Immediate Verification HUD | Tier 3 | `tests/integration/attendance-idempotency.test.ts` | AC-7 | Fast return of student photo, group, and payment status |
| **FEAT-25** | Idempotent Attendance Logging | Tier 3 | `tests/integration/attendance-idempotency.test.ts` | AC-7 | Duplicate scans in same session produce exactly 1 record (`duplicate: true`) |
| **FEAT-26** | Live Stats & Compensation Updates | Tier 3 | `tests/integration/attendance-idempotency.test.ts` | AC-7 | Session count increments only on first valid check-in |
| **FEAT-27** | Hierarchical Materials Repository | Tier 3 | `tests/integration/ai-exam-gate.test.ts` | AC-8 | 6-tier hierarchy: Stage $\to$ Grade $\to$ Subject $\to$ Unit $\to$ Lesson $\to$ Docs |
| **FEAT-28** | Google Drive Sync & Text Indexing | Tier 3 | `tests/integration/ai-exam-gate.test.ts` | AC-8 | Extraction and indexing of document text |
| **FEAT-29** | AI Exam Preflight Validation Gate | Tier 3 | `tests/integration/ai-exam-gate.test.ts` | AC-8 | Rejection of unindexed or <200 word source documents |
| **FEAT-30** | In-Session AI Exam Generator | Tier 3 | `tests/integration/ai-exam-gate.test.ts` | AC-8 | Generation with KaTeX math and answer key |
| **FEAT-31** | Teacher Review Workflow | Tier 3 | `tests/integration/ai-exam-gate.test.ts` | AC-8 | Default draft status (`pending_teacher_review`, `is_published: false`) |
| **FEAT-32** | Branded Printable A4 Exam Export | Tier 4 | `tests/e2e/printable-exam-layout.test.ts` | AC-9 | Official logo top-left, teacher top-right, student name/code inputs, KaTeX |
| **FEAT-33** | Online Student Testing Platform | Tier 4 | `tests/e2e/student-exam-runner.test.ts` | AC-8, AC-10 | Timed runner, countdown timer, debounced autosave, automated MCQ grading |
| **FEAT-34** | WhatsApp Cloud API Integration | Tier 3 | `tests/integration/notifications.test.ts` | R6 | Template alerts for attendance, payments, exam results |
| **FEAT-35** | Firebase Cloud Messaging (Web Push) | Tier 3 | `tests/integration/notifications.test.ts` | R6 | Web push payloads for staff and students |
| **FEAT-36** | Non-Blocking Message Queue Engine | Tier 3 | `tests/integration/notifications.test.ts` | R6 | Atomic enqueue within <20ms; never blocks primary workflows |
| **FEAT-37** | Notification Opt-in & Delivery Log | Tier 3 | `tests/integration/notifications.test.ts` | R6 | Audit trail of dispatched, delivered, read, and simulated messages |
| **FEAT-38** | Notification Sandboxed Fallback | Tier 3 | `tests/integration/notifications.test.ts` | R6, AC-7 | In-memory outbox delivery without external credentials |
| **FEAT-39** | Notification Live Inspector UI | Tier 3 | `tests/integration/notifications.test.ts` | R6 | Observable outbox stream for verification |
| **FEAT-40** | Supabase Normalized 3NF Schema | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3 | Relational schema integrity and constraints |
| **FEAT-41** | Row Level Security (RLS) Policies | Tier 2 | `tests/security/rbac-guardrails.test.ts` | AC-3, AC-5, AC-6 | Database-level tenant and role restriction enforcement |
| **FEAT-42** | Sandboxed Mock Data Provider | Tier 1-4 | All test suites | All ACs | Fully isolated data layer for offline and demo execution |

---

## 3. Test Architecture & Directory Layout

### 3.1 Test Suite Directory Structure
```
tests/
├── setup.ts                               # Vitest global environment setup & DOM matchers
├── fixtures/                              # Deterministic test entities, mocks, and contract bridge
│   ├── contract-bridge.ts                 # Clean bridge between tests and implementation contracts
│   ├── test-tenants.ts                    # Tenant A vs Tenant B mock contexts
│   └── test-exams.ts                      # Grounded academic materials and test questions
├── unit/                                  # Tier 1: Pure Domain Logic & Math Invariants
│   └── compensation.test.ts               # AC-1 (Center Subscription) & AC-2 (Private Lessons Split)
├── security/                              # Tier 2: RBAC & Multi-Tenant Isolation Guardrails
│   └── rbac-guardrails.test.ts            # AC-3 (Isolation), AC-4 (Avatar), AC-5 (Student 403), AC-6 (Teacher 403)
├── integration/                           # Tier 3: Operational Workflows & Concurrency
│   ├── attendance-idempotency.test.ts     # AC-7 (Reception scan duplicate deduplication)
│   ├── ai-exam-gate.test.ts               # AC-8 (AI Exam preflight gate & draft review workflow)
│   └── notifications.test.ts              # Non-blocking async message queue & sandboxed delivery
└── e2e/                                   # Tier 4: End-to-End System & Layout Validation
    ├── printable-exam-layout.test.ts      # AC-9 (Branded A4 layout, logo top-left, teacher top-right, KaTeX)
    └── student-exam-runner.test.ts        # Timed runner, countdown timer, autosave, MCQ auto-grading
```

### 3.2 Framework Configuration (`vitest.config.ts`)
- **Environment**: `jsdom` (enables DOM manipulation, React component testing, and DOM query verification).
- **TypeScript Aliases**: `@/` mapped to project root `./`.
- **Globals**: `describe`, `it`, `expect`, `beforeEach`, `vi` enabled globally.
- **Coverage Provider**: V8 engine reporting statement, branch, function, and line coverage.

---

## 4. Real-World Testing Scenarios & Invariant Specifications

### Scenario 1: Center Subscription Monthly Payroll (AC-1)
- **Context**: A teacher completes a teaching cycle with 6 scheduled sessions:
  - 4 sessions successfully conducted with attendance counts $[12, 15, 11, 14]$.
  - 1 session canceled due to weather.
  - 1 session postponed.
- **Expected Mathematical Invariant**:
  $$\text{Conducted Sessions} = 4$$
  $$\text{Total Valid Attendance} = 12 + 15 + 11 + 14 = 52$$
  $$\text{Average Attendance} = \frac{52}{4} = 13.00$$
  $$\text{Total Compensation} = 13.00 \times 20.00\text{ EGP} = 260.00\text{ EGP}$$
- **Zero-Conducted Sessions Guard**:
  When all sessions in a month are canceled ($|\text{Conducted}| = 0$), the formula returns `0.00 EGP` without triggering a division-by-zero error or returning `NaN`.

### Scenario 2: Private Lessons Split with Leakage Invariant (AC-2)
- **Context**: 4 students enrolled in a private tutoring group at base fee $100.00\text{ EGP}$ with contractual split $70\%$ Teacher / $30\%$ Center:
  - Student 1: Standard enrollment (no discount) $\implies 100\text{ EGP}$. Expected: Teacher $70.00\text{ EGP}$, Center $30.00\text{ EGP}$.
  - Student 2: $20\%$ sibling discount $\implies 80\text{ EGP}$. Expected: Teacher $56.00\text{ EGP}$, Center $24.00\text{ EGP}$.
  - Student 3: $100\%$ scholarship $\implies 0\text{ EGP}$. Expected: Teacher $0.00\text{ EGP}$, Center $0.00\text{ EGP}$.
  - Student 4: Fixed discount $33.33\text{ EGP} \implies 66.67\text{ EGP}$. Expected: Teacher $46.67\text{ EGP}$, Center $20.00\text{ EGP}$.
- **Zero Rounding Leakage Invariant**:
  $$\forall j: \quad \text{Teacher Share}_j + \text{Center Share}_j \equiv \text{Net Revenue}_j$$
  Sum of teacher and center shares matches net eligible revenue to $0.00$ piastres.

### Scenario 3: Multi-Tenant Tenant Isolation & RBAC Guardrails (AC-3, AC-4, AC-5, AC-6)
- **Context**: Center A user authenticated with valid session attempts to query Center B student records or branches.
  - Expected: Zero records returned or HTTP 403 Forbidden.
- **Student Profile Lockdown**:
  - Updating `avatar_url` is permitted and persists ($200\text{ OK}$).
  - Attempting to update `name`, `student_code`, `grade`, `stage`, or `financial_balance` is strictly blocked with HTTP $403\text{ Forbidden}$.
- **Teacher Salary Guardrail**:
  - Teacher attempting to modify contractual fixed rates or revenue-sharing percentages receives HTTP $403\text{ Forbidden}$.
  - Teacher attempting to inspect peer teacher payroll ledgers receives HTTP $403\text{ Forbidden}$.

### Scenario 4: Fast Reception Check-In Idempotency (AC-7)
- **Context**: In a crowded reception lobby, a student's barcode is scanned twice in rapid succession (<500ms) for Session #101.
  - **First Scan**: Creates attendance record with status `PRESENT`, timestamp recorded, session count incremented by 1, parent notification event queued, returns `isNewRecord: true, duplicate: false`.
  - **Second Scan**: Handled idempotently via `UNIQUE(session_id, student_id)`. Returns `duplicate: true`, displays previous check-in time, and strictly does NOT create a second row or increment session counts.

### Scenario 5: Grounded AI Exam Generation Gate (AC-8)
- **Context**: A teacher attempts to generate an automated exam for a lesson:
  - **Negative Test A**: Teacher selects an unindexed document $\implies$ Generation rejected with error code `UNINDEXED_SOURCE_DOCUMENTS`.
  - **Negative Test B**: Teacher selects indexed documents with total word count $<200$ words $\implies$ Generation rejected with error code `INSUFFICIENT_SOURCE_DOCUMENTS`.
  - **Positive Path**: Valid, comprehensive source documents ($>200$ indexed words) generate an exam structured with questions, KaTeX formulas, and answer keys.
  - **Review Invariant**: The generated exam is saved with `review_status: 'pending_teacher_review'` and `is_published: false`. It cannot be taken by students until the teacher approves it.

### Scenario 6: Branded Printable A4 Sheet Layout (AC-9)
- **Context**: Generating printable examination sheets for physical classroom testing.
  - Verification validates:
    1. Official Yalla Center logo element positioned in top-left quadrant (`#exam-header-logo`).
    2. Teacher name and credentials positioned in top-right quadrant (`#exam-header-teacher`).
    3. Student information box with Name, Student Code, Group, and Score blanks.
    4. Mathematical equations formatted as KaTeX rendering spans (`.katex`).

### Scenario 7: Online Student Examination Platform Runner
- **Context**: Student takes an online exam with 5 multiple-choice questions.
  - Active countdown timer initializes with total exam duration.
  - Selecting options triggers background debounced autosave.
  - Submitting computes instantaneous score:
    $$\text{Score} = \sum_{q \in \text{MCQs}} (\text{Selected}_q == \text{Correct}_q ? \text{Points}_q : 0)$$
  - Prevents resubmission after exam completion.

---

## 5. Coverage & Verification Thresholds

| Metric | Threshold | Verification Method |
|:---|:---:|:---|
| **Authoritative Acceptance Criteria (AC-1 to AC-10)** | **100% (10/10)** | Tiered test suite execution report |
| **Financial Math Statement Coverage** | **100%** | Vitest V8 code coverage report |
| **Financial Math Branch Coverage** | **100%** | Comprehensive edge-case test suite |
| **RBAC Security Guardrail Enforcement** | **100%** | Positive and negative HTTP 403 test matrix |
| **Rounding Leakage Tolerance** | **0.00 EGP** | Invariant assertion `netRevenue === teacherShare + centerShare` |
| **Idempotency Duplicate Scan Count** | **Exactly 1 row** | Invariant check on repeated check-in requests |
| **AI Exam Minimum Word Gate** | **200 words** | Strict preflight threshold assertion |

---

## 6. Execution Command Reference

```bash
# Run entire 4-Tier test suite
npx vitest run

# Run specific tiers
npx vitest run tests/unit/                 # Tier 1: Unit & Compensation Math
npx vitest run tests/security/             # Tier 2: RBAC & Tenant Security
npx vitest run tests/integration/          # Tier 3: Operational Workflows
npx vitest run tests/e2e/                  # Tier 4: Layout & Examination Runner

# Run with test coverage report
npx vitest run --coverage
```
