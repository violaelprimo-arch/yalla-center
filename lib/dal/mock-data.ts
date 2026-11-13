import { matchTeacherContract, type TeacherProfile } from '@/lib/teachers/profile';
import { calculateTeacherSessionPay, countTeacherSessionAttendance } from '@/lib/teachers/session-compensation';
import { cairoClock } from '@/lib/attendance/reception';
import { archiveGroup, mergeManagedRecords, moneyAmount, recurringSessions, sessionDateFromId, shiftDate, studentGroupFee } from '@/lib/timetable/group-schedule';
import { calculateFixedSessionSplit, splitPrivateFee } from '@/lib/finance/group-pricing';
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
  BalanceAlert,
  VerificationMethod,
  CreateMaterialInput,
  MaterialsSummaryStats,
  DocumentCategory,
  MaterialIndexStatus,
  EducationalStage,
  EducationalStageInput,
  EducationalGrade,
  EducationalGradeInput,
  SubjectInput,
  BranchInput,
} from './types';
import {
  IDataProvider,
  ScanResult,
  CenterSubscriptionResult,
  PrivateLessonItemInput,
  PrivateLessonBatchResult,
  ExamPreflightResult,
} from './index';
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
import type { MasterData } from './master-data';

export function buildDefaultStages(tenantId: string): EducationalStage[] {
  return [
    {
      id: 'primary',
      tenantId,
      nameAr: 'المرحلة الابتدائية',
      order: 1,
      grades: [
        { id: '1_prim', tenantId, stageId: 'primary', nameAr: 'الصف الأول الابتدائي', order: 1 },
        { id: '2_prim', tenantId, stageId: 'primary', nameAr: 'الصف الثاني الابتدائي', order: 2 },
        { id: '3_prim', tenantId, stageId: 'primary', nameAr: 'الصف الثالث الابتدائي', order: 3 },
        { id: '4_prim', tenantId, stageId: 'primary', nameAr: 'الصف الرابع الابتدائي', order: 4 },
        { id: '5_prim', tenantId, stageId: 'primary', nameAr: 'الصف الخامس الابتدائي', order: 5 },
        { id: '6_prim', tenantId, stageId: 'primary', nameAr: 'الصف السادس الابتدائي', order: 6 },
      ],
    },
    {
      id: 'preparatory',
      tenantId,
      nameAr: 'المرحلة الإعدادية',
      order: 2,
      grades: [
        { id: '1_prep', tenantId, stageId: 'preparatory', nameAr: 'الصف الأول الإعدادي', order: 1 },
        { id: '2_prep', tenantId, stageId: 'preparatory', nameAr: 'الصف الثاني الإعدادي', order: 2 },
        { id: '3_prep', tenantId, stageId: 'preparatory', nameAr: 'الصف الثالث الإعدادي', order: 3 },
      ],
    },
    {
      id: 'secondary',
      tenantId,
      nameAr: 'المرحلة الثانوية',
      order: 3,
      grades: [
        { id: '1_sec', tenantId, stageId: 'secondary', nameAr: 'الصف الأول الثانوي', order: 1 },
        {
          id: '2_sec',
          tenantId,
          stageId: 'secondary',
          nameAr: 'الصف الثاني الثانوي',
          order: 2,
          hasDivisions: true,
          divisions: [
            { id: 'scientific', nameAr: 'علمي' },
            { id: 'literary', nameAr: 'أدبي' },
          ],
        },
        {
          id: '3_sec',
          tenantId,
          stageId: 'secondary',
          nameAr: 'الصف الثالث الثانوي',
          order: 3,
          hasDivisions: true,
          divisions: [
            { id: 'scientific_math', nameAr: 'علمي رياضة' },
            { id: 'scientific_science', nameAr: 'علمي علوم' },
            { id: 'literary', nameAr: 'أدبي' },
          ],
        },
      ],
    },
  ];
}

