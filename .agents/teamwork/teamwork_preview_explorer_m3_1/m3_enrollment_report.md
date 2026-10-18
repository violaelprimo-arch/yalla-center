# Milestone 3 Architecture & Design Report: Student Enrollment & Profile Engine (FEAT-15 & FEAT-16)

**Target Component**: Student Registration, Profile Directory, Group Enrollment & Timetable Conflict Preflight  
**Author**: Explorer M3-1 (`teamwork_preview_explorer_m3_1`)  
**Project**: Yalla Center (Tenant Workspace: `/center/[centerSlug]/students`)  
**Date**: 2026-10-18  
**Status**: COMPLETE ARCHITECTURAL SPECIFICATION FOR WORKER M3  

---

## 1. Executive Summary & Problem Scope

In accordance with the authoritative project specification (`PROJECT.md`), the user requirements (`ORIGINAL_REQUEST.md`), and the test harness (`TEST_READY.md`), Milestone 3 introduces the **Student Enrollment & Dual Teacher Compensation Engine**.

This exploration report provides the foundational architecture for the Student subsystem:
1. **FEAT-15: Student Registration & Profile Management**:
   - Complete tenant-isolated student directory under `/center/[centerSlug]/students`.
   - Multi-dimensional search and filtering (Full name, student code/barcode, Egyptian stage, grade, division, and financial payment status).
   - High-throughput student registration intake modal capturing student identity, guardian contact info, educational tier, and default discount configuration.
   - 360-degree Student Detail Drawer featuring 3 interconnected tabs: Enrolled Study Groups, Chronological Attendance History, and Financial Balance/Invoices Ledger.
   - Official Branded Student ID Card preview with printable SVG Code 128 barcode and QR verification.
2. **FEAT-16: Group Enrollment Modal & Conflict Preflight Radar**:
   - Modal interface allowing students to be enrolled into one or multiple study groups.
   - Dual Pricing Model support at enrollment level: Center Subscription (`center`) vs. Private Lessons (`private`).
   - 4-Tier Discount configuration: None (`none`), Percentage (`percentage`), Fixed Amount (`fixed`), and 100% Full Scholarship (`free_100`).
   - **Automated Timetable Preflight Conflict Radar**: Real-time interval collision detection ($(s_1 < e_2) \land (s_2 < e_1)$) powered by `lib/timetable/conflict-detector.ts`, preventing overlapping group enrollments on the same weekday, alongside group capacity overflow protection.

---

## 2. Current Codebase State & Gap Analysis

### 2.1 Database Schema (`lib/supabase/schema.sql`)
The normalized 3NF database schema already defines the requisite tables:
- `users`: Contains columns `role` (`'STUDENT'`), `student_code`, `stage`, `grade`, `division`, `seat_number`, `guardian_name`, `guardian_phone`, `balance_due`, `is_active`, `avatar_url`. Unique constraint: `UNIQUE (tenant_id, student_code)`.
- `groups`: Contains `branch_id`, `classroom_id`, `subject_id`, `teacher_id`, `name_ar`, `schedule_day` (0-6), `start_time`, `end_time`, `pricing_model`, `monthly_fee`, `session_fee`, `max_students`, `is_active`.
- `enrollments`: Contains `student_id`, `group_id`, `pricing_model`, `discount_type`, `discount_value`, `is_active`, `enrolled_at`. Unique constraint: `UNIQUE (student_id, group_id)`.
- `attendance`: Compound unique constraint: `UNIQUE (session_id, student_id)`.
- `invoices` & `payments`: Track financial receivables, discounts, and payments per student.

### 2.2 Data Access Layer (`lib/dal/index.ts` & `lib/dal/mock-data.ts`)
- **Existing**: `getUsers(tenantId, filter)`, `getUserById`, `getUserByStudentCode`, `updateUser`, `getGroups`, `getGroupById`, `getEnrollments`, `getInvoices`, `recordPayment`.
- **Gaps to be filled for M3 Worker**:
  1. `createStudent`: Method to register a new student, generate sequential student code (e.g. `STD-1004`), and initialize balance.
  2. `enrollStudentInGroup`: Method to create enrollment record, validate capacity, enforce timetable non-collision, and optionally issue tuition invoice.
  3. `unenrollStudent`: Method to deactivate/remove enrollment.
  4. `getStudentEnrollmentDetails`: Helper query joining enrollment with group, teacher, classroom, and branch.
  5. `getStudentAttendanceHistory`: Helper query joining student attendance with conducted session metadata.
  6. `getPayments`: Query to retrieve payment receipt records for a student.

