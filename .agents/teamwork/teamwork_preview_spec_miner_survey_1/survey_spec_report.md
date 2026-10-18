# Yalla Center — Specification Mining & Comprehensive Feature Survey Report

**Document Version**: 1.0.0  
**Mining Agent**: Spec Miner Survey 1 (`teamwork_preview_spec_miner_survey_1`)  
**Timestamp**: 2026-10-18T01:40:00Z  
**Authoritative Source**: `ORIGINAL_REQUEST.md` (Integrity Mode: `demo`, Developed by: Yalla Codex)  
**Target Platform**: Arabic-first, Multi-Tenant Educational Center Management SaaS

---

## 1. Executive Summary & Specification Scope

Yalla Center is an enterprise-grade, Arabic-first, multi-tenant SaaS platform engineered specifically for educational centers, tutoring academies, and private educational institutions. The platform operates under a dual-portal architecture separating the global **Platform Owner** (`/owner`) from individual **Educational Centers** (`/center/[centerSlug]`).

### Core Value Drivers:
1. **Multi-Tenancy & Hard Boundaries**: Absolute tenant isolation across 8 distinct platform roles with zero data leakage.
2. **Dual-Model Teacher Compensation Engine**: Mathematical precision for both *Center Subscription* (Fixed session rate × average attendance) and *Private Lessons* (Net collected revenue percentage split), with strict division-by-zero protection and zero rounding leakage.
3. **Ultra-Fast Reception Attendance**: Sub-100ms barcode/QR student check-in with instantaneous visual identification, payment alerts, and database-enforced idempotency.
4. **Hierarchical Academic Materials & In-Session AI Exam Generation**: 6-level taxonomy linked to Google Drive, strictly grounded AI exam generation in KaTeX notation, branded printable A4 exports, and real-time online student examination.
5. **Non-Blocking Asynchronous Operations**: Decoupled messaging infrastructure ensuring reception check-ins and payments are never blocked by third-party communication APIs (Meta WhatsApp Cloud API, Firebase FCM).
6. **Strict Security Guardrails**: Students and teachers are restricted to profile photo updates only; all administrative, academic, and financial data is strictly read-only across UI, API endpoints, and database RLS.

---

## 2. Granular Requirements Enumeration (R1 – R7)

### R1. Brand Identity & Visual Design System
* **R1.1 Official Brand Assets Preservation**:
  - The official brand assets in `public/brand/` must be integrated verbatim without altering aspect ratios, typography, colors, or gradients:
    - `public/brand/yalla-center-icon.png` (Application icon / favicon / mobile icon)
    - `public/brand/yalla-center-logo-dark.png` (Logo for dark backgrounds / dark theme / navy sidebar)
    - `public/brand/yalla-center-logo-light.png` (Logo for light backgrounds / light theme / printable exports)
    - `public/brand/yalla-center-wireframes.jpg` (Approved wireframe reference)
* **R1.2 Arabic RTL First Architecture**:
  - Native Right-to-Left (`dir="rtl"`) layout across all interfaces.
  - Primary typography: `Cairo` font (Google Fonts Arabic subset) loaded via `next/font/google`.
  - Palette specification:
    - Deep Navy (`#0A192F`, `#0D1B2A`, `#1B2A4A`) for sidebars and executive headers.
    - Electric Blue / Cyan (`#0070F3`, `#00C2FF`, `#06B6D4`) for interactive elements, badges, focus states, and primary actions.
    - Soft elevated background cards (`bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800`).
* **R1.3 Theme Persistence & Centralized Tokens**:
  - Semantic design tokens defined in Tailwind CSS / CSS variables (`--background`, `--foreground`, `--primary`, `--card`, etc.).
  - Cohesive Dark and Light modes with instant toggle and persistent storage (localStorage / cookie).

### R2. Multi-Tenant Architecture & Strict Role Boundaries
* **R2.1 Portal Segregation**:
  - **Platform Owner Portal (`/owner`)**:
    - Global multi-tenant overview: total centers, active students, platform subscription revenue, system health.
    - Tenant lifecycle management: create center, configure subdomain/slug, suspend/reactivate, assign package tiers.
    - Global audit logs and platform configuration.
  - **Educational Center Portal (`/center/[centerSlug]`)**:
    - Tenant-scoped dashboard and navigation.
    - Branch-specific operational views, staff management, academic scheduling, and financial ledgers.
* **R2.2 The 8 Platform Roles**:
  1. `PLATFORM_OWNER`: Global administrator across all tenants.
  2. `CENTER_ADMIN`: Executive administrator of a single educational center tenant.
  3. `BRANCH_MANAGER`: Operational administrator scoped to one or more physical branches within a center.
  4. `RECEPTIONIST`: Front-desk operator handling barcode attendance, student lookup, and immediate cash receipts.
  5. `ACCOUNTANT`: Financial officer managing tuition invoices, partial payments, cashier shifts, teacher advances, and payroll.
  6. `TEACHER`: Academic instructor with read-only administrative access; manages curriculum materials, triggers AI exams, reviews tests, views own schedule and compensation.
  7. `PARENT`: Guardian with read-only access to linked children's attendance, grades, invoices, and notification feeds.
  8. `STUDENT`: Enrolled pupil with read-only access to enrolled groups, materials, timetable, exam platform, and results.
* **R2.3 Strict Read-Only Security Guardrails (Non-Negotiable)**:
  - **Allowed Writes for Students & Teachers**: Upload and update ONLY their own profile avatar image (`avatar_url`).
  - **Forbidden Writes**: Students and teachers are strictly forbidden from creating, updating, or deleting any administrative data:
    - Full name, national ID, phone numbers
    - Student code / Teacher code
    - Educational stage, grade, branch, or classroom
    - Assigned groups, subjects, or enrollments
    - Financial balances, invoices, discounts, or payment receipts
    - Teacher contractual salary rates or revenue-sharing percentages
    - Attendance records or session statuses
    - Exam scores, grade overrides, or academic records
  - **Enforcement Layers**:
    1. *Client UI*: Form inputs disabled/hidden, no mutation buttons rendered.
    2. *Server Action / API*: Validation schemas reject prohibited fields; return HTTP 403 Forbidden.
    3. *Database RLS*: Strict `CHECK` policies on Postgres tables preventing unauthorized column mutations.
* **R2.4 Multi-Branch & Classroom Scheduling**:
  - Support multiple physical branches per center (e.g. Branch Downtown, Branch West).
  - Classroom definition with capacity, facilities, and status.
  - Timetable scheduling with automatic collision detection:
    - Cannot book the same classroom for two overlapping groups.
    - Cannot book the same teacher for two overlapping groups.

### R3. Student Enrollment & Dual Teacher Compensation Engine
* **R3.1 Enrollment Models at Group/Subject Level**:
  - Center supports mixed enrollment models across groups:
    - **Center Subscription (نظام السنتر)**: Flat fee or monthly subscription where teacher is paid per session attendance.
    - **Private Lessons (نظام البرايفت)**: Direct course/subject fee where revenue is shared between center and teacher.
  - Discount engines:
    - Percentage discount (e.g., 20% off).
    - Fixed amount discount (e.g., 50 EGP off).
    - 100% Free scholarship enrollment (منحة دراسية / إعفاء كامل).
* **R3.2 Center Subscription Compensation Math**:
  $$\text{Average Attendance} = \frac{\sum \text{Valid Attendance in Conducted Sessions}}{\text{Number of Conducted Sessions}}$$
  $$\text{Compensation} = \text{Average Attendance} \times \text{Contractual Fixed Rate}$$
  - *Zero Division Handling*: If Conducted Sessions $= 0$, Compensation must return `0.00 EGP` without error.
  - *Session Exclusion*: Canceled sessions (`status = 'CANCELED'`) are completely omitted from both numerator and denominator.
* **R3.3 Private Lessons Compensation Math**:
  $$\text{Net Eligible Revenue} = \sum (\text{Base Price} - \text{Discount Amount})$$
  $$\text{Teacher Share} = \text{Net Eligible Revenue} \times \text{Teacher Percentage}$$
  $$\text{Center Share} = \text{Net Eligible Revenue} \times (1 - \text{Teacher Percentage})$$
  - Must accurately track *Invoiced Amount* vs. *Actually Collected Cash*.
  - 100% Free enrollments yield strictly 0.00 EGP teacher share and 0.00 EGP center share with zero rounding leakage.
