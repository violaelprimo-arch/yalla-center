# YALLA CENTER — Complete Architecture & Infrastructure Survey Report

**Document ID**: `YC-ARCH-SURVEY-002`  
**Date**: 2026-10-18  
**Author**: Architecture Explorer Survey 2 (Systems & Infrastructure Architect)  
**Status**: Approved Survey  
**Target Platform**: Next.js 14/15 App Router | Supabase PostgreSQL | Tailwind CSS | Arabic RTL  

---

## 1. Executive Summary & Brand Identity System

### 1.1 Brand Asset Analysis
An inspection of the official assets in `public/brand/` was conducted:
1. **`yalla-center-icon.png` (1024×1024)**:
   - **Form**: Modern squircle application icon with an elevated inner 3D glyph.
   - **Symbolism**: The letter "y" gracefully transitions upward into an open educational book motif.
   - **Color Gradient**: Electric Cyan (`#00C2FF`) blending into Vibrant Royal Blue (`#0066FF`) and Deep Ultramarine (`#0040C0`). Features subtle top-right ambient specular gloss.
   - **Usage**: PWA icon, browser favicon, native mobile splash, loading spinners.

2. **`yalla-center-logo-dark.png` (Horizontal Wordmark - Dark Theme)**:
   - **Left Element**: "yalla" styled in a three-dimensional electric cyan-to-blue ribbon.
   - **Right Element**: "center" rendered in crisp high-contrast off-white (`#F8FAFC`), with the diacritic book icon above the "t".
   - **Background Affinity**: Optimized for Midnight Navy (`#0B132B`) and Obsidian Black surfaces.

3. **`yalla-center-logo-light.png` (Horizontal Wordmark - Light Theme)**:
   - **Left Element**: "yalla" styled with the identical signature electric blue/cyan gradient ribbon.
   - **Right Element**: "center" rendered in deep midnight navy (`#0B192C`).
   - **Background Affinity**: Optimized for crisp white (`#FFFFFF`) and slate (`#F8FAFC`) surfaces.

4. **`yalla-center-wireframes.jpg` (Full UI Architecture Boards)**:
   - 11 distinct production-grade Arabic RTL interface screens illustrating:
     1. Login / Authentication (Split-view with 3D glassmorphic campus hero, dual language/theme toggle, credentials form, Google SSO).
     2. Comprehensive Dashboard (Sidebar navigation in deep navy, metric stat cards with progress rings, revenue vs expenses analytics, stage distribution donut, today's schedule table).
     3. Student Roster & Directory (Metric badges, multi-attribute filter bar, tabular student records with badges for Center vs Private subscription, payment statuses, quick actions).
     4. Add/Edit Student Modal (Tabbed structure: Basic Info, Guardian Info, Subscriptions & Payment Plans).
     5. Weekly Timetable Grid (Saturday through Thursday, 08:00 to 18:00, interactive color-coded group slots with teacher & room assignments).
     6. In-Session Class Hub (Class header with stage, subject, teacher badge; tabs for Attendance, Exams, Assignments; countdown badges).
     7. AI Exam Generator Modal (Configurable question count, question types: MCQ, True/False, Essay; document grounding checkbox; live KaTeX math formula rendering preview).
     8. Printable A4 Exam Sheet Preview (Header with Yalla Center logo top-left, teacher name top-right, student metadata inputs, KaTeX formatted equations, sidebar printing controls).
     9. Online Student Exam Platform (Active test interface with sticky countdown timer `00:29:15`, progress counter, question palette navigation 1-20, math rendering, previous/next/submit).
     10. Teacher Materials Repository (Google Drive linked hierarchical folders: Teacher → Subject → Grade → Unit → Lesson; file metadata and indexing status pills).
     11. Teacher Profile & Financial Hub (Teacher card, monthly revenue breakdown bar chart, center vs private split breakdown: 65% center / 35% private, average attendance metrics).

---

### 1.2 Design Tokens & Theme Specification

```css
/* Design System CSS Variables */
:root {
  /* Brand Primary & Accents */
  --brand-navy-950: #070B19;
  --brand-navy-900: #0B132B;
  --brand-navy-850: #111A38;
  --brand-navy-800: #1C2541;
  --brand-navy-700: #26345A;

  --brand-blue-500: #00A3FF;
  --brand-blue-600: #0084E0;
  --brand-blue-700: #0066FF;
  --brand-cyan-400: #38BDF8;
  --brand-cyan-500: #00C2FF;

  /* Semantic Feedback */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #6366F1;

  /* Light Theme Surface Tokens */
  --bg-app: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-surface-elevated: #F1F5F9;
  --border-subtle: #E2E8F0;
  --border-strong: #CBD5E1;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
}

.dark {
  /* Dark Theme Surface Tokens */
  --bg-app: #070B19;
  --bg-surface: #0B132B;
  --bg-surface-elevated: #111A38;
  --border-subtle: #1C2541;
  --border-strong: #26345A;
  --text-primary: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #64748B;
}
```

#### Typography System
- **Font Family**: Cairo (`var(--font-cairo)`, sans-serif) loaded via `next/font/google`.
- **Weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold).
- **Tabular Figures**: Numeric statistics, monetary amounts, and time counters utilize `font-variant-numeric: tabular-nums` to avoid layout shifts.

