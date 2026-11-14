import { INITIAL_SEEDED_DATA, type MockDataProvider } from './mock-data';

const key = 'yc-demo-operations-v1';
const fields = [
  'users', 'enrollments', 'invoices', 'payments', 'sessions', 'attendance', 'teacherPayroll',
  'teacherAdvances', 'cashierShifts', 'expenses',
] as const;
type DemoOperations = Pick<MockDataProvider, typeof fields[number] | 'teacherRates'>;

export function attachDemoOperations(provider: MockDataProvider, storage: Storage) {
  const snapshot = (): DemoOperations => ({
    users: provider.users, enrollments: provider.enrollments, invoices: provider.invoices, payments: provider.payments,
    sessions: provider.sessions,
    attendance: provider.attendance, teacherPayroll: provider.teacherPayroll,
    teacherAdvances: provider.teacherAdvances, cashierShifts: provider.cashierShifts, expenses: provider.expenses,
    teacherRates: provider.teacherRates,
  });

  function restore(data: DemoOperations) {
    Object.assign(provider, data);
  }

  const baseline = structuredClone(snapshot());
  function read(raw: string | null): DemoOperations {
    if (raw === null) return structuredClone(baseline);
    const data = JSON.parse(raw) as Omit<DemoOperations, 'teacherRates'> & Partial<Pick<DemoOperations, 'teacherRates'>>;
    if (!data || !fields.every(field => Array.isArray(data[field])) ||
      (data.teacherRates !== undefined && !Array.isArray(data.teacherRates))) {
      throw new Error('تعذّر قراءة السجلات التجريبية المحفوظة');
    }
    if (provider.useOperationalFixtures) return { ...data, teacherRates: data.teacherRates ?? baseline.teacherRates };
    const seedTeachers = INITIAL_SEEDED_DATA.users.filter(user => user.role === 'TEACHER');
    const usedSessions = new Set([
      ...data.attendance.map(record => record.sessionId),
      ...data.invoices.flatMap(invoice => invoice.sessionId ? [invoice.sessionId] : []),
    ]);
    const sessions = provider.keepSavedRecords(data.sessions, INITIAL_SEEDED_DATA.sessions.filter(session => !usedSessions.has(session.id)));
    return {
      ...data,
      users: provider.keepSavedRecords(data.users, seedTeachers),
      sessions: sessions.filter(session => !session.id.startsWith('reception-demo-') || usedSessions.has(session.id)),
      enrollments: provider.keepSavedRecords(data.enrollments, INITIAL_SEEDED_DATA.enrollments),
      invoices: provider.keepSavedRecords(data.invoices, INITIAL_SEEDED_DATA.invoices),
      payments: provider.keepSavedRecords(data.payments, INITIAL_SEEDED_DATA.payments),
      teacherRates: provider.keepSavedRecords(data.teacherRates ?? [], INITIAL_SEEDED_DATA.teacherRates),
      teacherPayroll: provider.keepSavedRecords(data.teacherPayroll, INITIAL_SEEDED_DATA.teacherPayroll),
      teacherAdvances: provider.keepSavedRecords(data.teacherAdvances, INITIAL_SEEDED_DATA.teacherAdvances),
      cashierShifts: provider.keepSavedRecords(data.cashierShifts, INITIAL_SEEDED_DATA.cashierShifts),
      expenses: provider.keepSavedRecords(data.expenses, INITIAL_SEEDED_DATA.expenses),
    };
  }

  let raw = storage.getItem(key);
  restore(read(raw));
  let previous = structuredClone(snapshot());

  provider.attachDemoOperations(() => {
    try {
      const stored = storage.getItem(key);
      if (stored !== raw) {
        previous = read(stored);
        raw = stored;
        throw new Error('تم تحديث السجلات من نافذة أخرى. راجع البيانات وحاول الحفظ مرة أخرى.');
      }
      const data = snapshot();
      const next = JSON.stringify(data);
      storage.setItem(key, next);
      raw = next;
      previous = structuredClone(data);
    } catch (cause) {
      restore(structuredClone(previous));
      throw cause;
    }
  });
}
