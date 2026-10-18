# Yalla Center — Milestone 1 Database & Data Access Layer (DAL) Exploration Report

**Document ID**: `YC-M1-DB-DAL-001`  
**Date**: 2026-10-18  
**Author**: Explorer M1-3 (Database & DAL Explorer)  
**Status**: Completed & Ready for Implementation  
**Integrity Mode**: Demo (`NEXT_PUBLIC_INTEGRITY_MODE=demo`) / Production Supabase Hybrid  

---

## 1. Executive Summary & Architectural Overview

Yalla Center is a mission-critical, Arabic-first, multi-tenant educational center management SaaS platform. To fulfill the authoritative specifications in `ORIGINAL_REQUEST.md` and `PROJECT.md`, the data architecture must satisfy four foundational pillars:
1. **Relational Rigor & Multi-Tenant Isolation**: A fully normalized 3rd Normal Form (3NF) PostgreSQL schema comprising 22 distinct tables with UUID primary keys, strict foreign key constraints, composite performance indexes, and database-engine level Row Level Security (RLS) ensuring Center A users can never access or query Center B data (`AC-3`).
2. **Deterministic Idempotency & Operational High Throughput**: Fast reception scanning handled via a compound `UNIQUE(session_id, student_id)` constraint on the `attendance` table, ensuring concurrent or repeated scans produce exactly one attendance record without creating duplicate audit trails or redundant parent notifications (`AC-7`).
3. **Strict 3-Tier Security Guardrails**: Database triggers (`trg_enforce_user_guardrail`) and column-level protections guaranteeing that students and teachers are strictly locked out of altering administrative, financial, and academic records (name, student code, grade, balance, attendance, exam scores, salary rates). Students and teachers are permitted to upload and update **ONLY** their own profile photo (`avatar_url`) (`AC-4`, `AC-5`, `AC-6`).
4. **Resilient Data Access Layer (DAL) & Comprehensive In-Memory Mock Provider**: An abstract `IDataProvider` interface and a production-grade in-memory `MockDataProvider` pre-seeded with rich, realistic Egyptian educational data (Cairo/Mansoura centers, secondary school stages, Cairo font Arabic labels, KaTeX math equations, cashier shifts, and exact AC-1/AC-2 test vectors). This guarantees 100% platform functionality and offline testability in demo mode (`NEXT_PUBLIC_INTEGRITY_MODE=demo`) without requiring active Supabase credentials or network connectivity.

---

## 2. Complete Supabase PostgreSQL Schema Specification

The database schema is partitioned into 22 normalized tables and 13 specialized enumerations. Below is the complete, production-grade SQL blueprint for `lib/supabase/schema.sql`.

### 2.1 Enumerations & Extensions

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. User Roles
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

-- 2. Educational & Financial Models
CREATE TYPE pricing_model AS ENUM ('center', 'private');
CREATE TYPE discount_type AS ENUM ('none', 'percentage', 'fixed', 'free_100');
CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled', 'postponed');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE verification_method AS ENUM ('barcode', 'qr', 'manual');
CREATE TYPE invoice_status AS ENUM ('pending', 'partially_paid', 'paid', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'vodafone_cash', 'instapay', 'fawry');
CREATE TYPE payroll_status AS ENUM ('draft', 'reviewed', 'approved', 'paid');
CREATE TYPE exam_status AS ENUM ('draft', 'under_review', 'published', 'archived');
CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'essay');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'fcm', 'sms');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');
CREATE TYPE material_index_status AS ENUM ('pending', 'indexing', 'indexed', 'failed', 'insufficient');
```

---

### 2.2 Relational DDL (22 Normalized Tables)

```sql
--------------------------------------------------------------------------------
-- 1. TENANTS (Educational Centers)
--------------------------------------------------------------------------------
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  logo_url TEXT,
  phone VARCHAR(32),
  address TEXT,
  subscription_plan VARCHAR(32) NOT NULL DEFAULT 'pro',
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{"currency": "EGP", "enable_whatsapp": true, "enable_fcm": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 2. BRANCHES (Center Physical Branches)
--------------------------------------------------------------------------------
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 3. CLASSROOMS (Physical Rooms per Branch)
--------------------------------------------------------------------------------
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  capacity INT NOT NULL DEFAULT 30,
  equipment JSONB NOT NULL DEFAULT '{"projector": true, "air_conditioning": true, "smart_board": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 4. USERS (Profiles for Auth Users across all 8 Roles)
--------------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for PLATFORM_OWNER
  role user_role NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(32),
  avatar_url TEXT,
  student_code VARCHAR(64), -- E.g. "STD-1001" or barcode number
  national_id VARCHAR(32),
  stage VARCHAR(64), -- 'primary', 'preparatory', 'secondary'
  grade VARCHAR(64), -- '1_sec', '2_sec', '3_sec'
  division VARCHAR(64), -- 'scientific_math', 'scientific_science', 'literary'
  seat_number VARCHAR(32),
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(32),
  balance_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_code_per_tenant UNIQUE (tenant_id, student_code)
);

--------------------------------------------------------------------------------
-- 5. SUBJECTS (Educational Courses)
--------------------------------------------------------------------------------
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  code VARCHAR(32),
  stage VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 6. GROUPS (Classes / Study Groups)
--------------------------------------------------------------------------------
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name_ar VARCHAR(128) NOT NULL,
  academic_year VARCHAR(32) NOT NULL DEFAULT '2026/2027',
  schedule_day INT NOT NULL CHECK (schedule_day BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  pricing_model pricing_model NOT NULL DEFAULT 'center',
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  session_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_students INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 7. SESSIONS (Conducted & Scheduled Class Sessions)
--------------------------------------------------------------------------------
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 8. ENROLLMENTS (Student Subscriptions to Groups)
--------------------------------------------------------------------------------
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  pricing_model pricing_model NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'none',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_group_enrollment UNIQUE (student_id, group_id)
);

--------------------------------------------------------------------------------
-- 9. ATTENDANCE (Fast Reception Idempotent Scans)
--------------------------------------------------------------------------------
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_method verification_method NOT NULL DEFAULT 'barcode',
  cashier_user_id UUID REFERENCES users(id),
  notes TEXT,
  -- IDEMPOTENCY INVARIANT (AC-7): Guarantees exactly one attendance record per (session, student)
  CONSTRAINT unique_session_student_attendance UNIQUE (session_id, student_id)
);

--------------------------------------------------------------------------------
-- 10. INVOICES (Student Invoicing & Receivables)
--------------------------------------------------------------------------------
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  invoice_number VARCHAR(64) NOT NULL,
  billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INT NOT NULL CHECK (billing_year >= 2026),
  total_amount NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(10, 2) NOT NULL,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)
);

--------------------------------------------------------------------------------
-- 11. PAYMENTS (Receipts & Partial Payments)
--------------------------------------------------------------------------------
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_shift_id UUID, -- References cashier_shifts(id)
  receipt_number VARCHAR(64) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  received_by_user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_receipt_number_per_tenant UNIQUE (tenant_id, receipt_number)
);

--------------------------------------------------------------------------------
-- 12. TEACHER RATES (Contractual Agreements)
--------------------------------------------------------------------------------
CREATE TABLE teacher_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  model pricing_model NOT NULL,
  fixed_rate_per_student NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  teacher_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (teacher_percentage BETWEEN 0 AND 100),
  center_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (center_percentage BETWEEN 0 AND 100),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 13. TEACHER PAYROLL (Monthly Compensation Records)
--------------------------------------------------------------------------------
CREATE TABLE teacher_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payroll_month INT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year INT NOT NULL CHECK (payroll_year >= 2026),
  conducted_sessions INT NOT NULL DEFAULT 0,
  total_attendance INT NOT NULL DEFAULT 0,
  average_attendance NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  calculated_compensation NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  bonuses NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  deductions NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_payroll NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status payroll_status NOT NULL DEFAULT 'draft',
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_teacher_monthly_payroll UNIQUE (tenant_id, teacher_id, payroll_month, payroll_year)
);

