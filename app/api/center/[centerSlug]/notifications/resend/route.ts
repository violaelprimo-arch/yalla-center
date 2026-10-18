import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' },
        { status: 404 }
      );
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
      target.retryCount = (target.retryCount || 0) + 1;
      target.status = 'delivered';
      target.errorMessage = undefined;
      target.sentAt = new Date().toISOString();
      updated = target;
    }

    return NextResponse.json({
      success: true,
      message: 'تمت إعادة إرسال الإشعار بنجاح',
      notification: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'تعذر إعادة إرسال الإشعار';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
