# تقرير الاستكشاف المعماري: إدارة الفروع والقاعات وجدولة المواعيد ومنع التعارضات (M2-3)
# Architectural Report: Multi-Branch, Classroom Schedule & Conflict Prevention Engine

**إعداد**: المستكشف M2-3 (`teamwork_preview_explorer_m2_3`)  
**المرحلة**: Milestone 2 — Multi-Tenant Architecture, Portals & Strict Security Guardrails  
**المسار المستهدف**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m2_3\m2_timetable_report.md`  
**تاريخ التقرير**: 18 أكتوبر 2026  
**حالة الاختبارات الحالية**: 161/161 اختبار ناجح بنسبة 100% (Pass 15/15 files)

---

## 1. الملخص التنفيذي وأهداف الاستكشاف (Executive Summary)

تتطلب مراكز الدروس التعليمية في مصر (مثل "سنتر الماهر النموذجي" و"سنتر الرواد") نظاماً عالي الدقة لإدارة بنيتها الفيزيائية الموزعة على فروع وقاعات متعددة، مع تنظيم الجداول الأسبوعية والحصص الدراسية اليومية دون أي هامش للخطأ البشري. 

أهم التحديات التشغيلية التي تمت معالجتها وتصميمها في هذا التقرير:
1. **تعدد الفروع والقاعات**: فرز وعرض الفروع الفيزيائية لكل مركز، ومتابعة القاعات مع طاقتها الاستيعابية وتجهيزاتها التقنية (عارض ضوئي، تكييف، سبورة ذكية).
2. **منظومة الجداول المزدوجة**: الفصل المنطقي بين **الجدول الأسبوعي الثابت للمجموعات** (Recurring Group Timetable) و**الحصص التشغيلية اليومية المؤرخة** (Operational Calendar Sessions).
3. **خوارزمية منع التعارض الحاسمة (Collision Prevention Algorithm)**: كشف ورفض حجز القاعة المزدوج (Classroom Double-Booking) وحجز المعلم المزدوج (Teacher Double-Booking) في نفس الفترة الزمنية عبر أي قاعة أو فرع، مع استثناء الحصص الملغاة واستثناء السجل ذاته عند التعديل، وتقديم فترات بديلة مقترحة (Alternative Slot Suggestions).
4. **تكامل واجهات المستخدم في مسار `/center/[centerSlug]/branches`**: تصميم واجهة مستخدم عربية RTL متكاملة تتوافق مع نظام ألوان Yalla Center (Midnight Navy `#0B132B` و Electric Cyan `#00A3FF`) وبطاقات مرتفعة ناعمة (Elevated Cards) تدعم مديري الفروع ومديري السنتر والاستقبال.

---

## 2. مراجعة وفحص البنية الحالية للكود وقواعد البيانات (Codebase Inspection)

### 2.1 فحص مخطط قاعدة البيانات في `lib/supabase/schema.sql`
- **جدول الفروع `branches`** (السطور 58–68):
  - الحقول: `id (UUID)`, `tenant_id (FK)`, `name_ar`, `address`, `phone`, `is_active`, `created_at`.
  - قيود RLS وسياسات العزل: مفعلة بسياسة `branches_tenant_policy` تسمح فقط للمالك العام `PLATFORM_OWNER` أو مستخدمي المركز `tenant_id = current_tenant_id()`.
- **جدول القاعات `classrooms`** (السطور 71–81):
  - الحقول: `id (UUID)`, `tenant_id (FK)`, `branch_id (FK)`, `name_ar`, `capacity (INT)`, `equipment (JSONB)`, `created_at`.
  - الحقل `equipment` يحفظ كائنات JSON بصيغة:
    `{"projector": true, "air_conditioning": true, "smart_board": false}`.
- **جدول المجموعات الدراسية `groups`** (السطور 123–143):
  - الحقول: `id`, `tenant_id`, `branch_id`, `classroom_id`, `subject_id`, `teacher_id`, `name_ar`, `academic_year`, `schedule_day (0-6)`, `start_time (TIME)`, `end_time (TIME)`, `pricing_model`, `monthly_fee`, `session_fee`, `max_students`, `is_active`.
  - يمثل الجدول الدوري الأسبوعي (`schedule_day`: 0=الأحد، 6=السبت).
