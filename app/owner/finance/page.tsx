'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import {
  OwnerInvoice,
  OwnerPayment,
  OwnerExpense,
  OwnerAppointment,
  CenterExtended,
  OwnerAppointmentType,
} from '@/lib/saas/types';

export default function OwnerFinanceAndCalendarPage() {
  const [finance, setFinance] = useState(SaasPlatformService.getFinancialSummary());
  const [invoices, setInvoices] = useState<OwnerInvoice[]>([]);
  const [expenses, setExpenses] = useState<OwnerExpense[]>([]);
  const [appointments, setAppointments] = useState<OwnerAppointment[]>([]);
  const [centers, setCenters] = useState<CenterExtended[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'calendar'>('overview');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Invoice creation modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    tenantId: '',
    planId: 'plan-pro',
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    amount: 3500,
    discount: 0,
    status: 'issued' as OwnerInvoice['status'],
    notes: 'فاتورة اشتراك شهري',
  });

  // Payment recording modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OwnerInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(3500);
  const [paymentMethod, setPaymentMethod] = useState<OwnerPayment['paymentMethod']>('vodafone_cash');
  const [paymentRef, setPaymentRef] = useState('');

  // Expense modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'hosting' as OwnerExpense['category'],
    titleAr: '',
    amount: 500,
    paidTo: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Appointment creation modal
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
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

  const reloadData = () => {
    setFinance(SaasPlatformService.getFinancialSummary());
    setInvoices(SaasPlatformService.getInvoices());
    setExpenses(SaasPlatformService.getExpenses());
    setAppointments(SaasPlatformService.getAppointments());
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

  const handleCreateInvoice = () => {
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
    setStatusMessage('تم إصدار الفاتورة وحفظها في الحسابات بنجاح.');
  };

  const handleRecordPayment = () => {
    if (!selectedInvoice) return;
    const payment = SaasPlatformService.recordPayment({
      invoiceId: selectedInvoice.id,
      amount: Number(paymentAmount),
      paymentMethod,
      referenceNumber: paymentRef,
      recordedBy: 'مالك المنصة',
      notes: `تحصيل لفاتورة رقم ${selectedInvoice.invoiceNumber}`,
    });

    if (payment) {
      reloadData();
      setIsPaymentModalOpen(false);
      setStatusMessage(`تم تسجيل سند القبض برقم «${payment.receiptNumber}» وتحديث رصيد الفاتورة.`);
    }
  };

  const handleCreateExpense = () => {
    if (!expenseForm.titleAr || !expenseForm.amount) return;
    SaasPlatformService.createExpense({
      category: expenseForm.category,
      titleAr: expenseForm.titleAr,
      amount: Number(expenseForm.amount),
      paidTo: expenseForm.paidTo,
      date: expenseForm.date,
      notes: expenseForm.notes,
    });
    reloadData();
    setIsExpenseModalOpen(false);
    setStatusMessage('تم تسجيل المصروف في الحسابات بنجاح.');
  };

  const handleCreateAppointment = () => {
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Header */}
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
                الإدارة المالية الخاصة بمالك منصة يلا سنتر (اشتراكات السناتر، التحصيلات، المصاريف، وجلسات الديمو).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAppointmentModalOpen(true)}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>حجز موعد / ديمو</span>
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
              {finance.totalRevenueInvoiced.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              إجمالي الفواتير الصادرة للسناتر
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
              {finance.totalCollections.toLocaleString('en-US')}{' '}
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
              {finance.totalExpenses.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              خوادم Cloudflare، رسائل WhatsApp، و Gemini API
            </p>
          </CardContent>
        </Card>

        {/* Net Profit */}
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
              {finance.netProfit.toLocaleString('en-US')}{' '}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-brand-cyan-600 dark:text-brand-cyan-400 font-bold mt-1">
              الفائض الصافي بعد سداد التكاليف
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Tabs: Invoices / Expenses / Calendar */}
      <div className="flex border-b border-border gap-2 overflow-x-auto text-xs font-bold pb-1">
        {[
          { id: 'invoices', label: `فواتير اشتراكات السناتر (${invoices.length})`, icon: Receipt },
          { id: 'expenses', label: `مصاريف وخوادم المنصة (${expenses.length})`, icon: ArrowUpRight },
          { id: 'calendar', label: `تقويم المواعيد والتجديدات (${appointments.length})`, icon: CalendarIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all shrink-0 ${
                active
                  ? 'bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/30'
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
      {/* TAB 1: INVOICES */}
      {/* ===================================================================== */}
      {activeTab === 'invoices' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">
              سجل فواتير الاشتراكات الصادرة للسناتر
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="text-xs font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>فاتورة جديدة</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">السنتر</th>
                    <th className="py-3 px-4">الباقة</th>
                    <th className="py-3 px-4">المبلغ المستحق</th>
                    <th className="py-3 px-4">المسدد</th>
                    <th className="py-3 px-4">تاريخ الاستحقاق</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {inv.tenantNameAr}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {inv.planNameAr}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold" dir="ltr">
                        {inv.totalDue.toLocaleString('en-US')} EGP
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {inv.amountPaid.toLocaleString('en-US')} EGP
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {inv.dueDate}
                      </td>
                      <td className="py-3 px-4">
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
                            ? 'مدفوعة بالكامل'
                            : inv.status === 'partially_paid'
                            ? 'سداد جزئي'
                            : inv.status === 'overdue'
                            ? 'متأخرة'
                            : 'مستحقة'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {inv.status !== 'paid' ? (
                          <Button
                            type="button"
                            variant="cyan"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentAmount(inv.totalDue - inv.amountPaid);
                              setIsPaymentModalOpen(true);
                            }}
                            className="h-7 text-[11px] font-bold px-2.5"
                          >
                            تسجيل سداد
                          </Button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            مسددة ✓
                          </span>
                        )}
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
      {/* TAB 2: EXPENSES */}
      {/* ===================================================================== */}
      {activeTab === 'expenses' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">
              مصاريف وتشغيل المنصة السحابية
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpenseModalOpen(true)}
              className="text-xs font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل مصروف</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">البيان</th>
                    <th className="py-3 px-4">التصنيف</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">الجهة المستفيدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {exp.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {exp.titleAr}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {exp.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400" dir="ltr">
                        {exp.amount.toLocaleString('en-US')} EGP
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {exp.paidTo}
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
      {/* TAB 3: CALENDAR & APPOINTMENTS */}
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

      {/* ========================================================================= */}
      {/* MODAL: CREATE INVOICE */}
      {/* ========================================================================= */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-500" />
              <span>إصدار فاتورة اشتراك سنتر سحابية</span>
            </h2>

            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">السنتر المستفيد *</span>
                <select
                  value={invoiceForm.tenantId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, tenantId: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
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
              <Button type="button" variant="cyan" size="sm" onClick={handleCreateInvoice} className="font-bold">
                حفظ وإصدار الفاتورة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
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
              <Button type="button" variant="cyan" size="sm" onClick={handleRecordPayment} className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                تأكيد واستخراج إيصال القبض
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD EXPENSE */}
      {/* ========================================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
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
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">التصنيف</span>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    <option value="hosting">استضافة وخوادم</option>
                    <option value="ai_services">خدمات الذكاء الاصطناعي</option>
                    <option value="sms_whatsapp">رسائل وواتساب</option>
                    <option value="marketing">تسويق وإعلانات</option>
                    <option value="salaries">أجور ومكافآت</option>
                    <option value="other">أخرى</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">الجهة المستفيدة</span>
                <input
                  type="text"
                  placeholder="Google, Cloudflare, Meta..."
                  value={expenseForm.paidTo}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsExpenseModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="button" variant="cyan" size="sm" onClick={handleCreateExpense} className="font-bold">
                حفظ المصروف
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE APPOINTMENT */}
      {/* ========================================================================= */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs space-y-4">
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
              <Button type="button" variant="cyan" size="sm" onClick={handleCreateAppointment} className="font-bold">
                تأكيد الجدولة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
