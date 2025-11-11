import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';

import { prisma } from '../src/config/prisma';

// Configurable retry settings via environment variables (useful for CI tuning)
const VERIFICATION_MAX_RETRIES = parseInt(process.env.TEST_VERIFICATION_MAX_RETRIES || '15', 10);
const VERIFICATION_TIMEOUT_MS = parseInt(process.env.TEST_VERIFICATION_TIMEOUT_MS || '30000', 10); // 30 seconds default
const LOGIN_MAX_RETRIES = parseInt(process.env.TEST_LOGIN_MAX_RETRIES || '10', 10);
const CATEGORY_VERIFICATION_MAX_RETRIES = parseInt(process.env.TEST_CATEGORY_VERIFICATION_MAX_RETRIES || '15', 10);

/**
 * Helper to create a test user and get their auth token
 * Ensures user exists and login succeeds before returning token
 */
export async function createTestUserAndLogin(
  app: Express,
  email: string,
  role: 'USER' | 'ADMIN' = 'USER',
): Promise<{ user: Awaited<ReturnType<typeof createTestUser>>; token: string }> {
  // Create user first
  const user = await createTestUser(email, role);

  // Verify user was created
  if (!user || !user.id) {
    throw new Error(`Failed to create test user: ${email}`);
  }

  // Additional delay to ensure user is visible (createTestUser already verified, but double-check)
  await new Promise((resolve) => setTimeout(resolve, 50));
  
  // Retry logic to ensure user is visible in database (handles CI transaction/visibility issues)
  // Use raw query to bypass Prisma's connection pool caching
  // Add timeout to prevent infinite loops
  const verificationStartTime = Date.now();
  let verifyUser = null;
  const maxRetries = VERIFICATION_MAX_RETRIES;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - verificationStartTime > VERIFICATION_TIMEOUT_MS) {
      throw new Error(
        `User verification timeout after ${VERIFICATION_TIMEOUT_MS}ms for ${email} in createTestUserAndLogin`,
      );
    }
    if (attempt > 0) {
      // Exponential backoff: 100ms, 200ms, 300ms, 400ms, 500ms, etc.
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
    
    // Use raw query to bypass connection pool and ensure we see the committed record
    const result = await prisma.$queryRaw<Array<{ id: string; email: string; passwordHash: string }>>`
      SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
    `;
    
    if (result && result.length > 0) {
      verifyUser = result[0];
      break;
    }
  }

  if (!verifyUser) {
    throw new Error(`User ${email} was created but not found in database after ${maxRetries} retries`);
  }

  // Retry login with exponential backoff (handles timing issues in CI)
  // Add timeout to prevent infinite loops
  const loginStartTime = Date.now();
  const loginTimeoutMs = VERIFICATION_TIMEOUT_MS; // Use same timeout as verification
  let loginRes = null;
  const loginMaxRetries = LOGIN_MAX_RETRIES;
  
  for (let attempt = 0; attempt < loginMaxRetries; attempt++) {
    // Check timeout
    if (Date.now() - loginStartTime > loginTimeoutMs) {
      throw new Error(`Login timeout after ${loginTimeoutMs}ms for ${email}`);
    }
    if (attempt > 0) {
      // Exponential backoff: 100ms, 200ms, 300ms, 400ms, 500ms, etc.
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
    
    loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'password123',
    });
    
    if (loginRes.status === 200 && loginRes.body.accessToken) {
      break;
    }
  }

  // Verify login succeeded
  if (!loginRes || loginRes.status !== 200) {
    // Additional debugging: check if user exists using raw query
    const debugResult = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email FROM "User" WHERE email = ${email} LIMIT 1
    `;
    const debugUser = debugResult && debugResult.length > 0 ? debugResult[0] : null;
    throw new Error(
      `Login failed for ${email}: ${loginRes?.status || 'no response'} - ${JSON.stringify(loginRes?.body || {})}. User exists: ${!!debugUser}, User ID: ${user.id}`,
    );
  }

  if (!loginRes.body.accessToken) {
    throw new Error(`No access token in login response for ${email}`);
  }

  return {
    user,
    token: loginRes.body.accessToken,
  };
}

export async function createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  // Use upsert to atomically create or update user, avoiding unique constraint violations
  // This is more reliable than delete-then-create, especially in CI environments
  const passwordHash = await bcrypt.hash('password123', 10);
  
  try {
    // Use explicit transaction to ensure atomicity and immediate commit
    // This ensures the record is committed before we try to verify it
    const user = await prisma.$transaction(
      async (tx) => {
        return await tx.user.upsert({
          where: { email },
          update: {
            // Update role and password in case user already exists with different values
            role,
            passwordHash,
            name: 'Test User',
          },
          create: {
            email,
            name: 'Test User',
            passwordHash,
            role,
          },
        });
      },
      {
        isolationLevel: 'ReadCommitted',
        timeout: 10000, // 10 second timeout
      },
    );
    
    // Verify user was created/updated
    if (!user || !user.id) {
      throw new Error(`Failed to create/update user with email ${email}`);
    }
    
    // Note: The transaction is already committed when $transaction completes.
    // This query ensures we're using a fresh connection and can see the committed data.
    await prisma.$executeRaw`SELECT 1`;
    
    // Additional delay to ensure commit is visible across all connections
    // Increased delay for CI environments where database might be slower
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Verify user is visible using both raw query and Prisma query
    // Try raw query first (bypasses connection pool), then fallback to Prisma
    // Add timeout to prevent infinite loops
    const verificationStartTime = Date.now();
    let verifyUser = null;
    const maxRetries = VERIFICATION_MAX_RETRIES;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check timeout
      if (Date.now() - verificationStartTime > VERIFICATION_TIMEOUT_MS) {
        throw new Error(
          `User verification timeout after ${VERIFICATION_TIMEOUT_MS}ms for ${email}. User ID from upsert: ${user.id}`,
        );
      }
      if (attempt > 0) {
        // Exponential backoff: 50ms, 100ms, 150ms, 200ms, etc.
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
      
      // Try raw query first (most reliable for seeing committed records)
      try {
        const rawResult = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
          SELECT id, email FROM "User" WHERE email = ${email} LIMIT 1
        `;
        
        if (rawResult && rawResult.length > 0) {
          verifyUser = rawResult[0];
          break;
        }
      } catch (rawError: unknown) {
        // If raw query fails, try Prisma query as fallback
        // Log error in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Raw query failed for user ${email} (attempt ${attempt + 1}):`, rawError);
        }
        
        try {
          const prismaUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true },
          });
          
          if (prismaUser) {
            verifyUser = prismaUser;
            break;
          }
        } catch (prismaError: unknown) {
          // Log error in development for debugging
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Prisma query failed for user ${email} (attempt ${attempt + 1}):`, prismaError);
          }
          // Continue to next retry
        }
      }
    }
    
    if (!verifyUser) {
      // Last resort: try one more time with a longer delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      const finalCheck = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });
      
      if (finalCheck) {
        return user; // User exists, return it even though verification initially failed
      }
      
      throw new Error(`User ${email} was created but not found in database after ${maxRetries} retries. User ID from upsert: ${user.id}`);
    }
    
    return user;
  } catch (error) {
    console.error(`Error creating test user ${email}:`, error);
    throw error;
  }
}

export async function createTestCategory(name: string, slug?: string) {
  const categorySlug = slug || name.toLowerCase();
  
  // Categories have unique constraints on both name and slug
  // Use upsert to atomically create or update category, avoiding unique constraint violations
  // This is safer than delete-then-create because:
  // 1. Categories may have products referencing them (foreign key constraint)
  // 2. cleanupDatabase() already handles proper deletion order
  // 3. Upsert is atomic and doesn't violate foreign key constraints
  try {
    // Use explicit transaction to ensure atomicity and immediate commit
    // This ensures the record is committed before we try to verify it
    const category = await prisma.$transaction(
      async (tx) => {
        return await tx.category.upsert({
          where: { slug: categorySlug },
          update: {
            // Update name in case slug matches but name is different
            name,
          },
          create: {
            name,
            slug: categorySlug,
          },
        });
      },
      {
        isolationLevel: 'ReadCommitted',
        timeout: 10000, // 10 second timeout
      },
    );
    
    // Verify category was created/updated
    if (!category || !category.id) {
      throw new Error(`Failed to create/update category with slug ${categorySlug}`);
    }
    
    // Note: The transaction is already committed when $transaction completes.
    // This query ensures we're using a fresh connection and can see the committed data.
    await prisma.$executeRaw`SELECT 1`;
    
    // Additional delay to ensure commit is visible across all connections
    // Increased delay for CI environments where database might be slower
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Retry logic to ensure category is visible in database (handles CI transaction/visibility issues)
    // Try raw query first (bypasses connection pool), then fallback to Prisma
    // Add timeout to prevent infinite loops
    const verificationStartTime = Date.now();
    let verifyCategory = null;
    const maxRetries = CATEGORY_VERIFICATION_MAX_RETRIES;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check timeout
      if (Date.now() - verificationStartTime > VERIFICATION_TIMEOUT_MS) {
        throw new Error(
          `Category verification timeout after ${VERIFICATION_TIMEOUT_MS}ms for ${name}. Category ID from upsert: ${category.id}`,
        );
      }
      if (attempt > 0) {
        // Exponential backoff: 50ms, 100ms, 150ms, 200ms, etc.
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
      
      // Try raw query first (most reliable for seeing committed records)
      try {
        const rawResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
          SELECT id, name, slug FROM "Category" WHERE id = ${category.id} LIMIT 1
        `;
        
        if (rawResult && rawResult.length > 0) {
          verifyCategory = rawResult[0];
          break;
        }
      } catch (rawError: unknown) {
        // If raw query fails, try Prisma query as fallback
        // Log error in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Raw query failed for category ${name} (attempt ${attempt + 1}):`, rawError);
        }
        
        try {
          const prismaCategory = await prisma.category.findUnique({
            where: { id: category.id },
            select: { id: true, name: true, slug: true },
          });
          
          if (prismaCategory) {
            verifyCategory = prismaCategory;
            break;
          }
        } catch (prismaError: unknown) {
          // Log error in development for debugging
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Prisma query failed for category ${name} (attempt ${attempt + 1}):`, prismaError);
          }
          // Continue to next retry
        }
      }
    }
    
    if (!verifyCategory) {
      // Last resort: try one more time with a longer delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      const finalCheck = await prisma.category.findUnique({
        where: { id: category.id },
        select: { id: true, name: true, slug: true },
      });
      
      if (finalCheck) {
        return category; // Category exists, return it even though verification initially failed
      }
      
      throw new Error(`Category ${name} was created but not found in database after ${maxRetries} retries. Category ID from upsert: ${category.id}`);
    }
    
    return category;
  } catch (error) {
    console.error(`Error creating test category ${name} (slug: ${categorySlug}):`, error);
    throw error;
  }
}

export async function createTestProduct(
  categoryId: string,
  data?: {
    title?: string;
    priceCents?: number;
    stock?: number;
    slug?: string;
    active?: boolean;
  },
) {
  // Validate category exists before creating product
  // Retry logic with exponential backoff to handle potential timing issues in CI
  // Use raw query to bypass Prisma's connection pool caching
  // Add timeout to prevent infinite loops
  const verificationStartTime = Date.now();
  const categoryVerificationTimeoutMs = VERIFICATION_TIMEOUT_MS;
  let category = null;
  const maxRetries = VERIFICATION_MAX_RETRIES;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - verificationStartTime > categoryVerificationTimeoutMs) {
      throw new Error(
        `Category verification timeout after ${categoryVerificationTimeoutMs}ms for categoryId: ${categoryId}`,
      );
    }
    
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt)); // Exponential backoff
    }
    
    // Use raw query to bypass connection pool and ensure we see the committed record
    const result = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
      SELECT id, name, slug FROM "Category" WHERE id = ${categoryId} LIMIT 1
    `;
    
    if (result && result.length > 0) {
      category = result[0];
      break;
    }
  }
  
  if (!category) {
    throw new Error(
      `Category with id ${categoryId} does not exist after ${maxRetries} retries. Ensure category is created before creating products.`,
    );
  }

  // Generate unique slug to avoid unique constraint violations
  // Use timestamp + random number to ensure uniqueness across test runs
  const baseSlug = data?.slug || (data?.title || 'test-product').toLowerCase().replace(/\s+/g, '-');
  const uniqueSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return prisma.product.create({
    data: {
      title: data?.title || 'Test Product',
      slug: uniqueSlug,
      description: 'Test product description',
      priceCents: data?.priceCents || 1000,
      currency: 'USD',
      images: [],
      active: data?.active !== undefined ? data.active : true,
      stock: data?.stock || 10,
      categoryId,
    },
  });
}

