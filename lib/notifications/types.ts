/**
 * Yalla Center - Notification Domain Types
 * Path: lib/notifications/types.ts
 */

export type NotificationChannel =
  | 'whatsapp'
  | 'fcm'
  | 'sms'
  | 'WHATSAPP'
  | 'FCM'
  | 'SMS';

export type NotificationStatus =
  | 'queued'
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'QUEUED'
  | 'SIMULATED_DELIVERED'
  | 'FAILED';

export interface NotificationLog {
  id: string;
  tenantId: string;
  recipientPhone: string;
  recipientUserId?: string;
  recipient?: string;
  channel: NotificationChannel;
  templateName: string;
  templateId?: string;
  payload: Record<string, any>;
  status: NotificationStatus;
  retryCount: number;
  errorMessage?: string;
  scheduledAt: string;
  sentAt?: string;
  enqueuedAt?: string;
  processedAt?: string;
}

export interface NotificationJob {
  id: string;
  tenantId: string;
  recipient: string;
  channel: 'WHATSAPP' | 'FCM' | 'SMS' | 'whatsapp' | 'fcm' | 'sms';
  templateId: string;
  payload: Record<string, any>;
  status: 'QUEUED' | 'SIMULATED_DELIVERED' | 'FAILED' | 'queued' | 'sent' | 'delivered' | 'failed';
  enqueuedAt: string;
  processedAt?: string;
}

export interface NotificationStats {
  total: number;
  pending: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  todayTotal: number;
}

export interface EnqueueNotificationInput {
  tenantId: string;
  recipient: string;
  recipientPhone?: string;
  recipientUserId?: string;
  channel: NotificationChannel;
  templateId: string;
  payload: Record<string, any>;
}
