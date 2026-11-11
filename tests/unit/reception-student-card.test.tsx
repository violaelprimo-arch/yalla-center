import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionStudentCard } from '@/components/attendance/reception-student-card';
import { getReceptionDataProvider } from '@/lib/dal/factory';
import { readReceptionRecord, receptionSessionState, summarizeReception } from '@/lib/attendance/reception';

const tenantId = 'tenant-maher-001';
const studentId = 'user-student-1001';
const clock = '2026-11-11T15:00';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('HTMLDialogElement', window.HTMLDialogElement);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.unstubAllGlobals();
});

describe('Reception student follow-up', () => {
  it('distinguishes current, upcoming and ended sessions in Cairo local time', async () => {
    const dal = getReceptionDataProvider(clock);
    const session = (await dal.getSessionById(tenantId, 'reception-demo-2026-11-11'))!;
    expect(receptionSessionState(session, clock)).toBe('current');
    expect(receptionSessionState(session, '2026-11-10T23:59')).toBe('upcoming');
    expect(receptionSessionState(session, '2026-11-11T23:59')).toBeNull();
    expect(receptionSessionState({ ...session, status: 'completed' }, clock)).toBeNull();
  });

  it('counts confirmed absences in the selected group and includes zero in performance', async () => {
    const dal = getReceptionDataProvider(clock);
    const session = (await dal.getSessionById(tenantId, 'reception-demo-2026-11-11'))!;
    const enrollment = (await dal.getEnrollments(tenantId, { studentId, groupId: session.groupId }))[0];
    const previous = { ...session, id: 'previous', sessionDate: '2026-11-10', status: 'completed' as const };
    const otherGroup = { ...previous, id: 'other-group-session', groupId: 'other-group' };
    const exams = await dal.getExams(tenantId, { groupId: session.groupId });
    const attendance = [previous, otherGroup].map(item => ({
      id: 'attendance-' + item.id, tenantId, sessionId: item.id, studentId,
      status: 'absent' as const, scannedAt: '2026-11-10T15:00:00Z', verificationMethod: 'manual' as const,
    }));

    const summary = summarizeReception(session, enrollment, [session, previous, otherGroup], attendance,
      exams, [], exam => exam.sessionId === session.id ? 0 : undefined, clock);
    expect(summary).toEqual({
      previous: 'absent', monthlyAbsences: 1, components: [0, null, 0], performance: 0,
    });
  });

  it('persists homework and zero marks, reloads a mark and deletes it explicitly', async () => {
    const dal = getReceptionDataProvider(clock);
    const session = (await dal.getSessionById(tenantId, 'reception-demo-2026-11-11'))!;
    const student = (await dal.getUsers(tenantId)).find(user => user.id === studentId)!;
    const props = { tenantId, session, student, centerSlug: 'al-maher' };
    const first = render(<ReceptionStudentCard {...props} />);

    fireEvent.click(await screen.findByRole('switch', { name: 'تسليم واجب الحصة' }));
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل درجة اختبار الحصة' }));
    fireEvent.change(screen.getByRole('textbox', { name: /الدرجة من 20/ }), { target: { value: '٠' } });

    await waitFor(() => expect(readReceptionRecord(tenantId, session.id, studentId)).toEqual({
      homework: true, grades: { [session.id + '-exam']: 0 },
    }));

    first.unmount();
    render(<ReceptionStudentCard {...props} />);
    expect(await screen.findByRole('switch', { name: 'تسليم واجب الحصة' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل درجة اختبار الحصة' }));
    expect(screen.getByRole('textbox', { name: /الدرجة من 20/ })).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'حذف الدرجة' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحذف' }));
    expect(readReceptionRecord(tenantId, session.id, studentId)).toEqual({ homework: true, grades: {} });
  });
});