### 2.3 Timetable Conflict Detection Engine (`lib/timetable/conflict-detector.ts`)
- **Existing**:
  - `isTimeOverlapping(slotA, slotB)`: Math invariant $(s_1 < e_2) \land (s_2 < e_1)$, supports back-to-back classes with zero gap ($s_2 = e_1$).
  - `checkGroupScheduleConflicts`: Detects classroom and teacher double-booking.
  - `checkSessionScheduleConflicts`: Detects calendar session collisions.
- **Gap to be added for M3 Worker**:
  - `checkStudentEnrollmentConflict`: Pure function that validates candidate group against student's existing active groups and target group capacity.

### 2.4 Existing Students Page (`app/center/[centerSlug]/students/page.tsx`)
Currently a simple Milestone 2 placeholder card. It requires full implementation matching the high design standards seen in `branches/page.tsx`.

---

## 3. Educational Taxonomy & Egyptian System Mapping

The Egyptian school system follows a strict 3-tier hierarchy that must be reflected in dropdowns and filters:

```typescript
export interface EducationalStageOption {
  id: 'primary' | 'preparatory' | 'secondary';
  nameAr: string;
  grades: Array<{
    id: string;
    nameAr: string;
    hasDivisions?: boolean;
    divisions?: Array<{ id: string; nameAr: string }>;
  }>;
}

export const EGYPTIAN_STAGES: EducationalStageOption[] = [
  {
    id: 'primary',
    nameAr: 'المرحلة الابتدائية',
    grades: [
      { id: '1_prim', nameAr: 'الصف الأول الابتدائي' },
      { id: '2_prim', nameAr: 'الصف الثاني الابتدائي' },
      { id: '3_prim', nameAr: 'الصف الثالث الابتدائي' },
      { id: '4_prim', nameAr: 'الصف الرابع الابتدائي' },
      { id: '5_prim', nameAr: 'الصف الخامس الابتدائي' },
      { id: '6_prim', nameAr: 'الصف السادس الابتدائي' },
    ],
  },
  {
    id: 'preparatory',
    nameAr: 'المرحلة الإعدادية',
    grades: [
      { id: '1_prep', nameAr: 'الصف الأول الإعدادي' },
      { id: '2_prep', nameAr: 'الصف الثاني الإعدادي' },
      { id: '3_prep', nameAr: 'الصف الثالث الإعدادي (الشهادة الإعدادية)' },
    ],
  },
  {
    id: 'secondary',
    nameAr: 'المرحلة الثانوية',
    grades: [
      { id: '1_sec', nameAr: 'الصف الأول الثانوي (عام)' },
      {
        id: '2_sec',
        nameAr: 'الصف الثاني الثانوي',
        hasDivisions: true,
        divisions: [
          { id: 'scientific', nameAr: 'علمي' },
          { id: 'literary', nameAr: 'أدبي' },
        ],
      },
      {
        id: '3_sec',
        nameAr: 'الصف الثالث الثانوي (الثانوية العامة)',
        hasDivisions: true,
        divisions: [
          { id: 'scientific_math', nameAr: 'علمي رياضة' },
          { id: 'scientific_science', nameAr: 'علمي علوم' },
          { id: 'literary', nameAr: 'أدبي' },
        ],
      },
    ],
  },
];
```

---

## 4. Timetable Conflict Preflight Engine Design (`FEAT-16`)

### 4.1 Collision Algorithmic Invariants
For student enrollment, two study groups $G_A$ and $G_B$ conflict if and only if:
1. They meet on the same day of the week: $G_A.\text{scheduleDay} = G_B.\text{scheduleDay}$.
2. Their time intervals overlap:
   $$\text{overlap}(G_A, G_B) \iff (G_A.\text{startTime} < G_B.\text{endTime}) \land (G_B.\text{startTime} < G_A.\text{endTime})$$
3. Back-to-back classes are permitted: If $G_A.\text{endTime} = G_B.\text{startTime}$, $\text{overlap}$ evaluates to `false`.

### 4.2 Preflight Function Specification
To be added to `lib/timetable/conflict-detector.ts`:

```typescript
export type StudentConflictCode =
  | 'STUDENT_SCHEDULE_COLLISION'
  | 'DUPLICATE_ENROLLMENT'
  | 'CAPACITY_OVERFLOW'
  | 'CROSS_BRANCH_TRANSIT_TIGHT'
  | 'INVALID_TIME_RANGE';

export interface StudentScheduleConflict {
  code: StudentConflictCode;
  severity: ConflictSeverity; // 'error' | 'warning'
  conflictingGroupId?: string;
  conflictingGroupName?: string;
  timeSlot?: TimeSlot;
  dayNameAr?: string;
  messageAr: string;
}

export interface StudentEnrollmentConflictCheckResult {
  hasConflict: boolean; // True if any 'error' exists
  canEnroll: boolean;   // True if no 'error' exists
  errors: StudentScheduleConflict[];
  warnings: StudentScheduleConflict[];
  capacityInfo: {
    currentEnrolled: number;
    maxStudents: number;
    isFull: boolean;
    availableSeats: number;
  };
}

export function checkStudentEnrollmentConflict(
  candidateGroup: {
    id: string;
    tenantId: string;
    nameAr: string;
    branchId: string;
    scheduleDay: number;
    startTime: string;
    endTime: string;
    maxStudents: number;
  },
  studentActiveGroups: Array<{
    id: string;
    tenantId: string;
    nameAr: string;
    branchId: string;
    scheduleDay: number;
    startTime: string;
    endTime: string;
  }>,
  currentEnrolledCount: number,
  dayNameAr?: string
): StudentEnrollmentConflictCheckResult {
  const errors: StudentScheduleConflict[] = [];
  const warnings: StudentScheduleConflict[] = [];

  const candStart = timeToMinutes(candidateGroup.startTime);
  const candEnd = timeToMinutes(candidateGroup.endTime);

  // 1. Time range validity check
  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'خطأ في التوقيت: وقت نهاية الحصة يجب أن يكون بعد وقت البداية.',
    });
    return {
      hasConflict: true,
      canEnroll: false,
      errors,
      warnings,
      capacityInfo: {
        currentEnrolled: currentEnrolledCount,
        maxStudents: candidateGroup.maxStudents,
        isFull: currentEnrolledCount >= candidateGroup.maxStudents,
        availableSeats: Math.max(0, candidateGroup.maxStudents - currentEnrolledCount),
      },
    };
  }

  // 2. Duplicate Enrollment check
  const isAlreadyEnrolled = studentActiveGroups.some((g) => g.id === candidateGroup.id);
  if (isAlreadyEnrolled) {
    errors.push({
      code: 'DUPLICATE_ENROLLMENT',
      severity: 'error',
      conflictingGroupId: candidateGroup.id,
      conflictingGroupName: candidateGroup.nameAr,
      messageAr: `الطالب مسجل بالفعل في هذه المجموعة (${candidateGroup.nameAr}).`,
    });
  }

  // 3. Capacity Check
  const isFull = currentEnrolledCount >= candidateGroup.maxStudents;
  const availableSeats = Math.max(0, candidateGroup.maxStudents - currentEnrolledCount);

  if (isFull) {
    warnings.push({
      code: 'CAPACITY_OVERFLOW',
      severity: 'warning',
      messageAr: `تنبيه السعة: المجموعة مكتملة العدد (${currentEnrolledCount}/${candidateGroup.maxStudents} مقعد).`,
    });
  }

  // 4. Timetable Collision Check against student's existing groups
  const candSlot: TimeSlot = {
    startTime: candidateGroup.startTime,
    endTime: candidateGroup.endTime,
  };

  for (const existing of studentActiveGroups) {
    if (existing.id === candidateGroup.id) continue;
    if (existing.scheduleDay !== candidateGroup.scheduleDay) continue;

    const existingSlot: TimeSlot = {
      startTime: existing.startTime,
      endTime: existing.endTime,
    };

    if (isTimeOverlapping(candSlot, existingSlot)) {
      errors.push({
        code: 'STUDENT_SCHEDULE_COLLISION',
        severity: 'error',
        conflictingGroupId: existing.id,
        conflictingGroupName: existing.nameAr,
        timeSlot: existingSlot,
        dayNameAr,
        messageAr: `تعارض زمني في جدول الطالب: الطالب مسجل بالفعل في مجموعة "${existing.nameAr}" ${dayNameAr ? `يوم (${dayNameAr})` : ''} في نفس التوقيت (${existing.startTime} - ${existing.endTime}).`,
      });
    } else if (existing.branchId !== candidateGroup.branchId) {
      // Transit check: If different branches and less than 30 minutes between classes
      const diff1 = timeToMinutes(candidateGroup.startTime) - timeToMinutes(existing.endTime);
      const diff2 = timeToMinutes(existing.startTime) - timeToMinutes(candidateGroup.endTime);
      const gap = Math.min(Math.abs(diff1), Math.abs(diff2));
      if (gap < 30) {
        warnings.push({
          code: 'CROSS_BRANCH_TRANSIT_TIGHT',
          severity: 'warning',
          messageAr: `تنبيه انتقال: الفاصل الزمني (${gap} دقيقة) ضيق جداً للانتقال بين فرعين مختلفين.`,
        });
      }
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canEnroll: !hasConflict,
    errors,
    warnings,
    capacityInfo: {
      currentEnrolled: currentEnrolledCount,
      maxStudents: candidateGroup.maxStudents,
      isFull,
      availableSeats,
    },
  };
}
```