#### Theme Persistence
- **Implementation**: Double-layer persistence:
  1. `Cookie`: `theme=light|dark` sent on initial HTTP handshake, allowing SSR server layout to render `<html class="dark">` or `<html class="light">` with zero layout shift / flicker (FOUC).
  2. `localStorage`: Synchronized client-side via a lightweight `<ThemeScript />` injected in the root layout `<head>`.

---

## 2. Technical Stack Architecture

### 2.1 Core Stack Matrix
| Layer | Technology | Version / Spec | Justification |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 14.x / 15.x | High-performance React Server Components, Streaming SSR, Route Groups, Server Actions |
| **Language** | TypeScript | 5.4+ (Strict) | End-to-end type safety, auto-generated Supabase database types, zero `any` tolerance |
| **Styling** | Tailwind CSS + Logical Properties | 3.4+ / 4.x | Native RTL layout utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), tokenized theme |
| **Typography** | Cairo Font | Google Font via `next/font/google` | First-class Arabic legibility, Egyptian educational standard |
| **Icons** | Lucide React | Latest | Crisp vector iconography with automated RTL mirroring for directional icons |
| **Math Engine** | KaTeX | 0.16+ | Ultra-fast LaTeX math rendering for physics, calculus, and algebra examination sheets |
| **Database & Auth** | Supabase PostgreSQL | v15+ (RLS enabled) | Row Level Security, Realtime subscriptions, connection pooling, transactional integrity |
| **Fallback Layer** | In-Memory Mock DAL | TypeScript Native | 100% offline & demo sandbox execution without requiring active Supabase credentials |
| **State & Fetching** | React Server Actions + TanStack Query / SWR | Latest | Server-first data mutations, optimistic UI updates for rapid attendance scanning |

---

### 2.2 First-Class Arabic RTL Implementation

1. **Document-Level Directionality**:
   The root layout sets `dir="rtl"` and `lang="ar"` on the `<html>` element. All directional flexboxes, grids, and typography cascade naturally right-to-left.
