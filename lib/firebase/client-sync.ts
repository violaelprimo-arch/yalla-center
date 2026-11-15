'use client';

import type {
  Attendance,
  Enrollment,
  Expense,
  Invoice,
  Payment,
  Session,
  SessionStatus,
  User,
} from '@/lib/dal/types';
import type { ImportPayload, ImportResult } from './import-service';
import type { StaffMembershipRecord } from './server';

async function requestApi<T>(
  url: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return (data.data !== undefined ? data.data : (data as unknown as T));
}

// Bootstrap staff membership
export async function bootstrapCenterStaff(slug: string, token: string): Promise<StaffMembershipRecord> {
  const result = await requestApi<{ member: StaffMembershipRecord }>(
    `/api/center/${encodeURIComponent(slug)}/staff/bootstrap`,
    token,
    { method: 'POST' }
  );
  return result.member;
}

// Students
export async function fetchCloudStudents(
  slug: string,
  token: string,
  filter?: { stage?: string; grade?: string; division?: string; search?: string }
): Promise<User[]> {
  const query = new URLSearchParams();
  if (filter?.stage && filter.stage !== 'all') query.set('stage', filter.stage);
  if (filter?.grade && filter.grade !== 'all') query.set('grade', filter.grade);
  if (filter?.division && filter.division !== 'all') query.set('division', filter.division);
  if (filter?.search) query.set('search', filter.search);

  const qs = query.toString();
  return requestApi<User[]>(
    `/api/center/${encodeURIComponent(slug)}/students${qs ? `?${qs}` : ''}`,
    token
  );
}

export async function saveCloudStudent(slug: string, token: string, student: Partial<User>): Promise<User> {
  return requestApi<User>(`/api/center/${encodeURIComponent(slug)}/students`, token, {
    method: 'POST',
    body: student,
  });
}

// Enrollments
export async function fetchCloudEnrollments(
  slug: string,
  token: string,
  filter?: { studentId?: string; groupId?: string }
): Promise<Enrollment[]> {
  const query = new URLSearchParams();
  if (filter?.studentId) query.set('studentId', filter.studentId);
  if (filter?.groupId) query.set('groupId', filter.groupId);
  const qs = query.toString();

  return requestApi<Enrollment[]>(
    `/api/center/${encodeURIComponent(slug)}/enrollments${qs ? `?${qs}` : ''}`,
    token
  );
}

export async function saveCloudEnrollment(
  slug: string,
  token: string,
  enrollment: Partial<Enrollment>
): Promise<Enrollment> {
  return requestApi<Enrollment>(`/api/center/${encodeURIComponent(slug)}/enrollments`, token, {
    method: 'POST',
    body: enrollment,
  });
}

export async function deleteCloudEnrollment(slug: string, token: string, enrollmentId: string): Promise<void> {
  await requestApi<void>(
    `/api/center/${encodeURIComponent(slug)}/enrollments?id=${encodeURIComponent(enrollmentId)}`,
    token,
    { method: 'DELETE' }
  );
}

// Sessions
export async function fetchCloudSessions(
  slug: string,
  token: string,
  filter?: { date?: string; groupId?: string; teacherId?: string }
): Promise<Session[]> {
  const query = new URLSearchParams();
  if (filter?.date) query.set('date', filter.date);
  if (filter?.groupId) query.set('groupId', filter.groupId);
  if (filter?.teacherId) query.set('teacherId', filter.teacherId);
  const qs = query.toString();

  return requestApi<Session[]>(
    `/api/center/${encodeURIComponent(slug)}/sessions${qs ? `?${qs}` : ''}`,
    token
  );
}

export async function saveCloudSession(slug: string, token: string, session: Partial<Session>): Promise<Session> {
  return requestApi<Session>(`/api/center/${encodeURIComponent(slug)}/sessions`, token, {
    method: 'POST',
    body: session,
  });
}

export async function updateCloudSessionStatus(
  slug: string,
  token: string,
  sessionId: string,
  status: SessionStatus,
  cancellationReason?: string
): Promise<void> {
  await requestApi<void>(`/api/center/${encodeURIComponent(slug)}/sessions`, token, {
    method: 'PATCH',
    body: { sessionId, status, cancellationReason },
  });
}

// Attendance
export async function fetchCloudAttendance(
  slug: string,
  token: string,
  sessionId: string
): Promise<Attendance[]> {
  return requestApi<Attendance[]>(
    `/api/center/${encodeURIComponent(slug)}/attendance?sessionId=${encodeURIComponent(sessionId)}`,
    token
  );
}

export async function recordCloudAttendance(
  slug: string,
  token: string,
  record: Partial<Attendance>
): Promise<Attendance> {
  return requestApi<Attendance>(`/api/center/${encodeURIComponent(slug)}/attendance`, token, {
    method: 'POST',
    body: record,
  });
}

// Finance: Invoices & Payments & Expenses
export async function fetchCloudInvoices(
  slug: string,
  token: string,
  filter?: { studentId?: string; status?: string }
): Promise<Invoice[]> {
  const query = new URLSearchParams({ type: 'invoices' });
  if (filter?.studentId) query.set('studentId', filter.studentId);
  if (filter?.status) query.set('status', filter.status);

  return requestApi<Invoice[]>(
    `/api/center/${encodeURIComponent(slug)}/finance?${query.toString()}`,
    token
  );
}

export async function saveCloudInvoice(slug: string, token: string, invoice: Partial<Invoice>): Promise<Invoice> {
  return requestApi<Invoice>(
    `/api/center/${encodeURIComponent(slug)}/finance?type=invoice`,
    token,
    { method: 'POST', body: invoice }
  );
}

export async function fetchCloudPayments(
  slug: string,
  token: string,
  filter?: { studentId?: string; invoiceId?: string; shiftId?: string }
): Promise<Payment[]> {
  const query = new URLSearchParams({ type: 'payments' });
  if (filter?.studentId) query.set('studentId', filter.studentId);
  if (filter?.invoiceId) query.set('invoiceId', filter.invoiceId);
  if (filter?.shiftId) query.set('shiftId', filter.shiftId);

  return requestApi<Payment[]>(
    `/api/center/${encodeURIComponent(slug)}/finance?${query.toString()}`,
    token
  );
}

export async function recordCloudPayment(slug: string, token: string, payment: Partial<Payment>): Promise<Payment> {
  return requestApi<Payment>(
    `/api/center/${encodeURIComponent(slug)}/finance?type=payment`,
    token,
    { method: 'POST', body: payment }
  );
}

export async function fetchCloudExpenses(slug: string, token: string): Promise<Expense[]> {
  return requestApi<Expense[]>(
    `/api/center/${encodeURIComponent(slug)}/finance?type=expenses`,
    token
  );
}

export async function recordCloudExpense(slug: string, token: string, expense: Partial<Expense>): Promise<Expense> {
  return requestApi<Expense>(
    `/api/center/${encodeURIComponent(slug)}/finance?type=expense`,
    token,
    { method: 'POST', body: expense }
  );
}

// Browser Data Import to Cloud Firestore
export async function importBrowserDataToCloud(
  slug: string,
  token: string,
  payload: ImportPayload
): Promise<ImportResult> {
  const res = await fetch(`/api/center/${encodeURIComponent(slug)}/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as ImportResult | null;
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || `فشل الاستيراد (${res.status})`);
  }
  return data;
}
