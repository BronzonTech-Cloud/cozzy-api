import { z } from 'zod';
import { DiscountType } from '@prisma/client';

export const createCouponSchema = z
  .object({
    code: z.string().min(1).max(50),
    description: z.string().max(500).optional(),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().int().positive().max(10000, 'Discount value cannot exceed 10000'),
    minPurchase: z
      .number()
      .int()
      .nonnegative('minPurchase must be a non-negative integer')
      .optional(),
    maxDiscount: z
      .number()
      .int()
      .nonnegative('maxDiscount must be a non-negative integer')
      .optional(),
    usageLimit: z
      .number()
      .int()
      .nonnegative('usageLimit must be a non-negative integer')
      .optional(),
    validFrom: z.string().datetime('Invalid date format for validFrom'),
    validUntil: z.string().datetime('Invalid date format for validUntil'),
    active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Percentage discounts must be between 1 and 100
      if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage discount must be between 1 and 100',
      path: ['discountValue'],
    },
  );

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  totalCents: z.number().int().min(0),
});