---

## 5. DAL Interface & MockDataProvider Enhancements

The following extensions must be added to `lib/dal/index.ts` and `lib/dal/mock-data.ts`:

### 5.1 Additions to `IDataProvider` in `lib/dal/index.ts`:

```typescript
export interface CreateStudentInput {
  fullName: string;
  studentCode?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  stage: string;
  grade: string;
  division?: string;
  seatNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  avatarUrl?: string;
}

export interface EnrollStudentInput {
  tenantId: string;
  studentId: string;
  groupId: string;
  pricingModel: PricingModel; // 'center' | 'private'
  discountType: DiscountType; // 'none' | 'percentage' | 'fixed' | 'free_100'
  discountValue: number;
}

export interface StudentEnrollmentDetail extends Enrollment {
  group: Group;
  subject?: Subject;
  teacher?: User;
  classroom?: Classroom;
  branch?: Branch;
}

export interface StudentAttendanceDetail extends Attendance {
  session: Session;
  group?: Group;
}

// In IDataProvider:
createStudent(tenantId: string, input: CreateStudentInput): Promise<User>;
enrollStudent(input: EnrollStudentInput): Promise<{ success: boolean; enrollment?: Enrollment; error?: string }>;
unenrollStudent(tenantId: string, enrollmentId: string): Promise<{ success: boolean; error?: string }>;
getStudentEnrollmentDetails(tenantId: string, studentId: string): Promise<StudentEnrollmentDetail[]>;
getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceDetail[]>;
getPayments(tenantId: string, filter?: { studentId?: string; invoiceId?: string }): Promise<Payment[]>;
```

### 5.2 Implementation in `MockDataProvider` (`lib/dal/mock-data.ts`):