* **R3.4 Financial Operations Suite**:
  - Invoicing: Group fee invoices, individual session invoices, book/material sales.
  - Partial Payments & Ledger: Running balance tracking, installment receipts.
  - Receipts: Printed & digital receipt with timestamp, cashier ID, student code, amount in figures and Arabic words.
  - Teacher Advances: Cash advance tracking deducted automatically from end-of-month payroll settlement.
  - Teacher Payroll: Settlement review, approval workflow, lock-down after payout, export to PDF/Excel.
  - Center Expenses: Operational expense tracking categorized by type (Rent, Utilities, Hospitality, Maintenance, Marketing).
  - Book & Material Inventory: Stock quantity, cost price, sale price, student handout logging.
  - Cashier Shift Closing (تقفيل الخزينة): Shift start cash, total collections (cash/card/transfer), total payouts, expected vs. actual drawer count, variance report.

### R4. Fast Reception Attendance System
* **R4.1 Scan & Lookup Speed**:
  - Support hardware barcode scanner (keyboard wedge), webcam QR code scanner, and manual numeric keypad entry.
  - Instant lookup response (<100ms) displaying:
    - Student profile image (for identity verification)
    - Full Name, Student Code
    - Grade & Educational Stage
    - Target Group & Assigned Teacher
    - Enrollment Status (Active, Suspended, Transferred)
    - Financial Banner: Clean (خالص), Outstanding Balance Due (عليه متبقي), Overdue Sessions (حصص غير مسددة), or Scholarship (إعفاء).
* **R4.2 Idempotent Check-in Logging**:
  - Enforced composite unique constraint: `UNIQUE(session_id, student_id)`.
  - Scanning the same barcode multiple times within the same session:
    - First scan: records attendance (`status = 'PRESENT'`), plays success chime, triggers stats update & parent event.
    - Subsequent scans: detects existing attendance, returns HTTP 200 with `status = 'ALREADY_RECORDED'`, displays clear Arabic warning with original check-in timestamp (`تم تسجيل الحضور مسبقاً الساعة 04:15 م`), and does NOT duplicate records or increment counts.
* **R4.3 Real-Time Side Effects**:
  - Atomic increment of session attendance counters.
  - Live recalculation of teacher compensation aggregates.
  - Emission of asynchronous parent notification payload.

### R5. Hierarchical Teacher Materials & In-Session AI Exam Platform
* **R5.1 Hierarchical Taxonomy (6-Tier Structure)**:
  $$\text{Stage} \rightarrow \text{Grade} \rightarrow \text{Subject} \rightarrow \text{Unit} \rightarrow \text{Lesson} \rightarrow \text{Documents}$$
  - Stage: e.g., المرحلة الثانوية (Secondary Stage)
  - Grade: e.g., الصف الثالث الثانوي (Third Secondary)
  - Subject: e.g., الفيزياء (Physics)
  - Unit: e.g., الوحدة الأولى: التيار الكهربي وقانون أوم (Unit 1)
  - Lesson: e.g., الدرس الأول: المقاومة الكهربية وقانون أوم (Lesson 1)
  - Documents: PDF, Word, text notes, Google Drive file attachments.
* **R5.2 Google Drive Integration & Text Indexing**:
  - Link teacher or center Google Drive folders.
  - Text extraction pipeline extracting text content from documents, chunking text into searchable, indexed knowledge units stored in PostgreSQL.
* **R5.3 In-Session AI Exam Generation**:
  - Located within the class session modal/page under the **Tests (الاختبارات)** tab.
  - Strict Grounding: Prompts strictly constrain generation to indexed lesson documents.
  - Insufficiency Guardrail: If no documents are attached or indexed text length is below minimum viable threshold (< 200 characters), generation is rejected with an explanatory Arabic error message.
  - Teacher Review & Approval: Generated exam is created in `status = 'DRAFT'`. Teacher can:
    - Preview questions and model answers
    - Edit question text, choice options, and explanations
    - Regenerate individual questions
    - Adjust mark allocation
    - Formally publish the exam (`status = 'PUBLISHED'`).
  - Mathematical & Scientific KaTeX: Seamless rendering of inline ($...$) and block ($$...$$) mathematical equations, fractions, matrices, and scientific symbols in both Arabic and English formats.
* **R5.4 Branded Printable A4 Exam Generation**:
  - Layout standard:
    - Top-Left: Official Yalla Center Logo (`yalla-center-logo-light.png`).
    - Top-Right: Teacher Name and Title (e.g. أ / محمد علي - مدرس أول الفيزياء).
    - Header Center: Subject, Grade, Exam Title, Total Time & Marks.
    - Student Identification Box: Name (`الاسم:`), Student Code (`كود الطالب:`), Group (`المجموعة:`), Date (`التاريخ:`), Score Box (`الدرجة:`).
    - Content Body: Clean two-column or single-column question layout with clear bubbles/brackets for MCQ, KaTeX rendered formulas, and ruled lines for essay questions.
    - Footer: Page numbers ("صفحة 1 من 3") and center branding watermark.
    - Answer Key Sheet: Optional printable model answer sheet for grading assistants.
* **R5.5 Secure Online Student Examination Platform**:
  - Full-screen examination view for enrolled students.
  - Synchronized server countdown timer preventing local clock manipulation.
  - Autosave: Every answer selection is instantly saved via background debounced API request.
  - Automated MCQ Grading: Instant automated scoring upon submission with detailed answer breakdown (if permitted by teacher settings).

### R6. Asynchronous Notification Center & External Services
* **R6.1 Notification Channels**:
  - Meta WhatsApp Business Cloud API: Template messages for:
    - Immediate attendance check-in confirmation to parents.
    - Immediate absence warning if student does not arrive 15 min after session start.
    - Exam grade notification with direct report card link.
    - Tuition invoice and payment receipt alerts.
  - Firebase Cloud Messaging (FCM): Web push notifications for PWA and browser clients.
* **R6.2 Delivery Tracking & Opt-in Ledger**:
  - Track phone numbers, country codes, parent consent / opt-in status.
  - Outbox message queue with status lifecycle: `QUEUED` $\rightarrow$ `SENDING` $\rightarrow$ `SENT` $\rightarrow$ `DELIVERED` / `FAILED`.
  - Delivery audit log with provider message ID, error codes, and retry counts.
* **R6.3 Non-Blocking Execution Invariant**:
  - Attendance recording, cashier transactions, and exam submissions must NEVER await external HTTP API calls to WhatsApp or Firebase.
  - Events are written to an internal queue table in the same local database transaction or dispatched via background worker.
  - External API failure, rate limiting, or network timeout has ZERO impact on reception or cashier response times.

### R7. Controlled Infrastructure & Data Safety
* **R7.1 Database & Security Architecture**:
  - Supabase PostgreSQL with relational integrity, foreign keys, cascading rules, and check constraints.
  - Row Level Security (RLS) on all tables ensuring multi-tenant isolation by `center_id`.
  - Service role / server-side bypass only for trusted internal batch jobs.
* **R7.2 File and Database Safety Invariant**:
  - Absolute ban on dropping tables or deleting existing project files without explicit authorization.
  - Soft-deletes (`deleted_at` timestamp) preferred for students, enrollments, and transactions to preserve audit history.
* **R7.3 Sandboxed / Mock External Integrations**:
  - Built-in sandboxed providers for WhatsApp, Google Drive, and AI generation when live production API credentials are not provided.
  - Deterministic mock responses allowing 100% test coverage and offline demo capability.

---

## 3. Acceptance Criteria Mapping & Verification Framework

