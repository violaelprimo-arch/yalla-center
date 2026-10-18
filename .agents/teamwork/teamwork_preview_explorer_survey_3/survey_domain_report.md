# YALLA CENTER — Domain Logic, Algorithms & Testing Architecture Survey Report

**Agent**: Domain Logic & Testing Explorer Survey 3 (`teamwork_preview_explorer_survey_3`)  
**Date**: October 18, 2026  
**Project**: Yalla Center SaaS Platform  
**Target File**: `survey_domain_report.md`  
**Reference Document**: `ORIGINAL_REQUEST.md` (Authoritative User Request)

---

## 1. Executive Summary & Domain Scope

Yalla Center is an Arabic-first, multi-tenant educational center management SaaS platform developed by Yalla Codex. The platform handles high-throughput physical reception workflows, dual educational financial compensation structures, AI-powered pedagogical materials and examinations, and mission-critical multi-channel communication.

This survey provides the formal mathematical specifications, domain algorithms, concurrency safeguards, rendering requirements, and a comprehensive 4-Tier test architecture to guarantee that all acceptance criteria are met with zero defects and zero regressions.

### Core Domain Capabilities Analyzed

```
+----------------------------------------------------------------------------------------------------+
|                                      YALLA CENTER DOMAIN MAP                                       |
+----------------------------------------------------------------------------------------------------+
| 1. Dual Compensation Engine   | 2. Fast Reception Attendance  | 3. Materials & AI Exam Platform    |
| - Center Subscription Formula | - Barcode / QR / Code Scan    | - Stage -> Grade -> Doc Hierarchy  |
| - Private Lessons Net Split   | - Idempotent Logging (Unique) | - Grounded RAG Validation Gate     |
| - Rounding Leakage Invariant  | - Sub-300ms Verification HUD  | - KaTeX Scientific Math Rendering  |
| - Invoiced vs Collected Track | - Reactive Session Updates    | - Printable A4 Branded Layout      |
+-------------------------------+-------------------------------+------------------------------------+
| 4. Async Notification Engine  | 5. Security & RBAC Guardrails | 6. E2E Testing Track (Tiers 1-4)   |
| - WhatsApp Cloud API & FCM    | - Student Profile-only Edit   | - Tier 1: Unit Mathematical Proofs |
| - Non-blocking DB Queue       | - Teacher Rate/Audit Lockout  | - Tier 2: RBAC & Tenant Isolation  |
| - Sandboxed Outbox Fallback   | - Multi-tenant RLS Isolation  | - Tier 3: Workflow API Idempotency |
| - Retry & Dead-letter Log     | - Immutable Historical Ledger | - Tier 4: Playwright E2E & Visuals |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Dual Teacher Compensation Engine

Educational centers in Egypt and the MENA region operate on two fundamentally different financial models. The engine must support both models simultaneously per group/subject, accurately track invoiced versus collected funds, prevent division-by-zero, and guarantee zero rounding leakage.

### 2.1 Model A: Center Subscription Formula (نظام السنتر)

In this model, students pay a regular center subscription (monthly or per group sequence). Teachers are compensated based on their **Average Attendance** across all actually conducted sessions, multiplied by a contractual fixed rate per student per session.

#### Mathematical Definition
$$\text{Average Attendance} = \frac{\sum_{i \in \text{Conducted Sessions}} \text{Valid Attendance}_i}{|\text{Conducted Sessions}|}$$

$$\text{Teacher Compensation} = \text{Average Attendance} \times \text{Contractual Fixed Rate}$$

#### Acceptance Criterion Verification
- **Test Case**: 4 conducted sessions with attendances $[12, 15, 11, 14]$ at a contractual rate of $20.00\text{ EGP}$.
  $$\text{Total Valid Attendance} = 12 + 15 + 11 + 14 = 52$$
  $$\text{Conducted Sessions} = 4$$
  $$\text{Average Attendance} = \frac{52}{4} = 13.00$$
  $$\text{Compensation} = 13.00 \times 20.00\text{ EGP} = 260.00\text{ EGP}$$
  **Exact Result**: $260.00\text{ EGP}$.

#### Critical Edge Cases & Guards
1. **Exclusion of Canceled Sessions**:
   - Sessions marked with `status = 'canceled'` or `status = 'postponed'` MUST be strictly excluded from both the numerator (attendance sum) and the denominator (conducted session count).
   - If a group has 6 sessions scheduled in a month: 4 completed with attendances $[12, 15, 11, 14]$, 1 canceled, and 1 scheduled in the future:
     Conducted count remains $4$, total attendance remains $52$, yielding exactly $260.00\text{ EGP}$.
2. **Zero Conducted Sessions (Division-by-Zero Guard)**:
   - When a month begins or if all scheduled sessions were canceled ($|\text{Conducted Sessions}| = 0$), calculating $\frac{0}{0}$ results in `NaN` or unhandled arithmetic exceptions in typical implementations.
   - Guard rule:
     $$\text{If } |\text{Conducted Sessions}| = 0 \implies \text{Average Attendance} = 0, \quad \text{Compensation} = 0.00\text{ EGP}$$
3. **Valid Attendance Definition**:
   - Only attendance records with `status IN ('present', 'late')` are counted.
   - Records with `status = 'absent'` or `status = 'excused'` are excluded from the total valid attendance count.
4. **Fractional Averages & Precision**:
   - Example: 3 sessions with attendances $[10, 11, 10] \implies \text{Total} = 31$, $\text{Average} = \frac{31}{3} = 10.333333\dots$
   - When multiplied by rate $25.00\text{ EGP}$:
     $$\text{Compensation} = \frac{31}{3} \times 25 = \frac{775}{3} \approx 258.3333\dots\text{ EGP}$$
   - Rounding rule: Banker's rounding / round-half-up to 2 decimal places ($258.33\text{ EGP}$) or integer piastres ($25833\text{ piastres}$).

#### TypeScript Domain Implementation
```typescript
export interface SessionAttendanceRecord {
  sessionId: string;
  sessionStatus: 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'postponed';
  validAttendanceCount: number; // count of 'present' + 'late'
}