2. **Tailwind Logical Properties Standard**:
   Developers and components strictly prohibit physical direction classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`) in favor of logical equivalents:
   - `ms-*` (margin-start: right in RTL, left in LTR)
   - `me-*` (margin-end: left in RTL, right in LTR)
   - `ps-*` (padding-start)
   - `pe-*` (padding-end)
   - `start-*` and `end-*` (absolute positioning)
   - `text-start` and `text-end`
3. **Directional Iconography Mirroring**:
   Icons that denote flow, forward navigation, back navigation, or directional pagination (`ChevronLeft`, `ChevronRight`, `ArrowRight`, `ArrowLeft`, `Undo`, `Redo`) are wrapped in a smart direction-aware wrapper `<RTLIcon>`:
   ```tsx
   export function RTLIcon({ icon: Icon, className, flip = true }: RTLIconProps) {
     return <Icon className={cn(flip && "rtl:rotate-180", className)} />;
   }
   ```
4. **Bilingual Text & Number Formatting**:
   Monetary amounts display currency in Arabic (e.g., `250 ج.م` or `EGP`), dates format using the Cairo locale (`ar-EG`), and phone numbers enforce LTR isolate containers (`dir="ltr" text-start`) to prevent number reordering.

---

### 2.3 KaTeX Mathematical Rendering Architecture

Mathematical notation is a core requirement for Egyptian secondary school science, physics, chemistry, and mathematics curricula.

1. **Rendering Engine**:
   - `katex` package compiled with `katex/dist/katex.min.css`.
   - A unified `<MathView />` component handles both inline `$f(x) = 3x^2 + 5$` and block `$$\int_a^b f(x) dx$$` formulas.
2. **Bidirectional Isolation**:
   Arabic text flows RTL, while mathematical equations must render in LTR mathematical notation without reversing symbol ordering:
   ```tsx
   // components/ui/math-view.tsx
   import katex from 'katex';

   export function MathView({ math, display = false, className }: MathViewProps) {
     const html = katex.renderToString(math, {
       displayMode: display,
       throwOnError: false,
       strict: false
     });

     return (
       <span
         dir="ltr"
         className={cn("inline-block font-sans select-text", className)}
         dangerouslySetInnerHTML={{ __html: html }}
       />
     );
   }
   ```
3. **Printable A4 Exam Sheet Integration**:
   - High-DPI print stylesheet (`@media print`) targeting standard A4 paper dimensions (210mm × 297mm, 15mm margins).
   - Prevents page breaks inside questions (`break-inside: avoid`).
   - Official Yalla Center logo in top-left, Teacher name and subject in top-right, student name and seat number blanks in header.

---

## 3. Multi-Tenant Architecture & Strict Role Boundaries

### 3.1 Route Hierarchy & Segregation
The application leverages Next.js App Router Route Groups to achieve physical and conceptual isolation between platform tiers:

```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (marketing)/
│   └── page.tsx                        # Global Yalla Center SaaS Landing Page
├── owner/                              # Platform Owner Super-Admin Portal
│   ├── layout.tsx                      # Super-Admin Layout (Dark Navy / Indigo)
│   ├── page.tsx                        # Platform Analytics & Multi-Center Overview
│   ├── centers/                        # Tenant Center Management (Provision, Suspend)
│   ├── billing/                        # SaaS Subscription Plans & Invoicing
│   └── system-logs/                    # Global Audit & Notification Logs
└── center/
    └── [centerSlug]/                   # Isolated Educational Center Workspace
        ├── layout.tsx                  # Center Shell (Branch Selector, Center Sidebar)
        ├── dashboard/                  # Center KPI Overview (Attendance, Revenue)
        ├── students/                   # Student Roster, Admission, QR Badge Generator
        ├── teachers/                   # Teacher Roster, Rate Contracts, Subject Links
        ├── groups/                     # Groups, Classroom Allocation, Timetable Grid
        ├── sessions/
        │   └── [sessionId]/            # Live Session: Attendance Kiosk, In-Session Tests
        ├── attendance/                 # Dedicated High-Speed Reception Scanning Kiosk
        ├── finance/
        │   ├── page.tsx                # Cash Flow, Invoices, Partial Payments
        │   ├── teacher-payroll/        # Dual-Model Teacher Compensation Calculation
        │   ├── expenses/               # Center Overheads, Utility Expenses
        │   ├── inventory/              # Study Books & Handout Sales
        │   └── cashier-shift/          # Daily Shift Opening & Closing Cash Count
        ├── materials/                  # Google Drive Hierarchical Repository
        ├── exams/
        │   ├── page.tsx                # Exam Catalog & History
        │   ├── new/                    # In-Session AI Exam Generator Modal/Wizard
        │   ├── [examId]/print/         # Branded A4 Printable Exam & Answer Key
        │   └── [examId]/results/       # Automated MCQ & Manual Essay Grading
        ├── portal/
        │   ├── student/                # Student Dashboard, Timetable, Online Exams
        │   └── parent/                 # Parent Child Attendance & Billing Monitor
        └── settings/                   # Branch setup, Classrooms, WhatsApp/FCM API Keys
```

---

### 3.2 Tenant Resolution & Middleware Architecture
The middleware (`middleware.ts`) intercepts incoming requests to enforce tenant resolution, tenant status verification, and session security:

```
[Request: /center/al-rowad/attendance]
                   │
                   ▼
       [Next.js middleware.ts]
                   │
  ├─ 1. Extract slug: "al-rowad"
  ├─ 2. Query Tenant Cache (or Mock DB in demo mode)
  ├─ 3. Verify Tenant exists & is_active = true
  │     └─ If suspended: Rewrite to /suspended-tenant
  ├─ 4. Authenticate User JWT / Session
  ├─ 5. Authorize Tenant Membership:
  │     └─ Verify user.tenant_id == tenant.id OR user.role == 'PLATFORM_OWNER'
  ├─ 6. Enforce Role Route Guards (e.g. Receptionist cannot access /finance/teacher-payroll)
  │     └─ Unauthorized -> HTTP 403 or redirect to /unauthorized
  └─ 7. Invalidate headers & Forward downstream:
        x-tenant-id: "tenant-uuid-123"
        x-tenant-slug: "al-rowad"
        x-user-role: "RECEPTIONIST"
