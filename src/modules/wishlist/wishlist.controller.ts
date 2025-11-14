import { Prisma } from '@prisma/client';
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

  // Add to wishlist with error handling
  try {
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
  } catch (error: unknown) {
    // Handle Prisma errors and map to appropriate HTTP status codes
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        // This could mean userId or productId doesn't exist
        return res.status(404).json({ message: 'Product or user not found' });
      }
      if (error.code === 'P2002') {
        // Unique constraint violation (shouldn't happen due to earlier check, but handle it)
        return res.status(409).json({ message: 'Product is already in wishlist' });
      }
    }
    // Unexpected error
    console.error('Error adding to wishlist:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
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

  // Remove from wishlist with error handling
  try {
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    res.status(204).send();
  } catch (error: unknown) {
    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found (shouldn't happen due to earlier check, but handle it)
        return res.status(404).json({ message: 'Product not found in wishlist' });
      }
    }
    // Unexpected error
    console.error('Error removing from wishlist:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
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