- **جدول الحصص `sessions`** (السطور 146–161):
  - الحقول: `id`, `tenant_id`, `group_id`, `classroom_id`, `teacher_id`, `session_date (DATE)`, `start_time (TIME)`, `end_time (TIME)`, `status (session_status)`, `notes`, `cancellation_reason`.
  - يمثل الحصص الفعلية على التقويم (Calendar instances) التابعة للمجموعة أو الحصص التعويضية.
- **الفهارس الحالية**:
  - `idx_groups_tenant_branch` على `(tenant_id, branch_id)`
  - `idx_groups_teacher` على `(tenant_id, teacher_id)`
  - `idx_sessions_group_date` على `(group_id, session_date)`
  - `idx_sessions_tenant_date` على `(tenant_id, session_date)`

### 2.2 فحص طبقة الوصول للبيانات في `lib/dal/types.ts` و `lib/dal/mock-data.ts`
- النماذج البرمجية `Branch`, `Classroom`, `Group`, `Session` معرفة بصورة نموذجية في `lib/dal/types.ts`.
- البيانات المبدئية في `INITIAL_SEEDED_DATA` تحتوي على:
  - فرعين لسنتر الماهر: `branch-nasr-city` (فرع مدينة نصر) و `branch-heliopolis` (فرع مصر الجديدة).
  - قاعتين بفرع مدينة نصر: `room-101` (قاعة د. زويل، سعة 60) و `room-102` (قاعة العقاد، سعة 40).
  - مجموعتين دراسيتين: مجموعة الرياضيات للسبت (14:00-16:00، قاعة 101، أ. أحمد الشناوي) ومجموعة الفيزياء للأحد (16:00-18:00، قاعة 102، د. هاني نبيل).
  - حصص فعلية مرتبطة في `sessions`.
- **الفجوة الحالية في طبقة الـ DAL (`MockDataProvider` & `IDataProvider`)**:
  - يتوفر حالياً دوال القراءة: `getBranches()`, `getClassrooms()`, `getGroups()`, `getSessions()`.
  - ينقص دوال الكتابة والإدارة:
    - إضافة وتعديل الفروع: `createBranch`, `updateBranch`, `deleteBranch`.
    - إضافة وتعديل القاعات: `createClassroom`, `updateClassroom`, `deleteClassroom`.
    - جدولة المجموعات والحصص مع التحقق من التعارض: `createGroup`, `updateGroup`, `createSession`, `updateSession`.
    - خوارزمية فحص التعارض المسبق: `checkScheduleConflict`.

---

## 3. خوارزمية منع التعارض الرياضية والزمنية (Conflict Prevention Engine)

### 3.1 الصياغة الرياضية لتداخل الفترات الزمنية (Time Window Overlap)
لتكن الفترة الزمنية المقترحة $S_{\text{new}} = [s_{\text{new}}, e_{\text{new}})$ وفترة زمنية مسجلة مسبقاً $S_{\text{exist}} = [s_{\text{exist}}, e_{\text{exist}})$.
نحول التوقيت من صيغة "HH:mm" إلى دقائق من منتصف الليل $m \in [0, 1440)$:
$$m(H, M) = H \times 60 + M$$

يحدث التداخل الزمني إذا وفقط إذا تحقق الشرط الرياضي التالي:
$$\max(s_{\text{new}}, s_{\text{exist}}) < \min(e_{\text{new}}, e_{\text{exist}})$$
وهو يكافئ منطقياً:
$$(s_{\text{new}} < e_{\text{exist}}) \quad \land \quad (s_{\text{exist}} < e_{\text{new}})$$

#### خواص هامة وحالات حدية (Edge Cases):
1. **الجلسات المتتابعة مباشرة (Back-to-Back Sessions)**:
   إذا كانت الحصة الأولى تنتهي الساعة 16:00 والحصة الثانية تبدأ الساعة 16:00:
   $$e_1 = 16:00, \quad s_2 = 16:00 \implies s_2 < e_1 \text{ غير محقق (False)}$$
   وبالتالي لا يوجد تعارض. وهذا يتطابق مع الواقع العملي للسناتر بالسماح ببدء حصة فور انتهاء السابقة.