export interface CenterSubscriptionResult {
  conductedSessionsCount: number;
  totalValidAttendance: number;
  averageAttendance: number;
  contractualRate: number;
  compensationAmount: number;
  excludedSessionsCount: number;
}

export function calculateCenterSubscriptionCompensation(
  sessions: SessionAttendanceRecord[],
  contractualFixedRate: number
): CenterSubscriptionResult {
  if (contractualFixedRate < 0) {
    throw new Error('Contractual fixed rate cannot be negative');
  }

  // Filter only conducted (completed or in_progress) sessions
  const conductedSessions = sessions.filter(
    (s) => s.sessionStatus === 'completed' || s.sessionStatus === 'in_progress'
  );

  const excludedCount = sessions.length - conductedSessions.length;

  // Zero conducted sessions guard
  if (conductedSessions.length === 0) {
    return {
      conductedSessionsCount: 0,
      totalValidAttendance: 0,
      averageAttendance: 0,
      contractualRate: contractualFixedRate,
      compensationAmount: 0,
      excludedSessionsCount: excludedCount,
    };
  }

  const totalValidAttendance = conductedSessions.reduce(
    (acc, s) => acc + Math.max(0, s.validAttendanceCount),
    0
  );

  // Exact average attendance
  const averageAttendance = totalValidAttendance / conductedSessions.length;

  // Compensation in EGP rounded to 2 decimal places (piastre level)
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
```

---

### 2.2 Model B: Private Lessons Revenue Split Formula (نظام البرايفت)

In private lessons (or small premium groups), students pay per course or per session. Revenue is shared between the Educational Center and the Teacher based on contractual percentages (e.g. 70% Teacher / 30% Center).

#### Mathematical Definition
For each student enrollment $j$:
1. **Net Eligible Revenue**:
   $$\text{Base Price}_j = P_j$$
   $$\text{Discount}_j = \begin{cases} 
   P_j \times \frac{d_j\%}{100} & \text{if percentage discount} \\ 
   D_j & \text{if fixed amount discount} \\ 
   P_j & \text{if 100\% free enrollment} 
   \end{cases}$$
   $$\text{Net Revenue}_j = \max(0, P_j - \text{Discount}_j)$$

2. **Zero Rounding Leakage Revenue Partition**:
   Let $T\%$ be the Teacher percentage and $C\% = 100 - T\%$ be the Center percentage.
   $$\text{Teacher Share}_j = \text{round}\left(\text{Net Revenue}_j \times \frac{T}{100}, 2\right)$$
   $$\text{Center Share}_j = \text{Net Revenue}_j - \text{Teacher Share}_j$$

   **Invariant Guarantee**:
   $$\forall j: \quad \text{Teacher Share}_j + \text{Center Share}_j \equiv \text{Net Revenue}_j$$
   This formulation guarantees zero rounding leakage. The sum of parts always equals the exact net eligible revenue.

#### Acceptance Criterion Verification
- **Standard Split**: Price $100.00\text{ EGP}$, $70/30$ split, no discount:
  $$\text{Net} = 100.00\text{ EGP} \implies \text{Teacher} = 70.00\text{ EGP}, \quad \text{Center} = 30.00\text{ EGP}$$
- **20% Discount**: Price $100.00\text{ EGP}$, $70/30$ split, 20% discount:
  $$\text{Discount} = 20.00\text{ EGP}, \quad \text{Net} = 80.00\text{ EGP}$$
  $$\text{Teacher} = 80.00 \times 0.70 = 56.00\text{ EGP}, \quad \text{Center} = 80.00 - 56.00 = 24.00\text{ EGP}$$
  **Exact Result**: $56.00\text{ EGP} / 24.00\text{ EGP}$.
- **100% Free Enrollment**: Price $100.00\text{ EGP}$, $70/30$ split, 100% free:
  $$\text{Net} = 0.00\text{ EGP} \implies \text{Teacher} = 0.00\text{ EGP}, \quad \text{Center} = 0.00\text{ EGP}$$
  **Exact Result**: $0.00\text{ EGP} / 0.00\text{ EGP}$.

#### Invoiced vs. Collected Accounting
The system must maintain two parallel ledgers:
1. **Accrual Ledger (Invoiced Basis)**:
   - Tracks total contracted liability based on issued invoices and enrollments.
   - Useful for assessing projected earnings and student accounts receivable.
2. **Cash Ledger (Collected Basis)**:
   - Computes teacher compensation payable strictly based on actual payments received at the cashier desk.
   - Formula:
     $$\text{Realized Teacher Share} = \sum_{p \in \text{Collected Receipts}} \text{Allocated Payment}_p \times \frac{T}{100}$$
   - Any teacher advances (سلفيات نقدية) are deducted from the payout:
     $$\text{Net Teacher Payout} = \text{Realized Teacher Share} - \text{Approved Advances}$$

#### TypeScript Domain Implementation
```typescript
export interface DiscountSpec {
  type: 'none' | 'percentage' | 'fixed' | 'free';
  value: number; // percentage (0-100) or fixed amount in EGP
}

export interface PrivateLessonItem {
  enrollmentId: string;
  studentId: string;
  basePrice: number;
  discount: DiscountSpec;
  collectedAmount: number; // Actual cash collected
}

export interface PrivateLessonSplitSummary {
  enrollmentId: string;
  basePrice: number;
  discountAmount: number;
  netRevenue: number;
  teacherShare: number;
  centerShare: number;
  invoicedBalance: number;
  collectedAmount: number;
  collectedTeacherShare: number;
  uncollectedTeacherShare: number;
}

export interface PrivateLessonBatchResult {
  totalGrossInvoiced: number;
  totalDiscountAmount: number;
  totalNetRevenue: number;
  totalTeacherShare: number;
  totalCenterShare: number;
  totalCollected: number;
  totalCollectedTeacherShare: number;
  roundingLeakage: number; // Must strictly equal 0
  items: PrivateLessonSplitSummary[];
}

export function calculatePrivateLessonsSplit(
  items: PrivateLessonItem[],
  teacherPercentage: number
): PrivateLessonBatchResult {
  if (teacherPercentage < 0 || teacherPercentage > 100) {
    throw new Error('Teacher percentage must be between 0 and 100');
  }

  const centerPercentage = 100 - teacherPercentage;
  let totalGrossInvoiced = 0;
  let totalDiscountAmount = 0;
  let totalNetRevenue = 0;
  let totalTeacherShare = 0;
  let totalCenterShare = 0;
  let totalCollected = 0;
  let totalCollectedTeacherShare = 0;

  const itemSummaries: PrivateLessonSplitSummary[] = items.map((item) => {
    const basePrice = Math.max(0, item.basePrice);
    let discountAmount = 0;

    if (item.discount.type === 'percentage') {
      const pct = Math.min(100, Math.max(0, item.discount.value));
      discountAmount = Math.round(basePrice * (pct / 100) * 100) / 100;
    } else if (item.discount.type === 'fixed') {
      discountAmount = Math.min(basePrice, Math.max(0, item.discount.value));
    } else if (item.discount.type === 'free') {
      discountAmount = basePrice;
    }

    const netRevenue = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

    // Guaranteed zero-leakage split:
    // 1. Calculate teacher share rounded to nearest cent/piastre
    const teacherShare = Math.round(netRevenue * (teacherPercentage / 100) * 100) / 100;
    // 2. Center share gets the exact remainder
    const centerShare = Math.round((netRevenue - teacherShare) * 100) / 100;

    // Track collected portion
    const collected = Math.min(netRevenue, Math.max(0, item.collectedAmount));
    const collectedTeacherShare = Math.round(collected * (teacherPercentage / 100) * 100) / 100;
    const uncollectedTeacherShare = Math.round((teacherShare - collectedTeacherShare) * 100) / 100;

    totalGrossInvoiced += basePrice;
    totalDiscountAmount += discountAmount;
    totalNetRevenue += netRevenue;
    totalTeacherShare += teacherShare;
    totalCenterShare += centerShare;
    totalCollected += collected;
    totalCollectedTeacherShare += collectedTeacherShare;

    return {
      enrollmentId: item.enrollmentId,
      basePrice,
      discountAmount,
      netRevenue,
      teacherShare,
      centerShare,
      invoicedBalance: netRevenue - collected,
      collectedAmount: collected,
      collectedTeacherShare,
      uncollectedTeacherShare,
    };
  });

  // Calculate rounding leakage across the batch
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
    items: itemSummaries,
  };
}
```

---

## 3. Fast Reception Attendance System

During peak arrival hours (e.g. between 3:00 PM and 3:15 PM), hundreds of students flood the reception desk. The reception interface must operate with **sub-300ms verification turnaround**, support multiple scanning modes, display an immediate rich visual verification HUD, and enforce **strict idempotency** so duplicate scans never corrupt attendance counts or trigger duplicate parent notifications.

### 3.1 Scanning Modalities & Hardware Support
1. **USB Hardware Barcode/QR Scanner**: Emulates keyboard input followed by `Enter` (ASCII 13). Requires the input field to stay automatically focused, buffering scanned keystrokes.
2. **Mobile / Web Camera Scanner**: Uses HTML5 canvas stream and zxing/jsQR decoder for rapid camera scanning at kiosk stands.
3. **Manual Code Lookup**: Receptionist can type `STD-1049` or student phone number with fuzzy search autocomplete.

### 3.2 Instant Verification Heads-Up Display (HUD)
Upon scanning, the UI immediately displays a high-contrast card:
- **Visual Identity**: Large student photograph (300×300px) allowing the receptionist to visually verify identity against the physical student.
- **Academic Context**: Student Full Name (in Cairo font), Student Code, Academic Stage, Grade, and enrolled Group.
- **Session Status**: Target session, Room Number, Teacher Name, Scheduled Time.
- **Financial Status Alert**:
  - `Green`: All dues cleared.
  - `Amber Alert`: Arrears or unpaid monthly installment (shows exact amount: e.g. "متبقي 150 ج.م").
  - `Red Alert`: Restricted enrollment or blocked attendance until payment clearance.
- **Audio Feedback**: Pleasant high-frequency ping for successful first scan; distinctive lower double-buzz for duplicate scan or warning.

### 3.3 Idempotent Attendance Architecture
Acceptance Criterion: *"Idempotent attendance test verifies that scanning a student code twice in the same session records exactly one attendance record."*

#### Concurrency and Idempotency Mechanism
To eliminate race conditions when a student card is scanned rapidly twice or scanned at two different reception terminals simultaneously:

1. **Database Constraint Level**:
   ```sql
   -- Compound Unique Constraint on (session_id, student_id)
   ALTER TABLE session_attendance 
   ADD CONSTRAINT uq_session_attendance_session_student 
   UNIQUE (session_id, student_id);
   ```

2. **Atomic UPSERT with First-Scan Detection**:
   ```sql
   INSERT INTO session_attendance (
     center_id, 
     session_id, 
     student_id, 
     status, 
     scanned_at, 
     scanned_by
   ) VALUES ($1, $2, $3, 'present', NOW(), $4)
   ON CONFLICT (session_id, student_id) 
   DO UPDATE SET 
     updated_at = NOW()
   RETURNING 
     id, 
     session_id, 
     student_id, 
     status, 
     scanned_at, 
     (xmax = 0) AS is_new_record;
   ```
   *Note*: In PostgreSQL, `(xmax = 0)` evaluates to `true` if a new row was inserted, and `false` if an existing row was matched and updated.

3. **Application Layer Protocol**:
   - If `is_new_record === true`:
     1. Increment session active attendance counter.
     2. Enqueue asynchronous parent notification (WhatsApp / Push).
     3. Emit real-time event via Supabase Realtime to Teacher and Dashboard.
     4. Return `{ status: 'success', duplicate: false, message: 'تم تسجيل الحضور بنجاح' }`.
   - If `is_new_record === false`:
     1. DO NOT increment session counter.
     2. DO NOT enqueue parent notification.
     3. Return `{ status: 'already_recorded', duplicate: true, message: 'تم تسجيل الحضور مسبقاً لهذه الحصة' }`.
     4. Return HTTP 200 (idempotent success) with `duplicate: true`.

4. **Client-Side Debouncing Buffer**:
   - In-memory `Map<string, number>` tracking `${studentCode}:${sessionId}` for 3000ms, immediately acknowledging duplicate scan attempts on the client side while logging gracefully.

---

## 4. Hierarchical Materials & Grounded AI Exam Platform

### 4.1 Hierarchical Taxonomy & Google Drive Indexing
Materials are structured strictly along an 8-level educational hierarchy:
$$\text{Platform} \to \text{Center} \to \text{Stage} \to \text{Grade} \to \text{Subject} \to \text{Unit} \to \text{Lesson} \to \text{Document}$$

```
المرحلة الثانوية (High School)
└── الصف الثالث الثانوي (Grade 12)
    └── مادة الفيزياء (Physics)
        └── الوحدة الأولى: التيار الكهربي وقانون أوم (Unit 1)
            └── الدرس الأول: قانون كيرشوف والمقاومة النوعية (Lesson 1)
                ├── مذكرة_شرح_كيرشوف.pdf (Google Drive Linked)
                ├── بنك_مسائل_التيار_المتردد.pdf (Uploaded Document)
                └── ملخص_قوانين_الكهربية.docx (Indexed Text)
