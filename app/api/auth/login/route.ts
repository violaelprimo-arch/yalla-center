import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  hasPlatformOwnerClaim,
  verifyFirebaseIdToken,
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

function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec?: number } {
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

    const { identifier, password, idToken: googleIdToken } = body as {
      identifier?: string;
      password?: string;
      idToken?: string;
    };

    const dal = getDataProvider();
    const allTenants = await dal.getTenants();

    let uid: string;
    let authenticatedEmail: string;
    let displayName: string | undefined;
    let idToken: string;
    let rawClaims: Record<string, unknown> | undefined;
    let mappedTenantSlug: string | null = null;

    if (googleIdToken && typeof googleIdToken === 'string') {
      // Exchange verified Google Sign-In ID token for server session cookie
      const verified = await verifyFirebaseIdToken(googleIdToken);
      uid = verified.uid;
      authenticatedEmail = verified.email || '';
      displayName = verified.name;
      idToken = googleIdToken;
      rawClaims = verified.rawClaims;
    } else {
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

      let targetEmail = trimmedIdentifier.toLowerCase();

      if (targetEmail === 'owner') {
        targetEmail = 'owner@yallacenter.com';
      } else if (targetEmail === 'admin') {
        targetEmail = 'admin@yallacenter.com';
      } else if (!targetEmail.includes('@')) {
        const username = targetEmail;
        try {
          const store = await createServerFirestoreStore({ callerIdToken: '', requireServiceAccount: true });
          const usernameDoc = await store.getDocument<SystemUsernameDoc>(`system_usernames/${username}`);
          if (usernameDoc.exists && usernameDoc.data?.email) {
            targetEmail = usernameDoc.data.email;
            mappedTenantSlug = usernameDoc.data.tenantSlug || null;
          } else {
            const candidateTenant = allTenants[0]?.slug;
            if (!candidateTenant) {
              return reply({ error: 'تعذّر تحديد المركز لهذا الحساب. سجّل الدخول بالبريد الإلكتروني.' }, 400);
            }
            targetEmail = teacherPasswordEmail(candidateTenant, username);
          }
        } catch {
          const candidateTenant = allTenants[0]?.slug;
          if (!candidateTenant) {
            return reply({ error: 'تعذّر تحديد المركز لهذا الحساب. سجّل الدخول بالبريد الإلكتروني.' }, 400);
          }
          targetEmail = teacherPasswordEmail(candidateTenant, username);
        }
      }

      const apiKey =
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
        process.env.FIREBASE_API_KEY?.trim() ||
        DEFAULT_FIREBASE_WEB_CONFIG.apiKey;

      const signInWithEmail = async (loginTargetEmail: string) => {
        const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
        const authRes = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: loginTargetEmail,
            password,
            returnSecureToken: true,
          }),
        });
        const authData = (await authRes.json()) as {
          idToken?: string;
          localId?: string;
          email?: string;
          displayName?: string;
          error?: { message?: string };
        };
        return { authRes, authData };
      };

      let { authRes, authData } = await signInWithEmail(targetEmail);

      // Migrated teachers originally created under al-maher keep +al-maher in Firebase Auth
      const primaryCode = authData.error?.message || '';
      const candidateTenantSlug = allTenants[0]?.slug || '';
      if (
        (!authRes.ok || !authData.idToken) &&
        !trimmedIdentifier.includes('@') &&
        candidateTenantSlug === 'elmaher' &&
        targetEmail === teacherPasswordEmail('elmaher', trimmedIdentifier) &&
        (primaryCode.includes('INVALID_LOGIN_CREDENTIALS') || primaryCode.includes('EMAIL_NOT_FOUND'))
      ) {
        const legacyEmail = teacherPasswordEmail('al-maher', trimmedIdentifier);
        const legacyAttempt = await signInWithEmail(legacyEmail);
        if (legacyAttempt.authRes.ok && legacyAttempt.authData.idToken) {
          authRes = legacyAttempt.authRes;
          authData = legacyAttempt.authData;
          targetEmail = legacyEmail;
        }
      }

      if (!authRes.ok || !authData.idToken || !authData.localId) {
        const rawCode = authData.error?.message || 'INVALID_LOGIN_CREDENTIALS';
        const arabicMessage = getArabicAuthErrorMessage(rawCode, 'اسم المستخدم أو كلمة المرور غير صحيحة');
        const httpStatus = rawCode.includes('TOO_MANY_ATTEMPTS') ? 429 : 401;
        return reply({ error: arabicMessage }, httpStatus);
      }

      clearRateLimit(rateLimitKey);

      uid = authData.localId;
      authenticatedEmail = authData.email || targetEmail;
      displayName = authData.displayName;
      idToken = authData.idToken;
      const verified = await verifyFirebaseIdToken(idToken).catch(() => null);
      rawClaims = verified?.rawClaims;
    }

    // Read verified staff membership strictly from Firestore (NEVER auto-provision or trust email prefix!)
    let membership: StaffMembershipRecord | null = null;
    try {
      const store = await createServerFirestoreStore({ callerIdToken: idToken, requireServiceAccount: false });
      const doc = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
      if (doc.exists && doc.data?.isActive) {
        membership = doc.data;
      }
    } catch {
      membership = null;
    }

    const isOwnerClaim = hasPlatformOwnerClaim(rawClaims);
    const role = isOwnerClaim ? 'PLATFORM_OWNER' : membership?.role || 'STUDENT';

    let activeTenant = null;
    if (membership?.tenantId) {
      activeTenant = allTenants.find((t) => t.id === membership?.tenantId) || null;
    } else if (mappedTenantSlug) {
      activeTenant = allTenants.find((t) => t.slug === mappedTenantSlug) || null;
    } else if (role === 'PLATFORM_OWNER') {
      activeTenant = allTenants[0] || null;
    }

    if (role !== 'PLATFORM_OWNER' && !membership) {
      return reply(
        { error: 'هذا الحساب غير مفعل في صلاحيات أي مركز تعليمي. تواصل مع إدارة السنتر.' },
        403
      );
    }

    const tenantSlug = activeTenant?.slug || '';

    let defaultRedirectUrl = tenantSlug ? `/center/${tenantSlug}` : '/login';
    if (role === 'PLATFORM_OWNER') {
      defaultRedirectUrl = '/owner';
    } else if (!tenantSlug) {
      return reply({ error: 'الحساب غير مرتبط بمركز تعليمي نشط' }, 403);
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

    const isProd = process.env.NODE_ENV === 'production';
    const cookieMaxAge = 86400 * 7;
    const secureAttr = isProd ? '; Secure' : '';

    // Store ONLY the cryptographically verified Firebase ID token in an HttpOnly cookie.
    // Never rely on client-editable yc_role / yc_tenant / yc_user_id cookies for authorization.
    const cookieHeaders = [
      `yc_token=${idToken}; Path=/; Max-Age=${cookieMaxAge}; HttpOnly; SameSite=Lax${secureAttr}`,
      `yc_role=; Path=/; Max-Age=0; SameSite=Lax`,
      `yc_tenant=; Path=/; Max-Age=0; SameSite=Lax`,
      `yc_user_id=; Path=/; Max-Age=0; SameSite=Lax`,
    ];

    const response = NextResponse.json(
      {
        authenticated: true,
        idToken,
        user: {
          uid,
          email: authenticatedEmail,
          displayName: displayName || membership?.displayName || authenticatedEmail.split('@')[0],
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
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    cookieHeaders.forEach((c) => {
      response.headers.append('Set-Cookie', c);
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'تعذّر إتمام تسجيل الدخول';
    return reply({ error: msg }, 500);
  }
}
