import bcrypt from 'bcryptjs';

import { prisma } from '../src/config/prisma';

export async function createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  // Use upsert to atomically create or update user, avoiding unique constraint violations
  // This is more reliable than delete-then-create, especially in CI environments
  const passwordHash = await bcrypt.hash('password123', 10);
  return prisma.user.upsert({
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
}

export async function createTestCategory(name: string, slug?: string) {
  const categorySlug = slug || name.toLowerCase();
  
  // Categories have unique constraints on both name and slug
  // Use upsert to atomically create or update category, avoiding unique constraint violations
  // This is safer than delete-then-create because:
  // 1. Categories may have products referencing them (foreign key constraint)
  // 2. cleanupDatabase() already handles proper deletion order
  // 3. Upsert is atomic and doesn't violate foreign key constraints
  return prisma.category.upsert({
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
    const tables: Array<{ tablename: string }> = (await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
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
  } catch (error) {
    // If TRUNCATE fails, fall back to individual deleteMany calls
    // This provides a safety net if TRUNCATE is not available
    console.warn('TRUNCATE failed, falling back to deleteMany:', error);
    
    // Fallback: delete in dependency order
    await prisma.review.deleteMany().catch(() => {});
    await prisma.wishlist.deleteMany().catch(() => {});
    await prisma.address.deleteMany().catch(() => {});
    await prisma.productVariant.deleteMany().catch(() => {});
    await prisma.cartItem.deleteMany().catch(() => {});
    await prisma.cart.deleteMany().catch(() => {});
    await prisma.orderStatusHistory.deleteMany().catch(() => {});
    await prisma.orderItem.deleteMany().catch(() => {});
    await prisma.order.deleteMany().catch(() => {});
    await prisma.coupon.deleteMany().catch(() => {});
    await prisma.product.deleteMany().catch(() => {});
    await prisma.category.deleteMany().catch(() => {});
    await prisma.user.deleteMany().catch(() => {});
  }
}

export async function setupTestDatabase() {
  await cleanupDatabase();
}

export async function teardownTestDatabase() {
  await cleanupDatabase();
  await prisma.$disconnect();
}
