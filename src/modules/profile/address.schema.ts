import { z } from 'zod';

export const createAddressSchema = z.object({
  label: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  zipCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default('US'),
  phone: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

