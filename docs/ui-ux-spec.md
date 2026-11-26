# Yalla Center 2.0 — Authoritative UI/UX Specification, Page Map & Phase Dossier

**Document Status:** Authoritative Blueprint (Milestone M1 / F1 — Requirement R1 & R4)  
**Platform Stack:** Next.js 14 (App Router) · TypeScript (`strict: true`) · Tailwind CSS · Cloudflare Workers (`@opennextjs/cloudflare`) · Firebase Authentication · Cloud Firestore (`yalla-center`)  
**Primary Language & Direction:** Arabic (`lang="ar"`, `dir="rtl"`) with LTR isolation for mathematical formulas (`.katex`) and tabular alignment for numerical metrics (`.tabular-nums`).

---

## 1. Design System Specification (R4)

### 1.1 Official Brand Identity & Immutable Assets
All official brand files under `public/brand/` are **immutable** and MUST remain byte-for-byte unmodified across all milestones:

| Asset Path | Usage | Brand Component |
|---|---|---|
| `public/brand/yalla-center-icon.png` | Square app icon, collapsed sidebar emblem, mobile headers (`aspect-square`) | `components/brand/brand-icon.tsx` |
| `public/brand/yalla-center-logo-dark.png` | Full horizontal logo on Midnight Navy sidebars & dark mode surfaces | `components/brand/brand-logo-dark.tsx` |
| `public/brand/yalla-center-logo-light.png` | Full horizontal logo on light surfaces & printable A4 sheets | `components/brand/brand-logo-light.tsx` |
| `public/brand/yalla-center-wireframes.jpg` | Official visual reference blueprint | Read-only reference |

Adaptive logo rendering uses `components/brand/brand-logo.tsx` (`theme="auto" | "light" | "dark"`), toggling via CSS `dark:hidden` / `hidden dark:block`.

### 1.2 Color Palette & Semantic Tokens (`app/globals.css`, `tailwind.config.ts`)
Yalla Center 2.0 uses a high-contrast **Midnight Navy, Electric Blue, and Electric Cyan** visual language across both Light and Dark themes:

| Token / Role | Hex Value | CSS Variable / Tailwind Class | Usage |
|---|---|---|---|
| **Obsidian Night** | `#070B19` | `--brand-navy-950`, `--background` (dark), `brand-navy-950` | Dark app canvas background |
| **Midnight Navy** | `#0B132B` | `--brand-navy-900`, `--sidebar-background`, `--card` (dark), `brand-navy-900` | Persistent sidebar, dark cards, modal/drawer dark surface |
| **Deep Navy** | `#111A38` | `--brand-navy-850`, `--card-elevated` (dark), `--muted` (dark), `brand-navy-850` | Elevated dark containers, table headers, active sidebar items |
| **Slate Navy** | `#1C2541` | `--brand-navy-800`, `--border` (dark), `--sidebar-border`, `brand-navy-800` | Dark borders, dividers, subtle input outlines |
| **Electric Blue** | `#0066FF` | `--brand-blue-700`, `brand-blue-700`, `brand-cyan-800` | Primary gradient anchor, interactive chart accents, focus highlights |
| **Electric Cyan (Primary)** | `#00A3FF` | `--brand-blue-500`, `--primary`, `--ring`, `brand-cyan-600` | Primary actions, active sidebar indicator, ring focus |
| **Cyan Accent** | `#00C2FF` | `--brand-cyan-500`, `brand-cyan-500` | CTA buttons, glow highlights, chart gradients |
| **Light App Canvas** | `#F8FAFC` | `--bg-app`, `--background` (light) | Light mode page canvas |
| **Light Surface / Card** | `#FFFFFF` / `#F1F5F9` | `--bg-surface`, `--bg-surface-elevated` | Light cards, elevated panels |
| **Semantic Success** | `#10B981` | `--color-success` | Paid invoices, present attendance, positive trends |
| **Semantic Warning** | `#F59E0B` | `--color-warning` | Partial payments, pending approval, late arrivals |
| **Semantic Danger** | `#EF4444` | `--color-danger`, `--destructive` | Unpaid overdue alerts, absences, errors |
| **Semantic Info** | `#6366F1` | `--color-info` | Informational status & audit badges |