| AC # | Acceptance Criterion | Functional Components Required | Verification Method & Test Target | Edge & Negative Test Cases | Invalidation Conditions |
|------|----------------------|--------------------------------|-----------------------------------|----------------------------|-------------------------|
| **AC-1** | Unit tests verify Center Subscription calculation: 4 classes with attendances `[12, 15, 11, 14]` at rate 20 EGP yield exactly 260 EGP; canceled classes are excluded; zero conducted classes returns 0 without error. | `calculateCenterSubscriptionCompensation(sessions, fixedRate)` | Jest / Vitest unit test suite covering: (1) Normal case `[12, 15, 11, 14]` @ 20 -> 260 EGP; (2) Canceled session ignored; (3) Zero conducted sessions -> 0. | - Array with canceled sessions: `[12, canceled(10), 15, 11, 14]` must yield 260 EGP.<br>- Empty session array: `[]` yields 0.00 EGP.<br>- Negative or zero rate yields 0.00 EGP. | Any division by zero error; inclusion of canceled session in count or sum; floating point drift (e.g. 259.9999). |
| **AC-2** | Unit tests verify Private Lessons calculation: 100 EGP price with 70/30 split yields 70 EGP / 30 EGP; 20% discount yields 56 EGP / 24 EGP; 100% free enrollment yields 0 EGP / 0 EGP without rounding leakage. | `calculatePrivateLessonSplit(price, discount, teacherPercent)` | Jest / Vitest unit test suite covering: (1) 100 EGP split 70/30; (2) 20% discount; (3) Fixed discount; (4) 100% free enrollment. | - Fractional split: 99.99 EGP with 70/30 split must round cents deterministically without disappearing pennies.<br>- 100% free discount must yield exactly 0 EGP for both. | Sum of teacher + center share != net revenue; non-zero share on 100% free enrollment; floating point inaccuracy. |
| **AC-3** | Multi-tenant isolation test verifies Center A administrator or user cannot access or query Center B data. | Supabase RLS policies on all tables filtering by `center_id` & API middleware verifying tenant context. | Integration test querying Center B records using Center A user session; assert empty result set or HTTP 403 / 404. | - Direct URL tampering: `/center/center-b/students` as Center A Admin.<br>- Direct SQL/Supabase client call passing mismatched `center_id`. | Any record from Center B returned in Center A context; ability to insert or update Center B records. |
| **AC-4** | Permission test verifies student can successfully update their own profile picture. | Storage bucket policy & user profile mutation endpoint allowing `avatar_url` update for `auth.uid() == user_id`. | E2E / API test: Student auth session posts new avatar image / updates `avatar_url`; assert HTTP 200 and image updated. | - Upload valid image file (PNG/JPEG).<br>- Verify updated URL persists and displays on student profile. | HTTP 403 when updating own avatar; avatar URL failing to persist. |
| **AC-5** | Permission test verifies student attempting to update their name, student code, grade, or financial balance receives HTTP 403 Forbidden. | API route / Server Action payload validator checking user role; RLS policy rejecting non-admin column modifications. | E2E / API test: Student auth session attempts PATCH/PUT with `{ name: "Hacked", balance: 0 }`; assert HTTP 403 Forbidden. | - Attempt payload with only `name`.<br>- Attempt payload with `student_code`.<br>- Attempt payload with `balance`.<br>- Attempt mass assignment. | Any status other than 403 (or 401); any successful database update of administrative fields by student. |
| **AC-6** | Permission test verifies teacher cannot alter contractual salary rates or access another teacher's financial statements. | Teacher payroll endpoint with strict teacher ID filtering; compensation rate column restricted to Center Admin. | E2E / API test: (1) Teacher attempts to update own salary rate -> 403.<br>(2) Teacher attempts to view Teacher B payroll ledger -> 403 / empty. | - Teacher querying `/api/teachers/[otherId]/payroll`.<br>- Teacher submitting mutation to `contractual_fixed_rate`. | Teacher viewing another teacher's earnings; teacher altering their own rate or split percentage. |
| **AC-7** | Idempotent attendance test verifies that scanning a student code twice in the same session records exactly one attendance record. | Attendance check-in service with `ON CONFLICT (session_id, student_id) DO NOTHING` or duplicate check. | Integration test: Call check-in endpoint twice with identical `(session_id, student_code)`. Count rows in `attendance` table; assert count == 1. | - Rapid concurrent double scan (race condition test).<br>- Scan already recorded student after 30 minutes; verify friendly response with previous check-in time. | Database error / crash on second scan; creation of duplicate row; incrementing session count twice. |
| **AC-8** | AI exam generator rejects exam creation if selected source materials are unindexed or insufficient, and places generated exams into teacher review before publishing. | AI exam generation service with input text validator and draft status workflow. | Integration / Unit test: (1) Request generation with 0 docs -> 400 error.<br>(2) Request with valid docs -> exam created in `status = 'DRAFT'`. | - Material has empty text.<br>- Material has text < 200 chars.<br>- Verify exam is not accessible to students while in DRAFT status. | Generator executing on empty source; generating hallucinated exam; exam immediately published without teacher review. |
| **AC-9** | Printable A4 exam preview and PDF layout contains official Yalla Center logo top-left, teacher name top-right, student name and code inputs, and correctly formatted KaTeX math equations. | Exam PDF / Print component with CSS print stylesheet, logo asset imports, and KaTeX rendering. | Playwright / visual inspection test verifying print preview DOM and PDF structure for required elements. | - Exam with complex math: $\frac{-b \pm \sqrt{b^2-4ac}}{2a}$.<br>- Verify logo renders top-left.<br>- Verify teacher name renders top-right.<br>- Verify student fields present. | Missing logo; inverted layout; unparsed raw LaTeX code (e.g. `\frac` shown as raw text); overflow on A4 page margins. |
| **AC-10** | Entire Next.js application builds without TypeScript or ESLint errors and is fully functional in Arabic RTL across desktop, tablet, and mobile breakpoints. | Next.js 14/15 App Router codebase with Tailwind CSS RTL support and TypeScript strict mode. | CLI build command `npm run build` exits 0 with 0 TypeScript/ESLint errors. Viewport tests on mobile (375px), tablet (768px), desktop (1280px). | - Test across RTL layout with sidebars, modal popups, tables, and print views.<br>- Verify no horizontal scrollbar leakage. | Any build error; TypeScript compile error; broken layout on mobile viewports; LTR directional bleeding. |

---

## 4. Exhaustive Feature Inventory

