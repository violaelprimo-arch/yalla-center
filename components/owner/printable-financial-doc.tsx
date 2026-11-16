'use client';

import React from 'react';
import { Printer, Download, Share2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/brand-logo';
import { OwnerInvoice, OwnerPayment, CenterFinancialMovement, CenterExtended } from '@/lib/saas/types';

export interface PrintableDocProps {
  type: 'invoice' | 'receipt' | 'statement';
  invoice?: OwnerInvoice | null;
  payment?: OwnerPayment | null;
  center?: CenterExtended | null;
  movements?: CenterFinancialMovement[];
  onClose: () => void;
}

export function PrintableFinancialDoc({
  type,
  invoice,
  payment,
  center,
  movements = [],
  onClose,
}: PrintableDocProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const getWhatsAppShareUrl = () => {
    let text = '';
    const phone = center?.adminPhone || '';
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    if (type === 'invoice' && invoice) {
      text = `السلام عليكم أستاذ ${center?.adminName || 'المدير المسؤول'}،\nيسر منصة يلا سنتر إرسال فاتورة اشتراك رقم ${invoice.invoiceNumber}:\n- الباقة: ${invoice.planNameAr}\n- المبلغ المطلوب: ${invoice.totalDue.toLocaleString('en-US')} ج.م\n- موعد الاستحقاق: ${invoice.dueDate}\nشاكرين تعاونكم معنا.`;
    } else if (type === 'receipt' && payment) {
      text = `السلام عليكم أستاذ ${center?.adminName || 'المدير المسؤول'}،\nتم استلام دفعة بقيمة ${payment.amount.toLocaleString('en-US')} ج.م بنجاح لصالح سنتر ${payment.tenantNameAr}.\n- رقم السند: ${payment.receiptNumber}\n- طريقة الدفع: ${payment.paymentMethod}\n- التاريخ: ${payment.receivedAt.slice(0, 10)}\nشكراً لاختياركم منصة يلا سنتر.`;
    } else if (type === 'statement' && center) {
      text = `السلام عليكم أستاذ ${center.adminName}،\nمرفق ملخص كشف حساب سنتر ${center.nameAr} من منصة يلا سنتر.\n- الباقة: ${center.planNameAr}\n- تاريخ التجديد: ${center.subscriptionEndDate.slice(0, 10)}\nشاكرين ثقتكم الغالية.`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div className="bg-card text-foreground rounded-3xl border border-border w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-150">
        {/* Action Bar (Hidden on print) */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="cyan"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-bold gap-1.5 h-9"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند / PDF</span>
            </Button>

            <a
              href={getWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors h-9"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>إرسال واتساب للمسؤول</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 overflow-y-auto space-y-6 print:p-0 print:m-0" id="printable-area">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b-2 border-primary/20 pb-6">
            <div>
              <BrandLogo width={160} height={42} priority />
              <p className="text-xs text-muted-foreground mt-2">
                منظومة يلا سنتر السحابية المتكاملة لإدارة المراكز التعليمية
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Yalla Codex Software Solutions • support@yallacenter.com
              </p>
            </div>

            <div className="text-left font-mono" dir="ltr">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider mb-2">
                {type === 'invoice'
                  ? 'Tax / Subscription Invoice'
                  : type === 'receipt'
                  ? 'Official Receipt Voucher'
                  : 'Certified Account Statement'}
              </span>
              <div className="text-sm font-black text-foreground">
                {type === 'invoice'
                  ? invoice?.invoiceNumber
                  : type === 'receipt'
                  ? payment?.receiptNumber
                  : `STMT-${center?.slug?.toUpperCase() || 'YC'}`}
              </div>
              <div className="text-xs text-muted-foreground">
                Date: {new Date().toISOString().slice(0, 10)}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* TYPE 1: INVOICE */}
          {/* ================================================================ */}
          {type === 'invoice' && invoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-4 rounded-2xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">بيانات السنتر المستفيد:</span>
                  <strong className="text-sm font-bold text-foreground block">{invoice.tenantNameAr}</strong>
                  <span className="text-muted-foreground">المسؤول: {center?.adminName || 'مدير السنتر'}</span>
                  <span className="text-muted-foreground block font-mono">{center?.adminPhone || center?.phone || '—'}</span>
                </div>
                <div className="text-left" dir="ltr">
                  <span className="text-muted-foreground block text-[11px]">Subscription Period:</span>
                  <strong className="font-bold font-mono text-xs">{invoice.periodStart} to {invoice.periodEnd}</strong>
                  <span className="text-muted-foreground block text-[11px] mt-1">Due Date: {invoice.dueDate}</span>
                  <span className="text-emerald-600 font-bold text-xs block mt-0.5">
                    Status: {invoice.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b-2 border-border text-muted-foreground font-bold">
                    <th className="py-2.5 px-3">م</th>
                    <th className="py-2.5 px-3">البيان والخدمة</th>
                    <th className="py-2.5 px-3 text-left" dir="ltr">القيمة (ج.م)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-3 px-3 font-mono">1</td>
                    <td className="py-3 px-3">
                      <strong className="font-bold text-foreground block">{invoice.planNameAr}</strong>
                      <span className="text-[11px] text-muted-foreground">{invoice.notes || 'اشتراك شهري سحابي يتضمن استضافة السنتر وبوابات الطلاب والمدرسين وواتساب'}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-left" dir="ltr">
                      {invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {invoice.discount > 0 && (
                    <tr className="text-rose-600 dark:text-rose-400">
                      <td className="py-2.5 px-3 font-mono">2</td>
                      <td className="py-2.5 px-3">خصم ترويجي / خصم ولاء السنتر</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-left" dir="ltr">
                        - {invoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td colSpan={2} className="py-2.5 px-3 text-left">صافي المستحق:</td>
                    <td className="py-2.5 px-3 font-mono text-left font-black text-sm" dir="ltr">
                      {invoice.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                    </td>
                  </tr>
                  <tr className="text-emerald-600 dark:text-emerald-400 font-bold">
                    <td colSpan={2} className="py-2 px-3 text-left">المسدد فعلياً:</td>
                    <td className="py-2 px-3 font-mono text-left" dir="ltr">
                      {invoice.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                    </td>
                  </tr>
                  <tr className="border-t border-border font-bold text-foreground">
                    <td colSpan={2} className="py-2.5 px-3 text-left">المبلغ المتبقي:</td>
                    <td className="py-2.5 px-3 font-mono text-left text-sm text-rose-600 dark:text-rose-400" dir="ltr">
                      {Math.max(0, invoice.totalDue - invoice.amountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ================================================================ */}
          {/* TYPE 2: PAYMENT RECEIPT */}
          {/* ================================================================ */}
          {type === 'receipt' && payment && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-sm">سند قبض واستلام نقدية رسمي معتمد</span>
                </div>
                <p className="text-xs">
                  تم استلام المبلغ وقيده في الحسابات الرسمية لمنصة يلا سنتر.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-4 rounded-2xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">وصلنا من السادة:</span>
                  <strong className="text-sm font-bold text-foreground block">{payment.tenantNameAr}</strong>
                  <span className="text-muted-foreground">بواسطة: {center?.adminName || 'مسؤول السنتر'}</span>
                </div>
                <div className="text-left" dir="ltr">
                  <span className="text-muted-foreground block text-[11px]">Receipt No:</span>
                  <strong className="font-bold font-mono text-xs">{payment.receiptNumber}</strong>
                  <span className="text-muted-foreground block text-[11px] mt-1">Date: {payment.receivedAt.slice(0, 10)}</span>
                  <span className="text-muted-foreground block text-[11px]">Recorded By: {payment.recordedBy}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-card space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="font-bold text-muted-foreground">المبلغ المستلم:</span>
                  <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400" dir="ltr">
                    {payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">طريقة السداد:</span>
                  <span className="font-bold text-foreground">{payment.paymentMethod}</span>
                </div>
                {payment.referenceNumber && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">رقم الحوالة / المرجع:</span>
                    <span className="font-mono font-bold text-foreground" dir="ltr">{payment.referenceNumber}</span>
                  </div>
                )}
                {payment.notes && (
                  <div className="text-xs pt-2 border-t border-border text-muted-foreground">
                    <span className="font-bold text-foreground ml-1">ملاحظات:</span>
                    {payment.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TYPE 3: CENTER STATEMENT */}
          {/* ================================================================ */}
          {type === 'statement' && center && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[10px] text-muted-foreground block">الباقة الحالية</span>
                  <strong className="font-bold text-foreground text-xs">{center.planNameAr}</strong>
                </div>
                <div className="p-3 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[10px] text-muted-foreground block">تاريخ التجديد</span>
                  <strong className="font-mono font-bold text-foreground text-xs">{center.subscriptionEndDate.slice(0, 10)}</strong>
                </div>
                <div className="p-3 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[10px] text-muted-foreground block">حالة الاشتراك</span>
                  <strong className="font-bold text-emerald-600 text-xs">
                    {center.status === 'active' ? 'نشط' : 'تجريبي / موقوف'}
                  </strong>
                </div>
                <div className="p-3 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[10px] text-muted-foreground block">حالة السداد</span>
                  <strong className="font-bold text-foreground text-xs">
                    {center.paymentStatus === 'paid' ? 'مسدد بالكامل' : 'قيد السداد'}
                  </strong>
                </div>
              </div>

              {/* Movement Ledger Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground">جدول الحركات والقيود المالية المعتمدة:</h4>
                <table className="w-full text-[11px] text-right border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border text-muted-foreground font-bold">
                      <th className="py-2 px-2">التاريخ</th>
                      <th className="py-2 px-2">رقم الحركة</th>
                      <th className="py-2 px-2">نوع العملية</th>
                      <th className="py-2 px-2">البيان</th>
                      <th className="py-2 px-2 text-left" dir="ltr">مدين</th>
                      <th className="py-2 px-2 text-left" dir="ltr">دائن</th>
                      <th className="py-2 px-2 text-left" dir="ltr">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movements.map((m) => (
                      <tr key={m.id} className={m.status === 'reversed' ? 'opacity-40 line-through' : ''}>
                        <td className="py-2 px-2 font-mono">{m.date}</td>
                        <td className="py-2 px-2 font-mono font-bold">{m.movementNumber}</td>
                        <td className="py-2 px-2">{m.type}</td>
                        <td className="py-2 px-2 text-foreground font-medium">{m.description}</td>
                        <td className="py-2 px-2 font-mono text-left" dir="ltr">{m.debit > 0 ? m.debit.toLocaleString() : '—'}</td>
                        <td className="py-2 px-2 font-mono text-left text-emerald-600" dir="ltr">{m.credit > 0 ? m.credit.toLocaleString() : '—'}</td>
                        <td className="py-2 px-2 font-mono font-bold text-left" dir="ltr">{m.balanceAfter.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Signature & Stamp Section */}
          <div className="pt-8 border-t border-border grid grid-cols-2 gap-8 text-xs text-center text-muted-foreground">
            <div>
              <p className="font-bold text-foreground">توقيع الإدارة المالية لـ يلا سنتر</p>
              <div className="h-14 flex items-center justify-center font-serif italic text-slate-400">
                Yalla Center Accounts Dept.
              </div>
              <p className="text-[10px]">منصة يلا سنتر التعليمية السحابية</p>
            </div>
            <div>
              <p className="font-bold text-foreground">الختم والاعتماد الرسمي</p>
              <div className="h-14 flex items-center justify-center">
                <span className="p-2 rounded-full border-2 border-primary/30 text-primary text-[10px] font-bold rotate-[-12deg] inline-block">
                  YALLA CENTER CERTIFIED ✓
                </span>
              </div>
              <p className="text-[10px]">مستند رسمي صادر سحابياً</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
