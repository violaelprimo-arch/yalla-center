import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  hasPlatformOwnerClaim,
  verifyFirebaseIdToken,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

function reply(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (!bearer) {
      return reply({
        authenticated: false,
        message: 'غير مسجل الدخول',
      }, 401);
    }

    const verified = await verifyFirebaseIdToken(bearer);
    const { uid, email = '', name = '', rawClaims } = verified;

    const dal = getDataProvider(bearer);
    const allTenants = await dal.getTenants();

    // Query Firestore strictly for existing active membership (NO auto-provisioning, NO email prefix fallback!)
    let membership: StaffMembershipRecord | null = null;
    try {
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      const doc = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
      if (doc.exists && doc.data?.isActive) {
        membership = doc.data;
      }
    } catch {
      membership = null;
    }

    const isOwnerClaim = hasPlatformOwnerClaim(rawClaims);
    if (!isOwnerClaim && !membership) {
      return reply(
        {
          authenticated: false,
          error: 'الحساب غير مفعل في صلاحيات أي مركز تعليمي. تواصل مع الإدارة لتفعيل الصلاحية.',
        },
        403
      );
    }

    const role = isOwnerClaim ? 'PLATFORM_OWNER' : membership!.role;
    const activeTenant = membership?.tenantId
      ? allTenants.find((t) => t.id === membership.tenantId) || null
      : role === 'PLATFORM_OWNER'
        ? allTenants[0] || null
        : null;

    if (role !== 'PLATFORM_OWNER' && !activeTenant) {
      return reply(
        {
          authenticated: false,
          error: 'المركز التعليمي المرتبط بهذا الحساب غير موجود أو غير مفعّل.',
        },
        403
      );
    }

    const tenantSlug = activeTenant?.slug || '';
    let defaultRedirectUrl = tenantSlug ? `/center/${tenantSlug}` : '/owner';
    if (role === 'PLATFORM_OWNER') {
      defaultRedirectUrl = '/owner';
    } else if (role === 'TEACHER') {
      defaultRedirectUrl = `/teacher/${tenantSlug}`;
    } else if (role === 'CENTER_ADMIN') {
      defaultRedirectUrl = `/center/${tenantSlug}`;
    } else if (role === 'BRANCH_MANAGER') {
      defaultRedirectUrl = `/center/${tenantSlug}/branch`;
    } else if (role === 'ACCOUNTANT') {
      defaultRedirectUrl = `/center/${tenantSlug}/finance`;
    } else if (role === 'RECEPTIONIST') {
      defaultRedirectUrl = `/center/${tenantSlug}/reception`;
    } else if (role === 'STUDENT') {
      defaultRedirectUrl = `/center/${tenantSlug}/student-portal`;
    } else if (role === 'PARENT') {
      defaultRedirectUrl = `/center/${tenantSlug}/parent-portal`;
    }

    return reply({
      authenticated: true,
      user: {
        uid,
        email,
        displayName: name || membership?.displayName || email.split('@')[0] || 'مستخدم يلا سنتر',
        role,
      },
      tenant: activeTenant
        ? {
            id: activeTenant.id,
            slug: activeTenant.slug,
            nameAr: activeTenant.nameAr,
          }
        : null,
      availableTenants:
        role === 'PLATFORM_OWNER'
          ? allTenants.map((t) => ({ id: t.id, slug: t.slug, nameAr: t.nameAr, role }))
          : activeTenant
            ? [{ id: activeTenant.id, slug: activeTenant.slug, nameAr: activeTenant.nameAr, role }]
            : [],
      defaultRedirectUrl,
    });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ authenticated: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر التحقق من الجلسة';
    return reply({ authenticated: false, error: message }, 500);
  }
}