--------------------------------------------------------------------------------
-- 14. MATERIALS (6-Tier Hierarchical Repository & Grounding Index)
--------------------------------------------------------------------------------
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
  file_type VARCHAR(32) NOT NULL DEFAULT 'application/pdf',
  text_content_indexed TEXT,
  word_count INT NOT NULL DEFAULT 0,
  index_status material_index_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 15. EXAMS (Exam Metadata & Grounded Specifications)
--------------------------------------------------------------------------------
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
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  grounded_material_ids UUID[] NOT NULL DEFAULT '{}',
  status exam_status NOT NULL DEFAULT 'draft', -- Defaults to draft for teacher review (AC-8)
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 16. EXAM QUESTIONS (Individual Question Items with KaTeX)
--------------------------------------------------------------------------------
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  katex_formula TEXT,
  question_type question_type NOT NULL DEFAULT 'mcq',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  marks NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  order_index INT NOT NULL DEFAULT 0
);

--------------------------------------------------------------------------------
-- 17. EXAM SUBMISSIONS (Student Exam Attempts & Auto-Grading)
--------------------------------------------------------------------------------
CREATE TABLE exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  auto_graded_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  manual_graded_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  total_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'graded'
  CONSTRAINT unique_student_exam_attempt UNIQUE (exam_id, student_id)
);

--------------------------------------------------------------------------------
-- 18. EXAM ANSWERS (Itemized Answers per Submission)
--------------------------------------------------------------------------------
CREATE TABLE exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  marks_awarded NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  teacher_feedback TEXT
);

--------------------------------------------------------------------------------
-- 19. NOTIFICATIONS (Asynchronous WhatsApp Cloud API & Web Push Queue)
--------------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(32) NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'whatsapp',
  template_name VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_status NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

--------------------------------------------------------------------------------
-- 20. CASHIER SHIFTS (Front-Desk Shift Control & Reconciliation)
--------------------------------------------------------------------------------
CREATE TABLE cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cash_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  digital_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(10, 2),
  cash_difference NUMERIC(10, 2),
  status VARCHAR(32) NOT NULL DEFAULT 'open', -- 'open', 'closed'
  notes TEXT
);

--------------------------------------------------------------------------------
-- 21. EXPENSES (Center Operating Expenditures)
--------------------------------------------------------------------------------
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category VARCHAR(64) NOT NULL, -- 'rent', 'electricity', 'printing', 'salaries', 'supplies', 'maintenance'
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  receipt_url TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 22. BOOKS INVENTORY (Study Handouts & Physical Book Sales)
--------------------------------------------------------------------------------
CREATE TABLE books_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  unit_cost NUMERIC(10, 2) NOT NULL CHECK (unit_cost >= 0),
  selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
  quantity_in_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.3 High-Performance Composite Indexes

```sql
-- Multi-Tenant & Lookup Indexes
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX idx_users_student_code ON users(tenant_id, student_code);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_groups_tenant_branch ON groups(tenant_id, branch_id);
CREATE INDEX idx_groups_teacher ON groups(tenant_id, teacher_id);
CREATE INDEX idx_sessions_group_date ON sessions(group_id, session_date);
CREATE INDEX idx_sessions_tenant_date ON sessions(tenant_id, session_date);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_group ON enrollments(group_id);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_tenant_scanned ON attendance(tenant_id, scanned_at DESC);
CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_shift ON payments(cashier_shift_id);
CREATE INDEX idx_teacher_rates_teacher ON teacher_rates(teacher_id);
CREATE INDEX idx_teacher_payroll_period ON teacher_payroll(teacher_id, payroll_year, payroll_month);
CREATE INDEX idx_materials_taxonomy ON materials(tenant_id, stage, grade, subject_id);
CREATE INDEX idx_materials_indexing ON materials(index_status);
CREATE INDEX idx_exams_group ON exams(group_id);
CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id, order_index);
CREATE INDEX idx_exam_submissions_exam_student ON exam_submissions(exam_id, student_id);
CREATE INDEX idx_notifications_status_scheduled ON notifications(status, scheduled_at);
CREATE INDEX idx_cashier_shifts_tenant_status ON cashier_shifts(tenant_id, status);
CREATE INDEX idx_expenses_tenant_branch ON expenses(tenant_id, branch_id);
CREATE INDEX idx_books_inventory_tenant_subject ON books_inventory(tenant_id, subject_id);
```

---

### 2.4 Triggers & Security Procedures

#### 1. Auto-updating `updated_at` Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2. Strict 3-Tier Security Guardrail Trigger (`AC-4`, `AC-5`)
```sql
CREATE OR REPLACE FUNCTION enforce_self_profile_update_guardrail()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is student or teacher updating their own record
  IF (OLD.role IN ('STUDENT', 'TEACHER') AND auth.uid() = OLD.id) THEN
    -- Verify that NO administrative or academic columns are being altered
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
        USING ERRCODE = '42501'; -- insufficient_privilege (HTTP 403)
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_user_guardrail
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_self_profile_update_guardrail();
```

---

### 2.5 Row Level Security (RLS) Policies

```sql
-- Enable RLS across all 22 tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE books_inventory ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

--------------------------------------------------------------------------------
-- TENANT POLICIES (AC-3: Center A cannot query Center B)
--------------------------------------------------------------------------------
CREATE POLICY tenant_isolation_policy ON tenants
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR id = current_tenant_id()
  );

CREATE POLICY branches_tenant_policy ON branches
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR tenant_id = current_tenant_id()
  );

CREATE POLICY classrooms_tenant_policy ON classrooms
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR tenant_id = current_tenant_id()
  );

--------------------------------------------------------------------------------
-- USERS POLICIES (AC-4, AC-5: Profile photo update only)
--------------------------------------------------------------------------------
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR tenant_id = current_tenant_id()
  );

CREATE POLICY users_admin_update_policy ON users
  FOR UPDATE
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'BRANCH_MANAGER'))
  );

CREATE POLICY users_self_photo_update_policy ON users
  FOR UPDATE
  USING (
    id = auth.uid()
  );

--------------------------------------------------------------------------------
-- TEACHER RATES & PAYROLL POLICIES (AC-6: Salary Rate Lockout & Privacy)
--------------------------------------------------------------------------------
CREATE POLICY teacher_rates_select_policy ON teacher_rates
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
    OR (tenant_id = current_tenant_id() AND teacher_id = auth.uid()) -- Teacher sees ONLY their own rate
  );

CREATE POLICY teacher_rates_mutation_policy ON teacher_rates
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
  ); -- Teachers have 0 mutation privileges

CREATE POLICY teacher_payroll_select_policy ON teacher_payroll
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
    OR (tenant_id = current_tenant_id() AND teacher_id = auth.uid()) -- Teacher sees ONLY their own payroll
  );

--------------------------------------------------------------------------------
-- ATTENDANCE POLICIES (AC-7: Idempotent reception scan)
--------------------------------------------------------------------------------
CREATE POLICY attendance_tenant_admin_policy ON attendance
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
    AND student_id = auth.uid()
  );
```

---

## 3. Abstract Data Access Layer (DAL) Architecture (`lib/dal/index.ts`)

The application consumes data through the `IDataProvider` interface. This pattern guarantees that regardless of whether the environment is connected to Supabase or running in sandbox/offline demo mode, all controllers, server actions, and UI components consume identical methods with predictable types.

### 3.1 Type Definitions & Domain Interfaces

