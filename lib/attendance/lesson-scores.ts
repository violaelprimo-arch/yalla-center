import type { UserRole } from '@/lib/dal/types';

export interface LessonExamRecord {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  groupId: string;
  subjectId?: string;
  subjectNameAr?: string;
  teacherId: string;
  title: string;
  totalMarks: number;
  passMarks: number;
  version: number;
  updatedByUid: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedAt: string;
  createdAt: string;
}

export interface LessonGradeRecord {
  id: string; // deterministic: ${examId}_${studentId}
  tenantId: string;
  branchId: string;
  sessionId: string;
  groupId: string;
  teacherId: string;
  examId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  score: number;
  totalMarksSnapshot: number;
  version: number;
  recordedByUid: string;
  recordedByName: string;
  recordedByRole: UserRole;
  source: 'panel' | 'feed' | 'card' | 'localStorage_import';
  updatedAt: string;
  createdAt: string;
}

export type LessonGradeAuditAction =
  | 'exam_create'
  | 'exam_max_marks_update'
  | 'grade_create'
  | 'grade_update'
  | 'grade_delete'
  | 'local_import';

export interface LessonGradeAuditEntry {
  id: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  groupId: string;
  teacherId: string;
  examId: string;
  studentId?: string;
  action: LessonGradeAuditAction;
  actorUid: string;
  actorEmail?: string;
  actorName: string;
  actorRole: UserRole;
  previousScore: number | null;
  newScore: number | null;
  previousTotalMarks?: number | null;
  newTotalMarks?: number | null;
  source: 'panel' | 'feed' | 'card' | 'localStorage_import' | 'api';
  timestamp: string;
}

export interface LocalStorageGradeCandidate {
  storageKey: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  examId: string;
  score: number;
}

export const GRADE_EDITOR_ROLES: ReadonlySet<UserRole> = new Set([
  'PLATFORM_OWNER',
  'CENTER_ADMIN',
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'TEACHER',
]);

export function lessonGradeDocId(examId: string, studentId: string): string {
  const cleanExam = examId.trim();
  const cleanStudent = studentId.trim();
  if (!cleanExam || !cleanStudent || cleanExam.includes('/') || cleanStudent.includes('/')) {
    throw new Error('معرف الاختبار أو الطالب غير صالح');
  }
  return `${cleanExam}_${cleanStudent}`;
}

export function normalizeScoreDigits(raw: string): string {
  return raw
    .trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٫,]/g, '.');
}

export function parseLessonScore(
  raw: string,
  totalMarks: number
): { ok: true; value: number } | { ok: false; errorAr: string } {
  const normalized = normalizeScoreDigits(raw);
  if (!normalized) {
    return { ok: false, errorAr: 'أدخل درجة الطالب قبل الحفظ' };
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, errorAr: 'أدخل قيمة رقمية صالحة للدرجة' };
  }
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, errorAr: 'يُسمح بمنزلتين عشريتين كحد أقصى' };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, errorAr: 'لا يمكن أن تقل الدرجة عن 0' };
  }
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
    return { ok: false, errorAr: 'يجب تحديد الدرجة النهائية للاختبار أولاً' };
  }
  if (value > totalMarks) {
    return {
      ok: false,
      errorAr: `الدرجة (${formatCleanNumber(value)}) تتجاوز الدرجة النهائية للاختبار (${formatCleanNumber(totalMarks)})`,
    };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export function parseTotalMarksInput(
  raw: string
): { ok: true; value: number } | { ok: false; errorAr: string } {
  const normalized = normalizeScoreDigits(raw);
  if (!normalized) {
    return { ok: false, errorAr: 'أدخل الدرجة النهائية للاختبار' };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, errorAr: 'أدخل رقمًا صالحًا للدرجة النهائية (بحد أقصى منزلتين عشريتين)' };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, errorAr: 'يجب أن تكون الدرجة النهائية أكبر من صفر' };
  }
  if (value > 1000) {
    return { ok: false, errorAr: 'الدرجة النهائية يجب ألا تتجاوز 1000' };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export function formatCleanNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function formatLessonScoreFraction(
  score: number | undefined | null,
  totalMarks?: number
): string {
  if (score === undefined || score === null || !Number.isFinite(score)) {
    return 'لم تُرصد';
  }
  const scoreStr = formatCleanNumber(score);
  if (!totalMarks || !Number.isFinite(totalMarks) || totalMarks <= 0) {
    return scoreStr;
  }
  return `${scoreStr} / ${formatCleanNumber(totalMarks)}`;
}

export function scanLocalStorageReceptionGrades(tenantId: string): LocalStorageGradeCandidate[] {
  if (typeof window === 'undefined') return [];
  const storage = window.localStorage ?? globalThis.localStorage;
  if (!storage || typeof storage.length !== 'number') return [];

  const results: LocalStorageGradeCandidate[] = [];
  for (let idx = 0; idx < storage.length; idx += 1) {
    const key = storage.key(idx);
    if (!key || !key.startsWith('yc-reception:')) continue;
    try {
      const parsedTuple = JSON.parse(key.slice('yc-reception:'.length));
      if (!Array.isArray(parsedTuple) || parsedTuple.length !== 3) continue;
      const [recordTenantId, sessionId, studentId] = parsedTuple;
      if (recordTenantId !== tenantId || typeof sessionId !== 'string' || typeof studentId !== 'string') {
        continue;
      }
      const rawValue = storage.getItem(key);
      if (!rawValue) continue;
      const parsedRecord = JSON.parse(rawValue) as { grades?: Record<string, unknown> };
      if (!parsedRecord || typeof parsedRecord.grades !== 'object' || !parsedRecord.grades) continue;
      for (const [examId, rawScore] of Object.entries(parsedRecord.grades)) {
        if (typeof rawScore === 'number' && Number.isFinite(rawScore) && rawScore >= 0) {
          results.push({
            storageKey: key,
            tenantId,
            sessionId,
            studentId,
            examId,
            score: Math.round(rawScore * 100) / 100,
          });
        }
      }
    } catch {
      // Ignore malformed unrelated keys cleanly
    }
  }
  return results;
}