```typescript
// Auto-generate sequential student codes: STD-1001, STD-1002, STD-1003, ...
async createStudent(tenantId: string, input: CreateStudentInput): Promise<User> {
  const existingStudents = this.users.filter((u) => u.tenantId === tenantId && u.role === 'STUDENT');
  const nextNum = 1000 + existingStudents.length + 1;
  const studentCode = input.studentCode?.trim() || `STD-${nextNum}`;

  // Verify unique student code per tenant
  const isDuplicate = existingStudents.some((u) => u.studentCode === studentCode);
  if (isDuplicate) {
    throw new Error(`كود الطالب (${studentCode}) مستخدم بالفعل في هذا السنتر`);
  }

  const newStudent: User = {
    id: `user-student-${nextNum}`,
    tenantId,
    role: 'STUDENT',
    fullName: input.fullName.trim(),
    studentCode,
    phone: input.phone?.trim(),
    email: input.email?.trim(),
    nationalId: input.nationalId?.trim(),
    stage: input.stage,
    grade: input.grade,
    division: input.division,
    seatNumber: input.seatNumber,
    guardianName: input.guardianName?.trim(),
    guardianPhone: input.guardianPhone?.trim(),
    avatarUrl: input.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    balanceDue: 0.0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  this.users.push(newStudent);
  return newStudent;
}

async enrollStudent(input: EnrollStudentInput): Promise<{ success: boolean; enrollment?: Enrollment; error?: string }> {
  const student = this.users.find((u) => u.id === input.studentId && u.tenantId === input.tenantId);
  if (!student) return { success: false, error: 'الطالب غير موجود' };

  const group = this.groups.find((g) => g.id === input.groupId && g.tenantId === input.tenantId);
  if (!group) return { success: false, error: 'المجموعة الدراسية غير موجودة' };

  // Check unique enrollment
  const existing = this.enrollments.find(
    (e) => e.tenantId === input.tenantId && e.studentId === input.studentId && e.groupId === input.groupId && e.isActive
  );
  if (existing) {
    return { success: false, error: 'الطالب مقيد بالفعل في هذه المجموعة' };
  }

  // Preflight conflict check
  const activeStudentEnrollments = this.enrollments.filter(
    (e) => e.tenantId === input.tenantId && e.studentId === input.studentId && e.isActive
  );
  const activeGroups = activeStudentEnrollments
    .map((e) => this.groups.find((g) => g.id === e.groupId))
    .filter((g): g is Group => Boolean(g));

  const currentEnrolledCount = this.enrollments.filter(
    (e) => e.groupId === input.groupId && e.isActive
  ).length;

  const preflight = checkStudentEnrollmentConflict(
    group,
    activeGroups,
    currentEnrolledCount
  );

  if (!preflight.canEnroll) {
    return { success: false, error: preflight.errors[0]?.messageAr || 'تعارض في موعد الحصة' };
  }

  const enrollment: Enrollment = {
    id: `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId: input.tenantId,
    studentId: input.studentId,
    groupId: input.groupId,
    pricingModel: input.pricingModel,
    discountType: input.discountType,
    discountValue: input.discountValue,
    isActive: true,
    enrolledAt: new Date().toISOString(),
  };

  this.enrollments.push(enrollment);

  // Automatically generate initial monthly tuition invoice if monthly fee > 0
  if (group.monthlyFee > 0) {
    let discountAmount = 0;
    if (input.discountType === 'free_100') {
      discountAmount = group.monthlyFee;
    } else if (input.discountType === 'percentage') {
      discountAmount = Math.round(group.monthlyFee * (input.discountValue / 100) * 100) / 100;
    } else if (input.discountType === 'fixed') {
      discountAmount = Math.min(group.monthlyFee, input.discountValue);
    }
    const netAmount = Math.max(0, Math.round((group.monthlyFee - discountAmount) * 100) / 100);

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      tenantId: input.tenantId,
      studentId: input.studentId,
      groupId: input.groupId,
      invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}`,
      billingMonth: new Date().getMonth() + 1,
      billingYear: 2026,
      totalAmount: group.monthlyFee,
      discountAmount,
      netAmount,
      paidAmount: 0.0,
      status: netAmount === 0 ? 'paid' : 'pending',
      dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    this.invoices.push(invoice);

    if (netAmount > 0) {
      student.balanceDue = Math.round((student.balanceDue + netAmount) * 100) / 100;
    }
  }

  return { success: true, enrollment };
}

async unenrollStudent(tenantId: string, enrollmentId: string): Promise<{ success: boolean; error?: string }> {
  const index = this.enrollments.findIndex((e) => e.id === enrollmentId && e.tenantId === tenantId);
  if (index === -1) return { success: false, error: 'الاشتراك غير موجود' };
  this.enrollments[index].isActive = false;
  return { success: true };
}

async getStudentEnrollmentDetails(tenantId: string, studentId: string): Promise<StudentEnrollmentDetail[]> {
  const userEnrollments = this.enrollments.filter((e) => e.tenantId === tenantId && e.studentId === studentId && e.isActive);
  return userEnrollments.map((e) => {
    const group = this.groups.find((g) => g.id === e.groupId)!;
    const subject = this.subjects.find((s) => s.id === group.subjectId);
    const teacher = this.users.find((u) => u.id === group.teacherId);
    const classroom = this.classrooms.find((c) => c.id === group.classroomId);
    const branch = this.branches.find((b) => b.id === group.branchId);
    return {
      ...e,
      group,
      subject,
      teacher,
      classroom,
      branch,
    };
  });
}

async getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceDetail[]> {
  const records = this.attendance.filter((a) => a.tenantId === tenantId && a.studentId === studentId);
  return records.map((a) => {
    const session = this.sessions.find((s) => s.id === a.sessionId)!;
    const group = session ? this.groups.find((g) => g.id === session.groupId) : undefined;
    return {
      ...a,
      session,
      group,
    };
  });
}

async getPayments(tenantId: string, filter?: { studentId?: string; invoiceId?: string }): Promise<Payment[]> {
  return this.payments.filter((p) => {
    if (p.tenantId !== tenantId) return false;
    if (filter?.studentId && p.studentId !== filter.studentId) return false;
    if (filter?.invoiceId && p.invoiceId !== filter.invoiceId) return false;
    return true;
  });
}
```

---

## 6. Complete UI/UX Specification for `/center/[centerSlug]/students`