```

#### Document Indexing Pipeline
1. Documents linked via Google Drive API or uploaded directly to Supabase Storage are dispatched to the indexing pipeline.
2. Text extraction engine parses text chunks, strips formatting, and counts words.
3. Status machine:
   `pending` $\to$ `indexing` $\to$ `indexed` (or `failed`).
4. Metadata recorded: `total_word_count`, `indexed_chunks_count`, `text_hash`, `last_indexed_at`.

### 4.2 Grounded AI Exam Generation Engine
Acceptance Criterion: *"AI exam generator rejects exam creation if selected source materials are unindexed or insufficient, and places generated exams into teacher review before publishing."*

#### Grounding & Safety Verification Gates
Before invoking the LLM generation endpoint, the request must pass two mandatory validation gates:

```
[Exam Generation Request]
        │
        ▼
[Gate 1: Are all selected documents fully indexed?]
        ├── NO  ──► REJECT: HTTP 400 'UNINDEXED_SOURCE_DOCUMENTS'
        └── YES ──► Continue
                     │
                     ▼
[Gate 2: Is total indexed content >= 200 words?]
        ├── NO  ──► REJECT: HTTP 400 'INSUFFICIENT_SOURCE_DOCUMENTS'
        └── YES ──► Approve for AI Prompt Construction
