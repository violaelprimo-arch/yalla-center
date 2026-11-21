import { z } from 'zod';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';
import { groupPricingSchema, normalizeGroupPricing } from '@/lib/timetable/group-schedule';
import type { EducationalStage, Group, Subject, User } from '@/lib/dal/types';

export const TEACHER_PERMISSIONS = {
  viewAccount: 'الاطلاع على كشف حساباته',
  publishForum: 'نشر منشور في المنتدى الداخلي',
  viewSchedule: 'الاطلاع على جدول السنتر',
  requestExtraSession: 'طلب محاضرة إضافية خلال الأسبوع',
  viewStudents: 'الاطلاع على الطلاب',
  viewStudentDetails: 'الاطلاع على بيانات الطلاب',
} as const;

export const TEACHER_TABS = {
  account: { label: 'كشف الحساب', permission: 'viewAccount' },
  schedule: { label: 'جدول السنتر', permission: 'viewSchedule' },
  students: { label: 'الطلاب', permission: 'viewStudents' },
  extraSession: { label: 'طلب محاضرة إضافية', permission: 'requestExtraSession' },
  forum: { label: 'المنتدى الداخلي', permission: 'publishForum' },
  materials: { label: 'المذكرات والملازم', permission: 'viewSchedule' },
  exams: { label: 'الامتحانات', permission: 'viewStudents' },
  profile: { label: 'الملف الشخصي', permission: 'viewAccount' },
} as const;

export type TeacherPermission = keyof typeof TEACHER_PERMISSIONS;
export type TeacherTab = keyof typeof TEACHER_TABS;
export const teacherPermissions = Object.keys(TEACHER_PERMISSIONS) as TeacherPermission[];
export const teacherTabs = Object.keys(TEACHER_TABS) as TeacherTab[];

export const LEGACY_TEACHER_MODELS = {
  center: 'نظام السنتر — متوسط الحضور',
  fixed_session: 'أجر ثابت للحصة',
  private: 'نظام البرايفت — نسبة مئوية',
  per_attendee: 'أجر ثابت لكل طالب حاضر في الحصة',
} as const;

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/, 'المعرّف غير صالح');
export const teacherIdSchema = key;

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, char => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, char => String(char.charCodeAt(0) - 0x6f0));
}

const phone = z.string().transform(value => normalizeDigits(value).replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'اكتب رقم هاتف صحيح'));

const legacyPricingSchema = z.object({
  model: z.enum(['center', 'fixed_session', 'private', 'per_attendee']),
  value: z.number().finite().min(0, 'القيمة لازم تكون صفر أو أكثر').max(1000000)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'استخدم رقمًا بمنزلتين عشريتين كحد أقصى'),
}).refine(contract => contract.model !== 'private' || contract.value <= 100, 'نسبة المعلم من صفر إلى 100');

const contractLevel = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/, 'اختر مرحلة أو صفًا');
const contractSchema = z.union([
  groupPricingSchema.transform(normalizeGroupPricing).and(z.object({ level: contractLevel, previousPricing: legacyPricingSchema.optional() })),
  legacyPricingSchema.and(z.object({ level: contractLevel })),
]);

const loginSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('username'), username: z.string().trim().toLowerCase().regex(usernamePattern, 'اسم المستخدم من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا') }),
  z.object({ mode: z.literal('google'), email: z.string().trim().toLowerCase().email('اكتب بريد Google صحيح').max(254) }),
]);

export const teacherInputSchema = z.object({
  fullName: z.string().trim().min(1, 'اسم المعلم مطلوب').max(100),
  phone: phone,
  phone2: z.union([z.literal(''), phone]),
  avatarData: z.string().max(90000).regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/, 'صورة المعلم غير صالحة').nullable(),
  contracts: z.array(contractSchema).max(100)
    .refine(items => new Set(items.map(item => item.level)).size === items.length, 'اختر كل مرحلة أو صف مرة واحدة'),
  subjectIds: z.array(key).max(100).transform(items => [...new Set(items)]),
  login: loginSchema.nullable(),
  permissions: z.array(z.enum(['viewAccount', 'publishForum', 'viewSchedule', 'requestExtraSession', 'viewStudents', 'viewStudentDetails'])).max(6)
    .transform(items => [...new Set(items)]),
  tabs: z.array(z.enum(['account', 'schedule', 'students', 'extraSession', 'forum', 'materials', 'exams', 'profile'])).max(10)
    .transform(items => [...new Set(items)]),
}).superRefine((input, ctx) => {
  if (input.phone2 && input.phone2 === input.phone) {
    ctx.addIssue({ code: 'custom', path: ['phone2'], message: 'رقم الهاتف الثاني لازم يكون مختلفًا' });
  }
  if (input.permissions.includes('viewStudentDetails') && !input.permissions.includes('viewStudents')) {
    ctx.addIssue({ code: 'custom', path: ['permissions'], message: 'فعّل الاطلاع على الطلاب أولًا' });
  }
});