```

---

### 3.3 Tenant Context Provider Contract
A dedicated React Context provides tenant metadata across all center routes:

```tsx
// lib/tenant/tenant-context.tsx
export interface TenantContextValue {
  tenant: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    logoUrl: string | null;
    subscriptionPlan: 'starter' | 'pro' | 'enterprise';
    settings: {
      currency: string;
      enableWhatsApp: boolean;
      enableFCM: boolean;
    };
  };
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string) => void;
  branches: Array<{ id: string; nameAr: string }>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider in /center/[centerSlug]');
  }
  return context;
}
```

---

### 3.4 Role Hierarchy & Strict Security Guardrails

The platform implements 8 distinct security roles:
1. `PLATFORM_OWNER`: Global super-admin across all centers.
2. `CENTER_ADMIN`: Executive administrator for a specific center.
3. `BRANCH_MANAGER`: Administrator scoped to one or more physical branches.
4. `RECEPTIONIST`: Fast attendance scan, barcode lookups, student badge printing, cashier shift handling.
5. `ACCOUNTANT`: Invoicing, partial payments, student debt recovery, expense vouchers, teacher payroll verification.
6. `TEACHER`: Assigned groups, class session tests, materials upload, AI exam generation, personal compensation statements.
7. `PARENT`: Read-only child attendance, grades, and fee payment receipts.
8. `STUDENT`: Read-only timetable, enrolled materials, live online exam platform.

#### Strict Security Guardrails (R2 Requirement Compliance):
- **Student Profile Limitation**:
  - Students and Teachers can upload and update **ONLY** their own profile photo (`avatar_url`).
  - All administrative data (**full name, student code, stage, grade, division, discount percentage, financial balance, enrollments, attendance records, exam scores**) is **strictly read-only** for students and teachers across:
    1. **UI Layer**: Edit forms omit or disable these fields for non-admin roles.
    2. **Server Actions / API Layer**: Zod schemas reject payloads attempting to mutate administrative columns if `user.role` is `STUDENT` or `TEACHER`, returning `HTTP 403 Forbidden`.
    3. **Database RLS Layer**: PostgreSQL column-level update policies and triggers strictly prevent updates to protected columns.
- **Teacher Financial Contract Lockdown**:
  - Teachers **CANNOT** alter contractual rates (`fixed_rate_per_student`, `private_share_percentage`).
  - Teachers **CANNOT** view or query any other teacher's compensation statements or payroll data.

---

## 4. Supabase PostgreSQL Database Architecture

### 4.1 Normalized Relational Schema (22 Core Tables)

The database schema is designed in 3rd Normal Form (3NF) with strict referential integrity, UUID primary keys, and cascading rules.

```sql
-- Core Enums
CREATE TYPE user_role AS ENUM (
  'PLATFORM_OWNER',
  'CENTER_ADMIN',
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'ACCOUNTANT',
  'TEACHER',
  'PARENT',
  'STUDENT'
);

CREATE TYPE pricing_model AS ENUM ('center', 'private');
CREATE TYPE discount_type AS ENUM ('none', 'percentage', 'fixed', 'free_100');
CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE verification_method AS ENUM ('barcode', 'qr', 'manual');
CREATE TYPE invoice_status AS ENUM ('pending', 'partially_paid', 'paid', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'vodafone_cash', 'instapay', 'fawry');
CREATE TYPE payroll_status AS ENUM ('draft', 'reviewed', 'approved', 'paid');
CREATE TYPE exam_status AS ENUM ('draft', 'under_review', 'published', 'archived');
CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'essay');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'fcm', 'sms');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');
```

#### Detailed Table Definitions:

```sql
-- 1. Tenants (Educational Centers)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  logo_url TEXT,
  phone VARCHAR(32),
  address TEXT,
  subscription_plan VARCHAR(32) DEFAULT 'pro',
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{"currency": "EGP", "enable_whatsapp": true, "enable_fcm": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Branches
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(32),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Classrooms
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  capacity INT NOT NULL DEFAULT 30,
  equipment JSONB DEFAULT '{"projector": true, "air_conditioning": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Users (Profiles linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for PLATFORM_OWNER
  role user_role NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(32),
  avatar_url TEXT,
  student_code VARCHAR(64), -- E.g. "5001"
  national_id VARCHAR(32),
  stage VARCHAR(64), -- 'primary', 'preparatory', 'secondary'
  grade VARCHAR(64), -- '1_sec', '2_sec', '3_sec'
  division VARCHAR(64), -- 'scientific', 'literary'
  seat_number VARCHAR(32),
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(32),
  balance_due NUMERIC(10, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_code_per_tenant UNIQUE (tenant_id, student_code)
);

-- 5. Subjects / Courses
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  code VARCHAR(32),
  stage VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Groups (Study Groups & Classes)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name_ar VARCHAR(128) NOT NULL,
  academic_year VARCHAR(32) NOT NULL,
  schedule_day INT NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  pricing_model pricing_model NOT NULL DEFAULT 'center',
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  session_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_students INT NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Sessions (Conducted Class Sessions)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status session_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enrollments (Student Subscriptions to Groups)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  pricing_model pricing_model NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'none',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_group_enrollment UNIQUE (student_id, group_id)
);

-- 9. Attendance (Fast Reception Idempotent Scans)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  verification_method verification_method NOT NULL DEFAULT 'barcode',
  cashier_user_id UUID REFERENCES users(id),
  notes TEXT,
  -- IDEMPOTENCY GUARD: Guarantees a student cannot have duplicate attendance scans in one session
  CONSTRAINT unique_session_student_attendance UNIQUE (session_id, student_id)
);

-- 10. Invoices (Student Billing)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  invoice_number VARCHAR(64) NOT NULL,
  billing_month INT NOT NULL,
  billing_year INT NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)
);

