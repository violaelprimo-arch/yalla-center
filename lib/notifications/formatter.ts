/**
 * Yalla Center - Arabic Notification Template & Push Payload Formatter
 * Path: lib/notifications/formatter.ts
 */

export interface AttendanceTemplateParams {
  studentName: string;
  subject?: string;
  time?: string;
  sessionDate?: string;
  centerName?: string;
  balanceDue?: number;
}

export interface ReceiptTemplateParams {
  studentName: string;
  amount: number;
  receiptNumber: string;
  description?: string;
  centerName?: string;
}

export interface ExamResultTemplateParams {
  studentName: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  centerName?: string;
}

export interface ExamPublishedTemplateParams {
  examTitle: string;
  link?: string;
  centerName?: string;
}

export interface AbsenceTemplateParams {
  studentName: string;
  subject?: string;
  time?: string;
  centerName?: string;
}

/**
 * Standardized Arabic WhatsApp Attendance Message
 * Includes mandatory overdue balance alert when balanceDue > 0.
 */
export function formatWhatsAppAttendanceMessage(params: AttendanceTemplateParams): string {
  const {
    studentName,
    subject = 'الحصة المقررة',
    time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    centerName = 'يلا سنتر',
    balanceDue = 0,
  } = params;

  let message = `تم تسجيل حضور الطالب ${studentName} في حصة ${subject} بتاريخ ${time} - سنتر ${centerName}`;

  if (balanceDue > 0) {
    message += `\n⚠️ تنبيه: متبقي مبلغ ${balanceDue.toFixed(2)} ج.م مطلوب سداده.`;
  }

  return message;
}

/**
 * Standardized Arabic WhatsApp Payment Receipt Message
 */
export function formatWhatsAppReceiptMessage(params: ReceiptTemplateParams): string {
  const {
    studentName,
    amount,
    receiptNumber,
    description = 'المصروفات الدراسية',
    centerName = 'يلا سنتر',
  } = params;

  return `تم استلام مبلغ ${amount.toFixed(2)} ج.م مقابل ${description} برقم إيصال ${receiptNumber} للطالب ${studentName} - سنتر ${centerName}`;
}

/**
 * Standardized Arabic WhatsApp Exam Result Message
 */
export function formatWhatsAppExamResultMessage(params: ExamResultTemplateParams): string {
  const {
    studentName,
    examTitle,
    score,
    totalMarks,
    percentage,
    centerName = 'يلا سنتر',
  } = params;

  return `تم رصد نتيجة اختبار ${examTitle} للطالب ${studentName}: ${score}/${totalMarks} بنسبة ${percentage}% - سنتر ${centerName}`;
}

/**
 * Standardized Arabic WhatsApp Exam Published Alert
 */
export function formatWhatsAppExamPublishedMessage(params: ExamPublishedTemplateParams): string {
  const { examTitle, link, centerName = 'يلا سنتر' } = params;

  let message = `تنبيه: تم نشر اختبار جديد بعنوان '${examTitle}' - سنتر ${centerName}`;
  if (link) {
    message += `\nالرابط: ${link}`;
  }
  return message;
}

/**
 * Standardized Arabic WhatsApp Student Absence Alert
 */
export function formatWhatsAppAbsenceMessage(params: AbsenceTemplateParams): string {
  const {
    studentName,
    subject = 'الحصة المقررة',
    time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    centerName = 'يلا سنتر',
  } = params;

  return `تنبيه لولي الأمر: تغيب الطالب ${studentName} عن حضور حصة ${subject} المقررة اليوم ${time} - سنتر ${centerName}`;
}

/**
 * Format RFC 8030 compliant Web Push FCM Payload
 */
export function formatFCMPushPayload(params: {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
}): Record<string, any> {
  return {
    to: params.deviceToken,
    notification: {
      title: params.title,
      body: params.body,
      icon: params.icon || '/brand/yalla-center-icon.png',
      badge: '/brand/yalla-center-icon.png',
      dir: 'rtl',
      lang: 'ar',
    },
    data: params.data || {},
  };
}

/**
 * Universal Arabic Notification Text Renderer
 */
export function renderNotificationContent(
  templateName: string,
  payload: Record<string, any>
): string {
  switch (templateName) {
    case 'student_attendance_ar':
    case 'attendance_checkin':
    case 'attendance_alert':
      return formatWhatsAppAttendanceMessage({
        studentName: payload.studentName || 'الطالب',
        subject: payload.subject || payload.sessionName,
        time: payload.time || payload.scannedAt,
        centerName: payload.centerName,
        balanceDue: Number(payload.balanceDue || 0),
      });

    case 'payment_receipt_ar':
    case 'receipt_alert':
      return formatWhatsAppReceiptMessage({
        studentName: payload.studentName || 'الطالب',
        amount: Number(payload.amount || 0),
        receiptNumber: payload.receiptNumber || 'REC-001',
        description: payload.description,
        centerName: payload.centerName,
      });

    case 'exam_result_ar':
    case 'grade_alert':
      return formatWhatsAppExamResultMessage({
        studentName: payload.studentName || 'الطالب',
        examTitle: payload.examTitle || 'امتحان تجريبي',
        score: Number(payload.score || 0),
        totalMarks: Number(payload.totalMarks || 100),
        percentage: Number(payload.percentage || 0),
        centerName: payload.centerName,
      });

    case 'exam_published_alert':
      return formatWhatsAppExamPublishedMessage({
        examTitle: payload.examTitle || 'امتحان جديد',
        link: payload.link,
        centerName: payload.centerName,
      });

    case 'student_absence_ar':
    case 'absence_alert':
      return formatWhatsAppAbsenceMessage({
        studentName: payload.studentName || 'الطالب',
        subject: payload.subject,
        time: payload.time,
        centerName: payload.centerName,
      });

    default:
      return (
        payload.message ||
        payload.text ||
        payload.content ||
        `إشعار من سنتر ${payload.centerName || 'يلا سنتر'}`
      );
  }
}
