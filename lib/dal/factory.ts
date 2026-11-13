import { IDataProvider } from './index';
import { MockDataProvider } from './mock-data';
import { cairoClock } from '@/lib/attendance/reception';
import { attachDemoOperations } from './demo-operations';

let instance: MockDataProvider | null = null;

export function getDataProvider(): MockDataProvider {
  if (instance) return instance;

  instance = new MockDataProvider();
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test' &&
    !(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID)) {
    try {
      attachDemoOperations(instance, window.localStorage);
    } catch {
      instance.attachDemoOperations(() => {
        throw new Error('تعذّر حفظ السجلات في هذا المتصفح. تحقّق من إعدادات التخزين.');
      });
    }
  }
  return instance;
}

export function getReceptionDataProvider(clock = cairoClock()): IDataProvider {
  const provider = getDataProvider();
  const template = provider.sessions.find(session => session.id === 'sess-live-today');
  if (!template) return provider;

  // Keep the sample center usable regardless of when the demo is opened.
  // Date-specific IDs keep each day's saved marks independent.
  const today = Date.parse(clock.slice(0, 10));
  for (let offset = -30; offset <= 1; offset += 1) {
    const date = new Date(today + offset * 86400000).toISOString().slice(0, 10);
    const sessionId = `reception-demo-${date}`;
    if (provider.sessions.some(session => session.id === sessionId)) continue;
    provider.sessions.push({
      ...template, id: sessionId, sessionDate: date, startTime: '00:00', endTime: '23:59',
      status: 'scheduled', notes: 'حصة تجريبية للاستقبال',
    });
    provider.exams.push({
      id: `${sessionId}-exam`, tenantId: template.tenantId, sessionId, groupId: template.groupId,
      teacherId: template.teacherId, title: 'اختبار الحصة التجريبي', subjectNameAr: 'الرياضيات',
      durationMinutes: 15, totalMarks: 20, passMarks: 10, isAiGenerated: false,
      groundedMaterialIds: [], status: 'draft', createdAt: `${date}T00:00:00Z`,
    });
  }
  return provider;
}
