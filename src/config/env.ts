import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_TEST: z.string().url().optional(),
  CLIENT_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters for security'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters for security'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export type Env = z.infer<typeof envSchema>;
export const env = parsed.data as Env;