// Simple mutex to prevent concurrent TRUNCATE operations (prevents deadlocks)
let cleanupInProgress = false;
const cleanupQueue: Array<() => void> = [];

async function waitForCleanup(): Promise<void> {
  if (!cleanupInProgress) {
    return;
  }
  return new Promise<void>((resolve) => {
    cleanupQueue.push(resolve);
  });
}

/**
 * Safely executes a delete operation, only suppressing "table does not exist" errors.
 * All other errors are logged as warnings so they can be investigated.
 *
 * @param tableName - Name of the table being deleted (for logging)
 * @param deleteFn - Function that performs the delete operation
 */
async function safeDelete(
  tableName: string,
  deleteFn: () => Promise<unknown>,
): Promise<void> {
  try {
    await deleteFn();
  } catch (error: unknown) {
    // Check if this is a "table does not exist" error (expected in some scenarios)
    const isTableMissingError =
      (typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string' &&
        (error.message.includes('does not exist') ||
          error.message.includes('relation') ||
          error.message.includes('table') ||
          error.message.includes('not found'))) ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'P2021' || // Prisma: Table does not exist
          error.code === '42P01')); // PostgreSQL: relation does not exist

    if (isTableMissingError) {
      // Table doesn't exist - this is expected and can be safely ignored
      return;
    }

    // For all other errors, log a warning so they can be investigated
    // This includes connection errors, permission errors, constraint violations, etc.
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : String(error);

    const errorCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN';

    console.warn(
      `⚠️  Failed to delete from table "${tableName}": [${errorCode}] ${errorMessage}`,
    );

    // Optionally rethrow if you want to fail fast on unexpected errors
    // For now, we log and continue to allow cleanup to proceed with other tables
    // Uncomment the line below if you want cleanup to fail on unexpected errors:
    // throw error;
  }
}