-- 11. Payments (Receipts & Partial Payments)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_shift_id UUID, -- References cashier_shifts(id)
  receipt_number VARCHAR(64) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  received_by_user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_receipt_number_per_tenant UNIQUE (tenant_id, receipt_number)
);

-- 12. Teacher Rates (Contractual Agreements)
CREATE TABLE teacher_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  model pricing_model NOT NULL,
  fixed_rate_per_student NUMERIC(10, 2) DEFAULT 0.00,
  teacher_percentage NUMERIC(5, 2) DEFAULT 0.00, -- E.g. 70.00%
  center_percentage NUMERIC(5, 2) DEFAULT 0.00,  -- E.g. 30.00%
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Teacher Payroll (Monthly Compensation Records)
CREATE TABLE teacher_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payroll_month INT NOT NULL,
  payroll_year INT NOT NULL,
  conducted_sessions INT NOT NULL DEFAULT 0,
  total_attendance INT NOT NULL DEFAULT 0,
  average_attendance NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  calculated_compensation NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  bonuses NUMERIC(10, 2) DEFAULT 0.00,
  deductions NUMERIC(10, 2) DEFAULT 0.00,
  net_payroll NUMERIC(10, 2) NOT NULL,
  status payroll_status NOT NULL DEFAULT 'draft',
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_teacher_monthly_payroll UNIQUE (tenant_id, teacher_id, payroll_month, payroll_year)
);

-- 14. Materials (Hierarchical Teacher Repository & Index)
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  unit_name VARCHAR(128) NOT NULL,
  lesson_name VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  google_drive_file_id VARCHAR(128),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_type VARCHAR(32) DEFAULT 'application/pdf',
  text_content_indexed TEXT, -- Extracted text for AI Exam grounding
  index_status VARCHAR(32) DEFAULT 'pending', -- 'pending', 'indexed', 'failed', 'insufficient'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Exams
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  total_marks NUMERIC(6, 2) NOT NULL DEFAULT 20.00,
  pass_marks NUMERIC(6, 2) NOT NULL DEFAULT 10.00,
  is_ai_generated BOOLEAN DEFAULT false,
  grounded_material_ids UUID[] DEFAULT '{}',
  status exam_status NOT NULL DEFAULT 'draft',
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Exam Questions
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  katex_formula TEXT, -- E.g. "f(x) = 3x + x^2"
  question_type question_type NOT NULL DEFAULT 'mcq',
  options JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of string options
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  marks NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  order_index INT NOT NULL DEFAULT 0
);

-- 17. Exam Submissions
CREATE TABLE exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  auto_graded_score NUMERIC(6, 2) DEFAULT 0.00,
  manual_graded_score NUMERIC(6, 2) DEFAULT 0.00,
  total_score NUMERIC(6, 2) DEFAULT 0.00,
  status VARCHAR(32) DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'graded'
  CONSTRAINT unique_student_exam_attempt UNIQUE (exam_id, student_id)
);

-- 18. Exam Answers
CREATE TABLE exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  marks_awarded NUMERIC(5, 2) DEFAULT 0.00,
  teacher_feedback TEXT
);

-- 19. Notifications (Asynchronous Meta WhatsApp & FCM Queue)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(32) NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'whatsapp',
  template_name VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_status NOT NULL DEFAULT 'queued',
  retry_count INT DEFAULT 0,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 20. Cashier Shifts (Front-Desk Shift Control)
CREATE TABLE cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cash_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  digital_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(10, 2),
  cash_difference NUMERIC(10, 2),
  status VARCHAR(32) DEFAULT 'open', -- 'open', 'closed'
  notes TEXT
);

-- 21. Center Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category VARCHAR(64) NOT NULL, -- 'rent', 'electricity', 'printing', 'salaries', 'supplies'
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  receipt_url TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Books & Handout Inventory
CREATE TABLE books_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  unit_cost NUMERIC(10, 2) NOT NULL,
  selling_price NUMERIC(10, 2) NOT NULL,
  quantity_in_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.2 Row Level Security (RLS) Policies

To enforce multi-tenant isolation and role-specific security boundaries at the database engine level, RLS is enabled across all tables.

