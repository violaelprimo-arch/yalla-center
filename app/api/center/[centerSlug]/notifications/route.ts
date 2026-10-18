import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import { getNotificationQueueEngine } from '@/lib/notifications/queue';
import { renderNotificationContent } from '@/lib/notifications/formatter';

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const channelFilter = searchParams.get('channel');
    const statusFilter = searchParams.get('status');

    let logs = await dal.getNotificationLogs(tenant.id);

    // If tenant has no notifications in memory yet, seed realistic ones for presentation
    if (logs.length === 0) {
      const demoTemplates = [
        {
          recipientPhone: '+201001234567',
          channel: 'whatsapp' as const,
          templateName: 'student_attendance_ar',
          payload: {
            studentName: 'أحمد محمود علي',
            subject: 'الفيزياء الحديثة',
            time: '04:30 م',
            centerName: tenant.nameAr,
            balanceDue: 0,
          },
        },
        {
          recipientPhone: '+201009876543',
          channel: 'whatsapp' as const,
          templateName: 'student_attendance_ar',
          payload: {
            studentName: 'مريم خالد حسن',
            subject: 'التفاضل والتكامل',
            time: '05:00 م',
            centerName: tenant.nameAr,
            balanceDue: 150,
          },
        },
        {
          recipientPhone: 'fcm-device-guardian-003',
          channel: 'fcm' as const,
          templateName: 'exam_published_alert',
          payload: {
            examTitle: 'امتحان الفيزياء الشهري الشامل',
            link: `/center/${tenant.slug}/exams/runner/ex-101`,
            centerName: tenant.nameAr,
          },
        },
        {
          recipientPhone: '+201011223344',
          channel: 'whatsapp' as const,
          templateName: 'student_attendance_ar',
          payload: {
            studentName: 'كريم عادل إبراهيم',
            subject: 'الكيمياء العضوية',
            time: '06:00 م',
            centerName: tenant.nameAr,
            balanceDue: 0,
          },
        },
      ];

      for (const t of demoTemplates) {
        await dal.enqueueNotification({
          tenantId: tenant.id,
          recipientPhone: t.recipientPhone,
          channel: t.channel,
          templateName: t.templateName,
          payload: t.payload,
        });
      }
      logs = await dal.getNotificationLogs(tenant.id);
    }

    // Enrich logs with rendered content
    const enrichedLogs = logs.map((log) => ({
      ...log,
      renderedContent: renderNotificationContent(log.templateName, log.payload),
    }));

    // Apply filters if provided
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

    // Compute stats
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
      ).length || enrichedLogs.length,
    };

    return NextResponse.json({
      success: true,
      logs: filtered,
      stats,
    });
  } catch (err: unknown) {
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

    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Action 1: Flush queue
    if (action === 'flush_queue') {
      const queueEngine = getNotificationQueueEngine();
      const processed = queueEngine.processQueueSandbox();
      return NextResponse.json({
        success: true,
        message: 'تمت معالجة طابور الإرسال في وضع المحاكاة بنجاح',
        processedCount: processed.length,
      });
    }

    // Action 2: Send test alert
    const { recipientPhone, channel = 'whatsapp', templateName = 'student_attendance_ar', payload = {} } = body;
    const enqueued = await dal.enqueueNotification({
      tenantId: tenant.id,
      recipientPhone: recipientPhone || '+201001234567',
      channel,
      templateName,
      payload: {
        studentName: payload.studentName || 'طالب تجريبي',
        subject: payload.subject || 'فيزياء',
        time: new Date().toLocaleTimeString('ar-EG'),
        centerName: tenant.nameAr,
        balanceDue: Number(payload.balanceDue || 0),
        ...payload,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم إدراج الإشعار في الطابور بنجاح',
      notification: enqueued,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الإشعار';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