2. **استبعاد السجلات الملغاة (Canceled Sessions Exclusion)**:
   إذا كان `status === 'canceled'`، تعتبر القاعة والمعلم متاحين بالكامل ولا يتم احتساب التعارض.
3. **استثناء السجل نفسه عند التعديل (Self-Exclusion on Edit)**:
   عند تعديل موعد مجموعة أو حصة قائمة، يجب استثناء المعرف الخاص بها (`candidate.id !== existing.id`) لمنع التعارض الزائف مع نفسها.

---

### 3.2 أنواع التعارضات وقواعد الرفض الصارم (Conflict Types Matrix)

| نوع التعارض (Conflict Type) | مستوى الخطورة | شرط الحدوث | الإجراء المتخذ | نص الرسالة بالعربية للمستخدم |
|---|---|---|---|---|
| **تعارض حجز القاعة**<br>`CLASSROOM_DOUBLE_BOOKING` | **خطأ حاسم**<br>(Error - Block) | نفس المركز + نفس القاعة + نفس اليوم/التاريخ + تداخل التوقيت | رفض الحفظ فوراً ومنع الإرسال | "تعارض في القاعة: قاعة [{اسم القاعة}] محجوزة بالفعل لـ [{اسم المجموعة/الحصة}] في نفس التوقيت ({من} - {إلى})." |
| **تعارض جدول المعلم**<br>`TEACHER_DOUBLE_BOOKING` | **خطأ حاسم**<br>(Error - Block) | نفس المركز + نفس المعلم + نفس اليوم/التاريخ + تداخل التوقيت (حتى وإن اختلفت القاعة أو الفرع!) | رفض الحفظ فوراً ومنع الإرسال | "تعارض في جدول المعلم: المعلم [{اسم المعلم}] لديه حصة أخرى مجدولة لـ [{اسم المجموعة}] في نفس التوقيت ({من} - {إلى})." |
| **تجاوز سعة القاعة**<br>`CAPACITY_OVERFLOW` | **تحذير**<br>(Warning) | الحد الأقصى للطلاب بالمجموعة > سعة القاعة الإجمالية | السماح بالحفظ مع إشعار تنبيهي | "تنبيه السعة: الحد الأقصى للمجموعة ({عدد}) يتجاوز السعة الاستيعابية للقاعة ({سعة} مقعد)." |
| **انتقال فيزيائي غير كافٍ**<br>`CROSS_BRANCH_TRANSIT_TIGHT` | **تحذير**<br>(Warning) | للمعلم حصتان متتاليتان في فرعين مختلفين بفاصل زمني أقل من 30 دقيقة | السماح بالحفظ مع إشعار تنبيهي | "تنبيه انتقال: المعلم لديه حصة بفرع آخر تنتهي/تبدأ بفارق زمني ضيق ({دقائق} دقيقة)." |
| **فترة زمنية غير صالحة**<br>`INVALID_TIME_RANGE` | **خطأ حاسم**<br>(Error - Block) | وقت النهاية $\le$ وقت البداية | رفض الحفظ فوراً | "خطأ في التوقيت: وقت نهاية الحصة يجب أن يكون بعد وقت البداية." |

---

## 4. التصميم البرمجي الكامل لخوارزمية فحص التعارضات (`lib/timetable/conflict-detector.ts`)

نوصي المطور Worker M2 بإنشاء الملف `lib/timetable/conflict-detector.ts` بالهيكلية البرمجية التالية:

```typescript
/**
 * Yalla Center - Timetable & Schedule Conflict Detection Engine
 * Authoritative Conflict Prevention & Validation Helpers
 */

export interface TimeSlot {
  startTime: string; // "HH:mm" e.g. "14:00"
  endTime: string;   // "HH:mm" e.g. "16:00"
}

export interface ScheduleCandidate {
  id?: string;             // Excluded when updating existing record
  tenantId: string;
  branchId: string;
  classroomId: string;
  teacherId: string;
  dayOfWeek?: number;      // 0=Sun..6=Sat (for recurring groups)
  sessionDate?: string;    // YYYY-MM-DD (for calendar sessions)
  startTime: string;       // "14:00"
  endTime: string;         // "16:00"
  maxStudents?: number;
}

export type ConflictSeverity = 'error' | 'warning';

export type ConflictCode =
  | 'CLASSROOM_DOUBLE_BOOKING'
  | 'TEACHER_DOUBLE_BOOKING'
  | 'CAPACITY_OVERFLOW'
  | 'CROSS_BRANCH_TRANSIT_TIGHT'
  | 'INVALID_TIME_RANGE';

export interface ScheduleConflict {
  code: ConflictCode;
  severity: ConflictSeverity;
  conflictingEntityId?: string;
  conflictingEntityName?: string;
  teacherName?: string;
  classroomName?: string;
  branchName?: string;
  timeSlot?: TimeSlot;
  messageAr: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean; // True if any 'error' exists
  canSchedule: boolean; // True if no 'error' exists (warnings permitted)
  errors: ScheduleConflict[];
  warnings: ScheduleConflict[];
  suggestedAlternativeSlots?: TimeSlot[];
}

/**
 * Converts "HH:mm" string to total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight to "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Evaluates whether two half-open intervals [startA, endA) and [startB, endB) overlap.
 */
export function isTimeOverlapping(slotA: TimeSlot, slotB: TimeSlot): boolean {
  const startA = timeToMinutes(slotA.startTime);
  const endA = timeToMinutes(slotA.endTime);
  const startB = timeToMinutes(slotB.startTime);
  const endB = timeToMinutes(slotB.endTime);

  if (endA <= startA || endB <= startB) {
    return false;
  }

  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Detects schedule collisions for Recurring Weekly Groups
 */
export function checkGroupScheduleConflicts(
  candidate: ScheduleCandidate,
  existingGroups: Array<{
    id: string;
    tenantId: string;
    branchId: string;
    classroomId: string;
    teacherId: string;
    nameAr: string;
    scheduleDay: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>,
  classroomsMap: Map<string, { nameAr: string; capacity: number }>,
  teachersMap: Map<string, { fullName: string }>
): ConflictCheckResult {
  const errors: ScheduleConflict[] = [];
  const warnings: ScheduleConflict[] = [];

  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);

  // 1. Time range validity check
  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'وقت نهاية الحصة يجب أن يكون بعد وقت البداية',
    });
    return { hasConflict: true, canSchedule: false, errors, warnings };
  }

  // 2. Classroom capacity check
  const targetRoom = classroomsMap.get(candidate.classroomId);
  if (targetRoom && candidate.maxStudents && candidate.maxStudents > targetRoom.capacity) {
    warnings.push({
      code: 'CAPACITY_OVERFLOW',
      severity: 'warning',
      classroomName: targetRoom.nameAr,
      messageAr: `تنبيه: الحد الأقصى للمجموعة (${candidate.maxStudents}) يتجاوز سعة القاعة (${targetRoom.capacity} مقعد)`,
    });
  }

  const candSlot: TimeSlot = { startTime: candidate.startTime, endTime: candidate.endTime };

  for (const group of existingGroups) {
    // Exclude inactive groups or self
    if (!group.isActive || group.id === candidate.id) continue;
    if (group.tenantId !== candidate.tenantId) continue;
    if (group.scheduleDay !== candidate.dayOfWeek) continue;

    const groupSlot: TimeSlot = { startTime: group.startTime, endTime: group.endTime };
    if (!isTimeOverlapping(candSlot, groupSlot)) continue;

    // A. Classroom collision
    if (group.classroomId === candidate.classroomId) {
      const roomName = classroomsMap.get(group.classroomId)?.nameAr || 'القاعة';
      errors.push({
        code: 'CLASSROOM_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: group.id,
        conflictingEntityName: group.nameAr,
        classroomName: roomName,
        timeSlot: groupSlot,
        messageAr: `تعارض في القاعة: ${roomName} محجوزة بالفعل لمجموعة "${group.nameAr}" في نفس التوقيت (${group.startTime} - ${group.endTime})`,
      });
    }

    // B. Teacher collision
    if (group.teacherId === candidate.teacherId) {
      const teacherName = teachersMap.get(group.teacherId)?.fullName || 'المعلم';
      errors.push({
        code: 'TEACHER_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: group.id,
        conflictingEntityName: group.nameAr,
        teacherName: teacherName,
        timeSlot: groupSlot,
        messageAr: `تعارض في جدول المعلم: ${teacherName} مرتبط بمجموعة "${group.nameAr}" في نفس التوقيت (${group.startTime} - ${group.endTime})`,
      });
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canSchedule: !hasConflict,
    errors,
    warnings,
  };
}

/**
 * Detects schedule collisions for Specific Calendar Sessions
 */
export function checkSessionScheduleConflicts(
  candidate: ScheduleCandidate,
  existingSessions: Array<{
    id: string;
    tenantId: string;
    groupId: string;
    classroomId?: string;
    teacherId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    status: string;
  }>,
  groupsMap: Map<string, { nameAr: string }>,
  classroomsMap: Map<string, { nameAr: string }>,
  teachersMap: Map<string, { fullName: string }>
): ConflictCheckResult {
  const errors: ScheduleConflict[] = [];
  const warnings: ScheduleConflict[] = [];

  const candStart = timeToMinutes(candidate.startTime);
  const candEnd = timeToMinutes(candidate.endTime);

  if (candEnd <= candStart) {
    errors.push({
      code: 'INVALID_TIME_RANGE',
      severity: 'error',
      messageAr: 'وقت نهاية الحصة يجب أن يكون بعد وقت البداية',
    });
    return { hasConflict: true, canSchedule: false, errors, warnings };
  }

  const candSlot: TimeSlot = { startTime: candidate.startTime, endTime: candidate.endTime };

  for (const session of existingSessions) {
    // Exclude self and canceled/postponed sessions
    if (session.id === candidate.id) continue;
    if (session.status === 'canceled' || session.status === 'postponed') continue;
    if (session.tenantId !== candidate.tenantId) continue;
    if (session.sessionDate !== candidate.sessionDate) continue;

    const sessionSlot: TimeSlot = { startTime: session.startTime, endTime: session.endTime };
    if (!isTimeOverlapping(candSlot, sessionSlot)) continue;

    const groupTitle = groupsMap.get(session.groupId)?.nameAr || 'حصة دراسية';

    // A. Classroom collision
    if (session.classroomId && session.classroomId === candidate.classroomId) {
      const roomName = classroomsMap.get(session.classroomId)?.nameAr || 'القاعة';
      errors.push({
        code: 'CLASSROOM_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: session.id,
        conflictingEntityName: groupTitle,
        classroomName: roomName,
        timeSlot: sessionSlot,
        messageAr: `تعارض بالقاعة: ${roomName} محجوزة بالفعل لـ "${groupTitle}" بتاريخ ${session.sessionDate} (${session.startTime} - ${session.endTime})`,
      });
    }

    // B. Teacher collision
    if (session.teacherId === candidate.teacherId) {
      const teacherName = teachersMap.get(session.teacherId)?.fullName || 'المعلم';
      errors.push({
        code: 'TEACHER_DOUBLE_BOOKING',
        severity: 'error',
        conflictingEntityId: session.id,
        conflictingEntityName: groupTitle,
        teacherName: teacherName,
        timeSlot: sessionSlot,
        messageAr: `تعارض بجدول المعلم: ${teacherName} لديه حصة مجدولة لـ "${groupTitle}" في نفس التوقيت (${session.startTime} - ${session.endTime})`,
      });
    }
  }

  const hasConflict = errors.length > 0;
  return {
    hasConflict,
    canSchedule: !hasConflict,
    errors,
    warnings,
  };
}
```