export const INITIAL_SEEDED_DATA = {
  stages: [
    ...buildDefaultStages('tenant-maher-001'),
    ...buildDefaultStages('tenant-rowad-002'),
  ],
  tenants: [
    {
      id: 'tenant-maher-001',
      slug: 'al-maher',
      nameAr: 'سنتر الماهر النموذجي',
      nameEn: 'Al Maher Educational Center',
      logoUrl: '/brand/yalla-center-logo-dark.png',
      phone: '01001234567',
      address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
      subscriptionPlan: 'pro' as const,
      isActive: true,
      settings: { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tenant-rowad-002',
      slug: 'al-rowad',
      nameAr: 'سنتر الرواد التعليمي',
      nameEn: 'Al Rowad Educational Center',
      logoUrl: '/brand/yalla-center-logo-light.png',
      phone: '01119876543',
      address: 'شارع مصطفى النحاس، المنصورة، الدقهلية',
      subscriptionPlan: 'enterprise' as const,
      isActive: true,
      settings: { currency: 'EGP', enableWhatsApp: true, enableFCM: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],

  branches: [
    {
      id: 'branch-nasr-city',
      tenantId: 'tenant-maher-001',
      nameAr: 'فرع مدينة نصر الرئيسي',
      address: 'شارع عباس العقاد تقاطع النصر',
      phone: '01001234567',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'branch-heliopolis',
      tenantId: 'tenant-maher-001',
      nameAr: 'فرع مصر الجديدة',
      address: 'ميدان روكسي، مصر الجديدة',
      phone: '01007654321',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],

  classrooms: [
    {
      id: 'room-101',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة د. زويل (1)',
      capacity: 60,
      equipment: { projector: true, airConditioning: true, smartBoard: true },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'room-102',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة العقاد (2)',
      capacity: 40,
      equipment: { projector: true, airConditioning: true, smartBoard: false },
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],

  users: [
    {
      id: 'user-owner-001',
      tenantId: undefined,
      role: 'PLATFORM_OWNER' as const,
      fullName: 'م. إسلام خليل (مدير المنصة)',
      email: 'owner@yallacenter.com',
      phone: '01000000001',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-admin-maher',
      tenantId: 'tenant-maher-001',
      role: 'CENTER_ADMIN' as const,
      fullName: 'أ. محمود التهامي (مدير السنتر)',
      email: 'admin@almaher.edu.eg',
      phone: '01011112222',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-recep-001',
      tenantId: 'tenant-maher-001',
      role: 'RECEPTIONIST' as const,
      fullName: 'سارة الشافعي (الاستقبال)',
      email: 'sara@almaher.edu.eg',
      phone: '01033334444',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-accountant-001',
      tenantId: 'tenant-maher-001',
      role: 'ACCOUNTANT' as const,
      fullName: 'طارق عبد المنعم (المحاسب)',
      email: 'tarek@almaher.edu.eg',
      phone: '01044445555',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-teacher-math',
      tenantId: 'tenant-maher-001',
      role: 'TEACHER' as const,
      fullName: 'أ. أحمد محمد الشناوي (معلم رياضيات)',
      email: 'ahmed.math@almaher.edu.eg',
      phone: '01055556666',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-teacher-phys',
      tenantId: 'tenant-maher-001',
      role: 'TEACHER' as const,
      fullName: 'د. هاني نبيل (معلم فيزياء)',
      email: 'hani.phys@almaher.edu.eg',
      phone: '01066667777',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-student-1001',
      tenantId: 'tenant-maher-001',
      role: 'STUDENT' as const,
      fullName: 'أحمد محمد علي',
      studentCode: 'STD-1001',
      email: 'ahmed.ali@student.edu.eg',
      phone: '01012341001',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6',
      stage: 'secondary',
      grade: '3_sec',
      division: 'scientific_math',
      seatNumber: '5001',
      guardianName: 'محمد علي (ولي الأمر)',
      guardianPhone: '01099991001',
      balanceDue: 0.0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-student-1002',
      tenantId: 'tenant-maher-001',
      role: 'STUDENT' as const,
      fullName: 'مريم خالد حسن',
      studentCode: 'STD-1002',
      email: 'mariam.khaled@student.edu.eg',
      phone: '01012341002',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      stage: 'secondary',
      grade: '3_sec',
      division: 'scientific_science',
      seatNumber: '5002',
      guardianName: 'خالد حسن',
      guardianPhone: '01099991002',
      balanceDue: 150.0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-student-1003',
      tenantId: 'tenant-maher-001',
      role: 'STUDENT' as const,
      fullName: 'يوسف إبراهيم خليل',
      studentCode: 'STD-1003',
      phone: '01012341003',
      avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea',
      stage: 'secondary',
      grade: '2_sec',
      balanceDue: 0.0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-bm-nasr',
      tenantId: 'tenant-maher-001',
      role: 'BRANCH_MANAGER' as const,
      fullName: 'أ. كمال عبد الرحيم (مدير فرع مدينة نصر)',
      email: 'kamal.branch@almaher.edu.eg',
      phone: '01077778888',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'user-parent-ahmed',
      tenantId: 'tenant-maher-001',
      role: 'PARENT' as const,
      fullName: 'محمد علي (ولي أمر الطالب أحمد)',
      email: 'mohamed.ali.parent@gmail.com',
      phone: '01099991001',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      balanceDue: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],

  subjects: [
    {
      id: 'sub-math-3sec',
      tenantId: 'tenant-maher-001',
      nameAr: 'الرياضيات التطبيقية (الثانوية العامة)',
      code: 'MATH-301',
      stage: 'secondary',
      grade: '3_sec',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sub-phys-3sec',
      tenantId: 'tenant-maher-001',
      nameAr: 'الفيزياء الكهربية والحديثة',
      code: 'PHYS-301',
      stage: 'secondary',
      grade: '3_sec',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sub-chem-3sec',
      tenantId: 'tenant-maher-001',
      nameAr: 'الكيمياء العامة وغير العضوية',
      code: 'CHEM-301',
      stage: 'secondary',
      grade: '3_sec',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],

  groups: [
    {
      id: 'grp-math-sat',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      classroomId: 'room-101',
      subjectId: 'sub-math-3sec',
      teacherId: 'user-teacher-math',
      nameAr: 'مجموعة العباقرة - رياضيات 3 ثانوي (السبت)',
      academicYear: '2026/2027',
      scheduleDay: 6,
      startTime: '14:00',
      endTime: '16:00',
      pricingModel: 'center' as const,
      monthlyFee: 300,
      sessionFee: 80,
      maxStudents: 50,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'grp-phys-sun',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      classroomId: 'room-102',
      subjectId: 'sub-phys-3sec',
      teacherId: 'user-teacher-phys',
      nameAr: 'مجموعة النخبة الخاصة - فيزياء 3 ثانوي (الأحد)',
      academicYear: '2026/2027',
      scheduleDay: 0,
      startTime: '16:00',
      endTime: '18:00',
      pricingModel: 'private' as const,
      monthlyFee: 400,
      sessionFee: 100,
      maxStudents: 15,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],

  sessions: [
    {
      id: 'sess-math-1',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-04',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الأولى - مقدمة التفاضل والتكامل',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-2',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-11',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الثانية - قواعد الاشتقاق الضمني',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-3',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-18',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الثالثة - المعدلات الزمنية المرتبطة',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-4',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-25',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed' as const,
      notes: 'الحصة الرابعة - تطبيقات القيم العظمى والصغرى',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-math-5-canceled',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-28',
      startTime: '14:00',
      endTime: '16:00',
      status: 'canceled' as const,
      cancellationReason: 'عطلة رسمية بمناسبة ذكرى النصر',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'sess-live-today',
      tenantId: 'tenant-maher-001',
      groupId: 'grp-math-sat',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      sessionDate: '2026-10-18',
      startTime: '14:00',
      endTime: '16:00',
      status: 'in_progress' as const,
      notes: 'حصة اليوم المباشرة - جاهزة للاستقبال',
      createdAt: '2026-10-18T00:00:00Z',
    },
  ],

  enrollments: [
    {
      id: 'enr-1001-math',
      tenantId: 'tenant-maher-001',
      studentId: 'user-student-1001',
      groupId: 'grp-math-sat',
      pricingModel: 'center' as const,
      discountType: 'none' as const,
      discountValue: 0,
      isActive: true,
      enrolledAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'enr-1002-math',
      tenantId: 'tenant-maher-001',
      studentId: 'user-student-1002',
      groupId: 'grp-math-sat',
      pricingModel: 'center' as const,
      discountType: 'none' as const,
      discountValue: 0,
      isActive: true,
      enrolledAt: '2026-09-01T00:00:00Z',
    },
  ],

  attendance: [] as Attendance[],

  teacherRates: [
    {
      id: 'rate-teacher-math',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-math',
      groupId: 'grp-math-sat',
      subjectId: 'sub-math-3sec',
      model: 'center' as const,
      fixedRatePerStudent: 20.0,
      teacherPercentage: 0,
      centerPercentage: 0,
      splitPercentage: 0,
      effectiveFrom: '2026-09-01',
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'rate-teacher-phys',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      groupId: 'grp-phys-sun',
      subjectId: 'sub-phys-3sec',
      model: 'private' as const,
      fixedRatePerStudent: 0,
      teacherPercentage: 70.0,
      centerPercentage: 30.0,
      splitPercentage: 70.0,
      effectiveFrom: '2026-09-01',
      isActive: true,
      createdAt: '2026-09-01T00:00:00Z',
    },
  ],

  materials: [
    {
      id: 'mat-kirchhoff-complete',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الأولى: التيار الكهربي وقانون أوم',
      lessonName: 'قوانين كيرشوف وتطبيقات الدوائر الكهربية',
      title: 'مذكرة الشرح الشامل - قوانين كيرشوف وقانون أوم للدائرة المغلقة',
      description: 'شرح وافٍ لقانوني كيرشوف الأول والثاني وتطبيقاتهما على الدوائر الكهربية المعقدة وحساب شدة التيار وفرق الجهد في كل فرع مع حلول مسائل نموذجية.',
      category: 'lecture_notes' as const,
      fileUrl: '/materials/kirchhoff-full.pdf',
      googleDriveFileId: '1gDrive_Kirchhoff_Indexed_001',
      googleDriveWebViewLink: 'https://drive.google.com/file/d/1gDrive_Kirchhoff_Indexed_001/view',
      googleDriveWebContentLink: 'https://drive.google.com/uc?export=download&id=1gDrive_Kirchhoff_Indexed_001',
      googleDriveThumbnailLink: 'https://drive.google.com/thumbnail?id=1gDrive_Kirchhoff_Indexed_001&sz=w600',
      fileSizeBytes: 2450000,
      fileType: 'application/pdf',
      textContentIndexed: `ينص قانون كيرشوف الأول (قانون حفظ الشحنة الكهربية أو قانون نقطة التفرع) على أن المجموع الجبري للتيارات الكهربية الداخلة إلى أي نقطة تفرع في دائرة كهربية مغلقة يساوي المجموع الجبري للتيارات الكهربية الخارجة من نفس النقطة. ويمكن التعبير رياضياً عن هذا القانون بالصيغة: مجموع التيارات الداخلة يساوي مجموع التيارات الخارجة. يعتبر هذا القانون تطبيقاً مباشراً لمبدأ بقاء الشحنة الكهربية، حيث لا تتراكم الشحنات عند أي نقطة تفرع في السلك. أما قانون كيرشوف الثاني (قانون حفظ الطاقة أو قانون المسار المغلق) فينص على أن المجموع الجبري للقوى الدافعة الكهربية في أي مسار مغلق يساوي المجموع الجبري لفروق الجهد عبر المقاومات في ذلك المسار، وصيغته الرياضية هي: مجموع القوى الدافعة الكهربية يساوي مجموع حاصل ضرب شدة التيار في المقاومة. لحل مسائل كيرشوف نتبع الخطوات التالية: أولاً تحديد اتجاهات التيارات في فروع الدائرة، ثانياً تطبيق القانون الأول عند العقد، ثالثاً اختيار مسارات مغلقة وتطبيق القانون الثاني عليها مع مراعاة الإشارات، وأخيراً حل المعادلات الخطية الناتجة جبرياً باستخدام طريقة الحذف أو المحددات لحساب المجاهيل.`,
      wordCount: 215,
      indexStatus: 'indexed' as const,
      lastIndexedAt: '2026-10-01T10:00:00Z',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'mat-magnetic-field',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الثانية: التأثير المغناطيسي للتيار الكهربي',
      lessonName: 'المجال المغناطيسي لسلك مستقيم وملف دائري',
      title: 'ملخص التأثير المغناطيسي للتيار الكهربي وأجهزة القياس',
      description: 'ملخص مكثف لقوانين كثافة الفيض المغناطيسي الناشئ عن مرور تيار كهربي في سلك مستقيم وملف دائري وملف لولبي مع تطبيقات الجلفانومتر والأميتر والفولتميتر.',
      category: 'summary' as const,
      fileUrl: '/materials/magnetic-field-summary.pdf',
      googleDriveFileId: '1gDrive_Magnetic_Field_002',
      googleDriveWebViewLink: 'https://drive.google.com/file/d/1gDrive_Magnetic_Field_002/view',
      googleDriveWebContentLink: 'https://drive.google.com/uc?export=download&id=1gDrive_Magnetic_Field_002',
      googleDriveThumbnailLink: 'https://drive.google.com/thumbnail?id=1gDrive_Magnetic_Field_002&sz=w600',
      fileSizeBytes: 3120000,
      fileType: 'application/pdf',
      textContentIndexed: `في هذا الفصل ندرس التأثير المغناطيسي للتيار الكهربي وكيفية نشأة المجال المغناطيسي حول الموصلات المختلفة. عندما يمر تيار كهربي شدته I في سلك مستقيم طويل، يتولد حوله مجال مغناطيسي على شكل دوائر متحدة المركز مركزها السلك، وتتعين كثافة الفيض المغناطيسي B عند نقطة تبعد مسافة عمودية d عن محور السلك من قانون أمبير الدائري: B = (mu * I) / (2 * pi * d) حيث mu هي النفاذية المغناطيسية للوسط. وتحدد قاعدة اليد اليمنى لأمبير اتجاه خطوط الفيض المغناطيسي. أما في حالة الملف الدائري الذي نصف قطره r وعدد لفاته N، فإن كثافة الفيض عند مركزه تعطى بالعلاقة: B = (mu * N * I) / (2 * r). وتزداد كثافة الفيض كلما زادت شدة التيار أو عدد اللفات، وتقل بزيادة نصف القطر. وعند سحب لفات الملف بانتظام ليتحول إلى ملف لولبي طوله L، تصبح كثافة الفيض عند نقطة على محوره: B = (mu * N * I) / L. تؤدي هذه المجالات إلى نشأة عزم ازدواج مغناطيسي يؤثر على ملف مستطيل قابل للدوران موضوع في مجال مغناطيسي منتظم، وقيمته العظمى tau = B * I * A * N. ويعتمد على هذا المبدأ جهاز الجلفانومتر ذو الملف المتحرك الذي يقيس التيارات المستمرة الضعيفة جداً، ويمكن تحويله إلى أميتر بتوصيل مقاومة صغيرة على التوازي تسمى مجزئ التيار Rs، أو تحويله إلى فولتميتر بتوصيل مقاومة كبيرة على التوالي تسمى مضاعف الجهد Rm.`,
      wordCount: 420,
      indexStatus: 'indexed' as const,
      lastIndexedAt: '2026-10-05T12:00:00Z',
      createdAt: '2026-10-05T00:00:00Z',
    },
    {
      id: 'mat-chem-transition',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-chem-3sec',
      unitName: 'الباب الأول: العناصر الانتقالية',
      lessonName: 'السلسلة الانتقالية الأولى وخامات الحديد',
      title: 'مذكرة كيمياء العناصر الانتقالية وتعدين الحديد',
      description: 'شرح شامل للخواص العامة لعناصر السلسلة الانتقالية الأولى (الكتلة الذرية، نصف القطر، الخواص المغناطيسية، والنشاط الحفزي) مع معادلات اختزال خام الحديد في الفرن العالي وفرن مدركس.',
      category: 'lecture_notes' as const,
      fileUrl: '/materials/transition-elements.pdf',
      googleDriveFileId: '1gDrive_Chemistry_Transition_003',
      googleDriveWebViewLink: 'https://drive.google.com/file/d/1gDrive_Chemistry_Transition_003/view',
      googleDriveWebContentLink: 'https://drive.google.com/uc?export=download&id=1gDrive_Chemistry_Transition_003',
      googleDriveThumbnailLink: 'https://drive.google.com/thumbnail?id=1gDrive_Chemistry_Transition_003&sz=w600',
      fileSizeBytes: 2890000,
      fileType: 'application/pdf',
      textContentIndexed: `تقع عناصر السلسلة الانتقالية الأولى في الدورة الرابعة من الجدول الدوري بعد عنصر الكالسيوم، ويتتابع فيها امتلاء المستوى الفرعي 3d بالإلكترونات ابتداءً من عنصر السكانديوم Sc حتى عنصر الخارصين Zn. تتميز هذه العناصر بالعديد من الخصائص المشتركة أهمها تعدد حالات التأكسد نتيجة لتقارب طاقتي المستويين الفرعيين 4s و 3d وخروج الإلكترونات منهما بالتتابع. وتظهر معظم مركبات العناصر الانتقالية خواص بارامغناطيسية وتكون ملونة نظراً لوجود إلكترونات مفردة في أوربيتالات المستوى الفرعي d. كما تعتبر هذه العناصر وفلزاتها عوامل حفز مثالية بفضل استخدام إلكترونات 4s و 3d في تكوين روابط بين الجزيئات المتفاعلة وذرات سطح الحافز، مما يقلل طاقة التنشيط ويزيد سرعة التفاعل مثل استخدام الحديد المجزأ في تحضير غاز النشادر بطريقة هابر-بوش، واستخدام خامس أكسيد الفاناديوم في تحضير حمض الكبريتيك بطريقة التلامس. ويحتل الحديد Fe الترتيب الرابع من حيث الانتشار في القشرة الأرضية، ويستخلص من أهم خاماته كالهيماتيت Fe2O3 والليمونيت والماجنتيت والسيدريت. وتمر عملية استخلاص الحديد بثلاث مراحل رئيسية: تجهيز الخام بالتحميص والتكسير والتلبيد، ثم اختزاله إما بغاز أول أكسيد الكربون في الفرن العالي أو بالغاز المائي في فرن مدركس، وأخيراً إنتاج الحديد الصلب والزهر في المحولات الأكسجينية والفرن الكهربائي.`,
      wordCount: 380,
      indexStatus: 'indexed' as const,
      lastIndexedAt: '2026-10-08T09:30:00Z',
      createdAt: '2026-10-08T00:00:00Z',
    },
    {
      id: 'mat-math-calculus',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-math',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-math-3sec',
      unitName: 'الوحدة الأولى: التفاضل والتكامل',
      lessonName: 'اشتقاق الدوال المثلثية والمعدلات الزمنية المرتبطة',
      title: 'ورقة قوانين التفاضل والتكامل والمعدلات الزمنية',
      description: 'ورقة قوانين ومفاهيم مركزة تتضمن قواعد اشتقاق الدوال المثلثية والدوال الأسية واللوغاريتمية ونظرية رول والقيمة المتوسطة وخطوات حل مسائل المعدلات الزمنية المرتبطة.',
      category: 'formula_sheet' as const,
      fileUrl: '/materials/calculus-formulas.pdf',
      googleDriveFileId: '1gDrive_Calculus_Formulas_004',
      googleDriveWebViewLink: 'https://drive.google.com/file/d/1gDrive_Calculus_Formulas_004/view',
      googleDriveWebContentLink: 'https://drive.google.com/uc?export=download&id=1gDrive_Calculus_Formulas_004',
      googleDriveThumbnailLink: 'https://drive.google.com/thumbnail?id=1gDrive_Calculus_Formulas_004&sz=w600',
      fileSizeBytes: 1450000,
      fileType: 'application/pdf',
      textContentIndexed: `في هذا الملخص نراجع أهم قواعد التفاضل المقررة في منهج الرياضيات البحتة للصف الثالث الثانوي. مشتقة جيب الزاوية sin(x) هي cos(x)، ومشتقة جيب التمام cos(x) هي -sin(x)، ومشتقة الظل tan(x) هي sec^2(x)، ومشتقة ظتا cot(x) هي -csc^2(x)، ومشتقة قا sec(x) هي sec(x)*tan(x)، ومشتقة قتا csc(x) هي -csc(x)*cot(x). وعند اشتقاق دالة مركبة y = f(g(x)) نطبق قاعدة السلسلة: dy/dx = (dy/du) * (du/dx). أما بالنسبة للدوال الأسية واللوغاريتمية، فإن مشتقة e^x هي e^x نفسها، بينما مشتقة a^x هي a^x * ln(a). ومشتقة اللوغاريتم الطبيعي ln(x) هي 1/x عند x > 0. وفي مسائل المعدلات الزمنية المرتبطة، تكون جميع المتغيرات دوالاً في الزمن t، ونتبع الخطوات التالية لحل المسألة: أولاً نرسم شكلاً توضيحياً للمسألة ونحدد الثوابت والمتغيرات بدقة، ثانياً نجد علاقة رياضية تربط بين المتغيرات بالاستعانة بنظرية فيثاغورس أو تشابه المثلثات أو قوانين حساب المثلثات، ثالثاً نشتق طرفي العلاقة بالنسبة للزمن t مع مراعاة الإشارات، حيث تكون الإشارة موجبة عند التزايد والتمدد وسالبة عند التناقص والانكماش، وأخيراً نعوض بالقيم اللحظية المعطاة عند اللحظة المطلوبة لحساب المعدل الزمني المجهول.`,
      wordCount: 290,
      indexStatus: 'indexed' as const,
      lastIndexedAt: '2026-10-12T14:15:00Z',
      createdAt: '2026-10-12T00:00:00Z',
    },
    {
      id: 'mat-ac-unindexed',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الرابعة: دوائر التيار المتردد',
      lessonName: 'المعاوقة والرنين',
      title: 'ملخص دوائر التيار المتردد والرنين',
      description: 'مسودة ملخص قيد الإعداد لدوائر التيار المتردد التي تحتوي على ملف حث ومكثف ومقاومة أومية ولم يتم استخراج وفهرسة النص المكتوب بها حتى الآن.',
      category: 'summary' as const,
      fileUrl: '/materials/ac-circuits.pdf',
      fileSizeBytes: 1800000,
      fileType: 'application/pdf',
      textContentIndexed: undefined,
      wordCount: 0,
      indexStatus: 'pending' as const,
      createdAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'mat-ohm-insufficient',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      stage: 'secondary',
      grade: '3_sec',
      subjectId: 'sub-phys-3sec',
      unitName: 'الوحدة الأولى: التيار الكهربي وقانون أوم',
      lessonName: 'قانون أوم البسيط',
      title: 'ورقة قوانين سريعة (غير كافية للتوليد)',
      description: 'ملاحظة موجزة جداً تحتوي على صيغة مبسطة لا تكفي للحد الأدنى المطلوب لتوليد امتحان تربوي مؤصل.',
      category: 'formula_sheet' as const,
      fileUrl: '/materials/ohm-short.pdf',
      fileSizeBytes: 45000,
      fileType: 'application/pdf',
      textContentIndexed: 'قانون أوم: فرق الجهد يساوي شدة التيار مضروبة في المقاومة V = I * R.',
      wordCount: 14,
      indexStatus: 'indexed' as const,
      lastIndexedAt: '2026-10-10T08:00:00Z',
      createdAt: '2026-10-10T00:00:00Z',
    },
  ],

  exams: [
    {
      id: 'exam-kirchhoff-draft',
      tenantId: 'tenant-maher-001',
      sessionId: 'sess-live-today',
      groupId: 'grp-phys-sun',
      teacherId: 'user-teacher-phys',
      title: 'اختبار دوري (1) - قوانين كيرشوف والدوائر الكهربية',
      durationMinutes: 30,
      totalMarks: 15.0,
      passMarks: 8.0,
      isAiGenerated: true,
      groundedMaterialIds: ['mat-kirchhoff-complete'],
      status: 'draft' as const,
      instructions: 'أجب عن جميع الأسئلة التالية مستعيناً بالقوانين الفيزيائية الموضحة.',
      createdAt: '2026-10-18T10:00:00Z',
    },
  ],

  examQuestions: [
    {
      id: 'q-1',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 1,
      questionText: 'في الدائرة الكهربية الموضحة، إذا كانت التيارات الداخلة لنقطة تفرع هي $I_1 = 3\\text{ A}$ و $I_2 = 4\\text{ A}$، وكان التيار الخارج هو $I_3$، احسب قيمة $I_3$ مستخدماً قانون حفظ الشحنة:',
      katexFormula: '\\sum I_{in} = \\sum I_{out}',
      questionType: 'mcq' as const,
      options: ['1 A', '7 A', '12 A', '0.75 A'],
      correctAnswer: '7 A',
      explanation: 'وفقاً لقانون كيرشوف الأول، مجموع التيارات الداخلة يساوي مجموع التيارات الخارجة: 3 + 4 = 7 أمبير.',
      marks: 5.0,
      orderIndex: 1,
    },
    {
      id: 'q-2',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 2,
      questionText: 'ينص قانون كيرشوف الثاني على أن المجموع الجبري لفروق الجهد عبر مسار مغلق يساوي صفراً، وهو يمثل تطبيقاً لمبدأ بقاء:',
      katexFormula: '\\sum V = 0',
      questionType: 'mcq' as const,
      options: ['الشحنة الكهربية', 'الطاقة', 'كمية الحركة', 'القدرة الكهربية'],
      correctAnswer: 'الطاقة',
      explanation: 'قانون كيرشوف الثاني هو صياغة فيزيائية لمبدأ حفظ وبقاء الطاقة في المسارات المغلقة.',
      marks: 5.0,
      orderIndex: 2,
    },
    {
      id: 'q-3',
      examId: 'exam-kirchhoff-draft',
      questionNumber: 3,
      questionText: 'هل تتغير المقاومة النوعية لموصل معدني بتغير طوله أو مساحة مقطعه عند ثبوت درجة الحرارة؟',
      questionType: 'true_false' as const,
      options: ['صواب', 'خطأ'],
      correctAnswer: 'خطأ',
      explanation: 'المقاومة النوعية خاصية فيزيائية مميزة لمادة الموصل تتوقف على نوع المادة ودرجة الحرارة فقط.',
      marks: 5.0,
      orderIndex: 3,
    },
  ],

  invoices: [
    {
      id: 'inv-1001',
      tenantId: 'tenant-maher-001',
      studentId: 'user-student-1001',
      groupId: 'grp-math-sat',
      invoiceNumber: 'INV-2026-1001',
      billingMonth: 10,
      billingYear: 2026,
      totalAmount: 300.0,
      discountAmount: 0.0,
      netAmount: 300.0,
      paidAmount: 300.0,
      status: 'paid' as const,
      dueDate: '2026-10-10',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'inv-1002',
      tenantId: 'tenant-maher-001',
      studentId: 'user-student-1002',
      groupId: 'grp-math-sat',
      invoiceNumber: 'INV-2026-1002',
      billingMonth: 10,
      billingYear: 2026,
      totalAmount: 300.0,
      discountAmount: 0.0,
      netAmount: 300.0,
      paidAmount: 150.0,
      status: 'partially_paid' as const,
      dueDate: '2026-10-10',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ],

  cashierShifts: [
    {
      id: 'shift-today-001',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      cashierUserId: 'user-recep-001',
      openedAt: '2026-10-18T08:00:00Z',
      openingCash: 500.0,
      cashCollected: 300.0,
      digitalCollected: 150.0,
      expectedCash: 800.0,
      status: 'open' as const,
      notes: 'وردية الصباح - الخزينة الرئيسية',
    },
  ],

  notifications: [
    {
      id: 'notif-seed-001',
      tenantId: 'tenant-rowad-002',
      recipientPhone: '+201001234567',
      channel: 'whatsapp',
      templateName: 'student_attendance_ar',
      payload: {
        studentName: 'أحمد محمود علي',
        subject: 'فيزياء',
        time: '04:30 م',
        centerName: 'سنتر الرواد التعليمي',
        balanceDue: 0,
      },
      status: 'delivered',
      retryCount: 0,
      scheduledAt: '2026-10-18T08:30:00Z',
      sentAt: '2026-10-18T08:30:01Z',
    },
    {
      id: 'notif-seed-002',
      tenantId: 'tenant-rowad-002',
      recipientPhone: '+201009876543',
      channel: 'whatsapp',
      templateName: 'student_attendance_ar',
      payload: {
        studentName: 'مريم خالد حسن',
        subject: 'رياضيات 3 ثانوي',
        time: '05:00 م',
        centerName: 'سنتر الرواد التعليمي',
        balanceDue: 150,
      },
      status: 'delivered',
      retryCount: 0,
      scheduledAt: '2026-10-18T09:00:00Z',
      sentAt: '2026-10-18T09:00:01Z',
    },
    {
      id: 'notif-seed-003',
      tenantId: 'tenant-rowad-002',
      recipientPhone: 'fcm-token-guardian-003',
      channel: 'fcm',
      templateName: 'exam_published_alert',
      payload: {
        examTitle: 'امتحان الفيزياء الشهري الشامل',
        link: '/center/al-rowad/exams/runner/exam-phys-101',
        centerName: 'سنتر الرواد التعليمي',
      },
      status: 'delivered',
      retryCount: 0,
      scheduledAt: '2026-10-18T09:15:00Z',
      sentAt: '2026-10-18T09:15:02Z',
    },
    {
      id: 'notif-seed-004',
      tenantId: 'tenant-rowad-002',
      recipientPhone: '+201011223344',
      channel: 'whatsapp',
      templateName: 'student_attendance_ar',
      payload: {
        studentName: 'كريم عادل إبراهيم',
        subject: 'كيمياء',
        time: '06:00 م',
        centerName: 'سنتر الرواد التعليمي',
      },
      status: 'queued',
      retryCount: 0,
      scheduledAt: '2026-10-18T10:00:00Z',
    },
    {
      id: 'notif-seed-005',
      tenantId: 'tenant-rowad-002',
      recipientPhone: '+201055667788',
      channel: 'whatsapp',
      templateName: 'payment_receipt_ar',
      payload: {
        studentName: 'زياد طارق ممدوح',
        amount: 300,
        receiptNumber: 'REC-2026-0042',
        description: 'رسوم شهر أكتوبر - كيمياء',
        centerName: 'سنتر الرواد التعليمي',
      },
      status: 'failed',
      retryCount: 2,
      errorMessage: 'Meta WhatsApp Cloud API error: Recipient phone number unreachable or rate-limited (429)',
      scheduledAt: '2026-10-18T07:45:00Z',
    },
    {
      id: 'notif-seed-006',
      tenantId: 'tenant-rowad-002',
      recipientPhone: '+201099881122',
      channel: 'sms',
      templateName: 'student_absence_ar',
      payload: {
        studentName: 'يوسف عمر كمال',
        subject: 'لغة إنجليزية',
        time: '02:00 م',
        centerName: 'سنتر الرواد التعليمي',
      },
      status: 'delivered',
      retryCount: 0,
      scheduledAt: '2026-10-18T06:30:00Z',
      sentAt: '2026-10-18T06:30:05Z',
    },
  ] as NotificationRecord[],
  payments: [
    {
      id: 'pay-seed-001',
      tenantId: 'tenant-maher-001',
      invoiceId: 'inv-1001',
      studentId: 'user-student-1001',
      cashierShiftId: 'shift-today-001',
      receiptNumber: 'REC-2026-0001',
      amountPaid: 300.0,
      paymentMethod: 'cash' as const,
      receivedByUserId: 'user-recep-001',
      paidAt: '2026-10-18T08:30:00Z',
    },
    {
      id: 'pay-seed-002',
      tenantId: 'tenant-maher-001',
      invoiceId: 'inv-1002',
      studentId: 'user-student-1002',
      cashierShiftId: 'shift-today-001',
      receiptNumber: 'REC-2026-0002',
      amountPaid: 150.0,
      paymentMethod: 'vodafone_cash' as const,
      receivedByUserId: 'user-recep-001',
      paidAt: '2026-10-18T09:15:00Z',
    },
  ] as Payment[],
  teacherPayroll: [
    {
      id: 'payr-math-2026-10',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-math',
      payrollMonth: 10,
      payrollYear: 2026,
      conductedSessions: 4,
      totalAttendance: 52,
      averageAttendance: 13.0,
      calculatedCompensation: 260.0,
      bonuses: 0.0,
      deductions: 50.0,
      netPayroll: 210.0,
      status: 'reviewed' as const,
      createdAt: '2026-10-18T00:00:00Z',
    },
    {
      id: 'payr-phys-2026-10',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-phys',
      payrollMonth: 10,
      payrollYear: 2026,
      conductedSessions: 3,
      totalAttendance: 36,
      averageAttendance: 12.0,
      calculatedCompensation: 126.0,
      bonuses: 0.0,
      deductions: 0.0,
      netPayroll: 126.0,
      status: 'approved' as const,
      approvedByUserId: 'user-admin-001',
      approvedAt: '2026-10-18T09:00:00Z',
      createdAt: '2026-10-18T00:00:00Z',
    },
  ] as TeacherPayroll[],
  teacherAdvances: [
    {
      id: 'adv-math-01',
      tenantId: 'tenant-maher-001',
      teacherId: 'user-teacher-math',
      amount: 50.0,
      reason: 'سلفة نقدية طارئة - مواصلات',
      disbursedByUserId: 'user-admin-001',
      paidAt: '2026-10-10T12:00:00Z',
      status: 'pending' as const,
      createdAt: '2026-10-10T12:00:00Z',
    },
  ] as TeacherAdvance[],
  examSubmissions: [] as ExamSubmission[],
  expenses: [
    {
      id: 'exp-seed-01',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      category: 'أدوات ومستلزمات مكتبية',
      description: 'شراء أقلام سبورة وأوراق طباعة A4',
      amount: 150.0,
      createdByUserId: 'user-admin-001',
      createdAt: '2026-10-15T10:00:00Z',
    },
    {
      id: 'exp-seed-02',
      tenantId: 'tenant-maher-001',
      branchId: 'branch-nasr-city',
      category: 'ضيافة واستقبال',
      description: 'مستلزمات شاي وضيافة أولياء الأمور',
      amount: 80.0,
      createdByUserId: 'user-recep-001',
      createdAt: '2026-10-17T11:00:00Z',
    },
  ] as Expense[],
  booksInventory: [
    {
      id: 'book-math-3sec',
      tenantId: 'tenant-maher-001',
      subjectId: 'sub-math-3sec',
      grade: '3_sec',
      title: 'مذكرة الوافي في التفاضل والتكامل (الجزء الأول)',
      unitCost: 35.0,
      sellingPrice: 50.0,
      quantityInStock: 85,
      createdAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'book-phys-3sec',
      tenantId: 'tenant-maher-001',
      subjectId: 'sub-phys-3sec',
      grade: '3_sec',
      title: 'بنك أسئلة الفيزياء الحديثة وكيرشوف',
      unitCost: 40.0,
      sellingPrice: 60.0,
      quantityInStock: 42,
      createdAt: '2026-09-01T00:00:00Z',
    },
  ] as BookInventoryItem[],
};

export class MockDataProvider implements IDataProvider {
  private initializedStageTenants: Set<string>;
  private readonly baseGroups: Group[];
  private managedGroupIds = new Map<string, Set<string>>();
  private managedClassroomIds = new Map<string, Set<string>>();
  private saveDemoOperations?: () => void;
  public tenants: Tenant[];
  public stages: EducationalStage[];
  public branches: Branch[];
  public classrooms: Classroom[];
  public users: User[];
  public subjects: Subject[];
  public groups: Group[];
  public sessions: Session[];
  public enrollments: Enrollment[];
  public attendance: Attendance[];
  public teacherRates: TeacherRate[];
  public teacherPayroll: TeacherPayroll[];
  public teacherAdvances: TeacherAdvance[];
  public materials: Material[];
  public exams: Exam[];
  public examQuestions: ExamQuestion[];
  public examSubmissions: ExamSubmission[];
  public invoices: Invoice[];
  public payments: Payment[];
  public cashierShifts: CashierShift[];
  public expenses: Expense[];
  public booksInventory: BookInventoryItem[];
  public notifications: NotificationRecord[];

  constructor({ archiveMaherGroups = false } = {}) {
    this.tenants = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.tenants));
    this.stages = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.stages));
    this.initializedStageTenants = new Set(this.stages.map(stage => stage.tenantId));
    this.branches = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.branches));
    this.classrooms = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.classrooms));
    this.users = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.users));
    this.subjects = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.subjects));
    this.baseGroups = INITIAL_SEEDED_DATA.groups.map(group =>
      archiveMaherGroups && group.tenantId === 'tenant-maher-001' ? archiveGroup(group) : { ...group });
    this.groups = structuredClone(this.baseGroups);
    this.sessions = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.sessions));
    this.enrollments = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.enrollments));
    this.attendance = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.attendance));
    this.teacherRates = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.teacherRates));
    this.teacherPayroll = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.teacherPayroll));
    this.teacherAdvances = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.teacherAdvances));
    this.materials = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.materials));
    this.exams = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.exams));
    this.examQuestions = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.examQuestions));
    this.examSubmissions = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.examSubmissions));
    this.invoices = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.invoices));
    this.payments = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.payments));
    this.cashierShifts = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.cashierShifts));
    this.expenses = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.expenses));
    this.booksInventory = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.booksInventory));
    this.notifications = JSON.parse(JSON.stringify(INITIAL_SEEDED_DATA.notifications));
  }

  setMasterData(tenantId: string, data: MasterData) {
    const { stages, subjects, branches } = structuredClone(data);
    this.stages = [...this.stages.filter(stage => stage.tenantId !== tenantId), ...stages];
    this.subjects = [...this.subjects.filter(subject => subject.tenantId !== tenantId), ...subjects];
    this.branches = [...this.branches.filter(branch => branch.tenantId !== tenantId), ...branches];
    this.initializedStageTenants.add(tenantId);
  }

  setManagedGroups(tenantId: string, records: Group[]) {
    const managedIds = this.managedGroupIds.get(tenantId);
    const seeds = this.baseGroups.filter(group => group.tenantId === tenantId && managedIds?.has(group.id));
    const base = this.groups.filter(group => group.tenantId !== tenantId || !managedIds?.has(group.id));
    this.groups = mergeManagedRecords([...base, ...structuredClone(seeds)], records);
    this.managedGroupIds.set(tenantId, new Set(records.map(group => group.id)));
  }

  setManagedClassrooms(tenantId: string, rooms: Classroom[]) {
    const managedIds = this.managedClassroomIds.get(tenantId);
    const seeds = INITIAL_SEEDED_DATA.classrooms.filter(room => room.tenantId === tenantId && managedIds?.has(room.id));
    const base = this.classrooms.filter(room => room.tenantId !== tenantId || !managedIds?.has(room.id));
    this.classrooms = mergeManagedRecords([...base, ...structuredClone(seeds)], rooms);
    this.managedClassroomIds.set(tenantId, new Set(rooms.map(room => room.id)));
  }

  attachDemoOperations(save: () => void) {
    this.saveDemoOperations = save;
  }

  private commitDemoOperations() {
    this.saveDemoOperations?.();
  }

  private sessionsInRange(tenantId: string, from: string, through: string) {
    const saved = this.sessions.filter(session => session.tenantId === tenantId &&
      session.sessionDate >= from && session.sessionDate <= through);
    const ids = new Set(saved.map(session => session.id));
    const today = cairoClock();
    const generated = recurringSessions(this.groups.filter(group => group.tenantId === tenantId), from, through)
      .filter(session => !ids.has(session.id));
    const conducted = new Set(this.attendance.filter(record => record.tenantId === tenantId).map(record => record.sessionId));
    const archives = new Map(this.groups.filter(group => group.tenantId === tenantId && group.archivedAt)
      .map(group => [group.id, group.archivedAt!]));
    return [...saved, ...generated].flatMap(session => {
      const archivedAt = archives.get(session.groupId);
      if (session.status !== 'scheduled' && session.status !== 'in_progress') return [session];
      if (conducted.has(session.id) && (archivedAt || (session.pricing && `${session.sessionDate}T${session.endTime}` <= today))) {
        return [{ ...session, status: 'completed' as const }];
      }
      return archivedAt && `${session.sessionDate}T${session.startTime}` >= archivedAt ? [] : [session];
    });
  }

  // 1. Tenants & Branches
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.tenants.find((t) => t.slug === slug) || null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.find((t) => t.id === id) || null;
  }

  async getTenants(): Promise<Tenant[]> {
    return [...this.tenants];
  }

  async getBranches(tenantId: string): Promise<Branch[]> {
    return this.branches.filter((b) => b.tenantId === tenantId);
  }

  async saveBranch(tenantId: string, input: BranchInput): Promise<Branch> {
    const trimmedName = input.nameAr.trim();
    if (!trimmedName) {
      throw new Error('اسم الفرع مطلوب');
    }

    if (input.id) {
      const existingIndex = this.branches.findIndex(
        (b) => b.tenantId === tenantId && b.id === input.id
      );
      if (existingIndex >= 0) {
        const existing = this.branches[existingIndex];
        const updated: Branch = {
          ...existing,
          nameAr: trimmedName,
          address: input.address !== undefined ? input.address.trim() : (existing.address || ''),
          phone: input.phone !== undefined ? input.phone.trim() : (existing.phone || ''),
          isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
        };
        this.branches[existingIndex] = updated;
        return JSON.parse(JSON.stringify(updated));
      }
    }

    const newBranch: Branch = {
      id: input.id?.trim() || `branch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      nameAr: trimmedName,
      address: input.address?.trim() || '',
      phone: input.phone?.trim() || '',
      isActive: input.isActive !== undefined ? input.isActive : true,
      createdAt: new Date().toISOString(),
    };
    this.branches.push(newBranch);
    return JSON.parse(JSON.stringify(newBranch));
  }

  async deleteBranch(tenantId: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    const branch = this.branches.find((b) => b.tenantId === tenantId && b.id === branchId);
    if (!branch) {
      return { success: false, error: 'الفرع غير موجود' };
    }

    const hasClassrooms = this.classrooms.some(
      (c) => c.tenantId === tenantId && c.branchId === branchId && !c.archivedAt
    );
    if (hasClassrooms) {
      return { success: false, error: 'لا يمكن حذف الفرع لوجود قاعات مرتبطة به. احذف القاعات من بطاقة الفرع أولًا.' };
    }

    const hasGroups = this.groups.some(
      (g) => g.tenantId === tenantId && g.branchId === branchId && g.isActive
    );
    if (hasGroups) {
      return { success: false, error: 'لا يمكن حذف الفرع لوجود مجموعات مرتبطة به' };
    }

    this.branches = this.branches.filter((b) => !(b.tenantId === tenantId && b.id === branchId));
    return { success: true };
  }

  async getClassrooms(tenantId: string, branchId?: string): Promise<Classroom[]> {
    return this.classrooms.filter(
      (c) => c.tenantId === tenantId && !c.archivedAt && (!branchId || c.branchId === branchId)
    );
  }

  // Stages & Grades (Master Data)
  async getStages(tenantId: string): Promise<EducationalStage[]> {
    if (!this.initializedStageTenants.has(tenantId)) {
      if (!this.stages.some(stage => stage.tenantId === tenantId)) {
        this.stages.push(...buildDefaultStages(tenantId));
      }
      this.initializedStageTenants.add(tenantId);
    }
    const tenantStages = this.stages.filter((s) => s.tenantId === tenantId);
    return JSON.parse(JSON.stringify(tenantStages.sort((a, b) => (a.order || 0) - (b.order || 0))));
  }

  async saveStage(tenantId: string, input: EducationalStageInput): Promise<EducationalStage> {
    const trimmedName = input.nameAr.trim();
    if (!trimmedName) {
      throw new Error('اسم المرحلة التعليمية مطلوب');
    }

    const duplicate = this.stages.find(
      (s) =>
        s.tenantId === tenantId &&
        s.nameAr.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.id !== input.id
    );
    if (duplicate) {
      throw new Error('توجد مرحلة تعليمية بنفس الاسم بالفعل');
    }

    if (input.id) {
      const existing = this.stages.find((s) => s.tenantId === tenantId && s.id === input.id);
      if (existing) {
        existing.nameAr = trimmedName;
        if (input.order !== undefined) existing.order = input.order;
        return JSON.parse(JSON.stringify(existing));
      }
    }

    const maxOrder = this.stages
      .filter((s) => s.tenantId === tenantId)
      .reduce((max, s) => Math.max(max, s.order || 0), 0);

    const newStage: EducationalStage = {
      id: input.id?.trim() || `stage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      nameAr: trimmedName,
      order: input.order !== undefined ? input.order : maxOrder + 1,
      grades: [],
      createdAt: new Date().toISOString(),
    };
    this.stages.push(newStage);
    return JSON.parse(JSON.stringify(newStage));
  }

  async deleteStage(tenantId: string, stageId: string): Promise<{ success: boolean; error?: string }> {
    const stage = this.stages.find((s) => s.tenantId === tenantId && s.id === stageId);
    if (!stage) {
      return { success: false, error: 'المرحلة التعليمية غير موجودة' };
    }

    const hasSubjects = this.subjects.some((s) => s.tenantId === tenantId && s.stage === stageId);
    if (hasSubjects) {
      return { success: false, error: 'لا يمكن حذف المرحلة لوجود مواد دراسية مرتبطة بها' };
    }

    const hasStudents = this.users.some(
      (u) => u.tenantId === tenantId && u.role === 'STUDENT' && u.stage === stageId
    );
    if (hasStudents) {
      return { success: false, error: 'لا يمكن حذف المرحلة لوجود طلاب مسجلين بها' };
    }

    const gradeIds = (stage.grades || []).map((g) => g.id);
    const hasGradeSubjects = this.subjects.some(
      (s) => s.tenantId === tenantId && gradeIds.includes(s.grade)
    );
    if (hasGradeSubjects) {
      return { success: false, error: 'لا يمكن حذف المرحلة لوجود مواد دراسية مرتبطة بصفوفها' };
    }

    this.stages = this.stages.filter((s) => !(s.tenantId === tenantId && s.id === stageId));
    return { success: true };
  }

  async saveGrade(tenantId: string, input: EducationalGradeInput): Promise<EducationalGrade> {
    const trimmedName = input.nameAr.trim();
    if (!trimmedName) {
      throw new Error('اسم الصف الدراسي مطلوب');
    }
    if (!input.stageId) {
      throw new Error('المرحلة التابعة للصف مطلوبة');
    }

    // Ensure stages are populated
    await this.getStages(tenantId);

    const stage = this.stages.find((s) => s.tenantId === tenantId && s.id === input.stageId);
    if (!stage) {
      throw new Error('المرحلة التعليمية التابع لها الصف غير موجودة');
    }

    const duplicate = stage.grades.find(
      (g) =>
        g.nameAr.trim().toLowerCase() === trimmedName.toLowerCase() &&
        g.id !== input.id
    );
    if (duplicate) {
      throw new Error('يوجد صف بنفس الاسم في هذه المرحلة بالفعل');
    }

    if (input.id) {
      const existingGrade = stage.grades.find((g) => g.id === input.id);
      if (existingGrade) {
        existingGrade.nameAr = trimmedName;
        if (input.order !== undefined) existingGrade.order = input.order;
        if (input.hasDivisions !== undefined) existingGrade.hasDivisions = input.hasDivisions;
        if (input.divisions !== undefined) existingGrade.divisions = input.divisions;
        return JSON.parse(JSON.stringify(existingGrade));
      }
    }

    const maxOrder = stage.grades.reduce((max, g) => Math.max(max, g.order || 0), 0);
    const newGrade: EducationalGrade = {
      id: input.id?.trim() || `grade-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      stageId: input.stageId,
      nameAr: trimmedName,
      order: input.order !== undefined ? input.order : maxOrder + 1,
      hasDivisions: input.hasDivisions || false,
      divisions: input.divisions || [],
      createdAt: new Date().toISOString(),
    };
    stage.grades.push(newGrade);
    return JSON.parse(JSON.stringify(newGrade));
  }

  async deleteGrade(tenantId: string, gradeId: string): Promise<{ success: boolean; error?: string }> {
    let targetStage: EducationalStage | undefined;
    let targetGrade: EducationalGrade | undefined;

    for (const stage of this.stages) {
      if (stage.tenantId === tenantId) {
        const found = stage.grades.find((g) => g.id === gradeId);
        if (found) {
          targetStage = stage;
          targetGrade = found;
          break;
        }
      }
    }

    if (!targetStage || !targetGrade) {
      return { success: false, error: 'الصف الدراسي غير موجود' };
    }

    const hasSubjects = this.subjects.some((s) => s.tenantId === tenantId && s.grade === gradeId);
    if (hasSubjects) {
      return { success: false, error: 'لا يمكن حذف الصف لوجود مواد دراسية مرتبطة به' };
    }

    const hasStudents = this.users.some(
      (u) => u.tenantId === tenantId && u.role === 'STUDENT' && u.grade === gradeId
    );
    if (hasStudents) {
      return { success: false, error: 'لا يمكن حذف الصف لوجود طلاب مسجلين به' };
    }

    targetStage.grades = targetStage.grades.filter((g) => g.id !== gradeId);
    return { success: true };
  }

  // 2. Users & RBAC
  async getUserById(userId: string): Promise<User | null> {
    return this.users.find((u) => u.id === userId) || null;
  }

  async getUserByStudentCode(tenantId: string, code: string): Promise<User | null> {
    return (
      this.users.find(
        (u) => u.tenantId === tenantId && (u.studentCode === code || u.id === code)
      ) || null
    );
  }

  async getUsers(
    tenantId: string,
    filter?: { role?: UserRole; search?: string }
  ): Promise<User[]> {
    return this.users.filter((u) => {
      if (u.tenantId && u.tenantId !== tenantId) return false;
      if (filter?.role && u.role !== filter.role) return false;
      if (filter?.search) {
        const query = filter.search.toLowerCase();
        const matchesName = u.fullName.toLowerCase().includes(query);
        const matchesCode = u.studentCode?.toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }

  async updateUser(
    userId: string,
    updates: Partial<User>,
    actorId?: string,
    actorRole?: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string; status: number }> {
    const targetUser = this.users.find((u) => u.id === userId);
    if (!targetUser) {
      return { success: false, error: 'المستخدم غير موجود', status: 404 };
    }

    // Guardrail: Student and Teacher role restrictions (AC-4, AC-5, AC-6)
    if (actorRole === 'STUDENT' || actorRole === 'TEACHER') {
      if (actorId && actorId !== userId) {
        return {
          success: false,
          error: 'Forbidden (HTTP 403): غير مصرح لك بتعديل بيانات مستخدم آخر',
          status: 403,
        };
      }

      const allowedKeys = new Set(['avatarUrl', 'avatar_url']);
      const updateKeys = Object.keys(updates);
      const forbidden = updateKeys.filter((k) => !allowedKeys.has(k));

      if (forbidden.length > 0) {
        return {
          success: false,
          error:
            'Forbidden (HTTP 403): الطلاب والمعلمون مصرح لهم بتعديل الصورة الشخصية فقط، والبيانات الإدارية والمالية للقراءة فقط',
          status: 403,
        };
      }
    }

    Object.assign(targetUser, updates, { updatedAt: new Date().toISOString() });
    return { success: true, data: targetUser, status: 200 };
  }

  async updateUserProfilePhoto(
    userId: string,
    avatarUrl: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: User; error?: string }> {
    if ((actorRole === 'STUDENT' || actorRole === 'TEACHER') && actorId !== userId) {
      return { success: false, error: 'Forbidden: لا يمكنك تغيير صورة مستخدم آخر' };
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'المستخدم غير موجود' };

    user.avatarUrl = avatarUrl;
    user.updatedAt = new Date().toISOString();
    return { success: true, data: user };
  }

  // 3. Courses, Groups & Timetable
  async getSubjects(
    tenantId: string,
    filter?: { stage?: string; grade?: string }
  ): Promise<Subject[]> {
    return this.subjects.filter((s) => {
      if (s.tenantId !== tenantId) return false;
      if (filter?.stage && s.stage !== filter.stage) return false;
      if (filter?.grade && s.grade !== filter.grade) return false;
      return true;
    });
  }

  async saveSubject(tenantId: string, input: SubjectInput): Promise<Subject> {
    const trimmedName = input.nameAr.trim();
    if (!trimmedName) {
      throw new Error('اسم المادة مطلوب');
    }
    if (!input.stage) {
      throw new Error('المرحلة التعليمية مطلوبة');
    }
    if (!input.grade) {
      throw new Error('الصف الدراسي مطلوب');
    }

    const duplicate = this.subjects.find(
      (s) =>
        s.tenantId === tenantId &&
        s.grade === input.grade &&
        s.nameAr.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.id !== input.id
    );
    if (duplicate) {
      throw new Error('يوجد مادة بنفس الاسم في هذا الصف بالفعل');
    }

    if (input.id) {
      const existingIndex = this.subjects.findIndex(
        (s) => s.tenantId === tenantId && s.id === input.id
      );
      if (existingIndex >= 0) {
        const existing = this.subjects[existingIndex];
        const updated: Subject = {
          ...existing,
          nameAr: trimmedName,
          code: input.code !== undefined ? input.code.trim() : (existing.code || ''),
          stage: input.stage,
          grade: input.grade,
        };
        this.subjects[existingIndex] = updated;
        return JSON.parse(JSON.stringify(updated));
      }
    }

    const newSubject: Subject = {
      id: input.id?.trim() || `subj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      nameAr: trimmedName,
      code: input.code?.trim() || '',
      stage: input.stage,
      grade: input.grade,
      createdAt: new Date().toISOString(),
    };
    this.subjects.push(newSubject);
    return JSON.parse(JSON.stringify(newSubject));
  }

  async deleteSubject(tenantId: string, subjectId: string): Promise<{ success: boolean; error?: string }> {
    const subject = this.subjects.find((s) => s.tenantId === tenantId && s.id === subjectId);
    if (!subject) {
      return { success: false, error: 'المادة الدراسية غير موجودة' };
    }

    const hasGroups = this.groups.some((g) => g.tenantId === tenantId && g.subjectId === subjectId);
    if (hasGroups) {
      return { success: false, error: 'لا يمكن حذف المادة لوجود مجموعات مرتبطة بها' };
    }

    const hasMaterials = this.materials.some(
      (m) => m.tenantId === tenantId && m.subjectId === subjectId
    );
    if (hasMaterials) {
      return { success: false, error: 'لا يمكن حذف المادة لوجود مذكرات ومواد تعليمية مرتبطة بها' };
    }

    const hasExams = this.exams.some((e) => e.tenantId === tenantId && e.subjectId === subjectId);
    if (hasExams) {
      return { success: false, error: 'لا يمكن حذف المادة لوجود امتحانات مرتبطة بها' };
    }

    this.subjects = this.subjects.filter((s) => !(s.tenantId === tenantId && s.id === subjectId));
    return { success: true };
  }

  async getGroups(
    tenantId: string,
    filter?: { branchId?: string; teacherId?: string }
  ): Promise<Group[]> {
    return this.groups.filter((g) => {
      if (g.tenantId !== tenantId) return false;
      if (filter?.branchId && g.branchId !== filter.branchId) return false;
      if (filter?.teacherId && g.teacherId !== filter.teacherId) return false;
      return true;
    });
  }

  async getGroupById(tenantId: string, groupId: string): Promise<Group | null> {
    return this.groups.find((g) => g.tenantId === tenantId && g.id === groupId) || null;
  }

  // 4. Sessions
  async getSessions(
    tenantId: string,
    filter?: { groupId?: string; date?: string; teacherId?: string }
  ): Promise<Session[]> {
    const today = cairoClock().slice(0, 10);
    const from = shiftDate(today, -31);
    const through = shiftDate(today, 7);
    const saved = filter?.date ? [] : this.sessions.filter(session => session.tenantId === tenantId &&
      (session.sessionDate < from || session.sessionDate > through));
    const sessions = [...saved, ...this.sessionsInRange(tenantId, filter?.date ?? from, filter?.date ?? through)];
    const archives = new Map(this.groups.filter(group => group.tenantId === tenantId && group.archivedAt)
      .map(group => [group.id, group.archivedAt!]));
    return sessions.filter((s) => {
      if (s.tenantId !== tenantId) return false;
      if (filter?.groupId && s.groupId !== filter.groupId) return false;
      if (filter?.date && s.sessionDate !== filter.date) return false;
      if (filter?.teacherId && s.teacherId !== filter.teacherId) return false;
      const archivedAt = archives.get(s.groupId);
      if (archivedAt && (s.status === 'scheduled' || s.status === 'in_progress') &&
        `${s.sessionDate}T${s.startTime}` >= archivedAt) return false;
      return true;
    });
  }

  async getSessionById(tenantId: string, sessionId: string): Promise<Session | null> {
    const date = sessionDateFromId(sessionId);
    return (date ? this.sessionsInRange(tenantId, date, date) : this.sessions)
      .find(session => session.tenantId === tenantId && session.id === sessionId) ?? null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    cancellationReason?: string
  ): Promise<Session> {
    const generatedDate = sessionDateFromId(sessionId);
    const group = generatedDate && this.groups.find(group => group.id === sessionId.split(':')[1]);
    const existing = this.sessions.find(s => s.id === sessionId);
    const session = existing ?? (group && this.sessionsInRange(group.tenantId, generatedDate, generatedDate)
      .find(item => item.id === sessionId));
    if (!session) throw new Error('الحصة غير موجودة');
    if (!existing) this.sessions.push(session);
    session.status = status;
    if (cancellationReason) session.cancellationReason = cancellationReason;
    this.commitDemoOperations();
    return session;
  }

  // 5. Enrollments & Students
  async getEnrollments(
    tenantId: string,
    filter?: { groupId?: string; studentId?: string }
  ): Promise<Enrollment[]> {
    return this.enrollments.filter((e) => {
      if (e.tenantId !== tenantId) return false;
      if (filter?.groupId && e.groupId !== filter.groupId) return false;
      if (filter?.studentId && e.studentId !== filter.studentId) return false;
      return true;
    });
  }

  async createStudent(tenantId: string, input: CreateStudentInput): Promise<User> {
    const existingStudents = this.users.filter((u) => u.tenantId === tenantId && u.role === 'STUDENT');
    const nextNum = 1000 + existingStudents.length + 1;
    const studentCode = input.studentCode?.trim() || `STD-${nextNum}`;

    const isDuplicate = existingStudents.some((u) => u.studentCode === studentCode);
    if (isDuplicate) {
      throw new Error(`كود الطالب (${studentCode}) مستخدم بالفعل في هذا السنتر`);
    }

    const newStudent: User = {
      id: `user-student-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId,
      role: 'STUDENT',
      fullName: input.fullName.trim(),
      studentCode,
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      nationalId: input.nationalId?.trim(),
      stage: input.stage,
      grade: input.grade,
      division: input.division,
      seatNumber: input.seatNumber,
      guardianName: input.guardianName?.trim(),
      guardianPhone: input.guardianPhone?.trim(),
      avatarUrl: input.avatarUrl || '/brand/yalla-center-icon.png',
      balanceDue: 0.0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.push(newStudent);
    this.commitDemoOperations();
    return newStudent;
  }

  async enrollStudent(input: EnrollStudentInput): Promise<{ success: boolean; enrollment?: Enrollment; invoice?: Invoice; error?: string }> {
    const student = this.users.find((u) => u.id === input.studentId && u.tenantId === input.tenantId);
    if (!student) return { success: false, error: 'الطالب غير موجود' };

    const group = this.groups.find((g) => g.id === input.groupId && g.tenantId === input.tenantId);
    if (!group?.isActive) return { success: false, error: 'المجموعة الدراسية غير موجودة' };
    if (group.gradeId && ((student.grade && student.grade !== group.gradeId) ||
      (student.stage && student.stage !== group.stageId))) {
      return { success: false, error: 'المجموعة تابعة لمرحلة أو صف مختلف' };
    }

    const existing = this.enrollments.find(
      (e) => e.tenantId === input.tenantId && e.studentId === input.studentId && e.groupId === input.groupId && e.isActive
    );
    if (existing) {
      return { success: false, error: 'الطالب مقيد بالفعل في هذه المجموعة' };
    }

    const activeStudentEnrollments = this.enrollments.filter(
      (e) => e.tenantId === input.tenantId && e.studentId === input.studentId && e.isActive
    );
    const activeGroups = activeStudentEnrollments
      .map((e) => this.groups.find((g) => g.id === e.groupId))
      .filter((g): g is Group => Boolean(g));

    const currentEnrolledCount = this.enrollments.filter(
      (e) => e.groupId === input.groupId && e.isActive
    ).length;

    const preflight = checkStudentEnrollmentConflict(
      group,
      activeGroups,
      currentEnrolledCount
    );

    if (!preflight.canEnroll) {
      return { success: false, error: preflight.errors[0]?.messageAr || 'تعارض في موعد الحصة' };
    }

    const enrollment: Enrollment = {
      id: `enr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: input.tenantId,
      studentId: input.studentId,
      groupId: input.groupId,
      pricingModel: group.pricing?.model ?? input.pricingModel,
      discountType: input.discountType,
      discountValue: input.discountValue,
      isActive: true,
      enrolledAt: new Date().toISOString(),
    };

    this.enrollments.push(enrollment);

    let invoice: Invoice | undefined;
    const baseFee = studentGroupFee(group);
    if ((baseFee > 0 || group.pricing?.model === 'private') && group.pricing?.model !== 'per_session') {
      const date = cairoClock().slice(0, 10);
      const billingMonth = Number(date.slice(5, 7));
      const billingYear = Number(date.slice(0, 4));
      invoice = (group.pricing && this.invoices.find(item => item.tenantId === input.tenantId &&
        item.studentId === student.id && item.groupId === group.id && !item.sessionId &&
        item.billingMonth === billingMonth && item.billingYear === billingYear && item.status !== 'void')) ?? this.addInvoice({
        tenantId: input.tenantId, studentId: student.id, groupId: group.id,
        totalAmount: baseFee, discountType: input.discountType, discountValue: input.discountValue,
        billingMonth, billingYear,
        dueDate: shiftDate(date, 10), pricing: group.pricing, teacherId: group.teacherId,
      });
    }

    this.commitDemoOperations();
    return { success: true, enrollment, invoice };
  }

  async unenrollStudent(tenantId: string, enrollmentId: string): Promise<{ success: boolean; error?: string }> {
    const enrollment = this.enrollments.find((e) => e.id === enrollmentId && e.tenantId === tenantId);
    if (!enrollment) return { success: false, error: 'الاشتراك غير موجود' };
    enrollment.isActive = false;
    this.commitDemoOperations();
    return { success: true };
  }

  async getStudentEnrollmentDetails(tenantId: string, studentId: string): Promise<StudentEnrollmentDetail[]> {
    const userEnrollments = this.enrollments.filter(
      (e) => e.tenantId === tenantId && e.studentId === studentId && e.isActive
    );
    return userEnrollments.flatMap((e) => {
      const group = this.groups.find((g) => g.tenantId === tenantId && g.id === e.groupId);
      if (!group?.isActive) return [];
      const subject = this.subjects.find((s) => s.id === group.subjectId);
      const teacher = this.users.find((u) => u.id === group.teacherId);
      const classroom = this.classrooms.find((c) => c.id === group.classroomId);
      const branch = this.branches.find((b) => b.id === group.branchId);
      return [{
        ...e,
        group,
        subject,
        teacher,
        classroom,
        branch,
      }];
    });
  }

  async getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceDetail[]> {
    const records = this.attendance
      .filter((a) => a.tenantId === tenantId && a.studentId === studentId)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

    const sessions = new Map((await Promise.all(records.map(record => this.getSessionById(tenantId, record.sessionId))))
      .flatMap(session => session ? [[session.id, session] as const] : []));
    return records.flatMap((a) => {
      const session = sessions.get(a.sessionId);
      if (!session) return [];
      const group = session ? this.groups.find((g) => g.id === session.groupId) : undefined;
      const subject = group ? this.subjects.find((s) => s.id === group.subjectId) : undefined;
      const teacher = group ? this.users.find((u) => u.id === group.teacherId) : undefined;
      return [{
        ...a,
        session,
        group,
        subject,
        teacher,
      }];
    });
  }

  // 6. Fast Reception Attendance (AC-7: Idempotent Scan)
  async recordAttendanceScan(
    tenantId: string,
    sessionId: string,
    studentCodeOrId: string,
    recordedByUserId?: string,
    verificationMethod: VerificationMethod = 'barcode'
  ): Promise<AttendanceScanResponse> {
    const session = await this.getSessionById(tenantId, sessionId);
    if (!session) {
      throw new Error('الحصة غير موجودة في هذا السنتر');
    }
    if (this.groups.some(group => group.tenantId === tenantId && group.id === session.groupId && group.archivedAt)) {
      throw new Error('تم حذف المجموعة، والحصة مغلقة لتسجيل الحضور');
    }

    const student = this.users.find(
      (u) =>
        u.tenantId === tenantId &&
        (u.id === studentCodeOrId || u.studentCode === studentCodeOrId)
    );

    if (!student) {
      throw new Error('لم يتم العثور على طالب مطابق لكود المسح المحدد');
    }

    const enrollment = this.enrollments.find(row => row.tenantId === tenantId && row.isActive &&
      row.groupId === session.groupId && row.studentId === student.id);
    if (session.pricing && (!enrollment || !['scheduled', 'in_progress'].includes(session.status))) {
      throw new Error(enrollment ? 'الحصة مغلقة لتسجيل الحضور' : 'الطالب غير مقيد في هذه المجموعة');
    }

    // Invariant: Compound Unique (session_id, student_id)
    const existing = this.attendance.find(
      (a) => a.tenantId === tenantId && a.sessionId === sessionId && a.studentId === student.id
    );

    if (!existing && session.pricing?.model === 'per_session' &&
      !this.invoices.some(invoice => invoice.tenantId === tenantId && invoice.sessionId === sessionId && invoice.studentId === student.id && invoice.status !== 'void')) {
      const pricing = session.pricing;
      this.addInvoice({
        tenantId, studentId: student.id, groupId: session.groupId, sessionId,
        teacherId: session.teacherId, pricing,
        totalAmount: moneyAmount(pricing.teacherFee + pricing.centerFee),
        discountType: enrollment?.discountType, discountValue: enrollment?.discountValue,
        billingMonth: Number(session.sessionDate.slice(5, 7)), billingYear: Number(session.sessionDate.slice(0, 4)),
        dueDate: session.sessionDate,
      });
    }

    const balanceAlert: BalanceAlert = {
      hasBalance: student.balanceDue > 0,
      balanceDue: student.balanceDue,
      messageAr:
        student.balanceDue > 0
          ? `تنبيه: متبقي على الطالب مبلغ ${student.balanceDue} ج.م`
          : 'جميع الرسوم مسددة بالكامل',
    };

    if (existing) {
      return {
        success: true,
        isDuplicate: true,
        duplicate: true,
        isNewRecord: false,
        status: existing.status,
        scannedAt: existing.scannedAt,
        recordedAt: existing.scannedAt,
        sessionId,
        studentId: student.id,
        studentCode: student.studentCode || '',
        studentName: student.fullName,
        message: 'تم تسجيل الحضور مسبقاً لهذه الحصة',
        messageAr: 'تم تسجيل الحضور مسبقاً لهذه الحصة',
        attendance: existing,
        student,
        session,
        balanceAlert,
      };
    }

    const scannedAt = new Date().toISOString();
    const newAttendance: Attendance = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      sessionId,
      studentId: student.id,
      status: 'present',
      scannedAt,
      verificationMethod,
      cashierUserId: recordedByUserId,
    };

    // Synchronous insertion before any async operations to eliminate event-loop race conditions
    this.attendance.push(newAttendance);
    this.commitDemoOperations();

    if (student.guardianPhone) {
      await this.enqueueNotification({
        tenantId,
        recipientPhone: student.guardianPhone,
        recipientUserId: student.id,
        channel: 'whatsapp',
        templateName: 'student_attendance_ar',
        payload: {
          studentName: student.fullName,
          sessionDate: session.sessionDate,
          scannedAt,
          balanceDue: student.balanceDue,
        },
      });
    }

    return {
      success: true,
      isDuplicate: false,
      duplicate: false,
      isNewRecord: true,
      status: 'present',
      scannedAt,
      recordedAt: scannedAt,
      sessionId,
      studentId: student.id,
      studentCode: student.studentCode || '',
      studentName: student.fullName,
      message: 'تم تسجيل الحضور بنجاح',
      messageAr: 'تم تسجيل الحضور بنجاح',
      attendance: newAttendance,
      student,
      session,
      balanceAlert,
    };
  }

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
      duplicate: res.duplicate,
      attendance: res.attendance,
      student: res.student,
      session: res.session,
      balanceAlert: res.balanceAlert,
      messageAr: res.messageAr,
    };
  }

  async getSessionAttendance(sessionId: string): Promise<Attendance[]> {
    return this.attendance.filter((a) => a.sessionId === sessionId);
  }

  async getSessionAttendanceStats(
    tenantId: string,
    sessionId: string
  ): Promise<SessionAttendanceStats> {
    const session = await this.getSessionById(tenantId, sessionId);
    if (!session) {
      throw new Error('الحصة غير موجودة');
    }

    const group = this.groups.find((g) => g.id === session.groupId);
    const groupName = group ? group.nameAr : 'مجموعة غير محددة';
    const pricing = session.pricing;
    const sessionFee = group?.sessionFee || group?.monthlyFee || 0;
    const fixedSessionSplit = pricing?.model === 'per_session' ? calculateFixedSessionSplit(pricing,
      this.invoices.filter(invoice => invoice.tenantId === tenantId && invoice.sessionId === sessionId && invoice.status !== 'void'))
      : undefined;

    const enrollments = this.enrollments.filter(
      (e) => e.groupId === session.groupId && e.isActive
    );
    const totalEnrolled = enrollments.length;

    const records = this.attendance.filter((a) => a.sessionId === sessionId);

    const presentCount = records.filter((r) => r.status === 'present').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const excusedCount = records.filter((r) => r.status === 'excused').length;
    const absentCount = Math.max(0, totalEnrolled - (presentCount + lateCount + excusedCount));

    const attendedTotal = presentCount + lateCount;
    const attendanceRatePercentage =
      totalEnrolled > 0 ? Math.round((attendedTotal / totalEnrolled) * 10000) / 100 : 0;

    let lastScannedAt: string | undefined;
    let studentsWithBalanceDueCount = 0;

    const enrichedRecords = records.map((r) => {
      const student = this.users.find((u) => u.id === r.studentId);
      if (!lastScannedAt || new Date(r.scannedAt) > new Date(lastScannedAt)) {
        lastScannedAt = r.scannedAt;
      }
      const balanceDue = student?.balanceDue ?? 0;
      if (balanceDue > 0) {
        studentsWithBalanceDueCount++;
      }

      return {
        attendanceId: r.id,
        studentId: r.studentId,
        studentName: student?.fullName ?? 'طالب غير مسجل',
        studentCode: student?.studentCode ?? '',
        status: r.status,
        scannedAt: r.scannedAt,
        verificationMethod: r.verificationMethod,
        balanceDue,
        avatarUrl: student?.avatarUrl,
      };
    });

    return {
      sessionId,
      tenantId,
      groupId: session.groupId,
      groupName,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      totalEnrolled,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendanceRatePercentage,
      totalSessionFeeCollected: fixedSessionSplit?.collected ?? (pricing ? 0 : attendedTotal * sessionFee),
      ...(fixedSessionSplit ? { fixedSessionSplit } : {}),
      studentsWithBalanceDueCount,
      lastScannedAt,
      records: enrichedRecords,
    };
  }

  // 7. Teacher Rates & Compensation
  async getTeacherRates(tenantId: string, teacherId?: string): Promise<TeacherRate[]> {
    return this.teacherRates.filter(
      (r) => r.tenantId === tenantId && (!teacherId || r.teacherId === teacherId)
    );
  }

  async updateTeacherRate(
    rateId: string,
    updates: Partial<TeacherRate>,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherRate; error?: string; status: number }> {
    const adminRoles: UserRole[] = [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
    ];
    if (!adminRoles.includes(actorRole)) {
      return {
        success: false,
        error:
          'Forbidden (HTTP 403): غير مصرح لك بتعديل نسب أو أسعار التعاقد، مقتصر على الأدوار الإدارية والمالية',
        status: 403,
      };
    }

    const rate = this.teacherRates.find((r) => r.id === rateId);
    if (!rate) return { success: false, error: 'سعر المعلم غير موجود', status: 404 };

    Object.assign(rate, updates);
    if (updates.splitPercentage !== undefined && updates.teacherPercentage === undefined) {
      rate.teacherPercentage = updates.splitPercentage;
      if (updates.centerPercentage === undefined) {
        rate.centerPercentage = 100 - updates.splitPercentage;
      }
    }
    if (rate.teacherPercentage !== undefined) {
      rate.splitPercentage = rate.teacherPercentage;
    }
    return { success: true, data: rate, status: 200 };
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

  calculatePrivateLessonsSplit(
    items: PrivateLessonItemInput[],
    teacherPercentage: number
  ): PrivateLessonBatchResult {
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
    return this.teacherPayroll.filter((p) => {
      if (p.tenantId !== tenantId) return false;
      if (filter?.teacherId && p.teacherId !== filter.teacherId) return false;
      if (filter?.year && p.payrollYear !== filter.year) return false;
      if (filter?.month && p.payrollMonth !== filter.month) return false;
      return true;
    });
  }

  async calculateMonthlyTeacherPayroll(params: {
    tenantId: string;
    teacherId: string;
    year: number;
    month: number;
    teacherProfile?: Pick<TeacherProfile, 'id' | 'tenantId' | 'fullName' | 'phone' | 'contracts'>;
    persistDraft?: boolean;
  }): Promise<TeacherMonthlyStatement> {
    const teacher = this.users.find((u) => u.id === params.teacherId && (!u.tenantId || u.tenantId === params.tenantId));
    const profile = params.teacherProfile?.id === params.teacherId && params.teacherProfile.tenantId === params.tenantId
      ? params.teacherProfile : undefined;
    const teacherName = profile?.fullName ?? teacher?.fullName ?? 'معلم';
    const teacherPhone = profile?.phone ?? teacher?.phone;

    const monthKey = `${params.year}-${String(params.month).padStart(2, '0')}`;
    const monthStart = monthKey + '-01';
    const monthEnd = new Date(Date.UTC(params.year, params.month, 0)).toISOString().slice(0, 10);
    const monthSessions = this.sessionsInRange(params.tenantId, monthStart, monthEnd)
      .filter(session => session.teacherId === params.teacherId);
    const monthlyInvoices = this.invoices.filter(invoice => invoice.tenantId === params.tenantId &&
      invoice.billingMonth === params.month && invoice.billingYear === params.year && invoice.status !== 'void');
    const historicalGroups = new Set([
      ...monthSessions.map(session => session.groupId),
      ...monthlyInvoices.filter(invoice => invoice.teacherId === params.teacherId).map(invoice => invoice.groupId),
      ...this.groups.filter(group => group.tenantId === params.tenantId &&
        group.legacyBilling?.teacherId === params.teacherId && monthlyInvoices.some(invoice => invoice.groupId === group.id))
        .map(group => group.id),
    ]);
    const teacherGroups = this.groups.filter(group => group.tenantId === params.tenantId &&
      (group.teacherId === params.teacherId || historicalGroups.has(group.id)));
    const subjectNames = [...new Set(teacherGroups.map(group => this.subjects.find(subject =>
      subject.id === group.subjectId && subject.tenantId === params.tenantId)?.nameAr)
      .filter((name): name is string => Boolean(name)))];
    const contractsByGroup = new Map(teacherGroups.map(group => [
      group.id, group.pricing && !group.legacyBilling ? undefined : matchTeacherContract(profile?.contracts ?? [],
        this.subjects.find(subject => subject.id === (group.legacyBilling?.subjectId ?? group.subjectId) && subject.tenantId === params.tenantId)),
    ]));

    const lessonRows: NonNullable<TeacherMonthlyStatement['lessonCompensation']>['sessions'] = [];
    const centerGroupStatements: TeacherMonthlyStatement['centerSubscription']['groups'] = [];
    for (const group of teacherGroups) {
      const contract = contractsByGroup.get(group.id);
      const sessions = monthSessions.filter(session => session.groupId === group.id);
      const legacyModel = group.legacyBilling?.model ?? (!group.pricing ? group.pricingModel : undefined);
      const averageSessions = new Map<number, typeof sessions>();
      for (const session of sessions) {
        const pricing = session.pricing;
        const attendanceCount = countTeacherSessionAttendance(this.attendance, session);
        if (pricing?.model === 'center') {
          const entries = averageSessions.get(pricing.teacherRate) ?? [];
          entries.push(session);
          averageSessions.set(pricing.teacherRate, entries);
        } else if (pricing?.model === 'per_session' && session.status === 'completed') {
          const tickets = monthlyInvoices.filter(invoice => invoice.sessionId === session.id);
          lessonRows.push({
            sessionId: session.id, sessionDate: session.sessionDate, groupName: group.nameAr,
            attendanceCount, model: 'per_session', rate: pricing.teacherFee,
            ...calculateFixedSessionSplit(pricing, tickets),
          });
        } else if (!pricing && legacyModel && contract && contract.model !== 'private' && session.status === 'completed') {
          const revenue = moneyAmount(attendanceCount * (group.legacyBilling?.sessionFee ?? group.sessionFee));
          lessonRows.push({
            sessionId: session.id, sessionDate: session.sessionDate, groupName: group.nameAr,
            attendanceCount, revenue, model: contract.model, rate: contract.value,
            ...calculateTeacherSessionPay(contract, session, attendanceCount, revenue),
          });
        }
      }
      if (!contract && legacyModel === 'center') {
        const rate = this.teacherRates.find(item => item.tenantId === params.tenantId &&
          item.teacherId === params.teacherId && item.model === 'center' && item.isActive);
        const fixedRate = rate?.fixedRatePerStudent ?? 20;
        const legacySessions = sessions.filter(session => !session.pricing);
        if (legacySessions.length || !group.pricing) averageSessions.set(fixedRate,
          [...(averageSessions.get(fixedRate) ?? []), ...legacySessions]);
      }
      if (group.teacherId === params.teacherId && group.pricing?.model === 'center' && !averageSessions.size) {
        averageSessions.set(group.pricing.teacherRate, []);
      }

      const totalCompleted = [...averageSessions.values()].flat().filter(session => session.status === 'completed').length;
      let rawCompensation = 0;
      let roundedCompensation = 0;
      for (const [ratePerStudent, groupSessions] of averageSessions) {
        const sessionRecords = groupSessions.map(session => ({
          sessionId: session.id, sessionDate: session.sessionDate, status: session.status,
          validAttendanceCount: countTeacherSessionAttendance(this.attendance, session),
        }));
        const comp = calcCenterComp(sessionRecords.filter(session => session.status === 'completed'), ratePerStudent);
        const totalValidAttendance = comp.totalValidAttendance ?? 0;
        rawCompensation += totalCompleted ? totalValidAttendance * ratePerStudent / totalCompleted : 0;
        const compensationAmount = moneyAmount(moneyAmount(rawCompensation) - roundedCompensation);
        roundedCompensation = moneyAmount(rawCompensation);
        centerGroupStatements.push({
          groupId: group.id, groupName: group.nameAr, ratePerStudent,
          conductedSessionsCount: comp.conductedSessions, excludedSessionsCount: sessionRecords.length - comp.conductedSessions,
          totalValidAttendance, averageAttendance: comp.averageAttendance, compensationAmount, sessions: sessionRecords,
        });
      }
    }
    const totalCenterCompensation = centerGroupStatements.reduce((sum, group) => sum + group.compensationAmount, 0);
    const totalLessonCompensation = moneyAmount(lessonRows.reduce((sum, session) => sum + session.teacherDue, 0));
    const totalCollectedLessonCompensation = moneyAmount(lessonRows.reduce((sum, session) =>
      sum + (session.teacherCollected ?? session.teacherDue), 0));
    const lessonCompensation = lessonRows.length ? {
      sessions: lessonRows.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
      totalCompensation: totalLessonCompensation,
    } : undefined;

    // Private Lessons Groups
    const privateGroups = teacherGroups.filter(group => {
      const contract = contractsByGroup.get(group.id);
      if (group.pricing) return group.pricing.model === 'private' || monthlyInvoices.some(invoice =>
        invoice.groupId === group.id && (invoice.teacherId === params.teacherId && invoice.pricing?.model === 'private' ||
          !invoice.pricing && !invoice.sessionId && group.legacyBilling?.teacherId === params.teacherId &&
          (contract ? contract.model === 'private' : group.legacyBilling.model === 'private')));
      return contract ? contract.model === 'private' : group.pricingModel === 'private';
    });
    let totalInvoicedTeacherShare = 0;
    let totalCollectedTeacherShare = 0;
    let totalCenterShare = 0;
    let totalRoundingLeakage = 0;

    const privateGroupStatements = privateGroups.flatMap((group) => {
      const rateObj = this.teacherRates.find(rate => rate.tenantId === params.tenantId &&
        rate.teacherId === params.teacherId && rate.model === 'private' && rate.isActive);
      const configuredContract = contractsByGroup.get(group.id);
      const teacherPct = group.pricing?.model === 'private'
        ? group.pricing.teacherPercentage : configuredContract?.value ?? rateObj?.teacherPercentage ?? 70;
      const invoices = monthlyInvoices.filter(invoice => invoice.groupId === group.id && !invoice.sessionId);
      const enrollments = this.enrollments.filter(row => row.tenantId === params.tenantId && row.groupId === group.id);
      const buildItem = (studentId: string, enrollment?: Enrollment, invoice?: Invoice) => {
        const student = this.users.find(user => user.tenantId === params.tenantId && user.id === studentId);
        const basePrice = invoice?.totalAmount ?? studentGroupFee(group);
        const discountType = enrollment?.discountType ?? 'none';
        const discountValue = enrollment?.discountValue ?? 0;
        const netRevenue = invoice?.netAmount ?? calculateDiscount({ basePrice, discountType, discountValue }).netPrice;
        const percentage = invoice?.pricing?.model === 'private' ? invoice.pricing.teacherPercentage
          : configuredContract?.value ?? rateObj?.teacherPercentage ?? teacherPct;
        const shares = splitPrivateFee(netRevenue, percentage);
        const collectedAmount = Math.min(netRevenue, invoice?.paidAmount ?? 0);
        return {
          enrollmentId: enrollment?.id ?? invoice?.id ?? studentId, studentId, studentName: student?.fullName ?? 'طالب',
          basePrice, discountType, discountValue, netRevenue, teacherShare: shares.teacher, centerShare: shares.center,
          collectedAmount, collectedTeacher: splitPrivateFee(collectedAmount, percentage).teacher, percentage,
        };
      };
      const items = group.pricing
        ? invoices.filter(invoice => invoice.teacherId === params.teacherId && invoice.pricing?.model === 'private' ||
          !invoice.pricing && group.legacyBilling?.teacherId === params.teacherId &&
          (configuredContract ? configuredContract.model === 'private' : group.legacyBilling.model === 'private'))
          .map(invoice => buildItem(invoice.studentId, enrollments.find(row => row.studentId === invoice.studentId), invoice))
        : enrollments.filter(row => row.isActive && row.enrolledAt.slice(0, 10) <= monthEnd)
          .map(row => buildItem(row.studentId, row, invoices.find(invoice => invoice.studentId === row.studentId)));
      const byPercentage = new Map<number, typeof items>();
      if (group.teacherId === params.teacherId && (group.pricing?.model === 'private' || !group.pricing)) {
        byPercentage.set(teacherPct, []);
      }
      for (const item of items) {
        const rows = byPercentage.get(item.percentage) ?? [];
        rows.push(item);
        byPercentage.set(item.percentage, rows);
      }
      return [...byPercentage.entries()].map(([teacherPct, items]) => {
        const centerPct = moneyAmount(100 - teacherPct);
        const totalGrossInvoiced = items.reduce((acc, it) => acc + it.basePrice, 0);
        const totalDiscountAmount = items.reduce((acc, it) => acc + (it.basePrice - it.netRevenue), 0);
        const totalNetRevenue = items.reduce((acc, it) => acc + it.netRevenue, 0);
        const groupTeacherShare = items.reduce((acc, it) => acc + it.teacherShare, 0);
        const groupCenterShare = items.reduce((acc, it) => acc + it.centerShare, 0);
        const groupCollected = items.reduce((acc, it) => acc + it.collectedAmount, 0);
        const groupCollectedTeacherShare = moneyAmount(items.reduce((sum, item) => sum + item.collectedTeacher, 0));
        const uncollectedTeacherBalance = Math.max(0, Math.round((groupTeacherShare - groupCollectedTeacherShare) * 100) / 100);
        const leakage = Math.abs(Math.round((totalNetRevenue - (groupTeacherShare + groupCenterShare)) * 100) / 100);

        totalInvoicedTeacherShare += groupTeacherShare;
        totalCollectedTeacherShare += groupCollectedTeacherShare;
        totalCenterShare += groupCenterShare;
        totalRoundingLeakage += leakage;

        return {
          groupId: group.id,
          groupName: group.nameAr,
          teacherPercentage: teacherPct,
          centerPercentage: centerPct,
          enrolledCount: new Set(items.map(item => item.studentId)).size,
          totalGrossInvoiced: Math.round(totalGrossInvoiced * 100) / 100,
          totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
          totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
          totalTeacherShare: Math.round(groupTeacherShare * 100) / 100,
          totalCenterShare: Math.round(groupCenterShare * 100) / 100,
          totalCollected: Math.round(groupCollected * 100) / 100,
          totalCollectedTeacherShare: Math.round(groupCollectedTeacherShare * 100) / 100,
          uncollectedTeacherBalance,
          roundingLeakage: leakage,
          items,
        };
      });
    });

    // Advances & Adjustments
    const advances = this.teacherAdvances.filter(advance => advance.tenantId === params.tenantId &&
      advance.teacherId === params.teacherId && cairoClock(new Date(advance.paidAt)).startsWith(monthKey) &&
      (advance.status === 'pending' || this.teacherPayroll.some(payroll => payroll.id === advance.payrollId &&
        payroll.payrollYear === params.year && payroll.payrollMonth === params.month)));
    const totalAdvances = advances.reduce((acc, a) => acc + a.amount, 0);

    const grossCompensation = Math.round((totalCenterCompensation + totalLessonCompensation + totalInvoicedTeacherShare) * 100) / 100;
    const grossCollectedCompensation = Math.round((totalCenterCompensation + totalCollectedLessonCompensation + totalCollectedTeacherShare) * 100) / 100;
    const netPayrollInvoiced = Math.max(0, Math.round((grossCompensation - totalAdvances) * 100) / 100);
    const netPayrollCollected = Math.max(0, Math.round((grossCollectedCompensation - totalAdvances) * 100) / 100);

    let payrollRecord = this.teacherPayroll.find(
      (p) => p.tenantId === params.tenantId && p.teacherId === params.teacherId && p.payrollYear === params.year && p.payrollMonth === params.month
    );
    const conductedSessions = centerGroupStatements.reduce((acc, g) => acc + g.conductedSessionsCount, 0) + lessonRows.length;
    const totalAttendance = centerGroupStatements.reduce((acc, g) => acc + g.totalValidAttendance, 0) +
      lessonRows.reduce((acc, lesson) => acc + lesson.attendanceCount, 0);
    const averageAttendance = conductedSessions > 0 ? Math.round(totalAttendance * 100 / conductedSessions) / 100 : 0;

    if (!payrollRecord && params.persistDraft !== false) {
      payrollRecord = {
        id: `payr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      this.teacherPayroll.push(payrollRecord);
      this.commitDemoOperations();
    } else if (payrollRecord && (payrollRecord.status === 'draft' || payrollRecord.status === 'reviewed') && params.persistDraft !== false) {
      Object.assign(payrollRecord, {
        conductedSessions, totalAttendance, averageAttendance,
        calculatedCompensation: grossCompensation,
        deductions: totalAdvances,
        netPayroll: Math.round((netPayrollInvoiced + payrollRecord.bonuses) * 100) / 100,
        lessonCompensation,
      });
      this.commitDemoOperations();
    }
    const locked = payrollRecord && (payrollRecord.status === 'approved' || payrollRecord.status === 'paid')
      ? payrollRecord : undefined;

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
    if (actorRole !== 'CENTER_ADMIN' && actorRole !== 'PLATFORM_OWNER') {
      return {
        success: false,
        error: 'Forbidden: اعتماد كشوف المرتبات متاح فقط لمدير السنتر أو مسؤول المنصة',
        status: 403,
      };
    }

    const payroll = this.teacherPayroll.find((p) => p.id === payrollId);
    if (!payroll) {
      return { success: false, error: 'كشف المرتبات غير موجود', status: 404 };
    }

    payroll.status = 'approved';
    payroll.approvedByUserId = actorId;
    payroll.approvedAt = new Date().toISOString();
    this.commitDemoOperations();

    return { success: true, data: payroll, status: 200 };
  }

  async disburseTeacherPayroll(
    payrollId: string,
    paymentMethod: PaymentMethod,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: TeacherPayroll; error?: string; status: number }> {
    if (actorRole !== 'CENTER_ADMIN' && actorRole !== 'ACCOUNTANT' && actorRole !== 'PLATFORM_OWNER') {
      return {
        success: false,
        error: 'Forbidden: صرف المرتبات متاح فقط للمحاسب أو مدير السنتر',
        status: 403,
      };
    }

    const payroll = this.teacherPayroll.find((p) => p.id === payrollId);
    if (!payroll) {
      return { success: false, error: 'كشف المرتبات غير موجود', status: 404 };
    }

    payroll.status = 'paid';

    this.teacherAdvances
      .filter(a => a.teacherId === payroll.teacherId && a.tenantId === payroll.tenantId && a.status === 'pending' &&
        cairoClock(new Date(a.paidAt)).startsWith(`${payroll.payrollYear}-${String(payroll.payrollMonth).padStart(2, '0')}`))
      .forEach((a) => {
        a.status = 'settled';
        a.payrollId = payroll.id;
      });
    this.commitDemoOperations();

    return { success: true, data: payroll, status: 200 };
  }

  async getTeacherAdvances(
    tenantId: string,
    filter?: { teacherId?: string; status?: 'pending' | 'settled' }
  ): Promise<TeacherAdvance[]> {
    return this.teacherAdvances.filter((a) => {
      if (a.tenantId !== tenantId) return false;
      if (filter?.teacherId && a.teacherId !== filter.teacherId) return false;
      if (filter?.status && a.status !== filter.status) return false;
      return true;
    });
  }

  async recordTeacherAdvance(params: {
    tenantId: string;
    teacherId: string;
    amount: number;
    reason?: string;
    disbursedByUserId: string;
  }): Promise<TeacherAdvance> {
    const advance: TeacherAdvance = {
      id: `adv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: params.tenantId,
      teacherId: params.teacherId,
      amount: Math.round(params.amount * 100) / 100,
      reason: params.reason,
      disbursedByUserId: params.disbursedByUserId,
      paidAt: new Date().toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.teacherAdvances.push(advance);

    const shift = this.cashierShifts.find((s) => s.tenantId === params.tenantId && s.status === 'open');
    if (shift) {
      shift.cashDisbursed = Math.round(((shift.cashDisbursed || 0) + advance.amount) * 100) / 100;
      shift.expectedCash = Math.round((shift.openingCash + shift.cashCollected - shift.cashDisbursed) * 100) / 100;
    }

    this.commitDemoOperations();
    return advance;
  }

  // 8. Financial Suite
  async getInvoices(
    tenantId: string,
    filter?: { studentId?: string; status?: InvoiceStatus }
  ): Promise<Invoice[]> {
    return this.invoices.filter((inv) => {
      if (inv.tenantId !== tenantId) return false;
      if (filter?.studentId && inv.studentId !== filter.studentId) return false;
      if (filter?.status && inv.status !== filter.status) return false;
      return true;
    });
  }

  async getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null> {
    return this.invoices.find((inv) => inv.tenantId === tenantId && inv.id === invoiceId) || null;
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
    const group = params.groupId && this.groups.find(item => item.id === params.groupId && item.tenantId === params.tenantId);
    if (group && group.archivedAt) throw new Error('تم حذف المجموعة');
    if (group && group.pricing?.model === 'per_session') {
      throw new Error('فاتورة الدفع بالحصة تُنشأ عند تسجيل حضور الطالب في الحصة');
    }
    if (group && group.pricing && this.invoices.some(invoice => invoice.tenantId === params.tenantId &&
      invoice.studentId === params.studentId && invoice.groupId === group.id && !invoice.sessionId &&
      invoice.billingYear === params.billingYear && invoice.billingMonth === params.billingMonth && invoice.status !== 'void')) {
      throw new Error('تم إصدار فاتورة لهذا الطالب والمجموعة عن الشهر المحدد');
    }
    const invoice = this.addInvoice({
      ...params,
      ...(group && group.pricing ? { totalAmount: studentGroupFee(group), pricing: group.pricing, teacherId: group.teacherId } : {}),
    });
    this.commitDemoOperations();
    return invoice;
  }

  private addInvoice(params: {
    tenantId: string;
    studentId: string;
    groupId?: string;
    sessionId?: string;
    totalAmount: number;
    discountType?: string;
    discountValue?: number;
    billingMonth: number;
    billingYear: number;
    dueDate: string;
    pricing?: Group['pricing'];
    teacherId?: string;
  }): Invoice {
    const discount = calculateDiscount({
      basePrice: params.totalAmount,
      discountType: (params.discountType as any) || 'none',
      discountValue: params.discountValue || 0,
    });

    const invoiceNumber = `INV-${params.billingYear}-${String(this.invoices.length + 1).padStart(4, '0')}`;
    const invoice: Invoice = {
      id: `inv-${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      studentId: params.studentId,
      groupId: params.groupId,
      invoiceNumber,
      billingMonth: params.billingMonth,
      billingYear: params.billingYear,
      totalAmount: discount.basePrice,
      discountAmount: discount.discountAmount,
      netAmount: discount.netPrice,
      paidAmount: 0.0,
      status: discount.netPrice === 0 ? 'paid' : 'pending',
      dueDate: params.dueDate,
      createdAt: new Date().toISOString(),
      ...(params.sessionId ? { sessionId: params.sessionId } : {}),
      ...(params.pricing ? { pricing: params.pricing, teacherId: params.teacherId } : {}),
    };

    this.invoices.push(invoice);

    const student = this.users.find((u) => u.id === params.studentId && u.tenantId === params.tenantId);
    if (student && discount.netPrice > 0) {
      student.balanceDue = Math.round((student.balanceDue + discount.netPrice) * 100) / 100;
    }

    return invoice;
  }

  async getPayments(
    tenantId: string,
    filter?: { studentId?: string; invoiceId?: string; shiftId?: string }
  ): Promise<Payment[]> {
    return this.payments.filter((p) => {
      if (p.tenantId !== tenantId) return false;
      if (filter?.studentId && p.studentId !== filter.studentId) return false;
      if (filter?.invoiceId && p.invoiceId !== filter.invoiceId) return false;
      if (filter?.shiftId && p.cashierShiftId !== filter.shiftId) return false;
      return true;
    });
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
    const result = this.addPayment(params);
    this.commitDemoOperations();
    return result;
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
    const student = this.users.find(user => user.tenantId === params.tenantId && user.id === params.studentId);
    if (!student) throw new Error('الطالب غير موجود');
    const open = this.invoices.filter(invoice => invoice.tenantId === params.tenantId && invoice.studentId === params.studentId &&
      invoice.status !== 'void' && invoice.netAmount > invoice.paidAmount)
      .sort((a, b) => (params.sessionId ? Number(b.sessionId === params.sessionId) - Number(a.sessionId === params.sessionId) : 0) ||
        a.dueDate.localeCompare(b.dueDate));
    const remaining = (invoice: Invoice) => Math.round((invoice.netAmount - invoice.paidAmount) * 100);
    let cents = Math.round(params.amountPaid * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > open.reduce((sum, invoice) => sum + remaining(invoice), 0)) {
      throw new Error('أدخل مبلغًا صحيحًا في حدود الرصيد المتبقي على الفواتير');
    }
    for (const invoice of open) {
      if (!cents) break;
      const collected = Math.min(cents, remaining(invoice));
      this.addPayment({ ...params, invoiceId: invoice.id, amountPaid: collected / 100 });
      cents -= collected;
    }
    this.commitDemoOperations();
    return student;
  }

  private addPayment(params: {
    tenantId: string;
    invoiceId: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    cashierUserId: string;
    shiftId?: string;
    notes?: string;
  }): { payment: Payment; updatedInvoice: Invoice; updatedStudent?: User } {
    const invoice = this.invoices.find(
      (inv) => inv.id === params.invoiceId && inv.tenantId === params.tenantId
    );
    if (!invoice) throw new Error('الفاتورة غير موجودة');

    const remainingBalance = Math.round((invoice.netAmount - invoice.paidAmount) * 100) / 100;
    if (!Number.isFinite(params.amountPaid) || moneyAmount(params.amountPaid) <= 0 || invoice.status === 'void') {
      throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر');
    }
    if (params.amountPaid > remainingBalance) {
      throw new Error(`مبلغ السداد (${params.amountPaid}) أكبر من الرصيد المتبقي على الفاتورة (${remainingBalance})`);
    }

    let shift = this.cashierShifts.find(s => s.id === params.shiftId && s.tenantId === params.tenantId);
    if (!shift) {
      shift = this.cashierShifts.find(
        (s) => s.tenantId === params.tenantId && s.status === 'open' && s.cashierUserId === params.cashierUserId
      ) || this.cashierShifts.find((s) => s.tenantId === params.tenantId && s.status === 'open');
    }

    const receiptNumber = `REC-${new Date().getFullYear()}-${String(this.payments.length + 1).padStart(4, '0')}`;
    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      cashierShiftId: shift?.id,
      receiptNumber,
      amountPaid: Math.round(params.amountPaid * 100) / 100,
      paymentMethod: params.paymentMethod,
      receivedByUserId: params.cashierUserId,
      notes: params.notes,
      paidAt: new Date().toISOString(),
    };

    invoice.paidAmount = Math.round((invoice.paidAmount + params.amountPaid) * 100) / 100;
    if (invoice.paidAmount >= invoice.netAmount) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partially_paid';
    }

    const student = this.users.find((u) => u.id === invoice.studentId && u.tenantId === invoice.tenantId);
    if (student) {
      student.balanceDue = Math.max(0, Math.round((student.balanceDue - params.amountPaid) * 100) / 100);
    }

    if (shift && shift.status === 'open') {
      if (params.paymentMethod === 'cash') {
        shift.cashCollected = Math.round((shift.cashCollected + params.amountPaid) * 100) / 100;
        shift.expectedCash = Math.round((shift.openingCash + shift.cashCollected - (shift.cashDisbursed || 0)) * 100) / 100;
      } else {
        shift.digitalCollected = Math.round((shift.digitalCollected + params.amountPaid) * 100) / 100;
      }
    }

    this.payments.push(payment);
    return { payment, updatedInvoice: invoice, updatedStudent: student };
  }

  async getActiveCashierShift(
    tenantId: string,
    cashierUserId?: string,
    branchId?: string
  ): Promise<CashierShift | null> {
    if (cashierUserId) {
      const shift = this.cashierShifts.find(
        (s) => s.tenantId === tenantId && s.cashierUserId === cashierUserId && s.status === 'open'
      );
      if (shift) return shift;
    }
    if (branchId) {
      const shift = this.cashierShifts.find(
        (s) => s.tenantId === tenantId && s.branchId === branchId && s.status === 'open'
      );
      if (shift) return shift;
    }
    return this.cashierShifts.find((s) => s.tenantId === tenantId && s.status === 'open') || null;
  }

  async openCashierShift(params: {
    tenantId: string;
    branchId: string;
    cashierUserId: string;
    openingCash: number;
    notes?: string;
  }): Promise<CashierShift> {
    const existingOpen = this.cashierShifts.find(
      (s) => s.tenantId === params.tenantId && s.cashierUserId === params.cashierUserId && s.status === 'open'
    );
    if (existingOpen) {
      throw new Error('يوجد وردية كاشير مفتوحة بالفعل لهذا المستخدم، يرجى إغلاقها أولاً');
    }

    const openingCash = Math.max(0, Math.round(params.openingCash * 100) / 100);
    const shift: CashierShift = {
      id: `shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      cashierUserId: params.cashierUserId,
      openedAt: new Date().toISOString(),
      openingCash,
      cashCollected: 0.0,
      digitalCollected: 0.0,
      cashDisbursed: 0.0,
      expectedCash: openingCash,
      status: 'open',
      notes: params.notes,
    };

    this.cashierShifts.push(shift);
    this.commitDemoOperations();
    return shift;
  }

  async closeCashierShift(params: {
    shiftId: string;
    actualCash: number;
    notes?: string;
    denominations?: Record<string, number>;
  }): Promise<CashierShift> {
    const shift = this.cashierShifts.find(s => s.id === params.shiftId);
    if (!shift) throw new Error('الوردية غير موجودة');
    if (shift.status === 'closed') throw new Error('هذه الوردية مغلقة بالفعل');

    const expectedCash = Math.round((shift.openingCash + shift.cashCollected - (shift.cashDisbursed || 0)) * 100) / 100;
    const actualCash = Math.round(params.actualCash * 100) / 100;
    const cashDifference = Math.round((actualCash - expectedCash) * 100) / 100;

    shift.actualCash = actualCash;
    shift.expectedCash = expectedCash;
    shift.cashDifference = cashDifference;
    shift.status = 'closed';
    shift.closedAt = new Date().toISOString();
    if (params.notes) {
      shift.notes = shift.notes ? `${shift.notes} | إغلاق: ${params.notes}` : params.notes;
    }
    if (params.denominations) {
      shift.denominations = params.denominations;
    }

    this.commitDemoOperations();
    return shift;
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
    const expense: Expense = {
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      category: params.category,
      description: params.description,
      amount: Math.round(params.amount * 100) / 100,
      createdByUserId: params.createdByUserId,
      createdAt: new Date().toISOString(),
    };

    this.expenses.push(expense);
    this.commitDemoOperations();

    let shift: CashierShift | undefined;
    if (params.shiftId) {
      shift = this.cashierShifts.find(s => s.id === params.shiftId && s.tenantId === params.tenantId);
    }
    if (!shift) {
      shift = this.cashierShifts.find((s) => s.tenantId === params.tenantId && s.status === 'open');
    }
    if (shift) {
      shift.cashDisbursed = Math.round(((shift.cashDisbursed || 0) + expense.amount) * 100) / 100;
      shift.expectedCash = Math.round((shift.openingCash + shift.cashCollected - shift.cashDisbursed) * 100) / 100;
    }

    return expense;
  }

  async getCashierShifts(
    tenantId: string,
    filter?: { cashierUserId?: string; status?: 'open' | 'closed' }
  ): Promise<CashierShift[]> {
    return this.cashierShifts.filter((s) => {
      if (s.tenantId !== tenantId) return false;
      if (filter?.cashierUserId && s.cashierUserId !== filter.cashierUserId) return false;
      if (filter?.status && s.status !== filter.status) return false;
      return true;
    });
  }

  async getExpenses(tenantId: string): Promise<Expense[]> {
    return this.expenses.filter((e) => e.tenantId === tenantId);
  }

  async getBooksInventory(tenantId: string): Promise<BookInventoryItem[]> {
    return this.booksInventory.filter((b) => b.tenantId === tenantId);
  }

  // 9. Materials & AI Exams (AC-8)
  async getMaterials(
    tenantId: string,
    filter?: { stage?: string; grade?: string; subjectId?: string; indexStatus?: MaterialIndexStatus; search?: string }
  ): Promise<Material[]> {
    return this.materials.filter((m) => {
      if (m.tenantId !== tenantId) return false;
      if (filter?.stage && m.stage !== filter.stage) return false;
      if (filter?.grade && m.grade !== filter.grade) return false;
      if (filter?.subjectId && m.subjectId !== filter.subjectId) return false;
      if (filter?.indexStatus && m.indexStatus !== filter.indexStatus) return false;
      if (filter?.search) {
        const query = filter.search.toLowerCase().trim();
        const matchesTitle = m.title.toLowerCase().includes(query);
        const matchesUnit = m.unitName.toLowerCase().includes(query);
        const matchesLesson = m.lessonName.toLowerCase().includes(query);
        const matchesDesc = m.description?.toLowerCase().includes(query);
        const matchesText = m.textContentIndexed?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesUnit && !matchesLesson && !matchesDesc && !matchesText) return false;
      }
      return true;
    });
  }

  async getMaterialById(tenantId: string, materialId: string): Promise<Material | null> {
    return this.materials.find((m) => m.tenantId === tenantId && m.id === materialId) || null;
  }

  async createMaterial(input: CreateMaterialInput): Promise<Material> {
    const id = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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

    const newMat: Material = {
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
      lastIndexedAt: textContentIndexed ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.materials.unshift(newMat);
    return newMat;
  }

  async updateMaterial(tenantId: string, materialId: string, updates: Partial<Material>): Promise<Material> {
    const mat = this.materials.find((m) => m.tenantId === tenantId && m.id === materialId);
    if (!mat) throw new Error('المذكرة غير موجودة');

    if (updates.textContentIndexed !== undefined) {
      mat.textContentIndexed = updates.textContentIndexed;
      mat.wordCount = countArabicWords(updates.textContentIndexed);
      mat.indexStatus = evaluateIndexingStatus(mat.wordCount);
      mat.lastIndexedAt = new Date().toISOString();
    }

    if (updates.title !== undefined) mat.title = updates.title;
    if (updates.description !== undefined) mat.description = updates.description;
    if (updates.category !== undefined) mat.category = updates.category;
    if (updates.unitName !== undefined) mat.unitName = updates.unitName;
    if (updates.lessonName !== undefined) mat.lessonName = updates.lessonName;
    if (updates.indexStatus !== undefined) mat.indexStatus = updates.indexStatus;

    mat.updatedAt = new Date().toISOString();
    return mat;
  }

  async deleteMaterial(tenantId: string, materialId: string): Promise<{ success: boolean }> {
    const idx = this.materials.findIndex((m) => m.tenantId === tenantId && m.id === materialId);
    if (idx !== -1) {
      this.materials.splice(idx, 1);
      return { success: true };
    }
    return { success: false };
  }

  async indexMaterialContent(
    tenantId: string,
    materialId: string,
    options?: { forceReindex?: boolean; customText?: string }
  ): Promise<Material> {
    const mat = this.materials.find((m) => m.tenantId === tenantId && m.id === materialId);
    if (!mat) throw new Error('المذكرة غير موجودة');

    let text = options?.customText;
    if (!text) {
      const simulated = simulateTextExtraction(mat.title, 'المنهج الدراسي', mat.stage);
      text = simulated.extractedText;
    }

    const words = countArabicWords(text);
    mat.textContentIndexed = text;
    mat.wordCount = words;
    mat.indexStatus = evaluateIndexingStatus(words);
    mat.lastIndexedAt = new Date().toISOString();
    mat.updatedAt = new Date().toISOString();

    return mat;
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
    if (!fileId) {
      throw new Error('رابط Google Drive غير صالح');
    }

    const driveLinks = buildDriveLinks(fileId);
    const title = params.title || `مستند دراسي Google Drive - ${fileId.slice(0, 8)}`;

    return this.createMaterial({
      tenantId,
      teacherId: params.teacherId,
      stage: params.stage,
      grade: params.grade,
      subjectId: params.subjectId,
      unitName: params.unitName,
      lessonName: params.lessonName,
      title,
      category: params.category || 'lecture_notes',
      fileUrl: driveLinks.webViewLink,
      googleDriveFileId: fileId,
      indexImmediately: params.autoIndex !== false,
    });
  }

  async getMaterialsStats(tenantId: string): Promise<MaterialsSummaryStats> {
    const centerMats = this.materials.filter((m) => m.tenantId === tenantId);
    return {
      totalMaterials: centerMats.length,
      indexedMaterials: centerMats.filter((m) => m.indexStatus === 'indexed').length,
      pendingMaterials: centerMats.filter((m) => m.indexStatus === 'pending').length,
      insufficientMaterials: centerMats.filter((m) => m.indexStatus === 'insufficient').length,
      failedMaterials: centerMats.filter((m) => m.indexStatus === 'failed').length,
      totalIndexedWords: centerMats.reduce((acc, m) => acc + (m.wordCount || 0), 0),
      googleDriveLinkedCount: centerMats.filter((m) => !!m.googleDriveFileId).length,
    };
  }

  async validateExamPreflight(sourceDocumentIds: string[]): Promise<ExamPreflightResult> {
    if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
      return {
        allowed: false,
        errorCode: 'EMPTY_SELECTION',
        messageArabic: 'يرجى تحديد مستند مصدر واحد على الأقل لتوليد الامتحان.',
      };
    }

    const selectedDocs = this.materials.filter((m) => sourceDocumentIds.includes(m.id));

    // Gate 1: All documents must be indexed
    const unindexedDocs = selectedDocs.filter((d) => d.indexStatus !== 'indexed');
    if (unindexedDocs.length > 0) {
      return {
        allowed: false,
        errorCode: 'UNINDEXED_SOURCE_DOCUMENTS',
        messageArabic: `المستندات التالية غير مفهرسة: ${unindexedDocs.map((d) => d.title).join('، ')}.`,
        unindexedDocTitles: unindexedDocs.map((d) => d.title),
      };
    }

    // Gate 2: Minimum word count threshold (200 words)
    const totalWordCount = selectedDocs.reduce((sum, d) => sum + (d.wordCount || 0), 0);
    const MIN_WORD_THRESHOLD = 200;

    if (totalWordCount < MIN_WORD_THRESHOLD) {
      return {
        allowed: false,
        errorCode: 'INSUFFICIENT_SOURCE_DOCUMENTS',
        messageArabic: `محتوى المستندات المحددة غير كافٍ لتوليد اختبار تربوي دقيق (أقل من ${MIN_WORD_THRESHOLD} كلمة).`,
        totalWordCount,
      };
    }

    return {
      allowed: true,
      messageArabic: 'المستندات مؤهلة لتوليد الاختبار.',
      totalWordCount,
    };
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
    const preflight = await this.validateExamPreflight(params.sourceDocumentIds);
    if (!preflight.allowed) {
      throw new Error(preflight.messageArabic);
    }

    const examId = `exam-${Date.now()}`;
    const totalMarks = params.questions.reduce((sum, q) => sum + q.marks, 0);

    const exam: Exam = {
      id: examId,
      tenantId: params.tenantId,
      groupId: params.groupId || '',
      subjectId: params.subjectId,
      teacherId: params.teacherId,
      title: params.title,
      durationMinutes: params.durationMinutes,
      totalMarks,
      passMarks: totalMarks / 2,
      isAiGenerated: true,
      groundedMaterialIds: params.sourceDocumentIds,
      status: 'draft', // Must be placed into teacher review draft
      createdAt: new Date().toISOString(),
    };

    const questions: ExamQuestion[] = params.questions.map((q, idx) => ({
      ...q,
      id: `q-${examId}-${idx + 1}`,
      examId,
      questionNumber: idx + 1,
      orderIndex: idx + 1,
    }));

    this.exams.push(exam);
    this.examQuestions.push(...questions);
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
    const generated = generateGroundedExam(request);
    this.exams.unshift(generated.exam);
    this.examQuestions.unshift(...generated.questions);
    return generated;
  }

  async getExams(
    tenantId: string,
    filter?: { groupId?: string; teacherId?: string; status?: ExamStatus; subjectId?: string }
  ): Promise<Exam[]> {
    return this.exams.filter((e) => {
      if (e.tenantId !== tenantId) return false;
      if (filter?.groupId && e.groupId !== filter.groupId) return false;
      if (filter?.teacherId && e.teacherId !== filter.teacherId) return false;
      if (filter?.status && e.status !== filter.status) return false;
      if (filter?.subjectId && e.subjectId !== filter.subjectId) return false;
      return true;
    });
  }

  async getStudentExamSubmissions(tenantId: string, groupId: string, studentId: string): Promise<ExamSubmission[]> {
    const examIds = new Set((await this.getExams(tenantId, { groupId })).map(exam => exam.id));
    return this.examSubmissions.filter(item => item.studentId === studentId && examIds.has(item.examId));
  }

  async getExamById(examId: string): Promise<{ exam: Exam; questions: ExamQuestion[] } | null> {
    const exam = this.exams.find((e) => e.id === examId);
    if (!exam) return null;
    const questions = this.examQuestions.filter((q) => q.examId === examId);
    questions.sort((a, b) => a.orderIndex - b.orderIndex);
    return { exam, questions };
  }

  async updateExamQuestion(params: {
    tenantId: string;
    examId: string;
    questionId: string;
    updates: Partial<ExamQuestion>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; question?: ExamQuestion; error?: string; status: number }> {
    if (params.actorRole === 'STUDENT') {
      return {
        success: false,
        error: 'Forbidden: لا يُسمح للطلاب بتعديل أسئلة الامتحان',
        status: 403,
      };
    }

    const question = this.examQuestions.find((q) => q.examId === params.examId && q.id === params.questionId);
    if (!question) {
      return { success: false, error: 'السؤال غير موجود', status: 404 };
    }

    if (params.updates.questionText !== undefined) question.questionText = params.updates.questionText;
    if (params.updates.katexFormula !== undefined) question.katexFormula = params.updates.katexFormula;
    if (params.updates.options !== undefined) question.options = params.updates.options;
    if (params.updates.correctAnswer !== undefined) question.correctAnswer = params.updates.correctAnswer;
    if (params.updates.explanation !== undefined) question.explanation = params.updates.explanation;
    if (params.updates.marks !== undefined) {
      question.marks = params.updates.marks;
      // Recalculate exam totalMarks
      const exam = this.exams.find((e) => e.id === params.examId);
      if (exam) {
        const questions = this.examQuestions.filter((q) => q.examId === params.examId);
        exam.totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
        exam.passMarks = Math.round(exam.totalMarks * 0.5);
      }
    }
    if (params.updates.orderIndex !== undefined) question.orderIndex = params.updates.orderIndex;

    return { success: true, question, status: 200 };
  }

  async reorderExamQuestions(params: {
    tenantId: string;
    examId: string;
    questionOrder: Array<{ questionId: string; orderIndex: number }>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; questions?: ExamQuestion[]; error?: string; status: number }> {
    if (params.actorRole === 'STUDENT') {
      return {
        success: false,
        error: 'Forbidden: لا يُسمح للطلاب بإعادة ترتيب أسئلة الامتحان',
        status: 403,
      };
    }

    const questions = this.examQuestions.filter((q) => q.examId === params.examId);
    for (const item of params.questionOrder) {
      const q = questions.find((itemQ) => itemQ.id === item.questionId);
      if (q) {
        q.orderIndex = item.orderIndex;
      }
    }

    questions.sort((a, b) => a.orderIndex - b.orderIndex);
    questions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
      q.orderIndex = idx + 1;
    });

    return { success: true, questions, status: 200 };
  }

  async updateExamMetadata(params: {
    tenantId: string;
    examId: string;
    updates: Partial<Pick<Exam, 'title' | 'durationMinutes' | 'passMarks' | 'instructions' | 'status'>>;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }> {
    if (params.actorRole === 'STUDENT') {
      return { success: false, error: 'Forbidden: لا يُسمح للطلاب بتعديل بيانات الامتحان', status: 403 };
    }

    const exam = this.exams.find((e) => e.tenantId === params.tenantId && e.id === params.examId);
    if (!exam) return { success: false, error: 'الامتحان غير موجود', status: 404 };

    if (params.updates.title !== undefined) exam.title = params.updates.title;
    if (params.updates.durationMinutes !== undefined) exam.durationMinutes = params.updates.durationMinutes;
    if (params.updates.passMarks !== undefined) exam.passMarks = params.updates.passMarks;
    if (params.updates.instructions !== undefined) exam.instructions = params.updates.instructions;
    if (params.updates.status !== undefined) exam.status = params.updates.status;
    exam.updatedAt = new Date().toISOString();

    return { success: true, exam, status: 200 };
  }

  async archiveExam(params: {
    tenantId: string;
    examId: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; exam?: Exam; error?: string; status: number }> {
    if (params.actorRole === 'STUDENT') {
      return { success: false, error: 'Forbidden: لا يُسمح للطلاب بأرشفة الامتحانات', status: 403 };
    }
    const exam = this.exams.find((e) => e.tenantId === params.tenantId && e.id === params.examId);
    if (!exam) return { success: false, error: 'الامتحان غير موجود', status: 404 };
    exam.status = 'archived';
    exam.updatedAt = new Date().toISOString();
    return { success: true, exam, status: 200 };
  }

  async publishExam(examId: string, actorId: string, actorRole: UserRole): Promise<Exam> {
    const exam = this.exams.find((e) => e.id === examId);
    if (!exam) throw new Error('الامتحان غير موجود');

    if (actorRole === 'STUDENT') {
      throw new Error('Forbidden: الطلاب لا يمكنهم نشر الامتحانات');
    }

    exam.status = 'published';
    exam.updatedAt = new Date().toISOString();
    return exam;
  }

  async submitExam(
    examId: string,
    studentId: string,
    answers: Array<{ questionId: string; selectedAnswer: string }>
  ): Promise<{ submission: ExamSubmission; score: number; percentage: number }> {
    const exam = this.exams.find((e) => e.id === examId);
    if (!exam) throw new Error('الامتحان غير موجود');

    const questions = this.examQuestions.filter((q) => q.examId === examId);
    const answersMap: Record<string, string> = {};
    for (const ans of answers) {
      answersMap[ans.questionId] = ans.selectedAnswer;
    }

    const grading = gradeExam(questions, answersMap);

    const submission: ExamSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      examId,
      studentId,
      startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      autoGradedScore: grading.earnedPoints,
      manualGradedScore: 0,
      totalScore: grading.earnedPoints,
      status: grading.requiresManualReview ? 'submitted' : 'graded',
      percentage: grading.percentage,
      answers: answersMap,
    };

    this.examSubmissions.push(submission);
    return { submission, score: grading.earnedPoints, percentage: grading.percentage };
  }

  // 10. Notifications
  async enqueueNotification(params: {
    tenantId: string;
    recipientPhone: string;
    channel: NotificationChannel;
    templateName: string;
    payload: Record<string, any>;
    recipientUserId?: string;
  }): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId: params.tenantId,
      recipientUserId: params.recipientUserId,
      recipientPhone: params.recipientPhone,
      channel: params.channel,
      templateName: params.templateName,
      payload: params.payload,
      status: 'delivered',
      retryCount: 0,
      scheduledAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    };

    this.notifications.push(notification);
    return notification;
  }

  async getNotificationLogs(tenantId: string, limit?: number): Promise<NotificationRecord[]> {
    const logs = this.notifications.filter((n) => n.tenantId === tenantId);
    return typeof limit === 'number' && limit > 0 ? logs.slice(0, limit) : logs;
  }

  async getNotifications(tenantId: string, limit?: number): Promise<NotificationLog[]> {
    return this.getNotificationLogs(tenantId, limit);
  }

  async resendNotification(notificationId: string): Promise<NotificationRecord> {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (!notif) {
      throw new Error('الإشعار غير موجود');
    }
    notif.retryCount = (notif.retryCount || 0) + 1;
    notif.status = 'delivered';
    notif.errorMessage = undefined;
    notif.sentAt = new Date().toISOString();
    return notif;
  }
}
