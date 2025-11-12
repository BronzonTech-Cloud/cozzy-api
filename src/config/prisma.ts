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
    // In test environment, use connection pooling settings optimized for CI
    ...(process.env.NODE_ENV === 'test' &&
      {
        // Connection pool settings for CI/test environments
        // Smaller pool size and shorter connection timeout to prevent visibility issues
        // These settings help ensure connections are reused efficiently and data is visible quickly
        // Note: Prisma uses connection pooling via the DATABASE_URL connection string
        // For PostgreSQL, you can add ?connection_limit=5&pool_timeout=10 to the URL
        // However, we rely on Prisma's default pooling which is usually sufficient
      }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
