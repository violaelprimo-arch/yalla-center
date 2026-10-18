'use client';

import React, { useState } from 'react';
import { CreditCard, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { User, PaymentMethod } from '@/lib/dal/types';

interface QuickPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  onPaymentSuccess: (student: User, amount: number) => void;
}

export function QuickPaymentModal({
  isOpen,
  onClose,
  student,
  onPaymentSuccess,
}: QuickPaymentModalProps) {
  const [amount, setAmount] = useState<string>(student ? String(student.balanceDue) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize amount when student changes
  React.useEffect(() => {
    if (student) {
      setAmount(String(student.balanceDue));
      setErrorMessage(null);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Simulate/execute fast payment registration
      const newBalance = Math.max(0, student.balanceDue - numericAmount);
      const updatedStudent: User = {
        ...student,
        balanceDue: newBalance,
      };

      onPaymentSuccess(updatedStudent, numericAmount);
      onClose();
    } catch {
      setErrorMessage('تعذر تسجيل الدفعة المالية، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="card-elevated w-full max-w-md rounded-3xl border border-border overflow-hidden shadow-2xl bg-card text-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">تحصيل فوري عند الاستقبال</h3>
              <p className="text-xs text-muted-foreground">تسجيل سداد نقدي أو إلكتروني سريع</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Student Summary */}
          <div className="p-3.5 rounded-2xl bg-muted/50 border border-border space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">اسم الطالب:</span>
              <span className="font-bold text-foreground">{student.fullName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">كود الطالب:</span>
              <span className="font-mono font-bold text-foreground">{student.studentCode || student.id}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-border/60">
              <span className="text-amber-600 dark:text-amber-400 font-bold">إجمالي المستحق:</span>
              <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                {student.balanceDue.toFixed(2)} ج.م
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              المبلغ المحصل (ج.م) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="1"
                max={student.balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3 pl-12 rounded-xl border border-border bg-background text-foreground font-mono text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                required
              />
              <span className="absolute left-3 top-3 text-xs text-muted-foreground font-bold pointer-events-none">
                ج.م
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">طريقة الدفع *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cash', label: 'نقدي (Cash)' },
                { id: 'vodafone_cash', label: 'فودافون كاش' },
                { id: 'instapay', label: 'إنستاباي (InstaPay)' },
                { id: 'card', label: 'بطاقة بنكية (Card)' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMethod(m.id as PaymentMethod)}
                  className={`h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    method === m.id
                      ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground block">
              ملاحظات إيصال التحصيل (اختياري)
            </label>
            <input
              type="text"
              placeholder="مثال: سداد قسط أول لشهر أكتوبر..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 text-sm shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التسجيل...' : 'تأكيد السداد والطباعة'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 px-4 text-xs"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