export async function cleanupDatabase() {
  // Wait for any ongoing cleanup to complete (prevents deadlocks from concurrent TRUNCATE)
  await waitForCleanup();
  
  // Small random delay to stagger cleanup operations (helps prevent deadlocks in CI)
  // Even with singleThread, test files might initialize cleanup at similar times
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
  
  cleanupInProgress = true;
  
  try {
    // Use TRUNCATE with CASCADE for robust, fast cleanup
    // This approach:
    // 1. Handles foreign key constraints automatically with CASCADE
    // 2. Resets auto-increment sequences with RESTART IDENTITY
    // 3. Is atomic and much faster than individual deleteMany() calls
    // 4. Prevents orphaned records and FK violations
    
    // Retry logic for deadlock handling (PostgreSQL deadlock code: 40P01)
    const maxRetries = 5;
    let lastError: unknown = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 50ms, 100ms, 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt - 1)));
      }
      
      try {
        // Get all tables in the public schema (Postgres)
        // Exclude Prisma migration tables (_prisma_migrations)
        const tables: Array<{ tablename: string }> = (await prisma.$queryRawUnsafe(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma_%' ORDER BY tablename;`,
        )) as Array<{ tablename: string }>;

        if (tables.length === 0) {
          // No tables found, nothing to clean
          return;
        }

        // Build TRUNCATE statement with all tables
        // CASCADE automatically handles foreign key dependencies
        // RESTART IDENTITY resets auto-increment sequences
        const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');

        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`,
        );
        
        // Longer delay to ensure TRUNCATE transaction is fully committed and visible
        // This helps prevent race conditions in CI environments where connection pooling
        // or transaction isolation might cause visibility delays
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        // Success - break out of retry loop
        return;
      } catch (error: unknown) {
        lastError = error;
        
        // Check if it's a deadlock error (PostgreSQL error code 40P01)
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error.code === '40P01' || error.code === 'P2010')
        ) {
          // Deadlock detected - will retry
          if (attempt < maxRetries - 1) {
            continue;
          }
        }
        // If not a deadlock or max retries reached, fall through to fallback
        break;
      }
    }
    
    // If TRUNCATE failed after retries, fall back to deleteMany
    throw lastError;
  } catch (error) {
    // If TRUNCATE fails, fall back to individual deleteMany calls
    // This provides a safety net if TRUNCATE is not available or fails
    console.warn('TRUNCATE failed, falling back to deleteMany:', error);
    
    // Fallback: delete in dependency order
    // Use safeDelete helper to only suppress expected "table does not exist" errors
    // All other errors (connection, permission, constraint violations) will be logged
    await safeDelete('review', () => prisma.review.deleteMany());
    await safeDelete('wishlist', () => prisma.wishlist.deleteMany());
    await safeDelete('address', () => prisma.address.deleteMany());
    await safeDelete('productVariant', () => prisma.productVariant.deleteMany());
    await safeDelete('cartItem', () => prisma.cartItem.deleteMany());
    await safeDelete('cart', () => prisma.cart.deleteMany());
    await safeDelete('orderStatusHistory', () =>
      prisma.orderStatusHistory.deleteMany(),
    );
    await safeDelete('orderItem', () => prisma.orderItem.deleteMany());
    await safeDelete('order', () => prisma.order.deleteMany());
    await safeDelete('coupon', () => prisma.coupon.deleteMany());
    await safeDelete('product', () => prisma.product.deleteMany());
    await safeDelete('category', () => prisma.category.deleteMany());
    await safeDelete('user', () => prisma.user.deleteMany());
    
    // Delay after fallback cleanup to ensure deletes are visible
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    // Release mutex and notify waiting operations
    cleanupInProgress = false;
    // Process queue: notify next waiting operation
    const next = cleanupQueue.shift();
    if (typeof next === 'function') {
      try {
        next();
      } catch (error) {
        // Log but don't throw - queue notification errors shouldn't break cleanup
        console.error('Error notifying cleanup queue:', error);
      }
    }
  }
}

// Note: setupTestDatabase and teardownTestDatabase were removed as they were unused.
// If you need database setup/teardown, use cleanupDatabase() directly in beforeEach/afterEach hooks.
// The global Prisma connection is managed by tests/setup.ts (connects in beforeAll, disconnects in afterAll).
