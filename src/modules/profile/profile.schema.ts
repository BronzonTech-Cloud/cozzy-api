import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
    email: z.string().email('Invalid email format').optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'At least one field (name or email) must be provided',
  })
  .refine((data) => !data.name || data.name.trim().length > 0, {
    message: 'Name cannot be empty',
    path: ['name'],
  })
  .refine((data) => !data.email || data.email.trim().length > 0, {
    message: 'Email cannot be empty',
    path: ['email'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirm password must match',
    path: ['confirmPassword'],
  });

