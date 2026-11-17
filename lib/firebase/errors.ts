/**
 * Yalla Center - Arabic Error Translation for Firebase Auth & Firestore
 * Path: lib/firebase/errors.ts
 *
 * Provides user-friendly Arabic messages while completely concealing
 * internal Firebase error codes, project details, and technical stack traces.
 */

export const ARABIC_AUTH_ERRORS: Record<string, string> = {
  // Authentication / Identity Toolkit
  'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صالحة',
  'auth/user-not-found': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'auth/user-disabled': 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة السنتر.',
  'auth/too-many-requests': 'تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار دقيقة والمحاولة مجددًا.',
  'auth/email-already-in-use': 'البريد الإلكتروني مسجل بالفعل لحساب آخر.',
  'auth/weak-password': 'كلمة المرور ضعيفة جدًا. يرجى كتابة 8 أحرف على الأقل.',
  'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل إتمام العملية.',
  'auth/cancelled-popup-request': 'تم إلغاء عملية تسجيل الدخول السابقة.',
  'auth/network-request-failed': 'تعذّر الاتصال بالخادم السحابي. يرجى التحقق من اتصالك بالإنترنت.',
  'auth/requires-recent-login': 'لهذه العملية، يرجى إعادة تسجيل الدخول لتأكيد الهوية.',
  'auth/operation-not-allowed': 'تسجيل الدخول بهذه الطريقة غير مفعّل حالياً. تواصل مع الدعم الفني.',

  // REST API error code strings
  'EMAIL_NOT_FOUND': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'INVALID_PASSWORD': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'INVALID_LOGIN_CREDENTIALS': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  'USER_DISABLED': 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة السنتر.',
  'TOO_MANY_ATTEMPTS_TRY_LATER': 'تم حظر المحاولات مؤقتًا لكثرة الأخطاء. يرجى المحاولة بعد قليل.',
  'EMAIL_EXISTS': 'البريد الإلكتروني مسجل بالفعل.',
  'LOCAL_ID_EXISTS': 'الحساب موجود بالفعل.',
  'WEAK_PASSWORD': 'كلمة المرور ضعيفة. يجب ألا تقل عن 8 أحرف.',

  // Firestore / Authorization
  'permission-denied': 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  'PERMISSION_DENIED': 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  'not-found': 'السجل المطلوب غير موجود في النظام.',
  'NOT_FOUND': 'السجل المطلوب غير موجود في النظام.',
  'already-exists': 'السجل موجود بالفعل.',
  'ALREADY_EXISTS': 'السجل موجود بالفعل.',
  'resource-exhausted': 'تم تجاوز الحد المسموح للاستخدام.',
  'unauthenticated': 'يرجى تسجيل الدخول أولاً.',
  'UNAUTHENTICATED': 'يرجى تسجيل الدخول أولاً.',
};

export function getArabicAuthErrorMessage(error: unknown, fallback = 'حدث خطأ أثناء المصادقة. يرجى المحاولة مجددًا.'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    for (const [code, msg] of Object.entries(ARABIC_AUTH_ERRORS)) {
      if (error.includes(code)) return msg;
    }
    return error;
  }

  if (error instanceof Error) {
    // Check if error code property exists
    const code = (error as { code?: string }).code;
    if (code && ARABIC_AUTH_ERRORS[code]) {
      return ARABIC_AUTH_ERRORS[code];
    }

    // Match in message
    const message = error.message;
    for (const [key, msg] of Object.entries(ARABIC_AUTH_ERRORS)) {
      if (message.includes(key)) return msg;
    }

    // If message is already Arabic, return it
    if (/[\u0600-\u06FF]/.test(message)) {
      return message;
    }
  }

  return fallback;
}
