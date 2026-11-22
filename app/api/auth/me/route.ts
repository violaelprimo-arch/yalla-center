import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
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

const PLATFORM_OWNER_EMAILS = [
  'owner@yallacenter.com',
  'admin@yallacenter.com',
  'islam@yallacenter.com',
  'fathyelprimo@gmail.com',
  'zizo.infinity@gmail.com',
];

export async function GET(req: NextRequest) {
  try {
    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (!bearer) {
      return reply({
        authenticated: false,
        message: 'غير مسجل الدخول',
      });
    }

    const verified = await verifyFirebaseIdToken(bearer);
    const { uid, email = '', name = '' } = verified;

    const dal = getDataProvider();
    const allTenants = await dal.getTenants();
    const defaultTenant = allTenants.find((t) => t.slug === 'al-maher') || allTenants[0];

    const isPlatformOwner =
      PLATFORM_OWNER_EMAILS.includes(email.toLowerCase()) ||
      email.toLowerCase().startsWith('owner@');

    // Query Firestore for staff membership
    let membership: StaffMembershipRecord | null = null;
    try {
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      const doc = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
      if (doc.exists && doc.data) {
        membership = doc.data;
      }
    } catch {
      // If Firestore lookup fails or table empty, fallback gracefully
    }

    // Determine Role
    let role = membership?.role || (isPlatformOwner ? 'PLATFORM_OWNER' : 'CENTER_ADMIN');
    if (isPlatformOwner) {
      role = 'PLATFORM_OWNER';
    }

    // Determine Tenant
    let activeTenant = defaultTenant;
    if (membership?.tenantId) {
      const found = allTenants.find((t) => t.id === membership?.tenantId);
      if (found) activeTenant = found;
    }

    // Compute redirect destination
    const tenantSlug = activeTenant?.slug || 'al-maher';
    let defaultRedirectUrl = `/center/${tenantSlug}`;
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
        displayName: name || email.split('@')[0] || 'مستخدم يلا سنتر',
        role,
      },
      tenant: {
        id: activeTenant.id,
        slug: activeTenant.slug,
        nameAr: activeTenant.nameAr,
      },
      availableTenants: allTenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        nameAr: t.nameAr,
        role,
      })),
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
