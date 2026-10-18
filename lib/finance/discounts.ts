export type DiscountType = 'none' | 'percentage' | 'fixed' | 'free_100' | 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100';
export type CanonicalDiscountType = 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100';

export interface DiscountInputObject {
  basePrice: number;
  discountType?: DiscountType;
  discountValue?: number;
}

export interface DiscountResult {
  basePrice: number;
  discountType: CanonicalDiscountType;
  discountValue: number;
  discountAmount: number;
  netPrice: number;
  isFullScholarship: boolean;
  effectiveDiscountPercentage: number;
}

/**
 * Normalizes input discount type to canonical uppercase format
 */
export function normalizeDiscountType(type?: DiscountType | string): CanonicalDiscountType {
  if (!type) return 'NONE';
  const upper = type.toUpperCase();
  if (upper === 'PERCENT' || upper === 'PERCENTAGE') return 'PERCENT';
  if (upper === 'FIXED') return 'FIXED';
  if (upper === 'SCHOLARSHIP_100' || upper === 'FREE_100' || upper === 'FREE') return 'SCHOLARSHIP_100';
  return 'NONE';
}

/**
 * Universal Discount & Scholarship Calculation Function
 * Supports both function signatures:
 * 1. calculateDiscount(basePrice: number, discountType?: DiscountType, discountValue?: number)
 * 2. calculateDiscount(input: DiscountInputObject)
 *
 * Mathematical Invariants:
 * - discountAmount <= basePrice
 * - netPrice >= 0
 * - discountAmount + netPrice === basePrice (Zero Rounding Leakage)
 */
export function calculateDiscount(
  basePriceOrInput: number | DiscountInputObject,
  discountTypeArg?: DiscountType,
  discountValueArg?: number
): DiscountResult {
  let basePrice: number;
  let rawType: DiscountType | undefined;
  let rawValue: number | undefined;

  if (typeof basePriceOrInput === 'object' && basePriceOrInput !== null) {
    basePrice = basePriceOrInput.basePrice;
    rawType = basePriceOrInput.discountType;
    rawValue = basePriceOrInput.discountValue;
  } else {
    basePrice = basePriceOrInput;
    rawType = discountTypeArg;
    rawValue = discountValueArg;
  }

  const gross = Math.max(0, Math.round((basePrice || 0) * 100) / 100);
  const type = normalizeDiscountType(rawType);
  const val = Math.max(0, rawValue || 0);

  if (gross === 0) {
    return {
      basePrice: 0,
      discountType: type,
      discountValue: val,
      discountAmount: 0,
      netPrice: 0,
      isFullScholarship: true,
      effectiveDiscountPercentage: 100,
    };
  }

  let discountAmount = 0;
  let effectiveDiscountPercentage = 0;

  switch (type) {
    case 'SCHOLARSHIP_100': {
      discountAmount = gross;
      effectiveDiscountPercentage = 100;
      break;
    }
    case 'PERCENT': {
      const clampedPct = Math.min(100, val);
      discountAmount = Math.round(gross * (clampedPct / 100) * 100) / 100;
      effectiveDiscountPercentage = clampedPct;
      break;
    }
    case 'FIXED': {
      discountAmount = Math.min(gross, Math.round(val * 100) / 100);
      effectiveDiscountPercentage = Math.round((discountAmount / gross) * 10000) / 100;
      break;
    }
    case 'NONE':
    default: {
      discountAmount = 0;
      effectiveDiscountPercentage = 0;
      break;
    }
  }

  // Ensure bounds
  discountAmount = Math.min(gross, Math.max(0, discountAmount));
  const netPrice = Math.max(0, Math.round((gross - discountAmount) * 100) / 100);

  return {
    basePrice: gross,
    discountType: type,
    discountValue: val,
    discountAmount,
    netPrice,
    isFullScholarship: netPrice === 0,
    effectiveDiscountPercentage,
  };
}
