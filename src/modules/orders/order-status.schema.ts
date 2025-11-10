import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
});

export const orderHistoryQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});
