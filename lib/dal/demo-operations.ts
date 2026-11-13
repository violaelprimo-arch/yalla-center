import type { MockDataProvider } from './mock-data';

const key = 'yc-demo-operations-v1';
const fields = [
  'users', 'enrollments', 'invoices', 'payments', 'sessions', 'attendance', 'teacherPayroll',
  'teacherAdvances', 'cashierShifts', 'expenses',
] as const;
type DemoOperations = Pick<MockDataProvider, typeof fields[number]>;

export function attachDemoOperations(provider: MockDataProvider, storage: Storage) {
  const snapshot = (): DemoOperations => ({
    users: provider.users, enrollments: provider.enrollments, invoices: provider.invoices, payments: provider.payments,
    sessions: provider.sessions,
    attendance: provider.attendance, teacherPayroll: provider.teacherPayroll,
    teacherAdvances: provider.teacherAdvances, cashierShifts: provider.cashierShifts, expenses: provider.expenses,
  });

  function restore(data: DemoOperations) {
    Object.assign(provider, data);
  }

  let raw = storage.getItem(key);
  if (raw !== null) {
    const data = JSON.parse(raw) as DemoOperations;
    if (!data || !fields.every(field => Array.isArray(data[field]))) {
      throw new Error('تعذّر قراءة السجلات التجريبية المحفوظة');
    }
    restore(data);
  }
  let previous = structuredClone(snapshot());

  provider.attachDemoOperations(() => {
    try {
      const stored = storage.getItem(key);
      if (stored !== raw) {
        if (stored !== null) previous = JSON.parse(stored) as DemoOperations;
        throw new Error('تم تعديل السجلات من نافذة أخرى. حدّث الصفحة وحاول مرة أخرى.');
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