| Feature ID | Feature Name | Description | Req Source | Category | Dependencies | Acceptance Criteria Link |
|------------|--------------|-------------|------------|----------|--------------|--------------------------|
| **FEAT-01** | Brand Asset System | Fixed integration of official Yalla Center logos (dark/light/icon) preserving typography & aspect ratios | R1 | Brand & UI | None | AC-9, AC-10 |
| **FEAT-02** | Arabic RTL Layout Engine | Native Cairo font, `dir="rtl"`, deep navy sidebars, cyan accents, soft elevated cards | R1 | Brand & UI | FEAT-01 | AC-10 |
| **FEAT-03** | Centralized Theme Provider | Dynamic Light / Dark mode switching with persistent user selection | R1 | Brand & UI | FEAT-02 | AC-10 |
| **FEAT-04** | Platform Owner Portal | Global dashboard (`/owner`) for managing centers, subscriptions, and platform metrics | R2 | Multi-Tenancy | FEAT-02 | AC-3 |
| **FEAT-05** | Educational Center Portal | Multi-tenant tenant dashboard (`/center/[centerSlug]`) scoped to center operations | R2 | Multi-Tenancy | FEAT-02 | AC-3 |
| **FEAT-06** | 8-Role RBAC Authorization | Strict role hierarchy & access control for Owner, Admin, Manager, Reception, Accountant, Teacher, Parent, Student | R2 | Security & Auth | FEAT-04, FEAT-05 | AC-3, AC-4, AC-5, AC-6 |
| **FEAT-07** | Strict Student Read-Only Guardrail | Complete lockdown of student admin/academic/financial data; allow profile photo upload only | R2 | Security & Auth | FEAT-06 | AC-4, AC-5 |
| **FEAT-08** | Strict Teacher Read-Only Guardrail | Restrict teachers from modifying salary rates or viewing peers' financial data; allow profile photo upload only | R2 | Security & Auth | FEAT-06 | AC-6 |
| **FEAT-09** | Multi-Branch & Room Management | Multi-branch configuration with physical room capacity and resource tracking | R2 | Operations | FEAT-05 | AC-3 |
| **FEAT-10** | Timetable Conflict Detection | Automated validation preventing room or teacher schedule collisions | R2 | Operations | FEAT-09 | AC-10 |
| **FEAT-11** | Student Registry & Profiling | Center-level student management with unique barcode/QR code and guardian linkage | R3 | Academic Core | FEAT-05, FEAT-06 | AC-3, AC-5, AC-7 |
| **FEAT-12** | Dual Enrollment Model | Group-level enrollment supporting Center Subscription vs. Private Lessons | R3 | Academic Core | FEAT-11 | AC-1, AC-2 |
| **FEAT-13** | Discount & Scholarship Engine | Percentage discounts, fixed amount discounts, and 100% free enrollment handling | R3 | Finance | FEAT-12 | AC-2 |
| **FEAT-14** | Center Subscription Math Engine | Average attendance $\times$ fixed rate calculation excluding canceled sessions with zero-division safeguard | R3 | Finance | FEAT-12 | AC-1 |
| **FEAT-15** | Private Lessons Revenue Split | Net revenue splitting between Center and Teacher tracking invoiced vs. collected amounts | R3 | Finance | FEAT-12, FEAT-13 | AC-2 |
| **FEAT-16** | Tuition Invoicing & Partial Payments | Flexible student invoicing, installment payments, and running balance ledger | R3 | Finance | FEAT-11, FEAT-12 | AC-2 |
| **FEAT-17** | Digital & Printable Receipts | Branded receipt generation with Arabic number-to-words spelling and sequential numbering | R3 | Finance | FEAT-16 | AC-10 |
| **FEAT-18** | Teacher Advances & Payouts | Teacher cash advance disbursement and end-of-month payroll deduction | R3 | Finance | FEAT-14, FEAT-15 | AC-6 |
| **FEAT-19** | Teacher Payroll Settlement | Consolidated monthly payroll calculation, review, approval workflow, and export | R3 | Finance | FEAT-14, FEAT-15, FEAT-18 | AC-1, AC-2, AC-6 |
| **FEAT-20** | Center Expense Tracker | Categorized operational expense logging (rent, utilities, hospitality, supplies) | R3 | Finance | FEAT-05 | AC-3 |
| **FEAT-21** | Book & Material Inventory | Educational book inventory tracking, purchase costs, sale price, and student distribution | R3 | Operations | FEAT-05 | AC-3 |
| **FEAT-22** | Cashier Shift Management | Shift open/close workflow, cash drawer count, discrepancy reporting, and cashier handover | R3 | Finance | FEAT-16, FEAT-20 | AC-3 |
| **FEAT-23** | Fast Barcode/QR Reception Scanner | Sub-100ms hardware barcode and webcam QR scanning with manual code fallback | R4 | Reception | FEAT-11 | AC-7 |
| **FEAT-24** | Instant Student Verification Card | Instant visual card displaying photo, grade, group, status, and financial alert badge | R4 | Reception | FEAT-23 | AC-7 |
| **FEAT-25** | Idempotent Attendance Engine | Database-enforced duplicate scan prevention with friendly "already checked in" feedback | R4 | Reception | FEAT-23 | AC-7 |
| **FEAT-26** | Live Attendance Stats & Real-time Recalc | Instant session attendance tally and live compensation recalculation upon check-in | R4 | Reception | FEAT-25, FEAT-14 | AC-1, AC-7 |
| **FEAT-27** | Hierarchical Academic Taxonomy | 6-level taxonomy: Stage $\rightarrow$ Grade $\rightarrow$ Subject $\rightarrow$ Unit $\rightarrow$ Lesson $\rightarrow$ Documents | R5 | Academic Core | FEAT-05 | AC-8 |
| **FEAT-28** | Google Drive & Document Indexer | Google Drive folder sync, document upload, and text extraction/indexing pipeline | R5 | Academic Core | FEAT-27 | AC-8 |
| **FEAT-29** | In-Session AI Exam Generator | In-session Tests tab generator creating questions strictly grounded in indexed materials | R5 | AI & Testing | FEAT-28 | AC-8 |
| **FEAT-30** | Insufficient Material Guardrail | Automatic rejection of exam generation if source materials are missing or unindexed | R5 | AI & Testing | FEAT-29 | AC-8 |
| **FEAT-31** | Teacher Exam Review & Approval | Draft exam workflow allowing question editing, regeneration, mark allocation, and approval | R5 | AI & Testing | FEAT-29 | AC-8 |
| **FEAT-32** | KaTeX Mathematical Typesetting | Rendering mathematical and scientific formulas across questions, choices, and solutions | R5 | AI & Testing | FEAT-29 | AC-9 |
| **FEAT-33** | Branded Printable A4 Exam Export | Standardized A4 exam layout with Yalla Center logo top-left, teacher top-right, and student box | R5 | AI & Testing | FEAT-01, FEAT-31, FEAT-32 | AC-9 |
| **FEAT-34** | Secure Online Student Exam Platform | Timed student exam interface with server-synced countdown timer and anti-cheating signals | R5 | AI & Testing | FEAT-31, FEAT-32 | AC-10 |
| **FEAT-35** | Exam Autosave & Real-time Recovery | Debounced background autosave on every answer selection to prevent data loss | R5 | AI & Testing | FEAT-34 | AC-10 |
| **FEAT-36** | Automated MCQ Exam Grading | Instant grading of multiple-choice questions, score calculation, and student report card | R5 | AI & Testing | FEAT-34 | AC-10 |
| **FEAT-37** | Meta WhatsApp Cloud API Integration | Official WhatsApp template messaging for attendance, absence, grades, and fee alerts | R6 | Notifications | FEAT-25, FEAT-16, FEAT-36 | AC-7 |
| **FEAT-38** | Firebase Cloud Messaging (FCM) | PWA and web push notifications for schedule updates, announcements, and results | R6 | Notifications | FEAT-06 | AC-10 |
| **FEAT-39** | Non-Blocking Notification Queue | Asynchronous database queue worker ensuring zero UI latency from external API calls | R6 | Notifications | FEAT-37, FEAT-38 | AC-7 |
| **FEAT-40** | Notification Opt-in & Delivery Audit | Phone verification, consent tracking, delivery logs, status tracking, and retry handler | R6 | Notifications | FEAT-39 | AC-3 |
| **FEAT-41** | Supabase PostgreSQL Schema & RLS | Fully normalized multi-tenant relational schema with RLS policies on all tables | R7 | Infrastructure | None | AC-3, AC-4, AC-5, AC-6 |
| **FEAT-42** | External Service Mock & Sandbox Engine | Built-in mock providers for WhatsApp, Google Drive, and AI generator for testing & demo | R7 | Infrastructure | FEAT-28, FEAT-29, FEAT-37 | AC-1, AC-2, AC-8 |

---

