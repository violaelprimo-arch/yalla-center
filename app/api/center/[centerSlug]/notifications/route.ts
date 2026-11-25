import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { getNotificationQueueEngine } from '@/lib/notifications/queue';
import { renderNotificationContent } from '@/lib/notifications/formatter';
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

async function authorizeNotificationAccess(
  req: NextRequest,
  centerSlug: string,
  allowedRoles?: string[]
) {
  const bearer = extractBearerToken(req.headers.get('authorization'));
  const dal = getDataProvider(bearer ?? undefined);
  const tenant = await dal.getTenantBySlug(centerSlug);
  if (!tenant) {
    return { error: NextResponse.json({ success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' }, { status: 404 }) };
  }

  if (isCloudProductionMode() || bearer) {
    if (!bearer) {
      return { error: NextResponse.json({ success: false, error: 'سجّل الدخول للمتابعة' }, { status: 401 }) };
    }
    const { uid } = await verifyFirebaseIdToken(bearer);
    const store = await createServerFirestoreStore({ callerIdToken: bearer });
    await authorizeStaffMember(store, uid, tenant.id, allowedRoles);
  }

  return { dal, tenant };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const auth = await authorizeNotificationAccess(req, centerSlug);
    if ('error' in auth && auth.error) return auth.error;
    const { dal, tenant } = auth;

    const { searchParams } = new URL(req.url);
    const channelFilter = searchParams.get('channel');
    const statusFilter = searchParams.get('status');

    // Read-only: return actual notifications (empty array if none exist; never auto-seed fake records)
    const logs = await dal.getNotificationLogs(tenant.id);

    const enrichedLogs = logs.map((log) => ({
      ...log,
      renderedContent: renderNotificationContent(log.templateName, log.payload),
    }));

    let filtered = enrichedLogs;
    if (channelFilter && channelFilter !== 'all') {
      filtered = filtered.filter(
        (l) => l.channel.toLowerCase() === channelFilter.toLowerCase()
      );
    }
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((l) => {
        const s = l.status.toLowerCase();
        const f = statusFilter.toLowerCase();
        if (f === 'pending') return s === 'queued' || s === 'pending';
        if (f === 'sent') return s === 'sent' || s === 'delivered' || s === 'simulated_delivered';
        if (f === 'failed') return s === 'failed';
        return s === f;
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const stats = {
      total: enrichedLogs.length,
      pending: enrichedLogs.filter(
        (l) => l.status.toLowerCase() === 'queued' || l.status.toLowerCase() === 'pending'
      ).length,
      sent: enrichedLogs.filter(
        (l) =>
          l.status.toLowerCase() === 'delivered' ||
          l.status.toLowerCase() === 'sent' ||
          l.status.toLowerCase() === 'simulated_delivered'
      ).length,
      failed: enrichedLogs.filter((l) => l.status.toLowerCase() === 'failed').length,
      todayTotal: enrichedLogs.filter(
        (l) => l.scheduledAt && l.scheduledAt.startsWith(today)
      ).length,
    };

    return NextResponse.json({
      success: true,
      logs: filtered,
      stats,
    });
  } catch (err: unknown) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'تعذر تحميل سجل الإشعارات';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const auth = await authorizeNotificationAccess(req, centerSlug, [
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'PLATFORM_OWNER',
    ]);
    if ('error' in auth && auth.error) return auth.error;
    const { dal, tenant } = auth;

    const body = await req.json();
    const { action } = body;

    if (action === 'flush_queue') {
      const queueEngine = getNotificationQueueEngine();
      const processed = queueEngine.processQueueSandbox();
      return NextResponse.json({
        success: true,
        message: 'تمت معالجة طابور الإرسال بنجاح',
        processedCount: processed.length,
      });
    }

    const { recipientPhone, channel = 'whatsapp', templateName = 'student_attendance_ar', payload = {} } = body;
    if (!recipientPhone) {
      return NextResponse.json({ success: false, error: 'رقم المستلم مطلوب' }, { status: 400 });
    }
    const enqueued = await dal.enqueueNotification({
      tenantId: tenant.id,
      recipientPhone,
      channel,
      templateName,
      payload: {
        ...payload,
        centerName: tenant.nameAr,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم إدراج الإشعار في الطابور بنجاح',
      notification: enqueued,
    });
  } catch (err: unknown) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الإشعار';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