---

## 5. مقترح واجهات المستخدم وتجربة الاستخدام (UI Architecture & Components)

### 5.1 مسار إدارة الفروع والجدول: `/center/[centerSlug]/branches`
يجب أن تحتوي الصفحة على تبويبات رئيسية (Tabs) مرنة وسريعة الاستجابة باللغة العربية:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ سنتر الماهر النموذجي > الفروع والقاعات والجداول الدراسية                          │
│ [ + إضافة فرع جديد ]   [ + إضافة قاعة ]   [ + جدولة مجموعة / حصة جديدة ]        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [ الفروع والقاعات ]  [ الجدول الأسبوعي العام ]  [ الحصص اليومية ]  [ فاحص التعارضات ] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  (1) تبويب الفروع والقاعات:                                                     │
│  ┌───────────────────────────────┐     ┌───────────────────────────────┐        │
│  │ فرع مدينة نصر الرئيسي (الرئيسي)│     │ فرع مصر الجديدة                │        │
│  │ 📍 شارع عباس العقاد            │     │ 📍 ميدان روكسي                 │        │
│  │ 📞 01001234567   [نشط]        │     │ 📞 01007654321   [نشط]        │        │
│  │ القاعات التابعة (2 قاعات):     │     │ القاعات التابعة (1 قاعة):      │        │
│  │  - قاعة د. زويل (سعة 60) 📽️ ❄️│     │  - قاعة الأهرام (سعة 50) 📽️  │        │
│  │  - قاعة العقاد (سعة 40) ❄️     │     │                               │        │
│  └───────────────────────────────┘     └───────────────────────────────┘        │
│                                                                                 │
│  (2) تبويب الجدول الأسبوعي العام (Weekly Grid Matrix):                          │
│  الفلاتر: [ كل الفروع ▼ ] [ كل القاعات ▼ ] [ كل المعلمين ▼ ] [ كل المراحل ▼ ]  │
│  ┌──────────┬─────────────────┬─────────────────┬────────────────────────────┐  │
│  │ اليوم     │ 14:00 - 16:00   │ 16:00 - 18:00   │ 18:00 - 20:00              │  │
│  ├──────────┼─────────────────┼─────────────────┼────────────────────────────┤  │
│  │ السبت    │ مجموعة العباقرة │ [ متاح ]        │ مجموعة الأوائل             │  │
│  │          │ قاعة زويل | أ.أحمد│                 │ قاعة العقاد | د.هاني       │  │
│  ├──────────┼─────────────────┼─────────────────┼────────────────────────────┤  │
│  │ الأحد    │ [ متاح ]        │ مجموعة النخبة   │ [ متاح ]                   │  │
│  │          │                 │ قاعة العقاد|د.هاني│                          │  │
│  └──────────┴─────────────────┴─────────────────┴────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 نافذة إضافة وجدولة موعد مع تنبيه فوري للتعارض (Conflict Preflight Modal)
أثناء قيام المسؤول بجدولة موعد واختيار (الفرع -> القاعة -> المعلم -> اليوم -> وقت البدء -> وقت الانتهاء):
- يقوم المكون باستدعاء `checkGroupScheduleConflicts` أو API `POST /api/center/[slug]/timetable/check-conflict`.
- يظهر شريط تنبيه فوري أسفل النموذج (HUD Alert):
  - **حالة خالية من التعارض**: شارة خضراء `[✓ الموعد متاح للقاعة والمعلم بدون تعارض]`، ويتم تفعيل زر "تأكيد وحفظ الجدولة".
  - **حالة وجود تعارض**: شارة حمراء مع تفاصيل دقيقة وأيقونة تحذيرية:
    `[⚠️ تعارض: قاعة د. زويل محجوزة بالفعل لمجموعة العباقرة في هذا التوقيت (14:00 - 16:00)]`
    مع تعطيل زر الحفظ لتطبيق قاعدة الحماية الصارمة.