### 1.3 Typography, RTL & BiDi Rules
- **Font Family**: Google Font `Cairo` (`--font-cairo`, weights `300`–`900`, subsets `['arabic', 'latin']`) configured in `app/layout.tsx` and `tailwind.config.ts`.
- **Global Direction**: `<html lang="ar" dir="rtl">` and `body { direction: rtl; text-align: right; }`. Logical Tailwind spacing/positioning (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`, `border-e`) is mandatory across all components.
- **Numeric Precision (`.tabular-nums`)**: Applied to all financial totals, invoice amounts, payroll rates, attendance percentages, KPI readouts, countdown timers, and numeric table cells (`font-variant-numeric: tabular-nums`).
- **Equation BiDi Isolation (`.katex`)**: `.katex { direction: ltr !important; text-align: left !important; }` and `.katex-display` ensure math/physics/chemistry notation renders accurately inside Arabic RTL exams and materials via `components/ui/math-view.tsx`.
- **Directional Icons**: `components/ui/rtl-icon.tsx` (`<RTLIcon />`) automatically flips directional arrows and chevrons in RTL context (`rtl:rotate-180`).

### 1.4 Dark & Light Themes
- Controlled by `.dark` class on `<html>` (`darkMode: ['class']` in `tailwind.config.ts`), persisted in `localStorage('yalla-theme')`, initialized pre-hydration in `app/layout.tsx`, and toggled via `components/ui/theme-toggle.tsx`.
- Printable A4 exam/financial sheets (`@media print` in `app/globals.css`) always enforce `#FFFFFF` background and `#000000` ink regardless of active screen theme.

### 1.5 Mobile-Optimized Student & Parent UX
- Student (`/center/[centerSlug]/student-portal`) and Parent (`/center/[centerSlug]/parent-portal`) portals adopt a **mobile-first ergonomic shell**:
  - Sticky `MobileBottomNav` (`md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe`) with up to 5 high-frequency destinations and `min-h-[48px]` touch targets.
  - Bottom `Drawer` (`side="bottom"`) for child switching, notification details, and quick receipt previews.
  - Card-stacked responsive views on viewports `< 768px` paired with scrollable `DataTable` on larger screens.

### 1.6 GPU-Friendly Motion & `prefers-reduced-motion` Accessibility
- Keyframes in `app/globals.css` animate **strictly `transform` (`translate3d`, `scale`) and `opacity`**:
  - `yc-fade-slide-up` (`.animate-yc-page-enter`)
  - `yc-modal-in` (`.animate-yc-modal`)
  - `yc-drawer-in-start`, `yc-drawer-in-end`, `yc-drawer-in-bottom` (`.animate-yc-drawer-*`)
  - `yc-shimmer` (`.animate-yc-shimmer`)
- **CSS Safeguard**: `@media (prefers-reduced-motion: reduce)` reduces animation/transition durations to `0.01ms`, disables `.card-interactive:hover` transform lift, and halts shimmer/entrance animations.
- **JS Safeguard**: Interactive animations (such as `KpiCard` count-up) MUST guard `typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches` and immediately render final values when reduced motion is active.

### 1.7 UI Primitives Inventory (`components/ui/*`)
- **Existing Primitives**: `badge.tsx`, `button.tsx`, `card.tsx`, `math-view.tsx`, `rtl-icon.tsx`, `theme-toggle.tsx`.
- **M1 R4 Primitives**:
  - `components/ui/skeleton.tsx`: `Skeleton`, `SkeletonCard`, `SkeletonTableRows`, `SkeletonKpiGrid`, `SkeletonProfile` (Arabic `role="status"` + `sr-only`).
  - `components/ui/table.tsx`: `Table*` composable primitives + `DataTable<T>` (sorting with `aria-sort`, search/filter slots, loading skeletons, Arabic empty state, `tabular-nums`).
  - `components/ui/modal.tsx`: `Modal` (`role="dialog"`, `aria-modal="true"`, ESC/backdrop close, focus restore, GPU entrance).
  - `components/ui/drawer.tsx`: `Drawer` (`side="start" | "end" | "bottom"`, RTL logical edges, ESC/backdrop close, focus restore).
  - `components/ui/kpi-card.tsx`: `KpiCard` (trend badge, icon, `tabular-nums`, reduced-motion-safe count-up, loading state).
  - `components/ui/interactive-chart.tsx`: `InteractiveBarChart`, `InteractiveLineChart`, `InteractiveDonutChart`, `InteractiveChart` (pure SVG, Navy/Blue/Cyan palette, hover & keyboard-focus tooltips, zero `NaN` on empty/zero-sum data).
  - `components/ui/page-transition.tsx`: `PageTransition` (GPU `transform`/`opacity`, `motion-reduce:animate-none`).
  - `components/ui/collapsible-sidebar.tsx`: `CollapsibleSidebar` (desktop collapse `w-64`/`w-20` + mobile RTL drawer) & `MobileBottomNav` (`pb-safe`).

---

## 2. Full Page Map & Route Inventory (All 8 Portals + Public + Auth)

> **Canonical Tenant Rule**: Tenant slugs such as `al-maher` (`tenants/tenant-maher-001`) resolve canonically without mutating `tenant.slug` or silently auto-creating centers.

| Portal / Area | Existing Route(s) | Current Implementation & Verified Gaps | Target Route(s) & Target Backing |
|---|---|---|---|
| **Public Platform Site** | `/` (`app/page.tsx`) | Reads `SaasPlatformService` (`localStorage` + `INITIAL_*`) | `/` — Firestore-backed SaaS landing page (hero, features, live plans, inquiry form) |
| **Single Auth** | `/login` (`app/(auth)/login/page.tsx`) | Sets unsigned `yc_*` cookies; `workers.dev` demo bypass; `'password123'` fallback | `/login` — Single Firebase Auth login + verified server session + multi-center workspace selector; zero production demo fallback |
| **Public Center Website** | *Does not exist* | Only `/owner/website` exists for platform site | `/site/[centerSlug]` — Published public center website (hero, about, stages/subjects, teachers, timetable highlights, contact/inquiry form; respects `draft` vs `published` state) |
| **1. Platform Owner** | `/owner`, `/owner/centers`, `/owner/plans`, `/owner/subscriptions`, `/owner/requests`, `/owner/settings`, `/owner/website`, `/owner/finance` | 100% `SaasPlatformService` (`localStorage`); `OwnerSidebar` hardcodes badges (`'3 سناتر'`, `'جديد 2'`); `middleware.ts` checks unsigned `yc_role` | `/owner/*` (keep `/owner/subscriptions` alias) — Firestore-backed SaaS management, live sidebar badges, verified `PLATFORM_OWNER` guard |
| **2. Center Admin** | `/center/[centerSlug]`, `/admin`, `/stages`, `/subjects`, `/branches-list`, `/branches` (redirect), `/students`, `/teachers`, `/sessions`, `/materials`, `/exams`, `/finance`, `/notifications`, `/subscription`, `/profile` | Uses `MockDataProvider` & `SaasPlatformService`; missing Profile/Branding, Website Editor, and Reports/Audit History | Retain all operational routes (100% Firestore-backed) + add `/center/[centerSlug]/settings` (profile & branding), `/center/[centerSlug]/website` (draft/preview/publish public site editor), `/center/[centerSlug]/reports` (reports & audit history) |
| **3. Branch Manager** | `/center/[centerSlug]/branch` | Uses `MockDataProvider.getSessions`; omitted from `CENTER_NAV_ITEMS` | `/center/[centerSlug]/branch` (linked in role-filtered sidebar; branch-scoped KPIs, classrooms, today's sessions, branch attendance, branch staff/expenses) + scoped `/reception`, `/sessions`, `/students`, `/branches-list`, `/profile` |
| **4. Receptionist** | `/center/[centerSlug]/reception` | Uses `MockDataProvider` for `attendance/scan`; only `LessonExamScorePanel` hits Firestore | `/center/[centerSlug]/reception` (100% Firestore barcode/QR check-in, quick payments, cashier shift, lesson scores, parent notification trigger) + scoped `/students`, `/sessions`, `/profile` |
| **5. Teacher** | `/teacher/[centerSlug]`, `/center/[centerSlug]/teacher` (alias) | `TEACHER_TABS` defines 8 tabs, but UI renders only 4 (`account`, `schedule`, `students`, `extraSession`) | `/teacher/[centerSlug]` (and `/center/[centerSlug]/teacher` alias) rendering all **8 tabs**: `profile`, `schedule`, `students`, `materials`, `exams`, `account`, `extraSession`, `forum` + `/center/[centerSlug]/exams/printable/[id]` |
| **6. Accountant** | `/center/[centerSlug]/accountant`, `/center/[centerSlug]/finance` | `/accountant` renders hardcoded metrics (`14,250`, `9,800`, `4,450`) and is missing from sidebar; `/finance` reads `MockDataProvider` | `/center/[centerSlug]/accountant` (live Firestore KPIs & active shift summary, linked in sidebar) + `/center/[centerSlug]/finance` (unified payroll, shifts, invoices, payments, advances, expenses, immutable audits) + read-only `/teachers` & `/reports` |
| **7. Student** | `/center/[centerSlug]/student-portal`, `/exams/[examId]/run`, `/exams/runner/[id]`, `/exams/printable/[id]` | Hardcoded `STD-1001` arrays; `finance` tab blank; `middleware.ts` bypasses auth for `/student-portal` & `/exams/*` | `/center/[centerSlug]/student-portal` (auth-gated, mobile `MobileBottomNav`: overview, timetable, attendance, grades/exams, finance, materials, notifications) + auth-gated `/center/[centerSlug]/exams/[examId]/run` + `/center/[centerSlug]/profile` |
| **8. Parent** | `/center/[centerSlug]/parent-portal` | Hardcoded `CHILDREN_DATA`; `middleware.ts` treats portal as unauthenticated; no notification inbox | `/center/[centerSlug]/parent-portal` (auth-gated, verified `childStudentIds` multi-child switcher, attendance/grades/balance per child, mobile `MobileBottomNav`, in-app notifications inbox & read receipts) + `/center/[centerSlug]/profile` |

---

## 3. End-to-End User Workflows per Portal

### 3.0 Single Authentication & Multi-Center Workspace Switching (`/login`)
1. User opens `/login` and authenticates once via Firebase Authentication (Email/Password or Center-issued credentials).
2. Client sends `Authorization: Bearer <FirebaseIdToken>` to `POST /api/auth/session` / `GET /api/auth/me`.
3. Server verifies the token via Firebase Auth / Admin SDK, resolves active `memberships/{tenantId}_{uid}` documents, and returns `{ uid, email, displayName, memberships }` (empty list if none — **never** fabricating `CENTER_ADMIN` or trusting client cookies).
4. If the user has 1 active membership, app routes directly to their role's portal (`/owner`, `/center/[slug]/...`, `/teacher/[slug]`, etc.).
5. If the user belongs to **multiple centers**, a Center Switcher modal/drawer lists only their verified `memberships`. Switching centers calls server-verified tenant context selection, clears previous tenant client caches, and navigates cleanly without mixing tenant data.

### 3.1 Platform Owner (`/owner/*`)
1. **Dashboard (`/owner`)**: Views live SaaS KPIs (`KpiCard`), revenue/growth charts (`InteractiveChart`), and pending action queues (no hardcoded badges).
2. **Center Management (`/owner/centers`)**: Creates/suspends centers with canonical immutable `id` and `slug`, inspects tenant usage, and manages branch quotas.
3. **Plans & Subscriptions (`/owner/plans`, `/owner/subscriptions`)**: Configures subscription tiers, pricing, and feature limits; generates owner invoices and records center payments (`/owner/finance`).
4. **Requests & Support (`/owner/requests`)**: Reviews onboarding requests, complaints, and support sessions with audit trails.
5. **Central Settings & Platform Website (`/owner/settings`, `/owner/website`)**: Manages central AI quotas/ledgers, notification policies, and `/` platform landing configuration.

### 3.2 Center Admin (`/center/[centerSlug]/*`)
1. **Operations Setup**: Configures academic stages (`/stages`), subjects (`/subjects`), branches & classrooms (`/branches-list`), teachers & compensation agreements (`/teachers`), students & enrollments (`/students`), and weekly timetable/sessions (`/sessions`).
2. **Center Profile & Branding (`/center/[centerSlug]/settings`)**: Edits center Arabic/English name, phone, address, logo display settings, and approval workflow toggles (e.g., `requireMaterialApproval`). Save confirms Firestore persistence before displaying success.
3. **Public Center Website Editor (`/center/[centerSlug]/website`)**: Edits hero banner, featured courses/stages, teacher highlights, timetable preview, and contact info in `draft` mode → opens live `preview` → clicks `Publish` to update `center_websites/{tenantId}` and serve `/site/[centerSlug]`.
4. **Reports & Audit History (`/center/[centerSlug]/reports`)**: Filters immutable `audit_logs`, `financial_audits`, `lesson_grade_audits`, and attendance/revenue reports with CSV/Excel export.

### 3.3 Branch Manager (`/center/[centerSlug]/branch`)
1. Selects assigned branch (scoped by `membership.branchIds`).
2. Monitors branch-level KPIs, today's classroom schedule, active sessions, and attendance completion.
3. Reviews branch staff check-ins, classroom capacity utilization, and branch-level expenses within assigned `branchIds` only.

### 3.4 Receptionist (`/center/[centerSlug]/reception`)
1. Opens active shift & selects today's running session (`SessionSelector`).
2. Scans student Barcode/QR (`BarcodeListener` / `CameraQrScanner`) or checks in manually (`ManualCheckinTable`).
3. Server writes `center_attendance/{tenantId}~{sessionId}_{studentId}` and returns verified balance/alerts (`VerificationHud`).
4. If overdue balance exists, opens `QuickPaymentModal` (`Modal`) → records payment in `center_payments` + updates invoice `netAmount` status + updates shift cash drawer.
5. Enters lesson quiz grades in `LessonExamScorePanel` using rapid Enter-key navigation (`lesson_grades` + immutable `lesson_grade_audits`).
6. Attendance, payment, and grade commits transactionally enqueue `attendance.recorded`, `payment.recorded`, and `grade.published` events to `notification_outbox`.

### 3.5 Teacher Portal (`/teacher/[centerSlug]`, 8 Complete Tabs)
1. **الملف الشخصي (`profile`)**: Updates personal bio and uploads/changes profile photo (`validateProfilePhotoUpdate` whitelist only); views assigned subjects and rates (read-only).
2. **جدول السنتر (`schedule`)**: Views weekly assigned groups, branches, rooms, and upcoming sessions.
3. **الطلاب (`students`)**: Inspects enrolled students per assigned group, marks session attendance (own groups only), and enters lesson assessment scores (`lesson_exams` / `lesson_grades`).
4. **المذكرات والملازم (`materials`)**:
   - Organizes content across the **5-level folder taxonomy**: `stage -> grade -> subject -> unit -> lesson`.
   - Uploads files (PDF, Word `.doc`/`.docx`, PPTX, images) or links validated **Google Drive** URLs.
   - Edits material metadata and uploads **revised versions**, creating immutable snapshots in `center_material_versions`.
   - Opens **Version History Drawer** (`Drawer`) to inspect revisions and **restore** a prior snapshot (which creates a new forward version preserving audit history).
   - Opens **PDF Annotation Viewer** to add/edit/save highlights and notes (`center_material_annotations`) scoped by teacher ownership.
   - Controls lifecycle: `draft` → `pending_approval` (if center approval is enabled) → `published` / `unpublished`, emitting `material.published` when published.
5. **الامتحانات (`exams`)**: Runs grounded preflight against indexed own materials, generates/authors comprehensive exams with KaTeX math (`MathView`), previews A4 printable sheet (`/exams/printable/[id]`), and publishes to assigned groups (`teacherId`/`createdByUid` ownership enforced).
6. **كشف الحساب (`account`)**: Views transparent monthly statement & per-group compensation breakdown (strictly own `teacherId`; rate fields read-only).
7. **طلب محاضرة إضافية (`extraSession`)**: Submits extra/makeup session requests (`teacher_extra_sessions`) for Center/Branch Manager approval.
8. **المنتدى الداخلي (`forum`)**: Posts group announcements and study guidance to enrolled students/parents (gated by `publishForum` permission).

### 3.6 Accountant (`/center/[centerSlug]/accountant` & `/finance`)
1. Opens/closes cashier shifts (`center_shifts`) and reconciles cash/card/Vodafone Cash/InstaPay/Fawry collections.
2. Issues/adjusts student invoices applying unified discount precedence (`SCHOLARSHIP_100` / free-student → `PERCENT` → `FIXED`) and verifies status strictly against `netAmount`.
3. Runs unified **Teacher Payroll** (`lib/finance/engine.ts`): calculates average-attendance, private percentage splits, fixed session compensation, and per-student compensation; records advances/deductions; approves & pays statements, freezing an **immutable snapshot + `financial_audits` record**.
4. Logs center/branch expenses (`center_expenses`) and exports finalized financial audits.

### 3.7 Student Portal (`/center/[centerSlug]/student-portal`, Mobile-Optimized)
1. Logs in via `/login` and opens mobile-first portal with `MobileBottomNav` (Overview, Schedule, Materials/Exams, Finance, Notifications).
2. Views today's sessions, attendance summary, and personal barcode/QR pass for reception check-in.
3. Browses **published** materials filtered to enrolled grades/subjects and opens PDF viewer/Drive links.
4. Launches published online exams (`/center/[centerSlug]/exams/[examId]/run`) via `StudentExamRunner` (timer, auto-save, KaTeX equations, submit) and views published grades.
5. Tracks personal invoices, discounts, and payment receipts, plus in-app notification inbox.

### 3.8 Parent Portal (`/center/[centerSlug]/parent-portal`, Mobile-Optimized)
1. Logs in via `/login` with verified `childStudentIds` from `memberships/{tenantId}_{uid}` / `parent_links`.
2. Switches between linked children via a touch-friendly **Child Switcher** (`Drawer` on mobile) without exposing unrelated students.
3. Inspects per-child attendance timeline, lesson assessment & exam scores, group timetable changes, and invoice balance/receipts.
4. Opens **In-App Notifications Inbox** showing real-time events (`attendance.recorded`, `grade.published`, `payment.recorded`, `group.updated`, `material.published`) and marks notifications as read (`readAt` persisted to Firestore).

---

## 4. Complete RBAC & Resource Permission Matrix

### 4.1 Auth, Multi-Center Isolation & Ownership Rules
- **Verified Identity**: Every API route verifies Firebase ID Token (`Authorization: Bearer <token>` or verified HttpOnly session cookie). Unsigned `yc_role`, `yc_tenant`, and `yc_user_id` cookies are ignored and forbidden.
- **Membership Key**: `memberships/{tenantId}_{uid}` containing `{ uid, tenantId, role, branchIds, studentIds, childStudentIds, teacherId, isActive, updatedAt }`.
- **Multi-Center Isolation**: Users with memberships in multiple centers (e.g., Teacher in Center A and Center B, or Parent in two centers) switch active `tenantId` solely within their verified `memberships` list; every Firestore query and document ID is prefixed `{tenantId}~...`, preventing cross-tenant data mixing.
- **Teacher Own-Content Restriction**: `TEACHER` CRUD on `center_materials`, `center_material_versions`, `center_material_annotations`, `lesson_exams`, `lesson_grades`, and `comprehensive_exams` is permitted **ONLY** when `resource.teacherId === membership.teacherId || resource.createdByUid === uid`. Furthermore, `validateTeacherRateUpdate` blocks `TEACHER` from modifying compensation rates (`403 Forbidden`), and `validateTeacherStatementAccess` restricts financial statement reads strictly to the teacher's own `teacherId` (`403 Forbidden` on peer teachers).
- **Self Profile Photo Whitelist**: `validateProfilePhotoUpdate` restricts `TEACHER` and `STUDENT` self-updates strictly to `ALLOWED_SELF_PROFILE_KEYS = ['avatar_url', 'avatarUrl', 'userId', 'targetUserId']` and rejects any `RESTRICTED_ADMIN_FIELDS` (`role`, `tenantId`, `salary`, `rates`, `isActive`, etc.) with `403 Forbidden`.

### 4.2 Role × Resource Matrix
*(Legend: **RW** = Read/Write, **R** = Read, **Own** = Own records/groups/children only, **Branch** = Assigned `branchIds` only, **—** = Forbidden `403`)*

| Resource / Module | `PLATFORM_OWNER` | `CENTER_ADMIN` | `BRANCH_MANAGER` | `RECEPTIONIST` | `ACCOUNTANT` | `TEACHER` | `STUDENT` | `PARENT` |
|---|---|---|---|---|---|---|---|---|
| **SaaS Platform (`/owner/*`, `tenants`, `saas_*`)** | RW | — | — | — | — | — | — | — |
| **Center Profile, Branding & Website Editor** | RW | RW (own tenant) | R | — | — | — | — | — |
| **Public Center Site (`/site/[centerSlug]`)** | R | R (incl. preview) | R (published) | R (published) | R (published) | R (published) | R (published) | R (published) |
| **Master Stages, Subjects & Classrooms** | RW | RW | R (Branch RW rooms) | R | R | R | R | R |
| **Branches & Staff Memberships** | RW | RW | R (Branch) | — | R (staff list) | — | — | — |
| **Groups & Weekly Timetable** | RW | RW | RW (Branch) | R | R | R (Own groups) | R (Enrolled) | R (Children) |
| **Students & Enrollments** | RW | RW | RW (Branch) | R + Create/Enroll | R | R (Own groups) | R (Self) | R (`childStudentIds`) |
| **Attendance & Reception Check-In** | RW | RW | RW (Branch) | RW | R | RW (Own groups) | R (Self) | R (Children) |
| **Lesson Assessments & Grades** | RW | RW | RW (Branch) | RW | R | RW (Own) | R (Published self) | R (Published children) |
| **Materials, Versions & PDF Annotations** | RW | RW + Approve | R | — | — | RW + Publish (Own) | R (Published) + Own notes | R (Published children) |
| **Comprehensive Exams & Submissions** | RW | RW | RW (Branch) | R | — | RW (Own) | R (Published) + RW own submission | R (Children results) |
| **Teacher Profiles, Rates & Payroll** | RW | RW | R (Branch schedule) | — | RW (Rates/Payroll) | R (Own profile/statement; 403 rates/peers) | — | — |
| **Invoices, Payments, Shifts & Expenses** | RW | RW | R (Branch expenses) | RW (Quick pay & own shift) | RW | — | R (Self) | R (Children) |
| **Immutable Audits (`financial_audits`, `audit_logs`, `lesson_grade_audits`)** | R (append-only) | R (append-only) | R (Branch) | — | R (financial) | — | — | — |
| **In-App Notifications (`notification_outbox` & `notifications`)** | RW | R outbox + RW retry | R outbox (Branch) | — (enqueue only) | — (enqueue only) | R + Mark-Read (Own) | R + Mark-Read (Own) | R + Mark-Read (Own) |
| **Self Profile Photo (`avatar_url`)** | RW | RW | RW | RW (Self) | RW (Self) | RW (Self whitelist) | RW (Self whitelist) | RW (Self whitelist) |

---

## 5. Data Entities, Firestore Collections & Domain Events

### 5.1 Authoritative Firestore Collections
All tenant-scoped documents enforce `{tenantId}~{entityId}` composite keys (and `tenantId` field) for strict isolation:

- **Tenancy, Auth & Public Website**:
  - `tenants/{tenantId}` (immutable `id`, unique `slug`, optional `aliases[]`, `settings`)
  - `memberships/{tenantId}_{uid}` (`uid`, `tenantId`, `role`, `branchIds[]`, `teacherId`, `studentIds[]`, `childStudentIds[]`, `isActive`)
  - `parent_links/{tenantId}~{parentUid}_{studentId}`
  - `center_websites/{tenantId}` (`status: 'draft' | 'published'`, `draftConfig`, `publishedConfig`, `previewToken`, `updatedAt`, `publishedAt`)
- **SaaS Owner Collections**:
  - `saas_plans`, `saas_requests`, `saas_complaints`, `saas_contact_messages`, `saas_comm_settings`, `saas_ai_config`, `saas_ai_ledger`, `saas_owner_invoices`, `saas_owner_payments`, `saas_owner_expenses`, `saas_expense_categories`, `saas_owner_audits`, `saas_website_config`.
- **Master Data & Timetable**:
  - `master_stages/{tenantId}~{stageId}`, `master_subjects/{tenantId}~{subjectId}`, `master_branches/{tenantId}~{branchId}`, `center_classrooms/{tenantId}~{classroomId}`, `center_groups/{tenantId}~{groupId}`, `center_group_revisions/{tenantId}`, `center_sessions/{tenantId}~{sessionId}`.
- **Teachers, Students & Attendance**:
  - `teacher_profiles/{tenantId}~{teacherId}`, `teacher_extra_sessions/{tenantId}~{teacherId}~{reqId}`, `center_students/{tenantId}~{studentId}`, `center_enrollments/{tenantId}~{enrollmentId}`, `center_attendance/{tenantId}~{sessionId}_{studentId}`.
- **Educational Materials (5-Level Folders & Versioning)**:
  - `center_materials/{tenantId}~{materialId}` (`stageId`, `gradeId`, `subjectId`, `unitId`, `lessonId`, `sourceType: 'upload' | 'google_drive'`, `fileUrl` / `storageKey`, `driveUrl`, `workflowStatus: 'draft' | 'pending_approval' | 'published' | 'unpublished'`, `currentVersion`, `teacherId`, `createdByUid`)
  - `center_material_versions/{tenantId}~{materialId}_v{n}` (immutable revision snapshots; restore creates forward version `v{n+1}`)
  - `center_material_annotations/{tenantId}~{materialId}~{userId}` (PDF highlights & comments)
- **Assessments & Exams**:
  - `lesson_exams/{tenantId}~{examId}`, `lesson_grades/{tenantId}~{examId}_{studentId}`, `lesson_grade_audits/{tenantId}~{auditId}` (immutable)
  - `comprehensive_exams/{tenantId}~{examId}`, `exam_submissions/{tenantId}~{submissionId}`.
- **Financial Engine & Immutable Audits (`lib/finance/engine.ts`)**:
  - Unified `PricingModel`: `'center' | 'fixed_session' | 'private' | 'per_attendee' | 'per_session'` supporting average-attendance accounting, private percentage splits, fixed session compensation, and per-student compensation.
  - Discounts: `SCHOLARSHIP_100` / free-student (`netAmount = 0`, `status = 'paid'`), `PERCENT` (`0..100`), `FIXED` (clamped `[0, grossAmount]`).
  - Invoice Status: `paidAmount >= netAmount ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'pending'`.
  - Collections: `center_invoices/{tenantId}~{invoiceId}`, `center_payments/{tenantId}~{paymentId}`, `center_expenses/{tenantId}~{expenseId}`, `center_shifts/{tenantId}~{shiftId}`, `teacher_payroll/{tenantId}~{payrollId}`, `teacher_advances/{tenantId}~{advanceId}`, `financial_audits/{tenantId}~{auditId}` (append-only snapshot on payroll approval/payment).

### 5.2 Domain Events & In-App Notification Outbox
All operational mutations emit transactional audit entries and idempotent in-app notification outbox jobs (zero external SMS/WhatsApp/Email dependencies):

| Domain Event | Trigger Action | Target Recipients | Outbox & Audit Collections |
|---|---|---|---|
| `attendance.recorded` | Receptionist/Teacher marks check-in or absence | Student & linked Parents | `notification_outbox/{tenantId}~{eventId}` (`idempotencyKey = {tenantId}:attendance.recorded:{sessionId}_{studentId}:{date}`), `notifications`, `notification_deliveries`, `audit_logs` |
| `grade.published` | Lesson assessment score or comprehensive exam grade published | Student & linked Parents | `notification_outbox` + `notifications` + `lesson_grade_audits` / `audit_logs` |
| `payment.recorded` | Invoice payment recorded or free-student rule applied | Student & linked Parents | `notification_outbox` + `notifications` + `financial_audits` / `audit_logs` |
| `group.updated` | Group schedule, room, time slot, or pricing updated | Teacher, Students & Parents | `notification_outbox` + `notifications` + `center_group_revisions` + `audit_logs` |
| `material.published` | Material uploaded/approved/published for group/grade | Enrolled Students & Parents | `notification_outbox` + `notifications` + `center_material_versions` + `audit_logs` |

Outbox queue fields: `idempotencyKey`, `attemptCount`, `maxAttempts`, `nextRetryAt`, `status` (`pending | processing | delivered | dead_letter`), `lastError`.

---

## 6. Phase-by-Phase Implementation Dossiers (M1–M6)

### Phase M1 — UI/UX Specification, Page Map & Design System Foundation (F1, F2)
- **(a) Screens & Routes**: Establishes blueprint for all routes across all 8 portals, `/`, `/login`, and `/site/[centerSlug]`; showcases R4 primitives ready for consumption in M4–M5 without altering existing routes yet.
- **(b) User Workflows**: Documents complete end-to-end flows across all 8 portals, multi-center workspace switching, Teacher 8 tabs + material versioning/annotations, Website draft/preview/publish, unified payroll, and mobile Student/Parent UX.
- **(c) Permission Matrix**: Establishes full 8-role × resource permission matrix, multi-center `memberships/{tenantId}_{uid}` isolation contract, teacher own-content restrictions, and self-photo whitelist rules.
- **(d) Data Entities & Events**: Documents all Firestore collections, unified `PricingModel`, material 5-level taxonomy + versioning, immutable audit logs, and all 5 domain events (`attendance.recorded`, `grade.published`, `payment.recorded`, `group.updated`, `material.published`).
- **(e) Components to Reuse**: Existing `components/ui/{badge,button,card,math-view,rtl-icon,theme-toggle}.tsx`, `components/brand/*`, `lib/utils.ts` (`cn`, `formatEGP`).
- **(f) Files to Modify / Create**:
  - Create: `docs/ui-ux-spec.md`, `components/ui/{skeleton,table,modal,drawer,kpi-card,interactive-chart,page-transition,collapsible-sidebar}.tsx`, `tests/unit/{design-system-primitives.test.tsx,ui-ux-spec.test.ts}`.
  - Modify: `app/globals.css` (append GPU keyframes, `.pb-safe`, `@media (prefers-reduced-motion: reduce)` while preserving lines 1–231).
  - Immutable: `public/brand/*`.
- **(g) Acceptance Criteria**:
  1. `docs/ui-ux-spec.md` complete with all 8 portals, `/site/[centerSlug]`, `/login`, RBAC, entities/events, and M1–M6 dossiers.
  2. All 8 primitives pass RTL, dark/light, ARIA/ESC keyboard, `tabular-nums`, zero-NaN chart, and `prefers-reduced-motion` unit tests.
  3. `public/brand/*` SHA-256 hashes & byte sizes unchanged; `tsc --noEmit`, `npm test` (54 baseline + M1 tests), and `npm run build` exit 0.

---

### Phase M2 — R2 Security, Auth, Multi-Tenancy, Rules & Persistence Hardening (F3–F8)
- **(a) Screens & Routes**: `/login` (`app/(auth)/login/page.tsx`), `/center/[centerSlug]/students` (fail-loudly save verification), and all `/api/**` routes (strictly read-only `GET`s + verified token auth).
- **(b) User Workflows**: Single Firebase Auth login + verified server session; multi-center membership switching without data mixing; zero automatic demo recreation; non-destructive Firestore backup prior to canonical ID reconciliation.
- **(c) Permission Matrix**: Removes `yc_role`/`yc_tenant`/`yc_user_id` cookie trust, `CENTER_ADMIN` default fallback, `workers.dev` demo bypass, self-bootstrap `CENTER_ADMIN` privilege escalation; enforces `validateProfilePhotoUpdate` whitelist and Firestore `teacherId`/`createdByUid` ownership rules in `firestore.rules`.
- **(d) Data Entities & Events**: Migrates `staff_memberships/{uid}` → `memberships/{tenantId}_{uid}`, enforces canonical `tenants/{tenantId}` (`id`, `slug`, `aliases[]`), locks `center_materials`, `comprehensive_exams`, `center_attendance`, `lesson_grade_audits` in `firestore.rules`.
- **(e) Components to Reuse**: `components/layout/tenant-provider.tsx`, `components/layout/staff-login.tsx`, `lib/security/rbac.ts`, `lib/firebase/server.ts`.
- **(f) Files to Modify / Create**:
  - `wrangler.jsonc` (`staging` environment), `scripts/backup-firestore.ts`, `firestore.rules`, `middleware.ts`
  - `app/(auth)/login/page.tsx`, `app/api/auth/me/route.ts`, `app/api/profile/update-photo/route.ts`, `app/api/center/[centerSlug]/staff/bootstrap/route.ts`, `app/api/center/[centerSlug]/notifications/route.ts`, `app/api/center/[centerSlug]/{attendance/scan,exams/**}/route.ts`
  - `lib/dal/{factory.ts,mock-data.ts,demo-operations.ts}`, `lib/firebase/{server.ts,master-data-service.ts,group-service.ts,teacher-service.ts,material-service.ts}`
  - `components/layout/tenant-provider.tsx`, `app/center/[centerSlug]/students/page.tsx`.
- **(g) Acceptance Criteria**:
  1. Zero production `MockDataProvider` usage and zero automatic demo record creation.
  2. All `GET` endpoints verified strictly read-only.
  3. Canonical center IDs (`al-maher`/`elmaher` → `tenant-maher-001`) resolved without rewriting `tenant.slug`; pre-migration backup script verified.
  4. Automated security rules & RBAC tests verify tenant isolation, multi-center switching, rejection of fabricated privileged roles, and teacher own-content limits; saves report success only after Firestore confirmation.

---

### Phase M3 — R7 Unified Financial Engine & R6 Sync / In-App Notification Architecture (F9–F11)
- **(a) Screens & Routes**: `/api/center/[centerSlug]/finance`, `/api/center/[centerSlug]/payroll`, `/api/center/[centerSlug]/notifications`, `/api/center/[centerSlug]/attendance/scan`, `/api/center/[centerSlug]/exams/**`, feeding Accountant, Receptionist, Teacher, Student, and Parent portals.
- **(b) User Workflows**: Invoice creation & discount calculation (`netAmount`), quick payments & cashier shifts, unified teacher payroll calculation → review → approval → frozen immutable snapshot, and automatic cross-portal sync + idempotent in-app notifications on mutations.
- **(c) Permission Matrix**: Restricts payroll approval/rates to `CENTER_ADMIN`/`ACCOUNTANT`, blocks `TEACHER` from editing rates (`403`) or reading peer statements (`403`), restricts `RECEPTIONIST` to quick payments & own shifts, allows `PARENT`/`STUDENT`/`TEACHER` read + mark-read on own `notifications`.
- **(d) Data Entities & Events**: Unified `PricingModel` (`lib/finance/engine.ts`), `financial_audits/{tenantId}~{auditId}`, `audit_logs/{tenantId}~{auditId}`, `notification_outbox/{tenantId}~{eventId}`, `notifications/{tenantId}~{notifId}`, `notification_deliveries/{tenantId}~{deliveryId}`; emits `attendance.recorded`, `grade.published`, `payment.recorded`, `group.updated`, `material.published`.
- **(e) Components to Reuse**: `components/finance/pricing-fields.tsx`, `lib/finance/*`, `lib/notifications/*`, `lib/firebase/center-operations-service.ts`.
- **(f) Files to Modify / Create**:
  - `lib/finance/engine.ts` (consolidating `compensation.ts`, `discounts.ts`, `group-pricing.ts`, `session-compensation.ts`, `group-schedule.ts`)
  - `lib/firebase/center-operations-service.ts` (`netAmount` invoice status fix + immutable `financial_audits`)
  - `app/api/center/[centerSlug]/{finance,payroll,notifications}/route.ts`
  - `lib/notifications/{outbox.ts,queue.ts,types.ts}`, `lib/firebase/audit-service.ts`, sync hooks in attendance/grades/payments/groups/materials.
- **(g) Acceptance Criteria**:
  1. Single financial engine passes unit/integration tests for average-attendance, private percentage splits, fixed session, per-student, discounts (`SCHOLARSHIP_100`, `PERCENT`, `FIXED`), `netAmount` status, and frozen payroll snapshots + `financial_audits`.
  2. All 5 domain events write idempotent `notification_outbox` entries with retry queue (`attemptCount`, `maxAttempts`, `nextRetryAt`) and `notification_deliveries` logs.

---

### Phase M4 — Platform Owner, Center Admin, Branding/Website Editor, Branch & Reception Portals (F12–F15)
- **(a) Screens & Routes**:
  - `/` (Firestore SaaS site) & `/site/[centerSlug]` (published public center site)
  - `/owner`, `/owner/centers`, `/owner/plans`, `/owner/subscriptions`, `/owner/requests`, `/owner/settings`, `/owner/website`, `/owner/finance`
  - `/center/[centerSlug]`, `/admin`, `/settings`, `/website`, `/stages`, `/subjects`, `/branches-list`, `/students`, `/sessions`, `/branch`, `/reception`, `/reports`, `/subscription`, `/profile`
- **(b) User Workflows**: Owner SaaS lifecycle; Center Profile & Branding editing; Public Website Editor (`draft` → `preview` → `publish`); Branch Manager branch-scoped classrooms/sessions/attendance; Receptionist Firestore barcode/QR attendance, quick payment, and lesson score entry; Center Admin Reports & Audit History.
- **(c) Permission Matrix**: Role-filtered navigation in `Sidebar` & `OwnerSidebar` (`PLATFORM_OWNER` vs `CENTER_ADMIN` vs `BRANCH_MANAGER` vs `RECEPTIONIST`); public `/site/[centerSlug]` reads only `publishedConfig` unless verified admin requests `preview`.
- **(d) Data Entities & Events**: `saas_*` Firestore collections, `center_websites/{tenantId}`, `tenants/{tenantId}` branding fields, `center_attendance`, `center_payments`, `lesson_grades`, `audit_logs`, emitting `attendance.recorded`, `payment.recorded`, `grade.published`, `group.updated`.
- **(e) Components to Reuse**: M1 R4 primitives (`DataTable`, `KpiCard`, `InteractiveChart`, `Drawer`, `Modal`, `Skeleton*`, `PageTransition`, `CollapsibleSidebar`), `components/owner/*`, `components/attendance/*`, `components/sessions/*`, `components/timetable/*`.
- **(f) Files to Modify / Create**:
  - `lib/firebase/saas-service.ts` (replacing `lib/saas/service.ts` `localStorage`), `lib/firebase/website-service.ts`
  - `app/page.tsx`, `app/site/[centerSlug]/page.tsx`, `app/owner/**`, `components/owner/*`
  - `app/center/[centerSlug]/{page.tsx,admin/page.tsx,settings/page.tsx,website/page.tsx,branch/page.tsx,reception/page.tsx,reports/page.tsx,students/page.tsx,sessions/page.tsx,subscription/page.tsx}`
  - `components/layout/sidebar.tsx`.
- **(g) Acceptance Criteria**:
  1. Zero `localStorage`/`SaasPlatformService` operational mocks across `/owner/*`, `/`, `/admin`, `/branch`, `/reception`.
  2. Center Website Editor cleanly supports `draft`, `preview`, and `publish` states reflected live on `/site/[centerSlug]`.
  3. Role-specific navigation and branch/reception Firestore workflows pass integration & UI tests.

---

### Phase M5 — Teacher (8 Tabs + Materials/Exams), Accountant, Student & Parent Portals (F16–F19)
- **(a) Screens & Routes**:
  - `/teacher/[centerSlug]` (and `/center/[centerSlug]/teacher` alias) with all 8 tabs (`profile`, `schedule`, `students`, `materials`, `exams`, `account`, `extraSession`, `forum`)
  - `/center/[centerSlug]/materials`, `/center/[centerSlug]/exams/**` (`/exams/[examId]/run`, `/exams/printable/[id]`)
  - `/center/[centerSlug]/accountant`, `/center/[centerSlug]/finance`
  - `/center/[centerSlug]/student-portal`, `/center/[centerSlug]/parent-portal`, `/center/[centerSlug]/notifications`.
- **(b) User Workflows**: Complete Teacher 8-tab workflows; Material Library 5-level taxonomy (`stage -> grade -> subject -> unit -> lesson`), file upload & Google Drive links, metadata edit, revised versions, version history & forward-copy restore, PDF annotations, publish/unpublish & optional center approval; Firestore-backed Exam runner & A4 print; Accountant shifts/payroll/audits; mobile-first Student & Parent multi-child portals + in-app notification inbox & read receipts.
- **(c) Permission Matrix**: Enforces teacher own-content restrictions (`teacherId`/`createdByUid`), self photo whitelist, Accountant payroll controls, Student self-only scope, Parent `childStudentIds` scope, and auth gating on `/student-portal`, `/parent-portal`, and `/exams/[examId]/run`.
- **(d) Data Entities & Events**: `center_materials`, `center_material_versions`, `center_material_annotations`, `comprehensive_exams`, `exam_submissions`, `teacher_payroll`, `teacher_advances`, `financial_audits`, `notifications`, `notification_outbox`, `notification_deliveries`, emitting `material.published`, `grade.published`, `payment.recorded`, `attendance.recorded`.
- **(e) Components to Reuse**: M1 R4 primitives (especially `CollapsibleSidebar`, `MobileBottomNav`, `Drawer`, `Modal`, `DataTable`, `KpiCard`, `InteractiveChart`, `PageTransition`), `components/materials/material-editor.tsx`, `components/exams/{printable-exam-sheet,student-exam-runner}.tsx`, `components/teachers/{teacher-accounting-view,teacher-editor,teacher-profile-modal}.tsx`.
- **(f) Files to Modify / Create**:
  - `app/teacher/[centerSlug]/page.tsx`
  - `lib/materials/{management.ts,versioning.ts,annotations.ts}`, `lib/firebase/{material-service.ts,exam-service.ts}`
  - `components/materials/{material-editor.tsx,pdf-annotator.tsx,version-history-drawer.tsx}`
  - `components/exams/{student-exam-runner.tsx,printable-exam-sheet.tsx}`
  - `app/center/[centerSlug]/{materials/page.tsx,exams/**,accountant/page.tsx,finance/page.tsx,student-portal/page.tsx,parent-portal/page.tsx,notifications/page.tsx}`.
- **(g) Acceptance Criteria**:
  1. Teacher renders all 8 tabs; uploads files/Drive links into 5-level folders; edits/restores versions; annotates PDFs; publishes with optional approval; cannot edit peer teachers' content.
  2. Accountant portal displays live Firestore shifts/KPIs and executes unified payroll with immutable audit records.
  3. Student & Parent portals pass mobile responsiveness (`MobileBottomNav`), multi-child isolation, and in-app notification inbox delivery/read-receipt tests.

---

### Phase M6 — Final E2E Suite (Tiers 1–4), Tier 5 Hardening & Staging Verification (F20)
- **(a) Screens & Routes**: End-to-end verification across `/`, `/login`, `/site/[centerSlug]`, and all 8 portals on Cloudflare Workers `staging` environment without altering production.
- **(b) User Workflows**: Automated opaque-box E2E execution (Tiers 1→2→3→4 from `TEST_READY.md`) plus Tier 5 white-box adversarial loop (cross-tenant IDOR, role escalation, double-submit idempotency, race conditions, reduced-motion & RTL checks).
- **(c) Permission Matrix**: Full verification of all 8 roles × resources, multi-center switching, and `firestore.rules` emulator/unit checks.
- **(d) Data Entities & Events**: Live/emulated Firestore persistence verification across devices, audit log immutability, financial snapshot consistency, and notification outbox retry/delivery verification.
- **(e) Components to Reuse**: All M1–M5 components, `scripts/backup-firestore.ts`, E2E test suite from `tests/e2e/`.
- **(f) Files to Modify / Create**:
  - Adversarial & regression tests in `tests/security/`, `tests/integration/`, `tests/e2e/`
  - Final phase verification report in `docs/phases/phase-6-verification.md` (if needed).
- **(g) Acceptance Criteria**:
  1. 100% pass rate on E2E Tiers 1–4 + Tier 5 adversarial tests + all unit/integration/security tests.
  2. `tsc --noEmit`, `npm test`, `npm run build`, and `npm run build:cloudflare` exit 0.
  3. Staging Cloudflare Worker deployment verified across all 8 portals (RTL, Navy/Blue/Cyan tokens, unmodified `public/brand/*`, dark/light themes, mobile Student/Parent UX, `prefers-reduced-motion`) while leaving production untouched.
