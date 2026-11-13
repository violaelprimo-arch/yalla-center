import { getReceptionDataProvider } from '@/lib/dal/factory';
import { loadGroupProvider } from './group-service';
import type { IDataProvider } from '@/lib/dal';
import type { Group, Session, Tenant, User, UserRole } from '@/lib/dal/types';
import {
  GRADE_EDITOR_ROLES,
  type LessonExamRecord,
  type LessonGradeAuditEntry,
  type LessonGradeRecord,
  lessonGradeDocId,
  parseLessonScore,
  parseTotalMarksInput,
} from '@/lib/attendance/lesson-scores';
import { receptionSessionState } from '@/lib/attendance/reception';
import {
  FirebaseAuthError,
  FirestoreHttpError,
  type ILessonScoreStore,
  type StaffMembershipRecord,
  type VerifiedFirebaseToken,
} from './server';
import type { FirestoreWriteOperation } from './firestore-rest';

export interface AuthorizedActorContext {
  verifiedToken: VerifiedFirebaseToken;
  staff: StaffMembershipRecord;
  tenant: Tenant;
}

export class LessonScoreServiceError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LessonScoreServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function resolveStaffFromClaims(
  verifiedToken: VerifiedFirebaseToken
): StaffMembershipRecord | null {
  const role = verifiedToken.rawClaims.role;
  const tenantId = verifiedToken.rawClaims.tenantId;
  if (typeof role !== 'string' || !GRADE_EDITOR_ROLES.has(role as UserRole)) {
    return null;
  }
  if (role !== 'PLATFORM_OWNER' && (typeof tenantId !== 'string' || !tenantId.trim())) {
    return null;
  }
  if (verifiedToken.rawClaims.staffActive === false) {
    return null;
  }
  const branchIds = Array.isArray(verifiedToken.rawClaims.branchIds)
    ? verifiedToken.rawClaims.branchIds.filter((item): item is string => typeof item === 'string')
    : [];
  const teacherId =
    typeof verifiedToken.rawClaims.teacherId === 'string'
      ? verifiedToken.rawClaims.teacherId
      : undefined;

  return {
    uid: verifiedToken.uid,
    email: verifiedToken.email,
    displayName: verifiedToken.name || verifiedToken.email || verifiedToken.uid,
    tenantId: typeof tenantId === 'string' ? tenantId : '*',
    role: role as UserRole,
    branchIds,
    teacherId,
    isActive: true,
  };
}