### 6.1 Layout & Visual Design System
- **Direction**: Strict Arabic RTL (`dir="rtl"`), Cairo font typography.
- **Color Palette**: Deep Midnight Navy sidebar/cards (`#090D16`, `#0F172A`), Electric Cyan accents (`#06B6D4`, `#0891B2`), soft elevated borders (`border-border`).
- **Responsive Viewports**: Mobile (<640px), Tablet (640px-1024px), Desktop (>1024px) with card/table switching.

### 6.2 Component Hierarchy & Responsibilities

```
app/center/[centerSlug]/students/
├── page.tsx                           # Main Controller & State Coordinator
└── components/ (or components/students/)
    ├── student-kpis.tsx               # 4 Summary Metric Cards (Total, Dues, Scholarships, Groups)
    ├── student-filter-bar.tsx         # Search & 4 Tier Dropdowns (Stage, Grade, Division, Payment)
    ├── student-table.tsx              # Rich Data Table with Avatars, Badges, & Action Menu
    ├── student-registration-modal.tsx # New Student Form with Auto-Code & Initial Group
    ├── student-detail-drawer.tsx      # Slide-Over 3-Tab Drawer (Groups, Attendance, Finances)
    ├── group-enrollment-modal.tsx     # Enrollment with Preflight Radar HUD & Pricing Calculator
    └── student-id-card-modal.tsx      # Printable Official Student ID Card with SVG Barcode
```

### 6.3 Component Details

#### 1. Metric Summary Cards (`StudentKpis`)
- **Card 1: إجمالي الطلاب المقيدين (Total Students)**: Count of active students in center, with trend indicator.
- **Card 2: الاشتراكات النشطة بالمجموعات (Active Enrollments)**: Total active `(student, group)` bindings.
- **Card 3: طلاب لديهم مستحقات مالية (Students with Due Balance)**: Count of students where `balanceDue > 0`.
- **Card 4: إجمالي المستحقات المطلوبة (Total Receivables)**: Sum of all `balanceDue` in EGP formatted with Egyptian pound symbol (ج.م).

#### 2. Search & Filter Bar (`StudentFilterBar`)
- **Live Search**: Debounced input matching student name, student code (`STD-XXXX`), phone, or guardian phone.
- **Stage Dropdown**: الكل (All) / المرحلة الابتدائية / المرحلة الإعدادية / المرحلة الثانوية.
- **Grade Dropdown**: Dynamically populated based on stage (e.g. 1st sec, 2nd sec, 3rd sec).
- **Division Dropdown**: Dynamically displayed for 2nd and 3rd secondary (علمي رياضة / علمي علوم / أدبي / عام).
- **Payment Status Filter**:
  - الكل (All)
  - مستحق عليه مبالغ (Balance Due > 0)
  - مسدد بالكامل (Balance Due = 0)
  - منحة كاملة 100% (Has 100% scholarship)
- **Reset Filters Button**: Quickly restore default view.

#### 3. Students Data Table & Card Grid (`StudentTable`)
- Toggle switch between Table View and Grid View.
- Columns:
  1. **الطالب (Student)**: Avatar photo, Full name, Student code badge, Barcode icon tooltip.
  2. **المرحلة والصف (Stage & Grade)**: Badges for Stage, Grade, and Division.
  3. **ولي الأمر (Guardian Info)**: Guardian name, Phone number, Quick action button: Direct WhatsApp chat (`https://wa.me/20...`) & Phone call (`tel:...`).
  4. **المجموعات الدراسية (Enrolled Groups)**: Enrolled group count badge with interactive tooltip listing group names.
  5. **الرصيد المالي (Financial Balance)**:
     - If `balanceDue === 0`: Green Badge "مسدد بالكامل ✓".
     - If `balanceDue > 0`: Rose Badge "مستحق: {balanceDue} ج.م".
  6. **الإجراءات (Actions)**:
     - 👁️ "الملف الكامل" (Open Student Detail Drawer).
     - ➕ "تسجيل بمجموعة" (Open Group Enrollment Modal).
     - 🪪 "طباعة الكارنيه" (Open ID Card Modal).

#### 4. Student Registration Modal (`StudentRegistrationModal`)
- Modal title: "تسجيل طالب جديد في السنتر (New Student Intake)".
- **Section 1: البيانات الشخصية والأكاديمية**:
  - الاسم الرباعي للطالب (Full name - required).
  - كود الطالب / الباركود (Auto-generated next code e.g. `STD-1004`, editable for manual barcode scanner input).
  - رقم هاتف الطالب (Optional/Required).
  - الرقم القومي (National ID - 14 digits optional).
  - المرحلة الدراسية (Stage selector).
  - الصف الدراسي (Grade selector).
  - الشعبة (Division selector - conditional).
  - رقم الجلوس (Seat number - optional).
