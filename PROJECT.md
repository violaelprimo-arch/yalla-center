# Project: Yalla Center

## Architecture
Yalla Center is a complete, production-ready, Arabic-first, multi-tenant educational center management SaaS platform developed by Yalla Codex.
The architecture comprises two isolated portals sharing a centralized Next.js 14/15 App Router application with Supabase PostgreSQL (or Data Access Layer with MockDataProvider fallback):

1. **Platform Owner Portal (`/owner`)**:
   - Super-admin management of tenant centers, platform subscriptions, global feature flags, and global metrics.
2. **Center Workspaces (`/center/[centerSlug]`)**:
   - Tenant-isolated operational environment with independent branding, branches, classrooms, staff, courses, groups, reception attendance, exams, materials, and finances.
3. **Core Processing Engines**:
   - **Dual Teacher Compensation Engine**: Center Subscription average attendance formula and Private Lessons net-revenue split with zero rounding leakage.
   - **Fast Reception Attendance Engine**: Barcode/QR scanning, instant verification HUD, database-level idempotent logging `UNIQUE(session_id, student_id)`.
   - **Hierarchical Materials & Grounded AI Exam Engine**: 6-tier taxonomy, text indexing, preflight validation gate, KaTeX math typesetting, branded printable A4 exports, and online testing runner.
   - **Asynchronous Notification Engine**: Event-driven queuing (<20ms transaction) for Meta WhatsApp Cloud API and Web Push FCM with sandboxed fallbacks.
4. **Data Access Layer & Security**:
   - Supabase PostgreSQL with 22 normalized 3NF tables, RLS policies, and an abstract `IDataProvider` backed by `MockDataProvider` for demo/offline execution.
   - Strict 3-tier security guardrails: Students and teachers can update only their own profile photo (`avatar_url`); all administrative, academic, and financial data is strictly read-only.

---

## Feature Inventory