## 5. Discovered Features & Edge Cases (Spec Miner Standard Tables)

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Brand | Official Assets Rendering | Render exact PNG icons and logos in navbars, sidebars, and exports | Asset path string | Displayed image element | Fallback text if missing | R1 Spec |
| 2 | Brand | Cairo Font RTL Typography | Arabic font rendering with correct line heights and numeral formatting | Text content | Stylized RTL Arabic typography | System Arabic font fallback | R1 Spec |
| 3 | Brand | Dark/Light Theme Switcher | Theme toggle persisting to local storage | User click event | CSS class toggle (`dark`) | Default to light or system theme | R1 Spec |
| 4 | Multi-Tenant | Portal Path Segregation | Strict route separation for `/owner` and `/center/[slug]` | URL pathname | Corresponding portal layout | 404 or redirect to login | R2 Spec |
| 5 | Security | Student Profile Photo Upload | Allow student to upload new avatar image | Image file (PNG/JPEG) | Updated `avatar_url` | HTTP 400 on invalid file format | R2 Spec, AC-4 |
| 6 | Security | Student Admin Lockdown | Block student from editing name, code, balance, grade | Update payload | HTTP 403 Forbidden | Rejection with Arabic error message | R2 Spec, AC-5 |
| 7 | Security | Teacher Salary Rate Lockdown | Block teacher from editing salary rate or viewing other teachers' ledgers | Update payload | HTTP 403 Forbidden | Rejection with Arabic error message | R2 Spec, AC-6 |
| 8 | Operations | Classroom Collision Blocker | Prevent scheduling two groups in same room at same time | Room, Day, Time range | Schedule creation confirmation | Conflict error displaying overlapping group | R2 Spec |
| 9 | Operations | Teacher Collision Blocker | Prevent scheduling teacher for two concurrent sessions | Teacher, Day, Time range | Schedule creation confirmation | Conflict error displaying overlapping group | R2 Spec |
| 10 | Finance | Center Subscription Compensation | Compute average attendance $\times$ rate across conducted sessions | Session list, Fixed rate | Total compensation amount (EGP) | Returns 0 EGP on zero sessions | R3 Spec, AC-1 |
| 11 | Finance | Private Lesson Revenue Split | Split net revenue between center and teacher | Base price, Discount, % Split | Teacher share, Center share | Returns 0/0 on 100% free discount | R3 Spec, AC-2 |
| 12 | Finance | Partial Payment & Balance | Record installment and update student balance | Student ID, Payment amount | Payment receipt, New balance | Error if payment > balance | R3 Spec |
| 13 | Finance | Cashier Shift Close Out | Tally shift receipts and compare with cash in drawer | Cashier ID, Counted cash | Shift closure summary & variance | Flag discrepancy if cash mismatch | R3 Spec |
| 14 | Reception | Barcode Scanner Ingestion | Parse barcode string from hardware wedge or webcam | Barcode string | Student match data | Beep error if code not found | R4 Spec |
| 15 | Reception | Attendance Idempotency Check | Ensure one attendance record per session per student | Student ID, Session ID | Check-in success or already checked-in | Status code 200 with friendly warning | R4 Spec, AC-7 |
| 16 | Academic | 6-Tier Material Hierarchy | Navigate Stage $\rightarrow$ Grade $\rightarrow$ Subject $\rightarrow$ Unit $\rightarrow$ Lesson $\rightarrow$ Doc | Parent node ID | Child node list | Empty list if no children | R5 Spec |
| 17 | Academic | Text Indexing Pipeline | Extract and store text chunks from uploaded/linked materials | Document binary / text | Indexed text records | Error log if document unreadable | R5 Spec, AC-8 |
| 18 | Testing | Grounded AI Exam Generation | Generate questions strictly from lesson indexed text | Lesson ID, Question counts | Draft exam with questions & answers | Error if text insufficient (<200 chars) | R5 Spec, AC-8 |
| 19 | Testing | KaTeX Formula Rendering | Parse and render math syntax like $\frac{a}{b}$ or $\sqrt{x}$ | LaTeX formula string | Rendered KaTeX DOM elements | Fallback to raw string on syntax error | R5 Spec, AC-9 |
| 20 | Testing | Printable A4 Exam Layout | Generate print-ready A4 HTML/PDF with official logos | Exam ID | Printable A4 layout | Render error if exam not found | R5 Spec, AC-9 |
| 21 | Testing | Timed Online Exam Runner | Run synchronized timed exam with autosave | Exam ID, Student ID | Answer submissions & live timer | Auto-submit when timer expires | R5 Spec, AC-10 |
| 22 | Notifications| Async Message Outbox Queue | Insert notification tasks into background table | Event type, Recipient, Payload | Queue record ID | Error logged without failing parent task | R6 Spec, AC-7 |
| 23 | Notifications| WhatsApp Cloud API Sender | Dispatch templated WhatsApp messages to parent phone | Phone, Template name, Vars | Meta Message ID | Retry on network failure | R6 Spec |

### Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Center Subscription Math | 0 conducted sessions (`sessions = []`), rate = 50 EGP | Returns `0.00 EGP` cleanly without division-by-zero exception |
| 2 | Center Subscription Math | 4 sessions: `[12, Canceled(10), 15, 11, 14]`, rate = 20 EGP | Excludes canceled session: `(12+15+11+14)/4 = 13.0` $\rightarrow$ `13 × 20 = 260.00 EGP` |
| 3 | Private Lesson Split Math | Price = 100 EGP, Discount = 100% Free, Split = 70/30 | Net = 0 EGP $\rightarrow$ Teacher = 0.00 EGP, Center = 0.00 EGP (zero rounding leakage) |
| 4 | Private Lesson Split Math | Price = 100 EGP, Discount = 20%, Split = 70/30 | Net = 80 EGP $\rightarrow$ Teacher = 56.00 EGP, Center = 24.00 EGP |
| 5 | Private Lesson Split Math | Price = 33.33 EGP, Discount = 0, Split = 70/30 | Net = 33.33 EGP $\rightarrow$ Teacher = 23.33 EGP, Center = 10.00 EGP (sum equals 33.33) |
| 6 | Fast Reception Attendance | Rapid duplicate barcode scans (within 500ms) for same student | First scan inserts attendance record; second scan triggers unique conflict and returns `ALREADY_RECORDED` without incrementing count |
| 7 | Fast Reception Attendance | Scan student with overdue balance > 0 | Records attendance successfully but renders bright red alert banner on screen: `تنبيه: يوجد متبقي مالي 150 ج.م` |
| 8 | AI Exam Generator | Generate exam for lesson with no attached documents | Aborts generation immediately with Arabic validation error: `لا توجد مستندات مرفقة بهذا الدرس لتوليد الاختبار` |
| 9 | AI Exam Generator | Generate exam for lesson with document containing only 40 characters | Aborts generation with Arabic validation error: `المحتوى النصي للمستندات غير كافٍ لتوليد اختبار (أقل من الحد الأدنى)` |
| 10 | Security / RBAC | Student submits HTTP POST to update student name or balance | Server rejects request with HTTP 403 Forbidden and audit log entry |
| 11 | Security / RBAC | Student uploads valid PNG profile image (< 2MB) | Server accepts upload, stores in `avatars` bucket, updates `avatar_url`, returns HTTP 200 |
| 12 | Security / RBAC | Teacher attempts to query payroll report of another teacher | Server returns HTTP 403 Forbidden or empty dataset |
| 13 | Multi-Tenancy | Center Admin for "Center Alpha" navigates to `/center/center-beta/students` | System validates tenant slug against user membership; returns HTTP 404 or HTTP 403 |
| 14 | Print Layout | KaTeX equation in exam title and questions printed to A4 PDF | Renders crisp vector equations with zero text clipping or page overflow |
| 15 | Notifications | Meta WhatsApp API down or rate limited (HTTP 500 / 429) | Reception attendance check-in finishes in < 50ms; notification task in queue marked `FAILED` with retry schedule |

---

## 6. Comprehensive 8-Role Permissions Matrix & Security Guardrails

The platform defines eight distinct roles. In accordance with strict security requirements:
- **Students & Teachers** are restricted to updating **ONLY their own profile picture** (`avatar_url`).
- All administrative, financial, curricular, attendance, and exam-grade data is **strictly read-only** for students and teachers.

### Role Permission Matrix Table
Legend:
- `C` = Create
- `R` = Read
- `U` = Update
- `D` = Delete
- `OWN` = Allowed only on own record
- `NONE` = Strict Forbidden (HTTP 403 / RLS Deny)

