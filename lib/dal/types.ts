export type UserRole =
  | 'PLATFORM_OWNER'
  | 'CENTER_ADMIN'
  | 'BRANCH_MANAGER'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT';

export type PricingModel = 'center' | 'private';
export type DiscountType = 'none' | 'percentage' | 'fixed' | 'free_100';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'postponed';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type VerificationMethod = 'barcode' | 'qr' | 'manual';
export type InvoiceStatus = 'pending' | 'partially_paid' | 'paid' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'instapay' | 'fawry';
export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';
export type ExamStatus = 'draft' | 'under_review' | 'published' | 'archived';
export type QuestionType = 'mcq' | 'true_false' | 'essay';
export type NotificationChannel = 'whatsapp' | 'fcm' | 'sms' | 'WHATSAPP' | 'FCM' | 'SMS';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type MaterialIndexStatus = 'pending' | 'indexing' | 'indexed' | 'failed' | 'insufficient';

export interface Tenant {
  id: string;
  slug: string;
  nameAr: string;
  nameEn?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
  settings: {
    currency: string;
    enableWhatsApp: boolean;
    enableFCM: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EducationalDivision {
  id: string;
  nameAr: string;
}

export interface EducationalGrade {
  id: string;
  tenantId: string;
  stageId: string;
  nameAr: string;
  order: number;
  hasDivisions?: boolean;
  divisions?: EducationalDivision[];
  createdAt?: string;
}

export interface EducationalStage {
  id: string;
  tenantId: string;
  nameAr: string;
  order: number;
  grades: EducationalGrade[];
  createdAt?: string;
}

export interface EducationalStageInput {
  id?: string;
  nameAr: string;
  order?: number;
}

export interface EducationalGradeInput {
  id?: string;
  stageId: string;
  nameAr: string;
  order?: number;
  hasDivisions?: boolean;
  divisions?: EducationalDivision[];
}

export interface SubjectInput {
  id?: string;
  nameAr: string;
  code?: string;
  stage: string;
  grade: string;
}

export interface BranchInput {
  id?: string;
  nameAr: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface Branch {
  id: string;
  tenantId: string;
  nameAr: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Classroom {
  id: string;
  tenantId: string;
  branchId: string;
  nameAr: string;
  capacity: number;
  equipment: {
    projector: boolean;
    airConditioning: boolean;
    smartBoard?: boolean;
    computers?: boolean;
  };
  createdAt: string;
}

export interface User {
  id: string;
  tenantId?: string;
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  studentCode?: string;
  nationalId?: string;
  stage?: string;
  grade?: string;
  division?: string;
  seatNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  balanceDue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  tenantId: string;
  nameAr: string;
  code?: string;
  stage: string;
  grade: string;
  createdAt: string;
}

export interface Group {
  id: string;
  tenantId: string;
  branchId: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  nameAr: string;
  academicYear: string;
  scheduleDay: number; // 0=Sunday..6=Saturday
  startTime: string; // "14:00"
  endTime: string;   // "16:00"
  pricingModel: PricingModel;
  monthlyFee: number;
  sessionFee: number;
  maxStudents: number;
  isActive: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  tenantId: string;
  groupId: string;
  classroomId?: string;
  teacherId: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: SessionStatus;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  tenantId: string;
  studentId: string;
  groupId: string;
  pricingModel: PricingModel;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  enrolledAt: string;
}

export interface Attendance {
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  scannedAt: string;
  verificationMethod: VerificationMethod;
  cashierUserId?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  studentId: string;
  groupId?: string;
  invoiceNumber: string;
  billingMonth: number;
  billingYear: number;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  studentId: string;
  cashierShiftId?: string;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  receivedByUserId: string;
  notes?: string;
  paidAt: string;
}

export interface TeacherRate {
  id: string;
  tenantId: string;
  teacherId: string;
  groupId?: string;
  subjectId?: string;
  model: PricingModel;
  fixedRatePerStudent: number;
  teacherPercentage: number;
  centerPercentage: number;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
  splitPercentage?: number;
}

export interface TeacherLessonCompensation {
  sessions: Array<{
    sessionId: string;
    sessionDate: string;
    groupName: string;
    attendanceCount: number;
    model: 'fixed_session' | 'per_attendee';
    rate: number;
    revenue: number;
    teacherDue: number;
    centerNet: number;
  }>;
  totalCompensation: number;
}

export interface TeacherPayroll {
  id: string;
  tenantId: string;
  teacherId: string;
  payrollMonth: number;
  payrollYear: number;
  conductedSessions: number;
  totalAttendance: number;
  averageAttendance: number;
  calculatedCompensation: number;
  bonuses: number;
  deductions: number;
  netPayroll: number;
  lessonCompensation?: TeacherLessonCompensation;
  status: PayrollStatus;
  approvedByUserId?: string;
  approvedAt?: string;
  createdAt: string;
}

export type DocumentCategory =
  | 'lecture_notes'
  | 'summary'
  | 'exercises'
  | 'exam_bank'
  | 'formula_sheet';

export interface Material {
  id: string;
  tenantId: string;
  teacherId: string;
  stage: string;
  grade: string;
  subjectId: string;
  unitName: string;
  lessonName: string;
  title: string;
  description?: string;
  category?: DocumentCategory;
  fileUrl: string;
  googleDriveFileId?: string;
  googleDriveWebViewLink?: string;
  googleDriveWebContentLink?: string;
  googleDriveThumbnailLink?: string;
  fileSizeBytes: number;
  fileType: string;
  textContentIndexed?: string;
  wordCount: number;
  indexStatus: MaterialIndexStatus;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateMaterialInput {
  tenantId: string;
  teacherId: string;
  stage: string;
  grade: string;
  subjectId: string;
  unitName: string;
  lessonName: string;
  title: string;
  description?: string;
  category?: DocumentCategory;
  fileUrl: string;
  googleDriveFileId?: string;
  fileSizeBytes?: number;
  fileType?: string;
  textContentIndexed?: string;
  indexImmediately?: boolean;
}

export interface MaterialsSummaryStats {
  totalMaterials: number;
  indexedMaterials: number;
  pendingMaterials: number;
  insufficientMaterials: number;
  failedMaterials: number;
  totalIndexedWords: number;
  googleDriveLinkedCount: number;
}

export interface Exam {
  id: string;
  tenantId: string;
  sessionId?: string;
  groupId: string;
  subjectId?: string;
  subjectNameAr?: string;
  grade?: string;
  stage?: string;
  teacherId: string;
  title: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  isAiGenerated: boolean;
  groundedMaterialIds: string[];
  status: ExamStatus;
  instructions?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionNumber: number;
  questionText: string;
  katexFormula?: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  marks: number;
  orderIndex: number;
  rubric?: string;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string;
  autoGradedScore: number;
  manualGradedScore: number;
  totalScore: number;
  status: 'in_progress' | 'submitted' | 'graded';
  percentage?: number;
  answers?: Record<string, any>;
}

export interface ExamAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
  teacherFeedback?: string;
}

export interface NotificationRecord {
  id: string;
  tenantId: string;
  recipientUserId?: string;
  recipientPhone: string;
  channel: NotificationChannel;
  templateName: string;
  payload: Record<string, any>;
  status: NotificationStatus;
  retryCount: number;
  errorMessage?: string;
  scheduledAt: string;
  sentAt?: string;
}

export type NotificationLog = NotificationRecord;

export interface CashierShift {
  id: string;
  tenantId: string;
  branchId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashCollected: number;
  digitalCollected: number;
  cashDisbursed?: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'open' | 'closed';
  notes?: string;
  denominations?: Record<string, number>;
}

export interface TeacherAdvance {
  id: string;
  tenantId: string;
  teacherId: string;
  amount: number;
  reason?: string;
  disbursedByUserId: string;
  paidAt: string;
  payrollId?: string;
  status: 'pending' | 'settled';
  createdAt: string;
}

export interface TeacherMonthlyStatement {
  tenantId: string;
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  subjectNames: string[];
  payrollMonth: number;
  payrollYear: number;
  centerSubscription: {
    groups: Array<{
      groupId: string;
      groupName: string;
      ratePerStudent: number;
      conductedSessionsCount: number;
      excludedSessionsCount: number;
      totalValidAttendance: number;
      averageAttendance: number;
      compensationAmount: number;
      sessions?: Array<{
        sessionId: string;
        sessionDate: string;
        status: SessionStatus;
        validAttendanceCount: number;
      }>;
    }>;
    totalCompensation: number;
  };
  privateLessons: {
    groups: Array<{
      groupId: string;
      groupName: string;
      teacherPercentage: number;
      centerPercentage: number;
      enrolledCount: number;
      totalGrossInvoiced: number;
      totalDiscountAmount: number;
      totalNetRevenue: number;
      totalTeacherShare: number;
      totalCenterShare: number;
      totalCollected: number;
      totalCollectedTeacherShare: number;
      uncollectedTeacherBalance: number;
      roundingLeakage: number;
      items?: Array<{
        enrollmentId: string;
        studentId: string;
        studentName: string;
        basePrice: number;
        discountType: DiscountType;
        discountValue: number;
        netRevenue: number;
        teacherShare: number;
        centerShare: number;
        collectedAmount: number;
      }>;
    }>;
    totalInvoicedTeacherShare: number;
    totalCollectedTeacherShare: number;
    totalCenterShare: number;
    totalRoundingLeakage: number;
  };
  lessonCompensation?: TeacherLessonCompensation;
  adjustments: {
    advances: TeacherAdvance[];
    totalAdvances: number;
    bonuses: Array<{ description: string; amount: number }>;
    totalBonuses: number;
    deductions: Array<{ reason: string; amount: number }>;
    totalDeductions: number;
  };
  summary: {
    grossCompensation: number;
    grossCollectedCompensation: number;
    totalAdvances: number;
    totalBonuses: number;
    totalDeductions: number;
    netPayrollInvoiced: number;
    netPayrollCollected: number;
    payrollRecord?: TeacherPayroll;
  };
}

export interface StudentEnrollmentDetail extends Enrollment {
  group: Group;
  subject?: Subject;
  teacher?: User;
  classroom?: Classroom;
  branch?: Branch;
}

export interface BalanceAlert {
  hasBalance: boolean;
  balanceDue: number;
  messageAr: string;
}

export interface AttendanceScanResponse {
  success: boolean;
  isDuplicate: boolean;
  duplicate: boolean;
  isNewRecord: boolean;
  status: AttendanceStatus;
  scannedAt: string;
  recordedAt: string;
  sessionId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  message: string;
  messageAr: string;
  attendance: Attendance;
  student?: User;
  session?: Session;
  balanceAlert?: BalanceAlert;
}

export interface SessionAttendanceStats {
  sessionId: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRatePercentage: number;
  totalSessionFeeCollected: number;
  studentsWithBalanceDueCount: number;
  lastScannedAt?: string;
  records: Array<{
    attendanceId: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    status: AttendanceStatus;
    scannedAt: string;
    verificationMethod: VerificationMethod;
    balanceDue: number;
    avatarUrl?: string;
  }>;
}

export interface StudentAttendanceDetail extends Attendance {
  session: Session;
  group?: Group;
  subject?: Subject;
  teacher?: User;
}

export interface CreateStudentInput {
  fullName: string;
  studentCode?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  stage: string;
  grade: string;
  division?: string;
  seatNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  avatarUrl?: string;
}

export interface EnrollStudentInput {
  tenantId: string;
  studentId: string;
  groupId: string;
  pricingModel: PricingModel;
  discountType: DiscountType;
  discountValue: number;
}

export interface Expense {
  id: string;
  tenantId: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface BookInventoryItem {
  id: string;
  tenantId: string;
  subjectId: string;
  grade: string;
  title: string;
  unitCost: number;
  sellingPrice: number;
  quantityInStock: number;
  createdAt: string;
}

export interface IDataProvider {
  getNotifications?: (tenantId: string, limit?: number) => Promise<NotificationLog[]>;
}

