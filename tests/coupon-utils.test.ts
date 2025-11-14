import { Coupon, DiscountType } from '@prisma/client';
import { vi } from 'vitest';

import { validateAndCalculateCoupon } from '../src/modules/coupons/coupon-utils';
import { prisma } from '../src/config/prisma';

vi.mock('../src/config/prisma', () => ({
  prisma: {
    coupon: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Coupon Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAndCalculateCoupon', () => {
    const baseCoupon: Coupon = {
      id: 'coupon-id',
      code: 'TEST10',
      description: 'Test coupon',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minPurchase: null,
      maxDiscount: null,
      usageLimit: null,
      usageCount: 0,
      validFrom: new Date(Date.now() - 86400000), // Yesterday
      validUntil: new Date(Date.now() + 86400000), // Tomorrow
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should validate coupon when passed as string code', async () => {
      vi.mocked(prisma.coupon.findUnique).mockResolvedValue(baseCoupon);

      const result = await validateAndCalculateCoupon('TEST10', 10000);

      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'TEST10' } });
      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(1000); // 10% of 10000
      expect(result.coupon).toEqual({
        id: baseCoupon.id,
        code: baseCoupon.code,
        discountType: baseCoupon.discountType,
        discountValue: baseCoupon.discountValue,
      });
    });

    it('should validate coupon when passed as Coupon object', async () => {
      const result = await validateAndCalculateCoupon(baseCoupon, 10000);

      expect(prisma.coupon.findUnique).not.toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(1000);
    });

    it('should return error when coupon not found', async () => {
      vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);

      const result = await validateAndCalculateCoupon('INVALID', 10000);

      expect(result.valid).toBe(false);
      expect(result.discountCents).toBe(0);
      expect(result.error).toBe('Coupon not found');
    });

    it('should return error when coupon is inactive', async () => {
      const inactiveCoupon = { ...baseCoupon, active: false };

      const result = await validateAndCalculateCoupon(inactiveCoupon, 10000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not active');
    });

    it('should return error when coupon is not yet valid', async () => {
      const futureCoupon = {
        ...baseCoupon,
        validFrom: new Date(Date.now() + 86400000), // Tomorrow
        validUntil: new Date(Date.now() + 172800000), // Day after tomorrow
      };

      const result = await validateAndCalculateCoupon(futureCoupon, 10000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon is not yet valid');
    });

    it('should return error when coupon has expired', async () => {
      const expiredCoupon = {
        ...baseCoupon,
        validFrom: new Date(Date.now() - 172800000), // Two days ago
        validUntil: new Date(Date.now() - 86400000), // Yesterday
      };

      const result = await validateAndCalculateCoupon(expiredCoupon, 10000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon has expired');
    });

    it('should return error when usage limit reached', async () => {
      const limitReachedCoupon = {
        ...baseCoupon,
        usageLimit: 10,
        usageCount: 10,
      };

      const result = await validateAndCalculateCoupon(limitReachedCoupon, 10000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon usage limit reached');
    });

    it('should allow usage when usageCount is less than limit', async () => {
      const withinLimitCoupon = {
        ...baseCoupon,
        usageLimit: 10,
        usageCount: 5,
      };

      const result = await validateAndCalculateCoupon(withinLimitCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(1000);
    });

    it('should allow usage when usageLimit is null', async () => {
      const noLimitCoupon = {
        ...baseCoupon,
        usageLimit: null,
        usageCount: 100,
      };

      const result = await validateAndCalculateCoupon(noLimitCoupon, 10000);

      expect(result.valid).toBe(true);
    });

    it('should return error when minimum purchase not met', async () => {
      const minPurchaseCoupon = {
        ...baseCoupon,
        minPurchase: 5000,
      };

      const result = await validateAndCalculateCoupon(minPurchaseCoupon, 3000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum purchase of 50 required');
    });

    it('should allow when minimum purchase is met', async () => {
      const minPurchaseCoupon = {
        ...baseCoupon,
        minPurchase: 5000,
      };

      const result = await validateAndCalculateCoupon(minPurchaseCoupon, 10000);

      expect(result.valid).toBe(true);
    });

    it('should allow when minPurchase is null', async () => {
      const noMinCoupon = {
        ...baseCoupon,
        minPurchase: null,
      };

      const result = await validateAndCalculateCoupon(noMinCoupon, 1000);

      expect(result.valid).toBe(true);
    });

    it('should calculate percentage discount correctly', async () => {
      const percentageCoupon = {
        ...baseCoupon,
        discountType: 'PERCENTAGE' as DiscountType,
        discountValue: 20,
      };

      const result = await validateAndCalculateCoupon(percentageCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(2000); // 20% of 10000
    });

    it('should apply maxDiscount cap for percentage coupons', async () => {
      const maxDiscountCoupon = {
        ...baseCoupon,
        discountType: 'PERCENTAGE' as DiscountType,
        discountValue: 50, // 50% discount
        maxDiscount: 2000, // But capped at 2000
      };

      const result = await validateAndCalculateCoupon(maxDiscountCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(2000); // Capped at maxDiscount, not 5000
    });

    it('should not apply maxDiscount when null for percentage coupons', async () => {
      const noMaxCoupon = {
        ...baseCoupon,
        discountType: 'PERCENTAGE' as DiscountType,
        discountValue: 50,
        maxDiscount: null,
      };

      const result = await validateAndCalculateCoupon(noMaxCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(5000); // Full 50% discount
    });

    it('should calculate fixed amount discount correctly', async () => {
      const fixedCoupon = {
        ...baseCoupon,
        discountType: 'FIXED_AMOUNT' as DiscountType,
        discountValue: 5000,
      };

      const result = await validateAndCalculateCoupon(fixedCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(5000);
    });

    it('should cap discount at total amount for percentage', async () => {
      const highPercentageCoupon = {
        ...baseCoupon,
        discountType: 'PERCENTAGE' as DiscountType,
        discountValue: 150, // 150% discount (would exceed total)
      };

      const result = await validateAndCalculateCoupon(highPercentageCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(10000); // Capped at total
    });

    it('should cap discount at total amount for fixed amount', async () => {
      const highFixedCoupon = {
        ...baseCoupon,
        discountType: 'FIXED_AMOUNT' as DiscountType,
        discountValue: 15000, // More than total
      };

      const result = await validateAndCalculateCoupon(highFixedCoupon, 10000);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(10000); // Capped at total
    });

    it('should handle zero total amount', async () => {
      const result = await validateAndCalculateCoupon(baseCoupon, 0);

      expect(result.valid).toBe(true);
      expect(result.discountCents).toBe(0);
    });

    it('should handle usageLimit of 0 correctly', async () => {
      const zeroLimitCoupon = {
        ...baseCoupon,
        usageLimit: 0,
        usageCount: 0,
      };

      const result = await validateAndCalculateCoupon(zeroLimitCoupon, 10000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Coupon usage limit reached');
    });

    it('should handle minPurchase of 0 correctly', async () => {
      const zeroMinCoupon = {
        ...baseCoupon,
        minPurchase: 0,
      };

      const result = await validateAndCalculateCoupon(zeroMinCoupon, 1000);

      expect(result.valid).toBe(true);
    });
  });
});
