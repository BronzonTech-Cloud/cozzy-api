import { Coupon, DiscountType } from '@prisma/client';

import { prisma } from '../../config/prisma';

export interface CouponValidationResult {
  valid: boolean;
  discountCents: number;
  coupon?: {
    id: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
  };
  error?: string;
}

/**
 * Validate and calculate discount for a coupon
 * Accepts either a coupon code (string) or a Coupon object to avoid double lookups
 */
export async function validateAndCalculateCoupon(
  couponOrCode: string | Coupon,
  totalCents: number,
): Promise<CouponValidationResult> {
  // If string, fetch coupon by code; if object, use it directly
  const coupon =
    typeof couponOrCode === 'string'
      ? await prisma.coupon.findUnique({ where: { code: couponOrCode } })
      : couponOrCode;

  if (!coupon) {
    return { valid: false, discountCents: 0, error: 'Coupon not found' };
  }

  // Check if coupon is active
  if (!coupon.active) {
    return { valid: false, discountCents: 0, error: 'Coupon is not active' };
  }

  // Check validity dates
  const now = new Date();
  if (now < coupon.validFrom) {
    return { valid: false, discountCents: 0, error: 'Coupon is not yet valid' };
  }
  if (now > coupon.validUntil) {
    return { valid: false, discountCents: 0, error: 'Coupon has expired' };
  }

  // Check usage limit
  // Explicitly check for null/undefined to enforce usageLimit = 0
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, discountCents: 0, error: 'Coupon usage limit reached' };
  }

  // Check minimum purchase
  if (coupon.minPurchase && totalCents < coupon.minPurchase) {
    return {
      valid: false,
      discountCents: 0,
      error: `Minimum purchase of ${coupon.minPurchase / 100} required`,
    };
  }

  // Calculate discount
  let discountCents = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountCents = Math.floor((totalCents * coupon.discountValue) / 100);
    if (coupon.maxDiscount) {
      discountCents = Math.min(discountCents, coupon.maxDiscount);
    }
  } else {
    // FIXED_AMOUNT
    discountCents = coupon.discountValue;
  }

  // Ensure discount doesn't exceed total
  discountCents = Math.min(discountCents, totalCents);

  return {
    valid: true,
    discountCents,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
  };
}