```

#### TypeScript Validation Guard
```typescript
export interface IndexedDocumentRef {
  id: string;
  title: string;
  indexingStatus: 'pending' | 'indexing' | 'indexed' | 'failed';
  wordCount: number;
}

export interface ExamGenerationPreflightResult {
  allowed: boolean;
  errorCode?: 'UNINDEXED_SOURCE_DOCUMENTS' | 'INSUFFICIENT_SOURCE_DOCUMENTS' | 'EMPTY_SELECTION';
  messageArabic: string;
  unindexedDocTitles?: string[];
  totalWords?: number;
}

export function validateExamGenerationPreflight(
  docs: IndexedDocumentRef[]
): ExamGenerationPreflightResult {
  if (!docs || docs.length === 0) {
    return {
      allowed: false,
      errorCode: 'EMPTY_SELECTION',
      messageArabic: 'يرجى تحديد مستند مصدر واحد على الأقل لتوليد الامتحان.',
    };
  }

  const unindexed = docs.filter((d) => d.indexingStatus !== 'indexed');
  if (unindexed.length > 0) {
    return {
      allowed: false,
      errorCode: 'UNINDEXED_SOURCE_DOCUMENTS',
      messageArabic: `المستندات التالية لم تكتمل فهرستها بعد: ${unindexed.map((d) => d.title).join('، ')}. لا يمكن توليد الامتحان إلا من مستندات مفهرسة بالكامل.`,
      unindexedDocTitles: unindexed.map((d) => d.title),
    };
  }

  const totalWords = docs.reduce((sum, d) => sum + (d.wordCount || 0), 0);
  const MIN_WORD_THRESHOLD = 200;

  if (totalWords < MIN_WORD_THRESHOLD) {
    return {
      allowed: false,
      errorCode: 'INSUFFICIENT_SOURCE_DOCUMENTS',
      messageArabic: `محتوى المستندات المحددة غير كافٍ لتوليد اختبار موثوق (إجمالي الكلمات: ${totalWords}، الحد الأدنى المطلوب: ${MIN_WORD_THRESHOLD} كلمة).`,
      totalWords,
    };
  }

  return {
    allowed: true,
    messageArabic: 'المستندات مؤهلة لتوليد الاختبار.',
    totalWords,
  };
}
```

#### Teacher Review State Machine
Generated exams are strictly placed in draft state and cannot be published or assigned without teacher authorization:
```
[AI Output Received] 
        │
        ▼
status = 'draft'
review_status = 'pending_teacher_review'
is_published = false
        │
        ├── Teacher edits question text / KaTeX formulas
        ├── Teacher alters options or correct answers
        ├── Teacher removes or regenerates specific items
        ▼
[Teacher Clicks "اعتماد ونشر الاختبار"]
        │
        ▼
