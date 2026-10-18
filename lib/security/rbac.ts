/**
 * Yalla Center - Centralized RBAC & Security Guardrail Engine
 * Path: lib/security/rbac.ts
 *
 * Implements strict 3-tier security guardrails, 8-role authorization matrix,
 * tenant boundary verification, and whitelist mutation validation.
 */

import { UserRole } from '@/lib/dal/types';

export interface UserSecurityContext {
  id: string;
  role: UserRole;
  tenantId?: string;
  tenantSlug?: string;
}

export interface SecurityGuardResult<T = any> {
  status: 200 | 400 | 401 | 403 | 404;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Strictly allowed mutation keys for student and teacher self-profile updates
export const ALLOWED_MUTATION_KEYS = ['avatar_url', 'avatarUrl', 'userId', 'targetUserId'] as const;
export const ALLOWED_SELF_PROFILE_KEYS = new Set<string>(['avatar_url', 'avatarUrl', 'userId', 'targetUserId']);

// Administrative protected fields (locked from student & teacher alterations)
export const RESTRICTED_ADMIN_FIELDS = [
  'fullName',
  'full_name',
  'role',
  'studentCode',
  'student_code',
  'stage',
  'grade',
  'division',
  'seatNumber',
  'seat_number',
  'balanceDue',
  'balance_due',
  'financial_balance',
  'phone',
  'email',
  'nationalId',
  'national_id',
  'guardianName',
  'guardian_name',
  'guardianPhone',
  'guardian_phone',
  'isActive',
  'is_active',
  'tenantId',
  'tenant_id',
  'contractualFixedRate',
  'splitPercentage',
  'test_scores',
  'enrolled_groups',
  'attendance_history',
];

/**
 * Validates cross-tenant data query access (AC-3)
 * Center A users cannot access Center B data. Platform Owner has global access.
 */
export function checkTenantAccess(
  actor: UserSecurityContext,
  resourceTenantIdOrSlug: string
): SecurityGuardResult<{ access: 'GRANTED_GLOBAL' | 'GRANTED_LOCAL'; tenant: string }> {
  if (!actor) {
    return {
      status: 401,
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    };
  }

  if (actor.role === 'PLATFORM_OWNER') {
    return {
      status: 200,
      success: true,
      data: { access: 'GRANTED_GLOBAL', tenant: resourceTenantIdOrSlug },
    };
  }

  const matchesId = Boolean(actor.tenantId && actor.tenantId === resourceTenantIdOrSlug);
  const matchesSlug = Boolean(actor.tenantSlug && actor.tenantSlug === resourceTenantIdOrSlug);

  if (!matchesId && !matchesSlug) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Cross-tenant query rejected: Center A users cannot access Center B data',
    };
  }

  return {
    status: 200,
    success: true,
    data: { access: 'GRANTED_LOCAL', tenant: resourceTenantIdOrSlug },
  };
}

/**
 * Validates profile photo update payload for students and teachers (AC-4, AC-5)
 * Enforces strict whitelist: ONLY avatar_url/avatarUrl are permitted.
 * Any other field causes immediate HTTP 403 Forbidden.
 */
export function validateProfilePhotoUpdate(
  actor: UserSecurityContext,
  targetUserId: string,
  payload: Record<string, any>
): SecurityGuardResult<{ avatarUrl: string; targetUserId: string }> {
  // Authentication check
  if (!actor || !actor.id) {
    return {
      status: 401,
      success: false,
      error: 'UNAUTHORIZED',
      message: 'يرجى تسجيل الدخول أولاً',
    };
  }

  // Self-update restriction for Student & Teacher
  if (actor.role === 'STUDENT' || actor.role === 'TEACHER') {
    if (actor.id !== targetUserId) {
      return {
        status: 403,
        success: false,
        error: 'FORBIDDEN',
        message: 'Security Violation (HTTP 403): لا يمكنك تعديل الصورة الشخصية لمستخدم آخر',
      };
    }

    // Strict Whitelist Check
    const payloadKeys = Object.keys(payload);
    const forbiddenKeys = payloadKeys.filter((key) => !ALLOWED_SELF_PROFILE_KEYS.has(key));

    if (forbiddenKeys.length > 0) {
      return {
        status: 403,
        success: false,
        error: 'FORBIDDEN',
        message: `Security Violation (HTTP 403): الطلاب والمعلمون مصرح لهم بتعديل الصورة الشخصية فقط (avatar_url). الحقول المحظورة: ${forbiddenKeys.join(', ')}`,
      };
    }
  }

  // Role permissions: Center Admin, Platform Owner, Branch Manager can update photo for any user
  const allowedPhotoRoles: UserRole[] = [
    'STUDENT',
    'TEACHER',
    'CENTER_ADMIN',
    'PLATFORM_OWNER',
    'BRANCH_MANAGER',
  ];

  if (!allowedPhotoRoles.includes(actor.role)) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Unauthorized role action',
    };
  }

  const rawUrl = payload.avatar_url ?? payload.avatarUrl;
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return {
      status: 400,
      success: false,
      error: 'BAD_REQUEST',
      message: 'رابط الصورة الشخصية مطلوب ويجب أن يكون صالحاً وغير فارغ',
    };
  }

  return {
    status: 200,
    success: true,
    data: { avatarUrl: rawUrl.trim(), targetUserId },
  };
}

/**
 * Validates teacher contractual rate modifications (AC-6)
 * Teachers cannot modify their own or any teacher's rates.
 */
export function validateTeacherRateUpdate(
  actor: UserSecurityContext,
  targetTeacherId: string,
  rates: { contractualFixedRate?: number; splitPercentage?: number; fixedRatePerStudent?: number }
): SecurityGuardResult<{ teacherId: string } & typeof rates> {
  if (actor.role === 'TEACHER') {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Teachers cannot alter contractual salary rates or revenue-sharing percentages',
    };
  }

  const authorizedRoles: UserRole[] = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'ACCOUNTANT'];
  if (!authorizedRoles.includes(actor.role)) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'غير مصرح بتعديل أسعار التعاقد، مقتصر على الإدارة والمحاسب',
    };
  }

  return {
    status: 200,
    success: true,
    data: { teacherId: targetTeacherId, ...rates },
  };
}

/**
 * Validates teacher payroll statement access (AC-6)
 * Teachers can only view their own statements; peering returns HTTP 403.
 */
export function validateTeacherStatementAccess(
  actor: UserSecurityContext,
  targetTeacherId: string
): SecurityGuardResult<{ teacherId: string; statement: string }> {
  if (actor.role === 'TEACHER' && actor.id !== targetTeacherId) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Teachers cannot access another teacher financial statements or payroll ledgers',
    };
  }

  const authorizedRoles: UserRole[] = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'ACCOUNTANT', 'TEACHER'];
  if (!authorizedRoles.includes(actor.role)) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'غير مصرح بالاطلاع على كشوف المرتبات',
    };
  }

  return {
    status: 200,
    success: true,
    data: { teacherId: targetTeacherId, statement: 'CONFIDENTIAL_PAYROLL_DATA' },
  };
}
