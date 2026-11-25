import { IDataProvider } from './index';
import { MockDataProvider } from './mock-data';
import { FirestoreDataProvider } from './firestore-provider';
import { cairoClock } from '@/lib/attendance/reception';
import { attachDemoOperations } from './demo-operations';

let mockInstance: MockDataProvider | null = null;

export function isCloudProductionMode(): boolean {
  const mode = (process.env.DATA_PROVIDER_MODE || '').trim().toLowerCase();
  if (mode === 'production' || mode === 'firebase') return true;
  if (process.env.NODE_ENV !== 'test') return true;
  return false;
}

export function createCenterDataProvider(useOperationalFixtures = process.env.NODE_ENV === 'test'): MockDataProvider {
  return new MockDataProvider({ useOperationalFixtures });
}

export function getDataProvider(callerIdToken?: string): IDataProvider {
  if (isCloudProductionMode()) {
    return new FirestoreDataProvider({ callerIdToken });
  }

  if (mockInstance) return mockInstance;

  mockInstance = new MockDataProvider({ useOperationalFixtures: process.env.NODE_ENV === 'test' });
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    try {
      attachDemoOperations(mockInstance, window.localStorage);
    } catch {
      mockInstance.attachDemoOperations(() => {
        throw new Error('تعذّر حفظ السجلات في هذا المتصفح. تحقّق من إعدادات التخزين.');
      });
    }
  }
  return mockInstance;
}

export function getReceptionDataProvider(clock = cairoClock(), callerIdToken?: string): IDataProvider {
  const provider = getDataProvider(callerIdToken);
  if (isCloudProductionMode() || !(provider instanceof MockDataProvider)) {
    return provider;
  }

  const template = provider.sessions.find((session) => session.id === 'sess-live-today');
  if (
    !template ||
    !provider.groups.some(
      (group) => group.id === template.groupId && group.tenantId === template.tenantId && group.isActive
    )
  ) {
    return provider;
  }

  // Keep the isolated test fixture center usable regardless of test date.
  const today = Date.parse(clock.slice(0, 10));
  for (let offset = -30; offset <= 1; offset += 1) {
    const date = new Date(today + offset * 86400000).toISOString().slice(0, 10);
    const sessionId = `reception-demo-${date}`;
    if (provider.sessions.some((session) => session.id === sessionId)) continue;
    provider.sessions.push({
      ...template,
      id: sessionId,
      sessionDate: date,
      startTime: '00:00',
      endTime: '23:59',
      status: 'scheduled',
      notes: 'حصة تجريبية للاستقبال',
    });
    provider.exams.push({
      id: `${sessionId}-exam`,
      tenantId: template.tenantId,
      sessionId,
      groupId: template.groupId,
      teacherId: template.teacherId,
      title: 'اختبار الحصة التجريبي',
      subjectNameAr: 'الرياضيات',
      durationMinutes: 15,
      totalMarks: 20,
      passMarks: 10,
      isAiGenerated: false,
      groundedMaterialIds: [],
      status: 'draft',
      createdAt: `${date}T00:00:00Z`,
    });
  }
  return provider;
}
