'use client';

import type { PricingModel } from '@/lib/dal/types';
import { splitPrivateFee } from '@/lib/finance/group-pricing';
import { GROUP_PRICING_LABELS, moneyAmount, type GroupPricing } from '@/lib/timetable/group-schedule';

const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
type PricingAmounts = Partial<Record<'monthlyFee' | 'teacherRate' | 'teacherPercentage' | 'teacherFee' | 'centerFee', string>>;

export function PricingFields({ model, values, control, label = 'طريقة الحساب', required, onModel, onAmount }: {
  model: PricingModel | '';
  values: PricingAmounts;
  control: string;
  label?: string;
  required?: boolean;
  onModel: (model: PricingModel) => void;
  onAmount: (field: keyof typeof values, value: string) => void;
}) {
  function amount(field: keyof typeof values, name: string, max = 1000000) {
    return <label className="min-w-0 space-y-1 text-sm font-semibold"><span>{name}</span>
      <input className={control} type="number" min="0" step="0.01" max={max} required={required}
        value={values[field] ?? ''} onChange={event => onAmount(field, event.target.value)} />
    </label>;
  }

  const percentage = Number(values.teacherPercentage ?? '');
  const privateShares = splitPrivateFee(Number(values.monthlyFee ?? ''), percentage);
  return <>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="min-w-0 space-y-1 text-sm font-semibold"><span>{label}</span>
        <select className={control} value={model} required={required} onChange={event => onModel(event.target.value as PricingModel)}>
          {model === '' && <option value="" disabled>اختر طريقة الحساب</option>}
          {Object.entries(GROUP_PRICING_LABELS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      {(model === 'center' || model === 'private') && amount('monthlyFee', 'مصروفات الطالب الشهرية (ج.م)')}
      {model === 'center' && amount('teacherRate', 'سعر الطالب للمعلم في الشهر (ج.م)')}
      {model === 'private' && amount('teacherPercentage', 'نسبة المعلم (%)', 100)}
      {model === 'per_session' && <>
        {amount('teacherFee', 'نصيب المعلم لكل طالب في الحصة (ج.م)')}
        {amount('centerFee', 'نصيب السنتر لكل طالب في الحصة (ج.م)')}
      </>}
    </div>
    {model && <p className="rounded-lg bg-muted/55 px-3 py-2 text-sm" aria-live="polite">
      {model === 'center' && 'مستحق المعلم الشهري = متوسط حضور الحصص المنعقدة × سعر الطالب للمعلم.'}
      {model === 'private' && `المعلم ${currency.format(privateShares.teacher)} · السنتر ${moneyAmount(100 - percentage)}% (${currency.format(privateShares.center)}) لكل طالب شهريًا`}
      {model === 'per_session' && `سعر الحصة للطالب ${currency.format(moneyAmount(Number(values.teacherFee ?? '') + Number(values.centerFee ?? '')))}`}
    </p>}
  </>;
}

export function pricingFormValues(pricing?: GroupPricing): PricingAmounts {
  if (!pricing) return {};
  switch (pricing.model) {
    case 'center': return { monthlyFee: String(pricing.monthlyFee), teacherRate: String(pricing.teacherRate) };
    case 'private': return { monthlyFee: String(pricing.monthlyFee), teacherPercentage: String(pricing.teacherPercentage) };
    case 'per_session': return { teacherFee: String(pricing.teacherFee), centerFee: String(pricing.centerFee) };
  }
}

export function pricingFormInput(model: PricingModel, values: PricingAmounts) {
  return { model, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value?.trim() ? Number(value) : undefined])) };
}
