import bcrypt from 'bcryptjs';

import { prisma } from '../src/config/prisma';

export async function createTestUser(email: string, role: 'USER' | 'ADMIN' = 'USER') {
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
  // Use sequential awaits to ensure proper order
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function setupTestDatabase() {
  await cleanupDatabase();
}

export async function teardownTestDatabase() {
  await cleanupDatabase();
  await prisma.$disconnect();
}