review_status = 'approved'
is_published = true
published_at = NOW()
```

### 4.3 Branded Printable A4 Exam Layout Specification
Acceptance Criterion: *"Printable A4 exam preview and PDF layout contains official Yalla Center logo top-left, teacher name top-right, student name and code inputs, and correctly formatted KaTeX math equations."*

#### Layout Geometry & CSS Rules
- Page Dimensions: ISO A4 ($210\text{mm} \times 297\text{mm}$), 15mm page margins.
- Page Break Management: `break-inside: avoid;` on each question card to prevent splitting a question across pages.
- Header Block Geometry:
  - **Top-Left (Visual Left)**: Official Yalla Center Logo (`public/brand/yalla-center-logo-dark.png` or monochrome vector for printing, max width 160px).
  - **Top-Right (Visual Right / Arabic First)**: Teacher Name (`أستاذ / محمد أحمد`), Educational Subject (`الفيزياء الحديثة`), Stage & Grade.
  - **Center**: Center Name, Exam Title, Academic Term, Duration (`زمن الإجابة: 60 دقيقة`).
- **Student Identification Block**:
  ```
  +--------------------------------------------------------------------------------------------------+
  | اسم الطالب: ................................................................  كود الطالب: [ ][ ][ ][ ][ ][ ] |
  | المجموعة: .............................  تاريخ الاختبار: ..../..../........  الدرجة: ........ / ........ |
  +--------------------------------------------------------------------------------------------------+
  ```
- **KaTeX Equation Integration**:
  All mathematical formulas (e.g. `$I = \frac{V}{R}$`, `$\lambda = \frac{h}{p}$`) are pre-rendered into HTML/SVG via `katex.renderToString(expr, { displayMode: false, throwOnError: false })`.
- **Options Grid**: 2-column or 4-column balanced layout with Arabic choice markers:
  - `(أ)` Option A
  - `(ب)` Option B
  - `(ج)` Option C
  - `(د)` Option D

### 4.4 Online Student Exam Platform
1. **Live Countdown Timer**:
   - Initialized with `remainingSeconds = exam.durationMinutes * 60`.
   - Persisted server-side with `started_at` and `expires_at` timestamps to prevent timer manipulation via browser reloads.
   - UI Warning: Turns amber at 10 minutes remaining, pulsing red at 3 minutes remaining.
2. **Autosave Engine**:
   - Every answer selection triggers an immediate local save in `localStorage` and debounces a background `PUT /api/student/exams/[id]/answers` request (300ms debounce).
   - Network failure resilience: If student disconnects, answers remain safely in local storage and re-synchronize when connection restores.
3. **Automated MCQ Grading**:
   - On submission or timer expiration:
     $$\text{Total Score} = \sum_{q \in \text{MCQs}} \begin{cases} \text{Points}_q & \text{if } \text{SelectedOption}_q = \text{CorrectOption}_q \\ 0 & \text{otherwise} \end{cases}$$
     $$\text{Percentage} = \frac{\text{Total Score}}{\text{Max Possible Score}} \times 100$$
   - Instant score recording in `exam_submissions` table and immediate feedback to student (if instant feedback is enabled by teacher).

---

## 5. Asynchronous Notification Engine

Educational operations must never stall because of third-party network latency or outages. The notification engine guarantees completely asynchronous, non-blocking delivery.

### 5.1 Architecture & Queuing Pattern
```
[Reception Scan / Cashier Payment / Exam Published]
                   │
                   ▼  (Atomic Local DB Transaction < 20ms)
       [Insert Event into notification_queue]
                   │
                   ├──► Returns HTTP 200 immediately to User
                   │
                   ▼  (Asynchronous Background Dispatch)
       [Notification Worker / Queue Consumer]
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
[Meta WhatsApp API]    [Firebase Web Push]
        │                     │
        ▼                     ▼
  (Log Delivery)        (Log Delivery)
```

### 5.2 Meta WhatsApp Business Cloud API Integration
- API Endpoint: `POST https://graph.facebook.com/v19.0/{phone-number-id}/messages`
- Authorization: Bearer Token via environment `WHATSAPP_CLOUD_API_TOKEN`.
- Pre-approved Arabic Template Messages:
  - `student_attendance_ar`: "تم تسجيل حضور الطالب {{1}} في حصة {{2}} مع الأستاذ {{3}} في تمام الساعة {{4}}."
  - `payment_receipt_ar`: "تم استلام مبلغ {{1}} ج.م لحساب الطالب {{2}} رقم الإيصال {{3}}."
  - `exam_result_ar`: "أهلاً بك، حصل الطالب {{1}} على درجة {{2}} من {{3}} في اختبار {{4}}."

### 5.3 Web Push & Firebase Cloud Messaging (FCM)
- Service Worker registration on mobile web and desktop.
- Handles push payloads for instant receptionist and teacher notifications.

### 5.4 Non-Blocking Invariant & Sandboxed Fallback
Acceptance Criterion: *"Safely handle external integrations (WhatsApp, Google Drive, AI provider) with sandboxed/test modes when production credentials are not provided."*

When running in sandbox/demo mode or when API credentials are unset:
1. The notification dispatcher does NOT attempt external HTTP calls.
2. The payload is written to `notification_logs` with status `simulated_delivered`.
3. A real-time WebSocket event pushes the message to an administrative **Live Outbox Viewer** in the UI, enabling test verification and demonstration without real SMS/WhatsApp charges.

---

## 6. Complete Acceptance Criteria Mapping & Verification Traceability

The following table provides 1-to-1 traceability from the authoritative acceptance criteria in `ORIGINAL_REQUEST.md` to our verification mechanisms:

| Acceptance Criterion | Domain Module | Verification Tier | Verification Method & Expected Result |
| :--- | :--- | :--- | :--- |
| **AC-1**: Center Subscription calc: 4 classes $[12, 15, 11, 14]$ at $20\text{ EGP} = 260\text{ EGP}$; canceled excluded; 0 classes returns 0 without error. | Dual Compensation Engine | **Tier 1 Unit** | Run `vitest run tests/unit/compensation-center-subscription.test.ts`. Asserts exact equality to $260.00$, canceled classes omitted, 0 sessions returns $0$. |
| **AC-2**: Private Lessons calc: 100 EGP with 70/30 split yields 70/30; 20% discount yields 56/24; 100% free yields 0/0 without rounding leakage. | Dual Compensation Engine | **Tier 1 Unit** | Run `vitest run tests/unit/compensation-private-lessons.test.ts`. Asserts exact 70/30, 56/24, 0/0 splits and `teacherShare + centerShare === netRevenue`. |
| **AC-3**: Multi-tenant isolation: Center A admin/user cannot access or query Center B data. | RBAC & Multi-Tenant Core | **Tier 2 Integration** | Run `vitest run tests/security/multi-tenant-isolation.test.ts`. Query Center B records with Center A auth token; verify empty set or 403 Forbidden. |
| **AC-4**: Student permission: Student can successfully update their own profile picture. | Security Guardrails | **Tier 2 Integration** | Run `vitest run tests/security/student-rbac-guardrails.test.ts`. Student uploads avatar; verify 200 OK and updated avatar URL. |
| **AC-5**: Student permission: Student attempting to update name, student code, grade, or balance receives HTTP 403 Forbidden. | Security Guardrails | **Tier 2 Integration** | Run `vitest run tests/security/student-rbac-guardrails.test.ts`. Student sends `PATCH /api/students/[id]` modifying `balance` or `code`; verify HTTP 403. |
| **AC-6**: Teacher permission: Teacher cannot alter contractual salary rates or access another teacher's financial statements. | Security Guardrails | **Tier 2 Integration** | Run `vitest run tests/security/teacher-rbac-guardrails.test.ts`. Teacher attempts `PATCH /api/teachers/rates` or queries another teacher's payroll; verify HTTP 403. |
| **AC-7**: Idempotent attendance: Scanning student code twice in same session records exactly one attendance record. | Fast Reception System | **Tier 3 Integration** | Run `vitest run tests/integration/reception-attendance-idempotency.test.ts`. Call scan endpoint twice in rapid succession; verify DB row count is 1. |
| **AC-8**: AI exam generator: Rejects creation if source materials are unindexed or insufficient, and places generated exams into teacher review before publishing. | AI Exam Platform | **Tier 3 Integration** | Run `vitest run tests/integration/ai-exam-workflow.test.ts`. Unindexed source yields 400 with `UNINDEXED_SOURCE_DOCUMENTS`; generated exam status is `pending_teacher_review`. |
| **AC-9**: Printable A4 exam preview: Contains Yalla Center logo top-left, teacher name top-right, student inputs, and correctly formatted KaTeX math equations. | Exam Print Platform | **Tier 4 Playwright** | Run `playwright test tests/e2e/printable-a4-exam.spec.ts`. Verify DOM positioning: logo top-left, teacher top-right, student inputs, KaTeX rendered math. |
| **AC-10**: Next.js build & RTL: Application builds without TS/ESLint errors and is fully functional in Arabic RTL across desktop, tablet, and mobile breakpoints. | UI / Design System | **Tier 4 Playwright** | Run `pnpm build` (exit 0) and `playwright test tests/e2e/arabic-rtl-responsive.spec.ts` across desktop (1440px), tablet (768px), mobile (375px). |

---

## 7. E2E Testing Track Strategy & Hierarchy

The E2E Testing Track is organized into **Four Strict Tiers** executed progressively:

```
+───────────────────────────────────────────────────────────+
│ TIER 4: End-to-End Browser & Visual RTL Layout (Playwright)│
│ - Arabic RTL desktop/tablet/mobile, Printable A4 Exam,    │
│   Online exam timer & autosave, Reception scan HUD.       │
+───────────────────────────────────────────────────────────+
                              ▲
+───────────────────────────────────────────────────────────+
│ TIER 3: Operational Workflows & Concurrency Integration   │
│ - Reception scan duplicate idempotency (DB constraint),   │
│   AI exam generation preflight validation & review gate,  │
│   Non-blocking async notification queue dispatch.         │
+───────────────────────────────────────────────────────────+
                              ▲
+───────────────────────────────────────────────────────────+
│ TIER 2: Security Guardrails, RBAC & Multi-Tenant Isolation │
│ - Center A vs Center B tenant isolation,                   │
│   Student avatar edit allowed / admin fields HTTP 403,     │
│   Teacher salary lock & payroll privacy HTTP 403.         │
+───────────────────────────────────────────────────────────+
                              ▲
+───────────────────────────────────────────────────────────+
│ TIER 1: Core Domain Logic & Mathematical Proofs (Vitest)  │
│ - Center Subscription formula (4 sessions = 260 EGP),      │
│   Zero conducted sessions = 0 EGP (no division-by-zero),  │
│   Private Lessons 70/30, 20% discount, 100% free split,   │
│   Zero rounding leakage invariant proof.                  │
+───────────────────────────────────────────────────────────+
```

### 7.1 Recommended Test Frameworks
- **Test Runner & Unit/Integration Framework**: **Vitest** (Fast ESM execution, native TypeScript, jsdom integration, compatible with standard assertion libraries).
- **Browser E2E & Visual Testing**: **Playwright** (`@playwright/test`) with Arabic locale (`ar-EG`), RTL text direction checks, and mobile viewport emulation.
- **Mocking & Isolation**: Mock Supabase client harness for database-independent unit tests, and local PostgreSQL / Supabase Testcontainers for integration tests.

### 7.2 Directory Structure for Tests
```
tests/
├── unit/                                  # Tier 1: Pure Domain Logic
│   ├── compensation-center-subscription.test.ts
│   ├── compensation-private-lessons.test.ts
│   ├── attendance-idempotency-logic.test.ts
│   ├── exam-grading.test.ts
│   └── exam-source-validation.test.ts
├── security/                              # Tier 2: RBAC & Multi-Tenant Isolation
│   ├── multi-tenant-isolation.test.ts
│   ├── student-rbac-guardrails.test.ts
│   └── teacher-rbac-guardrails.test.ts
├── integration/                           # Tier 3: Operational APIs & Workflows
│   ├── reception-attendance-api.test.ts
│   ├── ai-exam-workflow-api.test.ts
│   └── notification-queue-worker.test.ts
└── e2e/                                   # Tier 4: Playwright Browser & Layout
    ├── arabic-rtl-responsive.spec.ts
    ├── printable-a4-exam.spec.ts
    ├── online-student-exam.spec.ts
    └── reception-kiosk-flow.spec.ts
```

