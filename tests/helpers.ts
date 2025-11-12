import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';

import { prisma } from '../src/config/prisma';

// Configurable retry settings via environment variables (useful for CI tuning)
const VERIFICATION_MAX_RETRIES = parseInt(process.env.TEST_VERIFICATION_MAX_RETRIES || '15', 10);
const VERIFICATION_TIMEOUT_MS = parseInt(process.env.TEST_VERIFICATION_TIMEOUT_MS || '30000', 10); // 30 seconds default
const LOGIN_MAX_RETRIES = parseInt(process.env.TEST_LOGIN_MAX_RETRIES || '10', 10);
const CATEGORY_VERIFICATION_MAX_RETRIES = parseInt(
  process.env.TEST_CATEGORY_VERIFICATION_MAX_RETRIES || '15',
  10,
);

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

  // CRITICAL: Wait for user to be visible in database before attempting login
  // The login endpoint queries by email, so we must ensure the user is visible by email
  // This prevents "User exists: false" errors in CI where connection pool visibility can be delayed
  const visibilityStartTime = Date.now();
  const visibilityTimeoutMs = 10000; // 10 seconds max wait
  let userVisibleByEmail = false;
  const maxVisibilityAttempts = 20; // Increased attempts for CI reliability

  for (let attempt = 0; attempt < maxVisibilityAttempts; attempt++) {
    // Check timeout
    if (Date.now() - visibilityStartTime > visibilityTimeoutMs) {
      break;
    }

    if (attempt > 0) {
      // Exponential backoff: 100ms, 200ms, 300ms, etc.
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }

    try {
      // Query by email (same as login endpoint) to ensure user is visible
      const emailCheck = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
        SELECT id, email FROM "User" WHERE email = ${email} LIMIT 1
      `;

      if (emailCheck && emailCheck.length > 0 && emailCheck[0].id === user.id) {
        userVisibleByEmail = true;
        break;
      }
    } catch {
      // Continue to next attempt
    }
  }

  // If user still not visible by email, add extra delay and try one more time
  // This is critical because login will fail if user isn't visible
  if (!userVisibleByEmail) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Final check
    try {
      const finalEmailCheck = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
        SELECT id, email FROM "User" WHERE email = ${email} LIMIT 1
      `;

      if (finalEmailCheck && finalEmailCheck.length > 0 && finalEmailCheck[0].id === user.id) {
        userVisibleByEmail = true;
      }
    } catch {
      // Continue - will fail during login attempt
    }
  }

  // If user is still not visible, log warning but proceed (will fail during login with clear error)
  if (!userVisibleByEmail && process.env.NODE_ENV === 'development') {
    console.warn(
      `User ${email} (ID: ${user.id}) not visible by email after ${maxVisibilityAttempts} attempts. Proceeding with login attempt...`,
    );
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
    // Additional debugging: check if user exists using raw query (by email, same as login)
    const debugResult = await prisma.$queryRaw<
      Array<{ id: string; email: string; passwordHash: string | null }>
    >`
      SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
    `;
    const debugUser = debugResult && debugResult.length > 0 ? debugResult[0] : null;

    // More detailed error message
    const errorDetails = {
      status: loginRes?.status || 'no response',
      body: loginRes?.body || {},
      userExists: !!debugUser,
      userId: user.id,
      userEmail: email,
      userHasPassword: !!debugUser?.passwordHash,
      userVisibleByEmail: userVisibleByEmail,
    };

    throw new Error(
      `Login failed for ${email}: ${loginRes?.status || 'no response'} - ${JSON.stringify(loginRes?.body || {})}. Debug: ${JSON.stringify(errorDetails)}`,
    );
  }

  if (!loginRes.body.accessToken) {
    throw new Error(`No access token in login response for ${email}`);
  }

  // Final verification: ensure user is visible in database before returning
  // This prevents 404 errors in controllers that do user lookups
  // Add a small delay and verify one more time
  await new Promise((resolve) => setTimeout(resolve, 200));

  let finalUserCheck = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }

    try {
      const finalCheck = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User" WHERE id = ${user.id} LIMIT 1
      `;

      if (finalCheck && finalCheck.length > 0) {
        finalUserCheck = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  // If still not visible, add one more delay (user exists, just not visible yet)
  if (!finalUserCheck) {
    await new Promise((resolve) => setTimeout(resolve, 300));
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

  // Ensure password hash is valid
  if (!passwordHash || passwordHash.length === 0) {
    throw new Error(`Failed to generate password hash for user ${email}`);
  }

  try {
    // Direct upsert (no transaction wrapper) - upsert is already atomic
    // Transaction wrappers can cause visibility issues across connection pools in CI
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        // Update role and password in case user already exists with different values
        role,
        passwordHash, // Ensure password hash is always set
        name: 'Test User',
      },
      create: {
        email,
        name: 'Test User',
        passwordHash, // Ensure password hash is always set
        role,
      },
    });

    // Verify user was created/updated
    if (!user || !user.id) {
      throw new Error(`Failed to create/update user with email ${email}`);
    }

    // CRITICAL: Verify password hash was set correctly
    if (!user.passwordHash) {
      // If password hash is missing, update it explicitly
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      if (!updatedUser.passwordHash) {
        throw new Error(`Password hash not set for user ${email} (ID: ${user.id})`);
      }
      // Use updated user
      Object.assign(user, updatedUser);
    }

    // Force connection refresh by executing queries to cycle through connection pool
    // This helps ensure subsequent queries use a fresh connection
    await prisma.$executeRaw`SELECT 1`;

    // Delay to ensure commit is visible - upsert is atomic and commits immediately
    // Increased delay for CI environments where connection pool visibility can be slower
    await new Promise((resolve) => setTimeout(resolve, 800));

    // CRITICAL: Verify user is visible by email (same query as login endpoint)
    // This ensures the user can be found when login attempts to query by email
    let verifyUser = null;
    let verifyUserByEmail = null;
    const quickVerificationAttempts = 8; // Increased for CI reliability

    for (let attempt = 0; attempt < quickVerificationAttempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with longer delays for CI
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }
      
      // Force connection refresh before each verification attempt
      await prisma.$executeRaw`SELECT 1`;

      try {
        // Query by ID - most reliable since we have the exact ID from upsert
        const idResult = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
        `;

        if (idResult && idResult.length > 0) {
          verifyUser = idResult[0];
        }

        // CRITICAL: Also verify by email (same as login endpoint)
        const emailResult = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
        `;

        if (emailResult && emailResult.length > 0 && emailResult[0].id === user.id) {
          verifyUserByEmail = emailResult[0];
          // Verify password hash is set
          if (!verifyUserByEmail.passwordHash) {
            // Password hash missing - update it
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash },
            });
            // Re-query to get updated user
            const recheck = await prisma.$queryRaw<
              Array<{ id: string; email: string; passwordHash: string | null }>
            >`
              SELECT id, email, "passwordHash" FROM "User" WHERE email = ${email} LIMIT 1
            `;
            if (recheck && recheck.length > 0) {
              verifyUserByEmail = recheck[0];
            }
          }
        }

        // If both verifications pass, we're good
        if (verifyUser && verifyUserByEmail && verifyUserByEmail.passwordHash) {
          break;
        }
      } catch (error) {
        // Continue to next attempt
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Verification attempt ${attempt + 1} failed for ${email}:`, error);
        }
      }
    }

    // If verification failed, add extra delay and try one more time
    if (!verifyUserByEmail || !verifyUserByEmail.passwordHash) {
      // Force connection refresh
      await prisma.$executeRaw`SELECT 1`;
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      // Final attempt: ensure password hash is set using raw SQL to force connection refresh
      try {
        // Use raw SQL to force a fresh connection and check user
        const finalCheckRaw = await prisma.$queryRaw<
          Array<{ id: string; email: string; passwordHash: string | null }>
        >`
          SELECT id, email, "passwordHash" FROM "User" WHERE id = ${user.id} LIMIT 1
        `;

        if (finalCheckRaw && finalCheckRaw.length > 0) {
          const finalUser = finalCheckRaw[0];
          if (!finalUser.passwordHash) {
            // Update password hash using raw SQL
            await prisma.$executeRaw`
              UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE id = ${user.id}
            `;
          }
        } else {
          // User not visible yet, but upsert succeeded - trust the upsert result
          // Ensure password hash is set anyway using raw SQL
          try {
            await prisma.$executeRaw`
              UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE id = ${user.id}
            `;
          } catch (updateError) {
            // If update fails, user might not be visible yet - this is OK, upsert already set it
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `Could not verify/update password hash for ${email} (ID: ${user.id}), but upsert succeeded`,
              );
            }
          }
        }
      } catch (error) {
        // Verification failed, but upsert succeeded - trust the upsert result
        // The user exists, just not visible to this connection yet
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `User ${email} (ID: ${user.id}) verification failed, but upsert succeeded - trusting upsert result`,
          );
        }
      }
    }

    // CRITICAL: Trust the upsert result - if upsert returned a user, it exists
    // Connection pool visibility issues in CI can cause verification to fail,
    // but the user is still there and will be visible to subsequent queries
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
    // Direct upsert (no transaction wrapper) - upsert is already atomic
    // Transaction wrappers can cause visibility issues across connection pools in CI
    const category = await prisma.category.upsert({
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

    // Verify category was created/updated
    if (!category || !category.id) {
      throw new Error(`Failed to create/update category with slug ${categorySlug}`);
    }

    // Force connection refresh by executing queries to cycle through connection pool
    // This helps ensure subsequent queries use a fresh connection
    await prisma.$executeRaw`SELECT 1`;

    // Delay to ensure commit is visible - upsert is atomic and commits immediately
    // Increased delay for CI environments where connection pool visibility can be slower
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Lightweight verification: try to find the category by ID (most reliable)
    // If this fails, we still return the category object from upsert (trust the operation)
    // The verification is just a sanity check, not a hard requirement
    let verifyCategory = null;
    const quickVerificationAttempts = 5; // Increased for CI reliability

    for (let attempt = 0; attempt < quickVerificationAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }

      try {
        // Query by ID - most reliable since we have the exact ID from upsert
        const idResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
          SELECT id, name, slug FROM "Category" WHERE id = ${category.id} LIMIT 1
        `;

        if (idResult && idResult.length > 0) {
          verifyCategory = idResult[0];
          break;
        }
      } catch {
        // Continue to next attempt
      }
    }

    // Even if verification fails, trust the upsert result and return the category
    // The upsert operation is atomic and returns the created/updated record
    // If verification fails, it's likely a connection pool visibility issue, not a real problem
    // Add extra delay if verification failed to give more time for visibility
    if (!verifyCategory) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Category ${name} verification failed, but returning category from upsert (ID: ${category.id})`,
        );
      }
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
  // Increased retries and delays for CI reliability
  const verificationStartTime = Date.now();
  const categoryVerificationTimeoutMs = VERIFICATION_TIMEOUT_MS * 2; // Double timeout for category verification
  let category = null;
  const maxRetries = CATEGORY_VERIFICATION_MAX_RETRIES * 2; // Double retries for category verification

  // Initial delay to give category time to be visible
  await new Promise((resolve) => setTimeout(resolve, 200));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - verificationStartTime > categoryVerificationTimeoutMs) {
      // Don't throw - try to create product anyway and let database error if category really doesn't exist
      // This handles cases where verification fails due to connection pool issues but category actually exists
      break;
    }

    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt)); // Exponential backoff
    }

    // Try multiple query strategies to find the category
    // Query by ID first (if categoryId is provided), then try other methods
    try {
      // Force connection refresh
      await prisma.$executeRaw`SELECT 1`;

      // Query by ID
      const idResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
        SELECT id, name, slug FROM "Category" WHERE id = ${categoryId} LIMIT 1
      `;

      if (idResult && idResult.length > 0) {
        category = idResult[0];
        break;
      }
    } catch (error) {
      // Continue to next retry
    }
  }

  // If category not found after retries, add extra delay and try one more time
  // This handles edge cases where category exists but isn't visible yet
  if (!category) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const finalResult = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
        SELECT id, name, slug FROM "Category" WHERE id = ${categoryId} LIMIT 1
      `;
      if (finalResult && finalResult.length > 0) {
        category = finalResult[0];
      }
    } catch {
      // Will throw error below if still not found
    }
  }

  // Only throw error if category still not found after all retries and delays
  // This ensures we've given maximum time for visibility
  if (!category) {
    throw new Error(
      `Category with id ${categoryId} does not exist after ${maxRetries} retries and additional delays. Ensure category is created before creating products.`,
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
  // Add timeout to prevent infinite waits (max 30 seconds)
  const timeout = 30000;
  const startTime = Date.now();

  return new Promise<void>((resolve, reject) => {
    const checkTimeout = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`waitForCleanup timed out after ${timeout}ms`));
        return;
      }
      if (!cleanupInProgress) {
        resolve();
        return;
      }
      // Check again after a short delay
      setTimeout(checkTimeout, 100);
    };

    cleanupQueue.push(() => {
      if (Date.now() - startTime <= timeout) {
        resolve();
      } else {
        reject(new Error(`waitForCleanup timed out after ${timeout}ms`));
      }
    });

    // Also check periodically in case queue notification fails
    checkTimeout();
  });
}