| # | Feature ID | Feature Name | Description | Milestone | Source |
|---|------------|--------------|-------------|-----------|--------|
| 1 | FEAT-01 | Brand Assets Preservation | Preserve official logo files in public/brand without modification | M1 | R1, survey |
| 2 | FEAT-02 | Arabic Cairo RTL Typography | Configure Cairo font, dir="rtl", tabular numerals | M1 | R1, survey |
| 3 | FEAT-03 | Deep Navy & Cyan Design System | Palette tokens (Midnight Navy, Electric Cyan/Blue, elevated cards) | M1 | R1, survey |
| 4 | FEAT-04 | Dual Theme Engine | Dark/Light theme switching persisted in local storage / cookies | M1 | R1, survey |
| 5 | FEAT-05 | Responsive Viewports | Adaptive layouts for mobile, tablet, and desktop | M1 | R1, AC-10 |
| 6 | FEAT-06 | KaTeX Math Typesetting | Math formula rendering inside LTR spans within Arabic context | M1 | R1, R5 |
| 7 | FEAT-07 | Multi-Tenant URL Routing | Partitioned /owner and /center/[centerSlug] routes | M2 | R2, survey |
| 8 | FEAT-08 | Tenant Resolution Middleware | Extract centerSlug, validate status, inject tenant headers | M2 | R2, survey |
| 9 | FEAT-09 | 8-Role RBAC Model | Platform Owner, Center Admin, Branch Mgr, Receptionist, Accountant, Teacher, Parent, Student | M2 | R2, survey |
| 10 | FEAT-10 | Student Profile Guardrail | Student can update only avatar_url; all admin fields HTTP 403 & RLS locked | M2 | R2, AC-4, AC-5 |
| 11 | FEAT-11 | Teacher Profile Guardrail | Teacher can update only avatar_url; salary/rates/peers HTTP 403 & RLS locked | M2 | R2, AC-6 |
| 12 | FEAT-12 | Center-to-Center Tenant Isolation | Center A users cannot access Center B data across UI/API/RLS | M2 | R2, AC-3 |
| 13 | FEAT-13 | Multi-Branch Management | CRUD branches with capacity, location, and branch manager | M2 | R2, survey |
| 14 | FEAT-14 | Classroom Timetable & Conflict Prevention | Conflict detection preventing overlapping bookings in same room | M2 | R2, survey |
| 15 | FEAT-15 | Student Enrollment Engine | Register students and enroll into courses/groups with payment models | M3 | R3, survey |
| 16 | FEAT-16 | Dual Model Configuration | Configure Center Subscription vs Private Lessons at subject/group level | M3 | R3, survey |
| 17 | FEAT-17 | Discount & Scholarship Engine | Percentage discounts, fixed amount discounts, and 100% free enrollments | M3 | R3, survey |
| 18 | FEAT-18 | Center Subscription Calculation | Average Attendance = Total Valid Attendance / Conducted Sessions * Fixed Rate | M3 | R3, AC-1 |
| 19 | FEAT-19 | Private Lessons Calculation | Split net eligible revenue (after discounts) between Center & Teacher without leakage | M3 | R3, AC-2 |
| 20 | FEAT-20 | Dual Invoiced vs Collected Tracking | Accrual vs cash tracking for teacher payroll and center cashflow | M3 | R3, survey |
| 21 | FEAT-21 | Teacher Advances & Payroll Management | Register advances, calculate net payout, approval workflow, PDF export | M3 | R3, survey |
| 22 | FEAT-22 | Center Financial Management | Invoices, receipts, partial payments, book inventory, cashier shifts | M3 | R3, survey |
| 23 | FEAT-23 | Reception Attendance Barcode/QR Scanner | Sub-300ms barcode/QR scanning and student code manual lookup | M4 | R4, survey |
| 24 | FEAT-24 | Immediate Student Verification HUD | Display photo, group name, session status, and payment alert badges | M4 | R4, survey |
| 25 | FEAT-25 | Idempotent Attendance Logging | UNIQUE(session_id, student_id) preventing duplicate scans & notifications | M4 | R4, AC-7 |
| 26 | FEAT-26 | Live Stats & Compensation Updates | Reactive updates to student history, session stats, and teacher tallies | M4 | R4, survey |
| 27 | FEAT-27 | Hierarchical Materials Repository | 6-tier taxonomy: Stage → Grade → Subject → Unit → Lesson → Documents | M5 | R5, survey |
| 28 | FEAT-28 | Google Drive Sync & Document Indexing | Link Drive folders, upload documents, extract and index text content | M5 | R5, survey |
| 29 | FEAT-29 | AI Exam Preflight Validation Gate | Reject exam generation if source documents unindexed or <200 words | M5 | R5, AC-8 |
| 30 | FEAT-30 | In-Session AI Exam Generator | Direct generation inside class session Tests tab with KaTeX and answer key | M5 | R5, survey |
| 31 | FEAT-31 | Teacher Review Workflow | Generated exams default to draft status for teacher review before publish | M5 | R5, AC-8 |
| 32 | FEAT-32 | Branded Printable A4 Exam Export | Logo top-left, teacher top-right, student name/code inputs, KaTeX equations | M5 | R5, AC-9 |
| 33 | FEAT-33 | Online Student Testing Platform | Timed test runner, countdown timer, autosave, auto-graded MCQs | M5 | R5, survey |
| 34 | FEAT-34 | WhatsApp Business Cloud API Integration | Template-based parent alerts for attendance, payments, exam results | M4 | R6, survey |
| 35 | FEAT-35 | Firebase Cloud Messaging (Web Push) | Web push notifications for students, parents, and center staff | M4 | R6, survey |
| 36 | FEAT-36 | Non-Blocking Message Queue Engine | Transactions enqueue notifications in <20ms without blocking on external APIs | M4 | R6, survey |
| 37 | FEAT-37 | Notification Opt-in & Delivery Logging | Audit log of dispatched, delivered, read, and failed messages | M4 | R6, survey |
| 38 | FEAT-38 | Notification Sandboxed Fallback | Mock notification provider with in-memory delivery log for demo mode | M4 | R6, survey |
| 39 | FEAT-39 | Notification Live Inspector UI | In-app dashboard view to inspect queued and dispatched notification events | M4 | R6, survey |
| 40 | FEAT-40 | Supabase Normalized 3NF Schema | 22 tables with foreign keys, checks, and composite indexes | M1 | R7, survey |
| 41 | FEAT-41 | Row Level Security (RLS) Policies | Enforce tenant isolation and role restrictions at database level | M1 | R7, survey |
| 42 | FEAT-42 | Offline / Sandboxed Mock Data Provider | Complete mock dataset enabling 100% functionality without live Supabase | M1 | R7, survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Brand Design System & Core Database Schema | Next.js setup, Tailwind RTL Cairo theme tokens, brand assets, Supabase PostgreSQL schema, DAL with MockDataProvider, base layout | none | DONE |
| M2 | Multi-Tenant Architecture, Portals & Strict Security Guardrails | /owner & /center/[centerSlug] routing, RBAC middleware, 3-tier student/teacher profile photo guardrails (403 for admin fields), branches & timetable | M1 | DONE |
| M3 | Student Enrollment & Dual Teacher Compensation Engine | Enrollment, Center Subscription formula, Private Lessons net revenue split, zero leakage, financial suite (invoices, receipts, payroll, cashier shifts) | M1, M2 | DONE |
| M4 | Fast Reception Attendance & Async Notification Engine | Barcode/QR scanning, verification HUD, idempotent attendance scan UNIQUE(session_id, student_id), live stats, non-blocking WhatsApp/FCM queue | M1, M2, M3 | PLANNED |
| M5 | Hierarchical Materials & In-Session AI Exam Platform | 6-tier materials taxonomy, Drive linking & text indexing, AI exam preflight rejection (<200 words), teacher review, KaTeX printable A4, online runner | M1, M2, M3 | PLANNED |
| M6 | Final Integration, 100% E2E Test Suite Pass & Adversarial Hardening | Pass 100% of E2E tests (Tiers 1-4 from E2E Testing Track) across AC-1 to AC-10, followed by Tier 5 adversarial hardening | M1, M2, M3, M4, M5, TEST_READY.md | PLANNED |