| Operational Domain | Platform Owner | Center Admin | Branch Manager | Receptionist | Accountant | Teacher | Parent | Student |
|--------------------|----------------|--------------|----------------|--------------|------------|---------|--------|---------|
| **Platform Tenants & Subscriptions** | C / R / U / D | NONE | NONE | NONE | NONE | NONE | NONE | NONE |
| **Center Settings & Branding** | R / U | C / R / U | R | R | R | R (Read-Only) | NONE | NONE |
| **Branches & Rooms** | R | C / R / U / D | R / U (Own Branch) | R | R | R (Read-Only) | NONE | NONE |
| **Staff & User Accounts** | C / R / U / D | C / R / U / D | R / U (Branch Staff) | NONE | NONE | NONE | NONE | NONE |
| **Student Profiles & Registry** | R | C / R / U / D | C / R / U | C / R / U | R | R (Read-Only) | R (Own Children) | R (Own Profile) |
| **Profile Photo (Avatar Upload)** | C / R / U / D | C / R / U / D | C / R / U / D | C / R / U / D | C / R / U / D | **U (OWN ONLY)** | **U (OWN ONLY)** | **U (OWN ONLY)** |
| **Administrative Data (Name, Code, Grade)** | C / R / U / D | C / R / U / D | C / R / U | C / R / U | R | **NONE (Read-Only)**| **NONE (Read-Only)**| **NONE (Read-Only)**|
| **Group & Class Scheduling** | R | C / R / U / D | C / R / U / D | R | R | R (Own Groups) | R (Own Schedule)| R (Own Schedule)|
| **Student Enrollment & Pricing** | R | C / R / U / D | C / R / U | C / R / U | R | **NONE (Read-Only)**| **NONE (Read-Only)**| **NONE (Read-Only)**|
| **Discounts & Free Scholarships** | R | C / R / U / D | C / R / U | NONE | C / R / U | **NONE (Read-Only)**| **NONE (Read-Only)**| **NONE (Read-Only)**|
| **Attendance Check-in (Barcode/QR)** | R | C / R / U / D | C / R / U / D | C / R / U | R | R (Own Groups) | R (Own Children)| R (Own History) |
| **Teacher Contractual Salary Rates** | R | C / R / U / D | NONE | NONE | R | **NONE (Read-Only)**| **NONE** | **NONE** |
| **Teacher Payroll & Settlements** | R | C / R / U / D | NONE | NONE | C / R / U | R (Own Settlement)| **NONE** | **NONE** |
| **Invoicing & Tuition Collection** | R | C / R / U / D | R | C / R (Receipts)| C / R / U / D | **NONE** | R (Own Invoices)| R (Own Invoices)|
| **Cashier Shift Opening & Closing** | R | C / R / U / D | R / U | C / R / U (Own) | C / R / U | **NONE** | **NONE** | **NONE** |
| **Center Operational Expenses** | R | C / R / U / D | R / C (Branch) | NONE | C / R / U / D | **NONE** | **NONE** | **NONE** |
| **Book & Materials Inventory** | R | C / R / U / D | C / R / U | C / R (Sell) | C / R / U / D | R (Assigned) | NONE | NONE |
| **Curriculum Taxonomy & Materials** | R | C / R / U / D | R | R | NONE | C / R / U / D (Own) | R (Assigned) | R (Assigned) |
| **Google Drive Linking & Indexing** | R | C / R / U / D | R | NONE | NONE | C / R / U / D (Own) | NONE | NONE |
| **In-Session AI Exam Generation** | R | C / R / U / D | R | NONE | NONE | C / R / U (Own Groups)| NONE | NONE |
| **Exam Review, Edit & Publishing** | R | C / R / U / D | R | NONE | NONE | C / R / U (Own Groups)| NONE | NONE |
| **Printable A4 Exam Export** | R | C / R / U | R | R (Print) | NONE | R / Export (Own) | NONE | NONE |
| **Online Exam Taking** | NONE | NONE | NONE | NONE | NONE | NONE | NONE | **C / U (Take Exam)**|
| **Exam Scores & Grade Overrides** | R | C / R / U / D | R | NONE | NONE | C / R / U (Own Groups)| R (Own Children)| **R (Read-Only)**|
| **WhatsApp / FCM Outbox Logs** | R | C / R / U / D | R | R (Status) | NONE | NONE | R (Own Messages)| R (Own Messages)|

---

## 7. Data Entities, Schema, and Relational Constraints

```
                                 +-----------------------+
                                 |        tenants        |
                                 +-----------------------+
                                             | 1
                                             |
                      +----------------------+----------------------+
                      | N                                           | N
          +-----------------------+                     +-----------------------+
          |       branches        |                     |      users/auth       |
          +-----------------------+                     +-----------------------+
                      | 1                                           | 1
                      |                                             |
          +-----------------------+                     +-----------+-----------+
          |      classrooms       |                     | N         | N         | N
          +-----------------------+         +---------------+ +-----------+ +-----------+
                      | 1                   | teacher_profs | |  parents  | | students  |
                      |                     +---------------+ +-----------+ +-----------+
                      |                            | 1              | 1         | 1
                      |                            |                +-----+-----+
                      | N                          | N                    | N
          +-----------------------+                |           +-----------------------+
          |        groups         |----------------+           |      enrollments      |
          +-----------------------+                            +-----------------------+
                      | 1                                                 |
                      +--------------------+                              |
                      | 1                  | 1                            |
          +-----------------------+  +-----------------------+            |
          |       sessions        |  |     curriculum_*      |            |
          +-----------------------+  +-----------------------+            |
                      | 1                  | 1                            |
                      +---------+          |                              |
                      | N       | N        | N                            |
          +---------------+ +--------+ +-----------+                      |
          |  attendance   | | exams  | | materials |                      |
          +---------------+ +--------+ +-----------+                      |
                                | 1        |                              |
                                | N        +-------------+                |
                            +--------+                   |                |
                            | exam_  |                   |                |
                            | submis |                   |                |
                            +--------+                   |                |
                                                         |                |
+--------------------------------------------------------+----------------+-----+
| FINANCIAL & NOTIFICATION SUBSYSTEMS                                           |
| - invoices (tenant_id, student_id, amount, balance, status)                   |
| - invoice_items (invoice_id, description, amount, discount_amount)            |
| - payments (tenant_id, invoice_id, student_id, cashier_id, amount, method)    |
| - cashier_shifts (tenant_id, branch_id, cashier_id, start_cash, status)       |
| - teacher_payroll (tenant_id, teacher_id, period, calculated_comp, advances)  |
| - notifications_queue (tenant_id, channel, recipient, payload, status)         |
+-------------------------------------------------------------------------------+
```

### Table 1: `tenants` (Educational Centers)
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `name`: VARCHAR(255) NOT NULL (e.g. "سنتر الأوائل التعليمي")
- `slug`: VARCHAR(100) UNIQUE NOT NULL (e.g. "al-awaiel")
- `logo_url`: TEXT NULL
- `brand_colors`: JSONB DEFAULT '{"primary": "#0070F3", "sidebar": "#0A192F"}'::jsonb
- `is_active`: BOOLEAN DEFAULT TRUE
- `subscription_tier`: VARCHAR(50) DEFAULT 'STANDARD'
- `created_at`: TIMESTAMPTZ DEFAULT now()
- `updated_at`: TIMESTAMPTZ DEFAULT now()

### Table 2: `branches` (Center Branches)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `name`: VARCHAR(255) NOT NULL (e.g. "فرع الدقي")
- `address`: TEXT NULL
- `phone`: VARCHAR(50) NULL
- `manager_id`: UUID NULL (References staff user)
- `created_at`: TIMESTAMPTZ DEFAULT now()

### Table 3: `classrooms` (Rooms in Branch)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `branch_id`: UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE
- `name`: VARCHAR(100) NOT NULL (e.g. "قاعة 101 - مدرج ابن خلدون")
- `capacity`: INTEGER NOT NULL CHECK (capacity > 0)
- `has_projector`: BOOLEAN DEFAULT FALSE
- `is_active`: BOOLEAN DEFAULT TRUE

### Table 4: `users` (Platform Identity & Accounts)
- `id`: UUID (Primary Key, matching Supabase `auth.users.id`)
- `tenant_id`: UUID NULL REFERENCES tenants(id) ON DELETE CASCADE (NULL for Platform Owner)
- `role`: VARCHAR(50) NOT NULL CHECK (role IN ('PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT'))
- `name`: VARCHAR(255) NOT NULL
- `email`: VARCHAR(255) UNIQUE NULL
- `phone`: VARCHAR(50) NOT NULL
- `avatar_url`: TEXT NULL
- `is_active`: BOOLEAN DEFAULT TRUE
- `created_at`: TIMESTAMPTZ DEFAULT now()
- `updated_at`: TIMESTAMPTZ DEFAULT now()

### Table 5: `students` (Student Domain Profile)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `user_id`: UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT
- `student_code`: VARCHAR(50) NOT NULL (e.g. "STD-2026-0042")
- `barcode`: VARCHAR(100) NOT NULL
- `stage_id`: UUID NOT NULL REFERENCES academic_stages(id)
- `grade_id`: UUID NOT NULL REFERENCES academic_grades(id)
- `parent_id`: UUID NULL REFERENCES users(id)
- `parent_phone`: VARCHAR(50) NOT NULL
- `whatsapp_enabled`: BOOLEAN DEFAULT TRUE
- `financial_balance`: NUMERIC(10,2) DEFAULT 0.00 CHECK (financial_balance >= 0)
- `status`: VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRANSFERRED', 'GRADUATED'))
- **Unique Constraint**: `UNIQUE(tenant_id, student_code)`
- **Unique Constraint**: `UNIQUE(tenant_id, barcode)`

### Table 6: `teacher_profiles` (Teacher Contractual Profile)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `user_id`: UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT
- `specialty_subject`: VARCHAR(150) NOT NULL
- `contract_model`: VARCHAR(50) NOT NULL CHECK (contract_model IN ('CENTER_SUBSCRIPTION', 'PRIVATE_LESSONS', 'HYBRID'))
- `contractual_fixed_rate`: NUMERIC(10,2) DEFAULT 0.00 CHECK (contractual_fixed_rate >= 0)
- `private_lesson_share_percent`: NUMERIC(5,2) DEFAULT 0.00 CHECK (private_lesson_share_percent >= 0 AND private_lesson_share_percent <= 100)
- `google_drive_folder_id`: VARCHAR(255) NULL
- `bio`: TEXT NULL