/**
 * Safely executes a delete operation, only suppressing "table does not exist" errors.
 * All other errors are logged as warnings so they can be investigated.
 *
 * @param tableName - Name of the table being deleted (for logging)
 * @param deleteFn - Function that performs the delete operation
 */
async function safeDelete(tableName: string, deleteFn: () => Promise<unknown>): Promise<void> {
  try {
    await deleteFn();
  } catch (error: unknown) {
    // Extract message and code safely
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';
    const code =
      typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : '';

    // Only suppress actual "table/relation does not exist" errors
    const isTableMissingError =
      code === 'P2021' || // Prisma: Table does not exist
      code === '42P01' || // PostgreSQL: relation does not exist
      (message.includes('does not exist') && (message.includes('table') || message.includes('relation'))) ||
      message.includes('no such table'); // SQLite

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

    console.warn(`⚠️  Failed to delete from table "${tableName}": [${errorCode}] ${errorMessage}`);

    // Optionally rethrow if you want to fail fast on unexpected errors
    // For now, we log and continue to allow cleanup to proceed with other tables
    // Uncomment the line below if you want cleanup to fail on unexpected errors:
    // throw error;
  }
}

export async function cleanupDatabase() {
  // Add overall timeout for cleanup (max 45 seconds)
  const cleanupTimeout = 45000;
  const cleanupStartTime = Date.now();

  // Wait for any ongoing cleanup to complete (prevents deadlocks from concurrent TRUNCATE)
  // Wrap in try/catch to handle timeout errors
  try {
    await waitForCleanup();
  } catch (error) {
    // If waitForCleanup times out, log warning and proceed anyway
    // This prevents one stuck cleanup from blocking all tests
    console.warn('waitForCleanup timed out, proceeding with cleanup anyway:', error);
    cleanupInProgress = false; // Reset flag in case it was stuck
  }

  // CRITICAL: Add a delay after waiting for cleanup to ensure any previous
  // cleanup operations are fully committed and visible before starting new cleanup
  // This prevents race conditions where user creation happens before cleanup completes
  // Increased delay for CI environments
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Check if we've already exceeded timeout
  if (Date.now() - cleanupStartTime > cleanupTimeout) {
    throw new Error(
      `cleanupDatabase timeout: already exceeded ${cleanupTimeout}ms before starting`,
    );
  }

  cleanupInProgress = true;

  try {
    // Use TRUNCATE with CASCADE for robust, fast cleanup
    // This approach:
    // 1. Handles foreign key constraints automatically with CASCADE
    // 2. Resets auto-increment sequences with RESTART IDENTITY
    // 3. Is atomic and much faster than individual deleteMany() calls
    // 4. Prevents orphaned records and FK violations

    // Retry logic for deadlock handling (PostgreSQL deadlock code: 40P01)
    // Reduced retries and faster fallback to prevent timeouts
    const maxRetries = 3; // Reduced from 5 to fail faster
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check timeout before each attempt
      if (Date.now() - cleanupStartTime > cleanupTimeout) {
        throw new Error(
          `cleanupDatabase timeout: exceeded ${cleanupTimeout}ms during TRUNCATE retries`,
        );
      }

      if (attempt > 0) {
        // Shorter exponential backoff: 25ms, 50ms, 100ms
        await new Promise((resolve) => setTimeout(resolve, 25 * Math.pow(2, attempt - 1)));
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

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

        // CRITICAL: Delay after TRUNCATE to ensure it's fully committed and visible
        // This prevents race conditions where user creation starts before cleanup is visible
        // Force connection refresh and add delay for CI
        await prisma.$executeRaw`SELECT 1`;
        await new Promise((resolve) => setTimeout(resolve, 400));

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
    // Check timeout before fallback
    if (Date.now() - cleanupStartTime > cleanupTimeout) {
      console.error('cleanupDatabase timeout: exceeded during fallback, releasing mutex');
      cleanupInProgress = false;
      const next = cleanupQueue.shift();
      if (typeof next === 'function') {
        try {
          next();
        } catch (e) {
          console.error('Error notifying cleanup queue:', e);
        }
      }
      throw new Error(`cleanupDatabase timeout: exceeded ${cleanupTimeout}ms`);
    }

    // If TRUNCATE fails, fall back to individual deleteMany calls
    // This provides a safety net if TRUNCATE is not available or fails
    console.warn('TRUNCATE failed, falling back to deleteMany:', error);

    // Fallback: delete in dependency order
    // Use safeDelete helper to only suppress expected "table does not exist" errors
    // All other errors (connection, permission, constraint violations) will be logged
    // Execute all deletes in parallel for speed (they're independent after TRUNCATE fails)
    await Promise.all([
      safeDelete('review', () => prisma.review.deleteMany()),
      safeDelete('wishlist', () => prisma.wishlist.deleteMany()),
      safeDelete('address', () => prisma.address.deleteMany()),
      safeDelete('productVariant', () => prisma.productVariant.deleteMany()),
      safeDelete('cartItem', () => prisma.cartItem.deleteMany()),
      safeDelete('cart', () => prisma.cart.deleteMany()),
      safeDelete('orderStatusHistory', () => prisma.orderStatusHistory.deleteMany()),
      safeDelete('orderItem', () => prisma.orderItem.deleteMany()),
      safeDelete('order', () => prisma.order.deleteMany()),
      safeDelete('coupon', () => prisma.coupon.deleteMany()),
      safeDelete('product', () => prisma.product.deleteMany()),
      safeDelete('category', () => prisma.category.deleteMany()),
      safeDelete('user', () => prisma.user.deleteMany()),
    ]);

    // Delay after fallback cleanup to ensure all deletes are committed
    await prisma.$executeRaw`SELECT 1`;
    await new Promise((resolve) => setTimeout(resolve, 400));
  } finally {
    // CRITICAL: Add delay before releasing mutex to ensure cleanup is fully committed
    // This prevents race conditions where user creation starts before cleanup is visible
    // Force connection refresh and add delay for CI
    await prisma.$executeRaw`SELECT 1`;
    await new Promise((resolve) => setTimeout(resolve, 400));
    
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
