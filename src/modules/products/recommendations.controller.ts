import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

export async function getRecommendations(req: Request, res: Response) {
  const userId = req.user?.id;
  const { limit } = req.query as { limit?: string };

  const limitNum = limit ? parseInt(limit, 10) : 10;

  // Get user's order history to find categories they've purchased from
  const userOrders = userId
    ? await prisma.order.findMany({
        where: { userId, status: { in: ['PAID', 'FULFILLED'] } },
        include: {
          items: {
            include: {
              product: {
                select: { categoryId: true },
              },
            },
          },
        },
        take: 10,
      })
    : [];

  // Extract category IDs from user's purchase history
  const categoryIds = new Set<string>();
  userOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.product.categoryId) {
        categoryIds.add(item.product.categoryId);
      }
    });
  });

  // Get products from user's favorite categories
  let recommendedProducts = await prisma.product.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      ...(categoryIds.size > 0 ? { categoryId: { in: Array.from(categoryIds) } } : {}),
    },
    take: limitNum,
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // If not enough products from user's categories, fill with popular products
  if (recommendedProducts.length < limitNum) {
    const popularProducts = await prisma.product.findMany({
      where: {
        active: true,
        stock: { gt: 0 },
        ...(categoryIds.size > 0 ? { categoryId: { notIn: Array.from(categoryIds) } } : {}),
        ...(recommendedProducts.length > 0
          ? { id: { notIn: recommendedProducts.map((p) => p.id) } }
          : {}),
      },
      take: limitNum - recommendedProducts.length,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    recommendedProducts = [...recommendedProducts, ...popularProducts];
  }

  return res.json({ products: recommendedProducts.slice(0, limitNum) });
}

export async function getRelatedProducts(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { limit } = req.query as { limit?: string };

  const limitNum = limit ? parseInt(limit, 10) : 5;

  // Get the product
  const product = await prisma.product.findUnique({
    where: { id },
    select: { categoryId: true },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Get related products from the same category
  const relatedProducts = await prisma.product.findMany({
    where: {
      active: true,
      categoryId: product.categoryId,
      id: { not: id },
      stock: { gt: 0 },
    },
    take: limitNum,
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ products: relatedProducts });
}
