'use client';

import { Calculator, Sparkles, Building2, Receipt, Users } from 'lucide-react';
import type { PricingModel } from '@/lib/dal/types';
import { splitPrivateFee } from '@/lib/finance/group-pricing';
import { GROUP_PRICING_LABELS, moneyAmount, type GroupPricing } from '@/lib/timetable/group-schedule';

const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
export type PricingAmounts = Partial<
  Record<
    | 'monthlyFee'
    | 'teacherRate'
    | 'teacherPercentage'
    | 'centerPercentage'
    | 'sessionFee'
    | 'ratePerStudent'
    | 'studentFee'
    | 'teacherFee'
    | 'centerFee',
    string
  >
>;

export function PricingFields({
  model,
  values,
  control,
  label = 'طريقة حساب مستحقات المعلم',
  required,
  onModel,
  onAmount,
}: {
  model: PricingModel | '';
  values: PricingAmounts;
  control: string;
  label?: string;
  required?: boolean;
  onModel: (model: PricingModel) => void;
  onAmount: (field: keyof PricingAmounts, value: string) => void;
}) {
  function amount(field: keyof PricingAmounts, name: string, max = 1000000, step = '0.5') {
    return (
      <label className="min-w-0 space-y-1.5 text-xs font-bold text-foreground block">
        <span>{name}</span>
        <div className="relative">
          <input
            className={control}
            type="number"
            min="0"
            step={step}
            max={max}
            required={required}
            value={values[field] ?? ''}
            onChange={(event) => {
              const val = event.target.value;
              onAmount(field, val);
              if (field === 'teacherPercentage') {
                const num = parseFloat(val) || 0;
                onAmount('centerPercentage', String(Math.max(0, 100 - num)));
              }
            }}
          />
        </div>
      </label>
    );
  }

  const teacherPercentage = Number(values.teacherPercentage ?? 0);
  const centerPercentage = Number(values.centerPercentage ?? (100 - teacherPercentage));
  const monthlyFee = Number(values.monthlyFee ?? 0);
  const teacherRate = Number(values.teacherRate ?? 0);
  const sessionFee = Number(values.sessionFee ?? 0);
  const ratePerStudent = Number(values.ratePerStudent ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <label className="min-w-0 space-y-1.5 text-xs font-bold text-foreground block">
          <span>{label}</span>
          <select
            className={control}
            value={model}
            required={required}
            onChange={(event) => onModel(event.target.value as PricingModel)}
          >
            {model === '' && (
              <option value="" disabled>
                اختر طريقة الحساب
              </option>
            )}
            <option value="center">{GROUP_PRICING_LABELS.center}</option>
            <option value="fixed_session">{GROUP_PRICING_LABELS.fixed_session}</option>
            <option value="private">{GROUP_PRICING_LABELS.private}</option>
            <option value="per_attendee">{GROUP_PRICING_LABELS.per_attendee}</option>
            {model === 'per_session' && (
              <option value="per_session">{GROUP_PRICING_LABELS.per_session}</option>
            )}
          </select>
        </label>

        {/* 1. نظام السنتر — متوسط الحضور */}
        {model === 'center' && (
          <>
            {amount('teacherRate', 'سعر الطالب للمعلم في الشهر (ج.م)')}
            {amount('monthlyFee', 'مصروفات الطالب الشهرية (ج.م)')}
          </>
        )}

        {/* 2. أجر ثابت للحصة */}
        {model === 'fixed_session' && (
          <>
            {amount('sessionFee', 'الأجر الثابت للحصة (مبلغ مقطوع للمعلم ج.م)')}
            {amount('centerFee', 'رسم الحصة للطالب / السنتر (ج.م) [اختياري]')}
          </>
        )}

        {/* 3. نظام البرايفت — النسبة المئوية */}
        {model === 'private' && (
          <>
            {amount('monthlyFee', 'سعر اشتراك الطالب الشهري (ج.م)')}
            {amount('teacherPercentage', 'نسبة المعلم (%)', 100, '1')}
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-foreground block">
              <span>نسبة السنتر (%) [تلقائي]</span>
              <input
                className={`${control} bg-muted/50 cursor-not-allowed`}
                type="number"
                readOnly
                value={100 - teacherPercentage}
              />
            </label>
          </>
        )}

        {/* 4. أجر ثابت لكل طالب حاضر */}
        {model === 'per_attendee' && (
          <>
            {amount('ratePerStudent', 'أجر المعلم عن كل طالب حاضر في الحصة (ج.م)')}
            {amount('studentFee', 'رسم الحصة للطالب (ج.م) [اختياري]')}
          </>
        )}

        {/* Legacy per_session */}
        {model === 'per_session' && (
          <>
            {amount('teacherFee', 'نصيب المعلم لكل طالب في الحصة (ج.م)')}
            {amount('centerFee', 'نصيب السنتر لكل طالب في الحصة (ج.م)')}
          </>
        )}
      </div>

      {/* Interactive Explanation & Live Example Cards */}
      {model === 'center' && (
        <div className="rounded-xl border border-brand-cyan-500/30 bg-brand-cyan-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-black text-brand-cyan-700 dark:text-brand-cyan-300">
            <Building2 className="w-4 h-4" />
            <span>نظام السنتر — متوسط الحضور</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            <b>معادلة الاحتساب:</b> متوسط الحضور = إجمالي الحضور الصالح في الشهر ÷ عدد الحصص المنعقدة.
            <br />
            مستحق المعلم = متوسط الحضور × الفئة المتفق عليها للرأس ({teacherRate || 0} ج.م).
            <br />
            <span className="text-[11px] text-muted-foreground/80">
              * تُستبعد الحصص الملغاة تماماً من البسط والمقام لمنع الإضرار بمتوسط الحضور.
            </span>
          </p>
          <div className="bg-background/80 p-2.5 rounded-lg border border-border flex items-center justify-between font-mono text-[11px]">
            <span>مثال حي تفاعلي: إذا حضر بمتوسط 20 طالباً</span>
            <span className="font-bold text-brand-cyan-600">
              20 × {teacherRate || 50} = {(20 * (teacherRate || 50)).toFixed(2)} ج.م مستحق
            </span>
          </div>
        </div>
      )}

      {model === 'fixed_session' && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-black text-blue-700 dark:text-blue-300">
            <Receipt className="w-4 h-4" />
            <span>نظام الأجر الثابت للحصة</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            <b>معادلة الاحتساب:</b> يستحق المعلم مبلغاً ثابتاً قدره ({sessionFee || 0} ج.م) عن كل حصة تم انعقادها بالفعل بغض النظر عن عدد الطلاب الحاضرين.
            <br />
            <span className="text-[11px] text-muted-foreground/80">
              * الحصص الملغاة أو غير المنعقدة لا يُصرف عنها أجر.
            </span>
          </p>
          <div className="bg-background/80 p-2.5 rounded-lg border border-border flex items-center justify-between font-mono text-[11px]">
            <span>مثال حي تفاعلي: انعقاد 8 حصص شهرياً</span>
            <span className="font-bold text-blue-600">
              8 × {sessionFee || 250} = {(8 * (sessionFee || 250)).toFixed(2)} ج.م مستحق
            </span>
          </div>
        </div>
      )}

      {model === 'private' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-4 h-4" />
            <span>نظام البرايفت — النسبة المئوية</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            <b>معادلة الاحتساب:</b> يتم توزيع صافي إيراد الاشتراكات الشهرية بعد خصم التخفيضات (النسبية والمقطوعة والمنح المجانية 100%) بنسبة {teacherPercentage || 0}% للمعلم و {100 - teacherPercentage}% للسنتر.
            <br />
            <span className="text-[11px] text-muted-foreground/80">
              * يتم الحساب شهرياً مرة واحدة لكل طالب مسجل بدون تكرار الحساب في كل حصة.
            </span>
          </p>
          <div className="bg-background/80 p-2.5 rounded-lg border border-border flex items-center justify-between font-mono text-[11px]">
            <span>مثال حي تفاعلي: اشتراك {monthlyFee || 500} ج.م لـ 10 طلاب</span>
            <span className="font-bold text-emerald-600">
              المعلم: {((10 * (monthlyFee || 500) * (teacherPercentage || 80)) / 100).toFixed(2)} ج.م ({teacherPercentage}%) · السنتر: {((10 * (monthlyFee || 500) * (100 - teacherPercentage)) / 100).toFixed(2)} ج.م
            </span>
          </div>
        </div>
      )}

      {model === 'per_attendee' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-300">
            <Users className="w-4 h-4" />
            <span>نظام الأجر الثابت لكل طالب حاضر</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            <b>معادلة الاحتساب:</b> يستحق المعلم ({ratePerStudent || 0} ج.م) عن كل طالب حضر الحصة فعلياً (حاضر أو متأخر).
            <br />
            <span className="text-[11px] text-muted-foreground/80">
              * الغائبون والمعذورون لا يُحسب لهم أجر، بينما يُحسب طلاب المنح والخصومات للمعلم كطالب حاضر كامل.
            </span>
          </p>
          <div className="bg-background/80 p-2.5 rounded-lg border border-border flex items-center justify-between font-mono text-[11px]">
            <span>مثال حي تفاعلي: حضور 22 طالباً في الحصة</span>
            <span className="font-bold text-amber-600">
              22 × {ratePerStudent || 15} = {(22 * (ratePerStudent || 15)).toFixed(2)} ج.م مستحق للحصة
            </span>
          </div>
        </div>
      )}

      {model === 'per_session' && (
        <p className="rounded-lg bg-muted/55 px-3 py-2 text-xs" aria-live="polite">
          سعر الحصة للطالب {currency.format(moneyAmount(Number(values.teacherFee ?? '') + Number(values.centerFee ?? '')))}
        </p>
      )}
    </div>
  );
}