### Table 7: `groups` (Classes / Batches)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `branch_id`: UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT
- `classroom_id`: UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT
- `teacher_id`: UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT
- `grade_id`: UUID NOT NULL REFERENCES academic_grades(id)
- `name`: VARCHAR(200) NOT NULL (e.g. "فيزياء 3 ثانوى - مجموعة السبت والأربعاء")
- `payment_model`: VARCHAR(50) NOT NULL CHECK (payment_model IN ('CENTER_SUBSCRIPTION', 'PRIVATE_LESSONS'))
- `default_session_price`: NUMERIC(10,2) NOT NULL CHECK (default_session_price >= 0)
- `schedule_day_of_week`: INTEGER NOT NULL CHECK (schedule_day_of_week BETWEEN 0 AND 6)
- `start_time`: TIME NOT NULL
- `end_time`: TIME NOT NULL
- `max_students`: INTEGER NOT NULL CHECK (max_students > 0)
- `is_active`: BOOLEAN DEFAULT TRUE

### Table 8: `enrollments` (Student Group Enrollments)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `student_id`: UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
- `group_id`: UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE
- `enrollment_type`: VARCHAR(50) NOT NULL CHECK (enrollment_type IN ('STANDARD', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SCHOLARSHIP'))
- `discount_percentage`: NUMERIC(5,2) DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
- `discount_fixed_amount`: NUMERIC(10,2) DEFAULT 0.00 CHECK (discount_fixed_amount >= 0)
- `agreed_session_price`: NUMERIC(10,2) NOT NULL CHECK (agreed_session_price >= 0)
- `status`: VARCHAR(50) DEFAULT 'ACTIVE'
- `joined_at`: TIMESTAMPTZ DEFAULT now()
- **Unique Constraint**: `UNIQUE(student_id, group_id)`

### Table 9: `sessions` (Individual Conducted / Scheduled Classes)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `group_id`: UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE
- `branch_id`: UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT
- `classroom_id`: UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT
- `session_date`: DATE NOT NULL
- `start_time`: TIME NOT NULL
- `end_time`: TIME NOT NULL
- `status`: VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'))
- `cancellation_reason`: TEXT NULL
- `conducted_at`: TIMESTAMPTZ NULL
- `total_present`: INTEGER DEFAULT 0
- `total_absent`: INTEGER DEFAULT 0

### Table 10: `attendance` (Fast Scan Attendance Records)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `session_id`: UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
- `student_id`: UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT
- `recorded_by`: UUID NOT NULL REFERENCES users(id) (Receptionist)
- `status`: VARCHAR(50) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE'))
- `check_in_time`: TIMESTAMPTZ DEFAULT now()
- `notification_dispatched`: BOOLEAN DEFAULT FALSE
- **Unique Constraint (Idempotency Enforcer)**: `UNIQUE(session_id, student_id)`

### Table 11: `materials` (Curriculum Document Store)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `teacher_id`: UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE
- `stage_id`: UUID NOT NULL
- `grade_id`: UUID NOT NULL
- `subject_id`: UUID NOT NULL
- `unit_id`: UUID NOT NULL
- `lesson_id`: UUID NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `file_url`: TEXT NULL
- `google_drive_file_id`: VARCHAR(255) NULL
- `extracted_text`: TEXT NULL
- `text_indexed_at`: TIMESTAMPTZ NULL
- `created_at`: TIMESTAMPTZ DEFAULT now()

### Table 12: `exams` (AI & Manual Examination Bank)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `session_id`: UUID NULL REFERENCES sessions(id) ON DELETE SET NULL
- `teacher_id`: UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT
- `lesson_id`: UUID NOT NULL
- `title`: VARCHAR(255) NOT NULL
- `duration_minutes`: INTEGER NOT NULL DEFAULT 30
- `total_marks`: NUMERIC(6,2) NOT NULL DEFAULT 20.00
- `pass_marks`: NUMERIC(6,2) NOT NULL DEFAULT 10.00
- `is_ai_generated`: BOOLEAN DEFAULT FALSE
- `source_material_ids`: JSONB DEFAULT '[]'::jsonb
- `status`: VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'))
- `created_at`: TIMESTAMPTZ DEFAULT now()

### Table 13: `exam_questions` (Individual Questions & KaTeX Notation)
- `id`: UUID (Primary Key)
- `exam_id`: UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE
- `question_number`: INTEGER NOT NULL
- `question_type`: VARCHAR(50) DEFAULT 'MCQ' CHECK (question_type IN ('MCQ', 'TRUE_FALSE', 'ESSAY'))
- `prompt_katex`: TEXT NOT NULL (Contains Arabic & KaTeX equations)
- `choices_json`: JSONB NULL (Array of choices `[{id: "A", text: "..."}]`)
- `correct_answer`: TEXT NOT NULL
- `explanation_katex`: TEXT NULL
- `marks`: NUMERIC(4,2) NOT NULL DEFAULT 1.00

### Table 14: `exam_submissions` (Student Test Takes & Auto-Grading)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `exam_id`: UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE
- `student_id`: UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
- `started_at`: TIMESTAMPTZ DEFAULT now()
- `submitted_at`: TIMESTAMPTZ NULL
- `answers_json`: JSONB DEFAULT '{}'::jsonb
- `auto_graded_score`: NUMERIC(6,2) DEFAULT 0.00
- `final_score`: NUMERIC(6,2) DEFAULT 0.00
- `status`: VARCHAR(50) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADED'))
- **Unique Constraint**: `UNIQUE(exam_id, student_id)`

### Table 15: `notifications_queue` (Asynchronous Notification Center)
- `id`: UUID (Primary Key)
- `tenant_id`: UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
- `channel`: VARCHAR(50) NOT NULL CHECK (channel IN ('WHATSAPP', 'FCM', 'SMS'))
- `recipient`: VARCHAR(100) NOT NULL (Phone number or device token)
- `template_name`: VARCHAR(100) NOT NULL
- `payload`: JSONB NOT NULL
- `status`: VARCHAR(50) DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'SENT', 'FAILED'))
- `retry_count`: INTEGER DEFAULT 0
- `error_message`: TEXT NULL
- `created_at`: TIMESTAMPTZ DEFAULT now()
- `sent_at`: TIMESTAMPTZ NULL

---

## 8. Mathematical & Domain Logic Formulation

### 8.1 Center Subscription (نظام السنتر) Teacher Compensation
Let:
- $S = \{ s_1, s_2, \dots, s_n \}$ be the set of all scheduled sessions for a group in the settlement billing period.
- $S_{\text{conducted}} = \{ s \in S \mid \text{status}(s) = \text{'COMPLETED'} \lor \text{status}(s) = \text{'IN\_PROGRESS'} \}$ (strictly excluding sessions where $\text{status}(s) = \text{'CANCELED'}$).
- $N = |S_{\text{conducted}}|$ be the count of conducted sessions.
- $A(s)$ be the number of confirmed present attendances in session $s$ ($status = \text{'PRESENT'}$).
- $R$ be the contractual fixed rate per student per session ($contractual\_fixed\_rate$).

$$\text{Compensation} = \begin{cases} 
0.00 & \text{if } N = 0 \\
\left( \frac{\sum_{s \in S_{\text{conducted}}} A(s)}{N} \right) \times R & \text{if } N > 0 
\end{cases}$$

#### Verification Test Vector (from AC-1):
- Given $S_{\text{conducted}} = [s_1, s_2, s_3, s_4]$ with attendance tallies $[12, 15, 11, 14]$.
- $N = 4$ sessions.
- Total Attendance $= 12 + 15 + 11 + 14 = 52$.
- Average Attendance $= \frac{52}{4} = 13.0$.
- Fixed Rate $R = 20.00 \text{ EGP}$.
- $\text{Compensation} = 13.0 \times 20.00 = 260.00 \text{ EGP}$ (Exact).
- If an additional canceled session $s_5$ exists with 10 marks: $s_5$ is excluded, $N$ remains 4, Compensation remains $260.00 \text{ EGP}$.
- If $N = 0$: returns $0.00 \text{ EGP}$ without ZeroDivisionError.