- **Section 2: بيانات ولي الأمر والتواصل الطارئ**:
  - اسم ولي الأمر (Guardian name - required).
  - رقم هاتف ولي الأمر (Guardian phone - required for WhatsApp alerts).
  - صلة القرابة (Relationship: الأب، الأم، ولي أمر).
- **Section 3: سياسة الخصم والاشتراك المبدئي**:
  - نوع الخصم الافتراضي (Default discount: None / Percentage / Fixed / 100% Free).
  - قيمة الخصم (Discount value input).
  - خيار التسجيل المباشر في مجموعة دراسية مع فحص التعارض الفوري.
- Submit button with loading spinner: "حفظ وتسجيل الطالب".

#### 5. Student Detail Drawer (`StudentDetailDrawer`)
- Slide-over drawer with smooth transition from the right.
- **Drawer Header**:
  - Student photo with upload avatar action (guarded by AC-4/AC-5).
  - Student name, student code, stage/grade badges.
  - Action buttons: "طباعة الكارنيه" and "تسجيل في مجموعة".
- **Tab 1: المجموعات والاشتراكات المقيد بها**:
  - List of enrolled groups with branch, classroom, schedule, teacher, pricing model (اشتراك سنتر / برايفت), and applied discount badge.
  - Calculation: Base fee - Discount = Net monthly fee.
  - Action per group: "إلغاء الاشتراك / انسحاب" with confirmation dialog.
  - Action: "+ تسجيل في مجموعة جديدة".
- **Tab 2: سجل الحضور والغياب**:
  - Attendance KPIs: Total sessions, Present count, Absent count, Attendance percentage badge (e.g. 94%).
  - Chronological timeline of sessions: Session date, Group name, Verification method badge (باركود / يدوي), Timestamp, Check-in cashier name.
- **Tab 3: الحساب المالي والفواتير**:
  - Financial summary banner: Total Invoiced, Total Paid, Current Balance Due.
  - Invoices Table: Invoice #, Month/Year, Total, Discount, Net, Paid, Status badge (Paid / Partially Paid / Pending).
  - Payments / Receipts List: Receipt #, Date/Time, Amount Paid, Payment Method (Cash, Vodafone Cash, InstaPay, Fawry), Cashier user.
  - Quick Action button: "تحصيل دفعة نقدية سريعة" allowing cashier/admin to record a payment directly.

#### 6. Group Enrollment Modal with Conflict Preflight Radar (`GroupEnrollmentModal`)
- Triggered from Student Directory or Student Drawer.
- **Step 1: اختيار المجموعة الدراسية**:
  - Dropdown of groups, filtered by student's grade by default.
  - Shows group name, teacher name, subject, schedule day & time, branch, and classroom.
- **Step 2: مؤشر السعة وقاعة الدرس**:
  - Capacity progress bar: e.g. "45 / 50 مقعد (90%)".
  - Classroom equipment indicators (تكييف، بروجيكتور، سبورة ذكية).
- **Step 3: رادار فحص التعارض الفوري (Conflict Radar Preflight HUD)**:
  - Dynamically evaluates `checkStudentEnrollmentConflict()` in real-time as the admin selects a group:
  - **State A (Clear / No Conflict)**:
    - Emerald HUD Card: "✓ الموعد متوافق تماماً مع جدول الطالب ولا يوجد أي تعارض زمني".
    - Details: The selected day and time slot does not intersect with any of the student's existing enrolled groups.
  - **State B (Time Collision Detected - Hard Block)**:
    - Rose HUD Card with `AlertTriangle`: "❌ تعارض زمني حاسم في جدول الطالب!".
    - Details: "الطالب مسجل بالفعل في مجموعة [مجموعة العباقرة - رياضيات] يوم (السبت) من الساعة 14:00 إلى 16:00."
    - Confirmation button is disabled (`disabled={!preflight.canEnroll}`).
  - **State C (Duplicate Enrollment)**:
    - Warning: "الطالب مقيد بالفعل في هذه المجموعة." Button disabled.
  - **State D (Capacity Overflow Warning)**:
    - Amber Warning Card: "تنبيه: المجموعة مكتملة العدد بالكامل (50/50 طالباً)."
