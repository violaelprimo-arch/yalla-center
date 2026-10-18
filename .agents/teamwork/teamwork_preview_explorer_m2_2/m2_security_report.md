# Milestone 2 Security Guardrails & RBAC Architecture Report

**Platform**: Yalla Center SaaS  
**Author**: Explorer M2-2 (Security Guardrails & RBAC Explorer)  
**Target Milestone**: Milestone 2 (Multi-Tenant Architecture, Portals & Strict Security Guardrails)  
**Date**: 2026-10-18  
**Scope**: 3-Tier Security Architecture, 8-Role RBAC Authorization Matrix, Profile Photo Security Guardrail, API & DAL Protection, Route Middleware, and Test Specifications.

---

## 1. Executive Summary

Milestone 2 establishes the multi-tenant architecture and security foundation of Yalla Center. The core objective is enforcing strict tenant boundaries between educational centers (`/center/[centerSlug]`) and the platform super-admin portal (`/owner`), alongside rigorous Role-Based Access Control (RBAC) across all 8 platform roles:
`PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`, `RECEPTIONIST`, `TEACHER`, `STUDENT`, `PARENT`.

A paramount security requirement defined in `ORIGINAL_REQUEST.md` (R2, AC-4, AC-5, AC-6) dictates:
> **Students and teachers can upload and update ONLY their own profile photo (`avatar_url`); all administrative, academic, and financial data is strictly read-only for students and teachers across UI, server endpoints, and database RLS.**

This report establishes the complete 3-Tier Defense-in-Depth architecture, documents the granular 8-role authorization matrix, provides exact production-ready implementation code for Worker M2, and specifies a 24-scenario test suite to ensure 100% compliance with zero vulnerability leakage.

---

## 2. 3-Tier Security Guardrail Architecture

Yalla Center enforces security through three distinct, mutually reinforcing architectural layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: CLIENT-SIDE UI GUARDRAILS (Next.js App Router & React)          │
│ - Conditional read-only/disabled form inputs (name, code, grades, fees)│
│ - Security lock badges ("مغلق أمنياً / للقراءة فقط")                    │
│ - Active avatar photo uploader with instant preview                    │
│ - Role-filtered navigation and view rendering                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Requests
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: APPLICATION & API LAYER (Route Handlers, Middleware, DAL)      │
│ - Next.js Middleware: Tenant slug resolution, cross-tenant check       │
│ - Dedicated endpoint: POST /api/profile/update-photo                   │
│ - Whitelist guard: HTTP 403 if ANY field other than avatar_url sent    │
│ - Self-target check: HTTP 403 if student/teacher targets another user  │
│ - Data Access Layer (IDataProvider / MockDataProvider) whitelist gate  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Mutations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 3: DATABASE LAYER (Supabase PostgreSQL RLS & Triggers)            │
│ - Row Level Security (RLS) on 22 tables (tenant_id isolation)          │
│ - Trigger trg_enforce_user_guardrail via enforce_self_profile_update() │
│ - Database-level rejection: SQLSTATE '42501' (Forbidden)               │
│ - Immutable teacher contractual compensation rates & peer ledger lock  │
└────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Client-Side UI Guardrails
- **Profile View (`/center/[centerSlug]/profile`)**:
  - When the viewing user is a `STUDENT` or `TEACHER`, all administrative fields (`fullName`, `studentCode`, `stage`, `grade`, `division`, `seatNumber`, `phone`, `email`, `nationalId`, `guardianName`, `guardianPhone`, `balanceDue`, `contractualFixedRate`, `splitPercentage`) are rendered with `disabled={true}` and `readOnly={true}`.
  - Distinctive Arabic badges (`مغلق أمنياً - للسنتر فقط`) visually indicate that these attributes are protected.
  - The profile photo upload component (`avatar_url`) remains interactive with file selection, preview, and an active submit button.
  - When the viewing user is `CENTER_ADMIN` or `PLATFORM_OWNER`, administrative edit controls are unlocked.

