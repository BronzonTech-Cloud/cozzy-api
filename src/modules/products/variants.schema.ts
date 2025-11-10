import { z } from 'zod';

export const createVariantSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(100).optional(),
  priceCents: z.number().int().positive().optional(),
  stock: z.number().int().min(0).default(0),
  images: z.array(z.string().url()).default([]),
});

export const updateVariantSchema = createVariantSchema.partial();
