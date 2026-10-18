/**
 * Yalla Center - Guarded Profile Photo Upload Endpoint
 * Path: app/api/profile/update-photo/route.ts
 *
 * Dedicated endpoint enforcing strict whitelist mutation rules:
 * Students and teachers can ONLY update their own avatar URL.
 * Any attempt to alter administrative/financial attributes or peers returns HTTP 403 Forbidden.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal';
import { validateProfilePhotoUpdate, UserSecurityContext } from '@/lib/security/rbac';
import { UserRole } from '@/lib/dal/types';

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve Actor Context from Request Headers or Cookies
    const actorId =
      request.headers.get('x-user-id') ||
      request.cookies.get('yc_user_id')?.value ||
      'user-student-1001';

    const actorRole = (
      request.headers.get('x-user-role') ||
      request.cookies.get('yc_role')?.value ||
      'STUDENT'
    ) as UserRole;

    const actorTenantSlug =
      request.headers.get('x-tenant-slug') ||
      request.cookies.get('yc_tenant')?.value ||
      'al-maher';

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
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'تنسيق الطلب غير صالح (JSON مطلوب)',
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'محتوى الطلب غير صالح',
        },
        { status: 400 }
      );
    }

    const targetUserId = body.userId || body.targetUserId || actorId;

    // 3. Enforce Strict RBAC & Whitelist Guardrail (AC-4, AC-5)
    const guardResult = validateProfilePhotoUpdate(actorContext, targetUserId, body);
    if (!guardResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: guardResult.error,
          message: guardResult.message,
        },
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
        {
          success: false,
          error: dalResult.error || 'فشل تحديث الصورة الشخصية',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: dalResult.data,
        message: 'تم تحديث الصورة الشخصية بنجاح',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: err?.message || 'حدث خطأ غير متوقع في الخادم',
      },
      { status: 500 }
    );
  }
}