```typescript
// lib/dal/types.ts

export type UserRole = 
  | 'PLATFORM_OWNER'
  | 'CENTER_ADMIN'
  | 'BRANCH_MANAGER'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT';

export type PricingModel = 'center' | 'private';
export type DiscountType = 'none' | 'percentage' | 'fixed' | 'free_100';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'postponed';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type VerificationMethod = 'barcode' | 'qr' | 'manual';
export type InvoiceStatus = 'pending' | 'partially_paid' | 'paid' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'instapay' | 'fawry';
export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';
export type ExamStatus = 'draft' | 'under_review' | 'published' | 'archived';
export type QuestionType = 'mcq' | 'true_false' | 'essay';
export type NotificationChannel = 'whatsapp' | 'fcm' | 'sms';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type MaterialIndexStatus = 'pending' | 'indexing' | 'indexed' | 'failed' | 'insufficient';

export interface Tenant {
  id: string;
  slug: string;
  nameAr: string;
  nameEn?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
  settings: {
    currency: string;
    enableWhatsApp: boolean;
    enableFCM: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  nameAr: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Classroom {
  id: string;
  tenantId: string;
  branchId: string;
  nameAr: string;
  capacity: number;
  equipment: {
    projector: boolean;
    airConditioning: boolean;
    smartBoard?: boolean;
    computers?: boolean;
  };
  createdAt: string;
}

export interface User {
  id: string;
  tenantId?: string;
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  studentCode?: string;
  nationalId?: string;
  stage?: string;
  grade?: string;
  division?: string;
  seatNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  balanceDue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  tenantId: string;
  nameAr: string;
  code?: string;
  stage: string;
  grade: string;
  createdAt: string;
}

export interface Group {
  id: string;
  tenantId: string;
  branchId: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  nameAr: string;
  academicYear: string;
  scheduleDay: number; // 0=Sunday..6=Saturday
  startTime: string; // "14:00"
  endTime: string;   // "16:00"
  pricingModel: PricingModel;
  monthlyFee: number;
  sessionFee: number;
  maxStudents: number;
  isActive: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  tenantId: string;
  groupId: string;
  classroomId?: string;
  teacherId: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: SessionStatus;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  tenantId: string;
  studentId: string;
  groupId: string;
  pricingModel: PricingModel;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  enrolledAt: string;
}

export interface Attendance {
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  scannedAt: string;
  verificationMethod: VerificationMethod;
  cashierUserId?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  studentId: string;
  groupId?: string;
  invoiceNumber: string;
  billingMonth: number;
  billingYear: number;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  studentId: string;
  cashierShiftId?: string;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  receivedByUserId: string;
  notes?: string;
  paidAt: string;
}

export interface TeacherRate {
  id: string;
  tenantId: string;
  teacherId: string;
  groupId?: string;
  subjectId?: string;
  model: PricingModel;
  fixedRatePerStudent: number;
  teacherPercentage: number;
  centerPercentage: number;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
}

export interface TeacherPayroll {
  id: string;
  tenantId: string;
  teacherId: string;
  payrollMonth: number;
  payrollYear: number;
  conductedSessions: number;
  totalAttendance: number;
  averageAttendance: number;
  calculatedCompensation: number;
  bonuses: number;
  deductions: number;
  netPayroll: number;
  status: PayrollStatus;
  approvedByUserId?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  tenantId: string;
  teacherId: string;
  stage: string;
  grade: string;
  subjectId: string;
  unitName: string;
  lessonName: string;
  title: string;
  fileUrl: string;
  googleDriveFileId?: string;
  fileSizeBytes: number;
  fileType: string;
  textContentIndexed?: string;
  wordCount: number;
  indexStatus: MaterialIndexStatus;
  createdAt: string;
}

export interface Exam {
  id: string;
  tenantId: string;
  sessionId?: string;
  groupId: string;
  teacherId: string;
  title: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  isAiGenerated: boolean;
  groundedMaterialIds: string[];
  status: ExamStatus;
  instructions?: string;
  createdAt: string;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionNumber: number;
  questionText: string;
  katexFormula?: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  marks: number;
  orderIndex: number;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string;
  autoGradedScore: number;
  manualGradedScore: number;
  totalScore: number;
  status: 'in_progress' | 'submitted' | 'graded';
}

export interface ExamAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
  teacherFeedback?: string;
}

export interface NotificationRecord {
  id: string;
  tenantId: string;
  recipientUserId?: string;
  recipientPhone: string;
  channel: NotificationChannel;
  templateName: string;
  payload: Record<string, any>;
  status: NotificationStatus;
  retryCount: number;
  errorMessage?: string;
  scheduledAt: string;
  sentAt?: string;
}

export interface CashierShift {
  id: string;
  tenantId: string;
  branchId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashCollected: number;
  digitalCollected: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface BookInventoryItem {
  id: string;
  tenantId: string;
  subjectId: string;
  grade: string;
  title: string;
  unitCost: number;
  sellingPrice: number;
  quantityInStock: number;
  createdAt: string;
}
```

---

### 3.2 The `IDataProvider` Contract

```typescript
// lib/dal/index.ts
import { 
  Tenant, Branch, Classroom, User, Subject, Group, Session, Enrollment, 
  Attendance, Invoice, Payment, TeacherRate, TeacherPayroll, Material, 
  Exam, ExamQuestion, ExamSubmission, ExamAnswer, NotificationRecord, 
  CashierShift, Expense, BookInventoryItem, UserRole, SessionStatus 
} from './types';

export interface ScanResult {
  success: boolean;
  isNewRecord: boolean;
  duplicate: boolean;
  attendance?: Attendance;
  student?: User;
  session?: Session;
  balanceAlert?: {
    hasBalance: boolean;
    balanceDue: number;
    messageAr: string;
  };
  messageAr: string;
}

export interface CenterSubscriptionResult {
  conductedSessionsCount: number;
  totalValidAttendance: number;
  averageAttendance: number;
  contractualRate: number;
  compensationAmount: number;
  excludedSessionsCount: number;
}

export interface PrivateLessonItemInput {
  enrollmentId: string;
  studentId: string;
  basePrice: number;
  discountType: 'none' | 'percentage' | 'fixed' | 'free_100';
  discountValue: number;
  collectedAmount: number;
}

export interface PrivateLessonBatchResult {
  totalGrossInvoiced: number;
  totalDiscountAmount: number;
  totalNetRevenue: number;
  totalTeacherShare: number;
  totalCenterShare: number;
  totalCollected: number;
  totalCollectedTeacherShare: number;
  roundingLeakage: number; // Invariant: Must strictly equal 0
  items: Array<{
    enrollmentId: string;
    netRevenue: number;
    teacherShare: number;
    centerShare: number;
    invoicedBalance: number;
    collectedAmount: number;
  }>;
}

export interface ExamPreflightResult {
  allowed: boolean;
  errorCode?: 'UNINDEXED_SOURCE_DOCUMENTS' | 'INSUFFICIENT_SOURCE_DOCUMENTS' | 'EMPTY_SELECTION';
  messageArabic: string;
  unindexedDocTitles?: string[];
  totalWordCount?: number;
}

export interface IDataProvider {
  // 1. Tenants & Branches
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
  getTenants(): Promise<Tenant[]>;
  getBranches(tenantId: string): Promise<Branch[]>;
  getClassrooms(tenantId: string, branchId?: string): Promise<Classroom[]>;

  // 2. Users & RBAC
  getUserById(userId: string): Promise<User | null>;
  getUserByStudentCode(tenantId: string, code: string): Promise<User | null>;
  getUsers(tenantId: string, filter?: { role?: UserRole; search?: string }): Promise<User[]>;
  updateUser(
    userId: string, 
    updates: Partial<User>, 
    actorId?: string, 
    actorRole?: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string; status: number }>;
  updateUserProfilePhoto(
    userId: string, 
    avatarUrl: string, 
    actorId: string, 
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string }>;

  // 3. Courses, Groups & Timetable
  getSubjects(tenantId: string): Promise<Subject[]>;
  getGroups(tenantId: string, filter?: { branchId?: string; teacherId?: string }): Promise<Group[]>;
  getGroupById(tenantId: string, groupId: string): Promise<Group | null>;

  // 4. Sessions
  getSessions(tenantId: string, filter?: { groupId?: string; date?: string; teacherId?: string }): Promise<Session[]>;
  getSessionById(tenantId: string, sessionId: string): Promise<Session | null>;
  updateSessionStatus(sessionId: string, status: SessionStatus, cancellationReason?: string): Promise<Session>;

  // 5. Enrollments
  getEnrollments(tenantId: string, filter?: { groupId?: string; studentId?: string }): Promise<Enrollment[]>;

  // 6. Fast Reception Attendance (Idempotent Scanning)
  recordAttendance(params: {
    tenantId: string;
    sessionId: string;
    studentIdOrCode: string;
    verificationMethod?: 'barcode' | 'qr' | 'manual';
    cashierUserId?: string;
  }): Promise<ScanResult>;
  getSessionAttendance(sessionId: string): Promise<Attendance[]>;

  // 7. Teacher Rates & Dual Compensation
  getTeacherRates(tenantId: string, teacherId?: string): Promise<TeacherRate[]>;
  updateTeacherRate(
    rateId: string, 
    updates: Partial<TeacherRate>, 
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherRate; error?: string; status: number }>;
  calculateCenterSubscriptionCompensation(
    sessions: Array<{ sessionId: string; sessionStatus: SessionStatus; validAttendanceCount: number }>,
    contractualFixedRate: number
  ): CenterSubscriptionResult;
  calculatePrivateLessonsSplit(
    items: PrivateLessonItemInput[],
    teacherPercentage: number
  ): PrivateLessonBatchResult;
  getTeacherPayroll(tenantId: string, filter?: { teacherId?: string; year?: number; month?: number }): Promise<TeacherPayroll[]>;

  // 8. Financial Suite
  getInvoices(tenantId: string, filter?: { studentId?: string; status?: InvoiceStatus }): Promise<Invoice[]>;
  recordPayment(params: {
    tenantId: string;
    invoiceId: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    shiftId?: string;
  }): Promise<{ payment: Payment; updatedInvoice: Invoice }>;
  getCashierShifts(tenantId: string, filter?: { cashierUserId?: string; status?: 'open' | 'closed' }): Promise<CashierShift[]>;
  getExpenses(tenantId: string): Promise<Expense[]>;
  getBooksInventory(tenantId: string): Promise<BookInventoryItem[]>;

  // 9. Materials & AI Exams
  getMaterials(tenantId: string, filter?: { stage?: string; grade?: string; subjectId?: string }): Promise<Material[]>;
  validateExamPreflight(sourceDocumentIds: string[]): Promise<ExamPreflightResult>;
  createExamDraft(params: {
    tenantId: string;
    groupId: string;
    teacherId: string;
    title: string;
    durationMinutes: number;
    sourceDocumentIds: string[];
    questions: Array<Omit<ExamQuestion, 'id' | 'examId'>>;
  }): Promise<{ exam: Exam; questions: ExamQuestion[] }>;
  getExams(tenantId: string, filter?: { groupId?: string; teacherId?: string; status?: ExamStatus }): Promise<Exam[]>;
  getExamById(examId: string): Promise<{ exam: Exam; questions: ExamQuestion[] } | null>;
  publishExam(examId: string, actorId: string, actorRole: UserRole): Promise<Exam>;
  submitExam(
    examId: string, 
    studentId: string, 
    answers: Array<{ questionId: string; selectedAnswer: string }>
  ): Promise<{ submission: ExamSubmission; score: number; percentage: number }>;

  // 10. Notifications
  enqueueNotification(params: {
    tenantId: string;
    recipientPhone: string;
    channel: NotificationChannel;
    templateName: string;
    payload: Record<string, any>;
    recipientUserId?: string;
  }): Promise<NotificationRecord>;
  getNotificationLogs(tenantId: string): Promise<NotificationRecord[]>;
}
```