export async function resolveAuthorizedStaffActor(params: {
  centerSlug: string;
  verifiedToken: VerifiedFirebaseToken;
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<AuthorizedActorContext> {
  const dal = params.dal ?? getReceptionDataProvider();
  const tenant = await dal.getTenantBySlug(params.centerSlug);
  if (!tenant || !tenant.isActive) {
    throw new LessonScoreServiceError(404, 'CENTER_NOT_FOUND', 'السنتر غير موجود أو غير نشط');
  }

  let staff: StaffMembershipRecord | null = null;
  try {
    const staffSnap = await params.store.getDocument<StaffMembershipRecord>(
      `staff_memberships/${params.verifiedToken.uid}`
    );
    if (staffSnap.exists) {
      staff = {
        ...staffSnap.data,
        uid: staffSnap.data.uid || params.verifiedToken.uid,
      };
    }
  } catch (err) {
    if (err instanceof FirestoreHttpError && err.status === 403) {
      throw new LessonScoreServiceError(
        403,
        'FORBIDDEN_STAFF_LOOKUP',
        'غير مصرح لهذا الحساب بالوصول إلى بيانات طاقم العمل'
      );
    }
    throw err;
  }

  if (!staff) {
    staff = resolveStaffFromClaims(params.verifiedToken);
  }

  if (!staff || !staff.isActive) {
    throw new LessonScoreServiceError(
      403,
      'FORBIDDEN_NO_STAFF_ROLE',
      'حساب Firebase غير مرتبط بصلاحيات موظف فعّالة في هذا السنتر'
    );
  }

  if (!GRADE_EDITOR_ROLES.has(staff.role)) {
    throw new LessonScoreServiceError(
      403,
      'FORBIDDEN_ROLE',
      'الدور الوظيفي الحالي غير مخوّل لعرض أو تعديل درجات الاختبارات'
    );
  }

  if (staff.role !== 'PLATFORM_OWNER' && staff.tenantId !== tenant.id) {
    throw new LessonScoreServiceError(
      403,
      'FORBIDDEN_CROSS_TENANT',
      'غير مصرح لموظف سنتر آخر بالوصول إلى درجات هذا السنتر'
    );
  }

  return { verifiedToken: params.verifiedToken, staff, tenant };
}

export async function assertSessionAndBranchAccess(params: {
  actor: AuthorizedActorContext;
  sessionId: string;
  allowClosedHistoricalSession?: boolean;
  dal?: IDataProvider;
}): Promise<{ session: Session; group: Group; subjectNameAr?: string }> {
  const dal = params.dal ?? getReceptionDataProvider();
  const session = await dal.getSessionById(params.actor.tenant.id, params.sessionId);
  if (!session || session.tenantId !== params.actor.tenant.id) {
    throw new LessonScoreServiceError(404, 'SESSION_NOT_FOUND', 'الحصة غير موجودة في هذا السنتر');
  }
  if (session.status === 'canceled' || session.status === 'postponed') {
    throw new LessonScoreServiceError(409, 'SESSION_CANCELED', 'لا يمكن رصد درجات لحصة ملغاة');
  }
  if (!params.allowClosedHistoricalSession && !receptionSessionState(session)) {
    throw new LessonScoreServiceError(
      409,
      'SESSION_CLOSED',
      'الحصة مغلقة أو منتهية؛ افتح حصة نشطة أو قادمة'
    );
  }

  const originalGroup = await dal.getGroupById(params.actor.tenant.id, session.groupId);
  const group = originalGroup && { ...originalGroup, branchId: session.branchId ?? originalGroup.branchId,
    subjectId: session.subjectId ?? originalGroup.subjectId };
  if (!group || group.tenantId !== params.actor.tenant.id) {
    throw new LessonScoreServiceError(404, 'GROUP_NOT_FOUND', 'المجموعة المرتبطة بالحصة غير موجودة');
  }

  const { staff } = params.actor;
  const branchRestrictedRoles: UserRole[] = ['BRANCH_MANAGER', 'RECEPTIONIST'];
  if (
    branchRestrictedRoles.includes(staff.role) &&
    Array.isArray(staff.branchIds) &&
    staff.branchIds.length > 0 &&
    !staff.branchIds.includes(group.branchId)
  ) {
    throw new LessonScoreServiceError(
      403,
      'FORBIDDEN_BRANCH',
      'غير مصرح لك بتعديل درجات هذا الفرع'
    );
  }

  if (staff.role === 'TEACHER') {
    const teacherId = staff.teacherId || staff.uid;
    if (
      session.teacherId !== teacherId &&
      group.teacherId !== teacherId &&
      params.actor.verifiedToken.uid !== session.teacherId
    ) {
      throw new LessonScoreServiceError(
        403,
        'FORBIDDEN_TEACHER_SCOPE',
        'غير مصرح للمعلم بتعديل درجات حصة تابعة لمعلم آخر'
      );
    }
  }

  const subjects = await dal.getSubjects(params.actor.tenant.id);
  const subject = subjects.find((s) => s.id === group.subjectId);

  return { session, group, subjectNameAr: subject?.nameAr };
}

async function providerForSession(actor: AuthorizedActorContext, sessionId: string, store: ILessonScoreStore) {
  return sessionId.startsWith('lesson:') ? loadGroupProvider(store, actor.tenant) : getReceptionDataProvider();
}

async function resolveStudentEnrollmentInGroup(params: {
  dal: IDataProvider;
  tenantId: string;
  groupId: string;
  studentIdOrCode: string;
}): Promise<User> {
  const queryValue = params.studentIdOrCode.trim();
  if (!queryValue) {
    throw new LessonScoreServiceError(400, 'MISSING_STUDENT', 'يرجى تحديد كود الطالب أو معرفه');
  }

  const users = await params.dal.getUsers(params.tenantId, { role: 'STUDENT' });
  const lowered = queryValue.toLowerCase();
  const student = users.find(
    (u) =>
      u.tenantId === params.tenantId &&
      (u.id === queryValue || (u.studentCode && u.studentCode.toLowerCase() === lowered))
  );

  if (!student || !student.isActive) {
    throw new LessonScoreServiceError(
      404,
      'STUDENT_NOT_FOUND',
      `لم يتم العثور على طالب مسجل بهذا الكود (${queryValue})`
    );
  }

  const enrollments = await params.dal.getEnrollments(params.tenantId, {
    studentId: student.id,
    groupId: params.groupId,
  });

  const isEnrolled = enrollments.some(
    (e) =>
      e.tenantId === params.tenantId &&
      e.studentId === student.id &&
      e.groupId === params.groupId &&
      e.isActive
  );

  if (!isEnrolled) {
    throw new LessonScoreServiceError(
      403,
      'STUDENT_NOT_IN_GROUP',
      `الطالب (${student.fullName}) غير مقيد في هذه المجموعة أو تابع لمجموعة أخرى`
    );
  }

  return student;
}

export async function getSessionExamsAndGrades(params: {
  actor: AuthorizedActorContext;
  sessionId: string;
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<{
  exams: LessonExamRecord[];
  grades: LessonGradeRecord[];
  audits: LessonGradeAuditEntry[];
}> {
  const dal = params.dal ?? await providerForSession(params.actor, params.sessionId, params.store);
  const { session, group, subjectNameAr } = await assertSessionAndBranchAccess({
    actor: params.actor,
    sessionId: params.sessionId,
    allowClosedHistoricalSession: true,
    dal,
  });

  const [firestoreExams, firestoreGrades, firestoreAudits, dalExams] = await Promise.all([
    params.store.queryCollection<LessonExamRecord>('lesson_exams', [
      { fieldPath: 'tenantId', op: 'EQUAL', value: params.actor.tenant.id },
      { fieldPath: 'sessionId', op: 'EQUAL', value: session.id },
    ]),
    params.store.queryCollection<LessonGradeRecord>('lesson_grades', [
      { fieldPath: 'tenantId', op: 'EQUAL', value: params.actor.tenant.id },
      { fieldPath: 'sessionId', op: 'EQUAL', value: session.id },
    ]),
    params.store.queryCollection<LessonGradeAuditEntry>('lesson_grade_audits', [
      { fieldPath: 'tenantId', op: 'EQUAL', value: params.actor.tenant.id },
      { fieldPath: 'sessionId', op: 'EQUAL', value: session.id },
    ]),
    dal.getExams(params.actor.tenant.id, { groupId: group.id }),
  ]);

  const examsById = new Map<string, LessonExamRecord>();
  for (const dalExam of dalExams) {
    if (dalExam.sessionId !== session.id || dalExam.status === 'archived') continue;
    examsById.set(dalExam.id, {
      id: dalExam.id,
      tenantId: dalExam.tenantId,
      branchId: group.branchId,
      sessionId: session.id,
      groupId: group.id,
      subjectId: dalExam.subjectId ?? group.subjectId,
      subjectNameAr: dalExam.subjectNameAr ?? subjectNameAr,
      teacherId: dalExam.teacherId ?? session.teacherId,
      title: dalExam.title,
      totalMarks: dalExam.totalMarks,
      passMarks: dalExam.passMarks,
      version: 0,
      updatedByUid: 'system-seed',
      updatedAt: dalExam.createdAt,
      createdAt: dalExam.createdAt,
    });
  }

  for (const row of firestoreExams) {
    examsById.set(row.data.id, row.data);
  }

  const exams = Array.from(examsById.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const grades = firestoreGrades.map((row) => row.data);
  const audits = firestoreAudits
    .map((row) => row.data)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return { exams, grades, audits };
}

async function resolveOrBootstrapExam(params: {
  actor: AuthorizedActorContext;
  session: Session;
  group: Group;
  subjectNameAr?: string;
  examId: string;
  store: ILessonScoreStore;
  dal: IDataProvider;
}): Promise<{
  exam: LessonExamRecord;
  updateTime?: string;
  existsInFirestore: boolean;
}> {
  const existingSnap = await params.store.getDocument<LessonExamRecord>(
    `lesson_exams/${params.examId}`
  );
  if (existingSnap.exists) {
    const exam = existingSnap.data;
    if (
      exam.tenantId !== params.actor.tenant.id ||
      exam.sessionId !== params.session.id ||
      exam.groupId !== params.group.id
    ) {
      throw new LessonScoreServiceError(
        403,
        'EXAM_RELATION_MISMATCH',
        'الاختبار المحدد لا يتبع الحصة أو المجموعة المختارة'
      );
    }
    return { exam, updateTime: existingSnap.updateTime, existsInFirestore: true };
  }

  // Bootstrap safely ONLY if exam already exists in canonical DAL for this exact session & group
  const dalExams = await params.dal.getExams(params.actor.tenant.id, { groupId: params.group.id });
  const seededExam = dalExams.find(
    (e) =>
      e.id === params.examId &&
      e.tenantId === params.actor.tenant.id &&
      e.sessionId === params.session.id &&
      e.groupId === params.group.id &&
      e.status !== 'archived'
  );

  if (!seededExam) {
    throw new LessonScoreServiceError(
      404,
      'EXAM_NOT_FOUND',
      'الاختبار غير موجود لهذه الحصة؛ يرجى تحديد الدرجة النهائية لإنشائه أولاً'
    );
  }

  const nowIso = new Date().toISOString();
  const bootstrapped: LessonExamRecord = {
    id: seededExam.id,
    tenantId: params.actor.tenant.id,
    branchId: params.group.branchId,
    sessionId: params.session.id,
    groupId: params.group.id,
    subjectId: seededExam.subjectId ?? params.group.subjectId,
    subjectNameAr: seededExam.subjectNameAr ?? params.subjectNameAr,
    teacherId: seededExam.teacherId ?? params.session.teacherId,
    title: seededExam.title,
    totalMarks: seededExam.totalMarks,
    passMarks: seededExam.passMarks,
    version: 0,
    updatedByUid: params.actor.staff.uid,
    updatedByEmail: params.actor.staff.email,
    updatedByName: params.actor.staff.displayName,
    updatedAt: nowIso,
    createdAt: seededExam.createdAt || nowIso,
  };

  return { exam: bootstrapped, existsInFirestore: false };
}

export async function saveExamTotalMarks(params: {
  actor: AuthorizedActorContext;
  sessionId: string;
  examId?: string;
  title?: string;
  totalMarksInput: string | number;
  expectedVersion?: number;
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<{ exam: LessonExamRecord }> {
  const dal = params.dal ?? await providerForSession(params.actor, params.sessionId, params.store);
  const { session, group, subjectNameAr } = await assertSessionAndBranchAccess({
    actor: params.actor,
    sessionId: params.sessionId,
    dal,
  });

  const parsedMax = parseTotalMarksInput(String(params.totalMarksInput));
  if (!parsedMax.ok) {
    throw new LessonScoreServiceError(400, 'INVALID_TOTAL_MARKS', parsedMax.errorAr);
  }
  const newTotalMarks = parsedMax.value;

  const targetExamId =
    params.examId?.trim() || `${session.id}-exam`;

  const existingSnap = await params.store.getDocument<LessonExamRecord>(
    `lesson_exams/${targetExamId}`
  );
  const nowIso = new Date().toISOString();

  if (existingSnap.exists) {
    const existing = existingSnap.data;
    if (
      existing.tenantId !== params.actor.tenant.id ||
      existing.sessionId !== session.id ||
      existing.groupId !== group.id
    ) {
      throw new LessonScoreServiceError(
        403,
        'EXAM_RELATION_MISMATCH',
        'هذا الاختبار لا يرتبط بالحصة أو المجموعة المحددة'
      );
    }

    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== existing.version
    ) {
      throw new LessonScoreServiceError(
        409,
        'VERSION_CONFLICT',
        'تم تعديل الدرجة النهائية للاختبار من جهاز آخر؛ تم جلب أحدث قيمة',
        { latestExam: existing }
      );
    }

    const existingGrades = await params.store.queryCollection<LessonGradeRecord>('lesson_grades', [
      { fieldPath: 'tenantId', op: 'EQUAL', value: params.actor.tenant.id },
      { fieldPath: 'examId', op: 'EQUAL', value: targetExamId },
    ]);

    let highestGrade = -1;
    let highestStudentName = '';
    for (const row of existingGrades) {
      if (row.data.score > highestGrade) {
        highestGrade = row.data.score;
        highestStudentName = row.data.studentName;
      }
    }

    if (highestGrade >= 0 && newTotalMarks < highestGrade) {
      throw new LessonScoreServiceError(
        409,
        'TOTAL_MARKS_BELOW_RECORDED_GRADE',
        `تعذر خفض الدرجة النهائية إلى ${newTotalMarks} لأن هناك درجة مسجلة بالفعل تبلغ ${highestGrade}${highestStudentName ? ` (${highestStudentName})` : ''}. تم الإبقاء على جميع الدرجات كما هي.`,
        { highestRecordedScore: highestGrade }
      );
    }

    const updatedExam: LessonExamRecord = {
      ...existing,
      title: params.title?.trim() || existing.title,
      totalMarks: newTotalMarks,
      passMarks: Math.round(newTotalMarks * 50) / 100,
      version: existing.version + 1,
      updatedByUid: params.actor.staff.uid,
      updatedByEmail: params.actor.staff.email,
      updatedByName: params.actor.staff.displayName,
      updatedAt: nowIso,
    };

    const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const auditEntry: LessonGradeAuditEntry = {
      id: auditId,
      tenantId: params.actor.tenant.id,
      branchId: group.branchId,
      sessionId: session.id,
      groupId: group.id,
      teacherId: updatedExam.teacherId,
      examId: updatedExam.id,
      action: 'exam_max_marks_update',
      actorUid: params.actor.staff.uid,
      actorEmail: params.actor.staff.email,
      actorName: params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
      actorRole: params.actor.staff.role,
      previousScore: null,
      newScore: null,
      previousTotalMarks: existing.totalMarks,
      newTotalMarks,
      source: 'panel',
      timestamp: nowIso,
    };

    await params.store.commit([
      {
        type: 'set',
        documentPath: `lesson_exams/${updatedExam.id}`,
        data: updatedExam as unknown as Record<string, unknown>,
        currentDocument: existingSnap.updateTime
          ? { updateTime: existingSnap.updateTime }
          : { exists: true },
      },
      {
        type: 'set',
        documentPath: `lesson_grade_audits/${auditId}`,
        data: auditEntry as unknown as Record<string, unknown>,
        currentDocument: { exists: false },
      },
    ]);

    return { exam: updatedExam };
  }

  // Create new lesson exam document in Firestore (preserving seeded DAL title/metadata if present)
  const dalExams = await dal.getExams(params.actor.tenant.id, { groupId: group.id });
  const matchingSeed = dalExams.find((e) => e.id === targetExamId && e.sessionId === session.id);

  const createdExam: LessonExamRecord = {
    id: targetExamId,
    tenantId: params.actor.tenant.id,
    branchId: group.branchId,
    sessionId: session.id,
    groupId: group.id,
    subjectId: matchingSeed?.subjectId ?? group.subjectId,
    subjectNameAr: matchingSeed?.subjectNameAr ?? subjectNameAr,
    teacherId: matchingSeed?.teacherId ?? session.teacherId,
    title: params.title?.trim() || matchingSeed?.title || `اختبار حصة ${session.sessionDate}`,
    totalMarks: newTotalMarks,
    passMarks: Math.round(newTotalMarks * 50) / 100,
    version: 1,
    updatedByUid: params.actor.staff.uid,
    updatedByEmail: params.actor.staff.email,
    updatedByName: params.actor.staff.displayName,
    updatedAt: nowIso,
    createdAt: matchingSeed?.createdAt || nowIso,
  };

  const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditEntry: LessonGradeAuditEntry = {
    id: auditId,
    tenantId: params.actor.tenant.id,
    branchId: group.branchId,
    sessionId: session.id,
    groupId: group.id,
    teacherId: createdExam.teacherId,
    examId: createdExam.id,
    action: 'exam_create',
    actorUid: params.actor.staff.uid,
    actorEmail: params.actor.staff.email,
    actorName: params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
    actorRole: params.actor.staff.role,
    previousScore: null,
    newScore: null,
    previousTotalMarks: null,
    newTotalMarks,
    source: 'panel',
    timestamp: nowIso,
  };

  await params.store.commit([
    {
      type: 'set',
      documentPath: `lesson_exams/${createdExam.id}`,
      data: createdExam as unknown as Record<string, unknown>,
      currentDocument: { exists: false },
    },
    {
      type: 'set',
      documentPath: `lesson_grade_audits/${auditId}`,
      data: auditEntry as unknown as Record<string, unknown>,
      currentDocument: { exists: false },
    },
  ]);

  return { exam: createdExam };
}

export async function upsertLessonGrade(params: {
  actor: AuthorizedActorContext;
  sessionId: string;
  examId: string;
  studentIdOrCode: string;
  scoreInput: string | number;
  source: 'panel' | 'feed' | 'card';
  expectedVersion?: number;
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<{ grade: LessonGradeRecord; exam: LessonExamRecord; audit: LessonGradeAuditEntry }> {
  const dal = params.dal ?? await providerForSession(params.actor, params.sessionId, params.store);
  const { session, group, subjectNameAr } = await assertSessionAndBranchAccess({
    actor: params.actor,
    sessionId: params.sessionId,
    allowClosedHistoricalSession: params.source === 'card',
    dal,
  });

  const student = await resolveStudentEnrollmentInGroup({
    dal,
    tenantId: params.actor.tenant.id,
    groupId: group.id,
    studentIdOrCode: params.studentIdOrCode,
  });

  const resolvedExam = await resolveOrBootstrapExam({
    actor: params.actor,
    session,
    group,
    subjectNameAr,
    examId: params.examId,
    store: params.store,
    dal,
  });

  const parsedScore = parseLessonScore(String(params.scoreInput), resolvedExam.exam.totalMarks);
  if (!parsedScore.ok) {
    throw new LessonScoreServiceError(400, 'INVALID_SCORE', parsedScore.errorAr);
  }

  const gradeId = lessonGradeDocId(resolvedExam.exam.id, student.id);
  const existingGradeSnap = await params.store.getDocument<LessonGradeRecord>(
    `lesson_grades/${gradeId}`
  );

  if (existingGradeSnap.exists) {
    const existing = existingGradeSnap.data;
    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== existing.version
    ) {
      throw new LessonScoreServiceError(
        409,
        'GRADE_VERSION_CONFLICT',
        'تم تعديل درجة هذا الطالب من جلسة أخرى للتو؛ تم تحديث البيانات',
        { latestGrade: existing }
      );
    }
  }

  const nowIso = new Date().toISOString();
  const writes: FirestoreWriteOperation[] = [];
  let persistedExam = resolvedExam.exam;

  if (!resolvedExam.existsInFirestore) {
    persistedExam = {
      ...resolvedExam.exam,
      version: 1,
      updatedAt: nowIso,
    };
    writes.push({
      type: 'set',
      documentPath: `lesson_exams/${persistedExam.id}`,
      data: persistedExam as unknown as Record<string, unknown>,
      currentDocument: { exists: false },
    });
  }

  const nextVersion = existingGradeSnap.exists ? existingGradeSnap.data.version + 1 : 1;
  const previousScore = existingGradeSnap.exists ? existingGradeSnap.data.score : null;

  const gradeRecord: LessonGradeRecord = {
    id: gradeId,
    tenantId: params.actor.tenant.id,
    branchId: group.branchId,
    sessionId: session.id,
    groupId: group.id,
    teacherId: persistedExam.teacherId,
    examId: persistedExam.id,
    studentId: student.id,
    studentCode: student.studentCode || student.id,
    studentName: student.fullName,
    score: parsedScore.value,
    totalMarksSnapshot: persistedExam.totalMarks,
    version: nextVersion,
    recordedByUid: params.actor.staff.uid,
    recordedByName:
      params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
    recordedByRole: params.actor.staff.role,
    source: params.source,
    updatedAt: nowIso,
    createdAt: existingGradeSnap.exists ? existingGradeSnap.data.createdAt : nowIso,
  };

  const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditEntry: LessonGradeAuditEntry = {
    id: auditId,
    tenantId: params.actor.tenant.id,
    branchId: group.branchId,
    sessionId: session.id,
    groupId: group.id,
    teacherId: persistedExam.teacherId,
    examId: persistedExam.id,
    studentId: student.id,
    action: existingGradeSnap.exists ? 'grade_update' : 'grade_create',
    actorUid: params.actor.staff.uid,
    actorEmail: params.actor.staff.email,
    actorName:
      params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
    actorRole: params.actor.staff.role,
    previousScore,
    newScore: parsedScore.value,
    previousTotalMarks: null,
    newTotalMarks: persistedExam.totalMarks,
    source: params.source,
    timestamp: nowIso,
  };

  writes.push(
    {
      type: 'set',
      documentPath: `lesson_grades/${gradeId}`,
      data: gradeRecord as unknown as Record<string, unknown>,
      currentDocument: existingGradeSnap.exists
        ? existingGradeSnap.updateTime
          ? { updateTime: existingGradeSnap.updateTime }
          : { exists: true }
        : { exists: false },
    },
    {
      type: 'set',
      documentPath: `lesson_grade_audits/${auditId}`,
      data: auditEntry as unknown as Record<string, unknown>,
      currentDocument: { exists: false },
    }
  );

  await params.store.commit(writes);

  return { grade: gradeRecord, exam: persistedExam, audit: auditEntry };
}

export async function deleteLessonGrade(params: {
  actor: AuthorizedActorContext;
  sessionId: string;
  examId: string;
  studentId: string;
  source: 'panel' | 'feed' | 'card';
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<{ deleted: boolean; gradeId: string }> {
  const dal = params.dal ?? await providerForSession(params.actor, params.sessionId, params.store);
  const { session, group } = await assertSessionAndBranchAccess({
    actor: params.actor,
    sessionId: params.sessionId,
    allowClosedHistoricalSession: params.source === 'card',
    dal,
  });

  const gradeId = lessonGradeDocId(params.examId, params.studentId);
  const existingSnap = await params.store.getDocument<LessonGradeRecord>(`lesson_grades/${gradeId}`);
  if (!existingSnap.exists) {
    return { deleted: false, gradeId };
  }

  if (existingSnap.data.tenantId !== params.actor.tenant.id) {
    throw new LessonScoreServiceError(403, 'FORBIDDEN_CROSS_TENANT', 'غير مصرح بحذف هذه الدرجة');
  }

  const nowIso = new Date().toISOString();
  const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditEntry: LessonGradeAuditEntry = {
    id: auditId,
    tenantId: params.actor.tenant.id,
    branchId: group.branchId,
    sessionId: session.id,
    groupId: group.id,
    teacherId: existingSnap.data.teacherId,
    examId: params.examId,
    studentId: params.studentId,
    action: 'grade_delete',
    actorUid: params.actor.staff.uid,
    actorEmail: params.actor.staff.email,
    actorName:
      params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
    actorRole: params.actor.staff.role,
    previousScore: existingSnap.data.score,
    newScore: null,
    source: params.source,
    timestamp: nowIso,
  };

  await params.store.commit([
    {
      type: 'delete',
      documentPath: `lesson_grades/${gradeId}`,
      currentDocument: existingSnap.updateTime
        ? { updateTime: existingSnap.updateTime }
        : { exists: true },
    },
    {
      type: 'set',
      documentPath: `lesson_grade_audits/${auditId}`,
      data: auditEntry as unknown as Record<string, unknown>,
      currentDocument: { exists: false },
    },
  ]);

  return { deleted: true, gradeId };
}

export interface LocalImportCandidateInput {
  sessionId: string;
  studentId: string;
  examId: string;
  score: number;
  overwrite?: boolean;
}

export interface LocalImportItemResult {
  examId: string;
  studentId: string;
  sessionId: string;
  status: 'imported' | 'skipped_exists' | 'rejected';
  reason?: string;
}

export async function importReviewedLocalStorageGrades(params: {
  actor: AuthorizedActorContext;
  items: LocalImportCandidateInput[];
  store: ILessonScoreStore;
  dal?: IDataProvider;
}): Promise<{
  importedCount: number;
  skippedCount: number;
  rejectedCount: number;
  results: LocalImportItemResult[];
}> {
  const savedProvider = !params.dal && params.items.some(item => item.sessionId.startsWith('lesson:'))
    ? await loadGroupProvider(params.store, params.actor.tenant) : undefined;
  const results: LocalImportItemResult[] = [];
  let importedCount = 0;
  let skippedCount = 0;
  let rejectedCount = 0;

  for (const item of params.items) {
    try {
      const dal = params.dal ?? (item.sessionId.startsWith('lesson:') ? savedProvider! : getReceptionDataProvider());
      const { session, group, subjectNameAr } = await assertSessionAndBranchAccess({
        actor: params.actor,
        sessionId: item.sessionId,
        allowClosedHistoricalSession: true,
        dal,
      });

      const student = await resolveStudentEnrollmentInGroup({
        dal,
        tenantId: params.actor.tenant.id,
        groupId: group.id,
        studentIdOrCode: item.studentId,
      });

      const resolvedExam = await resolveOrBootstrapExam({
        actor: params.actor,
        session,
        group,
        subjectNameAr,
        examId: item.examId,
        store: params.store,
        dal,
      });

      const parsed = parseLessonScore(String(item.score), resolvedExam.exam.totalMarks);
      if (!parsed.ok) {
        rejectedCount += 1;
        results.push({
          examId: item.examId,
          studentId: item.studentId,
          sessionId: item.sessionId,
          status: 'rejected',
          reason: parsed.errorAr,
        });
        continue;
      }

      const gradeId = lessonGradeDocId(resolvedExam.exam.id, student.id);
      const existingSnap = await params.store.getDocument<LessonGradeRecord>(
        `lesson_grades/${gradeId}`
      );
      if (existingSnap.exists && !item.overwrite) {
        skippedCount += 1;
        results.push({
          examId: item.examId,
          studentId: item.studentId,
          sessionId: item.sessionId,
          status: 'skipped_exists',
          reason: `توجد درجة محفوظة مسبقًا في Firestore (${existingSnap.data.score} / ${resolvedExam.exam.totalMarks})`,
        });
        continue;
      }

      const nowIso = new Date().toISOString();
      const writes: FirestoreWriteOperation[] = [];
      let examToUse = resolvedExam.exam;
      if (!resolvedExam.existsInFirestore) {
        examToUse = { ...resolvedExam.exam, version: 1, updatedAt: nowIso };
        writes.push({
          type: 'set',
          documentPath: `lesson_exams/${examToUse.id}`,
          data: examToUse as unknown as Record<string, unknown>,
          currentDocument: { exists: false },
        });
      }

      const gradeRecord: LessonGradeRecord = {
        id: gradeId,
        tenantId: params.actor.tenant.id,
        branchId: group.branchId,
        sessionId: session.id,
        groupId: group.id,
        teacherId: examToUse.teacherId,
        examId: examToUse.id,
        studentId: student.id,
        studentCode: student.studentCode || student.id,
        studentName: student.fullName,
        score: parsed.value,
        totalMarksSnapshot: examToUse.totalMarks,
        version: existingSnap.exists ? existingSnap.data.version + 1 : 1,
        recordedByUid: params.actor.staff.uid,
        recordedByName:
          params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
        recordedByRole: params.actor.staff.role,
        source: 'localStorage_import',
        updatedAt: nowIso,
        createdAt: existingSnap.exists ? existingSnap.data.createdAt : nowIso,
      };

      const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const auditEntry: LessonGradeAuditEntry = {
        id: auditId,
        tenantId: params.actor.tenant.id,
        branchId: group.branchId,
        sessionId: session.id,
        groupId: group.id,
        teacherId: examToUse.teacherId,
        examId: examToUse.id,
        studentId: student.id,
        action: 'local_import',
        actorUid: params.actor.staff.uid,
        actorEmail: params.actor.staff.email,
        actorName:
          params.actor.staff.displayName || params.actor.staff.email || params.actor.staff.uid,
        actorRole: params.actor.staff.role,
        previousScore: existingSnap.exists ? existingSnap.data.score : null,
        newScore: parsed.value,
        newTotalMarks: examToUse.totalMarks,
        source: 'localStorage_import',
        timestamp: nowIso,
      };

      writes.push(
        {
          type: 'set',
          documentPath: `lesson_grades/${gradeId}`,
          data: gradeRecord as unknown as Record<string, unknown>,
          currentDocument: existingSnap.exists
            ? existingSnap.updateTime
              ? { updateTime: existingSnap.updateTime }
              : { exists: true }
            : { exists: false },
        },
        {
          type: 'set',
          documentPath: `lesson_grade_audits/${auditId}`,
          data: auditEntry as unknown as Record<string, unknown>,
          currentDocument: { exists: false },
        }
      );

      await params.store.commit(writes);
      importedCount += 1;
      results.push({
        examId: item.examId,
        studentId: item.studentId,
        sessionId: item.sessionId,
        status: 'imported',
      });
    } catch (err: unknown) {
      rejectedCount += 1;
      const reason = err instanceof Error ? err.message : 'فشل التحقق من السجل المحلي';
      results.push({
        examId: item.examId,
        studentId: item.studentId,
        sessionId: item.sessionId,
        status: 'rejected',
        reason,
      });
    }
  }

  return { importedCount, skippedCount, rejectedCount, results };
}

export function mapServiceErrorToHttp(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof FirebaseAuthError) {
    return {
      status: err.status,
      body: { success: false, error: 'FIREBASE_AUTH_ERROR', message: err.message },
    };
  }
  if (err instanceof LessonScoreServiceError) {
    return {
      status: err.status,
      body: {
        success: false,
        error: err.code,
        message: err.message,
        ...(err.details ?? {}),
      },
    };
  }
  if (err instanceof FirestoreHttpError) {
    if (err.status === 409) {
      return {
        status: 409,
        body: {
          success: false,
          error: 'CONCURRENT_WRITE_CONFLICT',
          message: 'تضارب تعديل متزامن على الدرجة؛ يرجى إعادة المحاولة',
        },
      };
    }
    if (err.status === 403) {
      return {
        status: 403,
        body: {
          success: false,
          error: 'FIRESTORE_PERMISSION_DENIED',
          message: 'رفضت قواعد أمان Firestore تنفيذ هذا التعديل',
        },
      };
    }
    return {
      status: err.status >= 400 && err.status < 600 ? err.status : 502,
      body: {
        success: false,
        error: 'FIRESTORE_ERROR',
        message: `تعذر الاتصال بـ Cloud Firestore: ${err.message}`,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع في خدمة الدرجات',
    },
  };
}
