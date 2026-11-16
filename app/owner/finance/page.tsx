'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Wallet,
  Calendar as CalendarIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Receipt,
  CreditCard,
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  User,
  Phone,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  PieChart,
  TrendingUp,
  Download,
  Percent,
  Tag,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SaasPlatformService } from '@/lib/saas/service';
import {
  OwnerInvoice,
  OwnerPayment,
  OwnerExpense,
  OwnerAppointment,
  CenterExtended,
  OwnerAppointmentType,
  OwnerPaymentMethod,
  OwnerExpenseRecurrence,
  DynamicExpenseCategory,
} from '@/lib/saas/types';
import { downloadFinancialExcelFile } from '@/lib/saas/excel-export';
import { CenterAccountsSheetView } from '@/components/owner/center-accounts-sheet-view';
import { CenterFinancialModal } from '@/components/owner/center-financial-modal';
import { ExpenseCategoriesModal } from '@/components/owner/expense-categories-modal';
import { PrintableFinancialDoc } from '@/components/owner/printable-financial-doc';

type FinanceTabId =
  | 'overview'
  | 'sheet'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'calendar'
  | 'export';

function OwnerFinanceContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as FinanceTabId) || 'overview';

  const [activeTab, setActiveTab] = useState<FinanceTabId>(initialTab);
  const [finance, setFinance] = useState(() => SaasPlatformService.getFinancialSummary());
  const [invoices, setInvoices] = useState<OwnerInvoice[]>([]);
  const [payments, setPayments] = useState<OwnerPayment[]>([]);
  const [expenses, setExpenses] = useState<OwnerExpense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<DynamicExpenseCategory[]>([]);
  const [appointments, setAppointments] = useState<OwnerAppointment[]>([]);
  const [centers, setCenters] = useState<CenterExtended[]>([]);
  const [renewals, setRenewals] = useState(() => SaasPlatformService.getUpcomingRenewals());

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedCenterForLedger, setSelectedCenterForLedger] = useState<CenterExtended | null>(null);

  // Printable doc modal
  const [printableDoc, setPrintableDoc] = useState<{
    type: 'invoice' | 'receipt' | 'statement';
    invoice?: OwnerInvoice | null;
    payment?: OwnerPayment | null;
    center?: CenterExtended | null;
  } | null>(null);

  // Invoice creation form
  const [invoiceForm, setInvoiceForm] = useState({
    tenantId: '',
    planId: 'plan-pro',
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    amount: 3500,
    discount: 0,
    status: 'issued' as OwnerInvoice['status'],
    notes: 'فاتورة اشتراك شهري سحابي',
  });

  // Payment form
  const [selectedInvoice, setSelectedInvoice] = useState<OwnerInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(3500);
  const [paymentMethod, setPaymentMethod] = useState<OwnerPaymentMethod>('vodafone_cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('تحصيل اشتراك معتمد');

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    category: 'cloudflare',
    titleAr: '',
    amount: 500,
    paidTo: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'card' as OwnerPaymentMethod,
    referenceNumber: '',
    recurrence: 'monthly' as OwnerExpenseRecurrence,
    notes: '',
  });

  // Appointment form
  const [appointmentForm, setAppointmentForm] = useState({
    titleAr: '',
    type: 'demo' as OwnerAppointmentType,
    contactName: '',
    contactPhone: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '12:00',
    endTime: '13:00',
    reminderMinutes: 30,
    notes: '',
  });

  // Export filters state
  const [exportMode, setExportMode] = useState<'all' | 'overdue_only' | 'single' | 'date_range'>('all');
  const [exportCenterId, setExportCenterId] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const reloadData = () => {
    setFinance(SaasPlatformService.getFinancialSummary());
    setInvoices(SaasPlatformService.getInvoices());
    setPayments(SaasPlatformService.getPayments());
    setExpenses(SaasPlatformService.getExpenses());
    setExpenseCategories(SaasPlatformService.getExpenseCategories());
    setAppointments(SaasPlatformService.getAppointments());
    setRenewals(SaasPlatformService.getUpcomingRenewals());
    const c = SaasPlatformService.getCenters();
    setCenters(c);
    if (c.length > 0 && !invoiceForm.tenantId) {
      setInvoiceForm((prev) => ({ ...prev, tenantId: c[0].id }));
    }
  };

  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as FinanceTabId;
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handle Create Invoice
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const center = centers.find((c) => c.id === invoiceForm.tenantId);
    if (!center) return;

    SaasPlatformService.createInvoice({
      tenantId: center.id,
      tenantNameAr: center.nameAr,
      tenantSlug: center.slug,
      planId: invoiceForm.planId,
      planNameAr: center.planNameAr || 'باقة المحترفين',
      periodStart: invoiceForm.periodStart,
      periodEnd: invoiceForm.periodEnd,
      dueDate: invoiceForm.dueDate,
      amount: Number(invoiceForm.amount),
      discount: Number(invoiceForm.discount || 0),
      status: invoiceForm.status,
      notes: invoiceForm.notes,
    });

    reloadData();
    setIsInvoiceModalOpen(false);
    setStatusMessage('تم إصدار الفاتورة وقيدها في الحسابات بنجاح.');
  };

  // Handle Record Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const res = SaasPlatformService.recordPayment({
      invoiceId: selectedInvoice.id,
      amount: Number(paymentAmount),
      paymentMethod,
      referenceNumber: paymentRef,
      recordedBy: 'مالك المنصة',
      notes: paymentNotes,
    });

    if (res) {
      reloadData();
      setIsPaymentModalOpen(false);
      setStatusMessage(`تم تسجيل سند القبض برقم «${res.payment.receiptNumber}» وتحديث رصيد الفاتورة والسنتر.`);
    }
  };

  // Handle Create Expense
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.titleAr || !expenseForm.amount) return;

    const cat = expenseCategories.find((c) => c.key === expenseForm.category);

    SaasPlatformService.createExpense({
      category: expenseForm.category,
      categoryNameAr: cat?.nameAr,
      titleAr: expenseForm.titleAr,
      amount: Number(expenseForm.amount),
      paidTo: expenseForm.paidTo,
      date: expenseForm.date,
      paymentMethod: expenseForm.paymentMethod,
      referenceNumber: expenseForm.referenceNumber,
      recurrence: expenseForm.recurrence,
      notes: expenseForm.notes,
    });

    reloadData();
    setIsExpenseModalOpen(false);
    setStatusMessage('تم تسجيل المصروف في الحسابات بنجاح.');
  };

  // Handle Create Appointment
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentForm.titleAr || !appointmentForm.date) return;

    SaasPlatformService.createAppointment({
      titleAr: appointmentForm.titleAr,
      type: appointmentForm.type,
      contactName: appointmentForm.contactName,
      contactPhone: appointmentForm.contactPhone,
      date: appointmentForm.date,
      startTime: appointmentForm.startTime,
      endTime: appointmentForm.endTime,
      reminderMinutes: appointmentForm.reminderMinutes,
      notes: appointmentForm.notes,
    });

    reloadData();
    setIsAppointmentModalOpen(false);
    setStatusMessage('تم جدولة الموعد بنجاح في تقويم المالك.');
  };

  // 8 Navigation Tabs Configuration
  const TABS: Array<{ id: FinanceTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'نظرة عامة', icon: Wallet },
    { id: 'sheet', label: 'شيت حسابات السناتر', icon: FileSpreadsheet },
    { id: 'invoices', label: `فواتير الاشتراكات (${invoices.length})`, icon: Receipt },
    { id: 'payments', label: `التحصيلات والمدفوعات (${payments.length})`, icon: CreditCard },
    { id: 'expenses', label: `المصروفات (${expenses.length})`, icon: ArrowUpRight },
    { id: 'reports', label: 'الأرباح والتقارير المالية', icon: TrendingUp },
    { id: 'calendar', label: `تقويم المواعيد والتجديدات (${appointments.length})`, icon: CalendarIcon },
    { id: 'export', label: 'النسخ الاحتياطي والتصدير', icon: Download },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Wallet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                الحسابات السحابية وتقويم المواعيد
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                نظام الحسابات المالية المركزي لمالك المنصة: اشتراكات السناتر، التحصيلات، شيت Excel التفاعلي، والمصروفات.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadFinancialExcelFile({
                mode: 'all',
                filenamePrefix: 'Yalla_Center_Accounts_Full',
              })
            }
            className="text-xs font-bold gap-1.5 h-9 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            title="تصدير كشف حساب شامل لجميع السناتر بصيغة Excel الحقيقية"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel شامل</span>
          </Button>

          <Button
            type="button"
            variant="cyan"
            size="sm"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إصدار فاتورة اشتراك</span>
          </Button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-xs font-bold text-brand-cyan-700 dark:text-brand-cyan-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-cyan-500" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Core Financial KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Invoiced Revenue */}
        <Card className="card-elevated hover:border-purple-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              إجمالي الاشتراكات المفوترة
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground" dir="ltr">
              {finance.totalRevenueInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              خصومات ممنوحة: {finance.totalDiscounts.toLocaleString('en-US')} ج.م
            </p>
          </CardContent>
        </Card>

        {/* Collections */}
        <Card className="card-elevated hover:border-emerald-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              التحصيلات الفعلية المحصلة
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
              {finance.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
              أموال محصلة ومودعة بالحساب
            </p>
          </CardContent>
        </Card>

        {/* Platform Expenses */}
        <Card className="card-elevated hover:border-rose-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              مصاريف المنصة والتشغيل
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400" dir="ltr">
              {finance.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              خوادم Cloudflare، رسائل WhatsApp، و Gemini API
            </p>
          </CardContent>
        </Card>

        {/* Net SaaS Profit */}
        <Card className="card-elevated hover:border-brand-cyan-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground">
              صافي الموقف المالي (Net SaaS Profit)
            </CardTitle>
            <div className="w-8 h-8 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-brand-cyan-600 dark:text-brand-cyan-400" dir="ltr">
              {finance.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-brand-cyan-600 dark:text-brand-cyan-400 font-bold mt-1">
              الفائض الصافي بعد سداد التكاليف
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 8 Horizontal Tabs Bar */}
      <div className="flex border-b border-border gap-2 overflow-x-auto text-xs font-bold pb-1 custom-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all shrink-0 ${
                active
                  ? 'bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/30 shadow-soft-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Urgent Renewal & Overdue Alerts */}
          {(renewals.overdueAccounts.length > 0 || renewals.expiring7Days.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>تنبيهات استحقاق الاشتراكات والمستحقات العاجلة</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renewals.overdueAccounts.map((item) => (
                  <div
                    key={`overdue-${item.tenantId}`}
                    className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-foreground font-bold">{item.centerNameAr}</strong>
                        <Badge variant="destructive" className="text-[10px]">متأخر عن السداد</Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        المطلوب سداده: <strong className="font-mono text-rose-600">{item.remainingBalance.toLocaleString()} ج.م</strong>
                        {' '}(تاريخ الاستحقاق: {item.nextDueDate})
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`https://wa.me/${(item.adminPhone || '').replace(/[^\d+]/g, '')}?text=${encodeURIComponent(
                          `مرحباً أستاذ ${item.adminName}، نود تذكيركم بسداد المستحقات المتأخرة لاشتراك سنتر ${item.centerNameAr} بقيمة ${item.remainingBalance.toLocaleString()} ج.م.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>تذكير واتساب</span>
                      </a>
                    </div>
                  </div>
                ))}

                {renewals.expiring7Days.map((item) => (
                  <div
                    key={`expiring-${item.tenantId}`}
                    className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-foreground font-bold">{item.centerNameAr}</strong>
                        <Badge variant="cyan" className="text-[10px]">ينتهي خلال 7 أيام</Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        الباقة: {item.planNameAr} • تاريخ الانتهاء: <strong className="font-mono">{item.subscriptionEndDate}</strong>
                      </p>
                    </div>

                    <a
                      href={`https://wa.me/${(item.adminPhone || '').replace(/[^\d+]/g, '')}?text=${encodeURIComponent(
                        `مرحباً أستاذ ${item.adminName}، ينتهي اشتراك سنتر ${item.centerNameAr} بتاريخ ${item.subscriptionEndDate}. يرجى تأكيد التجديد لضمان عدم توقف الخدمات.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>تذكير بالتجديد</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Hub Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-elevated hover:border-brand-cyan-500/30 transition-all cursor-pointer" onClick={() => setActiveTab('sheet')}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">
                  شيت حسابات السناتر
                </CardTitle>
                <FileSpreadsheet className="w-5 h-5 text-brand-cyan-500" />
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  جدول تفاعلي 19 عموداً يتضمن الأرصدة، الفواتير، التحصيلات، والفلترة الفورية.
                </p>
                <div className="pt-2 text-brand-cyan-600 font-bold flex items-center gap-1">
                  <span>فتح الشيت التفاعلي</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated hover:border-purple-500/30 transition-all cursor-pointer" onClick={() => setActiveTab('invoices')}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">
                  فواتير الاشتراكات والتحصيل
                </CardTitle>
                <Receipt className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  إصدار فواتير السناتر الرسمية، طباعة الفاتورة، وتسجيل الدفعات الكاملة والجزئية.
                </p>
                <div className="pt-2 text-purple-600 font-bold flex items-center gap-1">
                  <span>إدارة الفواتير ({invoices.length})</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated hover:border-rose-500/30 transition-all cursor-pointer" onClick={() => setActiveTab('expenses')}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">
                  مصروفات وتشغيل المنصة
                </CardTitle>
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  تتبع خوادم Cloudflare، رسائل WhatsApp Cloud API، واستهلاك Gemini AI.
                </p>
                <div className="pt-2 text-rose-600 font-bold flex items-center gap-1">
                  <span>إدارة المصروفات ({expenses.length})</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Invoices Preview Table */}
          <Card className="card-elevated">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  أحدث الفواتير الصادرة للسناتر
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ملخص الفواتير الأخيرة وحالات السداد
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('invoices')}
                className="text-xs font-bold gap-1"
              >
                <span>عرض كافة الفواتير</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">رقم الفاتورة</th>
                      <th className="py-2.5 px-3">اسم السنتر</th>
                      <th className="py-2.5 px-3">الباقة</th>
                      <th className="py-2.5 px-3 text-left" dir="ltr">المطلوب (ج.م)</th>
                      <th className="py-2.5 px-3 text-left" dir="ltr">المسدد (ج.م)</th>
                      <th className="py-2.5 px-3">الاستحقاق</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {invoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">{inv.tenantNameAr}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{inv.planNameAr}</td>
                        <td className="py-2.5 px-3 font-mono font-black text-left" dir="ltr">{inv.totalDue.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-left text-emerald-600" dir="ltr">{inv.amountPaid.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">{inv.dueDate}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'destructive' : 'cyan'} className="text-[10px]">
                            {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partially_paid' ? 'سداد جزئي' : inv.status === 'overdue' ? 'متأخرة' : 'مستحقة'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPrintableDoc({ type: 'invoice', invoice: inv })}
                            className="h-7 text-xs font-bold gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>طباعة</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CENTER ACCOUNTS SHEET (Interactive 19 Columns) */}
      {/* ===================================================================== */}
      {activeTab === 'sheet' && (
        <CenterAccountsSheetView onRefresh={reloadData} />
      )}

      {/* ===================================================================== */}
      {/* TAB 3: INVOICES */}
      {/* ===================================================================== */}
      {activeTab === 'invoices' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                سجل فواتير الاشتراكات الصادرة للسناتر
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                فواتير باقات السناتر الشهرية والسنوية، استخراج الإيصالات، وتسجيل المدفوعات.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="cyan"
                size="sm"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="text-xs font-bold gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إصدار فاتورة جديدة</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-3">رقم الفاتورة</th>
                    <th className="py-3 px-3">السنتر المستفيد</th>
                    <th className="py-3 px-3">الباقة</th>
                    <th className="py-3 px-3">الفترة</th>
                    <th className="py-3 px-3 text-left" dir="ltr">قيمة الفاتورة</th>
                    <th className="py-3 px-3 text-left" dir="ltr">الخصم</th>
                    <th className="py-3 px-3 text-left" dir="ltr">صافي المستحق</th>
                    <th className="py-3 px-3 text-left" dir="ltr">المسدد</th>
                    <th className="py-3 px-3">تاريخ الاستحقاق</th>
                    <th className="py-3 px-3">الحالة</th>
                    <th className="py-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 font-bold text-foreground">
                        {inv.tenantNameAr}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {inv.planNameAr}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                        {inv.periodStart} - {inv.periodEnd}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-left" dir="ltr">
                        {inv.amount.toLocaleString()} EGP
                      </td>
                      <td className="py-3 px-3 font-mono text-left text-rose-600" dir="ltr">
                        {inv.discount > 0 ? `${inv.discount.toLocaleString()} EGP` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-left" dir="ltr">
                        {inv.totalDue.toLocaleString()} EGP
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600 text-left" dir="ltr">
                        {inv.amountPaid.toLocaleString()} EGP
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                        {inv.dueDate}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            inv.status === 'paid'
                              ? 'success'
                              : inv.status === 'overdue'
                              ? 'destructive'
                              : 'cyan'
                          }
                          className="text-[10px]"
                        >
                          {inv.status === 'paid'
                            ? 'مدفوعة'
                            : inv.status === 'partially_paid'
                            ? 'سداد جزئي'
                            : inv.status === 'overdue'
                            ? 'متأخرة'
                            : 'مستحقة'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {inv.status !== 'paid' && (
                            <Button
                              type="button"
                              variant="cyan"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPaymentAmount(inv.totalDue - inv.amountPaid);
                                setIsPaymentModalOpen(true);
                              }}
                              className="h-7 text-[11px] font-bold px-2"
                            >
                              سداد
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPrintableDoc({ type: 'invoice', invoice: inv })}
                            className="h-7 text-[11px] px-2"
                            title="طباعة الفاتورة"
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: PAYMENTS & COLLECTIONS */}
      {/* ===================================================================== */}
      {activeTab === 'payments' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                سجل التحصيلات والمدفوعات وسندات القبض
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                سندات القبض المعتمدة لمدفوعات اشتراكات السناتر والتحويلات البنكية.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-3">رقم السند</th>
                    <th className="py-3 px-3">السنتر المستفيد</th>
                    <th className="py-3 px-3 text-left" dir="ltr">المبلغ المحصل</th>
                    <th className="py-3 px-3">طريقة السداد</th>
                    <th className="py-3 px-3">رقم المرجع / الحوالة</th>
                    <th className="py-3 px-3">تاريخ الاستلام</th>
                    <th className="py-3 px-3">المحصل</th>
                    <th className="py-3 px-3">ملاحظات</th>
                    <th className="py-3 px-3 text-center">طباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="py-3 px-3 font-mono font-bold text-foreground">{p.receiptNumber}</td>
                      <td className="py-3 px-3 font-bold text-foreground">{p.tenantNameAr}</td>
                      <td className="py-3 px-3 font-mono font-black text-emerald-600 text-left" dir="ltr">
                        {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">{p.paymentMethod}</Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {p.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                        {p.receivedAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{p.recordedBy}</td>
                      <td className="py-3 px-3 text-[11px] text-muted-foreground max-w-xs truncate">{p.notes || '—'}</td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrintableDoc({ type: 'receipt', payment: p })}
                          className="h-7 text-xs font-bold gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>إيصال</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: EXPENSES */}
      {/* ===================================================================== */}
      {activeTab === 'expenses' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                مصاريف وتشغيل المنصة السحابية
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                إدارة تكاليف الخوادم والخدمات الخارجية مع إمكانية إضافة وتعديل الأقسام ديناميكياً.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCategoriesModalOpen(true)}
                className="text-xs font-bold gap-1"
              >
                <Tag className="w-3.5 h-3.5 text-rose-500" />
                <span>إدارة أقسام المصروفات</span>
              </Button>

              <Button
                type="button"
                variant="cyan"
                size="sm"
                onClick={() => setIsExpenseModalOpen(true)}
                className="text-xs font-bold gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل مصروف جديد</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-3">التاريخ</th>
                    <th className="py-3 px-3">بيان المصروف</th>
                    <th className="py-3 px-3">التصنيف</th>
                    <th className="py-3 px-3 text-left" dir="ltr">المبلغ (ج.م)</th>
                    <th className="py-3 px-3">طريقة السداد</th>
                    <th className="py-3 px-3">الجهة المستفيدة</th>
                    <th className="py-3 px-3">التكرار</th>
                    <th className="py-3 px-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/20">
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">{exp.date}</td>
                      <td className="py-3 px-3 font-bold text-foreground">{exp.titleAr}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">{exp.categoryNameAr || exp.category}</Badge>
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-rose-600 text-left" dir="ltr">
                        {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">{exp.paymentMethod || 'بطاقة بنكية'}</td>
                      <td className="py-3 px-3 text-muted-foreground">{exp.paidTo}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {exp.recurrence === 'monthly' ? 'شهري' : exp.recurrence === 'annual' ? 'سنوي' : 'مرة واحدة'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-muted-foreground">{exp.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: REPORTS & PROFIT STATEMENT */}
      {/* ===================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span>قائمة الأرباح والتدفق النقدي للمنصة (P&L SaaS Financial Statement)</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                حساب دقيق يفصل بين المفوتر والمحصل فعلياً والمصروفات وصافي السيولة.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="divide-y divide-border text-xs">
                <div className="py-3 flex items-center justify-between">
                  <span className="font-bold text-foreground">1. إجمالي الاشتراكات المفوترة للسناتر</span>
                  <span className="font-mono font-bold text-foreground text-sm" dir="ltr">
                    {finance.totalRevenueInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span>(-) إجمالي الخصومات والتسويات الممنوحة</span>
                  <span className="font-mono font-bold text-sm" dir="ltr">
                    - {finance.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between font-bold bg-muted/20 px-3 rounded-xl">
                  <span>(=) صافي الإيرادات المفوترة المستحقة</span>
                  <span className="font-mono font-black text-sm" dir="ltr">
                    {(finance.totalRevenueInvoiced - finance.totalDiscounts).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>(+) التحصيلات النقدية الفعلية المودعة بحسابات المنصة</span>
                  <span className="font-mono font-black text-base" dir="ltr">
                    {finance.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span>(-) إجمالي مصاريف وتشغيل المنصة (خوادم، رسائل، ذكاء اصطناعي)</span>
                  <span className="font-mono font-bold text-sm" dir="ltr">
                    - {finance.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-4 flex items-center justify-between font-black text-base bg-brand-cyan-500/10 border border-brand-cyan-500/30 px-4 rounded-2xl text-brand-cyan-700 dark:text-brand-cyan-300">
                  <span>(=) صافي التدفق النقدي والأرباح التشغيلية (Net Cash Flow)</span>
                  <span className="font-mono text-xl" dir="ltr">
                    {finance.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-muted-foreground">
                  <span>• إجمالي المبالغ المستحقة المتبقية على السناتر (Receivables)</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm" dir="ltr">
                    {finance.outstandingReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: CALENDAR & APPOINTMENTS */}
      {/* ===================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <Card className="card-elevated">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-brand-cyan-500" />
                  <span>تقويم مواعيد المالك (العروض الحية والتجديدات والمتابعات)</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تتبع مواعيد تجديد السناتر ومقابلات مدراء المراكز
                </p>
              </div>

              <Button
                type="button"
                variant="cyan"
                size="sm"
                onClick={() => setIsAppointmentModalOpen(true)}
                className="text-xs font-bold gap-1 shadow-soft-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة موعد</span>
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-2xl border border-border bg-card space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="cyan" className="text-[10px]">
                        {apt.type === 'demo'
                          ? 'جلسة ديمو'
                          : apt.type === 'renewal_followup'
                          ? 'متابعة تجديد'
                          : 'اجتماع عمل'}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {apt.date} • {apt.startTime}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-foreground">{apt.titleAr}</h4>

                    {apt.contactName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{apt.contactName} ({apt.contactPhone})</span>
                      </div>
                    )}

                    {apt.notes && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {apt.notes}
                      </p>
                    )}

                    <div className="pt-2 border-t border-border flex justify-between items-center text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        تذكير قبل {apt.reminderMinutes} دقيقة
                      </span>
                      <Badge variant="outline">{apt.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 8: BACKUP & EXPORT CENTER */}
      {/* ===================================================================== */}
      {activeTab === 'export' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              <span>مركز التصدير السحابي والنسخ الاحتياطي (XLSX & JSON)</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              تصدير ملفات Excel متعددة الشيتات مطابقة لمواصفات يلا سنتر أو تنزيل نسخة احتياطية من قواعد البيانات.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Full Excel Export */}
              <div className="p-5 rounded-3xl border border-border bg-muted/20 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-foreground text-sm block">تصدير شيت Excel شامل (6 شيتات)</strong>
                    <span className="text-muted-foreground">يتضمن ملخص السناتر، الفواتير، التحصيلات، والمصروفات</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="space-y-1 block">
                    <span className="font-bold">نطاق التصدير:</span>
                    <select
                      value={exportMode}
                      onChange={(e) => setExportMode(e.target.value as any)}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                    >
                      <option value="all">كافة السناتر والحسابات</option>
                      <option value="overdue_only">السناتر المتأخرة فقط</option>
                      <option value="single">سنتر فردي محدد</option>
                      <option value="date_range">فترة زمنية محددة</option>
                    </select>
                  </label>

                  {exportMode === 'single' && (
                    <label className="space-y-1 block">
                      <span className="font-bold">اختر السنتر:</span>
                      <select
                        value={exportCenterId}
                        onChange={(e) => setExportCenterId(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                      >
                        <option value="">اختر سنتر...</option>
                        {centers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr} ({c.slug})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {exportMode === 'date_range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="h-9 px-2.5 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="h-9 px-2.5 rounded-xl border border-border bg-background text-xs font-bold"
                      />
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="cyan"
                    size="sm"
                    onClick={() => {
                      const fname = downloadFinancialExcelFile({
                        mode: exportMode,
                        centerId: exportCenterId,
                        startDate: exportStartDate,
                        endDate: exportEndDate,
                        filenamePrefix: 'Yalla_Center_Accounts',
                      });
                      setStatusMessage(`تم إنشاء وتنزيل ملف Excel بنجاح: ${fname}`);
                    }}
                    className="w-full font-bold gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft-sm mt-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل ملف Excel (.xlsx)</span>
                  </Button>
                </div>
              </div>

              {/* Option 2: Full Database JSON Backup */}
              <div className="p-5 rounded-3xl border border-border bg-muted/20 space-y-3 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="text-foreground text-sm block">نسخة احتياطية مشفرة (JSON Backup)</strong>
                      <span className="text-muted-foreground">نسخة متكاملة لجميع السناتر والفواتير والمدفوعات والمصروفات</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3 leading-relaxed">
                    تتيح لك حفظ نسخة احتياطية محلية متوافقة تماماً للاسترجاع في أي وقت دون فقد أي بيانات تاريخية.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const backupData = {
                      version: '2.0-saas',
                      exportedAt: new Date().toISOString(),
                      centers: SaasPlatformService.getCenters(),
                      invoices: SaasPlatformService.getInvoices(),
                      payments: SaasPlatformService.getPayments(),
                      expenses: SaasPlatformService.getExpenses(),
                      movements: SaasPlatformService.getMovements(),
                    };
                    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Yalla_Center_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                  }}
                  className="w-full font-bold gap-2 h-9 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل النسخة الاحتياطية (JSON)</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE INVOICE */}
      {/* ========================================================================= */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateInvoice} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-500" />
              <span>إصدار فاتورة اشتراك سنتر سحابية</span>
            </h2>

            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">السنتر المستفيد *</span>
                <select
                  value={invoiceForm.tenantId}
                  onChange={(e) => {
                    const c = centers.find((item) => item.id === e.target.value);
                    setInvoiceForm({
                      ...invoiceForm,
                      tenantId: e.target.value,
                      amount: c?.billingAmount || 3500,
                    });
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  required
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr} ({c.planNameAr})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">المبلغ (ج.م) *</span>
                  <input
                    type="number"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">الخصم (ج.م)</span>
                  <input
                    type="number"
                    value={invoiceForm.discount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono text-xs"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">بداية الفترة</span>
                  <input
                    type="date"
                    value={invoiceForm.periodStart}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, periodStart: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">تاريخ الاستحقاق</span>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">البيان والملاحظات</span>
                <input
                  type="text"
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInvoiceModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="cyan" size="sm" className="font-bold">
                حفظ وإصدار الفاتورة
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRecordPayment} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>تسجيل سداد لفاتورة {selectedInvoice.invoiceNumber}</span>
            </h2>

            <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
              <div className="flex justify-between">
                <span>السنتر:</span>
                <strong>{selectedInvoice.tenantNameAr}</strong>
              </div>
              <div className="flex justify-between">
                <span>المبلغ المتبقي:</span>
                <strong className="font-mono text-rose-500" dir="ltr">
                  {(selectedInvoice.totalDue - selectedInvoice.amountPaid).toLocaleString('en-US')} EGP
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">المبلغ المحصل فعلياً (ج.م) *</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                  required
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">طريقة السداد</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                >
                  <option value="vodafone_cash">محفظة إلكترونية (فودافون كاش / إنستاباي)</option>
                  <option value="bank_transfer">تحويل بنكي رسمي</option>
                  <option value="cash">نقداً بالمقر</option>
                  <option value="card">بطاقة دفع إلكتروني</option>
                  <option value="other">طريقة أخرى</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">رقم مرجعي / كود التحويل</span>
                <input
                  type="text"
                  placeholder="مثال: رقم الحوالة أو كود العملية"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPaymentModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="cyan" size="sm" className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                تأكيد واستخراج إيصال القبض
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD EXPENSE */}
      {/* ========================================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateExpense} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-rose-500" />
              <span>تسجيل مصروف تشغيلي للمنصة</span>
            </h2>

            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">بيان المصروف *</span>
                <input
                  type="text"
                  placeholder="مثال: فاتورة خوادم أو رسائل"
                  value={expenseForm.titleAr}
                  onChange={(e) => setExpenseForm({ ...expenseForm, titleAr: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">المبلغ (ج.م) *</span>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">القسم / التصنيف</span>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.key}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">التكرار</span>
                  <select
                    value={expenseForm.recurrence}
                    onChange={(e) => setExpenseForm({ ...expenseForm, recurrence: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    <option value="monthly">شهري</option>
                    <option value="annual">سنوي</option>
                    <option value="one_time">لمرة واحدة</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">التاريخ</span>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">الجهة المستفيدة</span>
                  <input
                    type="text"
                    placeholder="Google, Cloudflare..."
                    value={expenseForm.paidTo}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">رقم المرجع / العملية</span>
                  <input
                    type="text"
                    value={expenseForm.referenceNumber}
                    onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                    dir="ltr"
                  />
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsExpenseModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="cyan" size="sm" className="font-bold">
                حفظ المصروف
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE APPOINTMENT */}
      {/* ========================================================================= */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateAppointment} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-500" />
              <span>جدولة موعد أو ديمو جديد</span>
            </h2>

            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">عنوان الموعد *</span>
                <input
                  type="text"
                  placeholder="مثال: جلسة ديمو سنتر الفرسان"
                  value={appointmentForm.titleAr}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, titleAr: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">نوع الموعد</span>
                  <select
                    value={appointmentForm.type}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, type: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    <option value="demo">عرض حي (Demo)</option>
                    <option value="renewal_followup">متابعة تجديد سنتر</option>
                    <option value="call">مكالمة مبيعات</option>
                    <option value="meeting">اجتماع عمل</option>
                    <option value="support">دعم فني وتدريب</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">التاريخ *</span>
                  <input
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">وقت البدء</span>
                  <input
                    type="time"
                    value={appointmentForm.startTime}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold font-mono"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">وقت الانتهاء</span>
                  <input
                    type="time"
                    value={appointmentForm.endTime}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">اسم العميل / المسؤول</span>
                  <input
                    type="text"
                    value={appointmentForm.contactName}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, contactName: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">هاتف العميل</span>
                  <input
                    type="text"
                    value={appointmentForm.contactPhone}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, contactPhone: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                    dir="ltr"
                  />
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAppointmentModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="cyan" size="sm" className="font-bold">
                تأكيد الجدولة
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Dynamic Expense Categories Modal */}
      <ExpenseCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onCategoriesChanged={reloadData}
      />

      {/* Center Financial Ledger Modal */}
      {selectedCenterForLedger && (
        <CenterFinancialModal
          center={selectedCenterForLedger}
          isOpen={true}
          onClose={() => setSelectedCenterForLedger(null)}
          onDataChanged={reloadData}
        />
      )}

      {/* Printable Doc Modal */}
      {printableDoc && (
        <PrintableFinancialDoc
          type={printableDoc.type}
          invoice={printableDoc.invoice}
          payment={printableDoc.payment}
          center={printableDoc.center}
          onClose={() => setPrintableDoc(null)}
        />
      )}
    </div>
  );
}

export default function OwnerFinanceAndCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs font-bold text-muted-foreground animate-pulse" dir="rtl">
          جاري تحميل الحسابات السحابية...
        </div>
      }
    >
      <OwnerFinanceContent />
    </Suspense>
  );
}