---

## 8. Concrete Test Suite Specifications (Code Blueprints)

### 8.1 Tier 1: Unit Test Blueprint (`compensation-center-subscription.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCenterSubscriptionCompensation, SessionAttendanceRecord } from '@/lib/domain/compensation';

describe('Tier 1: Center Subscription Compensation Engine', () => {
  it('AC-1.1: calculates exactly 260 EGP for 4 classes [12, 15, 11, 14] at rate 20 EGP', () => {
    const sessions: SessionAttendanceRecord[] = [
      { sessionId: 's1', sessionStatus: 'completed', validAttendanceCount: 12 },
      { sessionId: 's2', sessionStatus: 'completed', validAttendanceCount: 15 },
      { sessionId: 's3', sessionStatus: 'completed', validAttendanceCount: 11 },
      { sessionId: 's4', sessionStatus: 'completed', validAttendanceCount: 14 },
    ];
    const rate = 20;

    const result = calculateCenterSubscriptionCompensation(sessions, rate);

    expect(result.conductedSessionsCount).toBe(4);
    expect(result.totalValidAttendance).toBe(52);
    expect(result.averageAttendance).toBe(13);
    expect(result.compensationAmount).toBe(260.00);
  });

  it('AC-1.2: excludes canceled and postponed sessions from both numerator and denominator', () => {
    const sessions: SessionAttendanceRecord[] = [
      { sessionId: 's1', sessionStatus: 'completed', validAttendanceCount: 12 },
      { sessionId: 's2', sessionStatus: 'completed', validAttendanceCount: 15 },
      { sessionId: 's3', sessionStatus: 'completed', validAttendanceCount: 11 },
      { sessionId: 's4', sessionStatus: 'completed', validAttendanceCount: 14 },
      { sessionId: 's5', sessionStatus: 'canceled', validAttendanceCount: 0 },
      { sessionId: 's6', sessionStatus: 'postponed', validAttendanceCount: 0 },
    ];
    const rate = 20;

    const result = calculateCenterSubscriptionCompensation(sessions, rate);

    expect(result.conductedSessionsCount).toBe(4);
    expect(result.excludedSessionsCount).toBe(2);
    expect(result.compensationAmount).toBe(260.00);
  });

  it('AC-1.3: returns 0 without error when zero sessions conducted (division-by-zero protection)', () => {
    const sessions: SessionAttendanceRecord[] = [
      { sessionId: 's1', sessionStatus: 'canceled', validAttendanceCount: 0 },
      { sessionId: 's2', sessionStatus: 'canceled', validAttendanceCount: 0 },
    ];
    const rate = 20;

    const result = calculateCenterSubscriptionCompensation(sessions, rate);

    expect(result.conductedSessionsCount).toBe(0);
    expect(result.averageAttendance).toBe(0);
    expect(result.compensationAmount).toBe(0);
    expect(result.excludedSessionsCount).toBe(2);
  });
});
```

### 8.2 Tier 1: Unit Test Blueprint (`compensation-private-lessons.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { calculatePrivateLessonsSplit, PrivateLessonItem } from '@/lib/domain/compensation';

describe('Tier 1: Private Lessons Revenue Split Engine', () => {
  it('AC-2.1: splits 100 EGP price with 70/30 split into exactly 70 EGP / 30 EGP', () => {
    const items: PrivateLessonItem[] = [
      { enrollmentId: 'e1', studentId: 'std1', totalPrice: 100, discount: { type: 'none', value: 0 }, collectedAmount: 100 },
    ];

    const result = calculatePrivateLessonsSplit(items, 70);

    expect(result.totalNetRevenue).toBe(100.00);
    expect(result.totalTeacherShare).toBe(70.00);
    expect(result.totalCenterShare).toBe(30.00);
    expect(result.roundingLeakage).toBe(0);
  });

  it('AC-2.2: splits 100 EGP with 20% discount into exactly 56 EGP / 24 EGP', () => {
    const items: PrivateLessonItem[] = [
      { enrollmentId: 'e1', studentId: 'std1', totalPrice: 100, discount: { type: 'percentage', value: 20 }, collectedAmount: 80 },
    ];

    const result = calculatePrivateLessonsSplit(items, 70);

    expect(result.totalDiscountAmount).toBe(20.00);
    expect(result.totalNetRevenue).toBe(80.00);
    expect(result.totalTeacherShare).toBe(56.00);
    expect(result.totalCenterShare).toBe(24.00);
    expect(result.roundingLeakage).toBe(0);
  });

  it('AC-2.3: splits 100% free enrollment into exactly 0 EGP / 0 EGP', () => {
    const items: PrivateLessonItem[] = [
      { enrollmentId: 'e1', studentId: 'std1', totalPrice: 100, discount: { type: 'free', value: 0 }, collectedAmount: 0 },
    ];

    const result = calculatePrivateLessonsSplit(items, 70);

    expect(result.totalDiscountAmount).toBe(100.00);
    expect(result.totalNetRevenue).toBe(0.00);
    expect(result.totalTeacherShare).toBe(0.00);
    expect(result.totalCenterShare).toBe(0.00);
    expect(result.roundingLeakage).toBe(0);
  });

  it('AC-2.4: guarantees zero rounding leakage across fractional batches', () => {
    const items: PrivateLessonItem[] = [
      { enrollmentId: 'e1', studentId: 'std1', totalPrice: 33.33, discount: { type: 'none', value: 0 }, collectedAmount: 33.33 },
      { enrollmentId: 'e2', studentId: 'std2', totalPrice: 77.77, discount: { type: 'fixed', value: 12.50 }, collectedAmount: 65.27 },
    ];

    const result = calculatePrivateLessonsSplit(items, 70);

    expect(result.totalTeacherShare + result.totalCenterShare).toBe(result.totalNetRevenue);
    expect(result.roundingLeakage).toBe(0);
  });
});
```

### 8.3 Tier 2: RBAC & Security Integration Blueprint (`student-rbac-guardrails.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '@/tests/helpers/app-harness';

