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
