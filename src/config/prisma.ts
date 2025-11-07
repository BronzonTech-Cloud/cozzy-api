import { PrismaClient } from '@prisma/client';

import { env } from './env';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Use test database URL when NODE_ENV is 'test'
const databaseUrl =
  process.env.NODE_ENV === 'test'
    ? process.env.DATABASE_URL_TEST || env.DATABASE_URL_TEST || env.DATABASE_URL
    : env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
