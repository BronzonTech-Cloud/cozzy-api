import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  comment: z
    .string()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must be less than 2000 characters')
    .optional(),
});

export const updateReviewSchema = createReviewSchema.partial();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
