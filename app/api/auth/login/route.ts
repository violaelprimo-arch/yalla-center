import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  getFirebaseProjectId,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';
import { getArabicAuthErrorMessage } from '@/lib/firebase/errors';
import { DEFAULT_FIREBASE_WEB_CONFIG } from '@/lib/firebase/client';
import { teacherPasswordEmail } from '@/lib/teachers/profile';

export const dynamic = 'force-dynamic';

function reply(body: object, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

// In-memory sliding rate limiter per IP/identifier
interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string, maxAttempts = 5, windowMs = 60_000): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = rateLimitMap.get(key);

  if (!bucket || bucket.resetAtMs <= now) {
    rateLimitMap.set(key, { count: 1, resetAtMs: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((bucket.resetAtMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true };
}

function clearRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

const PLATFORM_OWNER_EMAILS = [
  'owner@yallacenter.com',
  'admin@yallacenter.com',
  'islam@yallacenter.com',
  'fathyelprimo@gmail.com',
  'zizo.infinity@gmail.com',
];

interface SystemUsernameDoc {
  username: string;
  email: string;
  uid?: string;
  tenantId?: string;
  tenantSlug?: string;
  teacherId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return reply({ error: 'بيانات الطلب غير صالحة' }, 400);
    }

    const { identifier, password } = body as { identifier?: string; password?: string };
    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      return reply({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور' }, 400);
    }

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      return reply({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور' }, 400);
    }

    // Rate Limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown-ip';
    const rateLimitKey = `${ip}:${trimmedIdentifier.toLowerCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return reply(
        { error: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول. يرجى الانتظار قليلاً والمحاولة لاحقاً.' },
        429,
        { 'Retry-After': String(rateCheck.retryAfterSec || 60) }
      );
    }

    const dal = getDataProvider();
    const allTenants = await dal.getTenants();
    const defaultTenant = allTenants.find((t) => t.slug === 'al-maher') || allTenants[0];

    // Identity Resolution: Username vs Email
    let targetEmail = trimmedIdentifier.toLowerCase();
    let mappedTenantSlug: string | null = null;

    if (targetEmail === 'owner') {
      targetEmail = 'owner@yallacenter.com';
    } else if (targetEmail === 'admin') {
      targetEmail = 'admin@yallacenter.com';
    } else if (!targetEmail.includes('@')) {
      const username = targetEmail;
      // Look up global username mapping in Firestore
      try {
        const store = await createServerFirestoreStore({ callerIdToken: '', requireServiceAccount: true });
        const usernameDoc = await store.getDocument<SystemUsernameDoc>(`system_usernames/${username}`);
        if (usernameDoc.exists && usernameDoc.data?.email) {
          targetEmail = usernameDoc.data.email;
          mappedTenantSlug = usernameDoc.data.tenantSlug || null;
        } else {
          // Check standard center tenant slug fallback
          const candidateTenant = defaultTenant?.slug || 'al-maher';
          targetEmail = teacherPasswordEmail(candidateTenant, username);
        }
      } catch {
        // Fallback to standard deterministic email
        const candidateTenant = defaultTenant?.slug || 'al-maher';
        targetEmail = teacherPasswordEmail(candidateTenant, username);
      }
    }

    // Official Identity Toolkit Sign-In API
    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
      process.env.FIREBASE_API_KEY?.trim() ||
      DEFAULT_FIREBASE_WEB_CONFIG.apiKey;

    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail,
        password,
        returnSecureToken: true,
      }),
    });

    const authData = (await authRes.json()) as {
      idToken?: string;
      refreshToken?: string;
      expiresIn?: string;
      localId?: string;
      email?: string;
      displayName?: string;
      error?: { message?: string };
    };

    if (!authRes.ok || !authData.idToken || !authData.localId) {
      const rawCode = authData.error?.message || 'INVALID_LOGIN_CREDENTIALS';
      const arabicMessage = getArabicAuthErrorMessage(rawCode, 'اسم المستخدم أو كلمة المرور غير صحيحة');
      const httpStatus = rawCode.includes('TOO_MANY_ATTEMPTS') ? 429 : 401;
      return reply({ error: arabicMessage }, httpStatus);
    }

    // Reset rate limiter on successful login
    clearRateLimit(rateLimitKey);

    const uid = authData.localId;
    const authenticatedEmail = authData.email || targetEmail;
    const idToken = authData.idToken;

    // Check Platform Owner against explicit authorized list
    const isPlatformOwner = PLATFORM_OWNER_EMAILS.includes(authenticatedEmail.toLowerCase().trim());

    // Query Firestore for staff membership
    let membership: StaffMembershipRecord | null = null;
    try {
      const store = await createServerFirestoreStore({ callerIdToken: idToken, requireServiceAccount: true });
      const doc = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
      if (doc.exists && doc.data) {
        membership = doc.data;
      }
    } catch {
      // Graceful fallback if Firestore lookup fails
    }

    // Determine Role strictly without privilege escalation
    let role: string;
    if (isPlatformOwner) {
      role = 'PLATFORM_OWNER';
    } else if (membership?.role) {
      role = membership.role;
    } else if (mappedTenantSlug && targetEmail.includes('@teachers.yallacenter.com')) {
      role = 'TEACHER';
    } else {
      // Default to STUDENT role rather than administrative access
      role = 'STUDENT';
    }

    // Determine Active Tenant
    let activeTenant = defaultTenant;
    if (membership?.tenantId) {
      const found = allTenants.find((t) => t.id === membership?.tenantId);
      if (found) activeTenant = found;
    } else if (mappedTenantSlug) {
      const found = allTenants.find((t) => t.slug === mappedTenantSlug);
      if (found) activeTenant = found;
    }

    const tenantSlug = activeTenant?.slug || 'al-maher';

    // Compute verified portal redirect URL
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

    const cookieMaxAge = 86400 * 7; // 7 days
    const cookieHeaders = [
      `yc_role=${role}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
      `yc_tenant=${tenantSlug}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
      `yc_user_id=${uid}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
      `yc_token=${idToken}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
    ];

    const response = NextResponse.json(
      {
        authenticated: true,
        idToken,
        user: {
          uid,
          email: authenticatedEmail,
          displayName: authData.displayName || membership?.displayName || authenticatedEmail.split('@')[0],
          role,
        },
        tenant: activeTenant
          ? {
              id: activeTenant.id,
              slug: activeTenant.slug,
              nameAr: activeTenant.nameAr,
            }
          : null,
        defaultRedirectUrl,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    // Set cookies
    cookieHeaders.forEach((c) => {
      response.headers.append('Set-Cookie', c);
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'تعذّر إتمام تسجيل الدخول';
    return reply({ error: msg }, 500);
  }
}
