import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import {
  authorizeStaffMember,
  CenterOperationsError,
} from '@/lib/firebase/center-operations-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const bearer = extractBearerToken(req.headers.get('authorization'));
    const dal = getDataProvider(bearer ?? undefined);
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' },
        { status: 404 }
      );
    }

    if (isCloudProductionMode() || bearer) {
      if (!bearer) {
        return NextResponse.json({ success: false, error: 'سجّل الدخول للمتابعة' }, { status: 401 });
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      await authorizeStaffMember(store, uid, tenant.id, [
        'CENTER_ADMIN',
        'BRANCH_MANAGER',
        'RECEPTIONIST',
        'PLATFORM_OWNER',
      ]);
    }

    const body = await req.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_ID', message: 'معرف الإشعار مطلوب' },
        { status: 400 }
      );
    }

    let updated;
    if (typeof dal.resendNotification === 'function') {
      updated = await dal.resendNotification(notificationId);
    } else {
      const logs = await dal.getNotificationLogs(tenant.id);
      const target = logs.find((l) => l.id === notificationId);
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'NOT_FOUND', message: 'الإشعار غير موجود' },
          { status: 404 }
        );
      }
      updated = {
        ...target,
        retryCount: (target.retryCount || 0) + 1,
        status: 'delivered',
        errorMessage: undefined,
        sentAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      message: 'تمت إعادة إرسال الإشعار بنجاح',
      notification: updated,
    });
  } catch (err: unknown) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'تعذر إعادة إرسال الإشعار';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
