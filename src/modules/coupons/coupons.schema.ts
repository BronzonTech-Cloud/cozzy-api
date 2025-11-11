import { z } from 'zod';
import { DiscountType } from '@prisma/client';

export const createCouponSchema = z
  .object({
    code: z.string().min(1).max(50),
    description: z.string().max(500).optional(),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().int().positive().max(10000, 'Discount value cannot exceed 10000'),
    minPurchase: z.number().int().positive().optional(),
    maxDiscount: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
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