### 8.2 Private Lessons (نظام البرايفت) Revenue Splitting
Let:
- $P$ be the base session price.
- $E$ be an enrollment with discount rule:
  - If $E$ is Standard: $\text{Discount} = 0$.
  - If $E$ is Percentage Discount ($d_{\%}$): $\text{Discount} = P \times \frac{d_{\%}}{100}$.
  - If $E$ is Fixed Discount ($d_{\text{fixed}}$): $\text{Discount} = \min(P, d_{\text{fixed}})$.
  - If $E$ is Free Scholarship ($100\%$ Free): $\text{Discount} = P$.
- $\text{Net Eligible Price } P_{\text{net}} = \max(0.00, P - \text{Discount})$.
- $T_{\%}$ be the teacher contractual share percentage (e.g. $70\% = 0.70$).
- $C_{\%}$ be the center share percentage ($1.00 - T_{\%}$, e.g. $30\% = 0.30$).

$$\text{Teacher Share} = \text{round}_{\text{currency}}(P_{\text{net}} \times T_{\%})$$
$$\text{Center Share} = P_{\text{net}} - \text{Teacher Share}$$

*(Note: Center share is defined as $P_{\text{net}} - \text{Teacher Share}$ to guarantee exact zero rounding leakage: $\text{Teacher Share} + \text{Center Share} \equiv P_{\text{net}}$).*

#### Verification Test Vectors (from AC-2):
1. **Standard Full Price**:
   - $P = 100 \text{ EGP}$, $T_{\%} = 70\%$, $C_{\%} = 30\%$.
   - $P_{\text{net}} = 100.00 \text{ EGP}$.
   - Teacher Share $= 70.00 \text{ EGP}$, Center Share $= 30.00 \text{ EGP}$.
2. **20% Discount**:
   - $P = 100 \text{ EGP}$, $d_{\%} = 20\% \implies \text{Discount} = 20.00 \text{ EGP}$.
   - $P_{\text{net}} = 80.00 \text{ EGP}$.
   - Teacher Share $= 80.00 \times 0.70 = 56.00 \text{ EGP}$.
   - Center Share $= 80.00 - 56.00 = 24.00 \text{ EGP}$.
3. **100% Free Scholarship**:
   - $P = 100 \text{ EGP}$, Discount $= 100.00 \text{ EGP}$.
   - $P_{\text{net}} = 0.00 \text{ EGP}$.
   - Teacher Share $= 0.00 \text{ EGP}$, Center Share $= 0.00 \text{ EGP}$.

---

## 9. System Integration & Asynchronous Architecture

```
[ Reception Scanner / UI ]
             │
             │ HTTP POST /api/attendance/check-in
             ▼
┌────────────────────────────────────────┐
│  Atomic DB Transaction (PostgreSQL)    │
│  1. Check Unique (session_id, student) │
│  2. Insert attendance record           │
│  3. Increment session present count    │
│  4. Insert notification task to Queue  │
└────────────────────────────────────────┘
             │
             │ HTTP 200 OK (Instant Response < 100ms)
             ▼
[ Reception UI: Green Check + Student Card ]

──────────────────────────────────────────
[ Asynchronous Background Worker ]
             │
             │ Polls / Listens to notifications_queue
             ▼
┌────────────────────────────────────────┐
│ Process Outbox Notification Job        │
│ ├── Meta WhatsApp Cloud API            │
│ └── Firebase Cloud Messaging (FCM)     │
└────────────────────────────────────────┘
```

### 9.1 Reception Check-In Invariant
- **Total Request Latency Target**: $< 100\text{ms}$.
- **Zero Third-Party Dependency**: No outgoing external HTTP calls during the request lifecycle.
- **Queue Fallback**: If external notification service is unreachable or rate-limited, queue worker initiates exponential backoff retry ($2^k$ seconds) up to 5 attempts without impacting reception operations.

### 9.2 AI Exam Grounding & Validation Sequence
1. Teacher selects `Lesson` in session Tests tab and clicks **توليد اختبار بالذكاء الاصطناعي**.
2. Service queries indexed document chunks: `SELECT extracted_text FROM materials WHERE lesson_id = $1`.
3. Validation Gate:
   - If records are empty: Return HTTP 400 with `code = 'NO_MATERIALS'`.
   - If $\sum \text{length}(extracted\_text) < 200$ chars: Return HTTP 400 with `code = 'INSUFFICIENT_CONTENT'`.
4. AI Prompt Construction:
   - System prompt instructs model in Arabic to act as an authoritative exam creator strictly grounded in provided context chunks.
   - Enforces KaTeX formatting for all mathematical equations.
   - Outputs JSON schema with questions, choices, correct key, and KaTeX explanation.
5. Ingestion & Review:
   - Saves into `exams` with `status = 'DRAFT'`.
   - Saves questions into `exam_questions`.
   - Teacher reviews, edits, and explicitly publishes.

---

## 10. Printable A4 Exam Specification (RTL & KaTeX)

### 10.1 Page Geometry & Headers
- **Format**: Standard ISO A4 ($210\text{mm} \times 297\text{mm}$).
- **Margins**: $15\text{mm}$ top/bottom, $15\text{mm}$ left/right.
- **Direction**: Right-to-Left (`dir="rtl"`).
- **Typography**: Cairo font for Arabic text, standard Latin serif/sans-serif for English formulas.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo: yalla-center-logo-light.png]        [Teacher: أ / محمد علي]     │
│                    اختبار الفيزياء - الصف الثالث الثانوي               │
│                        الوحدة الأولى: قانون أوم                        │
├────────────────────────────────────────────────────────────────────────┤
│ اسم الطالب: __________________   كود الطالب: [________]   التاريخ: __/ __ │
│ المجموعة: ___________________   الدرجة الكلية: ( 20 )   درجة الطالب: [  ]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ س1: إذا زاد طول موصل للضعف وقلت مساحة مقطعه للنصف، فإن مقاومته:       │
│     (أ) تظل ثابتة                            (ب) تزداد للضعف           │
│     (جـ) تزداد لأربعة أمثالها               (د) تقل للنصف             │
│                                                                        │
│ س2: في الدائرة الكهربية الموضحة، شدة التيار المار تحسب من العلاقة:     │
│                                                                        │
│                       $I = \frac{V_B}{R + r}$                          │
│                                                                        │
│     احسب شدة التيار إذا كانت $V_B = 12\text{ V}$ و $R = 5\ \Omega$    │
│     و المقاومة الداخلية $r = 1\ \Omega$.                              │
│     .................................................................. │
│     .................................................................. │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ سنتر الأوائل التعليمي - منصة يلا سنتر            صفحة ( 1 ) من ( 2 )  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Complete Verification & Testing Matrix

| Tier | Test Scope | Focus Area | Command / Target | Required Result |
|------|------------|------------|------------------|-----------------|
| **Tier 1** | Math Unit Tests | Center Subscription Formula (AC-1) | `npm run test:math` | 100% pass (260 EGP, exclusion of canceled, zero sessions safeguard) |
| **Tier 1** | Math Unit Tests | Private Lessons Split Formula (AC-2) | `npm run test:math` | 100% pass (70/30 split, 20% discount, 100% free with 0 leakage) |
| **Tier 2** | Security & RBAC | Student Avatar Upload vs Admin Lockdown (AC-4, AC-5) | `npm run test:security` | Student avatar update returns 200; student admin field update returns 403 |
| **Tier 2** | Security & RBAC | Teacher Rate Lockdown & Multi-Teacher Privacy (AC-6) | `npm run test:security` | Teacher rate edit returns 403; cross-teacher financial query returns 403 |
| **Tier 2** | Multi-Tenancy | Tenant Isolation across Centers (AC-3) | `npm run test:tenant` | Cross-tenant database queries return 0 rows or 403 |
| **Tier 3** | Workflow Integration | Idempotent Reception Barcode Scan (AC-7) | `npm run test:attendance` | 2 consecutive scans yield exactly 1 attendance record and 1 count |
| **Tier 3** | AI & Exam Workflow | Grounding Validation & Draft Status (AC-8) | `npm run test:exams` | Empty material rejected with 400; valid material creates draft |
| **Tier 4** | E2E & Visual | Printable A4 Exam Layout & KaTeX (AC-9) | `npm run test:e2e` | Top-left logo, top-right teacher, student inputs, rendered KaTeX |
| **Tier 4** | Full System Build | Next.js Build & Strict Linting (AC-10) | `npm run build` | 0 TypeScript errors, 0 ESLint warnings, RTL responsiveness |

---
*Report certified by Spec Miner Survey 1 — Ready for Phase 1 Architecture & Milestone Synthesis.*
