import bcrypt from 'bcryptjs';

import { prisma } from '../src/config/prisma';

export async function createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  // First, try to delete any existing user with this email to avoid conflicts
  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  
  const passwordHash = await bcrypt.hash('password123', 10);
  return prisma.user.create({
    data: {
      email,
      name: 'Test User',
      passwordHash,
      role,
    },
  });
}

export async function createTestCategory(name: string, slug?: string) {
  return prisma.category.create({
    data: {
      name,
      slug: slug || name.toLowerCase(),
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
  // Use individual awaits to ensure each deletion completes before the next
  // This is more reliable than a transaction in CI environments
  
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