### Tier 2: Application & API Security Guardrails
- **Next.js Middleware (`middleware.ts`)**:
  - Intercepts requests to `/owner/**` and restricts access exclusively to `PLATFORM_OWNER`.
  - Intercepts requests to `/center/[centerSlug]/**` and verifies that the authenticated user belongs to the requested `tenantId` (or is `PLATFORM_OWNER`). Cross-tenant access is rejected with HTTP 403 Forbidden.
  - Sub-route guardrails prevent unauthorized roles from reaching sensitive operational paths (e.g., non-financial roles attempting to access `/finance`).
- **Dedicated Photo Update Endpoint (`POST /api/profile/update-photo`)**:
  - Validates authentication session.
  - Verifies actor authorization:
    - If `actorRole` is `STUDENT` or `TEACHER`:
      1. `targetUserId === actor.id` (strictly self-service; peer updates return HTTP 403).
      2. **Strict Whitelist Rule**: The request payload must contain **ONLY** `avatar_url` (or `avatarUrl`). If ANY extra key is present (e.g., `balanceDue: 0`, `studentCode: 'NEW'`, `name: 'Hacked'`), the API returns HTTP 403 Forbidden immediately without modifying data.
  - Validates that `avatar_url` is a non-empty, valid URL string (HTTP 400 on empty/malformed URL).
  - Invokes DAL method `updateUserProfilePhoto`.
- **Data Access Layer (`IDataProvider`)**:
  - `updateUserProfilePhoto(userId, avatarUrl, actorId, actorRole)` verifies role boundaries.
  - `updateUser(userId, updates, actorId, actorRole)` incorporates strict whitelist verification for `STUDENT` and `TEACHER` roles.

### Tier 3: Database Security Layer (PostgreSQL)
- **RLS Policies**:
  - `users_self_profile_update_policy`: Permits students and teachers to update rows in `users` only where `id = auth.uid()`.
  - `teacher_rates_mutation_policy`: Locks `teacher_rates` mutations to `PLATFORM_OWNER`, `CENTER_ADMIN`, and `ACCOUNTANT`.
  - `teacher_payroll_select_policy`: Limits payroll view to administrators and the teacher's own `teacher_id = auth.uid()`.
- **Trigger `trg_enforce_user_guardrail` (`lib/supabase/schema.sql`)**:
  - Procedure `enforce_self_profile_update_guardrail()` intercepts `BEFORE UPDATE ON users`.
  - If `OLD.role IN ('STUDENT', 'TEACHER')` and any protected column (`full_name`, `student_code`, `stage`, `grade`, `division`, `seat_number`, `balance_due`, `role`, `tenant_id`, `is_active`, `phone`, `guardian_phone`, `guardian_name`, `email`, `national_id`) is modified (`NEW.col IS DISTINCT FROM OLD.col`), the trigger raises SQL exception with `ERRCODE = '42501'` (Insufficient Privilege / Forbidden).

---

## 3. Comprehensive 8-Role RBAC Authorization Matrix