export type TeacherInput = z.output<typeof teacherInputSchema>;
export type TeacherContract = TeacherInput['contracts'][number];
export type LegacyTeacherContract = Extract<TeacherContract, { value: number }>;
export type TeacherLogin = NonNullable<TeacherInput['login']>;

export interface TeacherProfile extends TeacherInput {
  id: string;
  tenantId: string;
  active: boolean;
  version: number;
  updatedAt: string;
  uid?: string;
  createdAt?: string;
}

export interface ExtraSessionRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  date: string;
  time: string;
  note: string;
  createdAt: string;
}

export const extraSessionSchema = z.object({
  id: key,
  groupId: key,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().trim().max(400),
});

export const emptyTeacherInput: TeacherInput = {
  fullName: '', phone: '', phone2: '', avatarData: null, contracts: [], subjectIds: [],
  login: null, permissions: [], tabs: teacherTabs,
};

export function teacherInputFrom(profile?: TeacherProfile, teacher?: User, groups: Group[] = []): TeacherInput {
  if (profile) {
    const { fullName, phone, phone2, avatarData, contracts, subjectIds, login, permissions, tabs } = profile;
    return { fullName, phone, phone2, avatarData, contracts, subjectIds, login, permissions, tabs };
  }

  return {
    ...emptyTeacherInput,
    fullName: teacher?.fullName ?? '',
    phone: teacher?.phone ?? '',
    subjectIds: [...new Set(groups.filter(group => group.teacherId === teacher?.id).map(group => group.subjectId))],
  };
}

export function describeTeacherLevel(level: string, stages: EducationalStage[]) {
  return stages.find(stage => stage.id === level)?.nameAr ??
    stages.flatMap(stage => stage.grades).find(grade => grade.id === level)?.nameAr ??
    getGradeNameArabic(getStageNameArabic(level));
}

export function matchTeacherContract<T extends TeacherContract>(contracts: T[], subject?: Pick<Subject, 'stage' | 'grade'>) {
  if (!subject) return undefined;
  return contracts.find(contract => contract.level === subject.grade) ??
    contracts.find(contract => contract.level === subject.stage);
}

export function matchLegacyTeacherContract(contracts: TeacherContract[], subject?: Subject) {
  return matchTeacherContract(contracts.flatMap(contract => 'value' in contract ? [contract] :
    contract.previousPricing ? [{ ...contract.previousPricing, level: contract.level }] : []), subject);
}

export function invalidTeacherLevel(contracts: TeacherContract[], stages: EducationalStage[], previous: TeacherContract[] = []) {
  const levels = new Set(stages.flatMap(stage => [stage.id, ...stage.grades.map(grade => grade.id)]));
  for (const contract of previous) levels.add(contract.level);
  return contracts.some(contract => !levels.has(contract.level));
}

export function canUseTeacherTab(profile: TeacherProfile, tab: TeacherTab) {
  return profile.active && profile.tabs.includes(tab) && profile.permissions.includes(TEACHER_TABS[tab].permission);
}

export function teacherPasswordEmail(centerSlug: string, username: string) {
  return `${username.trim().toLowerCase()}+${centerSlug}@teachers.yalla-center.invalid`;
}

export function teacherProfileUser(profile: TeacherProfile, base?: User): User {
  return {
    ...base, id: profile.id, tenantId: profile.tenantId, role: 'TEACHER',
    fullName: profile.fullName, phone: profile.phone, avatarUrl: profile.avatarData ?? base?.avatarUrl,
    email: profile.login?.mode === 'google' ? profile.login.email : undefined,
    balanceDue: base?.balanceDue ?? 0, isActive: profile.active,
    createdAt: base?.createdAt ?? profile.updatedAt, updatedAt: profile.updatedAt,
  };
}
