import type {
  Attendance,
  CashierShift,
  Enrollment,
  Expense,
  Invoice,
  Payment,
  PaymentMethod,
  Session,
  SessionStatus,
  User,
} from '@/lib/dal/types';
import type { FirestoreWriteOperation, StructuredFilter } from './firestore-rest';
import type { ILessonScoreStore, StaffMembershipRecord } from './server';

export class CenterOperationsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CenterOperationsError';
  }
}

// Collections
export const COLLECTIONS = {
  students: 'center_students',
  enrollments: 'center_enrollments',
  sessions: 'center_sessions',
  attendance: 'center_attendance',
  invoices: 'center_invoices',
  payments: 'center_payments',
  expenses: 'center_expenses',
  shifts: 'center_shifts',
} as const;

export async function authorizeStaffMember(
  store: ILessonScoreStore,
  uid: string,
  tenantId: string,
  allowedRoles?: string[]
): Promise<StaffMembershipRecord> {
  const member = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
  if (!member.exists || !member.data.isActive) {
    throw new CenterOperationsError(403, 'غير مصرح بالوصول إلى بيانات هذا السنتر');
  }

  const { role, tenantId: memberTenantId } = member.data;
  if (role !== 'PLATFORM_OWNER' && memberTenantId !== tenantId) {
    throw new CenterOperationsError(403, 'غير مصرح بالوصول إلى بيانات هذا السنتر');
  }

  if (allowedRoles && role !== 'PLATFORM_OWNER' && !allowedRoles.includes(role)) {
    throw new CenterOperationsError(403, 'الصلاحية الحالية لا تسمح بإتمام هذه العملية');
  }

  return member.data;
}

// -------------------------------------------------------------
// STUDENTS
// -------------------------------------------------------------
export async function listFirestoreStudents(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { stage?: string; grade?: string; division?: string; search?: string }
): Promise<User[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.stage && filter.stage !== 'all') {
    filters.push({ fieldPath: 'stage', op: 'EQUAL', value: filter.stage });
  }
  if (filter?.grade && filter.grade !== 'all') {
    filters.push({ fieldPath: 'grade', op: 'EQUAL', value: filter.grade });
  }

  const rows = await store.queryCollection<User>(COLLECTIONS.students, filters);
  let students = rows.map((r) => r.data).filter((s) => s.tenantId === tenantId && s.isActive !== false);

  if (filter?.division && filter.division !== 'all') {
    students = students.filter((s) => s.division === filter.division);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    students = students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }
  return students.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
}

export async function saveFirestoreStudent(
  store: ILessonScoreStore,
  tenantId: string,
  student: User
): Promise<User> {
  const docId = `${tenantId}~${student.id}`;
  const now = new Date().toISOString();
  const normalized: User = {
    ...student,
    tenantId,
    role: 'STUDENT',
    updatedAt: now,
    createdAt: student.createdAt || now,
    isActive: student.isActive !== false,
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.students}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

// -------------------------------------------------------------
// ENROLLMENTS
// -------------------------------------------------------------
export async function listFirestoreEnrollments(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { studentId?: string; groupId?: string }
): Promise<Enrollment[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.studentId) {
    filters.push({ fieldPath: 'studentId', op: 'EQUAL', value: filter.studentId });
  }
  if (filter?.groupId) {
    filters.push({ fieldPath: 'groupId', op: 'EQUAL', value: filter.groupId });
  }

  const rows = await store.queryCollection<Enrollment>(COLLECTIONS.enrollments, filters);
  return rows.map((r) => r.data).filter((e) => e.tenantId === tenantId && e.isActive !== false);
}

