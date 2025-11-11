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
  // Delete in order respecting foreign key constraints
  // Use sequential awaits (not a transaction) because:
  // 1. Foreign key constraints require deletion in dependency order
  // 2. Some tables have RESTRICT constraints that prevent CASCADE deletes
  // 3. Sequential deletes ensure each step completes before the next, avoiding constraint violations
  // Note: A transaction would be atomic but doesn't help with constraint ordering
  
  // Delete child records first (those with foreign keys)
  // Wrap each in try/catch to continue even if one fails
  try {
    await prisma.review.deleteMany();
  } catch (error) {
    console.warn('Failed to delete reviews:', error);
  }
  
  try {
    await prisma.wishlist.deleteMany();
  } catch (error) {
    console.warn('Failed to delete wishlist:', error);
  }
  
  try {
    await prisma.address.deleteMany();
  } catch (error) {
    console.warn('Failed to delete addresses:', error);
  }
  
  try {
    await prisma.productVariant.deleteMany();
  } catch (error) {
    console.warn('Failed to delete product variants:', error);
  }
  
  try {
    await prisma.cartItem.deleteMany();
  } catch (error) {
    console.warn('Failed to delete cart items:', error);
  }
  
  try {
    await prisma.cart.deleteMany();
  } catch (error) {
    console.warn('Failed to delete carts:', error);
  }
  
  try {
    await prisma.orderStatusHistory.deleteMany();
  } catch (error) {
    console.warn('Failed to delete order status history:', error);
  }
  
  try {
    await prisma.orderItem.deleteMany();
  } catch (error) {
    console.warn('Failed to delete order items:', error);
  }
  
  try {
    await prisma.order.deleteMany();
  } catch (error) {
    console.warn('Failed to delete orders:', error);
  }
  
  try {
    await prisma.coupon.deleteMany();
  } catch (error) {
    console.warn('Failed to delete coupons:', error);
  }
  
  // Delete products BEFORE categories (products reference categories)
  // This is critical - must succeed or categories can't be deleted
  try {
    await prisma.product.deleteMany();
  } catch (error) {
    console.error('CRITICAL: Failed to delete products:', error);
    // Try to delete any remaining products that might be blocking
    // Use a more aggressive approach if needed
    throw error; // Re-throw to prevent category deletion
  }
  
  // Now safe to delete categories
  try {
    await prisma.category.deleteMany();
  } catch (error) {
    console.error('CRITICAL: Failed to delete categories:', error);
    throw error; // Re-throw to prevent user deletion
  }
  
  // Delete users last (they are referenced by many tables)
  try {
    await prisma.user.deleteMany();
  } catch (error) {
    console.error('CRITICAL: Failed to delete users:', error);
    throw error; // Re-throw to surface the issue
  }
}

export async function setupTestDatabase() {
  await cleanupDatabase();
}

export async function teardownTestDatabase() {
  await cleanupDatabase();
  await prisma.$disconnect();
}
