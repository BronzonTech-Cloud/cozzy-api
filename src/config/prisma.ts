import { PrismaClient } from '@prisma/client';

import { env } from './env';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

/**
 * Configure connection pool parameters for the database URL
 * This addresses the root cause of visibility issues in CI by properly configuring
 * connection pooling instead of relying on retries and timeouts as workarounds.
 *
 * For PostgreSQL with Prisma:
 * - connection_limit: Maximum number of connections in the pool (default: num_physical_cpus * 2 + 1)
 * - pool_timeout: Seconds to wait for a connection from the pool (default: 10)
 * - connect_timeout: Seconds to wait when establishing a connection (default: 5)
 * - schema: Database schema name (if needed)
 */
function configureDatabaseUrl(baseUrl: string, isTest: boolean): string {
  try {
    const url = new URL(baseUrl);

    // For test/CI environments, use optimized connection pool settings
    if (isTest) {
      // Smaller connection pool for tests to avoid connection exhaustion
      // and ensure faster connection reuse, which improves data visibility
      // Reduced to 3 for CI to minimize connection pool delays
      url.searchParams.set('connection_limit', '3');

      // Shorter pool timeout to fail fast if connections are exhausted
      // This helps identify actual connection issues vs. visibility delays
      url.searchParams.set('pool_timeout', '3');

      // Shorter connect timeout for faster failure detection
      url.searchParams.set('connect_timeout', '2');
    } else {
      // Production/development: Use more conservative defaults
      // Only override if not already set in the URL
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '10');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', '10');
      }
    }

    return url.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to parse DATABASE_URL for pool configuration:', error);
    return baseUrl;
  }
}

// Use test database URL when NODE_ENV is 'test'
const isTest = process.env.NODE_ENV === 'test';
const baseDatabaseUrl = isTest
  ? process.env.DATABASE_URL_TEST || env.DATABASE_URL_TEST || env.DATABASE_URL
  : env.DATABASE_URL;

// Configure connection pool parameters based on environment
const databaseUrl = baseDatabaseUrl
  ? configureDatabaseUrl(baseDatabaseUrl, isTest)
  : baseDatabaseUrl;

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
