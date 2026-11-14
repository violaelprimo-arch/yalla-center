import { z } from 'zod';
import { cairoClock } from '@/lib/attendance/reception';
import type { Branch, Classroom, EducationalStage, Group, Session, Subject } from '@/lib/dal/types';
import { checkGroupScheduleConflicts } from './conflict-detector';

export const WEEKDAYS = [
  [6, 'السبت'], [0, 'الأحد'], [1, 'الإثنين'], [2, 'الثلاثاء'],
  [3, 'الأربعاء'], [4, 'الخميس'], [5, 'الجمعة'],
] as const;

export const GROUP_PRICING_LABELS = {
  center: 'نظام المتوسط',
  private: 'نظام البرايفت',
  per_session: 'نظام الدفع بالحصة',
} as const;

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/, 'المعرّف غير صالح');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'اكتب وقتًا صحيحًا');
const money = z.number().min(0).max(1000000);
const percent = z.number().min(0).max(100);

const pricingSchema = z.discriminatedUnion('model', [
  z.object({ model: z.literal('center'), monthlyFee: money, teacherRate: money }),
  z.object({ model: z.literal('private'), monthlyFee: money, teacherPercentage: percent }),
  z.object({ model: z.literal('per_session'), teacherFee: money, centerFee: money }),
]);

const slotSchema = z.object({
  id,
  scheduleDay: z.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
  classroomId: id,
});

export const groupInputSchema = z.object({
  id, version: z.number().int().min(0),
  nameAr: z.string().trim().min(1, 'اسم المجموعة مطلوب').max(120),
  branchId: id, stageId: id, gradeId: id, subjectId: id, teacherId: id,
  maxStudents: z.number().int().min(1, 'سعة المجموعة لازم تكون أكبر من صفر').max(1000).optional(),
  weeklySlots: z.array(slotSchema).min(1, 'أضف موعدًا واحدًا على الأقل').max(28),
  pricing: pricingSchema,
});

export const classroomInputSchema = z.object({
  id: id.optional(), branchId: id, nameAr: z.string().trim().min(1, 'اسم القاعة مطلوب').max(80),
  capacity: z.number().int().min(1, 'سعة القاعة مطلوبة').max(1000),
});

export const groupDeletionSchema = z.object({ id, version: z.number().int().min(0) });
export const classroomDeletionSchema = z.object({ id, branchId: id });

export type GroupPricing = z.infer<typeof pricingSchema>;
export type WeeklySlot = z.infer<typeof slotSchema>;
export type GroupInput = z.infer<typeof groupInputSchema>;
export type ClassroomInput = z.infer<typeof classroomInputSchema>;

export interface GroupPeriod {
  startsAt: string;
  endsAt: string;
  teacherId: string;
  branchId: string;
  subjectId: string;
  weeklySlots: WeeklySlot[];
  pricing: GroupPricing;
}

export class GroupScheduleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const groupConflictMessage = 'الجدول اتعدّل أثناء الحفظ. حدّث الصفحة وحاول مرة أخرى.';
export const toCents = (amount: number) => Math.round(amount * 100);
export const moneyAmount = (amount: number) => toCents(amount) / 100;

export function studentGroupFee(group: Group) {
  if (!group.pricing) return group.monthlyFee || group.sessionFee || 0;
  return group.pricing.model === 'per_session'
    ? (toCents(group.pricing.teacherFee) + toCents(group.pricing.centerFee)) / 100
    : group.pricing.monthlyFee;
}

export function weeklySlots(group: Pick<Group, 'scheduleDay' | 'startTime' | 'endTime' | 'weeklySlots'>) {
  return group.weeklySlots ?? [{
    id: 'original', classroomId: '',
    scheduleDay: group.scheduleDay, startTime: group.startTime, endTime: group.endTime,
  }];
}

export function weekdayLabel(day: number) {
  return WEEKDAYS.find(([index]) => index === day)?.[1] ?? '';
}

export function slotSummary(group: Group) {
  return weeklySlots(group).map(slot => `${weekdayLabel(slot.scheduleDay)} ${clockLabel(slot.startTime)} – ${clockLabel(slot.endTime)}`).join('، ');
}

