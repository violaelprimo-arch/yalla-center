import type { Branch, Classroom, Group, Subject } from '@/lib/dal/types';
import { WEEKDAYS, weeklySlots } from './group-schedule';

export interface WeeklyScheduleRow {
  id: string;
  groupId: string;
  day: number;
  start: string;
  end: string;
  group: string;
  teacher: string;
  room: string;
  branch: string;
  branchId: string;
  subject: string;
}

export function weeklyScheduleRows(
  groups: Group[],
  classrooms: Classroom[],
  branches: Branch[],
  subjects: Subject[],
  teachers: { id: string; fullName: string }[],
): WeeklyScheduleRow[] {
  const names = new Map(teachers.map(teacher => [teacher.id, teacher.fullName]));
  const rooms = new Map(classrooms.map(room => [room.id, room.nameAr]));
  const locations = new Map(branches.map(branch => [branch.id, branch.nameAr]));
  const courses = new Map(subjects.map(subject => [subject.id, subject.nameAr]));
  const days = new Map<number, number>(WEEKDAYS.map(([day], index) => [day, index]));
  return groups.filter(group => group.isActive).flatMap(group => weeklySlots(group).map(slot => ({
    id: `${group.id}:${slot.id}`,
    groupId: group.id,
    day: slot.scheduleDay,
    start: slot.startTime,
    end: slot.endTime,
    group: group.nameAr,
    teacher: names.get(group.teacherId) ?? group.teacherName ?? 'معلم',
    room: rooms.get(slot.classroomId || group.classroomId) ?? 'قاعة غير محددة',
    branch: locations.get(group.branchId) ?? 'فرع غير محدد',
    branchId: group.branchId,
    subject: courses.get(group.subjectId) ?? '',
  }))).sort((a, b) => (days.get(a.day)! - days.get(b.day)!) || a.start.localeCompare(b.start) ||
    a.room.localeCompare(b.room, 'ar') || a.group.localeCompare(b.group, 'ar'));
}
