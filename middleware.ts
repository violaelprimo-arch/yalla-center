/**
 * Yalla Center - Tenant Resolution & Cryptographically Verified Route Guarding Middleware
 * Path: middleware.ts
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createServerFirestoreStore,
  extractBearerToken,
  hasPlatformOwnerClaim,
  verifyFirebaseIdToken,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';
import { getDataProvider } from '@/lib/dal/factory';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/version')
  ) {
    return NextResponse.next();
  }

  const isTestEnv = process.env.NODE_ENV === 'test';
  const requestHeaders = new Headers(request.headers);

  // Always strip client-spoofed authorization headers in non-test environments
  if (!isTestEnv) {
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-user-role');
    requestHeaders.delete('x-tenant-slug');
  }

  if (isTestEnv) {
    const userRole =
      request.cookies.get('yc_role')?.value ||
      request.headers.get('x-user-role') ||
      'CENTER_ADMIN';
    const userTenantSlug =
      request.cookies.get('yc_tenant')?.value ||
      request.headers.get('x-tenant-slug') ||
      'al-maher';
    const userId =
      request.cookies.get('yc_user_id')?.value ||
      request.headers.get('x-user-id') ||
      'user-admin-maher';

    if (pathname.startsWith('/owner') && userRole !== 'PLATFORM_OWNER') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/center/${userTenantSlug || 'al-maher'}`;
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith('/center/')) {
      const segments = pathname.split('/').filter(Boolean);
      const requestedCenterSlug = segments[1];
      const hasExplicitTenantConstraint =
        request.headers.has('x-tenant-slug') || request.cookies.has('yc_tenant');
      if (
        requestedCenterSlug &&
        hasExplicitTenantConstraint &&
        userRole !== 'PLATFORM_OWNER' &&
        userTenantSlug !== requestedCenterSlug
      ) {
        return new NextResponse(
          JSON.stringify({
            error: 'FORBIDDEN',
            status: 403,
            message: 'Cross-tenant access rejected: غير مصرح لك بالدخول إلى بيانات هذا السنتر',
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
    }

    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set(
      'x-tenant-slug',
      pathname.startsWith('/center/') ? pathname.split('/').filter(Boolean)[1] || userTenantSlug : userTenantSlug
    );
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Production / Staging: NEVER trust client-editable yc_role / yc_tenant / yc_user_id cookies.
  // Verify cryptographic Firebase ID token from HttpOnly yc_token cookie or Bearer header.
  const isOwnerRoute = pathname.startsWith('/owner');
  const isCenterRoute = pathname.startsWith('/center/');
  const isPublicPortal =
    pathname.includes('/student-portal') ||
    pathname.includes('/parent-portal') ||
    pathname.includes('/exams/run') ||
    pathname.includes('/exams/runner') ||
    pathname.includes('/exams/printable');

  if (!isOwnerRoute && (!isCenterRoute || isPublicPortal)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const rawToken =
    extractBearerToken(request.headers.get('authorization')) ||
    request.cookies.get('yc_token')?.value ||
    '';

  if (!rawToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const verified = await verifyFirebaseIdToken(rawToken);
    const store = await createServerFirestoreStore({ callerIdToken: rawToken });

    let membership: StaffMembershipRecord | null = null;
    try {
      const fetched = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${verified.uid}`);
      if (fetched.exists && fetched.data?.isActive) {
        membership = fetched.data;
      }
    } catch {
      membership = null;
    }

    const isOwner = hasPlatformOwnerClaim(verified.rawClaims) || membership?.role === 'PLATFORM_OWNER';
    const verifiedRole = isOwner ? 'PLATFORM_OWNER' : membership?.role || '';

    if (!verifiedRole) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isOwnerRoute && verifiedRole !== 'PLATFORM_OWNER') {
      const dal = getDataProvider(rawToken);
      const memberTenant = membership?.tenantId ? await dal.getTenantById(membership.tenantId).catch(() => null) : null;
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = memberTenant?.slug ? `/center/${memberTenant.slug}` : '/login';
      return NextResponse.redirect(redirectUrl);
    }

    if (isCenterRoute && !isPublicPortal && !isOwner) {
      const segments = pathname.split('/').filter(Boolean);
      const requestedCenterSlug = segments[1];
      if (requestedCenterSlug) {
        const dal = getDataProvider(rawToken);
        const requestedTenant = await dal.getTenantBySlug(requestedCenterSlug).catch(() => null);
        if (!requestedTenant || membership?.tenantId !== requestedTenant.id) {
          return new NextResponse(
            JSON.stringify({
              error: 'FORBIDDEN',
              status: 403,
              message: 'Cross-tenant access rejected: غير مصرح لك بالدخول إلى بيانات هذا السنتر',
            }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          );
        }
      }
    }

    requestHeaders.set('x-user-id', verified.uid);
    requestHeaders.set('x-user-role', verifiedRole);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/owner/:path*', '/center/:path*', '/api/:path*'],
};
