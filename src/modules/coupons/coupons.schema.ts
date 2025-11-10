import { z } from 'zod';
import { DiscountType } from '@prisma/client';

export const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().int().positive(),
  minPurchase: z.number().int().positive().optional(),
  maxDiscount: z.number().int().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  active: z.boolean().default(true),
});

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  totalCents: z.number().int().min(0),
});

