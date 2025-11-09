import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

/**
 * Get user's wishlist
 * GET /api/v1/wishlist
 */
export async function getWishlist(req: Request, res: Response) {
  const userId = req.user!.id;

  const wishlist = await prisma.wishlist.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    wishlist: wishlist.map((item) => ({
      id: item.id,
      product: item.product,
      createdAt: item.createdAt,
    })),
    count: wishlist.length,
  });
}

/**
 * Add product to wishlist
 * POST /api/v1/wishlist/:productId
 */
export async function addToWishlist(req: Request, res: Response) {
  const userId = req.user!.id;
  const { productId } = req.params as { productId: string };

  // Verify product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  if (!product.active) {
    return res.status(400).json({ message: 'Product is not available' });
  }

  // Check if product is already in wishlist
  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ message: 'Product is already in wishlist' });
  }

  // Add to wishlist
  const wishlistItem = await prisma.wishlist.create({
    data: {
      userId,
      productId,
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  res.status(201).json({
    item: {
      id: wishlistItem.id,
      product: wishlistItem.product,
      createdAt: wishlistItem.createdAt,
    },
  });
}

/**
 * Remove product from wishlist
 * DELETE /api/v1/wishlist/:productId
 */
export async function removeFromWishlist(req: Request, res: Response) {
  const userId = req.user!.id;
  const { productId } = req.params as { productId: string };

  // Find wishlist item
  const wishlistItem = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (!wishlistItem) {
    return res.status(404).json({ message: 'Product not found in wishlist' });
  }

  // Remove from wishlist
  await prisma.wishlist.delete({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  res.status(204).send();
}

/**
 * Check if product is in wishlist
 * GET /api/v1/wishlist/check/:productId
 */
export async function checkWishlist(req: Request, res: Response) {
  const userId = req.user!.id;
  const { productId } = req.params as { productId: string };

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Check if product is in wishlist
  const wishlistItem = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  res.json({
    inWishlist: !!wishlistItem,
    productId,
  });
}
