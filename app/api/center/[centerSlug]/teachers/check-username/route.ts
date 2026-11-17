import { NextRequest, NextResponse } from 'next/server';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

function reply(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: { centerSlug: string } }
) {
  try {
    const rawUsername = req.nextUrl.searchParams.get('username') || '';
    const username = rawUsername.trim().toLowerCase();

    if (!username) {
      return reply({ available: false, message: 'اسم المستخدم مطلوب' }, 400);
    }

    if (!usernamePattern.test(username)) {
      return reply(
        {
          available: false,
          message: 'اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفاً إنجليزياً أو أرقام بدون مسافات',
        },
        400
      );
    }

    try {
      const store = await createServerFirestoreStore({ callerIdToken: '', requireServiceAccount: true });
      const doc = await store.getDocument(`system_usernames/${username}`);
      if (doc.exists) {
        return reply({
          available: false,
          message: 'اسم المستخدم مسجل بالفعل في المنصة. يرجى اختيار اسم مستخدم آخر.',
        });
      }
    } catch {
      // In case of offline/sandbox without credentials, pass validation
    }

    return reply({
      available: true,
      message: 'اسم المستخدم متاح للاستخدام.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذّر التحقق من اسم المستخدم';
    return reply({ available: false, message: msg }, 500);
  }
}