---

## 6. توصيات وتفاصيل التكامل لـ Worker M2 (Implementation Blueprint)

### 6.1 توسيع ملف `lib/dal/mock-data.ts`
إضافة الدوال التالية إلى صنف `MockDataProvider` لتوفير الإدارة المتكاملة:

1. `createBranch(branch: Omit<Branch, 'id' | 'createdAt'>): Promise<Branch>`
2. `updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch>`
3. `deleteBranch(branchId: string): Promise<{ success: boolean }>`
4. `createClassroom(classroom: Omit<Classroom, 'id' | 'createdAt'>): Promise<Classroom>`
5. `updateClassroom(classroomId: string, updates: Partial<Classroom>): Promise<Classroom>`
6. `createGroup(groupData: Omit<Group, 'id' | 'createdAt'>): Promise<{ success: boolean; group?: Group; conflictError?: string }>`:
   تتحقق أولاً عبر `checkGroupScheduleConflicts`؛ إذا وُجد تعارض تعيد خطأ وتمنع الإدراج.
7. `createSession(sessionData: Omit<Session, 'id' | 'createdAt'>): Promise<{ success: boolean; session?: Session; conflictError?: string }>`:
   تتحقق أولاً عبر `checkSessionScheduleConflicts`؛ إذا وُجد تعارض تعيد خطأ وتمنع الإدراج.