export async function saveFirestoreEnrollment(
  store: ILessonScoreStore,
  tenantId: string,
  enrollment: Enrollment
): Promise<Enrollment> {
  const docId = `${tenantId}~${enrollment.id}`;
  const normalized: Enrollment = {
    ...enrollment,
    tenantId,
    isActive: enrollment.isActive !== false,
    enrolledAt: enrollment.enrolledAt || new Date().toISOString(),
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.enrollments}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

export async function deleteFirestoreEnrollment(
  store: ILessonScoreStore,
  tenantId: string,
  enrollmentId: string
): Promise<void> {
  const docId = `${tenantId}~${enrollmentId}`;
  const write: FirestoreWriteOperation = {
    type: 'delete',
    documentPath: `${COLLECTIONS.enrollments}/${docId}`,
  };
  await store.commit([write]);
}

// -------------------------------------------------------------
// SESSIONS
// -------------------------------------------------------------
export async function listFirestoreSessions(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { date?: string; groupId?: string; teacherId?: string }
): Promise<Session[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.date) {
    filters.push({ fieldPath: 'sessionDate', op: 'EQUAL', value: filter.date });
  }
  if (filter?.groupId) {
    filters.push({ fieldPath: 'groupId', op: 'EQUAL', value: filter.groupId });
  }

  const rows = await store.queryCollection<Session>(COLLECTIONS.sessions, filters);
  let sessions = rows.map((r) => r.data).filter((s) => s.tenantId === tenantId);
  if (filter?.teacherId) {
    sessions = sessions.filter((s) => s.teacherId === filter.teacherId);
  }
  return sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function saveFirestoreSession(
  store: ILessonScoreStore,
  tenantId: string,
  session: Session
): Promise<Session> {
  const docId = `${tenantId}~${session.id}`;
  const normalized: Session = {
    ...session,
    tenantId,
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.sessions}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

export async function updateFirestoreSessionStatus(
  store: ILessonScoreStore,
  tenantId: string,
  sessionId: string,
  status: SessionStatus,
  cancellationReason?: string
): Promise<void> {
  const docId = `${tenantId}~${sessionId}`;
  const snap = await store.getDocument<Session>(`${COLLECTIONS.sessions}/${docId}`);
  if (!snap.exists) {
    throw new CenterOperationsError(404, 'الحصة غير موجودة');
  }

  const updated: Session = {
    ...snap.data,
    status,
    cancellationReason: status === 'canceled' ? cancellationReason : undefined,
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.sessions}/${docId}`,
    data: updated as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
}

// -------------------------------------------------------------
// ATTENDANCE & RECEPTION
// -------------------------------------------------------------
export async function listFirestoreAttendance(
  store: ILessonScoreStore,
  tenantId: string,
  sessionId: string
): Promise<Attendance[]> {
  const filters: StructuredFilter[] = [
    { fieldPath: 'tenantId', op: 'EQUAL', value: tenantId },
    { fieldPath: 'sessionId', op: 'EQUAL', value: sessionId },
  ];
  const rows = await store.queryCollection<Attendance>(COLLECTIONS.attendance, filters);
  return rows.map((r) => r.data);
}

export async function recordFirestoreAttendance(
  store: ILessonScoreStore,
  tenantId: string,
  record: Attendance
): Promise<Attendance> {
  // Deterministic doc ID prevents duplicate attendance scans
  const docId = `${record.sessionId}_${record.studentId}`;
  const normalized: Attendance = {
    ...record,
    id: record.id || `att-${docId}`,
    tenantId,
    scannedAt: record.scannedAt || new Date().toISOString(),
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.attendance}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

// -------------------------------------------------------------
// INVOICES & PAYMENTS
// -------------------------------------------------------------
export async function listFirestoreInvoices(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { studentId?: string; status?: string }
): Promise<Invoice[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.studentId) {
    filters.push({ fieldPath: 'studentId', op: 'EQUAL', value: filter.studentId });
  }
  const rows = await store.queryCollection<Invoice>(COLLECTIONS.invoices, filters);
  let invoices = rows.map((r) => r.data);
  if (filter?.status && filter.status !== 'all') {
    invoices = invoices.filter((i) => i.status === filter.status);
  }
  return invoices.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function saveFirestoreInvoice(
  store: ILessonScoreStore,
  tenantId: string,
  invoice: Invoice
): Promise<Invoice> {
  const docId = `${tenantId}~${invoice.id}`;
  const normalized: Invoice = {
    ...invoice,
    tenantId,
    createdAt: invoice.createdAt || new Date().toISOString(),
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.invoices}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

export async function listFirestorePayments(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { studentId?: string; invoiceId?: string; shiftId?: string }
): Promise<Payment[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.studentId) {
    filters.push({ fieldPath: 'studentId', op: 'EQUAL', value: filter.studentId });
  }
  if (filter?.invoiceId) {
    filters.push({ fieldPath: 'invoiceId', op: 'EQUAL', value: filter.invoiceId });
  }

  const rows = await store.queryCollection<Payment>(COLLECTIONS.payments, filters);
  let payments = rows.map((r) => r.data);
  if (filter?.shiftId) {
    payments = payments.filter((p) => p.cashierShiftId === filter.shiftId);
  }
  return payments.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
}

export async function recordFirestorePayment(
  store: ILessonScoreStore,
  tenantId: string,
  payment: Payment
): Promise<Payment> {
  const docId = `${tenantId}~${payment.id}`;
  const normalized: Payment = {
    ...payment,
    tenantId,
    paidAt: payment.paidAt || new Date().toISOString(),
  };

  const writes: FirestoreWriteOperation[] = [
    {
      type: 'set',
      documentPath: `${COLLECTIONS.payments}/${docId}`,
      data: normalized as unknown as Record<string, unknown>,
    },
  ];

  // If linked to invoice, update invoice paid amount and status
  if (payment.invoiceId) {
    const invPath = `${COLLECTIONS.invoices}/${tenantId}~${payment.invoiceId}`;
    const invSnap = await store.getDocument<Invoice>(invPath);
    if (invSnap.exists) {
      const inv = invSnap.data;
      const newPaid = (inv.paidAmount || 0) + payment.amountPaid;
      const newStatus = newPaid >= inv.totalAmount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
      writes.push({
        type: 'set',
        documentPath: invPath,
        data: {
          ...inv,
          paidAmount: newPaid,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      });
    }
  }

  await store.commit(writes);
  return normalized;
}

// -------------------------------------------------------------
// EXPENSES & CASHIER SHIFTS
// -------------------------------------------------------------
export async function listFirestoreExpenses(
  store: ILessonScoreStore,
  tenantId: string
): Promise<Expense[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  const rows = await store.queryCollection<Expense>(COLLECTIONS.expenses, filters);
  return rows.map((r) => r.data).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function recordFirestoreExpense(
  store: ILessonScoreStore,
  tenantId: string,
  expense: Expense
): Promise<Expense> {
  const docId = `${tenantId}~${expense.id}`;
  const normalized: Expense = {
    ...expense,
    tenantId,
    createdAt: expense.createdAt || new Date().toISOString(),
  };

  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.expenses}/${docId}`,
    data: normalized as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return normalized;
}

export async function listFirestoreShifts(
  store: ILessonScoreStore,
  tenantId: string,
  filter?: { cashierUserId?: string; status?: 'open' | 'closed' }
): Promise<CashierShift[]> {
  const filters: StructuredFilter[] = [{ fieldPath: 'tenantId', op: 'EQUAL', value: tenantId }];
  if (filter?.cashierUserId) {
    filters.push({ fieldPath: 'cashierUserId', op: 'EQUAL', value: filter.cashierUserId });
  }

  const rows = await store.queryCollection<CashierShift>(COLLECTIONS.shifts, filters);
  let shifts = rows.map((r) => r.data);
  if (filter?.status) {
    shifts = shifts.filter((s) => s.status === filter.status);
  }
  return shifts.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export async function saveFirestoreShift(
  store: ILessonScoreStore,
  tenantId: string,
  shift: CashierShift
): Promise<CashierShift> {
  const docId = `${tenantId}~${shift.id}`;
  const write: FirestoreWriteOperation = {
    type: 'set',
    documentPath: `${COLLECTIONS.shifts}/${docId}`,
    data: { ...shift, tenantId } as unknown as Record<string, unknown>,
  };
  await store.commit([write]);
  return shift;
}