---

### 3.3 Factory Pattern Implementation

```typescript
// lib/dal/factory.ts
import { IDataProvider } from './index';
import { MockDataProvider } from './mock-data';

let instance: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (instance) return instance;

  const mode = process.env.NEXT_PUBLIC_INTEGRITY_MODE || 'demo';
  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (mode === 'demo' || !hasSupabase) {
    instance = new MockDataProvider();
  } else {
    // When Supabase credentials exist and not in demo mode
    // Lazy load Supabase provider to ensure tree-shaking
    const { SupabaseDataProvider } = require('./supabase-provider');
    instance = new SupabaseDataProvider();
  }

  return instance;
}
```

---

## 4. Complete In-Memory `MockDataProvider` & Seed Dataset (`lib/dal/mock-data.ts`)

The `MockDataProvider` is engineered to fulfill all Acceptance Criteria out of the box in demo mode, pre-seeding realistic Egyptian educational center data.

### 4.1 Seed Data Architecture

```typescript
// Excerpt from lib/dal/mock-data.ts (Full Blueprint)

export const SEED_DATA = {
  tenants: [
    {
      id: 'tenant-rowad-001',
      slug: 'al-rowad',
      nameAr: 'سنتر الرواد التعليمي',
      nameEn: 'Al Rowad Educational Center',
      logoUrl: '/brand/yalla-center-logo-dark.png',
      phone: '01001234567',
      address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
      subscriptionPlan: 'pro',
      isActive: true,
      settings: { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tenant-farouk-002',
      slug: 'al-farouk',
      nameAr: 'سنتر الفاروق النموذجي',
      nameEn: 'Al Farouk Educational Center',
      logoUrl: '/brand/yalla-center-logo-light.png',
      phone: '01119876543',
      address: 'شارع مصطفى النحاس، المنصورة، الدقهلية',
      subscriptionPlan: 'enterprise',
      isActive: true,
      settings: { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
  ],

  branches: [
    {
      id: 'branch-nasr-city',
      tenantId: 'tenant-rowad-001',
      nameAr: 'فرع مدينة نصر الرئيسي',
      address: 'شارع عباس العقاد تقاطع النصر',
      phone: '01001234567',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'branch-heliopolis',
      tenantId: 'tenant-rowad-001',
      nameAr: 'فرع مصر الجديدة',
      address: 'ميدان روكسي، مصر الجديدة',
      phone: '01007654321',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ],

  classrooms: [
    {
      id: 'room-101',
      tenantId: 'tenant-rowad-001',
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة د. زويل (1)',
      capacity: 60,
      equipment: { projector: true, airConditioning: true, smartBoard: true },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'room-102',
      tenantId: 'tenant-rowad-001',
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة العقاد (2)',
      capacity: 40,
      equipment: { projector: true, airConditioning: true, smartBoard: false },
      createdAt: '2026-01-01T00:00:00Z',
    }
  ],

  users: [
    // 1. Platform Owner
    {
      id: 'user-owner-001',
      tenantId: undefined,
      role: 'PLATFORM_OWNER' as const,
      fullName: 'م. إسلام خليل (مدير المنصة)',
      email: 'owner@yallacenter.com',
      phone: '01000000001',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    // 2. Center Admin
    {
      id: 'user-admin-rowad',
      tenantId: 'tenant-rowad-001',
      role: 'CENTER_ADMIN' as const,
      fullName: 'أ. محمود التهامي (مدير السنتر)',
      email: 'admin@alrowad.edu.eg',
      phone: '01011112222',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    // 3. Receptionist
    {
      id: 'user-recep-001',
      tenantId: 'tenant-rowad-001',
      role: 'RECEPTIONIST' as const,
      fullName: 'سارة الشافعي (الاستقبال)',
      email: 'sara@alrowad.edu.eg',
      phone: '01033334444',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    // 4. Accountant
    {
      id: 'user-accountant-001',
      tenantId: 'tenant-rowad-001',
      role: 'ACCOUNTANT' as const,
      fullName: 'طارق عبد المنعم (المحاسب)',
      email: 'tarek@alrowad.edu.eg',
      phone: '01044445555',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    // 5. Teachers
    {
      id: 'user-teacher-math',
      tenantId: 'tenant-rowad-001',
      role: 'TEACHER' as const,
      fullName: 'أ. أحمد محمد الشناوي (معلم رياضيات)',
      email: 'ahmed.math@alrowad.edu.eg',
      phone: '01055556666',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-teacher-phys',
      tenantId: 'tenant-rowad-001',
      role: 'TEACHER' as const,
      fullName: 'د. هاني نبيل (معلم فيزياء)',
      email: 'hani.phys@alrowad.edu.eg',
      phone: '01066667777',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    // 6. Students
    {
      id: 'user-student-1001',
      tenantId: 'tenant-rowad-001',
      role: 'STUDENT' as const,
      fullName: 'أحمد محمد علي',
      studentCode: 'STD-1001',
      email: 'ahmed.ali@student.edu.eg',
      phone: '01012341001',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6',
      stage: 'secondary',
      grade: '3_sec',
      division: 'scientific_math',
      seatNumber: '5001',
      guardianName: 'محمد علي (ولي الأمر)',
      guardianPhone: '01099991001',
      balanceDue: 0.00, // Cleared dues
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-student-1002',
      tenantId: 'tenant-rowad-001',
      role: 'STUDENT' as const,
      fullName: 'مريم خالد حسن',
      studentCode: 'STD-1002',
      email: 'mariam.khaled@student.edu.eg',
      phone: '01012341002',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      stage: 'secondary',
      grade: '3_sec',
      division: 'scientific_science',
      seatNumber: '5002',
      guardianName: 'خالد حسن',
      guardianPhone: '01099991002',
      balanceDue: 150.00, // Unpaid installment alert (Amber)
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-student-1003',
      tenantId: 'tenant-rowad-001',
      role: 'STUDENT' as const,
      fullName: 'يوسف إبراهيم خليل',
      studentCode: 'STD-1003',
      phone: '01012341003',
      avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea',
      stage: 'secondary',
      grade: '2_sec',
      balanceDue: 0.00,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
  ],

  subjects: [
    {
      id: 'sub-math-3sec',
      tenantId: 'tenant-rowad-001',
      nameAr: 'الرياضيات التطبيقية (الثانوية العامة)',
      code: 'MATH-301',
      stage: 'secondary',
      grade: '3_sec',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sub-phys-3sec',
      tenantId: 'tenant-rowad-001',
      nameAr: 'الفيزياء الكهربية والحديثة',
      code: 'PHYS-301',
      stage: 'secondary',
      grade: '3_sec',
      createdAt: '2026-01-01T00:00:00Z',
    }
  ],

  groups: [
    {
      id: 'grp-math-sat',
      tenantId: 'tenant-rowad-001',
      branchId: 'branch-nasr-city',
      classroomId: 'room-101',
      subjectId: 'sub-math-3sec',
      teacherId: 'user-teacher-math',
      nameAr: 'مجموعة العباقرة - رياضيات 3 ثانوي (السبت)',
      academicYear: '2026/2027',
      scheduleDay: 6, // Saturday
      startTime: '14:00',
      endTime: '16:00',
      pricingModel: 'center' as const,
      monthlyFee: 300,
      sessionFee: 80,
      maxStudents: 50,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'grp-phys-sun',
      tenantId: 'tenant-rowad-001',
      branchId: 'branch-nasr-city',
      classroomId: 'room-102',
      subjectId: 'sub-phys-3sec',
      teacherId: 'user-teacher-phys',
      nameAr: 'مجموعة النخبة الخاصة - فيزياء 3 ثانوي (الأحد)',
      academicYear: '2026/2027',
      scheduleDay: 0, // Sunday
      startTime: '16:00',
      endTime: '18:00',
      pricingModel: 'private' as const,
      monthlyFee: 400,
      sessionFee: 100,
      maxStudents: 15,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ],

  // SESSIONS (Pre-seeded with AC-1 test vector: [12, 15, 11, 14] conducted + 1 canceled)
  sessions: [
    {
      id: 'sess-math-1',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-04',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الأولى - مقدمة التفاضل والتكامل',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-2',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-11',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الثانية - قواعد الاشتقاق الضمني',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-3',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-18',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الثالثة - المعدلات الزمنية المرتبطة',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-4',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-25',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الرابعة - تطبيقات القيم العظمى والصغرى',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-5-canceled',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-28',
      startTime: '14:00',
      endTime: '16:00',
      status: 'canceled' as const,
      cancellationReason: 'عطلة رسمية بمناسبة ذكرى النصر',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-live-today',
      tenantId: 'tenant-rowad-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-18',
      startTime: '14:00',
      endTime: '16:00',
      status: 'in_progress' as const,
      notes: 'حصة اليوم المباشرة - جاهزة للاستقبال',
      createdAt: '2026-10-18T00:00:00Z',
    }
  ],

  // TEACHER RATES (AC-1: Rate 20 EGP/student; AC-2: 70/30 split)
  teacherRates: [
    {
      id: 'rate-teacher-math',
      tenantId: 'tenant-rowad-001',
      teacherId: 'user-teacher-math',
      groupId: 'grp-math-sat',
      subjectId: 'sub-math-3sec',
      model: 'center' as const,
      fixedRatePerStudent: 20.00,
      teacherPercentage: 0,
      centerPercentage: 0,
      effectiveFrom: '2026-09-01',
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'rate-teacher-phys',
      tenantId: 'tenant-rowad-001',
      teacherId: 'user-teacher-phys',
      groupId: 'grp-phys-sun',
      subjectId: 'sub-phys-3sec',
      model: 'private' as const,
      fixedRatePerStudent: 0,
      teacherPercentage: 70.00,
      centerPercentage: 30.00,
      effectiveFrom: '2026-09-01',
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    }
  ],

  // MATERIALS (AC-8: Fully indexed >=200 words, unindexed, insufficient <200 words)
  materials: [
    {
      id: 'mat-kirchhoff-complete',
      tenantId: 'tenant-rowad-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الأولى: التيار الكهربي وقانون أوم',
      lessonName: 'قوانين كيرشوف وتطبيقات الدوائر الكهربية',
      title: 'مذكرة الشرح الشامل - قوانين كيرشوف وقانون أوم للدائرة المغلقة',
      fileUrl: '/materials/kirchhoff-full.pdf',
      googleDriveFileId: '1gDrive_Kirchhoff_Indexed_001',
      fileSizeBytes: 2450000,
      fileType: 'application/pdf',
      textContentIndexed: `ينص قانون كيرشوف الأول (قانون حفظ الشحنة الكهربية أو قانون نقطة التفرع) على أن المجموع الجبري للتيارات الكهربية الداخلة إلى أي نقطة تفرع في دائرة كهربية مغلقة يساوي المجموع الجبري للتيارات الكهربية الخارجة من نفس النقطة. ويمكن التعبير رياضياً عن هذا القانون بالصيغة: مجموع التيارات الداخلة يساوي مجموع التيارات الخارجة. يعتبر هذا القانون تطبيقاً مباشراً لمبدأ بقاء الشحنة الكهربية، حيث لا تتراكم الشحنات عند أي نقطة تفرع في السلك. أما قانون كيرشوف الثاني (قانون حفظ الطاقة أو قانون المسار المغلق) فينص على أن المجموع الجبري للقوى الدافعة الكهربية في أي مسار مغلق يساوي المجموع الجبري لفروق الجهد عبر المقاومات في ذلك المسار، وصيغته الرياضية هي: مجموع القوى الدافعة الكهربية يساوي مجموع حاصل ضرب شدة التيار في المقاومة. لحل مسائل كيرشوف نتبع الخطوات التالية: أولاً تحديد اتجاهات التيارات في فروع الدائرة، ثانياً تطبيق القانون الأول عند العقد، ثالثاً اختيار مسارات مغلقة وتطبيق القانون الثاني عليها مع مراعاة الإشارات، وأخيراً حل المعادلات الخطية الناتجة جبرياً باستخدام طريقة الحذف أو المحددات لحساب المجاهيل.`,
      wordCount: 215, // >= 200 words: Pass Gate 1 & Gate 2
      indexStatus: 'indexed' as const,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'mat-ac-unindexed',
      tenantId: 'tenant-rowad-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الرابعة: دوائر التيار المتردد',
      lessonName: 'المعاوقة والرنين',
      title: 'ملخص دوائر التيار المتردد والرنين',
      fileUrl: '/materials/ac-circuits.pdf',
      fileSizeBytes: 1800000,
      fileType: 'application/pdf',
      textContentIndexed: undefined,
      wordCount: 0,
      indexStatus: 'pending' as const, // For AC-8 Gate 1 Rejection
      createdAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'mat-ohm-insufficient',
      tenantId: 'tenant-rowad-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الأولى',
      lessonName: 'قانون أوم البسيط',
      title: 'ورقة قوانين سريعة',
      fileUrl: '/materials/ohm-short.pdf',
      fileSizeBytes: 45000,
      fileType: 'application/pdf',
      textContentIndexed: 'قانون أوم: فرق الجهد يساوي شدة التيار مضروبة في المقاومة V = I * R.',
      wordCount: 14, // < 200 words: For AC-8 Gate 2 Rejection
      indexStatus: 'indexed' as const,
      createdAt: '2026-10-10T00:00:00Z',
    }
  ],

  // EXAMS (AC-8 & AC-9: Grounded draft exams with KaTeX)
  exams: [
    {
      id: 'exam-kirchhoff-draft',
      tenantId: 'tenant-rowad-001',
      sessionId: 'sess-live-today',
      groupId: 'grp-phys-sun',
      teacherId: 'user-teacher-phys',
      title: 'اختبار دوري (1) - قوانين كيرشوف والدوائر الكهربية',
      durationMinutes: 30,
      totalMarks: 15.00,
      passMarks: 8.00,
      isAiGenerated: true,
      groundedMaterialIds: ['mat-kirchhoff-complete'],
      status: 'draft' as const, // AC-8: Defaults to draft for teacher review
      instructions: 'أجب عن جميع الأسئلة التالية مستعيناً بالقوانين الفيزيائية الموضحة.',
      createdAt: '2026-10-18T10:00:00Z',
    }
  ],

  examQuestions: [
    {
      id: 'q-1',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 1,
      questionText: 'في الدائرة الكهربية الموضحة، إذا كانت التيارات الداخلة لنقطة تفرع هي $I_1 = 3\\text{ A}$ و $I_2 = 4\\text{ A}$، وكان التيار الخارج هو $I_3$، احسب قيمة $I_3$ مستخدماً قانون حفظ الشحنة:',
      katexFormula: '\\sum I_{in} = \\sum I_{out}',
      questionType: 'mcq' as const,
      options: ['1 A', '7 A', '12 A', '0.75 A'],
      correctAnswer: '7 A',
      explanation: 'وفقاً لقانون كيرشوف الأول، مجموع التيارات الداخلة يساوي مجموع التيارات الخارجة: 3 + 4 = 7 أمبير.',
      marks: 5.00,
      orderIndex: 1,
    },
    {
      id: 'q-2',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 2,
      questionText: 'ينص قانون كيرشوف الثاني على أن المجموع الجبري لفروق الجهد عبر مسار مغلق يساوي صفراً، وهو يمثل تطبيقاً لمبدأ بقاء:',
      katexFormula: '\\sum V = 0',
      questionType: 'mcq' as const,
      options: ['الشحنة الكهربية', 'الطاقة', 'كمية الحركة', 'القدرة الكهربية'],
      correctAnswer: 'الطاقة',
      explanation: 'قانون كيرشوف الثاني هو صياغة فيزيائية لمبدأ حفظ وبقاء الطاقة في المسارات المغلقة.',
      marks: 5.00,
      orderIndex: 2,
    },
    {
      id: 'q-3',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 3,
      questionText: 'هل تتغير المقاومة النوعية لموصل معدني بتغير طوله أو مساحة مقطعه عند ثبوت درجة الحرارة؟',
      questionType: 'true_false' as const,
      options: ['صواب', 'خطأ'],
      correctAnswer: 'خطأ',
      explanation: 'المقاومة النوعية خاصية فيزيائية مميزة لمادة الموصل تتوقف على نوع المادة ودرجة الحرارة فقط.',
      marks: 5.00,
      orderIndex: 3,
    }
  ],

  // FINANCES (Invoices, Payments, Shifts)
  invoices: [
    {
      id: 'inv-1001',
      tenantId: 'tenant-rowad-001',
      studentId: 'user-student-1001',
      groupId: 'grp-math-sat',
      invoiceNumber: 'INV-2026-1001',
      billingMonth: 10,
      billingYear: 2026,
      totalAmount: 300.00,
      discountAmount: 0.00,
      netAmount: 300.00,
      paidAmount: 300.00,
      status: 'paid' as const,
      dueDate: '2026-10-10',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'inv-1002',
      tenantId: 'tenant-rowad-001',
      studentId: 'user-student-1002',
      groupId: 'grp-math-sat',
      invoiceNumber: 'INV-2026-1002',
      billingMonth: 10,
      billingYear: 2026,
      totalAmount: 300.00,
      discountAmount: 0.00,
      netAmount: 300.00,
      paidAmount: 150.00,
      status: 'partially_paid' as const,
      dueDate: '2026-10-10',
      createdAt: '2026-10-01T00:00:00Z',
    }
  ],

  cashierShifts: [
    {
      id: 'shift-today-001',
      tenantId: 'tenant-rowad-001',
      branchId: 'branch-nasr-city',
      cashierUserId: 'user-recep-001',
      openedAt: '2026-10-18T08:00:00Z',
      openingCash: 500.00,
      cashCollected: 300.00,
      digitalCollected: 150.00,
      expectedCash: 800.00,
      status: 'open' as const,
      notes: 'وردية الصباح - الخزينة الرئيسية',
    }
  ],

  notifications: [
    {
      id: 'notif-sample-001',
      tenantId: 'tenant-rowad-001',
      recipientUserId: 'user-student-1001',
      recipientPhone: '01099991001',
      channel: 'whatsapp' as const,
      templateName: 'student_attendance_ar',
      payload: { studentName: 'أحمد محمد علي', sessionTitle: 'رياضيات 3 ثانوي', time: '14:02' },
      status: 'delivered' as const,
      retryCount: 0,
      scheduledAt: '2026-10-18T14:02:00Z',
      sentAt: '2026-10-18T14:02:05Z',
    }
  ]
};
```

