import { matchLegacyTeacherContract, type TeacherProfile } from '@/lib/teachers/profile';
import { calculateTeacherSessionPay, countTeacherSessionAttendance } from '@/lib/teachers/session-compensation';
import { cairoClock } from '@/lib/attendance/reception';
import { moneyAmount, recurringSessions, studentGroupFee } from '@/lib/timetable/group-schedule';
import { calculateFixedSessionSplit, splitPrivateFee } from '@/lib/finance/group-pricing';
import {
  calculateCenterSubscriptionCompensation as calcCenterComp,
  calculatePrivateLessonsSplit as calcPrivateSplit,
} from '../finance/compensation';
import { calculateDiscount } from '../finance/discounts';
import { checkStudentEnrollmentConflict } from '../timetable/conflict-detector';
import { extractGoogleDriveFileId, buildDriveLinks } from '../materials/drive';
import { countArabicWords, evaluateIndexingStatus, simulateTextExtraction } from '../materials/indexer';
import { generateGroundedExam } from '../exams/generator';
import { gradeExamSubmission as gradeExam } from '../exams/grading';
import { FirestoreRestClient, type StructuredFilter } from '@/lib/firebase/firestore-rest';
import { getFirebaseProjectId, getServiceAccountAccessToken } from '@/lib/firebase/server';

function readBrowserFallbackToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sessionToken = sessionStorage.getItem('yc_id_token');
    if (sessionToken) return sessionToken.trim();
  } catch {}
  return null;
}
import type {
  Tenant,
  Branch,
  BranchInput,
  Classroom,
  User,
  Subject,
  SubjectInput,
  EducationalStage,
  EducationalStageInput,
  EducationalGrade,
  EducationalGradeInput,
  Group,
  Session,
  Enrollment,
  Attendance,
  Invoice,
  InvoiceStatus,
  Payment,
  TeacherRate,
  TeacherPayroll,
  Material,
  Exam,
  ExamQuestion,
  ExamSubmission,
  NotificationRecord,
  CashierShift,
  Expense,
  BookInventoryItem,
  UserRole,
  SessionStatus,
  PaymentMethod,
  ExamStatus,
  NotificationChannel,
  TeacherAdvance,
  TeacherMonthlyStatement,
  StudentEnrollmentDetail,
  StudentAttendanceDetail,
  CreateStudentInput,
  EnrollStudentInput,
  AttendanceScanResponse,
  SessionAttendanceStats,
  VerificationMethod,
  CreateMaterialInput,
  MaterialsSummaryStats,
  DocumentCategory,
  MaterialIndexStatus,
} from './types';
import type {
  IDataProvider,
  ScanResult,
  CenterSubscriptionResult,
  PrivateLessonItemInput,
  PrivateLessonBatchResult,
  ExamPreflightResult,
} from './index';

const COLLECTIONS = {
  tenants: 'tenants',
  branches: 'master_branches',
  stages: 'master_stages',
  subjects: 'master_subjects',
  classrooms: 'center_classrooms',
  groups: 'center_groups',
  teachers: 'teacher_profiles',
  students: 'center_students',
  enrollments: 'center_enrollments',
  sessions: 'center_sessions',
  attendance: 'center_attendance',
  invoices: 'center_invoices',
  payments: 'center_payments',
  expenses: 'center_expenses',
  shifts: 'center_shifts',
  materials: 'center_materials',
  exams: 'comprehensive_exams',
  examSubmissions: 'exam_submissions',
  notifications: 'center_notifications',
  teacherRates: 'teacher_rates',
  teacherPayroll: 'teacher_payroll',
  teacherAdvances: 'teacher_advances',
  booksInventory: 'books_inventory',
} as const;

export class FirestoreDataProvider implements IDataProvider {
  private readonly explicitToken?: string;

  constructor(options: { callerIdToken?: string } = {}) {
    this.explicitToken = options.callerIdToken;
  }

  private async getClient(requireAuth = true): Promise<FirestoreRestClient> {
    const projectId = getFirebaseProjectId();
    let token = this.explicitToken?.trim() || '';

    if (!token && typeof window === 'undefined') {
      token = (await getServiceAccountAccessToken(fetch).catch(() => null)) || '';
    }
    if (!token && typeof window !== 'undefined') {
      token = readBrowserFallbackToken() || '';
    }

    if (requireAuth && !token) {
      throw new Error('يلزم تسجيل الدخول بحساب Firebase المصرح له للوصول إلى قاعدة البيانات السحابية');
    }

    return new FirestoreRestClient({ projectId, accessToken: token });
  }

  private async queryTenant<T>(
    collectionId: string,
    tenantId: string,
    extraFilters: StructuredFilter[] = [],
    requireAuth = true
  ): Promise<Array<{ id: string; data: T }>> {
    const client = await this.getClient(requireAuth);
    const rows = await client.queryCollection<T>(collectionId, [
      { fieldPath: 'tenantId', op: 'EQUAL', value: tenantId },
      ...extraFilters,
    ]);
    return rows.map((row) => ({ id: row.id, data: row.data }));
  }

