import { INITIAL_SEEDED_DATA } from '@/lib/dal/mock-data';
import type {
  Attendance,
  Classroom,
  Enrollment,
  Expense,
  Group,
  Invoice,
  Material,
  Payment,
  Session,
  User,
} from '@/lib/dal/types';
import type { TeacherProfile } from '@/lib/teachers/profile';
import { COLLECTIONS } from './center-operations-service';
import type { FirestoreWriteOperation } from './firestore-rest';
import type { ILessonScoreStore } from './server';

export interface ImportScanSummary {
  studentsCount: number;
  groupsCount: number;
  classroomsCount: number;
  teachersCount: number;
  sessionsCount: number;
  attendanceCount: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
  materialsCount: number;
  totalRecords: number;
}

export interface ImportPayload {
  students?: User[];
  groups?: Group[];
  classrooms?: Classroom[];
  teachers?: TeacherProfile[];
  sessions?: Session[];
  attendance?: Attendance[];
  invoices?: Invoice[];
  payments?: Payment[];
  expenses?: Expense[];
  materials?: Material[];
}

export interface ImportResult {
  success: boolean;
  importedCounts: ImportScanSummary;
  message: string;
}

// Known seed IDs to filter out unless modified
const SEED_STUDENT_IDS = new Set(
  INITIAL_SEEDED_DATA.users.filter((u) => u.role === 'STUDENT').map((u) => u.id)
);
const SEED_GROUP_IDS = new Set(INITIAL_SEEDED_DATA.groups.map((g) => g.id));
const SEED_ROOM_IDS = new Set(INITIAL_SEEDED_DATA.classrooms.map((c) => c.id));
const SEED_SESSION_IDS = new Set(INITIAL_SEEDED_DATA.sessions.map((s) => s.id));
const SEED_INVOICE_IDS = new Set(INITIAL_SEEDED_DATA.invoices.map((i) => i.id));
const SEED_PAYMENT_IDS = new Set(INITIAL_SEEDED_DATA.payments.map((p) => p.id));
const SEED_EXPENSE_IDS = new Set(INITIAL_SEEDED_DATA.expenses.map((e) => e.id));

export function filterImportableRecords<T extends { id: string }>(
  records: T[] | undefined,
  seedIds: Set<string>,
  isCustomCheck?: (item: T) => boolean
): T[] {
  if (!Array.isArray(records)) return [];
  return records.filter((item) => {
    if (!item?.id) return false;
    // Keep user-created items
    if (!seedIds.has(item.id)) return true;
    // If it's a seed item, only keep if custom check flags it as edited
    return isCustomCheck ? isCustomCheck(item) : false;
  });
}

export async function executeFirestoreImport(
  store: ILessonScoreStore,
  tenantId: string,
  payload: ImportPayload
): Promise<ImportResult> {
  const writes: FirestoreWriteOperation[] = [];

  // 1. Students
  const validStudents = filterImportableRecords(payload.students, SEED_STUDENT_IDS);
  for (const student of validStudents) {
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.students}/${tenantId}~${student.id}`,
      data: { ...student, tenantId, role: 'STUDENT', updatedAt: new Date().toISOString() },
    });
  }

  // 2. Groups
  const validGroups = filterImportableRecords(payload.groups, SEED_GROUP_IDS);
  for (const group of validGroups) {
    writes.push({
      type: 'set',
      documentPath: `center_groups/${tenantId}~${group.id}`,
      data: { ...group, tenantId, updatedAt: new Date().toISOString() },
    });
  }

  // 3. Classrooms
  const validRooms = filterImportableRecords(payload.classrooms, SEED_ROOM_IDS);
  for (const room of validRooms) {
    writes.push({
      type: 'set',
      documentPath: `center_classrooms/${tenantId}~${room.id}`,
      data: { ...room, tenantId },
    });
  }

  // 4. Teachers
  const teachers = Array.isArray(payload.teachers) ? payload.teachers : [];
  for (const teacher of teachers) {
    if (!teacher.id) continue;
    writes.push({
      type: 'set',
      documentPath: `teacher_profiles/${tenantId}~${teacher.id}`,
      data: { ...teacher, tenantId, updatedAt: new Date().toISOString() },
    });
  }

  // 5. Sessions
  const validSessions = filterImportableRecords(payload.sessions, SEED_SESSION_IDS).filter(
    (s) => !s.id.startsWith('reception-demo-') // Exclude synthetic demo auto-sessions
  );
  for (const session of validSessions) {
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.sessions}/${tenantId}~${session.id}`,
      data: { ...session, tenantId },
    });
  }

  // 6. Attendance
  const attendance = Array.isArray(payload.attendance) ? payload.attendance : [];
  for (const att of attendance) {
    if (!att.sessionId || !att.studentId) continue;
    const docId = `${att.sessionId}_${att.studentId}`;
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.attendance}/${docId}`,
      data: { ...att, tenantId, scannedAt: att.scannedAt || new Date().toISOString() },
    });
  }

  // 7. Invoices
  const validInvoices = filterImportableRecords(payload.invoices, SEED_INVOICE_IDS);
  for (const inv of validInvoices) {
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.invoices}/${tenantId}~${inv.id}`,
      data: { ...inv, tenantId },
    });
  }

  // 8. Payments
  const validPayments = filterImportableRecords(payload.payments, SEED_PAYMENT_IDS);
  for (const pay of validPayments) {
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.payments}/${tenantId}~${pay.id}`,
      data: { ...pay, tenantId },
    });
  }

  // 9. Expenses
  const validExpenses = filterImportableRecords(payload.expenses, SEED_EXPENSE_IDS);
  for (const exp of validExpenses) {
    writes.push({
      type: 'set',
      documentPath: `${COLLECTIONS.expenses}/${tenantId}~${exp.id}`,
      data: { ...exp, tenantId },
    });
  }

  // 10. Materials
  const materials = Array.isArray(payload.materials) ? payload.materials : [];
  for (const mat of materials) {
    if (!mat.id) continue;
    writes.push({
      type: 'set',
      documentPath: `center_materials/${tenantId}~${mat.id}`,
      data: { ...mat, tenantId },
    });
  }

  // Commit in chunks of 200 (Firestore max per commit is 500)
  const chunkSize = 200;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    await store.commit(chunk);
  }

  const counts: ImportScanSummary = {
    studentsCount: validStudents.length,
    groupsCount: validGroups.length,
    classroomsCount: validRooms.length,
    teachersCount: teachers.length,
    sessionsCount: validSessions.length,
    attendanceCount: attendance.length,
    invoicesCount: validInvoices.length,
    paymentsCount: validPayments.length,
    expensesCount: validExpenses.length,
    materialsCount: materials.length,
    totalRecords: writes.length,
  };

  return {
    success: true,
    importedCounts: counts,
    message: `تم استيراد ${writes.length} سجلاً بنجاح إلى قاعدة بيانات السنتر في Firebase`,
  };
}
