import {
  Tenant,
  Branch,
  Classroom,
  User,
  Subject,
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
  NotificationLog,
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

export interface ScanResult {
  success: boolean;
  isNewRecord: boolean;
  duplicate: boolean;
  attendance?: Attendance;
  student?: User;
  session?: Session;
  balanceAlert?: {
    hasBalance: boolean;
    balanceDue: number;
    messageAr: string;
  };
  messageAr: string;
}

export interface CenterSubscriptionResult {
  conductedSessionsCount: number;
  totalValidAttendance: number;
  averageAttendance: number;
  contractualRate: number;
  compensationAmount: number;
  excludedSessionsCount: number;
}

export interface PrivateLessonItemInput {
  enrollmentId: string;
  studentId: string;
  basePrice: number;
  discountType: 'none' | 'percentage' | 'fixed' | 'free_100';
  discountValue: number;
  collectedAmount: number;
}

export interface PrivateLessonBatchResult {
  totalGrossInvoiced: number;
  totalDiscountAmount: number;
  totalNetRevenue: number;
  totalTeacherShare: number;
  totalCenterShare: number;
  totalCollected: number;
  totalCollectedTeacherShare: number;
  roundingLeakage: number;
  items: Array<{
    enrollmentId: string;
    netRevenue: number;
    teacherShare: number;
    centerShare: number;
    invoicedBalance: number;
    collectedAmount: number;
  }>;
}

export interface ExamPreflightResult {
  allowed: boolean;
  errorCode?: 'UNINDEXED_SOURCE_DOCUMENTS' | 'INSUFFICIENT_SOURCE_DOCUMENTS' | 'EMPTY_SELECTION';
  messageArabic: string;
  unindexedDocTitles?: string[];
  totalWordCount?: number;
}

export interface IDataProvider {
  // 1. Tenants & Branches
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
  getTenants(): Promise<Tenant[]>;
  getBranches(tenantId: string): Promise<Branch[]>;
  getClassrooms(tenantId: string, branchId?: string): Promise<Classroom[]>;

  // 2. Users & RBAC
  getUserById(userId: string): Promise<User | null>;
  getUserByStudentCode(tenantId: string, code: string): Promise<User | null>;
  getUsers(tenantId: string, filter?: { role?: UserRole; search?: string }): Promise<User[]>;
  updateUser(
    userId: string,
    updates: Partial<User>,
    actorId?: string,
    actorRole?: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string; status: number }>;
  updateUserProfilePhoto(
    userId: string,
    avatarUrl: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string }>;

  // 3. Courses, Groups & Timetable
  getSubjects(tenantId: string): Promise<Subject[]>;
  getGroups(tenantId: string, filter?: { branchId?: string; teacherId?: string }): Promise<Group[]>;
  getGroupById(tenantId: string, groupId: string): Promise<Group | null>;

  // 4. Sessions
  getSessions(tenantId: string, filter?: { groupId?: string; date?: string; teacherId?: string }): Promise<Session[]>;
  getSessionById(tenantId: string, sessionId: string): Promise<Session | null>;
  updateSessionStatus(sessionId: string, status: SessionStatus, cancellationReason?: string): Promise<Session>;

  // 5. Enrollments & Students
  getEnrollments(tenantId: string, filter?: { groupId?: string; studentId?: string }): Promise<Enrollment[]>;
  createStudent(tenantId: string, input: CreateStudentInput): Promise<User>;
  enrollStudent(input: EnrollStudentInput): Promise<{ success: boolean; enrollment?: Enrollment; invoice?: Invoice; error?: string }>;
  unenrollStudent(tenantId: string, enrollmentId: string): Promise<{ success: boolean; error?: string }>;
  getStudentEnrollmentDetails(tenantId: string, studentId: string): Promise<StudentEnrollmentDetail[]>;
  getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceDetail[]>;

  // 6. Fast Reception Attendance (Idempotent Scanning)
  recordAttendance(params: {
    tenantId: string;
    sessionId: string;
    studentIdOrCode: string;
    verificationMethod?: 'barcode' | 'qr' | 'manual';
    cashierUserId?: string;
  }): Promise<ScanResult>;
  recordAttendanceScan(
    tenantId: string,
    sessionId: string,
    studentCodeOrId: string,
    recordedByUserId?: string,
    verificationMethod?: VerificationMethod
  ): Promise<AttendanceScanResponse>;
  getSessionAttendance(sessionId: string): Promise<Attendance[]>;
  getSessionAttendanceStats(
    tenantId: string,
    sessionId: string
  ): Promise<SessionAttendanceStats>;

  // 7. Teacher Rates & Dual Compensation
  getTeacherRates(tenantId: string, teacherId?: string): Promise<TeacherRate[]>;
  updateTeacherRate(
    rateId: string,
    updates: Partial<TeacherRate>,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherRate; error?: string; status: number }>;
  calculateCenterSubscriptionCompensation(
    sessions: Array<{ sessionId: string; sessionStatus: SessionStatus; validAttendanceCount: number }>,
    contractualFixedRate: number
  ): CenterSubscriptionResult;
  calculatePrivateLessonsSplit(
    items: PrivateLessonItemInput[],
    teacherPercentage: number
  ): PrivateLessonBatchResult;
  getTeacherPayroll(tenantId: string, filter?: { teacherId?: string; year?: number; month?: number }): Promise<TeacherPayroll[]>;
  calculateMonthlyTeacherPayroll(params: {
    tenantId: string;
    teacherId: string;
    year: number;
    month: number;
  }): Promise<TeacherMonthlyStatement>;
  approveTeacherPayroll(
    payrollId: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }>;
  disburseTeacherPayroll(
    payrollId: string,
    paymentMethod: PaymentMethod,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }>;
  getTeacherAdvances(
    tenantId: string,
    filter?: { teacherId?: string; status?: 'pending' | 'settled' }
  ): Promise<TeacherAdvance[]>;
  recordTeacherAdvance(params: {
    tenantId: string;
    teacherId: string;
    amount: number;
    reason?: string;
    disbursedByUserId: string;
  }): Promise<TeacherAdvance>;

  // 8. Financial Suite
  getInvoices(tenantId: string, filter?: { studentId?: string; status?: InvoiceStatus }): Promise<Invoice[]>;
  getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null>;
  createInvoice(params: {
    tenantId: string;
    studentId: string;
    groupId?: string;
    totalAmount: number;
    discountType?: string;
    discountValue?: number;
    billingMonth: number;
    billingYear: number;
    dueDate: string;
  }): Promise<Invoice>;
  getPayments(tenantId: string, filter?: { studentId?: string; invoiceId?: string; shiftId?: string }): Promise<Payment[]>;
  getActiveCashierShift(tenantId: string, cashierUserId?: string, branchId?: string): Promise<CashierShift | null>;
  openCashierShift(params: {
    tenantId: string;
    branchId: string;
    cashierUserId: string;
    openingCash: number;
    notes?: string;
  }): Promise<CashierShift>;
  closeCashierShift(params: {
    shiftId: string;
    actualCash: number;
    notes?: string;
    denominations?: Record<string, number>;
  }): Promise<CashierShift>;
  recordExpense(params: {
    tenantId: string;
    branchId: string;
    category: string;
    description: string;
    amount: number;
    createdByUserId: string;
    shiftId?: string;
  }): Promise<Expense>;
  recordPayment(params: {
    tenantId: string;
    invoiceId: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    shiftId?: string;
    notes?: string;
  }): Promise<{ payment: Payment; updatedInvoice: Invoice; updatedStudent?: User }>;
  getCashierShifts(tenantId: string, filter?: { cashierUserId?: string; status?: 'open' | 'closed' }): Promise<CashierShift[]>;
  getExpenses(tenantId: string): Promise<Expense[]>;
  getBooksInventory(tenantId: string): Promise<BookInventoryItem[]>;

  // 9. Materials & AI Exams
  getMaterials(tenantId: string, filter?: { stage?: string; grade?: string; subjectId?: string; indexStatus?: MaterialIndexStatus; search?: string }): Promise<Material[]>;
  getMaterialById(tenantId: string, materialId: string): Promise<Material | null>;
  createMaterial(input: CreateMaterialInput): Promise<Material>;
  updateMaterial(tenantId: string, materialId: string, updates: Partial<Material>): Promise<Material>;
  deleteMaterial(tenantId: string, materialId: string): Promise<{ success: boolean }>;
  indexMaterialContent(tenantId: string, materialId: string, options?: { forceReindex?: boolean; customText?: string }): Promise<Material>;
  linkGoogleDriveDocument(tenantId: string, params: {
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
  }): Promise<Material>;
  getMaterialsStats(tenantId: string): Promise<MaterialsSummaryStats>;

  validateExamPreflight(sourceDocumentIds: string[]): Promise<ExamPreflightResult>;
  createExamDraft(params: {
    tenantId: string;
    groupId?: string;
    subjectId?: string;
    teacherId: string;
    title: string;
    durationMinutes: number;
    sourceDocumentIds: string[];
    questions: Array<Omit<ExamQuestion, 'id' | 'examId'>>;
  }): Promise<{ exam: Exam; questions: ExamQuestion[] }>;
  generateAiExam(request: {
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
  }): Promise<{ exam: Exam; questions: ExamQuestion[] }>;
  getExams(tenantId: string, filter?: { groupId?: string; teacherId?: string; status?: ExamStatus; subjectId?: string }): Promise<Exam[]>;
  getStudentExamSubmissions(tenantId: string, groupId: string, studentId: string): Promise<ExamSubmission[]>;
  getExamById(examId: string): Promise<{ exam: Exam; questions: ExamQuestion[] } | null>;
  updateExamQuestion(params: {
    tenantId: string;
    examId: string;
    questionId: string;
    updates: Partial<ExamQuestion>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; question?: ExamQuestion; error?: string; status: number }>;
  reorderExamQuestions(params: {
    tenantId: string;
    examId: string;
    questionOrder: Array<{ questionId: string; orderIndex: number }>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; questions?: ExamQuestion[]; error?: string; status: number }>;
  updateExamMetadata(params: {
    tenantId: string;
    examId: string;
    updates: Partial<Pick<Exam, 'title' | 'durationMinutes' | 'passMarks' | 'instructions' | 'status'>>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }>;
  publishExam(examId: string, actorId: string, actorRole: UserRole): Promise<Exam>;
  archiveExam(params: {
    tenantId: string;
    examId: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }>;
  submitExam(
    examId: string,
    studentId: string,
    answers: Array<{ questionId: string; selectedAnswer: string }>
  ): Promise<{ submission: ExamSubmission; score: number; percentage: number }>;

  // 10. Notifications
  enqueueNotification(params: {
    tenantId: string;
    recipientPhone: string;
    channel: NotificationChannel;
    templateName: string;
    payload: Record<string, any>;
    recipientUserId?: string;
  }): Promise<NotificationRecord>;
  getNotificationLogs(tenantId: string): Promise<NotificationRecord[]>;
  getNotifications?: (tenantId: string, limit?: number) => Promise<NotificationLog[]>;
  resendNotification?: (notificationId: string) => Promise<NotificationRecord>;
}

export * from './types';
export * from './factory';