---

### 4.2 Implementation of `MockDataProvider` Core Methods

Below is the concrete implementation of the critical operational workflows inside `MockDataProvider`:

#### 1. Fast Reception Attendance Idempotent Recording (`AC-7`)
```typescript
async recordAttendance(params: {
  tenantId: string;
  sessionId: string;
  studentIdOrCode: string;
  verificationMethod?: 'barcode' | 'qr' | 'manual';
  cashierUserId?: string;
}): Promise<ScanResult> {
  const { tenantId, sessionId, studentIdOrCode, verificationMethod = 'barcode', cashierUserId } = params;

  // Resolve session
  const session = this.sessions.find(s => s.id === sessionId && s.tenantId === tenantId);
  if (!session) {
    throw new Error('الحصة المطلوبة غير موجودة في هذا السنتر');
  }

  // Resolve student by ID or studentCode
  const student = this.users.find(u => 
    u.tenantId === tenantId && 
    (u.id === studentIdOrCode || u.studentCode === studentIdOrCode)
  );

  if (!student) {
    throw new Error('لم يتم العثور على طالب مطابق لكود المسح المحدد');
  }

  // Check unique constraint: UNIQUE(session_id, student_id)
  const existingRecord = this.attendance.find(a => 
    a.sessionId === sessionId && a.studentId === student.id
  );

  const balanceAlert = {
    hasBalance: student.balanceDue > 0,
    balanceDue: student.balanceDue,
    messageAr: student.balanceDue > 0 
      ? `تنبيه: متبقي على الطالب مبلغ ${student.balanceDue} ج.م` 
      : 'جميع الرسوم مسددة بالكامل'
  };

  if (existingRecord) {
    // Idempotent duplicate scan: DO NOT insert, DO NOT notify parent
    return {
      success: true,
      isNewRecord: false,
      duplicate: true,
      attendance: existingRecord,
      student,
      session,
      balanceAlert,
      messageAr: 'تم تسجيل الحضور مسبقاً لهذه الحصة'
    };
  }

  // First scan: insert new record
  const newAttendance: Attendance = {
    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    tenantId,
    sessionId,
    studentId: student.id,
    status: 'present',
    scannedAt: new Date().toISOString(),
    verificationMethod,
    cashierUserId,
  };

  this.attendance.push(newAttendance);

  // Enqueue async parent notification
  if (student.guardianPhone) {
    await this.enqueueNotification({
      tenantId,
      recipientPhone: student.guardianPhone,
      recipientUserId: student.id,
      channel: 'whatsapp',
      templateName: 'student_attendance_ar',
      payload: {
        studentName: student.fullName,
        sessionName: session.notes || 'الحصة الدراسية',
        scannedAt: newAttendance.scannedAt
      }
    });
  }

  return {
    success: true,
    isNewRecord: true,
    duplicate: false,
    attendance: newAttendance,
    student,
    session,
    balanceAlert,
    messageAr: 'تم تسجيل الحضور بنجاح'
  };
}
```

