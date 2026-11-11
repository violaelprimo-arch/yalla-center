import { NextRequest, NextResponse } from 'next/server';
import {
  importReviewedLocalStorageGrades,
  mapServiceErrorToHttp,
  resolveAuthorizedStaffActor,
  type LocalImportCandidateInput,
} from '@/lib/firebase/lesson-scores-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const { centerSlug } = await Promise.resolve(context.params);
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      throw new FirebaseAuthError(
        401,
        'يلزم تسجيل الدخول بحساب Firebase موثق لاستيراد الدرجات إلى Firestore'
      );
    }

    const body = (await request.json()) as { items?: LocalImportCandidateInput[] };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMPTY_IMPORT_ITEMS',
          message: 'يرجى تحديد درجة واحدة على الأقل للاستيراد بعد المراجعة',
        },
        { status: 400 }
      );
    }

    const verifiedToken = await verifyFirebaseIdToken(token);
    const store = await createServerFirestoreStore({ callerIdToken: token });
    const actor = await resolveAuthorizedStaffActor({
      centerSlug,
      verifiedToken,
      store,
    });

    const summary = await importReviewedLocalStorageGrades({
      actor,
      items: body.items,
      store,
    });

    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    const mapped = mapServiceErrorToHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
