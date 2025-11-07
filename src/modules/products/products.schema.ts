import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('USD'),
  sku: z.string().optional(),
  images: z.array(z.string().url()).default([]),
  active: z.boolean().default(true),
  stock: z.number().int().nonnegative().default(0),
  categoryId: z.string().uuid(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