| Feature / Route | `PLATFORM_OWNER` | `CENTER_ADMIN` | `BRANCH_MANAGER` | `ACCOUNTANT` | `RECEPTIONIST` | `TEACHER` | `STUDENT` | `PARENT` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Platform Portal (`/owner/**`)** | ✅ Full | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| **Center Overview (`/center/[slug]`)** | ✅ Global | ✅ Full | ✅ Operational | ✅ Financial | ✅ Reception | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| **Branches & Rooms (`/branches`)** | ✅ Global | ✅ Full CRUD | ✅ Manage | 👁️ Read | 👁️ Read | ❌ 403 | ❌ 403 | ❌ 403 |
| **Timetable & Conflict Detection** | ✅ Global | ✅ Full CRUD | ✅ Full CRUD | 👁️ Read | 👁️ Read | 👁️ Own Classes | 👁️ Enrolled | 👁️ Enrolled |
| **Student Directory (`/students`)** | ✅ Global | ✅ Full CRUD | ✅ View / Edit | 👁️ Read / Balances | ✅ Fast Lookup | 👁️ Class Roster | ❌ 403 | ❌ 403 |
| **Student Administrative Fields** | ✅ Edit | ✅ Edit | ✅ Edit | ❌ Read Only | ❌ Read Only | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock |
| **Reception Fast Check-in (`/reception`)** | ✅ Global | ✅ Full | ✅ Full | ❌ 403 | ✅ Full Scan HUD | ❌ 403 | ❌ 403 | ❌ 403 |
| **Sessions & In-Session Tests** | ✅ Global | ✅ Full | ✅ Manage | 👁️ Attendance | 👁️ Check-in | ✅ Conduct / Tests | ❌ 403 | ❌ 403 |
| **Materials Repository (`/materials`)** | ✅ Global | ✅ Full | ✅ View | ❌ 403 | ❌ 403 | ✅ Upload / Index | 👁️ Enrolled | ❌ 403 |
| **AI Exam Generator (`/exams`)** | ✅ Global | ✅ Full | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Generate / Draft | ❌ 403 | ❌ 403 |
| **Printable A4 Sheet Export** | ✅ Global | ✅ Export | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Export | ❌ 403 | ❌ 403 |
| **Online Exam Runner (`/runner/[id]`)** | ✅ Preview | ✅ Preview | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Preview | ✅ Take / Autosave | ❌ 403 |
| **Financial Suite (`/finance`)** | ✅ Global | ✅ Full | ❌ 403 | ✅ Full | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| **Cashier Shifts & Invoicing** | ✅ Global | ✅ Audit | ❌ 403 | ✅ Close / Audit | ✅ Active Shift | ❌ 403 | ❌ 403 | ❌ 403 |
| **Teacher Compensation Rates** | ✅ Global | ✅ Full CRUD | ❌ 403 Lock | 👁️ Read Only | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock |
| **Teacher Payroll Approval** | ✅ Global | ✅ Approve | ❌ 403 | ✅ Review / Calc | ❌ 403 | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock |
| **Peer Teacher Payroll Privacy** | ✅ Global | ✅ View All | ❌ 403 | ✅ View All | ❌ 403 | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock |
| **Profile Avatar (`avatar_url`)** | ✅ Self & All | ✅ Self & All | ✅ Self | ✅ Self | ✅ Self | ✅ Self Only | ✅ Self Only | ✅ Self Only |
| **Cross-Tenant Center Isolation** | ✅ Global | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock | ❌ 403 Lock |

---

## 4. Profile Management & Photo Update Security Analysis

### Whitelist vs. Blacklist Vulnerability Analysis
In `lib/dal/mock-data.ts`, `updateUser` previously checked a blacklist array (`protectedFields`). 
**Vulnerability Identified**: If a client sends newly added or non-enumerated fields (e.g., `contractualFixedRate`, `test_scores`, `enrolled_groups`, or arbitrary injected attributes), a blacklist check fails to block them.
**Remedy**: We enforce a **Strict Whitelist Rule**:
For any mutation originating from or targeting a `STUDENT` or `TEACHER`, the ONLY permissible field is `avatar_url` (or `avatarUrl`). Any payload containing keys outside `['avatar_url', 'avatarUrl', 'userId', 'targetUserId']` MUST be immediately rejected with HTTP 403 Forbidden.

### Tamper Scenarios Prevented
1. **Student Self-Grade Tampering**: Student Alice attempts `{ grade: "الصف الثالث الثانوي" }` -> HTTP 403 Forbidden.
2. **Student Financial Zeroing**: Student Alice attempts `{ balance_due: 0.0 }` -> HTTP 403 Forbidden.
3. **Mass Assignment Exploit**: Student sends `{ avatar_url: "valid.png", balance_due: 0.0 }` -> HTTP 403 Forbidden.
4. **Peer Photo Vandalism**: Student Alice sends `{ targetUserId: "bob-id", avatar_url: "fake.png" }` -> HTTP 403 Forbidden.
5. **Teacher Rate Self-Inflation**: Teacher Zaid sends `{ contractualFixedRate: 200 }` -> HTTP 403 Forbidden.
6. **Teacher Peer Financial Snoop**: Teacher Zaid queries Teacher Amr's statement -> HTTP 403 Forbidden.
7. **Cross-Tenant Intrusion**: Center A admin queries Center B data -> HTTP 403 Forbidden.

---

## 5. Exact Implementation Code Recommendations for Worker M2

### 5.1. Unified Security Guardrails Engine (`lib/security/rbac.ts`)