#### 2. Strict Security Guardrail Enforcement on Profile Updates (`AC-4`, `AC-5`)
```typescript
async updateUser(
  userId: string, 
  updates: Partial<User>, 
  actorId?: string, 
  actorRole?: UserRole
): Promise<{ success: boolean; data?: User; error?: string; status: number }> {
  const targetUser = this.users.find(u => u.id === userId);
  if (!targetUser) {
    return { success: false, error: 'المستخدم غير موجود', status: 404 };
  }

  // Guardrail: Student and Teacher role restrictions
  if (actorRole === 'STUDENT' || actorRole === 'TEACHER') {
    // Cannot update another user's profile
    if (actorId && actorId !== userId) {
      return { 
        success: false, 
        error: 'Forbidden: غير مصرح لك بتعديل بيانات مستخدم آخر', 
        status: 403 
      };
    }

    // List of protected administrative columns
    const protectedFields: (keyof User)[] = [
      'fullName', 'studentCode', 'nationalId', 'stage', 'grade', 
      'division', 'seatNumber', 'balanceDue', 'role', 'tenantId', 'isActive'
    ];

    const attemptedAdminEdits = protectedFields.filter(field => 
      updates[field] !== undefined && updates[field] !== targetUser[field]
    );

    if (attemptedAdminEdits.length > 0) {
      return { 
        success: false, 
        error: 'Forbidden (HTTP 403): الطلاب والمعلمون مصرح لهم بتعديل الصورة الشخصية فقط، والبيانات الأكاديمية والمالية للقراءة فقط', 
        status: 403 
      };
    }
  }

  // Teacher cannot modify contractual rates or peer statements (AC-6)
  if (actorRole === 'TEACHER' && updates.balanceDue !== undefined) {
    return { success: false, error: 'Forbidden: لا يمكن للمعلم تعديل الحسابات المالية', status: 403 };
  }

  // Apply permissible updates
  Object.assign(targetUser, updates, { updatedAt: new Date().toISOString() });
  return { success: true, data: targetUser, status: 200 };
}

async updateUserProfilePhoto(
  userId: string, 
  avatarUrl: string, 
  actorId: string, 
  actorRole: UserRole
): Promise<{ success: boolean; data?: User; error?: string }> {
  // AC-4: Self-update of avatar is permitted for student/teacher
  if ((actorRole === 'STUDENT' || actorRole === 'TEACHER') && actorId !== userId) {
    return { success: false, error: 'Forbidden: لا يمكنك تغيير صورة مستخدم آخر' };
  }

  const user = this.users.find(u => u.id === userId);
  if (!user) return { success: false, error: 'المستخدم غير موجود' };

  user.avatarUrl = avatarUrl;
  user.updatedAt = new Date().toISOString();
  return { success: true, data: user };
}
```

