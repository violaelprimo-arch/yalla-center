/**
 * Yalla Center - SaaS Platform Core Types
 * Path: lib/saas/types.ts
 *
 * Defines the unified data contracts for:
 * 1. Multi-tenant Center Provisioning & Lifecycle Management
 * 2. Subscription Plans & Entitlements
 * 3. Dynamic Public Website Builder (CMS)
 * 4. Customer Inquiries, Requests, Complaints & Polls
 * 5. Platform Communication & Central AI Quotas
 * 6. Platform Owner Financial System & Calendar
 * 7. Support Access & Audit Logs
 */

export type SubscriptionPlanTier = 'starter' | 'pro' | 'enterprise' | 'custom';
export type CenterStatus = 'active' | 'trial' | 'suspended' | 'expired';
export type BillingFrequency = 'monthly' | 'annual';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface CenterExtended {
  id: string;
  slug: string;
  nameAr: string;
  nameEn?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  email?: string;

  // Primary Administrator
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminUsername?: string;

  // Subscription & Billing
  subscriptionPlanId: string;
  planNameAr: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  billingAmount: number;
  billingFrequency: BillingFrequency;
  paymentStatus: PaymentStatus;
  customPricing?: number | null;

  // Operational Counts
  branchesCount: number;
  studentsCount: number;
  teachersCount: number;
  employeesCount: number;

  // Feature Limits
  maxBranches: number; // -1 for unlimited
  maxStudents: number; // -1 for unlimited
  maxTeachers: number; // -1 for unlimited
  maxEmployees: number; // -1 for unlimited

  // Central AI Quotas
  aiBalance: number; // in platform AI units
  aiUsageTotal: number;
  aiEnabled: boolean;

  // Platform State
  status: CenterStatus;
  enabledModules: string[];
  showInPublicDirectory: boolean;
  notes?: string;
  supportAccessActive?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionPlanTier;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  billingFrequency: BillingFrequency;
  trialDays: number;

  // Limits (-1 represents unlimited)
  maxStudents: number;
  maxTeachers: number;
  maxEmployees: number;
  maxBranches: number;

  // Allowances
  aiUnitAllowance: number;
  notificationAllowance: number;
  storageAllowanceMb: number;

  // Capabilities
  enabledModules: string[];
  features: string[];
  highlighted: boolean;
  isPublic: boolean;
  displayOrder: number;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export type WebsiteSectionId =
  | 'hero'
  | 'announcements'
  | 'special_offers'
  | 'features'
  | 'showcase'
  | 'plans'
  | 'partners'
  | 'testimonials'
  | 'polls'
  | 'faq'
  | 'subscription_form'
  | 'contact_form'
  | 'complaints_form'
  | 'footer';

export interface WebsiteSection {
  id: WebsiteSectionId;
  titleAr: string;
  subtitleAr?: string;
  contentAr?: string;
  badgeAr?: string;
  enabled: boolean;
  order: number;
  ctaLabelAr?: string;
  ctaLink?: string;
  imageUrl?: string;
  videoUrl?: string;
  styleVariant?: 'default' | 'card' | 'gradient' | 'bordered';
  customData?: Record<string, unknown>;
}

export interface WebsiteFaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface WebsiteTestimonialItem {
  id: string;
  name: string;
  role: string;
  centerName: string;
  quote: string;
  rating: number;
  avatarUrl?: string;
}

export interface WebsitePollOption {
  id: string;
  textAr: string;
  votes: number;
}

export interface WebsitePoll {
  id: string;
  questionAr: string;
  options: WebsitePollOption[];
  isActive: boolean;
  totalVotes: number;
}

export interface WebsiteSpecialOffer {
  enabled: boolean;
  titleAr: string;
  discountAr: string;
  descriptionAr: string;
  startDate: string;
  endDate: string;
  ctaLabelAr: string;
  ctaLink: string;
}

export interface WebsiteAnnouncementBar {
  enabled: boolean;
  textAr: string;
  link?: string;
  badgeAr?: string;
  expiresAt?: string;
}

export interface WebsiteConfig {
  version: number;
  sections: WebsiteSection[];
  announcementBar: WebsiteAnnouncementBar;
  specialOffer: WebsiteSpecialOffer;
  faqs: WebsiteFaqItem[];
  testimonials: WebsiteTestimonialItem[];
  activePoll?: WebsitePoll;
  metaTitleAr: string;
  metaDescriptionAr: string;
  lastPublishedAt?: string;
  publishedBy?: string;
}

export type RequestStatus =
  | 'new'
  | 'under_review'
  | 'contacted'
  | 'demo_scheduled'
  | 'accepted'
  | 'rejected'
  | 'converted';

export interface CustomerRequest {
  id: string;
  type: 'subscription' | 'demo' | 'inquiry';
  centerName: string;
  contactPerson: string;
  email: string;
  phone: string;
  governorate?: string;
  address?: string;
  approxStudentsCount: number;
  branchCount: number;
  requestedPlanId?: string;
  requestedPlanName?: string;
  preferredContactMethod: 'phone' | 'whatsapp' | 'email';
  notes: string;
  status: RequestStatus;
  internalNotes: string[];
  communicationHistory: Array<{
    date: string;
    author: string;
    note: string;
    channel: string;
  }>;
  scheduledDemoAt?: string;
  convertedTenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintRecord {
  id: string;
  senderName: string;
  email: string;
  phone: string;
  centerName?: string;
  subject: string;
  description: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  adminNotes: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied';
  createdAt: string;
}

export interface PlatformCommunicationSettings {
  primaryPhone: string;
  additionalPhones: string[];
  whatsappNumber: string;
  supportEmail: string;
  subscriptionNotificationEmail: string;
  complaintsNotificationEmail: string;
  businessHoursAr: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl?: string;
  companyNameAr: string;
  addressAr: string;
}

export interface CentralAiConfig {
  provider: 'google_gemini' | 'openai' | 'anthropic';
  model: string;
  apiKeyConfigured: boolean;
  maskedKeyIndicator: string;
  isEnabled: boolean;
  defaultMaxTokens: number;
  defaultTemperature: number;
  perFeatureAvailability: {
    aiExams: boolean;
    documentIndexing: boolean;
    autoGrading: boolean;
  };
  costPerOperation: {
    aiExamGeneration: number; // units
    documentProcessing: number;
    questionAutoGrade: number;
  };
  lastTestedAt?: string;
  testStatus?: 'success' | 'failed' | 'untested';
}

export interface AiUsageLedgerEntry {
  id: string;
  tenantId: string;
  tenantSlug: string;
  operation: string;
  units: number;
  balanceBefore: number;
  balanceAfter: number;
  actorId: string;
  actorRole: string;
  timestamp: string;
  status: 'completed' | 'reserved' | 'refunded' | 'failed';
  idempotencyKey: string;
  descriptionAr: string;
  metadata?: Record<string, unknown>;
}

export type OwnerInvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

export interface OwnerInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantNameAr: string;
  tenantSlug: string;
  planId: string;
  planNameAr: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  discount: number;
  totalDue: number;
  amountPaid: number;
  status: OwnerInvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  notes?: string;
}

export type OwnerPaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'vodafone_cash'
  | 'card'
  | 'cheque';

export interface OwnerPayment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  tenantId: string;
  tenantNameAr: string;
  amount: number;
  paymentMethod: OwnerPaymentMethod;
  referenceNumber?: string;
  receivedAt: string;
  recordedBy: string;
  notes?: string;
}

export type OwnerExpenseCategory =
  | 'hosting'
  | 'ai_services'
  | 'sms_whatsapp'
  | 'marketing'
  | 'salaries'
  | 'licenses'
  | 'other';

export interface OwnerExpense {
  id: string;
  category: OwnerExpenseCategory;
  titleAr: string;
  amount: number;
  date: string;
  paidTo: string;
  notes?: string;
}

export type OwnerAppointmentType =
  | 'demo'
  | 'call'
  | 'renewal_followup'
  | 'meeting'
  | 'support'
  | 'other';

export interface OwnerAppointment {
  id: string;
  titleAr: string;
  type: OwnerAppointmentType;
  tenantId?: string;
  tenantNameAr?: string;
  requestId?: string;
  contactName?: string;
  contactPhone?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
  reminderMinutes: number;
  notes?: string;
}

export interface SupportAccessSession {
  id: string;
  tenantId: string;
  tenantSlug: string;
  ownerId: string;
  ownerEmail: string;
  reason: string;
  startedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  actionsPerformed: Array<{
    timestamp: string;
    action: string;
    resource: string;
  }>;
}

export interface OwnerAuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  details: Record<string, unknown>;
}