export function clockLabel(time: string) {
  const [hour, minutes] = time.split(':');
  const hours = Number(hour);
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'ص' : 'م'}`;
}

export function mergeManagedRecords<T extends { id: string }>(base: T[], records: T[]) {
  const merged = new Map(base.map(record => [record.id, record]));
  for (const record of records) merged.set(record.id, record);
  return [...merged.values()];
}

export function buildClassroom(tenantId: string, input: ClassroomInput, branches: Branch[], classrooms: Classroom[]): Classroom {
  if (!branches.some(branch => branch.tenantId === tenantId && branch.id === input.branchId)) {
    throw new GroupScheduleError(400, 'اختر فرعًا من هذا السنتر');
  }
  const rooms = classrooms.filter(room => room.tenantId === tenantId && room.branchId === input.branchId && !room.archivedAt);
  const current = rooms.find(room => room.id === input.id);
  if (input.id && !current) throw new GroupScheduleError(404, 'القاعة غير موجودة في هذا الفرع');
  if (rooms.some(room => room.id !== input.id &&
    room.nameAr.toLocaleLowerCase('ar') === input.nameAr.toLocaleLowerCase('ar'))) {
    throw new GroupScheduleError(409, 'يوجد قاعة بنفس الاسم في هذا الفرع');
  }
  if (current) return { ...current, nameAr: input.nameAr, capacity: input.capacity };
  return {
    ...input, id: `room-${crypto.randomUUID()}`, tenantId,
    equipment: { projector: false, airConditioning: false, smartBoard: false },
    createdAt: new Date().toISOString(),
  };
}

export function archiveClassroom(room: Classroom, groups: Group[]): Classroom {
  const occupied = groups.some(group => group.tenantId === room.tenantId && group.isActive &&
    (group.classroomId === room.id || weeklySlots(group).some(slot => slot.classroomId === room.id)));
  if (occupied) throw new GroupScheduleError(409, 'القاعة مرتبطة بموعد مجموعة نشطة. غيّر قاعة الموعد من «الحصص والمجموعات» أولًا.');
  return { ...room, archivedAt: new Date().toISOString() };
}

export function archiveGroup(group: Group, archivedAt = `${cairoClock()}:00`): Group {
  // A slot starting in the current minute may already have attendance to retain.
  return group.archivedAt ? group : { ...group, isActive: false, archivedAt, version: (group.version ?? 0) + 1 };
}

export function isRegisteredGroup(group: Group) {
  return !group.archivedAt;
}

function periodFrom(group: Group): Omit<GroupPeriod, 'endsAt'> | undefined {
  if (!group.pricing || !group.effectiveFrom || !group.weeklySlots) return;
  return {
    startsAt: group.effectiveFrom, teacherId: group.teacherId, branchId: group.branchId,
    subjectId: group.subjectId, weeklySlots: group.weeklySlots, pricing: group.pricing,
  };
}

function normalizedPricing(pricing: GroupPricing): GroupPricing {
  switch (pricing.model) {
    case 'center':
      return { ...pricing, monthlyFee: moneyAmount(pricing.monthlyFee), teacherRate: moneyAmount(pricing.teacherRate) };
    case 'private':
      return { ...pricing, monthlyFee: moneyAmount(pricing.monthlyFee), teacherPercentage: moneyAmount(pricing.teacherPercentage) };
    case 'per_session':
      return { ...pricing, teacherFee: moneyAmount(pricing.teacherFee), centerFee: moneyAmount(pricing.centerFee) };
  }
}

interface ScheduleReferences {
  groups: Group[];
  branches: Branch[];
  stages: EducationalStage[];
  subjects: Subject[];
  classrooms: Classroom[];
  teachers: { id: string; fullName: string; isActive: boolean }[];
}

export function buildGroup(tenantId: string, input: GroupInput, refs: ScheduleReferences, now = new Date()): Group {
  const { nameAr, branchId, stageId, gradeId, subjectId, teacherId } = input;
  const current = refs.groups.find(group => group.tenantId === tenantId && group.id === input.id);
  if (current?.archivedAt || (current?.version ?? 0) !== input.version) throw new GroupScheduleError(409, groupConflictMessage);
  if (!refs.branches.some(branch => branch.tenantId === tenantId && branch.id === branchId && branch.isActive)) {
    throw new GroupScheduleError(400, 'اختر فرعًا نشطًا من هذا السنتر');
  }
  if (!refs.stages.some(stage => stage.tenantId === tenantId && stage.id === stageId &&
    stage.grades.some(grade => grade.id === gradeId))) {
    throw new GroupScheduleError(400, 'اختر مرحلة وصفًا من البيانات الأساسية');
  }
  if (!refs.subjects.some(subject => subject.tenantId === tenantId && subject.id === subjectId &&
    subject.stage === stageId && subject.grade === gradeId)) {
    throw new GroupScheduleError(400, 'اختر مادة تابعة للمرحلة والصف المحددين');
  }
  const teacher = refs.teachers.find(teacher => teacher.id === teacherId && teacher.isActive);
  if (!teacher) {
    throw new GroupScheduleError(400, 'اختر معلمًا نشطًا من هذا السنتر');
  }

  const slots = input.weeklySlots;
  if (new Set(slots.map(slot => slot.id)).size !== slots.length) {
    throw new GroupScheduleError(400, 'كل موعد يحتاج معرّفًا مختلفًا');
  }

  const rooms = new Map(refs.classrooms.filter(room => room.tenantId === tenantId && room.branchId === branchId && !room.archivedAt)
    .map(room => [room.id, room]));
  const teachers = new Map(refs.teachers.map(teacher => [teacher.id, teacher]));
  const occupied = refs.groups.filter(group => group.id !== input.id || group.tenantId !== tenantId)
    .flatMap(({ id, tenantId, branchId, teacherId, nameAr, isActive, classroomId, ...group }) =>
      weeklySlots(group).map(slot => ({
        ...slot, id, tenantId, branchId, teacherId, nameAr, isActive, classroomId: slot.classroomId || classroomId,
      })));
  let capacity = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const room = rooms.get(slot.classroomId);
    if (!room) throw new GroupScheduleError(400, 'اختر قاعة من الفرع المحدد لكل موعد');
    const conflict = checkGroupScheduleConflicts({
      tenantId, branchId, classroomId: slot.classroomId, teacherId, dayOfWeek: slot.scheduleDay,
      startTime: slot.startTime, endTime: slot.endTime,
    }, occupied, rooms, teachers);
    if (!conflict.canSchedule) throw new GroupScheduleError(409, conflict.errors[0].messageAr);
    occupied.push({ ...slot, tenantId, branchId, teacherId, nameAr, isActive: true });
    capacity = Math.min(capacity, room.capacity);
  }
  if (input.maxStudents && input.maxStudents > capacity) {
    throw new GroupScheduleError(400, `أقصى عدد للمجموعة حسب القاعات المختارة ${capacity} طالب`);
  }

  const pricing = normalizedPricing(input.pricing);
  const first = slots[0];
  const today = cairoClock(now);
  const previous = current && periodFrom(current);
  const sameSchedule = previous && previous.teacherId === teacherId && previous.branchId === branchId &&
    previous.subjectId === subjectId && JSON.stringify(previous.weeklySlots) === JSON.stringify(slots) &&
    JSON.stringify(previous.pricing) === JSON.stringify(pricing);
  const effectiveFrom = sameSchedule ? previous.startsAt : today;
  const scheduleHistory = previous && !sameSchedule && previous.startsAt < today
    ? [...(current?.scheduleHistory ?? []), { ...previous, endsAt: today }]
    : current?.scheduleHistory ?? [];
  const academicYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    id: input.id, tenantId, nameAr, branchId, stageId, gradeId, subjectId, teacherId, teacherName: teacher.fullName,
    classroomId: first.classroomId, scheduleDay: first.scheduleDay, startTime: first.startTime, endTime: first.endTime,
    pricingModel: pricing.model, pricing, weeklySlots: slots, effectiveFrom, scheduleHistory,
    monthlyFee: pricing.model === 'per_session' ? 0 : pricing.monthlyFee,
    sessionFee: pricing.model === 'per_session' ? moneyAmount(pricing.teacherFee + pricing.centerFee) : 0,
    maxStudents: input.maxStudents ?? capacity, isActive: current?.isActive ?? true,
    academicYear: current?.academicYear ?? `${academicYear}/${academicYear + 1}`,
    createdAt: current?.createdAt ?? now.toISOString(), version: input.version + 1,
    ...(current?.legacyBilling ? { legacyBilling: current.legacyBilling } : current && !current.pricing
      ? { legacyBilling: { model: current.pricingModel, monthlyFee: current.monthlyFee,
        sessionFee: current.sessionFee, teacherId: current.teacherId, subjectId: current.subjectId } } : {}),
  };
}

export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

export function recurringSessions(groups: Group[], from: string, through: string): Session[] {
  const dates: string[] = [];
  for (let date = from; date <= through; date = shiftDate(date, 1)) dates.push(date);
  return groups.flatMap(group => {
    const current = periodFrom(group);
    if (!current || (!group.isActive && !group.archivedAt)) return [];
    const periods = [...(group.scheduleHistory ?? []), { ...current, endsAt: group.archivedAt }];
    const emitted = new Set<string>();
    return periods.flatMap(period => dates.flatMap(sessionDate => {
      if (sessionDate < period.startsAt.slice(0, 10) || (period.endsAt && sessionDate > period.endsAt.slice(0, 10))) return [];
      const day = new Date(sessionDate).getUTCDay();
      return period.weeklySlots.filter(slot => {
        const start = `${sessionDate}T${slot.startTime}`;
        return slot.scheduleDay === day && start >= period.startsAt && (!period.endsAt || start < period.endsAt);
      }).flatMap(slot => {
        const id = `lesson:${group.id}:${slot.id}:${sessionDate}`;
        if (emitted.has(id)) return [];
        emitted.add(id);
        return [{
          id, tenantId: group.tenantId, groupId: group.id,
          branchId: period.branchId, subjectId: period.subjectId, classroomId: slot.classroomId,
          teacherId: period.teacherId, sessionDate, startTime: slot.startTime, endTime: slot.endTime,
          status: 'scheduled' as const, createdAt: group.createdAt, pricing: period.pricing,
        }];
      });
    }));
  });
}

export function sessionDateFromId(id: string) {
  const date = /^lesson:[^:]+:[^:]+:(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];
  return date && Number.isFinite(Date.parse(date)) && shiftDate(date, 0) === date ? date : undefined;
}