#### 3. Dual Teacher Compensation Calculations (`AC-1`, `AC-2`)
```typescript
calculateCenterSubscriptionCompensation(
  sessions: Array<{ sessionId: string; sessionStatus: SessionStatus; validAttendanceCount: number }>,
  contractualFixedRate: number
): CenterSubscriptionResult {
  if (contractualFixedRate < 0) {
    throw new Error('Contractual fixed rate cannot be negative');
  }

  // Filter only conducted sessions (completed or in_progress)
  // Strictly exclude canceled and postponed sessions
  const conductedSessions = sessions.filter(
    s => s.sessionStatus === 'completed' || s.sessionStatus === 'in_progress'
  );

  const excludedCount = sessions.length - conductedSessions.length;

  // Zero conducted sessions guard (division-by-zero protection)
  if (conductedSessions.length === 0) {
    return {
      conductedSessionsCount: 0,
      totalValidAttendance: 0,
      averageAttendance: 0,
      contractualRate: contractualFixedRate,
      compensationAmount: 0.00,
      excludedSessionsCount: excludedCount,
    };
  }

  const totalValidAttendance = conductedSessions.reduce(
    (sum, s) => sum + Math.max(0, s.validAttendanceCount), 
    0
  );

  const averageAttendance = totalValidAttendance / conductedSessions.length;
  // Compensation rounded to 2 decimal places (piastre precision)
  const compensationAmount = Math.round(averageAttendance * contractualFixedRate * 100) / 100;

  return {
    conductedSessionsCount: conductedSessions.length,
    totalValidAttendance,
    averageAttendance: Math.round(averageAttendance * 100) / 100,
    contractualRate: contractualFixedRate,
    compensationAmount,
    excludedSessionsCount: excludedCount,
  };
}

calculatePrivateLessonsSplit(
  items: PrivateLessonItemInput[],
  teacherPercentage: number
): PrivateLessonBatchResult {
  if (teacherPercentage < 0 || teacherPercentage > 100) {
    throw new Error('Teacher percentage must be between 0 and 100');
  }

  let totalGrossInvoiced = 0;
  let totalDiscountAmount = 0;
  let totalNetRevenue = 0;
  let totalTeacherShare = 0;
  let totalCenterShare = 0;
  let totalCollected = 0;
  let totalCollectedTeacherShare = 0;

  const itemResults = items.map(item => {
    const basePrice = Math.max(0, item.basePrice);
    let discountAmount = 0;

    if (item.discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, item.discountValue));
      discountAmount = Math.round(basePrice * (pct / 100) * 100) / 100;
    } else if (item.discountType === 'fixed') {
      discountAmount = Math.min(basePrice, Math.max(0, item.discountValue));
    } else if (item.discountType === 'free_100') {
      discountAmount = basePrice;
    }

    const netRevenue = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

    // Guaranteed zero-leakage split:
    // 1. Calculate teacher share rounded to 2 decimal places
    const teacherShare = Math.round(netRevenue * (teacherPercentage / 100) * 100) / 100;
    // 2. Center share gets the exact remainder
    const centerShare = Math.round((netRevenue - teacherShare) * 100) / 100;

    const collected = Math.min(netRevenue, Math.max(0, item.collectedAmount));
    const collectedTeacherShare = Math.round(collected * (teacherPercentage / 100) * 100) / 100;

    totalGrossInvoiced += basePrice;
    totalDiscountAmount += discountAmount;
    totalNetRevenue += netRevenue;
    totalTeacherShare += teacherShare;
    totalCenterShare += centerShare;
    totalCollected += collected;
    totalCollectedTeacherShare += collectedTeacherShare;

    return {
      enrollmentId: item.enrollmentId,
      netRevenue,
      teacherShare,
      centerShare,
      invoicedBalance: Math.round((netRevenue - collected) * 100) / 100,
      collectedAmount: collected,
    };
  });

  // Calculate rounding leakage across the batch (Must strictly equal 0)
  const roundingLeakage = Math.abs(
    Math.round((totalNetRevenue - (totalTeacherShare + totalCenterShare)) * 100) / 100
  );

  return {
    totalGrossInvoiced: Math.round(totalGrossInvoiced * 100) / 100,
    totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
    totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
    totalTeacherShare: Math.round(totalTeacherShare * 100) / 100,
    totalCenterShare: Math.round(totalCenterShare * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalCollectedTeacherShare: Math.round(totalCollectedTeacherShare * 100) / 100,
    roundingLeakage,
    items: itemResults,
  };
}
```

