'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Receipt,
  CreditCard,
  Plus,
  Percent,
  FileSpreadsheet,
  Printer,
  Share2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  User,
  Phone,
  ShieldCheck,
  X,
  FileText,
  DollarSign,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SaasPlatformService } from '@/lib/saas/service';
import {
  CenterExtended,
  CenterFinancialMovement,
  CenterFinancialMovementType,
  OwnerInvoice,
  OwnerPayment,
  OwnerPaymentMethod,
} from '@/lib/saas/types';
import { downloadFinancialExcelFile } from '@/lib/saas/excel-export';
import { PrintableFinancialDoc } from './printable-financial-doc';

export interface CenterFinancialModalProps {
  center: CenterExtended;
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export function CenterFinancialModal({
  center,
  isOpen,
  onClose,
  onDataChanged,
}: CenterFinancialModalProps) {
  const [statement, setStatement] = useState(() =>
    SaasPlatformService.getCenterStatement(center.id)
  );

  const [invoices, setInvoices] = useState<OwnerInvoice[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sub-modals inside ledger
  const [isIssueInvoiceOpen, setIsIssueInvoiceOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isAddDiscountOpen, setIsAddDiscountOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<CenterFinancialMovement | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Printable Document preview modal
  const [printableDoc, setPrintableDoc] = useState<{
    type: 'invoice' | 'receipt' | 'statement';
    invoice?: OwnerInvoice | null;
    payment?: OwnerPayment | null;
  } | null>(null);

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    amount: center.billingAmount || 3500,
    discount: 0,
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: `فاتورة اشتراك شهري - ${center.planNameAr}`,
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '',
    amount: 0,
    paymentMethod: 'vodafone_cash' as OwnerPaymentMethod,
    referenceNumber: '',
    notes: 'تحصيل اشتراك معتمد',
  });

  const [discountForm, setDiscountForm] = useState({
    type: 'discount' as 'discount' | 'credit_added' | 'adjustment' | 'refund',
    amount: 500,
    description: 'خصم ترويجي / تسوية رصيد',
    reason: 'قرار إدارة المنصة لدعم السنتر',
  });

  const reloadLedger = () => {
    const st = SaasPlatformService.getCenterStatement(center.id);
    setStatement(st);
    const allInv = SaasPlatformService.getInvoices().filter((i) => i.tenantId === center.id);
    setInvoices(allInv);
    onDataChanged?.();
  };

  useEffect(() => {
    if (isOpen) {
      reloadLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, center.id]);

  if (!isOpen) return null;

  // Handle Issue Invoice
  const handleIssueInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    SaasPlatformService.createInvoice({
      tenantId: center.id,
      tenantNameAr: center.nameAr,
      tenantSlug: center.slug,
      planId: center.subscriptionPlanId,
      planNameAr: center.planNameAr,
      periodStart: invoiceForm.periodStart,
      periodEnd: invoiceForm.periodEnd,
      dueDate: invoiceForm.dueDate,
      amount: Number(invoiceForm.amount),
      discount: Number(invoiceForm.discount || 0),
      status: 'issued',
      notes: invoiceForm.notes,
    });

    setIsIssueInvoiceOpen(false);
    reloadLedger();
    setStatusMessage('تم إصدار الفاتورة وقيدها في كشف حساب السنتر بنجاح.');
  };

  // Handle Record Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.invoiceId || !paymentForm.amount) return;

    const res = SaasPlatformService.recordPayment({
      invoiceId: paymentForm.invoiceId,
      amount: Number(paymentForm.amount),
      paymentMethod: paymentForm.paymentMethod,
      referenceNumber: paymentForm.referenceNumber,
      notes: paymentForm.notes,
      recordedBy: 'مالك المنصة',
    });

    if (res) {
      setIsRecordPaymentOpen(false);
      reloadLedger();
      setStatusMessage(`تم قيد الدفعة برقم إيصال «${res.payment.receiptNumber}» وتحديث الرصيد.`);
    }
  };

  // Handle Add Discount or Adjustment
  const handleAddDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    SaasPlatformService.addAdjustmentOrDiscount({
      tenantId: center.id,
      type: discountForm.type,
      amount: Number(discountForm.amount),
      description: discountForm.description,
      reason: discountForm.reason,
      recordedBy: 'مالك المنصة',
    });

