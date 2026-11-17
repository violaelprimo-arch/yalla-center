import { NextRequest, NextResponse } from 'next/server';
import { createServerFirestoreStore } from '@/lib/firebase/server';
import { DEFAULT_FIREBASE_WEB_CONFIG } from '@/lib/firebase/client';
import { getDataProvider } from '@/lib/dal/factory';
import { teacherPasswordEmail } from '@/lib/teachers/profile';

export const dynamic = 'force-dynamic';

function reply(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

interface SystemUsernameDoc {
  username: string;
  email: string;
  tenantSlug?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return reply({ error: 'بيانات الطلب غير صالحة' }, 400);
    }

    const { identifier } = body as { identifier?: string };
    if (!identifier || typeof identifier !== 'string') {
      return reply({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' }, 400);
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();
    if (!trimmedIdentifier) {
      return reply({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' }, 400);
    }

    let targetEmail = trimmedIdentifier;

    if (!trimmedIdentifier.includes('@')) {
      const username = trimmedIdentifier;
      try {
        const store = await createServerFirestoreStore({ callerIdToken: '', requireServiceAccount: true });
        const usernameDoc = await store.getDocument<SystemUsernameDoc>(`system_usernames/${username}`);
        if (usernameDoc.exists && usernameDoc.data?.email) {
          targetEmail = usernameDoc.data.email;
        } else {
          const dal = getDataProvider();
          const allTenants = await dal.getTenants();
          const defaultTenant = allTenants.find((t) => t.slug === 'al-maher') || allTenants[0];
          targetEmail = teacherPasswordEmail(defaultTenant?.slug || 'al-maher', username);
        }
      } catch {
        targetEmail = `${username}@auth.yallacenter.com`;
      }
    }

    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
      process.env.FIREBASE_API_KEY?.trim() ||
      DEFAULT_FIREBASE_WEB_CONFIG.apiKey;

    const resetUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    await fetch(resetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: targetEmail,
      }),
    });

    // Always return safe ambiguous message to prevent account enumeration
    return reply({
      success: true,
      message: 'إذا كان هذا الحساب مسجلاً في المنصة، فستصلك رسالة إعادة ضبط كلمة المرور على البريد الإلكتروني المسجل.',
    });
  } catch {
    return reply({
      success: true,
      message: 'إذا كان هذا الحساب مسجلاً في المنصة، فستصلك رسالة إعادة ضبط كلمة المرور على البريد الإلكتروني المسجل.',
    });
  }
}