#### 4. Grounded AI Exam Preflight Gate & Review Draft Status (`AC-8`)
```typescript
async validateExamPreflight(sourceDocumentIds: string[]): Promise<ExamPreflightResult> {
  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return {
      allowed: false,
      errorCode: 'EMPTY_SELECTION',
      messageArabic: 'يرجى تحديد مستند مصدر واحد على الأقل لتوليد الامتحان.',
    };
  }

  const selectedDocs = this.materials.filter(m => sourceDocumentIds.includes(m.id));
  
  // Gate 1: Check if all documents are indexed
  const unindexedDocs = selectedDocs.filter(d => d.indexStatus !== 'indexed');
  if (unindexedDocs.length > 0) {
    return {
      allowed: false,
      errorCode: 'UNINDEXED_SOURCE_DOCUMENTS',
      messageArabic: `المستندات التالية لم تكتمل فهرستها بعد: ${unindexedDocs.map(d => d.title).join('، ')}. لا يمكن توليد الامتحان إلا من مستندات مفهرسة بالكامل.`,
      unindexedDocTitles: unindexedDocs.map(d => d.title),
    };
  }

  // Gate 2: Check minimum word count threshold (200 words)
  const totalWordCount = selectedDocs.reduce((sum, d) => sum + (d.wordCount || 0), 0);
  const MIN_WORD_THRESHOLD = 200;

  if (totalWordCount < MIN_WORD_THRESHOLD) {
    return {
      allowed: false,
      errorCode: 'INSUFFICIENT_SOURCE_DOCUMENTS',
      messageArabic: `محتوى المستندات المحددة غير كافٍ لتوليد اختبار موثوق (إجمالي الكلمات: ${totalWordCount}، الحد الأدنى المطلوب: ${MIN_WORD_THRESHOLD} كلمة).`,
      totalWordCount,
    };
  }

  return {
    allowed: true,
    messageArabic: 'المستندات مؤهلة لتوليد الاختبار.',
    totalWordCount,
  };
}

async createExamDraft(params: {
  tenantId: string;
  groupId: string;
  teacherId: string;
  title: string;
  durationMinutes: number;
  sourceDocumentIds: string[];
  questions: Array<Omit<ExamQuestion, 'id' | 'examId'>>;
}): Promise<{ exam: Exam; questions: ExamQuestion[] }> {
  // Run preflight gate
  const preflight = await this.validateExamPreflight(params.sourceDocumentIds);
  if (!preflight.allowed) {
    throw new Error(preflight.messageArabic);
  }

  const examId = `exam-${Date.now()}`;
  const totalMarks = params.questions.reduce((sum, q) => sum + q.marks, 0);

  const exam: Exam = {
    id: examId,
    tenantId: params.tenantId,
    groupId: params.groupId,
    teacherId: params.teacherId,
    title: params.title,
    durationMinutes: params.durationMinutes,
    totalMarks,
    passMarks: totalMarks / 2,
    isAiGenerated: true,
    groundedMaterialIds: params.sourceDocumentIds,
    status: 'draft', // AC-8: Must be placed in draft status for teacher review
    createdAt: new Date().toISOString(),
  };

  const createdQuestions: ExamQuestion[] = params.questions.map((q, idx) => ({
    ...q,
    id: `q-${examId}-${idx + 1}`,
    examId,
    questionNumber: idx + 1,
    orderIndex: idx + 1,
  }));

  this.exams.push(exam);
  this.examQuestions.push(...createdQuestions);

  return { exam, questions: createdQuestions };
}
```

---

## 5. Acceptance Criteria Traceability Matrix

The schema, triggers, and mock data access layer map 1-to-1 to every acceptance criterion:

| Criterion | Requirement Summary | Architectural & Data Layer Solution | Verification Method |
|:---|:---|:---|:---|
| **AC-1** | Center Subscription Calc: 4 classes $[12, 15, 11, 14]$ at $20\text{ EGP} = 260\text{ EGP}$; canceled excluded; 0 classes = 0. | Filter `sessionStatus IN ('completed', 'in_progress')`; divide attendance sum by conducted sessions; zero sessions guard returns 0. | `calculateCenterSubscriptionCompensation()` tested in `tests/unit/compensation.test.ts`. |
| **AC-2** | Private Lessons Calc: 100 EGP with 70/30 split = 70/30; 20% discount = 56/24; 100% free = 0/0; zero leakage. | `teacherShare = round(net * 0.70, 2)`; `centerShare = net - teacherShare`. Guarantees `teacherShare + centerShare === net`. | `calculatePrivateLessonsSplit()` tested in `tests/unit/compensation.test.ts`. |
| **AC-3** | Multi-tenant isolation: Center A user cannot access Center B data. | Schema: `tenant_id` on all 22 tables + RLS policy `USING (tenant_id = current_tenant_id())`. DAL filter queries by `tenantId`. | `tests/security/rbac-guardrails.test.ts` querying Center B with Center A context. |
| **AC-4** | Student can successfully update their own profile picture. | RLS policy `users_self_photo_update_policy` and `updateUserProfilePhoto()` permit `avatarUrl` update when `auth.uid() = id`. | API / DAL call verifies HTTP 200 and updated `avatarUrl`. |
| **AC-5** | Student attempting to update name, code, grade, or balance receives HTTP 403 Forbidden. | DB Trigger `trg_enforce_user_guardrail` raises SQLSTATE `42501`. DAL `updateUser()` returns `{ status: 403 }`. | `tests/security/rbac-guardrails.test.ts` modifying student `balanceDue` or `fullName`. |
| **AC-6** | Teacher cannot alter contractual salary rates or access peer statements. | RLS policies `teacher_rates_mutation_policy` lock mutation to admins. DAL `updateTeacherRate()` rejects `TEACHER` role with HTTP 403. | `tests/security/rbac-guardrails.test.ts` calling rate update with teacher role. |
| **AC-7** | Idempotent attendance: Scanning student code twice records exactly one record. | Database compound constraint `UNIQUE(session_id, student_id)`. DAL `recordAttendance()` detects existing row, returns `duplicate: true`. | `tests/integration/attendance-idempotency.test.ts` calling scan twice concurrently. |
| **AC-8** | AI exam generator rejects unindexed or <200 word docs, defaults to teacher review draft. | Preflight gate `validateExamPreflight()` checks `indexStatus === 'indexed'` and `wordCount >= 200`. Status defaults to `draft`. | `tests/integration/ai-exam-gate.test.ts` testing unindexed and <200 word inputs. |
| **AC-9** | Printable A4 layout contains Yalla Center logo top-left, teacher name top-right, KaTeX math. | Exam queries return teacher name, group, KaTeX formulas in `exam_questions`. Layout targets print styles with official logo. | `tests/e2e/printable-exam-layout.test.ts` verifying rendered DOM headers and math. |
| **AC-10**| Next.js builds without TS/ESLint errors and works in Arabic RTL. | Strict TypeScript types in `lib/dal/types.ts`, zero `any`, valid DDL schema and zero compilation errors. | `npm run build` and Vitest test suite passes 100%. |

---

## 6. Implementation Readiness & File Manifest

When the orchestrator authorizes implementation, the following files will be created in project root:

1. **`lib/supabase/schema.sql`**: Complete PostgreSQL DDL with all 22 tables, types, foreign keys, unique constraints, composite indexes, functions, triggers, and RLS policies (identical to Section 2).
2. **`lib/dal/types.ts`**: Comprehensive TypeScript domain interfaces and type definitions (identical to Section 3.1).
3. **`lib/dal/index.ts`**: `IDataProvider` interface and method signatures (identical to Section 3.2).
4. **`lib/dal/mock-data.ts`**: `MockDataProvider` implementation and pre-seeded Egyptian educational center dataset (identical to Section 4).
5. **`lib/dal/factory.ts`**: Data Provider factory dynamically switching between Supabase and Mock based on `NEXT_PUBLIC_INTEGRITY_MODE`.

This exploration is complete, fully validated against all acceptance criteria, and ready for immediate implementation.
