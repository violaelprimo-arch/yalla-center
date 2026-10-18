-- ============================================================================
-- YALLA CENTER — PRODUCTION POSTGRESQL SCHEMA (3NF)
-- Normalized Multi-Tenant SaaS Database Schema (22 Tables, RLS, Triggers)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

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

-- ============================================================================
-- 1. TENANTS (Educational Centers)
-- ============================================================================
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

-- ============================================================================
-- 2. BRANCHES (Center Physical Branches)
-- ============================================================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. CLASSROOMS (Physical Rooms per Branch)
-- ============================================================================
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  capacity INT NOT NULL DEFAULT 30,
  equipment JSONB NOT NULL DEFAULT '{"projector": true, "air_conditioning": true, "smart_board": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. USERS (Profiles for Auth Users across all 8 Roles)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ============================================================================
-- 5. SUBJECTS (Educational Courses)
-- ============================================================================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_ar VARCHAR(128) NOT NULL,
  code VARCHAR(32),
  stage VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. GROUPS (Classes / Study Groups)
-- ============================================================================
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

-- ============================================================================
-- 7. SESSIONS (Conducted & Scheduled Class Sessions)
-- ============================================================================
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

-- ============================================================================
-- 8. ENROLLMENTS (Student Subscriptions to Groups)
-- ============================================================================
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

-- ============================================================================
-- 9. ATTENDANCE (Fast Reception Idempotent Scans)
-- ============================================================================
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

-- ============================================================================
-- 10. INVOICES (Student Invoicing & Receivables)
-- ============================================================================
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

-- ============================================================================
-- 11. CASHIER SHIFTS (Front-Desk Shift Control & Reconciliation)
-- ============================================================================
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
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  notes TEXT
);

-- ============================================================================
-- 12. PAYMENTS (Receipts & Partial Payments)
-- ============================================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
  receipt_number VARCHAR(64) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  received_by_user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_receipt_number_per_tenant UNIQUE (tenant_id, receipt_number)
);

-- ============================================================================
-- 13. TEACHER RATES (Contractual Agreements)
-- ============================================================================
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

-- ============================================================================
-- 14. TEACHER PAYROLL (Monthly Compensation Records)
-- ============================================================================
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

-- ============================================================================
-- 15. MATERIALS (6-Tier Hierarchical Repository & Grounding Index)
-- ============================================================================
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

-- ============================================================================
-- 16. EXAMS (Exam Metadata & Grounded Specifications)
-- ============================================================================
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

-- ============================================================================
-- 17. EXAM QUESTIONS (Individual Question Items with KaTeX)
-- ============================================================================
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

-- ============================================================================
-- 18. EXAM SUBMISSIONS (Student Exam Attempts & Auto-Grading)
-- ============================================================================
CREATE TABLE exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  auto_graded_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  manual_graded_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  total_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  CONSTRAINT unique_student_exam_attempt UNIQUE (exam_id, student_id)
);

-- ============================================================================
-- 19. EXAM ANSWERS (Itemized Answers per Submission)
-- ============================================================================
CREATE TABLE exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  marks_awarded NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  teacher_feedback TEXT
);

-- ============================================================================
-- 20. NOTIFICATIONS (Asynchronous WhatsApp Cloud API & Web Push Queue)
-- ============================================================================
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


-- ============================================================================
-- 21. EXPENSES (Center Operating Expenditures)
-- ============================================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  receipt_url TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 22. BOOKS INVENTORY (Study Handouts & Physical Book Sales)
-- ============================================================================
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

-- ============================================================================
-- COMPOSITE INDEXES
-- ============================================================================
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

-- ============================================================================
-- TRIGGERS & GUARDRAIL PROCEDURES
-- ============================================================================

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

-- Strict Security Guardrail Trigger (AC-4, AC-5):
-- Students and Teachers are strictly prohibited from altering administrative/academic fields
CREATE OR REPLACE FUNCTION enforce_self_profile_update_guardrail()
RETURNS TRIGGER AS $$
BEGIN
  -- If actor role is STUDENT or TEACHER
  IF (OLD.role IN ('STUDENT', 'TEACHER')) THEN
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
      NEW.is_active IS DISTINCT FROM OLD.is_active OR
      NEW.phone IS DISTINCT FROM OLD.phone OR
      NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone OR
      NEW.guardian_name IS DISTINCT FROM OLD.guardian_name OR
      NEW.email IS DISTINCT FROM OLD.email OR
      NEW.national_id IS DISTINCT FROM OLD.national_id
    ) THEN
      RAISE EXCEPTION 'Security Violation: Students and Teachers are strictly permitted to update ONLY their profile photo (avatar_url).'
        USING ERRCODE = '42501'; -- HTTP 403 Forbidden equivalent in SQLSTATE
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_user_guardrail
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_self_profile_update_guardrail();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

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

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$ LANGUAGE sql STABLE;

-- Multi-Tenant Isolation Policies (AC-3)
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

-- Users Policies (AC-4, AC-5)
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

CREATE POLICY users_self_profile_update_policy ON users
  FOR UPDATE
  USING (
    id = auth.uid()
    AND current_user_role() IN ('STUDENT', 'TEACHER')
  );

-- Teacher Rates & Payroll Policies (AC-6)
CREATE POLICY teacher_rates_select_policy ON teacher_rates
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
    OR (tenant_id = current_tenant_id() AND teacher_id = auth.uid())
  );

CREATE POLICY teacher_rates_mutation_policy ON teacher_rates
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
  );

CREATE POLICY teacher_payroll_select_policy ON teacher_payroll
  FOR SELECT
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'ACCOUNTANT'))
    OR (tenant_id = current_tenant_id() AND teacher_id = auth.uid())
  );

-- Attendance Policies (AC-7)
CREATE POLICY attendance_tenant_admin_policy ON attendance
  FOR ALL
  USING (
    current_user_role() = 'PLATFORM_OWNER'
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'))
  );