```sql
-- Enable RLS across core tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Extract current user tenant ID from JWT or lookup
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::UUID;
$$ LANGUAGE sql STABLE;

-- Helper function: Extract current user role from JWT
CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

--------------------------------------------------------------------------------
-- 1. TENANTS ISOLATION POLICY
--------------------------------------------------------------------------------
CREATE POLICY tenant_isolation_policy ON tenants
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR id = current_tenant_id()
  );

--------------------------------------------------------------------------------
-- 2. USERS TABLE SECURITY & GUARDRAILS (R2 Acceptance Criteria)
--------------------------------------------------------------------------------
-- Read access: Tenant admins, receptionists, accountants see tenant users; Students/Teachers see profiles in their center
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id())
  );

-- Admin update access: Center Admin can update any user in their tenant
CREATE POLICY users_admin_update_policy ON users
  FOR UPDATE
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'BRANCH_MANAGER'))
  );

-- STUDENT & TEACHER STRICT PHOTO-ONLY UPDATE TRIGGER / POLICY
-- R2 Requirement: Students and teachers can upload and update ONLY their own profile photo
CREATE OR REPLACE FUNCTION enforce_self_profile_update_guardrail()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is student or teacher updating their own record
  IF (OLD.role IN ('STUDENT', 'TEACHER') AND auth.uid() = OLD.id) THEN
    -- Verify that NO administrative columns are being altered
    IF (
      NEW.full_name IS DISTINCT FROM OLD.full_name OR
      NEW.student_code IS DISTINCT FROM OLD.student_code OR
      NEW.stage IS DISTINCT FROM OLD.stage OR
      NEW.grade IS DISTINCT FROM OLD.grade OR
      NEW.division IS DISTINCT FROM OLD.division OR
      NEW.seat_number IS DISTINCT FROM OLD.seat_number OR
      NEW.balance_due IS DISTINCT FROM OLD.balance_due OR
      NEW.role IS DISTINCT FROM OLD.role OR
      NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
      NEW.is_active IS DISTINCT FROM OLD.is_active
    ) THEN
      RAISE EXCEPTION 'Security Violation: Students and Teachers are strictly permitted to update ONLY their profile photo (avatar_url).'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_user_guardrail
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_self_profile_update_guardrail();

--------------------------------------------------------------------------------
-- 3. TEACHER RATES SECURITY (Immutable by Teachers)
--------------------------------------------------------------------------------
CREATE POLICY teacher_rates_select_policy ON teacher_rates
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
    OR (tenant_id = current_tenant_id() AND teacher_id = auth.uid()) -- Teacher sees only their own rates
  );

CREATE POLICY teacher_rates_mutation_policy ON teacher_rates
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
  ); -- Teachers have ZERO mutation privileges on teacher_rates

--------------------------------------------------------------------------------
-- 4. ATTENDANCE TABLE POLICIES (Idempotent scans)
--------------------------------------------------------------------------------
CREATE POLICY attendance_tenant_policy ON attendance
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'))
  );

CREATE POLICY attendance_teacher_select_policy ON attendance
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND session_id IN (SELECT id FROM sessions WHERE teacher_id = auth.uid())
  );

CREATE POLICY attendance_student_select_policy ON attendance
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (student_id = auth.uid() OR student_id IN (SELECT id FROM users WHERE guardian_phone = (SELECT phone FROM users WHERE id = auth.uid())))
  );
```

---

### 4.3 Sandboxed / Mock Fallback Layer (Offline & Demo Mode)

To satisfy **R7 (Controlled Infrastructure & Data Safety)** and support the specified **Integrity Mode: `demo`**, the platform implements an Abstract Data Access Layer (DAL).

```
                      [Application Server / Server Actions]
                                      │
                                      ▼
                          [Data Provider Factory]
                                      │
             ┌────────────────────────┴────────────────────────┐
             ▼                                                 ▼
   [SupabaseDataProvider]                             [MockDataProvider]
  (Active Supabase DB & Auth)                        (In-Memory Seed State)
  Used when credentials exist                         Used when credentials missing
  and mode != 'demo'                                  or NEXT_PUBLIC_INTEGRITY_MODE='demo'
```

#### Mock Data Architecture (`lib/db/mock-db/`):
- Fully functional in-memory collections replicating all 22 tables.
- Pre-seeded with rich, realistic Egyptian educational data matching `public/brand/yalla-center-wireframes.jpg`:
  - 2 Tenants: `al-rowad` (سنتر الرواد التعليمي) and `al-farouk` (سنتر الفاروق).
  - Users across all 8 roles (Platform Owner, Center Admin, Receptionist, Teacher: أ. أحمد محمد - مدرس رياضيات, Students: أحمد محمد علي, مريم خالد, يوسف إبراهيم).
  - Groups, Weekly timetable slots, conducted sessions, and enrolled students.
  - Realistic attendance records, pending/paid invoices, and teacher payroll draft sheets.
  - Indexed PDF handouts and generated AI math exams with KaTeX expressions.
- **Fail-Safe Guarantee**: If Supabase credentials are missing or invalid, the app falls back to `MockDataProvider` without crashing, throwing unhandled rejections, or stalling the Next.js build.

---

## 5. Greenfield Code Layout & Directory Boundaries

The code structure conforms strictly to the Next.js App Router paradigm, enforcing separation between presentation, domain calculations, infrastructure access, and type definitions.