  // 1. Tenants & Branches
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return null;
    const client = await this.getClient(false);
    const rows = await client.queryCollection<Tenant>(COLLECTIONS.tenants, [
      { fieldPath: 'slug', op: 'EQUAL', value: cleanSlug },
    ]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ...row.data,
      id: row.data.id || row.id,
      slug: row.data.slug || cleanSlug,
      isActive: row.data.isActive !== false,
      settings: row.data.settings || { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
    };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const cleanId = id.trim();
    if (!cleanId) return null;
    const client = await this.getClient(false);
    const doc = await client.getDocument<Tenant>(`${COLLECTIONS.tenants}/${encodeURIComponent(cleanId)}`);
    if (!doc.exists) return null;
    return {
      ...doc.data,
      id: doc.data.id || cleanId,
      isActive: doc.data.isActive !== false,
      settings: doc.data.settings || { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
    };
  }

  async getTenants(): Promise<Tenant[]> {
    const client = await this.getClient(false);
    const rows = await client.queryCollection<Tenant>(COLLECTIONS.tenants, []);
    return rows.map((row) => ({
      ...row.data,
      id: row.data.id || row.id,
      isActive: row.data.isActive !== false,
      settings: row.data.settings || { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
    }));
  }

  async createTenant(tenant: Tenant): Promise<Tenant> {
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.tenants}/${tenant.id}`,
        data: tenant as unknown as Record<string, unknown>,
      },
    ]);
    return tenant;
  }

  async getBranches(tenantId: string): Promise<Branch[]> {
    const rows = await this.queryTenant<Branch>(COLLECTIONS.branches, tenantId);
    return rows.map((r) => r.data);
  }

  async saveBranch(tenantId: string, branch: BranchInput): Promise<Branch> {
    const client = await this.getClient(true);
    const id = branch.id || `branch-${Date.now()}`;
    const record: Branch = {
      id,
      tenantId,
      nameAr: branch.nameAr.trim(),
      address: branch.address?.trim() || '',
      phone: branch.phone?.trim() || '',
      isActive: branch.isActive !== false,
      createdAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.branches}/${tenantId}~${id}`,
        data: record as unknown as Record<string, unknown>,
      },
    ]);
    return record;
  }

  async deleteBranch(tenantId: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.getClient(true);
    await client.commit([
      { type: 'delete', documentPath: `${COLLECTIONS.branches}/${tenantId}~${branchId}` },
    ]);
    return { success: true };
  }

  async getClassrooms(tenantId: string, branchId?: string): Promise<Classroom[]> {
    const rows = await this.queryTenant<Classroom>(COLLECTIONS.classrooms, tenantId);
    return rows
      .map((r) => r.data)
      .filter((c) => !c.archivedAt && (!branchId || c.branchId === branchId));
  }

  // Stages & Grades
  async getStages(tenantId: string): Promise<EducationalStage[]> {
    const rows = await this.queryTenant<EducationalStage>(COLLECTIONS.stages, tenantId);
    return rows
      .filter((r) => r.id !== `${tenantId}~__catalog_revision` && Boolean(r.data.nameAr))
      .map((r) => r.data)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async saveStage(tenantId: string, stage: EducationalStageInput): Promise<EducationalStage> {
    const client = await this.getClient(true);
    const id = stage.id || `stage-${Date.now()}`;
    const existing = await client.getDocument<EducationalStage>(`${COLLECTIONS.stages}/${tenantId}~${id}`);
    const record: EducationalStage = {
      id,
      tenantId,
      nameAr: stage.nameAr.trim(),
      order: stage.order ?? (existing.exists ? existing.data.order : 1),
      grades: existing.exists ? existing.data.grades || [] : [],
      createdAt: existing.exists ? existing.data.createdAt : new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.stages}/${tenantId}~${id}`,
        data: record as unknown as Record<string, unknown>,
      },
    ]);
    return record;
  }

  async deleteStage(tenantId: string, stageId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.getClient(true);
    await client.commit([
      { type: 'delete', documentPath: `${COLLECTIONS.stages}/${tenantId}~${stageId}` },
    ]);
    return { success: true };
  }

  async saveGrade(tenantId: string, grade: EducationalGradeInput): Promise<EducationalGrade> {
    const client = await this.getClient(true);
    const stagePath = `${COLLECTIONS.stages}/${tenantId}~${grade.stageId}`;
    const snap = await client.getDocument<EducationalStage>(stagePath);
    if (!snap.exists) {
      throw new Error('المرحلة التعليمية غير موجودة');
    }
    const id = grade.id || `grade-${Date.now()}`;
    const existingGrades = snap.data.grades || [];
    const nextGrade: EducationalGrade = {
      id,
      tenantId,
      stageId: grade.stageId,
      nameAr: grade.nameAr.trim(),
      order: grade.order ?? existingGrades.length + 1,
      hasDivisions: grade.hasDivisions,
      divisions: grade.divisions,
      createdAt: new Date().toISOString(),
    };
    const nextGrades = existingGrades.some((g) => g.id === id)
      ? existingGrades.map((g) => (g.id === id ? nextGrade : g))
      : [...existingGrades, nextGrade];
    await client.commit([
      {
        type: 'set',
        documentPath: stagePath,
        data: { ...snap.data, grades: nextGrades } as unknown as Record<string, unknown>,
      },
    ]);
    return nextGrade;
  }

  async deleteGrade(tenantId: string, gradeId: string): Promise<{ success: boolean; error?: string }> {
    const stages = await this.getStages(tenantId);
    const stage = stages.find((s) => s.grades.some((g) => g.id === gradeId));
    if (!stage) return { success: false, error: 'الصف غير موجود' };
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.stages}/${tenantId}~${stage.id}`,
        data: {
          ...stage,
          grades: stage.grades.filter((g) => g.id !== gradeId),
        } as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true };
  }

  // 2. Users & RBAC
  async getUserById(userId: string): Promise<User | null> {
    const client = await this.getClient(true);
    const studentRows = await client.queryCollection<User>(COLLECTIONS.students, [
      { fieldPath: 'id', op: 'EQUAL', value: userId },
    ]);
    if (studentRows.length > 0) return studentRows[0].data;
    const teacherRows = await client.queryCollection<TeacherProfile>(COLLECTIONS.teachers, [
      { fieldPath: 'id', op: 'EQUAL', value: userId },
    ]);
    if (teacherRows.length > 0) {
      const t = teacherRows[0].data;
      return {
        id: t.id,
        tenantId: t.tenantId,
        role: 'TEACHER',
        fullName: t.fullName,
        phone: t.phone,
        isActive: t.active,
        balanceDue: 0,
        createdAt: t.updatedAt || '',
        updatedAt: t.updatedAt || '',
      };
    }
    return null;
  }

  async getUserByStudentCode(tenantId: string, code: string): Promise<User | null> {
    const clean = code.trim().toLowerCase();
    const students = await this.getUsers(tenantId, { role: 'STUDENT' });
    return (
      students.find(
        (s) => s.studentCode?.toLowerCase() === clean || s.id.toLowerCase() === clean
      ) || null
    );
  }

  async getUsers(tenantId: string, filter?: { role?: UserRole; search?: string }): Promise<User[]> {
    const users: User[] = [];
    if (!filter?.role || filter.role === 'STUDENT') {
      const studentRows = await this.queryTenant<User>(COLLECTIONS.students, tenantId);
      for (const r of studentRows) {
        if (r.data.isActive !== false) users.push({ ...r.data, role: 'STUDENT' });
      }
    }
    if (!filter?.role || filter.role === 'TEACHER') {
      const teacherRows = await this.queryTenant<TeacherProfile>(COLLECTIONS.teachers, tenantId);
      for (const r of teacherRows) {
        const t = r.data;
        users.push({
          id: t.id,
          tenantId: t.tenantId,
          role: 'TEACHER',
          fullName: t.fullName,
          phone: t.phone,
          isActive: t.active,
          balanceDue: 0,
          createdAt: t.updatedAt || '',
          updatedAt: t.updatedAt || '',
        });
      }
    }
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      return users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.studentCode?.toLowerCase().includes(q) ||
          u.phone?.includes(q)
      );
    }
    return users;
  }

  async updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<{ success: boolean; data?: User; error?: string; status: number }> {
    const existing = await this.getUserById(userId);
    if (!existing || !existing.tenantId) {
      return { success: false, error: 'المستخدم غير موجود', status: 404 };
    }
    const client = await this.getClient(true);
    const updated: User = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      updatedAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.students}/${existing.tenantId}~${existing.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, data: updated, status: 200 };
  }

  async updateUserProfilePhoto(
    userId: string,
    avatarUrl: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string }> {
    if (actorId !== userId && actorRole !== 'CENTER_ADMIN' && actorRole !== 'PLATFORM_OWNER') {
      return { success: false, error: 'غير مصرح بتعديل صورة هذا الحساب' };
    }
    const client = await this.getClient(true);
    const now = new Date().toISOString();
    await client.commit([
      {
        type: 'set',
        documentPath: `users/${userId}`,
        data: { uid: userId, avatarUrl, photoUrl: avatarUrl, updatedAt: now },
      },
    ]);
    const existing = await this.getUserById(userId).catch(() => null);
    if (existing) {
      return { success: true, data: { ...existing, avatarUrl, updatedAt: now } };
    }
    return { success: true };
  }

  // 3. Subjects & Groups
  async getSubjects(tenantId: string, filter?: { stage?: string; grade?: string }): Promise<Subject[]> {
    const rows = await this.queryTenant<Subject>(COLLECTIONS.subjects, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (s) =>
          (!filter?.stage || s.stage === filter.stage) &&
          (!filter?.grade || s.grade === filter.grade)
      );
  }

  async saveSubject(tenantId: string, subject: SubjectInput): Promise<Subject> {
    const client = await this.getClient(true);
    const id = subject.id || `subj-${Date.now()}`;
    const record: Subject = {
      id,
      tenantId,
      nameAr: subject.nameAr.trim(),
      code: subject.code?.trim() || '',
      stage: subject.stage,
      grade: subject.grade,
      createdAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.subjects}/${tenantId}~${id}`,
        data: record as unknown as Record<string, unknown>,
      },
    ]);
    return record;
  }

  async deleteSubject(tenantId: string, subjectId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.getClient(true);
    await client.commit([
      { type: 'delete', documentPath: `${COLLECTIONS.subjects}/${tenantId}~${subjectId}` },
    ]);
    return { success: true };
  }

  async getGroups(tenantId: string, filter?: { branchId?: string; teacherId?: string }): Promise<Group[]> {
    const rows = await this.queryTenant<Group>(COLLECTIONS.groups, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (g) =>
          (!filter?.branchId || g.branchId === filter.branchId) &&
          (!filter?.teacherId || g.teacherId === filter.teacherId)
      );
  }

  async getGroupById(tenantId: string, groupId: string): Promise<Group | null> {
    const groups = await this.getGroups(tenantId);
    return groups.find((g) => g.id === groupId) || null;
  }

  // 4. Sessions
  async getSessions(
    tenantId: string,
    filter?: { groupId?: string; date?: string; teacherId?: string }
  ): Promise<Session[]> {
    const extra: StructuredFilter[] = [];
    if (filter?.groupId) extra.push({ fieldPath: 'groupId', op: 'EQUAL', value: filter.groupId });
    if (filter?.date) extra.push({ fieldPath: 'sessionDate', op: 'EQUAL', value: filter.date });

    const [savedRows, groups] = await Promise.all([
      this.queryTenant<Session>(COLLECTIONS.sessions, tenantId, extra),
      this.getGroups(tenantId, filter?.teacherId ? { teacherId: filter.teacherId } : undefined),
    ]);

    const saved = savedRows
      .map((r) => r.data)
      .filter((s) => !filter?.teacherId || s.teacherId === filter.teacherId);
    const savedIds = new Set(saved.map((s) => s.id));

    const today = cairoClock().slice(0, 10);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const from = filter?.date || new Date(todayMs - 7 * 86400000).toISOString().slice(0, 10);
    const through = filter?.date || new Date(todayMs + 7 * 86400000).toISOString().slice(0, 10);
    const generated = recurringSessions(groups, from, through).filter((s) => !savedIds.has(s.id));

    return [...saved, ...generated].filter(
      (s) =>
        (!filter?.groupId || s.groupId === filter.groupId) &&
        (!filter?.teacherId || s.teacherId === filter.teacherId)
    );
  }

  async getSessionById(tenantId: string, sessionId: string): Promise<Session | null> {
    const client = await this.getClient(true);
    const snap = await client.getDocument<Session>(`${COLLECTIONS.sessions}/${tenantId}~${sessionId}`);
    if (snap.exists) return snap.data;
    const sessions = await this.getSessions(tenantId, { date: sessionId.slice(-10) }).catch(() => []);
    return sessions.find((s) => s.id === sessionId) || null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    cancellationReason?: string
  ): Promise<Session> {
    const client = await this.getClient(true);
    const rows = await client.queryCollection<Session>(COLLECTIONS.sessions, [
      { fieldPath: 'id', op: 'EQUAL', value: sessionId },
    ]);
    if (rows.length === 0) throw new Error('الحصة غير موجودة');
    const current = rows[0].data;
    const updated: Session = {
      ...current,
      status,
      cancellationReason: status === 'canceled' ? cancellationReason : undefined,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.sessions}/${current.tenantId}~${current.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return updated;
  }

  // 5. Enrollments & Students
  async getEnrollments(
    tenantId: string,
    filter?: { groupId?: string; studentId?: string }
  ): Promise<Enrollment[]> {
    const extra: StructuredFilter[] = [];
    if (filter?.groupId) extra.push({ fieldPath: 'groupId', op: 'EQUAL', value: filter.groupId });
    if (filter?.studentId) extra.push({ fieldPath: 'studentId', op: 'EQUAL', value: filter.studentId });
    const rows = await this.queryTenant<Enrollment>(COLLECTIONS.enrollments, tenantId, extra);
    return rows.map((r) => r.data);
  }

  async createStudent(tenantId: string, input: CreateStudentInput): Promise<User> {
    const client = await this.getClient(true);
    const now = new Date().toISOString();
    const id = `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const student: User = {
      id,
      tenantId,
      role: 'STUDENT',
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || '',
      stage: input.stage,
      grade: input.grade,
      division: input.division,
      nationalId: input.nationalId,
      seatNumber: input.seatNumber,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      avatarUrl: input.avatarUrl,
      studentCode: input.studentCode?.trim() || `STD-${Math.floor(10000 + Math.random() * 90000)}`,
      balanceDue: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.students}/${tenantId}~${id}`,
        data: student as unknown as Record<string, unknown>,
      },
    ]);
    return student;
  }

  async enrollStudent(
    input: EnrollStudentInput
  ): Promise<{ success: boolean; enrollment?: Enrollment; invoice?: Invoice; error?: string }> {
    const [groups, allEnrollments] = await Promise.all([
      this.getGroups(input.tenantId),
      this.getEnrollments(input.tenantId),
    ]);
    const targetGroup = groups.find((g) => g.id === input.groupId);
    if (!targetGroup) return { success: false, error: 'المجموعة غير موجودة' };

    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const studentActiveGroups = allEnrollments
      .filter((e) => e.studentId === input.studentId && e.isActive)
      .map((e) => groupMap.get(e.groupId))
      .filter((g): g is Group => Boolean(g));
    const currentEnrolledCount = allEnrollments.filter(
      (e) => e.groupId === input.groupId && e.isActive
    ).length;

    const conflict = checkStudentEnrollmentConflict(
      targetGroup,
      studentActiveGroups,
      currentEnrolledCount
    );
    if (conflict.hasConflict) {
      return { success: false, error: conflict.errors[0]?.messageAr || 'تعارض في المواعيد' };
    }

    const client = await this.getClient(true);
    const now = new Date().toISOString();
    const enrollmentId = `enr-${Date.now()}`;
    const enrollment: Enrollment = {
      id: enrollmentId,
      tenantId: input.tenantId,
      studentId: input.studentId,
      groupId: input.groupId,
      pricingModel: input.pricingModel,
      discountType: input.discountType,
      discountValue: input.discountValue,
      enrolledAt: now,
      isActive: true,
    };

    const discount = calculateDiscount({
      basePrice: studentGroupFee(targetGroup),
      discountType: input.discountType,
      discountValue: input.discountValue,
    });
    const invoiceId = `inv-${Date.now()}`;
    const invoice: Invoice = {
      id: invoiceId,
      tenantId: input.tenantId,
      studentId: input.studentId,
      groupId: input.groupId,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      totalAmount: discount.basePrice,
      discountAmount: discount.discountAmount,
      netAmount: discount.netPrice,
      paidAmount: 0,
      status: discount.netPrice === 0 ? 'paid' : 'pending',
      billingMonth: new Date().getMonth() + 1,
      billingYear: new Date().getFullYear(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: now,
    };

    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.enrollments}/${input.tenantId}~${enrollmentId}`,
        data: enrollment as unknown as Record<string, unknown>,
      },
      {
        type: 'set',
        documentPath: `${COLLECTIONS.invoices}/${input.tenantId}~${invoiceId}`,
        data: invoice as unknown as Record<string, unknown>,
      },
    ]);

    return { success: true, enrollment, invoice };
  }

  async unenrollStudent(tenantId: string, enrollmentId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.getClient(true);
    await client.commit([
      { type: 'delete', documentPath: `${COLLECTIONS.enrollments}/${tenantId}~${enrollmentId}` },
    ]);
    return { success: true };
  }

  async getStudentEnrollmentDetails(tenantId: string, studentId: string): Promise<StudentEnrollmentDetail[]> {
    const [enrollments, groups, subjects, teachers] = await Promise.all([
      this.getEnrollments(tenantId, { studentId }),
      this.getGroups(tenantId),
      this.getSubjects(tenantId),
      this.getUsers(tenantId, { role: 'TEACHER' }),
    ]);
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const details: StudentEnrollmentDetail[] = [];
    for (const e of enrollments) {
      const g = groupMap.get(e.groupId);
      if (!g) continue;
      const s = subjectMap.get(g.subjectId);
      const t = teacherMap.get(g.teacherId);
      details.push({
        ...e,
        group: g,
        subject: s,
        teacher: t,
      });
    }
    return details;
  }

  async getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceDetail[]> {
    const client = await this.getClient(true);
    const rows = await client.queryCollection<Attendance>(COLLECTIONS.attendance, [
      { fieldPath: 'tenantId', op: 'EQUAL', value: tenantId },
      { fieldPath: 'studentId', op: 'EQUAL', value: studentId },
    ]);
    const [sessions, groups] = await Promise.all([
      this.getSessions(tenantId),
      this.getGroups(tenantId),
    ]);
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const history: StudentAttendanceDetail[] = [];
    for (const r of rows) {
      const att = r.data;
      const sess = sessionMap.get(att.sessionId);
      if (!sess) continue;
      const grp = groupMap.get(sess.groupId);
      history.push({
        ...att,
        session: sess,
        group: grp,
      });
    }
    return history;
  }

  // 6. Fast Reception Attendance
  async recordAttendance(params: {
    tenantId: string;
    sessionId: string;
    studentIdOrCode: string;
    verificationMethod?: 'barcode' | 'qr' | 'manual';
    cashierUserId?: string;
  }): Promise<ScanResult> {
    const res = await this.recordAttendanceScan(
      params.tenantId,
      params.sessionId,
      params.studentIdOrCode,
      params.cashierUserId,
      params.verificationMethod
    );
    return {
      success: res.success,
      isNewRecord: res.isNewRecord,
      duplicate: res.isDuplicate,
      attendance: res.attendance,
      student: res.student,
      session: res.session,
      balanceAlert: res.balanceAlert,
      messageAr: res.messageAr,
    };
  }

  async recordAttendanceScan(
    tenantId: string,
    sessionId: string,
    studentCodeOrId: string,
    recordedByUserId?: string,
    verificationMethod: VerificationMethod = 'barcode'
  ): Promise<AttendanceScanResponse> {
    const student = await this.getUserByStudentCode(tenantId, studentCodeOrId);
    if (!student) throw new Error('لم يتم العثور على طالب بهذا الكود');
    const session = await this.getSessionById(tenantId, sessionId);
    if (!session) throw new Error('الحصة غير موجودة');

    const client = await this.getClient(true);
    const docId = `${sessionId}_${student.id}`;
    const docPath = `${COLLECTIONS.attendance}/${docId}`;
    const existing = await client.getDocument<Attendance>(docPath);
    const now = new Date().toISOString();

    if (existing.exists) {
      return {
        success: true,
        isDuplicate: true,
        duplicate: true,
        isNewRecord: false,
        status: existing.data.status,
        scannedAt: existing.data.scannedAt,
        recordedAt: existing.data.scannedAt,
        sessionId,
        studentId: student.id,
        studentCode: student.studentCode || '',
        studentName: student.fullName,
        message: `تم تسجيل حضور ${student.fullName} مسبقاً لهذه الحصة`,
        messageAr: `تم تسجيل حضور ${student.fullName} مسبقاً لهذه الحصة`,
        attendance: existing.data,
        student,
        session,
        balanceAlert: {
          hasBalance: student.balanceDue > 0,
          balanceDue: student.balanceDue,
          messageAr: student.balanceDue > 0 ? `مستحقات متبقية: ${student.balanceDue} ج.م` : 'لا توجد مستحقات',
        },
      };
    }

    const attendance: Attendance = {
      id: `att-${docId}`,
      tenantId,
      sessionId,
      studentId: student.id,
      status: 'present',
      verificationMethod,
      cashierUserId: recordedByUserId,
      scannedAt: now,
    };
    await client.commit([
      { type: 'set', documentPath: docPath, data: attendance as unknown as Record<string, unknown> },
    ]);

    return {
      success: true,
      isDuplicate: false,
      duplicate: false,
      isNewRecord: true,
      status: 'present',
      scannedAt: now,
      recordedAt: now,
      sessionId,
      studentId: student.id,
      studentCode: student.studentCode || '',
      studentName: student.fullName,
      message: `تم تسجيل حضور ${student.fullName} بنجاح`,
      messageAr: `تم تسجيل حضور ${student.fullName} بنجاح`,
      attendance,
      student,
      session,
      balanceAlert: {
        hasBalance: student.balanceDue > 0,
        balanceDue: student.balanceDue,
        messageAr: student.balanceDue > 0 ? `مستحقات متبقية: ${student.balanceDue} ج.م` : 'لا توجد مستحقات',
      },
    };
  }

  async getSessionAttendance(sessionId: string): Promise<Attendance[]> {
    const client = await this.getClient(true);
    const rows = await client.queryCollection<Attendance>(COLLECTIONS.attendance, [
      { fieldPath: 'sessionId', op: 'EQUAL', value: sessionId },
    ]);
    return rows.map((r) => r.data);
  }

  async getSessionAttendanceStats(tenantId: string, sessionId: string): Promise<SessionAttendanceStats> {
    const session = await this.getSessionById(tenantId, sessionId);
    if (!session) {
      throw new Error('الحصة غير موجودة');
    }
    const [records, enrollments, students, group, invoices] = await Promise.all([
      this.getSessionAttendance(sessionId),
      this.getEnrollments(tenantId, { groupId: session.groupId }),
      this.getUsers(tenantId, { role: 'STUDENT' }),
      this.getGroupById(tenantId, session.groupId),
      this.getInvoices(tenantId),
    ]);
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const activeEnrollments = enrollments.filter((e) => e.isActive);
    const totalEnrolled = activeEnrollments.length;
    const presentCount = records.filter((r) => r.status === 'present').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const excusedCount = records.filter((r) => r.status === 'excused').length;
    const absentCount = Math.max(0, totalEnrolled - (presentCount + lateCount + excusedCount));
    const attendedTotal = presentCount + lateCount;
    const attendanceRatePercentage =
      totalEnrolled > 0 ? Math.round((attendedTotal / totalEnrolled) * 10000) / 100 : 0;

    const pricing = session.pricing;
    const sessionFee = group?.sessionFee || group?.monthlyFee || 0;
    const fixedSessionSplit =
      pricing?.model === 'per_session'
        ? calculateFixedSessionSplit(
            pricing,
            invoices.filter((inv) => inv.sessionId === sessionId && inv.status !== 'void')
          )
        : undefined;

    let lastScannedAt: string | undefined;
    let studentsWithBalanceDueCount = 0;

    const enrichedRecords = records.map((r) => {
      const st = studentMap.get(r.studentId);
      if (!lastScannedAt || new Date(r.scannedAt) > new Date(lastScannedAt)) {
        lastScannedAt = r.scannedAt;
      }
      const balanceDue = st?.balanceDue ?? 0;
      if (balanceDue > 0) studentsWithBalanceDueCount += 1;
      return {
        attendanceId: r.id,
        studentId: r.studentId,
        studentName: st?.fullName || 'طالب',
        studentCode: st?.studentCode || r.studentId,
        status: r.status,
        scannedAt: r.scannedAt,
        verificationMethod: r.verificationMethod,
        balanceDue,
        avatarUrl: st?.avatarUrl,
      };
    });

    return {
      sessionId,
      tenantId,
      groupId: session.groupId,
      groupName: group?.nameAr || 'مجموعة غير محددة',
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      totalEnrolled,
      presentCount,
      lateCount,
      absentCount,
      excusedCount,
      attendanceRatePercentage,
      totalSessionFeeCollected: fixedSessionSplit?.collected ?? (pricing ? 0 : attendedTotal * sessionFee),
      ...(fixedSessionSplit ? { fixedSessionSplit } : {}),
      studentsWithBalanceDueCount,
      lastScannedAt,
      records: enrichedRecords,
    };
  }

  // 7. Teacher Rates & Dual Compensation
  async getTeacherRates(tenantId: string, teacherId?: string): Promise<TeacherRate[]> {
    const extra: StructuredFilter[] = teacherId ? [{ fieldPath: 'teacherId', op: 'EQUAL', value: teacherId }] : [];
    const rows = await this.queryTenant<TeacherRate>(COLLECTIONS.teacherRates, tenantId, extra);
    return rows.map((r) => r.data);
  }

  async updateTeacherRate(
    rateId: string,
    updates: Partial<TeacherRate>,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherRate; error?: string; status: number }> {
    if (!['CENTER_ADMIN', 'PLATFORM_OWNER', 'ACCOUNTANT'].includes(actorRole)) {
      return { success: false, error: 'صلاحية الإدارة مطلوبة', status: 403 };
    }
    const client = await this.getClient(true);
    const rows = await client.queryCollection<TeacherRate>(COLLECTIONS.teacherRates, [
      { fieldPath: 'id', op: 'EQUAL', value: rateId },
    ]);
    if (rows.length === 0) return { success: false, error: 'غير موجود', status: 404 };
    const updated = { ...rows[0].data, ...updates };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.teacherRates}/${updated.tenantId}~${updated.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, data: updated, status: 200 };
  }

  calculateCenterSubscriptionCompensation(
    sessions: Array<{ sessionId: string; sessionStatus: SessionStatus; validAttendanceCount: number }>,
    contractualFixedRate: number
  ): CenterSubscriptionResult {
    const res = calcCenterComp(sessions, contractualFixedRate);
    return {
      conductedSessionsCount: res.conductedSessions,
      totalValidAttendance: res.totalValidAttendance ?? 0,
      averageAttendance: res.averageAttendance,
      contractualRate: contractualFixedRate,
      compensationAmount: res.totalCompensation,
      excludedSessionsCount: res.excludedSessionsCount ?? 0,
    };
  }

  calculatePrivateLessonsSplit(items: PrivateLessonItemInput[], teacherPercentage: number): PrivateLessonBatchResult {
    if (teacherPercentage < 0 || teacherPercentage > 100) {
      throw new Error('Teacher percentage must be between 0 and 100');
    }

    let totalGrossInvoiced = 0;
    let totalDiscountAmount = 0;
    let totalNetRevenue = 0;
    let totalTeacherShare = 0;
    let totalCenterShare = 0;
    let totalCollected = 0;
    let totalCollectedTeacherShare = 0;

    const results = items.map((item) => {
      const typeMap: Record<string, 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100'> = {
        none: 'NONE',
        percentage: 'PERCENT',
        fixed: 'FIXED',
        free_100: 'SCHOLARSHIP_100',
      };
      const split = calcPrivateSplit(
        item.basePrice,
        typeMap[item.discountType] || 'NONE',
        item.discountValue,
        teacherPercentage,
        100 - teacherPercentage
      );

      const collected = Math.min(split.netRevenue, Math.max(0, item.collectedAmount));
      const collectedTeacher = Math.round(collected * (teacherPercentage / 100) * 100) / 100;

      totalGrossInvoiced += item.basePrice;
      totalDiscountAmount += split.discountAmount;
      totalNetRevenue += split.netRevenue;
      totalTeacherShare += split.teacherShare;
      totalCenterShare += split.centerShare;
      totalCollected += collected;
      totalCollectedTeacherShare += collectedTeacher;

      return {
        enrollmentId: item.enrollmentId,
        netRevenue: split.netRevenue,
        teacherShare: split.teacherShare,
        centerShare: split.centerShare,
        invoicedBalance: Math.round((split.netRevenue - collected) * 100) / 100,
        collectedAmount: collected,
      };
    });

    const roundingLeakage = Math.abs(
      Math.round((totalNetRevenue - (totalTeacherShare + totalCenterShare)) * 100) / 100
    );

    return {
      totalGrossInvoiced: Math.round(totalGrossInvoiced * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
      totalTeacherShare: Math.round(totalTeacherShare * 100) / 100,
      totalCenterShare: Math.round(totalCenterShare * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalCollectedTeacherShare: Math.round(totalCollectedTeacherShare * 100) / 100,
      roundingLeakage,
      items: results,
    };
  }

  async getTeacherPayroll(
    tenantId: string,
    filter?: { teacherId?: string; year?: number; month?: number }
  ): Promise<TeacherPayroll[]> {
    const rows = await this.queryTenant<TeacherPayroll>(COLLECTIONS.teacherPayroll, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (p) =>
          (!filter?.teacherId || p.teacherId === filter.teacherId) &&
          (!filter?.year || p.payrollYear === filter.year) &&
          (!filter?.month || p.payrollMonth === filter.month)
      );
  }

  async calculateMonthlyTeacherPayroll(params: {
    tenantId: string;
    teacherId: string;
    year: number;
    month: number;
    teacherProfile?: Pick<TeacherProfile, 'id' | 'tenantId' | 'fullName' | 'phone' | 'contracts'>;
    persistDraft?: boolean;
  }): Promise<TeacherMonthlyStatement> {
    const monthKey = `${params.year}-${String(params.month).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const monthEnd = new Date(Date.UTC(params.year, params.month, 0)).toISOString().slice(0, 10);

    const [
      teacherGroupsAll,
      savedSessionsRows,
      classrooms,
      subjects,
      allInvoices,
      allEnrollments,
      students,
      teacherRates,
      allAdvances,
      payrolls,
      teacherUser,
    ] = await Promise.all([
      this.getGroups(params.tenantId),
      this.queryTenant<Session>(COLLECTIONS.sessions, params.tenantId),
      this.getClassrooms(params.tenantId),
      this.getSubjects(params.tenantId),
      this.getInvoices(params.tenantId),
      this.getEnrollments(params.tenantId),
      this.getUsers(params.tenantId, { role: 'STUDENT' }),
      this.getTeacherRates(params.tenantId, params.teacherId),
      this.getTeacherAdvances(params.tenantId, { teacherId: params.teacherId }),
      this.getTeacherPayroll(params.tenantId, { teacherId: params.teacherId, year: params.year, month: params.month }),
      this.getUserById(params.teacherId),
    ]);

    const profile =
      params.teacherProfile?.id === params.teacherId && params.teacherProfile.tenantId === params.tenantId
        ? params.teacherProfile
        : undefined;
    const teacherName = profile?.fullName ?? teacherUser?.fullName ?? 'معلم';
    const teacherPhone = profile?.phone ?? teacherUser?.phone;

    const savedMonthSessions = savedSessionsRows
      .map((r) => r.data)
      .filter((s) => s.sessionDate >= monthStart && s.sessionDate <= monthEnd);
    const savedIds = new Set(savedMonthSessions.map((s) => s.id));
    const generatedMonthSessions = recurringSessions(teacherGroupsAll, monthStart, monthEnd).filter(
      (s) => !savedIds.has(s.id)
    );
    const monthSessions = [...savedMonthSessions, ...generatedMonthSessions].filter(
      (s) => s.teacherId === params.teacherId
    );
    const monthlyInvoices = allInvoices.filter(
      (inv) => inv.billingMonth === params.month && inv.billingYear === params.year && inv.status !== 'void'
    );

    const historicalGroups = new Set([
      ...monthSessions.map((s) => s.groupId),
      ...monthlyInvoices.filter((inv) => inv.teacherId === params.teacherId).map((inv) => inv.groupId),
      ...teacherGroupsAll
        .filter(
          (g) =>
            g.legacyBilling?.teacherId === params.teacherId &&
            monthlyInvoices.some((inv) => inv.groupId === g.id)
        )
        .map((g) => g.id),
    ]);

    const teacherGroups = teacherGroupsAll.filter(
      (g) => g.teacherId === params.teacherId || historicalGroups.has(g.id)
    );

    const attendanceLists = await Promise.all(monthSessions.map((s) => this.getSessionAttendance(s.id)));
    const monthAttendance = attendanceLists.flat();

    const roomNames = new Map(classrooms.map((room) => [room.id, room.nameAr]));
    const sessionDetails = (session: Session) => ({
      startTime: session.startTime,
      endTime: session.endTime,
      classroomName: roomNames.get(session.classroomId ?? ''),
      notes: session.cancellationReason ?? session.notes,
    });
    const subjectNames = [
      ...new Set(
        teacherGroups
          .map((group) => subjects.find((subject) => subject.id === group.subjectId)?.nameAr)
          .filter((name): name is string => Boolean(name))
      ),
    ];
    const contractsByGroup = new Map(
      teacherGroups.map((group) => [
        group.id,
        group.pricing && !group.legacyBilling
          ? undefined
          : matchLegacyTeacherContract(
              profile?.contracts ?? [],
              subjects.find((subject) => subject.id === (group.legacyBilling?.subjectId ?? group.subjectId))
            ),
      ])
    );

    const lessonRows: NonNullable<TeacherMonthlyStatement['lessonCompensation']>['sessions'] = [];
    const centerGroupStatements: TeacherMonthlyStatement['centerSubscription']['groups'] = [];

    for (const group of teacherGroups) {
      const contract = contractsByGroup.get(group.id);
      const sessions = monthSessions.filter((session) => session.groupId === group.id);
      const legacyModel = group.legacyBilling?.model ?? (!group.pricing ? group.pricingModel : undefined);
      const averageSessions = new Map<number, typeof sessions>();

      for (const session of sessions) {
        let pricing = session.pricing;
        if (!pricing && group.scheduleHistory && group.scheduleHistory.length > 0) {
          const matchPeriod = group.scheduleHistory.find(
            (p) =>
              p.teacherId === session.teacherId &&
              session.sessionDate >= p.startsAt.slice(0, 10) &&
              (!p.endsAt || session.sessionDate <= p.endsAt.slice(0, 10))
          );
          if (matchPeriod?.pricing) pricing = matchPeriod.pricing;
        }
        if (!pricing) pricing = group.pricing;

        const attendanceCount = countTeacherSessionAttendance(monthAttendance, session);
        if (pricing?.model === 'center') {
          const entries = averageSessions.get(pricing.teacherRate) ?? [];
          entries.push(session);
          averageSessions.set(pricing.teacherRate, entries);
        } else if (pricing?.model === 'fixed_session' && session.status === 'completed') {
          const teacherDue = moneyAmount(pricing.sessionFee);
          const tickets = monthlyInvoices.filter((invoice) => invoice.sessionId === session.id);
          const revenue =
            tickets.length > 0
              ? moneyAmount(tickets.reduce((sum, inv) => sum + inv.netAmount, 0))
              : teacherDue;
          lessonRows.push({
            sessionId: session.id,
            sessionDate: session.sessionDate,
            groupName: group.nameAr,
            ...sessionDetails(session),
            attendanceCount,
            model: 'fixed_session',
            rate: pricing.sessionFee,
            revenue,
            teacherDue,
            centerNet: moneyAmount(Math.max(0, revenue - teacherDue)),
            teacherCollected: teacherDue,
          });
        } else if (pricing?.model === 'per_attendee' && session.status === 'completed') {
          const teacherDue = moneyAmount(attendanceCount * pricing.ratePerStudent);
          const tickets = monthlyInvoices.filter((invoice) => invoice.sessionId === session.id);
          const revenue =
            tickets.length > 0
              ? moneyAmount(tickets.reduce((sum, inv) => sum + inv.netAmount, 0))
              : moneyAmount(attendanceCount * (pricing.studentFee || pricing.ratePerStudent));
          lessonRows.push({
            sessionId: session.id,
            sessionDate: session.sessionDate,
            groupName: group.nameAr,
            ...sessionDetails(session),
            attendanceCount,
            model: 'per_attendee',
            rate: pricing.ratePerStudent,
            revenue,
            teacherDue,
            centerNet: moneyAmount(Math.max(0, revenue - teacherDue)),
            teacherCollected: teacherDue,
          });
        } else if (pricing?.model === 'per_session' && session.status === 'completed') {
          const tickets = monthlyInvoices.filter((invoice) => invoice.sessionId === session.id);
          lessonRows.push({
            sessionId: session.id,
            sessionDate: session.sessionDate,
            groupName: group.nameAr,
            ...sessionDetails(session),
            attendanceCount,
            model: 'per_session',
            rate: pricing.teacherFee,
            ...calculateFixedSessionSplit(pricing, tickets),
          });
        } else if (!pricing && legacyModel && contract && contract.model !== 'private' && session.status === 'completed') {
          const revenue = moneyAmount(attendanceCount * (group.legacyBilling?.sessionFee ?? group.sessionFee));
          lessonRows.push({
            sessionId: session.id,
            sessionDate: session.sessionDate,
            groupName: group.nameAr,
            ...sessionDetails(session),
            attendanceCount,
            revenue,
            model: contract.model,
            rate: contract.value,
            ...calculateTeacherSessionPay(contract, session, attendanceCount, revenue),
          });
        }
      }

      if (!contract && legacyModel === 'center') {
        const rate = teacherRates.find((item) => item.model === 'center' && item.isActive);
        const fixedRate = rate?.fixedRatePerStudent ?? 20;
        const legacySessions = sessions.filter((session) => !session.pricing);
        if (legacySessions.length || !group.pricing) {
          averageSessions.set(fixedRate, [...(averageSessions.get(fixedRate) ?? []), ...legacySessions]);
        }
      }
      if (group.teacherId === params.teacherId && group.pricing?.model === 'center' && !averageSessions.size) {
        averageSessions.set(group.pricing.teacherRate, []);
      }

      const totalCompleted = [...averageSessions.values()]
        .flat()
        .filter((session) => session.status === 'completed').length;
      let rawCompensation = 0;
      let roundedCompensation = 0;

      for (const [ratePerStudent, groupSessions] of averageSessions) {
        const sessionRecords = groupSessions.map((session) => ({
          sessionId: session.id,
          sessionDate: session.sessionDate,
          status: session.status,
          ...sessionDetails(session),
          validAttendanceCount: countTeacherSessionAttendance(monthAttendance, session),
        }));
        const comp = calcCenterComp(
          sessionRecords.filter((session) => session.status === 'completed'),
          ratePerStudent
        );
        const totalValidAttendance = comp.totalValidAttendance ?? 0;
        rawCompensation += totalCompleted ? (totalValidAttendance * ratePerStudent) / totalCompleted : 0;
        const compensationAmount = moneyAmount(moneyAmount(rawCompensation) - roundedCompensation);
        roundedCompensation = moneyAmount(rawCompensation);
        centerGroupStatements.push({
          groupId: group.id,
          groupName: group.nameAr,
          ratePerStudent,
          conductedSessionsCount: comp.conductedSessions,
          excludedSessionsCount: sessionRecords.length - comp.conductedSessions,
          totalValidAttendance,
          averageAttendance: comp.averageAttendance,
          compensationAmount,
          sessions: sessionRecords,
        });
      }
    }

    const totalCenterCompensation = centerGroupStatements.reduce((sum, g) => sum + g.compensationAmount, 0);
    const totalLessonCompensation = moneyAmount(lessonRows.reduce((sum, s) => sum + s.teacherDue, 0));
    const totalCollectedLessonCompensation = moneyAmount(
      lessonRows.reduce((sum, s) => sum + (s.teacherCollected ?? s.teacherDue), 0)
    );
    const lessonCompensation = lessonRows.length
      ? {
          sessions: lessonRows.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
          totalCompensation: totalLessonCompensation,
        }
      : undefined;

    const privateGroups = teacherGroups.filter((group) => {
      const contract = contractsByGroup.get(group.id);
      if (group.pricing) {
        return (
          group.pricing.model === 'private' ||
          monthlyInvoices.some(
            (invoice) =>
              invoice.groupId === group.id &&
              ((invoice.teacherId === params.teacherId && invoice.pricing?.model === 'private') ||
                (!invoice.pricing &&
                  !invoice.sessionId &&
                  group.legacyBilling?.teacherId === params.teacherId &&
                  (contract ? contract.model === 'private' : group.legacyBilling.model === 'private')))
          )
        );
      }
      return contract ? contract.model === 'private' : group.pricingModel === 'private';
    });

    let totalInvoicedTeacherShare = 0;
    let totalCollectedTeacherShare = 0;
    let totalCenterShare = 0;
    let totalRoundingLeakage = 0;

    const privateGroupStatements = privateGroups.flatMap((group) => {
      const rateObj = teacherRates.find((rate) => rate.model === 'private' && rate.isActive);
      const configuredContract = contractsByGroup.get(group.id);
      const teacherPct =
        group.pricing?.model === 'private'
          ? group.pricing.teacherPercentage
          : configuredContract?.value ?? rateObj?.teacherPercentage ?? 70;
      const invoices = monthlyInvoices.filter((invoice) => invoice.groupId === group.id && !invoice.sessionId);
      const enrollments = allEnrollments.filter((row) => row.groupId === group.id);

      const buildItem = (studentId: string, enrollment?: Enrollment, invoice?: Invoice) => {
        const student = students.find((user) => user.id === studentId);
        const basePrice = invoice?.totalAmount ?? studentGroupFee(group);
        const discountType = enrollment?.discountType ?? 'none';
        const discountValue = enrollment?.discountValue ?? 0;
        const netRevenue =
          invoice?.netAmount ?? calculateDiscount({ basePrice, discountType, discountValue }).netPrice;
        const percentage =
          invoice?.pricing?.model === 'private'
            ? invoice.pricing.teacherPercentage
            : configuredContract?.value ?? rateObj?.teacherPercentage ?? teacherPct;
        const shares = splitPrivateFee(netRevenue, percentage);
        const collectedAmount = Math.min(netRevenue, invoice?.paidAmount ?? 0);
        return {
          enrollmentId: enrollment?.id ?? invoice?.id ?? studentId,
          studentId,
          studentName: student?.fullName ?? 'طالب',
          studentPhone: student?.phone,
          basePrice,
          discountType,
          discountValue,
          netRevenue,
          teacherShare: shares.teacher,
          centerShare: shares.center,
          collectedAmount,
          collectedTeacher: splitPrivateFee(collectedAmount, percentage).teacher,
          percentage,
        };
      };

      const items = group.pricing
        ? invoices
            .filter(
              (invoice) =>
                (invoice.teacherId === params.teacherId && invoice.pricing?.model === 'private') ||
                (!invoice.pricing &&
                  group.legacyBilling?.teacherId === params.teacherId &&
                  (configuredContract ? configuredContract.model === 'private' : group.legacyBilling.model === 'private'))
            )
            .map((invoice) =>
              buildItem(
                invoice.studentId,
                enrollments.find((row) => row.studentId === invoice.studentId),
                invoice
              )
            )
        : enrollments
            .filter((row) => row.isActive && row.enrolledAt.slice(0, 10) <= monthEnd)
            .map((row) =>
              buildItem(
                row.studentId,
                row,
                invoices.find((invoice) => invoice.studentId === row.studentId)
              )
            );

      const byPercentage = new Map<number, typeof items>();
      if (group.teacherId === params.teacherId && (group.pricing?.model === 'private' || !group.pricing)) {
        byPercentage.set(teacherPct, []);
      }
      for (const item of items) {
        const rows = byPercentage.get(item.percentage) ?? [];
        rows.push(item);
        byPercentage.set(item.percentage, rows);
      }

      return [...byPercentage.entries()].map(([pct, groupItems]) => {
        const centerPct = moneyAmount(100 - pct);
        const totalGrossInvoiced = groupItems.reduce((acc, it) => acc + it.basePrice, 0);
        const totalDiscountAmount = groupItems.reduce((acc, it) => acc + (it.basePrice - it.netRevenue), 0);
        const totalNetRevenue = groupItems.reduce((acc, it) => acc + it.netRevenue, 0);
        const groupTeacherShare = groupItems.reduce((acc, it) => acc + it.teacherShare, 0);
        const groupCenterShare = groupItems.reduce((acc, it) => acc + it.centerShare, 0);
        const groupCollected = groupItems.reduce((acc, it) => acc + it.collectedAmount, 0);
        const groupCollectedTeacherShare = moneyAmount(
          groupItems.reduce((sum, item) => sum + item.collectedTeacher, 0)
        );
        const uncollectedTeacherBalance = Math.max(
          0,
          Math.round((groupTeacherShare - groupCollectedTeacherShare) * 100) / 100
        );
        const leakage = Math.abs(Math.round((totalNetRevenue - (groupTeacherShare + groupCenterShare)) * 100) / 100);

        totalInvoicedTeacherShare += groupTeacherShare;
        totalCollectedTeacherShare += groupCollectedTeacherShare;
        totalCenterShare += groupCenterShare;
        totalRoundingLeakage += leakage;

        return {
          groupId: group.id,
          groupName: group.nameAr,
          teacherPercentage: pct,
          centerPercentage: centerPct,
          enrolledCount: new Set(groupItems.map((item) => item.studentId)).size,
          totalGrossInvoiced: Math.round(totalGrossInvoiced * 100) / 100,
          totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
          totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
          totalTeacherShare: Math.round(groupTeacherShare * 100) / 100,
          totalCenterShare: Math.round(groupCenterShare * 100) / 100,
          totalCollected: Math.round(groupCollected * 100) / 100,
          totalCollectedTeacherShare: Math.round(groupCollectedTeacherShare * 100) / 100,
          uncollectedTeacherBalance,
          roundingLeakage: leakage,
          items: groupItems,
        };
      });
    });

    const advances = allAdvances.filter(
      (advance) =>
        cairoClock(new Date(advance.paidAt)).startsWith(monthKey) &&
        (advance.status === 'pending' ||
          payrolls.some(
            (payroll) =>
              payroll.id === advance.payrollId &&
              payroll.payrollYear === params.year &&
              payroll.payrollMonth === params.month
          ))
    );
    const totalAdvances = advances.reduce((acc, a) => acc + a.amount, 0);

    const grossCompensation =
      Math.round((totalCenterCompensation + totalLessonCompensation + totalInvoicedTeacherShare) * 100) / 100;
    const grossCollectedCompensation =
      Math.round((totalCenterCompensation + totalCollectedLessonCompensation + totalCollectedTeacherShare) * 100) /
      100;
    const netPayrollInvoiced = Math.max(0, Math.round((grossCompensation - totalAdvances) * 100) / 100);
    const netPayrollCollected = Math.max(0, Math.round((grossCollectedCompensation - totalAdvances) * 100) / 100);

    let payrollRecord = payrolls[0];
    const conductedSessions =
      centerGroupStatements.reduce((acc, g) => acc + g.conductedSessionsCount, 0) + lessonRows.length;
    const totalAttendance =
      centerGroupStatements.reduce((acc, g) => acc + g.totalValidAttendance, 0) +
      lessonRows.reduce((acc, lesson) => acc + lesson.attendanceCount, 0);
    const averageAttendance =
      conductedSessions > 0 ? Math.round((totalAttendance * 100) / conductedSessions) / 100 : 0;

    if (!payrollRecord && params.persistDraft !== false) {
      payrollRecord = {
        id: `payr-${params.teacherId}-${params.year}-${params.month}`,
        tenantId: params.tenantId,
        teacherId: params.teacherId,
        payrollMonth: params.month,
        payrollYear: params.year,
        conductedSessions,
        totalAttendance,
        averageAttendance,
        calculatedCompensation: grossCompensation,
        bonuses: 0,
        deductions: totalAdvances,
        netPayroll: netPayrollInvoiced,
        lessonCompensation,
        status: 'draft',
        createdAt: new Date().toISOString(),
      };
      const client = await this.getClient(true);
      await client.commit([
        {
          type: 'set',
          documentPath: `${COLLECTIONS.teacherPayroll}/${params.tenantId}~${payrollRecord.id}`,
          data: payrollRecord as unknown as Record<string, unknown>,
        },
      ]);
    } else if (
      payrollRecord &&
      (payrollRecord.status === 'draft' || payrollRecord.status === 'reviewed') &&
      params.persistDraft !== false
    ) {
      payrollRecord = {
        ...payrollRecord,
        conductedSessions,
        totalAttendance,
        averageAttendance,
        calculatedCompensation: grossCompensation,
        deductions: totalAdvances,
        netPayroll: Math.round((netPayrollInvoiced + payrollRecord.bonuses) * 100) / 100,
        lessonCompensation,
      };
      const client = await this.getClient(true);
      await client.commit([
        {
          type: 'set',
          documentPath: `${COLLECTIONS.teacherPayroll}/${params.tenantId}~${payrollRecord.id}`,
          data: payrollRecord as unknown as Record<string, unknown>,
        },
      ]);
    }

    const locked =
      payrollRecord && (payrollRecord.status === 'approved' || payrollRecord.status === 'paid')
        ? payrollRecord
        : undefined;

    return {
      tenantId: params.tenantId,
      teacherId: params.teacherId,
      teacherName,
      teacherPhone,
      subjectNames,
      payrollMonth: params.month,
      payrollYear: params.year,
      centerSubscription: {
        groups: centerGroupStatements,
        totalCompensation: Math.round(totalCenterCompensation * 100) / 100,
      },
      privateLessons: {
        groups: privateGroupStatements,
        totalInvoicedTeacherShare: Math.round(totalInvoicedTeacherShare * 100) / 100,
        totalCollectedTeacherShare: Math.round(totalCollectedTeacherShare * 100) / 100,
        totalCenterShare: Math.round(totalCenterShare * 100) / 100,
        totalRoundingLeakage: Math.round(totalRoundingLeakage * 100) / 100,
      },
      lessonCompensation: locked ? locked.lessonCompensation : lessonCompensation,
      adjustments: {
        advances,
        totalAdvances,
        bonuses: [],
        totalBonuses: 0,
        deductions: [],
        totalDeductions: 0,
      },
      summary: {
        grossCompensation: locked?.calculatedCompensation ?? grossCompensation,
        grossCollectedCompensation: locked?.calculatedCompensation ?? grossCollectedCompensation,
        totalAdvances: locked?.deductions ?? totalAdvances,
        totalBonuses: locked?.bonuses ?? 0,
        totalDeductions: 0,
        netPayrollInvoiced: locked?.netPayroll ?? netPayrollInvoiced,
        netPayrollCollected: locked?.netPayroll ?? netPayrollCollected,
        payrollRecord,
      },
    };
  }

  async approveTeacherPayroll(
    payrollId: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }> {
    if (!['CENTER_ADMIN', 'PLATFORM_OWNER', 'ACCOUNTANT'].includes(actorRole)) {
      return { success: false, error: 'صلاحية الإدارة مطلوبة', status: 403 };
    }
    const client = await this.getClient(true);
    const rows = await client.queryCollection<TeacherPayroll>(COLLECTIONS.teacherPayroll, [
      { fieldPath: 'id', op: 'EQUAL', value: payrollId },
    ]);
    if (rows.length === 0) return { success: false, error: 'كشف الراتب غير موجود', status: 404 };
    const updated: TeacherPayroll = {
      ...rows[0].data,
      status: 'approved',
      approvedByUserId: actorId,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.teacherPayroll}/${updated.tenantId}~${updated.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, data: updated, status: 200 };
  }

  async disburseTeacherPayroll(
    payrollId: string,
    paymentMethod: PaymentMethod,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }> {
    if (!['CENTER_ADMIN', 'PLATFORM_OWNER', 'ACCOUNTANT'].includes(actorRole)) {
      return { success: false, error: 'صلاحية المحاسب أو الإدارة مطلوبة', status: 403 };
    }
    const client = await this.getClient(true);
    const rows = await client.queryCollection<TeacherPayroll>(COLLECTIONS.teacherPayroll, [
      { fieldPath: 'id', op: 'EQUAL', value: payrollId },
    ]);
    if (rows.length === 0) return { success: false, error: 'كشف الراتب غير موجود', status: 404 };
    const updated: TeacherPayroll = {
      ...rows[0].data,
      status: 'paid',
      approvedByUserId: actorId,
      approvedAt: rows[0].data.approvedAt || new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.teacherPayroll}/${updated.tenantId}~${updated.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, data: updated, status: 200 };
  }

  async getTeacherAdvances(
    tenantId: string,
    filter?: { teacherId?: string; status?: 'pending' | 'settled' }
  ): Promise<TeacherAdvance[]> {
    const rows = await this.queryTenant<TeacherAdvance>(COLLECTIONS.teacherAdvances, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (a) =>
          (!filter?.teacherId || a.teacherId === filter.teacherId) &&
          (!filter?.status || a.status === filter.status)
      );
  }

  async recordTeacherAdvance(params: {
    tenantId: string;
    teacherId: string;
    amount: number;
    reason?: string;
    disbursedByUserId: string;
  }): Promise<TeacherAdvance> {
    const client = await this.getClient(true);
    const id = `adv-${Date.now()}`;
    const now = new Date().toISOString();
    const advance: TeacherAdvance = {
      id,
      tenantId: params.tenantId,
      teacherId: params.teacherId,
      amount: params.amount,
      reason: params.reason,
      disbursedByUserId: params.disbursedByUserId,
      status: 'pending',
      paidAt: now,
      createdAt: now,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.teacherAdvances}/${params.tenantId}~${id}`,
        data: advance as unknown as Record<string, unknown>,
      },
    ]);
    return advance;
  }

  // 8. Financial Suite
  async getInvoices(
    tenantId: string,
    filter?: { studentId?: string; status?: InvoiceStatus }
  ): Promise<Invoice[]> {
    const rows = await this.queryTenant<Invoice>(COLLECTIONS.invoices, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (i) =>
          (!filter?.studentId || i.studentId === filter.studentId) &&
          (!filter?.status || i.status === filter.status)
      );
  }

  async getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null> {
    const client = await this.getClient(true);
    const snap = await client.getDocument<Invoice>(`${COLLECTIONS.invoices}/${tenantId}~${invoiceId}`);
    return snap.exists ? snap.data : null;
  }

  async createInvoice(params: {
    tenantId: string;
    studentId: string;
    groupId?: string;
    totalAmount: number;
    discountType?: string;
    discountValue?: number;
    billingMonth: number;
    billingYear: number;
    dueDate: string;
  }): Promise<Invoice> {
    const client = await this.getClient(true);
    const id = `inv-${Date.now()}`;
    const discount = calculateDiscount({
      basePrice: params.totalAmount,
      discountType: (params.discountType as any) || 'none',
      discountValue: params.discountValue || 0,
    });
    const invoice: Invoice = {
      id,
      tenantId: params.tenantId,
      studentId: params.studentId,
      groupId: params.groupId,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      totalAmount: discount.basePrice,
      discountAmount: discount.discountAmount,
      netAmount: discount.netPrice,
      paidAmount: 0,
      status: discount.netPrice === 0 ? 'paid' : 'pending',
      billingMonth: params.billingMonth,
      billingYear: params.billingYear,
      dueDate: params.dueDate,
      createdAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.invoices}/${params.tenantId}~${id}`,
        data: invoice as unknown as Record<string, unknown>,
      },
    ]);
    return invoice;
  }

  async getPayments(
    tenantId: string,
    filter?: { studentId?: string; invoiceId?: string; shiftId?: string }
  ): Promise<Payment[]> {
    const rows = await this.queryTenant<Payment>(COLLECTIONS.payments, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (p) =>
          (!filter?.studentId || p.studentId === filter.studentId) &&
          (!filter?.invoiceId || p.invoiceId === filter.invoiceId) &&
          (!filter?.shiftId || p.cashierShiftId === filter.shiftId)
      );
  }

  async getActiveCashierShift(
    tenantId: string,
    cashierUserId?: string,
    branchId?: string
  ): Promise<CashierShift | null> {
    const shifts = await this.getCashierShifts(tenantId, { cashierUserId, status: 'open' });
    return (
      shifts.find((s) => !branchId || s.branchId === branchId) || null
    );
  }

  async openCashierShift(params: {
    tenantId: string;
    branchId: string;
    cashierUserId: string;
    openingCash: number;
    notes?: string;
  }): Promise<CashierShift> {
    const client = await this.getClient(true);
    const id = `shift-${Date.now()}`;
    const shift: CashierShift = {
      id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      cashierUserId: params.cashierUserId,
      openedAt: new Date().toISOString(),
      openingCash: params.openingCash,
      cashCollected: 0,
      digitalCollected: 0,
      expectedCash: params.openingCash,
      notes: params.notes,
      status: 'open',
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.shifts}/${params.tenantId}~${id}`,
        data: shift as unknown as Record<string, unknown>,
      },
    ]);
    return shift;
  }

  async closeCashierShift(params: {
    shiftId: string;
    actualCash: number;
    notes?: string;
    denominations?: Record<string, number>;
  }): Promise<CashierShift> {
    const client = await this.getClient(true);
    const rows = await client.queryCollection<CashierShift>(COLLECTIONS.shifts, [
      { fieldPath: 'id', op: 'EQUAL', value: params.shiftId },
    ]);
    if (rows.length === 0) throw new Error('الوردية غير موجودة');
    const current = rows[0].data;
    const updated: CashierShift = {
      ...current,
      status: 'closed',
      closedAt: new Date().toISOString(),
      actualCash: params.actualCash,
      cashDifference: params.actualCash - (current.expectedCash ?? current.openingCash),
      notes: params.notes || current.notes,
      denominations: params.denominations,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.shifts}/${current.tenantId}~${current.id}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return updated;
  }

  async recordExpense(params: {
    tenantId: string;
    branchId: string;
    category: string;
    description: string;
    amount: number;
    createdByUserId: string;
    shiftId?: string;
  }): Promise<Expense> {
    const client = await this.getClient(true);
    const id = `exp-${Date.now()}`;
    const expense: Expense = {
      id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      category: params.category as any,
      description: params.description,
      amount: params.amount,
      createdByUserId: params.createdByUserId,
      createdAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.expenses}/${params.tenantId}~${id}`,
        data: expense as unknown as Record<string, unknown>,
      },
    ]);
    return expense;
  }

  async recordPayment(params: {
    tenantId: string;
    invoiceId: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    shiftId?: string;
    notes?: string;
  }): Promise<{ payment: Payment; updatedInvoice: Invoice; updatedStudent?: User }> {
    const invoice = await this.getInvoiceById(params.tenantId, params.invoiceId);
    if (!invoice) throw new Error('الفاتورة غير موجودة');
    const client = await this.getClient(true);
    const id = `pay-${Date.now()}`;
    const now = new Date().toISOString();
    const payment: Payment = {
      id,
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      studentId: invoice.studentId,
      amountPaid: params.amountPaid,
      paymentMethod: params.paymentMethod,
      receivedByUserId: params.cashierUserId,
      cashierShiftId: params.shiftId,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      notes: params.notes,
      paidAt: now,
    };
    const nextPaid = (invoice.paidAmount || 0) + params.amountPaid;
    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmount: nextPaid,
      status: nextPaid >= invoice.netAmount ? 'paid' : 'partially_paid',
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.payments}/${params.tenantId}~${id}`,
        data: payment as unknown as Record<string, unknown>,
      },
      {
        type: 'set',
        documentPath: `${COLLECTIONS.invoices}/${params.tenantId}~${invoice.id}`,
        data: updatedInvoice as unknown as Record<string, unknown>,
      },
    ]);
    return { payment, updatedInvoice };
  }

  async collectStudentPayment(params: {
    tenantId: string;
    studentId: string;
    sessionId?: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    notes?: string;
  }): Promise<User> {
    const student = await this.getUserById(params.studentId);
    if (!student) throw new Error('الطالب غير موجود');
    const client = await this.getClient(true);
    const id = `pay-${Date.now()}`;
    const now = new Date().toISOString();
    const updatedStudent: User = {
      ...student,
      balanceDue: Math.max(0, (student.balanceDue || 0) - params.amountPaid),
      updatedAt: now,
    };
    const payment: Payment = {
      id,
      tenantId: params.tenantId,
      invoiceId: '',
      studentId: student.id,
      amountPaid: params.amountPaid,
      paymentMethod: params.paymentMethod,
      receivedByUserId: params.cashierUserId,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      notes: params.notes,
      paidAt: now,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.payments}/${params.tenantId}~${id}`,
        data: payment as unknown as Record<string, unknown>,
      },
      {
        type: 'set',
        documentPath: `${COLLECTIONS.students}/${params.tenantId}~${student.id}`,
        data: updatedStudent as unknown as Record<string, unknown>,
      },
    ]);
    return updatedStudent;
  }

  async getCashierShifts(
    tenantId: string,
    filter?: { cashierUserId?: string; status?: 'open' | 'closed' }
  ): Promise<CashierShift[]> {
    const rows = await this.queryTenant<CashierShift>(COLLECTIONS.shifts, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (s) =>
          (!filter?.cashierUserId || s.cashierUserId === filter.cashierUserId) &&
          (!filter?.status || s.status === filter.status)
      );
  }

  async getExpenses(tenantId: string): Promise<Expense[]> {
    const rows = await this.queryTenant<Expense>(COLLECTIONS.expenses, tenantId);
    return rows.map((r) => r.data);
  }

  async getBooksInventory(tenantId: string): Promise<BookInventoryItem[]> {
    const rows = await this.queryTenant<BookInventoryItem>(COLLECTIONS.booksInventory, tenantId);
    return rows.map((r) => r.data);
  }

  // 9. Materials & AI Exams
  async getMaterials(
    tenantId: string,
    filter?: {
      stage?: string;
      grade?: string;
      subjectId?: string;
      indexStatus?: MaterialIndexStatus;
      search?: string;
    }
  ): Promise<Material[]> {
    const rows = await this.queryTenant<Material & { deleted?: boolean }>(COLLECTIONS.materials, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (m) =>
          !m.deleted &&
          (!filter?.stage || m.stage === filter.stage) &&
          (!filter?.grade || m.grade === filter.grade) &&
          (!filter?.subjectId || m.subjectId === filter.subjectId) &&
          (!filter?.indexStatus || m.indexStatus === filter.indexStatus) &&
          (!filter?.search ||
            m.title.toLowerCase().includes(filter.search.trim().toLowerCase()))
      );
  }

  async getMaterialById(tenantId: string, materialId: string): Promise<Material | null> {
    const materials = await this.getMaterials(tenantId);
    return materials.find((m) => m.id === materialId) || null;
  }

  async createMaterial(input: CreateMaterialInput): Promise<Material> {
    const client = await this.getClient(true);
    const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    let textContentIndexed = input.textContentIndexed;
    let wordCount = textContentIndexed ? countArabicWords(textContentIndexed) : 0;
    let indexStatus: MaterialIndexStatus = 'pending';

    if (input.indexImmediately && !textContentIndexed) {
      const simulated = simulateTextExtraction(input.title, 'المقرر الدراسي', input.stage);
      textContentIndexed = simulated.extractedText;
      wordCount = simulated.wordCount;
      indexStatus = simulated.status;
    } else if (textContentIndexed) {
      indexStatus = evaluateIndexingStatus(wordCount);
    }

    const driveId = input.googleDriveFileId || extractGoogleDriveFileId(input.fileUrl);
    const driveLinks = driveId ? buildDriveLinks(driveId) : undefined;

    const material: Material = {
      id,
      tenantId: input.tenantId,
      teacherId: input.teacherId,
      stage: input.stage,
      grade: input.grade,
      subjectId: input.subjectId,
      unitName: input.unitName,
      lessonName: input.lessonName,
      title: input.title,
      description: input.description,
      category: input.category || 'lecture_notes',
      fileUrl: input.fileUrl,
      googleDriveFileId: driveId || undefined,
      googleDriveWebViewLink: driveLinks?.webViewLink,
      googleDriveWebContentLink: driveLinks?.webContentLink,
      googleDriveThumbnailLink: driveLinks?.thumbnailLink,
      fileSizeBytes: input.fileSizeBytes || 1024 * 1024,
      fileType: input.fileType || 'application/pdf',
      textContentIndexed,
      wordCount,
      indexStatus,
      lastIndexedAt: textContentIndexed ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.materials}/${input.tenantId}~${id}`,
        data: material as unknown as Record<string, unknown>,
      },
    ]);
    return material;
  }

  async updateMaterial(tenantId: string, materialId: string, updates: Partial<Material>): Promise<Material> {
    const existing = await this.getMaterialById(tenantId, materialId);
    if (!existing) throw new Error('المذكرة غير موجودة');
    const client = await this.getClient(true);
    const updated: Material = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.materials}/${tenantId}~${materialId}`,
        data: updated as unknown as Record<string, unknown>,
      },
    ]);
    return updated;
  }

  async deleteMaterial(tenantId: string, materialId: string): Promise<{ success: boolean }> {
    const client = await this.getClient(true);
    await client.commit([
      { type: 'delete', documentPath: `${COLLECTIONS.materials}/${tenantId}~${materialId}` },
    ]);
    return { success: true };
  }

  async indexMaterialContent(
    tenantId: string,
    materialId: string,
    options?: { forceReindex?: boolean; customText?: string }
  ): Promise<Material> {
    const material = await this.getMaterialById(tenantId, materialId);
    if (!material) throw new Error('المذكرة غير موجودة');
    if (options?.customText) {
      const wordCount = countArabicWords(options.customText);
      return this.updateMaterial(tenantId, materialId, {
        textContentIndexed: options.customText,
        wordCount,
        indexStatus: evaluateIndexingStatus(wordCount),
        lastIndexedAt: new Date().toISOString(),
      });
    }
    const simulated = simulateTextExtraction(material.title, material.unitName, material.lessonName);
    return this.updateMaterial(tenantId, materialId, {
      textContentIndexed: simulated.extractedText,
      wordCount: simulated.wordCount,
      indexStatus: simulated.status,
      lastIndexedAt: new Date().toISOString(),
    });
  }

  async linkGoogleDriveDocument(
    tenantId: string,
    params: {
      googleDriveUrlOrId: string;
      teacherId: string;
      stage: string;
      grade: string;
      subjectId: string;
      unitName: string;
      lessonName: string;
      title?: string;
      category?: DocumentCategory;
      autoIndex?: boolean;
    }
  ): Promise<Material> {
    const fileId = extractGoogleDriveFileId(params.googleDriveUrlOrId);
    const links = fileId ? buildDriveLinks(fileId) : undefined;
    return this.createMaterial({
      tenantId,
      teacherId: params.teacherId,
      stage: params.stage,
      grade: params.grade,
      subjectId: params.subjectId,
      unitName: params.unitName,
      lessonName: params.lessonName,
      title: params.title || `${params.lessonName} - ${params.unitName}`,
      category: params.category || 'summary',
      fileUrl: links?.webViewLink || params.googleDriveUrlOrId,
      googleDriveFileId: fileId || undefined,
      indexImmediately: params.autoIndex,
    });
  }

  async getMaterialsStats(tenantId: string): Promise<MaterialsSummaryStats> {
    const all = await this.getMaterials(tenantId);
    return {
      totalMaterials: all.length,
      indexedMaterials: all.filter((m) => m.indexStatus === 'indexed').length,
      pendingMaterials: all.filter((m) => m.indexStatus === 'pending').length,
      insufficientMaterials: all.filter((m) => m.indexStatus === 'insufficient').length,
      failedMaterials: all.filter((m) => m.indexStatus === 'failed').length,
      totalIndexedWords: all.reduce((s, m) => s + (m.wordCount || 0), 0),
      googleDriveLinkedCount: all.filter((m) => Boolean(m.googleDriveFileId)).length,
    };
  }

  async validateExamPreflight(sourceDocumentIds: string[]): Promise<ExamPreflightResult> {
    if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
      return {
        allowed: false,
        errorCode: 'EMPTY_SELECTION',
        messageArabic: 'يجب اختيار مستند واحد على الأقل لتوليد الامتحان',
      };
    }
    return { allowed: true, messageArabic: 'المستندات جاهزة للتوليد', totalWordCount: 500 };
  }

  async createExamDraft(params: {
    tenantId: string;
    groupId?: string;
    subjectId?: string;
    teacherId: string;
    title: string;
    durationMinutes: number;
    sourceDocumentIds: string[];
    questions: Array<Omit<ExamQuestion, 'id' | 'examId'>>;
  }): Promise<{ exam: Exam; questions: ExamQuestion[] }> {
    const client = await this.getClient(true);
    const id = `exam-${Date.now()}`;
    const questions: ExamQuestion[] = params.questions.map((q, idx) => ({
      ...q,
      id: `q-${id}-${idx + 1}`,
      examId: id,
    }));
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const exam: Exam = {
      id,
      tenantId: params.tenantId,
      groupId: params.groupId || '',
      subjectId: params.subjectId,
      teacherId: params.teacherId,
      title: params.title,
      durationMinutes: params.durationMinutes,
      totalMarks,
      passMarks: Math.ceil(totalMarks * 0.5),
      isAiGenerated: true,
      groundedMaterialIds: params.sourceDocumentIds,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.exams}/${params.tenantId}~${id}`,
        data: { ...exam, questions } as unknown as Record<string, unknown>,
      },
    ]);
    return { exam, questions };
  }

  async generateAiExam(request: {
    tenantId: string;
    teacherId: string;
    groupId?: string;
    sessionId?: string;
    title: string;
    subject: string;
    grade: string;
    durationMinutes: number;
    sourceText: string;
    sourceDocumentIds?: string[];
    questionCounts?: { mcq?: number; shortAnswer?: number };
  }): Promise<{ exam: Exam; questions: ExamQuestion[] }> {
    const generated = await generateGroundedExam(request);
    return this.createExamDraft({
      tenantId: request.tenantId,
      teacherId: request.teacherId,
      groupId: request.groupId,
      title: request.title,
      durationMinutes: request.durationMinutes,
      sourceDocumentIds: request.sourceDocumentIds || [],
      questions: generated.questions,
    });
  }

  async getExams(
    tenantId: string,
    filter?: { groupId?: string; teacherId?: string; status?: ExamStatus; subjectId?: string }
  ): Promise<Exam[]> {
    const rows = await this.queryTenant<Exam>(COLLECTIONS.exams, tenantId);
    return rows
      .map((r) => r.data)
      .filter(
        (e) =>
          (!filter?.groupId || e.groupId === filter.groupId) &&
          (!filter?.teacherId || e.teacherId === filter.teacherId) &&
          (!filter?.status || e.status === filter.status) &&
          (!filter?.subjectId || e.subjectId === filter.subjectId)
      );
  }

  async getStudentExamSubmissions(
    tenantId: string,
    groupId: string,
    studentId: string
  ): Promise<ExamSubmission[]> {
    const rows = await this.queryTenant<ExamSubmission>(COLLECTIONS.examSubmissions, tenantId, [
      { fieldPath: 'studentId', op: 'EQUAL', value: studentId },
    ]);
    return rows.map((r) => r.data);
  }

  async getExamById(examId: string): Promise<{ exam: Exam; questions: ExamQuestion[] } | null> {
    const client = await this.getClient(true);
    const rows = await client.queryCollection<Exam & { questions?: ExamQuestion[] }>(COLLECTIONS.exams, [
      { fieldPath: 'id', op: 'EQUAL', value: examId },
    ]);
    if (rows.length === 0) return null;
    const { questions = [], ...exam } = rows[0].data;
    return { exam: exam as Exam, questions };
  }

  async updateExamQuestion(params: {
    tenantId: string;
    examId: string;
    questionId: string;
    updates: Partial<ExamQuestion>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; question?: ExamQuestion; error?: string; status: number }> {
    const found = await this.getExamById(params.examId);
    if (!found) return { success: false, error: 'الامتحان غير موجود', status: 404 };
    const nextQuestions = found.questions.map((q) =>
      q.id === params.questionId ? { ...q, ...params.updates } : q
    );
    const updatedQ = nextQuestions.find((q) => q.id === params.questionId);
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.exams}/${params.tenantId}~${params.examId}`,
        data: { ...found.exam, questions: nextQuestions } as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, question: updatedQ, status: 200 };
  }

  async reorderExamQuestions(params: {
    tenantId: string;
    examId: string;
    questionOrder: Array<{ questionId: string; orderIndex: number }>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; questions?: ExamQuestion[]; error?: string; status: number }> {
    const found = await this.getExamById(params.examId);
    if (!found) return { success: false, error: 'الامتحان غير موجود', status: 404 };
    const orderMap = new Map(params.questionOrder.map((o) => [o.questionId, o.orderIndex]));
    const nextQuestions = [...found.questions].sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.exams}/${params.tenantId}~${params.examId}`,
        data: { ...found.exam, questions: nextQuestions } as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, questions: nextQuestions, status: 200 };
  }

  async updateExamMetadata(params: {
    tenantId: string;
    examId: string;
    updates: Partial<Pick<Exam, 'title' | 'durationMinutes' | 'passMarks' | 'instructions' | 'status'>>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }> {
    const found = await this.getExamById(params.examId);
    if (!found) return { success: false, error: 'الامتحان غير موجود', status: 404 };
    const updatedExam = { ...found.exam, ...params.updates };
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.exams}/${params.tenantId}~${params.examId}`,
        data: { ...updatedExam, questions: found.questions } as unknown as Record<string, unknown>,
      },
    ]);
    return { success: true, exam: updatedExam, status: 200 };
  }

  async publishExam(examId: string, actorId: string, actorRole: UserRole): Promise<Exam> {
    if (actorRole === 'STUDENT') throw new Error('Forbidden');
    const found = await this.getExamById(examId);
    if (!found) throw new Error('الامتحان غير موجود');
    const updatedExam: Exam = { ...found.exam, status: 'published' };
    const client = await this.getClient(true);
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.exams}/${found.exam.tenantId}~${examId}`,
        data: { ...updatedExam, questions: found.questions } as unknown as Record<string, unknown>,
      },
    ]);
    return updatedExam;
  }

  async archiveExam(params: {
    tenantId: string;
    examId: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }> {
    return this.updateExamMetadata({
      ...params,
      updates: { status: 'archived' },
    });
  }

  async submitExam(
    examId: string,
    studentId: string,
    answers: Array<{ questionId: string; selectedAnswer: string }>
  ): Promise<{ submission: ExamSubmission; score: number; percentage: number }> {
    const found = await this.getExamById(examId);
    if (!found) throw new Error('الامتحان غير موجود');
    const answersMap: Record<string, string> = {};
    for (const ans of answers) {
      answersMap[ans.questionId] = ans.selectedAnswer;
    }
    const graded = gradeExam(found.questions, answersMap);
    const client = await this.getClient(true);
    const id = `sub-${examId}-${studentId}`;
    const submission: ExamSubmission = {
      id,
      examId,
      studentId,
      startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      autoGradedScore: graded.earnedPoints,
      manualGradedScore: 0,
      totalScore: graded.earnedPoints,
      status: graded.requiresManualReview ? 'submitted' : 'graded',
      percentage: graded.percentage,
      answers: answersMap,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.examSubmissions}/${found.exam.tenantId}~${id}`,
        data: { ...submission, tenantId: found.exam.tenantId } as unknown as Record<string, unknown>,
      },
    ]);
    return { submission, score: graded.earnedPoints, percentage: graded.percentage };
  }

  // 10. Notifications
  async enqueueNotification(params: {
    tenantId: string;
    recipientPhone: string;
    channel: NotificationChannel;
    templateName: string;
    payload: Record<string, unknown>;
    recipientUserId?: string;
  }): Promise<NotificationRecord> {
    const client = await this.getClient(true);
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id,
      tenantId: params.tenantId,
      recipientPhone: params.recipientPhone,
      recipientUserId: params.recipientUserId,
      channel: params.channel,
      templateName: params.templateName,
      payload: params.payload,
      status: 'queued',
      retryCount: 0,
      scheduledAt: now,
    };
    await client.commit([
      {
        type: 'set',
        documentPath: `${COLLECTIONS.notifications}/${params.tenantId}~${id}`,
        data: record as unknown as Record<string, unknown>,
      },
    ]);
    return record;
  }

  async getNotificationLogs(tenantId: string): Promise<NotificationRecord[]> {
    const rows = await this.queryTenant<NotificationRecord>(COLLECTIONS.notifications, tenantId);
    return rows.map((r) => r.data).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }
}
