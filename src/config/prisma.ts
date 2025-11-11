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
    ...(process.env.NODE_ENV === 'test' && {
      // Ensure immediate connection and reduce connection pool size for tests
      // This helps prevent visibility issues in CI where multiple test processes might run
    }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