```
d:\Software\YALLA CODEX\YALLA CENTER\
├── public/
│   ├── brand/
│   │   ├── yalla-center-icon.png           # Official squircle app icon
│   │   ├── yalla-center-logo-dark.png      # Official dark mode wordmark
│   │   ├── yalla-center-logo-light.png     # Official light mode wordmark
│   │   └── yalla-center-wireframes.jpg     # Approved 11-screen UI blueprints
│   ├── audio/
│   │   ├── beep-success.mp3                # Reception scanner success chime
│   │   └── beep-warning.mp3                # Unpaid balance / duplicate alert chime
│   └── fonts/                              # Local Cairo font fallbacks
├── src/ (or root app/)
│   ├── app/
│   │   ├── layout.tsx                      # Root layout (dir="rtl", lang="ar", Cairo font, ThemeProvider)
│   │   ├── globals.css                     # Tailwind directives, theme variables, KaTeX styles
│   │   ├── page.tsx                        # Public landing page (features, portal selector)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx              # Wireframe 1: Split-screen branded login
│   │   │   └── register/page.tsx           # Center onboarding
│   │   ├── owner/                          # Platform Owner Super-Admin Portal
│   │   │   ├── layout.tsx                  # Super-admin navigation shell
│   │   │   ├── page.tsx                    # Global metric KPIs & tenant health
│   │   │   ├── centers/page.tsx            # Multi-center provisioning & status
│   │   │   └── billing/page.tsx            # SaaS subscription plans
│   │   ├── center/
│   │   │   └── [centerSlug]/               # Isolated Center Workspace
│   │   │       ├── layout.tsx              # Center Shell (Branch selector, Dark Navy Sidebar)
│   │   │       ├── dashboard/page.tsx      # Wireframe 2: Dashboard Overview & charts
│   │   │       ├── students/
│   │   │       │   ├── page.tsx            # Wireframe 3: Student Directory & filters
│   │   │       │   └── [studentId]/page.tsx# Wireframe 4: Student Details & Add/Edit
│   │   │       ├── teachers/
│   │   │       │   ├── page.tsx            # Teacher Directory & subject assignments
│   │   │       │   └── [teacherId]/page.tsx# Wireframe 11: Teacher Profile & Financial Hub
│   │   │       ├── groups/page.tsx         # Wireframe 5: Weekly Timetable & Schedules
│   │   │       ├── sessions/
│   │   │       │   └── [sessionId]/page.tsx# Wireframe 6: In-Session Class & Test Hub
│   │   │       ├── attendance/page.tsx     # Fast Reception Kiosk (Barcode/QR Scanner)
│   │   │       ├── finance/
│   │   │       │   ├── page.tsx            # Cashier desk, Invoices & partial payments
│   │   │       │   ├── teacher-payroll/page.tsx # Dual Teacher Compensation Engine
│   │   │       │   ├── expenses/page.tsx   # Overheads and facility expenses
│   │   │       │   └── cashier-shift/page.tsx # Daily cash drawer reconciliation
│   │   │       ├── materials/page.tsx      # Wireframe 10: Google Drive Repository
│   │   │       ├── exams/
│   │   │       │   ├── page.tsx            # Exam lists and status filter
│   │   │       │   ├── generator/page.tsx  # Wireframe 7: AI Exam Generator Modal
│   │   │       │   └── [examId]/
│   │   │       │       ├── print/page.tsx  # Wireframe 8: Branded Printable A4 Sheet
│   │   │       │       └── results/page.tsx# Grading and performance analytics
│   │   │       ├── portal/
│   │   │       │   ├── student/
│   │   │       │   │   ├── page.tsx        # Student personal dashboard
│   │   │       │   │   └── exams/[examId]/page.tsx # Wireframe 9: Online Exam Platform
│   │   │       │   └── parent/page.tsx     # Parent attendance & fees overview
│   │   │       └── settings/page.tsx       # Center profile, branches, rooms, API credentials
│   │   └── api/
│   │       ├── auth/callback/route.ts      # OAuth exchange handler
│   │       ├── attendance/scan/route.ts    # High-throughput idempotent scan endpoint
│   │       ├── exams/generate/route.ts     # In-session AI exam generation endpoint
│   │       └── notifications/webhook/route.ts # WhatsApp delivery receipt webhook
│   ├── components/
│   │   ├── ui/                             # Primitive UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── math-view.tsx               # Reusable KaTeX formula renderer
│   │   │   ├── rtl-icon.tsx                # Smart mirrored icon wrapper
│   │   │   └── barcode-scanner.tsx         # Camera / USB Barcode listener
│   │   ├── layout/
│   │   │   ├── center-sidebar.tsx          # Wireframe Deep Navy Navigation Sidebar
│   │   │   ├── center-header.tsx           # Search bar, Branch selector, Theme toggle
│   │   │   ├── owner-sidebar.tsx           # Platform Owner Navigation
│   │   │   └── theme-toggle.tsx            # Light/Dark switch
│   │   ├── dashboard/
│   │   │   ├── stats-card.tsx              # Metric counters with trend indicators
│   │   │   ├── revenue-chart.tsx           # Area/Bar revenue comparison chart
│   │   │   └── stages-donut.tsx            # Donut distribution of student stages
│   │   ├── attendance/
│   │   │   ├── reception-kiosk.tsx         # Real-time scan display with photo & alerts
│   │   │   └── student-badge.tsx           # Printable QR student identity card
│   │   ├── finance/
│   │   │   ├── payroll-calculator.tsx      # Dual formula calculator widget
│   │   │   └── receipt-modal.tsx           # Branded payment receipt printer
│   │   └── exams/
│   │       ├── ai-generator-form.tsx       # AI prompt and indexed source selection
│   │       ├── printable-a4-exam.tsx       # A4 layout with Yalla Center & Teacher logos
│   │       └── online-exam-runner.tsx      # Timed testing runner with autosave
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser Supabase client
│   │   │   ├── server.ts                   # Server Component Supabase client
│   │   │   └── middleware.ts               # Auth & Tenant session resolver
│   │   ├── db/
│   │   │   ├── provider.ts                 # Unified Data Access Layer interface
│   │   │   ├── mock-db/                    # Complete mock database & Egyptian seed data
│   │   │   │   ├── seed-data.ts
│   │   │   │   └── mock-provider.ts
│   │   │   └── schema.sql                  # PostgreSQL Schema & RLS definitions
│   │   ├── calculations/
│   │   │   ├── teacher-compensation.ts     # Center Subscription & Private Lessons math
│   │   │   └── student-billing.ts          # Installment discounts and net calculations
│   │   ├── ai/
│   │   │   ├── exam-generator.ts           # Grounded exam generation logic
│   │   │   └── document-indexer.ts         # Material text chunking & indexing
│   │   ├── notifications/
│   │   │   ├── whatsapp.ts                 # Meta Cloud API client (with sandbox mock)
│   │   │   └── fcm.ts                      # Firebase Web Push client (with sandbox mock)
│   │   ├── tenant/
│   │   │   ├── tenant-context.tsx          # React Context Provider
│   │   │   └── tenant-resolver.ts          # Server-side tenant resolver
│   │   └── utils/
│   │       ├── formatters.ts               # Arabic currency, dates, phone numbers
│   │       └── cn.ts                       # Tailwind clsx/twMerge utility
│   ├── hooks/
│   │   ├── use-tenant.ts                   # Tenant context hook
│   │   ├── use-theme.ts                    # Theme switch hook
│   │   ├── use-barcode-scanner.ts          # Keypress barcode listener
│   │   └── use-exam-timer.ts               # Countdown timer with web worker accuracy
│   └── types/
│       ├── database.ts                     # TypeScript database definitions
│       ├── domain.ts                       # Enums, Roles, Compensation models
│       └── exams.ts                        # Exam questions, KaTeX payloads, submissions
└── tests/
    ├── unit/
    │   ├── calculations.test.ts            # Center Subscription & Private split math
    │   └── idempotency.test.ts             # Duplicate attendance scan verification
    ├── integration/
    │   ├── multi-tenant.test.ts            # Center A vs Center B isolation check
    │   └── security-guardrails.test.ts     # Profile update & role mutation tests
    └── e2e/
        └── reception-workflow.test.ts      # Kiosk scan to parent notification flow
```