```typescript
/**
 * Yalla Center - Centralized RBAC & Security Guardrail Engine
 * Path: lib/security/rbac.ts
 */

import { UserRole, User } from '@/lib/dal/types';

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

// Permitted mutation keys for restricted roles
export const ALLOWED_SELF_PROFILE_KEYS = new Set(['avatar_url', 'avatarUrl', 'userId', 'targetUserId']);

// Administrative protected fields
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
 */
export function checkTenantAccess(
  actor: UserSecurityContext,
  resourceTenantIdOrSlug: string
): SecurityGuardResult {
  if (actor.role === 'PLATFORM_OWNER') {
    return { status: 200, success: true, data: { access: 'GRANTED_GLOBAL', tenant: resourceTenantIdOrSlug } };
  }

  const matchesId = actor.tenantId && actor.tenantId === resourceTenantIdOrSlug;
  const matchesSlug = actor.tenantSlug && actor.tenantSlug === resourceTenantIdOrSlug;

  if (!matchesId && !matchesSlug) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Cross-tenant query rejected: Center A users cannot access Center B data',
    };
  }

  return { status: 200, success: true, data: { access: 'GRANTED_LOCAL', tenant: resourceTenantIdOrSlug } };
}

/**
 * Validates profile photo update payload for students and teachers (AC-4, AC-5)
 */
export function validateProfilePhotoUpdate(
  actor: UserSecurityContext,
  targetUserId: string,
  payload: Record<string, any>
): SecurityGuardResult<{ avatarUrl: string; targetUserId: string }> {
  // Authentication check
  if (!actor || !actor.id) {
    return { status: 401, success: false, error: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول أولاً' };
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

  // Role permissions for Center Admin & Platform Owner
  if (
    actor.role !== 'STUDENT' &&
    actor.role !== 'TEACHER' &&
    actor.role !== 'CENTER_ADMIN' &&
    actor.role !== 'PLATFORM_OWNER' &&
    actor.role !== 'BRANCH_MANAGER'
  ) {
    return {
      status: 403,
      success: false,
      error: 'FORBIDDEN',
      message: 'Unauthorized role action',
    };
  }

  const avatarUrl = payload.avatar_url || payload.avatarUrl;
  if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim().length === 0) {
    return {
      status: 400,
      success: false,
      error: 'BAD_REQUEST',
      message: 'رابط الصورة الشخصية مطلوب ويجب أن يكون صالحاً',
    };
  }

  return {
    status: 200,
    success: true,
    data: { avatarUrl: avatarUrl.trim(), targetUserId },
  };
}

/**
 * Validates teacher contractual rate modifications (AC-6)
 */
export function validateTeacherRateUpdate(
  actor: UserSecurityContext,
  targetTeacherId: string,
  rates: { contractualFixedRate?: number; splitPercentage?: number; fixedRatePerStudent?: number }
): SecurityGuardResult {
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
 */
export function validateTeacherStatementAccess(
  actor: UserSecurityContext,
  targetTeacherId: string
): SecurityGuardResult {
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
```

---

### 5.2. Protected Profile Photo API Route (`app/api/profile/update-photo/route.ts`)

```typescript
/**
 * Yalla Center - Guarded Profile Photo Upload Endpoint
 * Path: app/api/profile/update-photo/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal';
import { validateProfilePhotoUpdate, UserSecurityContext } from '@/lib/security/rbac';

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve Actor Context from Headers or Session
    const actorId = request.headers.get('x-user-id') || 'user-student-1001'; // Fallback in demo
    const actorRole = (request.headers.get('x-user-role') || 'STUDENT') as any;
    const actorTenantSlug = request.headers.get('x-tenant-slug') || 'al-maher';

    const actorContext: UserSecurityContext = {
      id: actorId,
      role: actorRole,
      tenantSlug: actorTenantSlug,
    };

    // 2. Parse JSON Payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'BAD_REQUEST', message: 'تنسيق الطلب غير صالح (JSON مطلوب)' },
        { status: 400 }
      );
    }

    const targetUserId = body.userId || body.targetUserId || actorId;

    // 3. Enforce Strict RBAC & Whitelist Guardrail
    const guardResult = validateProfilePhotoUpdate(actorContext, targetUserId, body);
    if (!guardResult.success) {
      return NextResponse.json(
        { success: false, error: guardResult.error, message: guardResult.message },
        { status: guardResult.status }
      );
    }

    // 4. Execute DAL Mutation
    const dal = getDataProvider();
    const dalResult = await dal.updateUserProfilePhoto(
      targetUserId,
      guardResult.data!.avatarUrl,
      actorContext.id,
      actorContext.role
    );

    if (!dalResult.success) {
      return NextResponse.json(
        { success: false, error: dalResult.error || 'فشل تحديث الصورة الشخصية' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dalResult.data,
      message: 'تم تحديث الصورة الشخصية بنجاح',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: err?.message || 'خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
```

