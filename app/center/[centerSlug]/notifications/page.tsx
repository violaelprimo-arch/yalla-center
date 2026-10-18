'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  RefreshCw,
  Send,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  MessageSquare,
  Smartphone,
  Copy,
  Check,
  CheckCheck,
  Eye,
  X,
  Play,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  renderNotificationContent,
} from '@/lib/notifications/formatter';

interface NotificationItem {
  id: string;
  tenantId: string;
  recipientPhone: string;
  recipientUserId?: string;
  channel: string;
  templateName: string;
  payload: Record<string, any>;
  status: string;
  retryCount: number;
  errorMessage?: string;
  scheduledAt: string;
  sentAt?: string;
  renderedContent?: string;
}

interface StatsData {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  todayTotal: number;
}

export default function NotificationsPage() {
  const { tenant } = useTenant();

  const [logs, setLogs] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    todayTotal: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inspector Modal State
  const [inspectItem, setInspectItem] = useState<NotificationItem | null>(null);
  const [hasCopiedJson, setHasCopiedJson] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Fetch Notifications from Endpoint
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/center/${tenant.slug}/notifications`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
      }
    } catch {
      // transient fetch error
    } finally {
      setIsLoading(false);
    }
  }, [tenant.slug]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle Flush Queue Action
  const handleFlushQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const res = await fetch(`/api/center/${tenant.slug}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flush_queue' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMessage('تمت معالجة طابور الإرسال في وضع المحاكاة بنجاح');
        setTimeout(() => setActionSuccessMessage(null), 3500);
        await fetchNotifications();
      }
    } catch {
      // handle error
    } finally {
      setIsProcessingQueue(false);
    }
  };

  // Handle Resend Notification Action
  const handleResend = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/center/${tenant.slug}/notifications/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMessage('تمت إعادة إرسال الإشعار بنجاح');
        setTimeout(() => setActionSuccessMessage(null), 3000);

        // Update local state immediately
        setLogs((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  status: 'delivered',
                  errorMessage: undefined,
                  retryCount: (item.retryCount || 0) + 1,
                  sentAt: new Date().toISOString(),
                }
              : item
          )
        );

        if (inspectItem && inspectItem.id === notificationId) {
          setInspectItem((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'delivered',
                  errorMessage: undefined,
                  retryCount: (prev.retryCount || 0) + 1,
                  sentAt: new Date().toISOString(),
                }
              : null
          );
        }

        fetchNotifications();
      }
    } catch {
      // handle error
    }
  };

  // Filtered Notifications List
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Channel Filter
      if (selectedChannel !== 'ALL') {
        if (log.channel.toUpperCase() !== selectedChannel.toUpperCase()) return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL') {
        const s = log.status.toUpperCase();
        if (selectedStatus === 'PENDING' && s !== 'QUEUED' && s !== 'PENDING') return false;
        if (
          selectedStatus === 'SENT' &&
          s !== 'DELIVERED' &&
          s !== 'SENT' &&
          s !== 'SIMULATED_DELIVERED'
        ) {
          return false;
        }
        if (selectedStatus === 'FAILED' && s !== 'FAILED') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const phone = (log.recipientPhone || '').toLowerCase();
        const template = (log.templateName || '').toLowerCase();
        const studentName = (log.payload?.studentName || '').toLowerCase();
        const rendered = (
          log.renderedContent || renderNotificationContent(log.templateName, log.payload)
        ).toLowerCase();

        return (
          phone.includes(query) ||
          template.includes(query) ||
          studentName.includes(query) ||
          rendered.includes(query)
        );
      }

      return true;
    });
  }, [logs, selectedChannel, selectedStatus, searchQuery]);

  const copyPayloadJson = (payload: Record<string, any>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setHasCopiedJson(true);
    setTimeout(() => setHasCopiedJson(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'DELIVERED' || s === 'SENT' || s === 'SIMULATED_DELIVERED') {
      return (
        <Badge variant="success" className="gap-1 font-bold">
          <CheckCheck className="w-3.5 h-3.5" />
          <span>تم التسليم</span>
        </Badge>
      );
    }
    if (s === 'FAILED') {
      return (
        <Badge variant="destructive" className="gap-1 font-bold">
          <XCircle className="w-3.5 h-3.5" />
          <span>فشل الإرسال</span>
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="gap-1 font-bold">
        <Clock className="w-3.5 h-3.5" />
        <span>قيد الانتظار</span>
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    const c = channel.toUpperCase();
    if (c === 'WHATSAPP') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>واتساب WhatsApp</span>
        </span>
      );
    }
    if (c === 'FCM') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-cyan-500/15 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/30">
          <Smartphone className="w-3.5 h-3.5" />
          <span>ويب بوش FCM</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-muted text-foreground border border-border">
        <span>رسائل SMS</span>
      </span>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
              <Bell className="w-8 h-8 text-brand-cyan-500" />
              <span>مركز الإشعارات والواتساب</span>
            </h1>
            <Badge variant="cyan" className="font-bold">
              Sub-20ms Queue
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            طابور إرسال غير حاجب لرسائل أولياء الأمور عبر Meta WhatsApp Cloud API وFirebase Cloud Messaging لـ {tenant.nameAr}.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="cyan"
            size="sm"
            disabled={isProcessingQueue}
            onClick={handleFlushQueue}
            className="h-10 text-xs gap-1.5 shadow-md"
          >
            <Play className="w-4 h-4" />
            <span>{isProcessingQueue ? 'جاري المعالجة...' : 'معالجة الطابور الآن'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="h-10 text-xs gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 text-brand-cyan-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Card */}
        <div className="card-elevated rounded-3xl p-5 border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-card to-card text-right space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold">قيد الانتظار</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            {stats.pending}
          </div>
          <p className="text-[11px] text-muted-foreground">في طابور الإرسال اللحظي</p>
        </div>

        {/* Delivered Card */}
        <div className="card-elevated rounded-3xl p-5 border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-card to-card text-right space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold">تم التسليم</span>
            <CheckCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            {stats.sent}
          </div>
          <p className="text-[11px] text-muted-foreground">وصلت لأولياء الأمور بنجاح</p>
        </div>

        {/* Failed Card */}
        <div className="card-elevated rounded-3xl p-5 border border-rose-500/30 bg-gradient-to-b from-rose-500/10 via-card to-card text-right space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-bold">تعذر الإرسال</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            {stats.failed}
          </div>
          <p className="text-[11px] text-muted-foreground">بحاجة لإعادة الإرسال أو التدقيق</p>
        </div>

        {/* Today's Total Card */}
        <div className="card-elevated rounded-3xl p-5 border border-brand-cyan-500/30 bg-gradient-to-b from-brand-cyan-500/10 via-card to-card text-right space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between text-brand-cyan-600 dark:text-brand-cyan-400">
            <span className="text-xs font-bold">إجمالي إشعارات اليوم</span>
            <Send className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
            {stats.todayTotal}
          </div>
          <p className="text-[11px] text-muted-foreground">حضور ومستحقات ونتائج</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card-elevated rounded-3xl p-5 border border-border/80 bg-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Channel Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground ml-2">القناة:</span>
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'WHATSAPP', label: 'واتساب WhatsApp' },
              { id: 'FCM', label: 'ويب بوش FCM' },
              { id: 'SMS', label: 'رسائل قصيرة' },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSelectedChannel(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedChannel === tab.id
                    ? 'bg-brand-cyan-500 text-brand-navy-950 shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground ml-2">الحالة:</span>
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'PENDING', label: 'قيد الانتظار' },
              { id: 'SENT', label: 'تم التسليم' },
              { id: 'FAILED', label: 'فشل الإرسال' },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === tab.id
                    ? 'bg-brand-cyan-500 text-brand-navy-950 shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="ابحث برقم الهاتف أو اسم الطالب أو كود الإشعار أو نص الرسالة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pr-10 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
          />
        </div>
      </div>

      {/* Notifications Table */}
      <div className="card-elevated rounded-3xl border border-border/80 bg-card overflow-hidden shadow-soft-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/30">
                <th className="py-3 px-4">القناة</th>
                <th className="py-3 px-4">المستلم</th>
                <th className="py-3 px-4">المحتوى ومعاينة الرسالة</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الوقت</th>
                <th className="py-3 px-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    لا توجد إشعارات تطابق خيارات التصفية المحددة.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  const rendered =
                    item.renderedContent || renderNotificationContent(item.templateName, item.payload);
                  const isFailed = item.status.toUpperCase() === 'FAILED';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      {/* Channel */}
                      <td className="py-3.5 px-4">{getChannelBadge(item.channel)}</td>

                      {/* Recipient */}
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        {item.recipientPhone || item.recipientUserId || 'غير محدد'}
                      </td>

                      {/* Content Preview */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="truncate text-foreground font-medium" title={rendered}>
                          {rendered}
                        </div>
                        {item.payload?.studentName && (
                          <span className="text-[11px] text-muted-foreground">
                            الطالب: {item.payload.studentName}
                          </span>
                        )}
                        {item.errorMessage && (
                          <div className="text-[11px] text-rose-500 font-medium truncate mt-0.5">
                            خطأ: {item.errorMessage}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>

                      {/* Time */}
                      <td className="py-3.5 px-4 font-mono text-muted-foreground text-[11px]">
                        {new Date(item.sentAt || item.scheduledAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setInspectItem(item)}
                            className="h-8 px-2.5 text-xs gap-1"
                            title="معاينة تفاصيل الإشعار والواتساب"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-cyan-500" />
                            <span>معاينة</span>
                          </Button>

                          {isFailed ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleResend(item.id)}
                              className="h-8 px-2.5 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                              title="إعادة المحاولة الفورية"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              <span>إعادة الإرسال</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleResend(item.id)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                              title="إعادة إرسال نسخة إضافية"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Realistic WhatsApp Chat Bubble Payload Inspector Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="card-elevated w-full max-w-lg rounded-3xl border border-border overflow-hidden shadow-2xl bg-card text-right">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-brand-cyan-500/10 to-transparent">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-cyan-500" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    معاينة رسالة الواتساب السحابية
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">ID: {inspectItem.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* WhatsApp Simulated Chat Bubble Screen */}
              <div className="rounded-2xl p-4 bg-[#0B141B] dark:bg-[#080d12] border border-[#1f2c34] text-[#E9EDEF] space-y-3 shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-[#1f2c34]/70 text-[11px] text-[#8696A0]">
                  <span>رسالة موثقة إلى: {inspectItem.recipientPhone}</span>
                  <span className="font-mono">WhatsApp Cloud API</span>
                </div>

                {/* Chat Bubble */}
                <div className="mr-auto max-w-[92%] rounded-2xl rounded-tr-none p-3.5 bg-[#005C4B] text-white shadow-md space-y-2">
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
                    {inspectItem.renderedContent ||
                      renderNotificationContent(inspectItem.templateName, inspectItem.payload)}
                  </p>

                  {/* Overdue Balance Alert Callout */}
                  {inspectItem.payload?.balanceDue > 0 && (
                    <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        تنبيه مالي: مطلوب سداد {Number(inspectItem.payload.balanceDue).toFixed(2)} ج.م
                      </span>
                    </div>
                  )}

                  {/* Bubble Footer */}
                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-[#A6D4C6] pt-1 font-mono">
                    <span>
                      {new Date(inspectItem.sentAt || inspectItem.scheduledAt).toLocaleTimeString(
                        'ar-EG',
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  </div>
                </div>
              </div>

              {/* Delivery Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">حالة الرسالة:</span>
                  <div>{getStatusBadge(inspectItem.status)}</div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                  <span className="text-muted-foreground block text-[11px]">عدد المحاولات:</span>
                  <span className="font-bold text-foreground font-mono">
                    {inspectItem.retryCount || 0} من 3
                  </span>
                </div>
              </div>

              {/* JSON Payload Viewer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">الحمولة البرمجية (Payload JSON):</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPayloadJson(inspectItem.payload)}
                    className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {hasCopiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>نسخ الـ JSON</span>
                      </>
                    )}
                  </Button>
                </div>

                <pre className="p-3.5 rounded-xl bg-muted/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto text-left dir-ltr max-h-36">
                  {JSON.stringify(inspectItem.payload, null, 2)}
                </pre>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleResend(inspectItem.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-5 text-xs gap-1.5 shadow-md"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>إعادة الإرسال الفوري</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInspectItem(null)}
                  className="h-10 px-4 text-xs"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