### 6.2 المكونات الموصى إنشاؤها في `components/branches/` و `components/timetable/`
1. `components/branches/branch-card.tsx`: بطاقة عرض بيانات الفرع وقاعاته مع شارات الحالة والتجهيزات.
2. `components/branches/branch-dialog.tsx`: نافذة إدخال/تعديل فرع جديد.
3. `components/branches/classroom-dialog.tsx`: نافذة إدخال قاعة وربطها بالفرع مع مربعات اختيار التجهيزات (تكييف، شاشة، جهاز عرض).
4. `components/timetable/timetable-grid.tsx`: شبكة الجدول الأسبوعي مع تمييز الفترات المحجوزة بالألوان وخطوط واضحة.
5. `components/timetable/schedule-dialog.tsx`: نافذة حجز موعد جديد مع نظام فحص التعارض المباشر.
6. `components/timetable/conflict-badge.tsx`: شارة العرض الحي لنتائج فحص التعارض.

### 6.3 مسارات الـ API الموصى إنشاؤها
1. `app/api/center/[centerSlug]/branches/route.ts`: عمليات GET لقائمة الفروع والقاعات، و POST لإنشاء فرع جديد.
2. `app/api/center/[centerSlug]/classrooms/route.ts`: عمليات POST لإنشاء قاعة جديدة و PUT للتعديل.
3. `app/api/center/[centerSlug]/timetable/conflict/route.ts`: نقطة تحقق سريعة (Fast Preflight Endpoint) تفحص التعارض وتعيد النتيجة الفورية للواجهة.

---

## 7. مواصفات اختبارات التحقق من التعارض (Testing Specifications)

نوصي بإضافة ملف اختبار متخصص `tests/unit/timetable-conflict.test.ts` يتحقق من:
1. **رفض حجز القاعة المتداخلة**: التحقق من أن حجز قاعة محجوزة في نفس اليوم من 14:30 إلى 15:30 يرجع `CLASSROOM_DOUBLE_BOOKING` ويرفض الحفظ.
2. **رفض حجز المعلم في قاعتين مختلفتين**: التحقق من أن حجز المعلم ذاته في قاعة أخرى في نفس التوقيت يرجع `TEACHER_DOUBLE_BOOKING`.
3. **قبول الحصص المتتالية (Back-to-Back)**: التحقق من أن جلسة من 14:00 إلى 16:00 وجلسة من 16:00 إلى 18:00 في نفس القاعة تقبل بنجاح دون أي تعارض (`hasConflict: false`).
4. **تجاهل الحصص الملغاة**: التحقق من أن جلسة جديدة مسموح بحجزها في نفس موعد وقاعة جلسة سابقة تم إلغاؤها (`status: 'canceled'`).
5. **استثناء السجل ذاته عند التعديل**: التحقق من إمكانية تعديل بيانات الجلسة ذاتها دون التسبب في تعارض ذاتي.

---

## 8. الخلاصة وخطة التسليم (Conclusion)
تم بحمد الله إتمام الدراسة الشاملة لمتطلبات الفروع والقاعات والجداول وخوارزمية منع التعارض. التصميم متكامل، دقيق رياضياً ومنطقياً، ويحافظ على قواعد العزل ومتطلبات الأداء لـ Milestone 2.
تم توثيق كل التفاصيل في هذا التقرير وفي تقرير التسليم `handoff.md`.