export function pricingFormValues(pricing?: GroupPricing): PricingAmounts {
  if (!pricing) return {};
  switch (pricing.model) {
    case 'center':
      return {
        monthlyFee: String(pricing.monthlyFee ?? 0),
        teacherRate: String(pricing.teacherRate ?? ''),
      };
    case 'fixed_session':
      return {
        sessionFee: String(pricing.sessionFee ?? ''),
        centerFee: String(pricing.centerFee ?? 0),
      };
    case 'private':
      return {
        monthlyFee: String(pricing.monthlyFee ?? ''),
        teacherPercentage: String(pricing.teacherPercentage ?? ''),
        centerPercentage: String(pricing.centerPercentage ?? (100 - Number(pricing.teacherPercentage || 0))),
      };
    case 'per_attendee':
      return {
        ratePerStudent: String(pricing.ratePerStudent ?? ''),
        studentFee: String(pricing.studentFee ?? 0),
      };
    case 'per_session':
      return {
        teacherFee: String(pricing.teacherFee ?? ''),
        centerFee: String(pricing.centerFee ?? ''),
      };
  }
}

export function pricingFormInput(model: PricingModel, values: PricingAmounts) {
  const num = (v?: string) => (v !== undefined && v.trim() !== '' ? Number(v) : undefined);
  switch (model) {
    case 'center':
      return {
        model: 'center' as const,
        monthlyFee: num(values.monthlyFee) ?? 0,
        teacherRate: num(values.teacherRate) ?? 0,
      };
    case 'fixed_session':
      return {
        model: 'fixed_session' as const,
        sessionFee: num(values.sessionFee) ?? 0,
        centerFee: num(values.centerFee) ?? 0,
      };
    case 'private': {
      const teacherPct = num(values.teacherPercentage) ?? 0;
      return {
        model: 'private' as const,
        monthlyFee: num(values.monthlyFee) ?? 0,
        teacherPercentage: teacherPct,
        centerPercentage: num(values.centerPercentage) ?? (100 - teacherPct),
      };
    }
    case 'per_attendee':
      return {
        model: 'per_attendee' as const,
        ratePerStudent: num(values.ratePerStudent) ?? 0,
        studentFee: num(values.studentFee) ?? 0,
      };
    case 'per_session':
      return {
        model: 'per_session' as const,
        teacherFee: num(values.teacherFee) ?? 0,
        centerFee: num(values.centerFee) ?? 0,
      };
  }
}
