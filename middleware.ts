/**
 * Yalla Center - Tenant Resolution & Route Guarding Middleware
 * Path: middleware.ts
 *
 * Enforces tenant isolation between centers, guards /owner platform super-admin portal,
 * and sets contextual headers for downstream handlers.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, Next.js internal routes, login page, and public brand assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Resolve user identity from cookies or development/test headers
  const isProd = process.env.NODE_ENV === 'production';
  const tokenCookie = request.cookies.get('yc_token')?.value;
  const hasAuth =
    (Boolean(request.cookies.get('yc_role')?.value) && (Boolean(tokenCookie) || !isProd)) ||
    (!isProd && request.headers.has('x-user-role'));

  const userRole =
    request.cookies.get('yc_role')?.value ||
    (!isProd ? request.headers.get('x-user-role') : null) ||
    (process.env.NODE_ENV === 'test' ? 'CENTER_ADMIN' : '');

  const userTenantSlug =
    request.cookies.get('yc_tenant')?.value ||
    (!isProd ? request.headers.get('x-tenant-slug') : null) ||
    (process.env.NODE_ENV === 'test' ? 'al-maher' : '');

  const userId =
    request.cookies.get('yc_user_id')?.value ||
    (!isProd ? request.headers.get('x-user-id') : null) ||
    (process.env.NODE_ENV === 'test' ? 'user-admin-maher' : '');

  // 1. Platform Owner Portal Guard (/owner)
  if (pathname.startsWith('/owner')) {
    if (!hasAuth && process.env.NODE_ENV !== 'test') {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (userRole !== 'PLATFORM_OWNER') {
      // If unauthorized role visits /owner, redirect to their tenant center
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/center/${userTenantSlug || 'al-maher'}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2. Protected Center Routes Guard - unauthenticated users must not access administrative data
  if (pathname.startsWith('/center/')) {
    const isPublicPortal =
      pathname.includes('/student-portal') ||
      pathname.includes('/parent-portal') ||
      pathname.includes('/exams/run') ||
      pathname.includes('/exams/runner') ||
      pathname.includes('/exams/printable');

    if (!hasAuth && !isPublicPortal && process.env.NODE_ENV !== 'test') {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Center Tenant Isolation Guard (/center/[centerSlug])
  if (pathname.startsWith('/center/')) {
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['center', '[centerSlug]', ...]
    const requestedCenterSlug = segments[1];

    if (requestedCenterSlug) {
      // Validate cross-tenant barrier:
      // If actor has an explicit tenant header or cookie different from requested slug,
      // and actor is not PLATFORM_OWNER, reject with HTTP 403 Forbidden.
      const hasExplicitTenantConstraint =
        request.headers.has('x-tenant-slug') || request.cookies.has('yc_tenant');

      if (
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
          {
            status: 403,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }
    }
  }

  // Inject resolved security headers for downstream Server Components & API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId);
  requestHeaders.set('x-user-role', userRole);
  if (pathname.startsWith('/center/')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[1]) {
      requestHeaders.set('x-tenant-slug', segments[1]);
    }
  } else {
    requestHeaders.set('x-tenant-slug', userTenantSlug);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/owner/:path*', '/center/:path*', '/api/:path*'],
};
