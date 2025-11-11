import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';

import { prisma } from '../src/config/prisma';

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

  // Small delay to ensure database transaction is committed and visible
  // This helps prevent race conditions in CI environments
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify user exists in database before attempting login
  const verifyUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!verifyUser) {
    throw new Error(`User ${email} was created but not found in database before login attempt`);
  }

  // Login to get token
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'password123',
  });

  // Verify login succeeded
  if (loginRes.status !== 200) {
    // Additional debugging: check if user exists and verify password hash
    const debugUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    throw new Error(
      `Login failed for ${email}: ${loginRes.status} - ${JSON.stringify(loginRes.body)}. User exists: ${!!debugUser}, User ID: ${user.id}`,
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
    const user = await prisma.user.upsert({
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
    
    // Verify user was created/updated
    if (!user || !user.id) {
      throw new Error(`Failed to create/update user with email ${email}`);
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
    
    // Small delay to ensure database transaction is committed
    await new Promise((resolve) => setTimeout(resolve, 10));
    
    // Verify category exists in database
    const verifyCategory = await prisma.category.findUnique({
      where: { id: category.id },
    });
    
    if (!verifyCategory) {
      throw new Error(`Category ${name} was created but not found in database`);
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
  // Retry logic to handle potential timing issues in CI
  let category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  
  if (!category) {
    // Retry once after a short delay (handles potential race conditions)
    await new Promise((resolve) => setTimeout(resolve, 50));
    category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
  }
  
  if (!category) {
    throw new Error(
      `Category with id ${categoryId} does not exist. Ensure category is created before creating products.`,
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

export async function cleanupDatabase() {
  // Use TRUNCATE with CASCADE for robust, fast cleanup
  // This approach:
  // 1. Handles foreign key constraints automatically with CASCADE
  // 2. Resets auto-increment sequences with RESTART IDENTITY
  // 3. Is atomic and much faster than individual deleteMany() calls
  // 4. Prevents orphaned records and FK violations
  
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
    
    // Small delay to ensure TRUNCATE transaction is fully committed
    // This helps prevent race conditions in CI environments
    await new Promise((resolve) => setTimeout(resolve, 10));
  } catch (error) {
    // If TRUNCATE fails, fall back to individual deleteMany calls
    // This provides a safety net if TRUNCATE is not available or fails
    console.warn('TRUNCATE failed, falling back to deleteMany:', error);
    
    // Fallback: delete in dependency order
    // Use individual try/catch to ensure we continue even if one fails
    try {
      await prisma.review.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.wishlist.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.address.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.productVariant.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.cartItem.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.cart.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.orderStatusHistory.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.orderItem.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.order.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.coupon.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.product.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.category.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
    try {
      await prisma.user.deleteMany();
    } catch {
      // Ignore errors in fallback
    }
  }
}

export async function setupTestDatabase() {
  await cleanupDatabase();
}

export async function teardownTestDatabase() {
  await cleanupDatabase();
  await prisma.$disconnect();
}