---

## Interface Contracts

### 1. Data Access Layer Contract (`lib/dal/index.ts`)
- `IDataProvider`:
  - `getTenant(slug: string): Promise<Tenant | null>`
  - `getUser(userId: string): Promise<User | null>`
  - `updateUserProfile(userId: string, role: Role, updates: Partial<User>): Promise<Result<User, ForbiddenError>>`
  - `getSessions(centerId: string, filter?: SessionFilter): Promise<Session[]>`
  - `recordAttendance(sessionId: string, studentId: string): Promise<{ isNewRecord: boolean, attendance: Attendance }>`
  - `calculateTeacherCompensation(teacherId: string, period: DateRange): Promise<TeacherCompensationReport>`
  - `generateExam(params: ExamGenerationParams): Promise<Result<Exam, PreflightError>>`
  - `enqueueNotification(event: NotificationEvent): Promise<void>`

### 2. Dual Teacher Compensation Contracts (`lib/finance/compensation.ts`)
- `calculateCenterSubscriptionCompensation(sessions: Array<{ id: string, attendanceCount: number, isCanceled: boolean }>, ratePerStudent: number): { conductedSessions: number, averageAttendance: number, totalCompensation: number }`
  - Invariants: If `conductedSessions === 0`, `averageAttendance = 0` and `totalCompensation = 0`. Canceled sessions are strictly excluded.
- `calculatePrivateLessonsSplit(grossPrice: number, discountType: 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100', discountValue: number, teacherPercent: number, centerPercent: number): { netRevenue: number, teacherShare: number, centerShare: number }`
  - Invariants: `teacherShare + centerShare === netRevenue`. 100% scholarship yields `netRevenue: 0, teacherShare: 0, centerShare: 0`.

### 3. Attendance Idempotency Contract (`lib/attendance/checkin.ts`)
- `recordReceptionScan(sessionId: string, studentCodeOrBarcode: string): Promise<ScanResult>`
  - Returns `{ success: true, duplicate: boolean, student: StudentCard, recordedAt: string }`
  - Under concurrent calls for the same `(sessionId, studentId)`, exactly one record is inserted and duplicate returns `duplicate: true` without enqueuing alerts.

### 4. Grounded AI Exam Contract (`lib/exam/generator.ts`)
- `validateExamSourceGroundedness(sourceDocumentIds: string[]): Promise<{ valid: boolean, errorCode?: 'UNINDEXED_SOURCE_DOCUMENTS' | 'INSUFFICIENT_SOURCE_DOCUMENTS', totalWordCount: number }>`
- `createExamDraft(params: ExamDraftParams): Promise<Exam>`
  - Invariants: Initial `review_status = 'pending_teacher_review'` and `is_published = false`.