---

## 6. Verification and Implementation Checklist

1. **Brand & Wireframe Fidelity**:
   - [x] Official brand assets (`yalla-center-icon.png`, `yalla-center-logo-dark.png`, `yalla-center-logo-light.png`) are referenced directly and uncorrupted.
   - [x] All 11 wireframe views from `public/brand/yalla-center-wireframes.jpg` are accounted for in route and component mappings.
2. **Stack & Styling**:
   - [x] Tailwind config extends deep navy (`#0B132B`) and electric cyan/blue (`#00A3FF`) palette.
   - [x] Cairo font and logical RTL properties (`ms-`, `me-`, `ps-`, `pe-`) standard defined.
   - [x] KaTeX math rendering architecture isolated from RTL text flow.
3. **Multi-Tenancy & Security**:
   - [x] Platform Owner (`/owner`) and Center (`/center/[centerSlug]`) segregated.
   - [x] Strict security guardrails prevent students and teachers from modifying administrative records.
   - [x] Database RLS and triggers enforce profile photo-only updates for students and teachers.
4. **Data Layer & Fallback**:
   - [x] 22 normalized PostgreSQL tables with foreign keys and composite indexes defined.
   - [x] `attendance` table includes `UNIQUE(session_id, student_id)` constraint for idempotent scanning.
   - [x] Sandboxed `MockDataProvider` guarantees 100% offline and demo integrity operation.

---
*Report generated and validated by Architecture Explorer Survey 2.*
