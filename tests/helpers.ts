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
  // First, try to delete any existing category with matching name or slug to avoid conflicts
  // This handles edge cases where a category exists with same name but different slug (or vice versa)
  try {
    await prisma.category.deleteMany({
      where: {
        OR: [
          { name },
          { slug: categorySlug },
        ],
      },
    });
  } catch (error) {
    // Log and rethrow real errors - don't silently swallow DB failures
    console.error(`Failed to delete existing category with name ${name} or slug ${categorySlug}:`, error);
    throw error;
  }

  // Now create the category - safe since we've cleared any conflicts
  return prisma.category.create({
    data: {
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
  },
) {
  return prisma.product.create({
    data: {
      title: data?.title || 'Test Product',
      slug: (data?.title || 'test-product').toLowerCase().replace(/\s+/g, '-'),
      description: 'Test product description',
      priceCents: data?.priceCents || 1000,
      currency: 'USD',
      images: [],
      active: true,
      stock: data?.stock || 10,
      categoryId,
    },
  });
}

export async function cleanupDatabase() {
  // Delete in order respecting foreign key constraints
  // Use sequential awaits (not a transaction) because:
  // 1. Foreign key constraints require deletion in dependency order
  // 2. Some tables have RESTRICT constraints that prevent CASCADE deletes
  // 3. Sequential deletes ensure each step completes before the next, avoiding constraint violations
  // Note: A transaction would be atomic but doesn't help with constraint ordering
  
  // Delete child records first (those with foreign keys)
  await prisma.review.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.address.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  // Delete users last (they are referenced by many tables)
  await prisma.user.deleteMany();
  
  // Verify cleanup completed by checking user count
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    // Force delete all users if any remain
    await prisma.user.deleteMany();
  }
}

export async function setupTestDatabase() {
  await cleanupDatabase();
}

export async function teardownTestDatabase() {
  await cleanupDatabase();
  await prisma.$disconnect();
}
