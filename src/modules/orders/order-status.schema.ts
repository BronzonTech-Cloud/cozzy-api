import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
});

export const orderHistoryQuerySchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit must be a positive integer')
      .transform(Number)
      .refine((val) => val > 0 && val <= 100, {
        message: 'limit must be between 1 and 100',
      })
      .optional(),
    offset: z.coerce
      .number()
      .int('offset must be an integer')
      .nonnegative('offset must be a non-negative integer')
      .max(10000, 'offset cannot exceed 10000')
      .optional(),
  })
  .refine(
    (data) => {
      // When both startDate and endDate are present, endDate must be after startDate
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end > start;
      }
      return true;
    },
    {
      message: 'endDate must be after startDate',
      path: ['endDate'],
    },
  );