### 5. Asynchronous Notification Contract (`lib/notifications/queue.ts`)
- `enqueueNotification(tenantId: string, recipient: string, channel: 'WHATSAPP' | 'FCM', templateId: string, payload: Record<string, any>): Promise<string>`
  - Non-blocking: executes within local DB transaction in <20ms.

---

## Code Layout

```
d:\Software\YALLA CODEX\YALLA CENTER\
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── owner/                          # Platform Owner Super-Admin Portal
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Owner Dashboard & Global Metrics
│   │   ├── centers/                    # Center Management CRUD
│   │   └── subscriptions/              # SaaS Subscriptions & Billing
│   ├── center/
│   │   └── [centerSlug]/               # Tenant-Isolated Educational Center Portal
│   │       ├── layout.tsx              # Tenant Layout with Deep Navy Sidebar
│   │       ├── page.tsx                # Center Overview Dashboard
│   │       ├── branches/               # Multi-Branch & Classroom Schedules
│   │       ├── students/               # Student Directory & Enrollment
│   │       ├── teachers/               # Teachers Directory & Rate Configuration
│   │       ├── reception/              # Fast Reception Attendance & QR Scanner
│   │       ├── sessions/               # Class Sessions & In-Session Tests Tab
│   │       ├── materials/              # 6-Tier Academic Materials Repository
│   │       ├── exams/                  # AI Exam Generator & Printable A4 Exports
│   │       │   ├── printable/[id]/     # Official Branded Printable A4 Sheet
│   │       │   └── runner/[id]/        # Online Student Testing Runner
│   │       ├── finance/                # Invoicing, Cashier Shifts & Payroll
│   │       ├── notifications/          # Live Notification Queue Inspector
│   │       └── profile/                # Profile View (Avatar upload only for students/teachers)
│   ├── api/
│   │   ├── auth/                       # Authentication endpoints
│   │   ├── center/
│   │   │   └── [centerSlug]/
│   │   │       ├── attendance/scan/    # Idempotent Scan Endpoint
│   │   │       ├── finance/            # Financial & Compensation Endpoints
│   │   │       ├── exams/              # Grounded AI Exam Generation Endpoints
│   │   │       └── notifications/      # Notification Dispatch & Inspector
│   │   └── profile/update-photo/       # Guarded Profile Photo Upload Endpoint
│   ├── layout.tsx                      # Root Layout (Cairo Font, dir="rtl")
│   └── globals.css                     # Semantic Theme Variables & KaTeX Styles
├── components/
│   ├── ui/                             # Buttons, Cards, Inputs, Badges, Modals
│   ├── brand/                          # Yalla Center Logo & Icon Preserving Brand Assets
│   ├── layout/                         # Deep Navy Sidebar, Header, User Menu
│   ├── attendance/                     # Reception Barcode Scanner HUD, Audio Chime
│   ├── exams/                          # KaTeX Formula Renderer, Printable A4 Sheet, Timer
│   └── notifications/                  # WhatsApp & Web Push Inspector Card
├── lib/
│   ├── dal/                            # Abstract Data Access Layer & MockDataProvider
│   ├── supabase/                       # Supabase client, migrations, RLS SQL scripts
│   ├── finance/                        # Dual Teacher Compensation & Financial Math
│   ├── attendance/                     # Idempotent Reception Attendance Engine
│   ├── materials/                      # Hierarchy Indexing & Google Drive Service
│   ├── exam/                           # Grounded AI Exam Generation & KaTeX Helpers
│   ├── notifications/                  # Async Notification Queue & Sandbox Provider
│   └── security/                       # RBAC Permission Guardrails & 403 Enforcers
├── public/
│   └── brand/                          # Official assets (icon, light/dark logos, wireframes)
├── tests/                              # Comprehensive Test Suite (Dual Track)
│   ├── unit/                           # Tier 1: Math formulas, leakage, zero conducted
│   ├── security/                       # Tier 2: Multi-tenant isolation & RBAC HTTP 403 guardrails
│   ├── integration/                    # Tier 3: Idempotent attendance, AI exam gate, notification queue
│   └── e2e/                            # Tier 4: Real-world workflows, A4 print layout, student exam
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vitest.config.ts
```