    setIsAddDiscountOpen(false);
    reloadLedger();
    setStatusMessage('تم إضافة القيد المالي وتحديث رصيد السنتر بنجاح.');
  };

  // Handle Reversal / Cancellation
  const handleConfirmReversal = () => {
    if (!reversalTarget || !reversalReason.trim()) return;
    const res = SaasPlatformService.reverseMovement(reversalTarget.id, reversalReason, 'مالك المنصة');
    if (res.ok) {
      setReversalTarget(null);
      setReversalReason('');
      reloadLedger();
      setStatusMessage('تم إجراء القيد العكسي وإلغاء العملية بنجاح مع توثيق سجل التدقيق.');
    } else {
      alert(res.error || 'حدث خطأ أثناء إجراء الإلغاء');
    }
  };

  // WhatsApp reminder url
  const getWhatsAppReminderUrl = () => {
    const cleanPhone = (center.adminPhone || center.phone || '').replace(/[^\d+]/g, '');
    const msg = `مرحباً أستاذ ${center.adminName}،\nنود تذكيركم بمستحقات اشتراك سنتر ${center.nameAr} في منصة يلا سنتر:\n- المبلغ المتبقي: ${statement.remainingBalance.toLocaleString('en-US')} ج.م\n- موعد الاستحقاق: ${statement.nextDueDate}\nشاكرين حرصكم على استمرارية الخدمة.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getMovementBadge = (type: CenterFinancialMovementType) => {
    switch (type) {
      case 'invoice':
        return <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600 dark:text-purple-400">فاتورة اشتراك</Badge>;
      case 'renewal':
        return <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400">تجديد اشتراك</Badge>;
      case 'upgrade':
        return <Badge variant="outline" className="text-[10px] border-brand-cyan-500/30 text-brand-cyan-600 dark:text-brand-cyan-400">ترقية باقة</Badge>;
      case 'full_payment':
        return <Badge variant="success" className="text-[10px]">دفع كامل</Badge>;
      case 'partial_payment':
        return <Badge variant="cyan" className="text-[10px]">دفع جزئي</Badge>;
      case 'discount':
        return <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">خصم</Badge>;
      case 'credit_added':
        return <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-600 dark:text-indigo-400">رصيد سابق</Badge>;
      case 'refund':
        return <Badge variant="destructive" className="text-[10px]">استرداد</Badge>;
      case 'adjustment':
        return <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">تسوية مالية</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-5xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] space-y-5 animate-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-foreground">
                  الحسابات وكشف الحساب — {center.nameAr}
                </h2>
                <Badge variant={statement.paymentStatus === 'paid' ? 'success' : statement.paymentStatus === 'overdue' ? 'destructive' : 'cyan'}>
                  {statement.paymentStatus === 'paid' ? 'مدفوع بالكامل' : statement.paymentStatus === 'partial' ? 'سداد جزئي' : statement.paymentStatus === 'overdue' ? 'متأخر' : 'غير مدفوع'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono">كود: /{center.slug}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {center.adminName} ({center.adminPhone})
                </span>
                <span>•</span>
                <span>الباقة: <strong>{center.planNameAr}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadFinancialExcelFile({ mode: 'single', centerId: center.id })}
              className="text-xs font-bold gap-1.5 h-8 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              title="تصدير كشف الحساب كملف Excel حقيقي"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrintableDoc({ type: 'statement' })}
              className="text-xs font-bold gap-1.5 h-8"
              title="عرض وطباعة كشف الحساب المعتمد"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف الحساب</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className="p-3 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-xs font-bold text-brand-cyan-700 dark:text-brand-cyan-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-cyan-500" />
              <span>{statusMessage}</span>
            </div>
            <button type="button" onClick={() => setStatusMessage(null)} className="text-xs text-muted-foreground">✕</button>
          </div>
        )}

        {/* Financial Summary KPI Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-2xl bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-bold block">إجمالي الفواتير الصادرة</span>
            <div className="text-base font-black font-mono mt-1 text-foreground" dir="ltr">
              {statement.totalDebit.toLocaleString('en-US')} <span className="text-[10px]">ج.م</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">إجمالي المسدد</span>
            <div className="text-base font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400" dir="ltr">
              {statement.totalCredit.toLocaleString('en-US')} <span className="text-[10px]">ج.م</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block">المبلغ المتبقي المطلوب</span>
            <div className="text-base font-black font-mono mt-1 text-rose-600 dark:text-rose-400" dir="ltr">
              {statement.remainingBalance.toLocaleString('en-US')} <span className="text-[10px]">ج.م</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-bold block">الرصيد الدائن / الزيادة</span>
            <div className="text-base font-black font-mono mt-1 text-indigo-600 dark:text-indigo-400" dir="ltr">
              {statement.creditBalance.toLocaleString('en-US')} <span className="text-[10px]">ج.م</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-bold block">تاريخ آخر دفعة</span>
            <div className="text-xs font-bold font-mono mt-1.5 text-foreground">
              {statement.lastPaymentDate || 'لا توجد دفعات'}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-bold block">موعد الاستحقاق القادم</span>
            <div className="text-xs font-bold font-mono mt-1.5 text-brand-cyan-600 dark:text-brand-cyan-400">
              {statement.nextDueDate}
            </div>
          </div>
        </div>

        {/* Quick Operations Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-muted/30 border border-border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="cyan"
              size="sm"
              onClick={() => setIsIssueInvoiceOpen(true)}
              className="text-xs font-bold gap-1.5 h-8 shadow-soft-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إصدار فاتورة اشتراك</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const unpaid = invoices.find((i) => i.status !== 'paid');
                if (unpaid) {
                  setPaymentForm({
                    invoiceId: unpaid.id,
                    amount: unpaid.totalDue - unpaid.amountPaid,
                    paymentMethod: 'vodafone_cash',
                    referenceNumber: '',
                    notes: `سداد لفاتورة #${unpaid.invoiceNumber}`,
                  });
                }
                setIsRecordPaymentOpen(true);
              }}
              className="text-xs font-bold gap-1.5 h-8 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>تسجيل دفعة جديدة</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddDiscountOpen(true)}
              className="text-xs font-bold gap-1.5 h-8"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>إضافة خصم أو تسوية</span>
            </Button>
          </div>

          {statement.remainingBalance > 0 && (
            <a
              href={getWhatsAppReminderUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors h-8"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>إرسال تذكير واتساب</span>
            </a>
          )}
        </div>

        {/* Detailed Financial Movement Table */}
        <div className="flex-1 overflow-y-auto border border-border rounded-2xl bg-card">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 z-10 border-b border-border backdrop-blur">
              <tr>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3">رقم العملية</th>
                <th className="py-2.5 px-3">نوع العملية</th>
                <th className="py-2.5 px-3">الوصف والبيان</th>
                <th className="py-2.5 px-3 text-left" dir="ltr">مدين (ج.م)</th>
                <th className="py-2.5 px-3 text-left" dir="ltr">دائن (ج.م)</th>
                <th className="py-2.5 px-3 text-left" dir="ltr">الرصيد المتبقي</th>
                <th className="py-2.5 px-3">طريقة الدفع</th>
                <th className="py-2.5 px-3">ملاحظات</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {statement.movements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
                    لا توجد حركات مالية مسجلة لهذا السنتر بعد.
                  </td>
                </tr>
              ) : (
                statement.movements.map((mov) => {
                  const isReversed = mov.status === 'reversed';
                  return (
                    <tr
                      key={mov.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isReversed ? 'opacity-40 line-through bg-muted/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {mov.date}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {mov.movementNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        {getMovementBadge(mov.type)}
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-medium max-w-xs truncate" title={mov.description}>
                        {mov.description}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-left text-foreground" dir="ltr">
                        {mov.debit > 0 ? mov.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-left text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {mov.credit > 0 ? mov.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-left" dir="ltr">
                        {mov.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {mov.paymentMethod && mov.paymentMethod !== 'none' ? mov.paymentMethod : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground max-w-[140px] truncate" title={mov.notes || ''}>
                        {mov.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print action */}
                          {mov.invoiceId && (
                            <button
                              type="button"
                              onClick={() => {
                                const inv = invoices.find((i) => i.id === mov.invoiceId);
                                if (inv) setPrintableDoc({ type: 'invoice', invoice: inv });
                              }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="طباعة الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Reversal / Cancellation */}
                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => setReversalTarget(mov)}
                              className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600"
                              title="إلغاء أو قيد عكسي مع سجل تدقيق"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
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

        {/* Sub-modal: Issue Subscription Invoice */}
        {isIssueInvoiceOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form onSubmit={handleIssueInvoice} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 space-y-4 text-xs">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-500" />
                <span>إصدار فاتورة اشتراك جديدة لـ {center.nameAr}</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold">قيمة الفاتورة (ج.م) *</span>
                  <input
                    type="number"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold">الخصم (ج.م)</span>
                  <input
                    type="number"
                    value={invoiceForm.discount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono text-xs"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold">بداية الفترة</span>
                  <input
                    type="date"
                    value={invoiceForm.periodStart}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, periodStart: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold">تاريخ الاستحقاق</span>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold">بيان وملاحظات الفاتورة</span>
                <input
                  type="text"
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>

              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsIssueInvoiceOpen(false)}>إلغاء</Button>
                <Button type="submit" variant="cyan" size="sm" className="font-bold">حفظ وإصدار الفاتورة</Button>
              </div>
            </form>
          </div>
        )}

        {/* Sub-modal: Record Payment */}
        {isRecordPaymentOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form onSubmit={handleRecordPayment} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 space-y-4 text-xs">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                <span>تسجيل دفعة وتحصيل لـ {center.nameAr}</span>
              </h3>

              <label className="space-y-1 block">
                <span className="font-bold">الفاتورة المرتبطة بالسداد *</span>
                <select
                  value={paymentForm.invoiceId}
                  onChange={(e) => {
                    const inv = invoices.find((i) => i.id === e.target.value);
                    setPaymentForm({
                      ...paymentForm,
                      invoiceId: e.target.value,
                      amount: inv ? inv.totalDue - inv.amountPaid : 0,
                    });
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  required
                >
                  <option value="">اختر الفاتورة المستحقة...</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — المتبقي: {(inv.totalDue - inv.amountPaid).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold">المبلغ المسدد (ج.م) *</span>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                    required
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold">طريقة السداد</span>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    <option value="vodafone_cash">محفظة إلكترونية / فودافون كاش</option>
                    <option value="instapay">InstaPay إنستاباي</option>
                    <option value="bank_transfer">تحويل بنكي رسمي</option>
                    <option value="cash">نقداً بالمقر</option>
                    <option value="card">بطاقة دفع إلكتروني</option>
                    <option value="other">طريقة أخرى</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold">رقم مرجع التحويل / الحوالة</span>
                <input
                  type="text"
                  placeholder="مثال: رقم العملية أو كود الحوالة"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold">ملاحظات السداد</span>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>

              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordPaymentOpen(false)}>إلغاء</Button>
                <Button type="submit" variant="cyan" size="sm" className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white">تأكيد وقيد السند</Button>
              </div>
            </form>
          </div>
        )}

        {/* Sub-modal: Add Discount or Adjustment */}
        {isAddDiscountOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form onSubmit={handleAddDiscount} className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 space-y-4 text-xs">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-500" />
                <span>إضافة خصم أو تسوية مالية</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-bold">نوع العملية</span>
                  <select
                    value={discountForm.type}
                    onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    <option value="discount">خصم على الفاتورة</option>
                    <option value="credit_added">إضافة رصيد سابق</option>
                    <option value="adjustment">تسوية مالية</option>
                    <option value="refund">استرداد مبلغ للسنتر</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold">المبلغ (ج.م) *</span>
                  <input
                    type="number"
                    value={discountForm.amount}
                    onChange={(e) => setDiscountForm({ ...discountForm, amount: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                    required
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold">بيان القيد</span>
                <input
                  type="text"
                  value={discountForm.description}
                  onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  required
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold">سبب التعديل أو الخصم *</span>
                <input
                  type="text"
                  value={discountForm.reason}
                  onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  required
                />
              </label>

              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddDiscountOpen(false)}>إلغاء</Button>
                <Button type="submit" variant="cyan" size="sm" className="font-bold">تطبيق التعديل</Button>
              </div>
            </form>
          </div>
        )}

        {/* Sub-modal: Reversal confirmation */}
        {reversalTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-md p-5 space-y-4 text-xs">
              <h3 className="text-sm font-black text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>تأكيد إلغاء القيد المالي #{reversalTarget.movementNumber}</span>
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                لا يتم حذف العمليات المالية المعتمدة بصمت لضمان نزاهة الحسابات. سيتم إجراء قيد عكسي وإلغاء العملية مع تسجيل سبب الإلغاء في سجل التدقيق (Audit Log).
              </p>

              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <div>البيان: <strong>{reversalTarget.description}</strong></div>
                <div>المبلغ: <strong>{(reversalTarget.debit || reversalTarget.credit).toLocaleString()} ج.م</strong></div>
              </div>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">سبب الإلغاء أو القيد العكسي *</span>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="اكتب سبب إلغاء هذه الحركة بوضوح..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs"
                  required
                />
              </label>

              <div className="pt-2 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setReversalTarget(null)}>تراجع</Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmReversal}
                  disabled={!reversalReason.trim()}
                  className="font-bold"
                >
                  تأكيد الإلغاء والقيد العكسي
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Document Modal */}
        {printableDoc && (
          <PrintableFinancialDoc
            type={printableDoc.type}
            invoice={printableDoc.invoice}
            payment={printableDoc.payment}
            center={center}
            movements={statement.movements}
            onClose={() => setPrintableDoc(null)}
          />
        )}
      </div>
    </div>
  );
}