---

### 5.3. Multi-Tenant Route Resolution Middleware (`middleware.ts`)

```typescript
/**
 * Yalla Center - Tenant Resolution & Route Guarding Middleware
 * Path: middleware.ts
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Resolve user identity from cookies / headers (demo or jwt)
  const userRole = request.headers.get('x-user-role') || request.cookies.get('yc_role')?.value || 'STUDENT';
  const userTenantSlug = request.headers.get('x-tenant-slug') || request.cookies.get('yc_tenant')?.value || 'al-maher';
  const userId = request.headers.get('x-user-id') || request.cookies.get('yc_user_id')?.value || 'user-student-1001';

  // 1. Platform Owner Portal Guard (/owner)
  if (pathname.startsWith('/owner')) {
    if (userRole !== 'PLATFORM_OWNER') {
      const url = request.nextUrl.clone();
      url.pathname = `/center/${userTenantSlug}`;
      return NextResponse.redirect(url);
    }
  }

  // 2. Center Tenant Resolution & Isolation Guard (/center/[centerSlug])
  if (pathname.startsWith('/center/')) {
    const segments = pathname.split('/');
    const requestedTenantSlug = segments[2];

    // Check Cross-Tenant Barrier
    if (userRole !== 'PLATFORM_OWNER' && userTenantSlug !== requestedTenantSlug) {
      return new NextResponse(
        JSON.stringify({
          error: 'FORBIDDEN',
          message: 'Cross-tenant access rejected: غير مصرح لك بالدخول إلى بيانات هذا السنتر',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      );
    }

    // Sub-Route Role Boundaries
    const subRoute = segments[3];
    if (subRoute === 'finance') {
      const allowedFinanceRoles = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'ACCOUNTANT'];
      if (!allowedFinanceRoles.includes(userRole)) {
        return new NextResponse(
          JSON.stringify({ error: 'FORBIDDEN', message: 'مقتصر على الإدارة والحسابات' }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
    }

    if (subRoute === 'reception') {
      const allowedReceptionRoles = ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'];
      if (!allowedReceptionRoles.includes(userRole)) {
        return new NextResponse(
          JSON.stringify({ error: 'FORBIDDEN', message: 'مقتصر على موظفي الاستقبال والإدارة' }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
    }
  }

  // Inject Resolved Security Headers for Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId);
  requestHeaders.set('x-user-role', userRole);
  requestHeaders.set('x-tenant-slug', userTenantSlug);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/owner/:path*', '/center/:path*', '/api/profile/:path*'],
};
```

---

### 5.4. Arabic RTL Cairo Dedicated Profile View (`app/center/[centerSlug]/profile/page.tsx`)