- **Step 4: تحديد نظام المحاسبة وسياسة الخصم**:
  - نظام المحاسبة:
    - `center`: نظام السنتر (اشتراك شهري)
    - `private`: نظام البرايفت (حصة خاصة / نسبة)
  - سياسة الخصم:
    - بدون خصم (كامل المصروفات)
    - نسبة مئوية % (مثال: 20% لأبناء المعلمين أو الأشقاء)
    - مبلغ ثابت ج.م (مثال: 50 ج.م)
    - منحة دراسية كاملة 100% (معفي من المصروفات)
  - معاينة الرسوم الشهرية الصافية:
    $$\text{Net Fee} = \max(0, \text{Gross Fee} - \text{Discount})$$
    Displays: "المصروفات الأصلية: 300 ج.م - الخصم: 60 ج.م = المبلغ المطلوب سداده: 240 ج.م".
- **Step 5: تأكيد القيد والاشتراك**:
  - Submits enrollment to DAL, automatically creates tuition invoice, updates student record, and closes modal with success toast.

#### 7. Official Branded Student ID Card Modal (`StudentIdCardModal`)
- Modal title: "بطاقة الطالب المعتمدة وكود الباركود (Official Student ID Card)".
- **Card Preview (Standard ID Ratio)**:
  - Top Left: Official Yalla Center Logo (`public/brand/yalla-center-logo-dark.png`).
  - Top Right: Center Name (e.g. "سنتر الماهر النموذجي").
  - Center: Student photo avatar, Student full name (bold Cairo font), Academic tier (`الثانوية العامة — الصف الثالث الثانوي`), Division badge (`علمي رياضة`).
  - Student Code & Barcode: Large high-contrast SVG Code 128 barcode representation with human-readable text `STD-1001`.
  - QR Code preview for fast mobile reception scanning.
  - Footer: Emergency guardian phone (`هاتف ولي الأمر: 01099991001`), issuance date, official watermark.
- **Action Buttons**:
  - 🖨️ "طباعة الكارنيه (A4 / Card Print)" (uses CSS `@media print` layout).
  - 📥 "إغلاق النافذة".

---

## 7. Security Guardrails & Acceptance Criteria Alignment

| Acceptance Criteria | Requirement | Milestone 3 Implementation & Verification |
|---|---|---|
| **AC-3** | Tenant Isolation | Student queries, enrollments, and conflict checks are strictly scoped by `tenantId`. No cross-tenant visibility. |
| **AC-4** | Student Self-Profile Photo | Student can update only `avatarUrl` via guarded DAL endpoint `updateUserProfilePhoto`. |
| **AC-5** | Student Administrative Locked | Attempts by students to alter `fullName`, `studentCode`, `stage`, `grade`, `division`, `discountType`, or `balanceDue` return HTTP 403 Forbidden via `lib/security/rbac.ts`. |
| **AC-7** | Idempotent Attendance Integration | Fast reception check-in scans link directly to `studentCode` / barcode generated during student registration. |
| **AC-10** | RTL & Typography | All UI components follow Arabic Cairo typography, `dir="rtl"`, and responsive viewports. |

---

## 8. Implementation Checklist for Worker M3

1. **Conflict Detector Extension**:
   - Update `lib/timetable/conflict-detector.ts` with `checkStudentEnrollmentConflict` and export types `StudentScheduleConflict`, `StudentEnrollmentConflictCheckResult`.
2. **DAL Contracts & Mock Data**:
   - Add student enrollment methods to `IDataProvider` in `lib/dal/index.ts`.
   - Implement `createStudent`, `enrollStudent`, `unenrollStudent`, `getStudentEnrollmentDetails`, `getStudentAttendanceHistory`, `getPayments` in `lib/dal/mock-data.ts`.
   - Enrich `INITIAL_SEEDED_DATA` in `mock-data.ts` with attendance history and payments for demo students.
3. **Student UI Subsystem**:
   - Update `app/center/[centerSlug]/students/page.tsx` with complete directory, KPI cards, filters, and state handlers.
   - Implement `StudentRegistrationModal`.
   - Implement `StudentDetailDrawer` (Groups, Attendance, Finances tabs).
   - Implement `GroupEnrollmentModal` with live Preflight Conflict Radar HUD.
   - Implement `StudentIdCardModal` with printable SVG barcode.
4. **Verification & Testing**:
   - Add unit tests for `checkStudentEnrollmentConflict` in `tests/unit/student-conflict.test.ts`.
   - Add unit tests for student DAL methods (`createStudent`, `enrollStudent`, `unenrollStudent`, duplicate enrollment prevention).
   - Verify `npx vitest run` passes 100%.

---
*Report prepared by Explorer M3-1 for Worker M3 implementation.*
