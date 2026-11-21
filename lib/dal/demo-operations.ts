import { INITIAL_SEEDED_DATA, TEST_OPERATIONAL_FIXTURES, type MockDataProvider } from './mock-data';

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
    const seedTeachers = TEST_OPERATIONAL_FIXTURES.users.filter(user => user.role === 'TEACHER');
    const usedSessions = new Set([
      ...data.attendance.map(record => record.sessionId),
      ...data.invoices.flatMap(invoice => invoice.sessionId ? [invoice.sessionId] : []),
    ]);
    const sessions = provider.keepSavedRecords(data.sessions, TEST_OPERATIONAL_FIXTURES.sessions.filter(session => !usedSessions.has(session.id)));
    return {
      ...data,
      users: provider.keepSavedRecords(data.users, seedTeachers),
      sessions: sessions.filter(session => !session.id.startsWith('reception-demo-') || usedSessions.has(session.id)),
      enrollments: provider.keepSavedRecords(data.enrollments, TEST_OPERATIONAL_FIXTURES.enrollments),
      invoices: provider.keepSavedRecords(data.invoices, TEST_OPERATIONAL_FIXTURES.invoices),
      payments: provider.keepSavedRecords(data.payments, TEST_OPERATIONAL_FIXTURES.payments),
      teacherRates: provider.keepSavedRecords(data.teacherRates ?? [], TEST_OPERATIONAL_FIXTURES.teacherRates),
      teacherPayroll: provider.keepSavedRecords(data.teacherPayroll, TEST_OPERATIONAL_FIXTURES.teacherPayroll),
      teacherAdvances: provider.keepSavedRecords(data.teacherAdvances, TEST_OPERATIONAL_FIXTURES.teacherAdvances),
      cashierShifts: provider.keepSavedRecords(data.cashierShifts, TEST_OPERATIONAL_FIXTURES.cashierShifts),
      expenses: provider.keepSavedRecords(data.expenses, TEST_OPERATIONAL_FIXTURES.expenses),
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