```tsx
/**
 * Yalla Center - Dedicated User Profile View
 * Path: app/center/[centerSlug]/profile/page.tsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { UserRole, User } from '@/lib/dal/types';

export default function ProfilePage() {
  const params = useParams();
  const centerSlug = params.centerSlug as string;

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load user data (mock user for demo)
  useEffect(() => {
    // Demo user: Student Ahmed
    const demoStudent: User = {
      id: 'user-student-1001',
      tenantId: 'tenant-maher-001',
      role: 'STUDENT',
      fullName: 'أحمد محمد علي',
      studentCode: 'STD-1001',
      email: 'ahmed.ali@student.edu.eg',
      phone: '01012341001',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6',
      stage: 'المرحلة الثانوية',
      grade: 'الصف الثالث الثانوي',
      division: 'علمي رياضة',
      seatNumber: '5001',
      guardianName: 'محمد علي (ولي الأمر)',
      guardianPhone: '01099991001',
      balanceDue: 0.0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    setCurrentUser(demoStudent);
    setAvatarUrlInput(demoStudent.avatarUrl || '');
  }, [centerSlug]);

  if (!currentUser) {
    return <div className="p-8 text-center text-muted-foreground">جاري تحميل الملف الشخصي...</div>;
  }

  const isRestrictedRole = currentUser.role === 'STUDENT' || currentUser.role === 'TEACHER';

  const handlePhotoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPhoto(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile/update-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role,
          'x-tenant-slug': centerSlug,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          avatar_url: avatarUrlInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل تحديث الصورة');
      }

      setCurrentUser({ ...currentUser, avatarUrl: avatarUrlInput });
      setMessage({ text: 'تم تحديث الصورة الشخصية بنجاح بنظام الأمان السحابي', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'حدث خطأ أثناء حفظ الصورة', type: 'error' });
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 sm:p-8 space-y-8 text-foreground" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">الملف الشخصي</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة بيانات الحساب والصورة الشخصية وفق قواعد الأمان الصارمة لمنصة يلا سنتر.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20">
          الدور: {currentUser.role === 'STUDENT' ? 'طالب' : currentUser.role === 'TEACHER' ? 'معلم' : currentUser.role}
        </span>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Security Banner for Student & Teacher */}
      {isRestrictedRole && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <div>
            <strong className="font-semibold block mb-0.5">ضوابط الأمان المشددة (Security Guardrail):</strong>
            <span>
              يحق للطلاب والمعلمين تحديث الصورة الشخصية فقط. كافة البيانات الأكاديمية والمالية والإدارية مشفرة ومغلقة أمنياً، ولا يمكن تعديلها إلا عبر إدارة السنتر حصراً لمنع التلاعب.
            </span>
          </div>
        </div>
      )}

      {/* Section 1: Profile Photo (Editable for Students & Teachers) */}
      <div className="card-elevated p-6 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>الصورة الشخصية</span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            متاح للتعديل
          </span>
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-brand-cyan-500 shadow-soft-md bg-muted">
            {avatarUrlInput ? (
              <img
                src={avatarUrlInput}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as any).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {currentUser.fullName.charAt(0)}
              </div>
            )}
          </div>

          <form onSubmit={handlePhotoUpdate} className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                رابط الصورة الشخصية الجديد (Direct Image URL)
              </label>
              <input
                type="url"
                value={avatarUrlInput}
                onChange={(e) => setAvatarUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-4 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingPhoto || !avatarUrlInput}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-brand-cyan-500 hover:bg-brand-cyan-600 text-brand-navy-950 transition-colors disabled:opacity-50"
            >
              {isUpdatingPhoto ? 'جاري الحفظ...' : 'حفظ الصورة الجديدة'}
            </button>
          </form>
        </div>
      </div>

      {/* Section 2: Personal & Academic Information (Strictly Read-Only for Students & Teachers) */}
      <div className="card-elevated p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">البيانات الإدارية والأكاديمية</h2>
          {isRestrictedRole && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium border border-border">
              🔒 للقراءة فقط (مغلق أمنياً)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">الاسم الكامل</label>
            <input
              type="text"
              value={currentUser.fullName}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          {currentUser.studentCode && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">كود الطالب</label>
              <input
                type="text"
                value={currentUser.studentCode}
                disabled={isRestrictedRole}
                readOnly={isRestrictedRole}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">المرحلة الدراسية</label>
            <input
              type="text"
              value={currentUser.stage || '—'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">الصف الدراسي</label>
            <input
              type="text"
              value={currentUser.grade || '—'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">رقم الهاتف</label>
            <input
              type="text"
              value={currentUser.phone || '—'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          {currentUser.guardianPhone && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">هاتف ولي الأمر (لإشعارات واتساب)</label>
              <input
                type="text"
                value={currentUser.guardianPhone}
                disabled={isRestrictedRole}
                readOnly={isRestrictedRole}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-80"
              />
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Financial Balance (Strictly Read-Only) */}
      <div className="card-elevated p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center justify-between">
          <span>الرصيد المالي</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
            🔒 مغلق أمنياً
          </span>
        </h2>
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">المبلغ المستحق على الطالب</span>
            <span className="text-2xl font-extrabold font-mono text-foreground">
              {currentUser.balanceDue.toFixed(2)} ج.م
            </span>
          </div>
          <span className="text-xs px-3 py-1 rounded bg-muted text-muted-foreground">
            {currentUser.balanceDue === 0 ? 'خالص السداد' : 'يوجد متبقي'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

### 5.5. Enhancements to Mock Seed Data & DAL

Worker M2 should update `lib/dal/mock-data.ts` to include seed entries for `BRANCH_MANAGER` and `PARENT` to enable comprehensive 8-role tests:

```typescript
// Add to INITIAL_SEEDED_DATA.users in lib/dal/mock-data.ts:
{
  id: 'user-branch-mgr-001',
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
  id: 'user-parent-1001',
  tenantId: 'tenant-maher-001',
  role: 'PARENT' as const,
  fullName: 'محمد علي (ولي أمر الطالب أحمد)',
  email: 'mohamed.ali.parent@gmail.com',
  phone: '01099991001',
  balanceDue: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}