describe('Tier 2: Student Security Guardrails & Field Immutability', () => {
  it('AC-4: allows student to successfully update their own profile picture', async () => {
    const app = await createTestApp();
    const studentAuthHeader = await app.authenticateAs('student', { studentId: 'std-1001' });

    const response = await request(app)
      .patch('/api/student/profile/avatar')
      .set('Authorization', studentAuthHeader)
      .send({ avatarUrl: 'https://cdn.yallacenter.com/avatars/std-1001-new.png' });

    expect(response.status).toBe(200);
    expect(response.body.avatarUrl).toBe('https://cdn.yallacenter.com/avatars/std-1001-new.png');
  });

  it('AC-5.1: rejects student attempting to update their name with HTTP 403 Forbidden', async () => {
    const app = await createTestApp();
    const studentAuthHeader = await app.authenticateAs('student', { studentId: 'std-1001' });

    const response = await request(app)
      .patch('/api/student/profile')
      .set('Authorization', studentAuthHeader)
      .send({ fullName: 'Malicious Name Modification' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('FORBIDDEN');
  });

  it('AC-5.2: rejects student attempting to modify student code, grade, or balance with HTTP 403', async () => {
    const app = await createTestApp();
    const studentAuthHeader = await app.authenticateAs('student', { studentId: 'std-1001' });

    const response = await request(app)
      .patch('/api/student/profile')
      .set('Authorization', studentAuthHeader)
      .send({ studentCode: 'STD-9999', gradeId: 'grade-new', financialBalance: 0 });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('FORBIDDEN');
  });
});
```

### 8.4 Tier 3: Reception Attendance Idempotency Blueprint (`reception-attendance-idempotency.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '@/tests/helpers/app-harness';

describe('Tier 3: Fast Reception Attendance Idempotency', () => {
  it('AC-7: scanning a student code twice in the same session records exactly one record', async () => {
    const app = await createTestApp();
    const receptionistAuth = await app.authenticateAs('receptionist', { centerSlug: 'cairo-main' });
    const payload = { sessionId: 'session-physics-101', studentCode: 'STD-1049' };

    // First scan
    const firstResponse = await request(app)
      .post('/api/center/cairo-main/attendance/scan')
      .set('Authorization', receptionistAuth)
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.status).toBe('success');
    expect(firstResponse.body.duplicate).toBe(false);

    // Immediate second duplicate scan
    const secondResponse = await request(app)
      .post('/api/center/cairo-main/attendance/scan')
      .set('Authorization', receptionistAuth)
      .send(payload);

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.duplicate).toBe(true);
    expect(secondResponse.body.message).toContain('تم تسجيل الحضور مسبقاً');

    // Verify database row count in session_attendance table is exactly 1
    const recordCount = await app.db('session_attendance')
      .where({ session_id: 'session-physics-101', student_code: 'STD-1049' })
      .count();

    expect(Number(recordCount[0].count)).toBe(1);
  });
});
```

### 8.5 Tier 4: Playwright A4 Printable Exam Blueprint (`printable-a4-exam.spec.ts`)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Tier 4: Branded Printable A4 Exam Layout & KaTeX', () => {
  test('AC-9: renders logo top-left, teacher top-right, student inputs, and KaTeX equations', async ({ page }) => {
    await page.goto('/center/cairo-main/exams/exam-physics-term1/print-preview');
    await page.waitForLoadState('networkidle');

    // 1. Verify Official Logo is positioned top-left in the header
    const logo = page.locator('[data-testid="print-header-logo"]');
    await expect(logo).toBeVisible();
    const logoBox = await logo.boundingBox();

    // 2. Verify Teacher Name is positioned top-right in the header
    const teacherName = page.locator('[data-testid="print-header-teacher"]');
    await expect(teacherName).toBeVisible();
    await expect(teacherName).toContainText('أستاذ /');
    const teacherBox = await teacherName.boundingBox();

    // Top-left vs Top-right spatial verification (in RTL document, logo is on the left X < teacher X)
    expect(logoBox!.x).toBeLessThan(teacherBox!.x);

    // 3. Verify Student Name and Code input fields exist
    const studentNameField = page.locator('[data-testid="print-student-name"]');
    const studentCodeField = page.locator('[data-testid="print-student-code"]');
    await expect(studentNameField).toBeVisible();
    await expect(studentCodeField).toBeVisible();

    // 4. Verify KaTeX equations rendered correctly
    const katexFormula = page.locator('.katex-display, .katex');
    await expect(katexFormula.first()).toBeVisible();
    // Verify no raw LaTeX text leakage (e.g. raw \frac without rendering)
    const rawLatex = page.locator('text=\\frac');
    await expect(rawLatex).toHaveCount(0);
  });
});
```

---

## 9. Recommendations & Implementation Handoff Contracts

1. **Precision Currency Library**: Implement `Decimal` or scaled piastres (`integer`) for all financial operations to eliminate floating-point drift across both compensation models.
2. **Database Level Idempotency**: Rely strictly on PostgreSQL `UNIQUE (session_id, student_id)` and `ON CONFLICT ... RETURNING (xmax = 0)` rather than application-only locks.
3. **Strict Validation Middleware**: Enforce preflight document check (`validateExamGenerationPreflight`) in the Next.js API route before any AI provider API calls are made.
4. **Sandboxed Notifications by Default**: Ensure `NotificationDispatcher` defaults to local `simulated_delivered` logging if `WHATSAPP_CLOUD_API_TOKEN` is unset or integrity mode is `demo`.
5. **Testing Track Execution**: Ensure Vitest and Playwright configurations are established early in the development cycle to provide continuous validation against acceptance criteria AC-1 through AC-10.
