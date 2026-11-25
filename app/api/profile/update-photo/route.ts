/**
 * Yalla Center - Guarded Profile Photo Upload Endpoint
 * Path: app/api/profile/update-photo/route.ts
 *
 * Dedicated endpoint enforcing strict whitelist mutation rules:
 * Students and teachers can ONLY update their own avatar URL.
 * Any attempt to alter administrative/financial attributes or peers returns HTTP 403 Forbidden.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { validateProfilePhotoUpdate, UserSecurityContext } from '@/lib/security/rbac';
import { UserRole } from '@/lib/dal/types';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  resolveVerifiedMembership,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let actorId: string;
    let actorRole: UserRole;
    let actorTenantSlug: string;
    let bearerToken: string | undefined;

    if (isCloudProductionMode()) {
      const token =
        extractBearerToken(request.headers.get('authorization')) ||
        request.cookies.get('yc_token')?.value ||
        '';
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'UNAUTHORIZED', message: 'يلزم تسجيل الدخول لتحديث الصورة الشخصية' },
          { status: 401 }
        );
      }
      const verified = await verifyFirebaseIdToken(token);
      const store = await createServerFirestoreStore({ callerIdToken: token });
      const membership = await resolveVerifiedMembership(store, verified.uid, verified.rawClaims);
      actorId = verified.uid;
      actorRole = (membership?.role || 'STUDENT') as UserRole;
      actorTenantSlug = membership?.tenantId || '';
      bearerToken = token;
    } else {
      actorId =
        request.headers.get('x-user-id') ||
        request.cookies.get('yc_user_id')?.value ||
        'user-student-1001';

      actorRole = (
        request.headers.get('x-user-role') ||
        request.cookies.get('yc_role')?.value ||
        'STUDENT'
      ) as UserRole;

      actorTenantSlug =
        request.headers.get('x-tenant-slug') ||
        request.cookies.get('yc_tenant')?.value ||
        '';
    }

    const actorContext: UserSecurityContext = {
      id: actorId,
      role: actorRole,
      tenantSlug: actorTenantSlug,
    };

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

    const dal = getDataProvider(bearerToken);
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
    if (err instanceof FirebaseAuthError) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: err.message }, { status: err.status });
    }
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