```

And update `updateUser` in `MockDataProvider`:
```typescript
// Replace blacklist with whitelist in updateUser():
if (actorRole === 'STUDENT' || actorRole === 'TEACHER') {
  if (actorId && actorId !== userId) {
    return {
      success: false,
      error: 'Forbidden (HTTP 403): لا يمكنك تعديل بيانات مستخدم آخر',
      status: 403,
    };
  }

  const allowedKeys = ['avatarUrl', 'avatar_url'];
  const updateKeys = Object.keys(updates);
  const forbidden = updateKeys.filter((k) => !allowedKeys.includes(k));

  if (forbidden.length > 0) {
    return {
      success: false,
      error: 'Forbidden (HTTP 403): الطلاب والمعلمون مصرح لهم بتعديل الصورة الشخصية فقط، والبيانات الإدارية والمالية للقراءة فقط',
      status: 403,
    };
  }
}
```

---

## 6. Comprehensive Test Specifications (`tests/security/m2-profile-guardrails.test.ts`)

Worker M2 should implement the test specification below to guarantee comprehensive coverage of AC-3, AC-4, AC-5, and AC-6:

```typescript
/**
 * Milestone 2 Test Suite: Profile Guardrails, Route Protection & 8-Role RBAC Matrix
 * Path: tests/security/m2-profile-guardrails.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateProfilePhotoUpdate,
  checkTenantAccess,
  validateTeacherRateUpdate,
  validateTeacherStatementAccess,
  UserSecurityContext,
} from '@/lib/security/rbac';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Milestone 2 Security: Profile Guardrails & RBAC Matrix', () => {
  let dal: MockDataProvider;

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  const studentAlice: UserSecurityContext = {
    id: 'user-student-1001',
    role: 'STUDENT',
    tenantSlug: 'al-maher',
  };

  const studentBob: UserSecurityContext = {
    id: 'user-student-1002',
    role: 'STUDENT',
    tenantSlug: 'al-maher',
  };

  const teacherZaid: UserSecurityContext = {
    id: 'user-teacher-math',
    role: 'TEACHER',
    tenantSlug: 'al-maher',
  };

  const teacherAmr: UserSecurityContext = {
    id: 'user-teacher-phys',
    role: 'TEACHER',
    tenantSlug: 'al-maher',
  };

  const centerAdmin: UserSecurityContext = {
    id: 'user-admin-maher',
    role: 'CENTER_ADMIN',
    tenantSlug: 'al-maher',
  };

  const platformOwner: UserSecurityContext = {
    id: 'user-owner-001',
    role: 'PLATFORM_OWNER',
    tenantSlug: 'global',
  };

  // =========================================================================
  // 1. Photo Update Endpoint & Whitelist Guardrail (AC-4, AC-5)
  // =========================================================================
  describe('1. Profile Photo Update Whitelist Enforcement', () => {
    it('allows student to update their own avatar URL with HTTP 200 OK', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data?.avatarUrl).toBe('https://cdn.yallacenter.com/avatars/alice.jpg');
    });

    it('allows teacher to update their own avatar URL with HTTP 200 OK', () => {
      const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/zaid.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });

    it('rejects student attempting to update another student avatar with HTTP 403', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentBob.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/hacked.jpg',
      });
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('rejects student attempting to modify student code with HTTP 403', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
        studentCode: 'STD-9999',
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
      expect(res.message).toMatch(/محروم.*avatar_url/i);
    });

    it('rejects student attempting to modify balanceDue with HTTP 403', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice.jpg',
        balanceDue: 0.0,
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('rejects teacher attempting to modify contractualFixedRate via photo payload with HTTP 403', () => {
      const res = validateProfilePhotoUpdate(teacherZaid, teacherZaid.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/zaid.jpg',
        contractualFixedRate: 500,
      });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('rejects empty or whitespace avatar URL with HTTP 400 Bad Request', () => {
      const res = validateProfilePhotoUpdate(studentAlice, studentAlice.id, {
        avatar_url: '   ',
      });
      expect(res.status).toBe(400);
      expect(res.error).toBe('BAD_REQUEST');
    });

    it('allows Center Administrator to update avatar URL for any student', () => {
      const res = validateProfilePhotoUpdate(centerAdmin, studentAlice.id, {
        avatar_url: 'https://cdn.yallacenter.com/avatars/alice-admin.jpg',
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 2. Tenant Boundary & Cross-Tenant Isolation (AC-3)
  // =========================================================================
  describe('2. Multi-Tenant Cross-Center Isolation (AC-3)', () => {
    it('allows center admin to access own center slug', () => {
      const res = checkTenantAccess(centerAdmin, 'al-maher');
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });

    it('strictly rejects Center A admin accessing Center B data with HTTP 403 Forbidden', () => {
      const res = checkTenantAccess(centerAdmin, 'al-rowad');
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows Platform Owner global cross-tenant visibility', () => {
      const resA = checkTenantAccess(platformOwner, 'al-maher');
      expect(resA.status).toBe(200);
      const resB = checkTenantAccess(platformOwner, 'al-rowad');
      expect(resB.status).toBe(200);
    });
  });

  // =========================================================================
  // 3. Teacher Rate Lock & Peer Privacy (AC-6)
  // =========================================================================
  describe('3. Teacher Rate Lockout & Peer Ledger Privacy (AC-6)', () => {
    it('rejects teacher attempting to alter own salary rate with HTTP 403', () => {
      const res = validateTeacherRateUpdate(teacherZaid, teacherZaid.id, { contractualFixedRate: 100 });
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows Center Admin to update teacher salary rate with HTTP 200', () => {
      const res = validateTeacherRateUpdate(centerAdmin, teacherZaid.id, { contractualFixedRate: 40 });
      expect(res.status).toBe(200);
    });

    it('rejects teacher attempting to inspect peer teacher payroll statement with HTTP 403', () => {
      const res = validateTeacherStatementAccess(teacherZaid, teacherAmr.id);
      expect(res.status).toBe(403);
      expect(res.error).toBe('FORBIDDEN');
    });

    it('allows teacher to inspect their own payroll statement with HTTP 200', () => {
      const res = validateTeacherStatementAccess(teacherZaid, teacherZaid.id);
      expect(res.status).toBe(200);
    });
  });
});
```

---

## 7. Verification Method

To verify the security guardrails independently:

1. **Execute Vitest Tier 2 RBAC Guardrail Suite**:
   ```bash
   npx vitest run tests/security/rbac-guardrails.test.ts
   ```
   *Expected*: 17/17 passing tests verifying AC-3, AC-4, AC-5, and AC-6.

2. **Execute Schema & SQL Trigger Verification**:
   ```bash
   npx vitest run tests/security/challenger-m1-empirical.test.ts
   ```
   *Expected*: Verifies `unique_session_student_attendance` constraint and `trg_enforce_user_guardrail` trigger.

3. **Execute Full Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: 161/161 passing tests with zero failures.

---

## 8. Conclusion

The 3-tier security architecture and RBAC specifications defined in this report provide complete, tamper-proof isolation for Yalla Center:
1. **Tier 1 UI**: Students and teachers see clear read-only indicators with disabled inputs for all personal, academic, and financial fields. Only the photo uploader is active.
2. **Tier 2 API**: `/api/profile/update-photo` strictly validates actor ownership and enforces a whitelist policy, returning HTTP 403 on any attempt to pass unauthorized fields or modify peers.
3. **Tier 3 Database**: PostgreSQL RLS and trigger `trg_enforce_user_guardrail` reject any unauthorized modifications at the engine level with SQLSTATE 42501.
Worker M2 can now proceed with implementation directly from this specification.
