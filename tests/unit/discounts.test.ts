import { describe, it, expect } from 'vitest';
import { calculateDiscount, normalizeDiscountType } from '@/lib/finance/discounts';

describe('Discount & Scholarship Calculation Engine (FEAT-17 & FEAT-19)', () => {
  describe('Normalization of Discount Types', () => {
    it('normalizes lowercase and uppercase discount strings to canonical form', () => {
      expect(normalizeDiscountType('none')).toBe('NONE');
      expect(normalizeDiscountType('NONE')).toBe('NONE');
      expect(normalizeDiscountType('percentage')).toBe('PERCENT');
      expect(normalizeDiscountType('PERCENT')).toBe('PERCENT');
      expect(normalizeDiscountType('percent')).toBe('PERCENT');
      expect(normalizeDiscountType('fixed')).toBe('FIXED');
      expect(normalizeDiscountType('FIXED')).toBe('FIXED');
      expect(normalizeDiscountType('free_100')).toBe('SCHOLARSHIP_100');
      expect(normalizeDiscountType('SCHOLARSHIP_100')).toBe('SCHOLARSHIP_100');
      expect(normalizeDiscountType('free')).toBe('SCHOLARSHIP_100');
      expect(normalizeDiscountType(undefined)).toBe('NONE');
    });
  });

  describe('Standard Discount Calculations', () => {
    it('returns full base price when discount type is NONE', () => {
      const result = calculateDiscount(300, 'NONE', 0);
      expect(result.basePrice).toBe(300);
      expect(result.discountAmount).toBe(0);
      expect(result.netPrice).toBe(300);
      expect(result.isFullScholarship).toBe(false);
      expect(result.effectiveDiscountPercentage).toBe(0);
      expect(result.discountAmount + result.netPrice).toBe(result.basePrice);
    });

    it('calculates percentage discount accurately (e.g. 20% on 300 EGP = 60 discount, 240 net)', () => {
      const result = calculateDiscount(300, 'PERCENT', 20);
      expect(result.basePrice).toBe(300);
      expect(result.discountAmount).toBe(60);
      expect(result.netPrice).toBe(240);
      expect(result.isFullScholarship).toBe(false);
      expect(result.effectiveDiscountPercentage).toBe(20);
      expect(result.discountAmount + result.netPrice).toBe(result.basePrice);
    });

    it('calculates fixed amount discount accurately (e.g. 50 EGP on 300 EGP = 250 net)', () => {
      const result = calculateDiscount(300, 'FIXED', 50);
      expect(result.basePrice).toBe(300);
      expect(result.discountAmount).toBe(50);
      expect(result.netPrice).toBe(250);
      expect(result.isFullScholarship).toBe(false);
      expect(result.discountAmount + result.netPrice).toBe(result.basePrice);
    });

    it('calculates 100% full scholarship (SCHOLARSHIP_100 / free_100) yielding 0.00 EGP net', () => {
      const result = calculateDiscount(300, 'SCHOLARSHIP_100', 0);
      expect(result.basePrice).toBe(300);
      expect(result.discountAmount).toBe(300);
      expect(result.netPrice).toBe(0);
      expect(result.isFullScholarship).toBe(true);
      expect(result.effectiveDiscountPercentage).toBe(100);
      expect(result.discountAmount + result.netPrice).toBe(result.basePrice);
    });
  });

  describe('Object Input Signature Compatibility', () => {
    it('supports object argument signature { basePrice, discountType, discountValue }', () => {
      const res = calculateDiscount({
        basePrice: 200,
        discountType: 'percentage',
        discountValue: 15,
      });
      expect(res.basePrice).toBe(200);
      expect(res.discountAmount).toBe(30);
      expect(res.netPrice).toBe(170);
      expect(res.discountAmount + res.netPrice).toBe(res.basePrice);
    });
  });

  describe('Boundary Conditions & Non-Negativity Invariants', () => {
    it('caps fixed discount at base price when discountValue exceeds basePrice', () => {
      // 500 EGP discount on 300 EGP course -> capped at 300 discount, netPrice = 0
      const result = calculateDiscount(300, 'FIXED', 500);
      expect(result.basePrice).toBe(300);
      expect(result.discountAmount).toBe(300);
      expect(result.netPrice).toBe(0);
      expect(result.isFullScholarship).toBe(true);
      expect(result.discountAmount + result.netPrice).toBe(result.basePrice);
    });

    it('clamps percentage discount above 100% to 100%', () => {
      const result = calculateDiscount(250, 'PERCENT', 150);
      expect(result.basePrice).toBe(250);
      expect(result.discountAmount).toBe(250);
      expect(result.netPrice).toBe(0);
      expect(result.isFullScholarship).toBe(true);
    });

    it('handles negative discount value gracefully as 0 (no negative discounts)', () => {
      const result = calculateDiscount(200, 'FIXED', -50);
      expect(result.basePrice).toBe(200);
      expect(result.discountAmount).toBe(0);
      expect(result.netPrice).toBe(200);
    });

    it('handles zero basePrice safely without NaN', () => {
      const result = calculateDiscount(0, 'PERCENT', 50);
      expect(result.basePrice).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.netPrice).toBe(0);
      expect(result.isFullScholarship).toBe(true);
      expect(Number.isNaN(result.netPrice)).toBe(false);
    });
  });

  describe('Zero Rounding Leakage Invariant Proof', () => {
    it('preserves exact basePrice identity (discountAmount + netPrice === basePrice) across odd prices', () => {
      const oddPrices = [33.33, 99.99, 127.50, 456.78, 1234.56];
      const percentages = [7, 13, 17, 33, 67];

      for (const price of oddPrices) {
        for (const pct of percentages) {
          const res = calculateDiscount(price, 'PERCENT', pct);
          const sum = Math.round((res.discountAmount + res.netPrice) * 100) / 100;
          expect(sum).toBe(res.basePrice);
          expect(res.netPrice).toBeGreaterThanOrEqual(0);
          expect(res.discountAmount).toBeLessThanOrEqual(res.basePrice);
        }
      }
    });
  });
});
