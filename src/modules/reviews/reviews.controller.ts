import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';
import { handlePrismaError } from '../../utils/prisma-errors';
import { CreateReviewInput, UpdateReviewInput } from './reviews.schema';

/**
 * Check if user has purchased the product (for verified purchase badge)
 */
async function hasUserPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: {
      userId,
      status: 'PAID',
      items: {
        some: {
          productId,
        },
      },
    },
  });

  return !!order;
}

/**
 * Create review for a product
 * POST /api/v1/products/:productId/reviews
 */
export async function createReview(req: Request, res: Response) {
  const userId = req.user!.id;
  const { productId } = req.params as { productId: string };
  const { rating, title, comment } = req.body as CreateReviewInput;

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Check if user already reviewed this product
  const existingReview = await prisma.review.findUnique({
    where: {
      productId_userId: {
        productId,
        userId,
      },
    },
  });

  if (existingReview) {
    return res.status(409).json({ message: 'You have already reviewed this product' });
  }

  // Check if user has purchased the product (for verified purchase badge)
  const verified = await hasUserPurchasedProduct(userId, productId);

  // Create review
  const review = await prisma.review.create({
    data: {
      productId,
      userId,
      rating,
      title: title || null,
      comment: comment || null,
      verified,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  res.status(201).json({ review });
}

/**
 * Get product reviews
 * GET /api/v1/products/:productId/reviews
 */
export async function getProductReviews(req: Request, res: Response) {
  const { productId } = req.params as { productId: string };
  const { page = '1', limit = '10', sort = 'newest' } = req.query as Record<string, string>;

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const take = Math.min(Number(limit) || 10, 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  // Determine sort order
  const orderBy =
    sort === 'oldest'
      ? { createdAt: 'asc' as const }
      : sort === 'rating_high'
        ? { rating: 'desc' as const }
        : sort === 'rating_low'
          ? { rating: 'asc' as const }
          : { createdAt: 'desc' as const }; // newest (default)

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { productId },
      skip,
      take,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.review.count({ where: { productId } }),
  ]);

  // Calculate average rating
  const avgRatingResult = await prisma.review.aggregate({
    where: { productId },
    _avg: {
      rating: true,
    },
  });

  const averageRating = avgRatingResult._avg.rating || 0;

  res.json({
    reviews,
    pagination: {
      page: currentPage,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    totalReviews: total,
  });
}

/**
 * Get single review
 * GET /api/v1/reviews/:reviewId
 */
export async function getReview(req: Request, res: Response) {
  const { reviewId } = req.params as { reviewId: string };

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  if (!review) {
    return res.status(404).json({ message: 'Review not found' });
  }

  res.json({ review });
}

/**
 * Update own review
 * PATCH /api/v1/reviews/:reviewId
 */
export async function updateReview(req: Request, res: Response) {
  const userId = req.user!.id;
  const { reviewId } = req.params as { reviewId: string };
  const body = req.body as UpdateReviewInput;

  // Find review
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    return res.status(404).json({ message: 'Review not found' });
  }

  // Check if user owns the review
  if (review.userId !== userId) {
    return res.status(403).json({ message: 'You can only update your own reviews' });
  }

  // Update review
  try {
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: body,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    res.json({ review: updatedReview });
  } catch (error) {
    // Handle Prisma errors
    if (handlePrismaError(error, res)) {
      return;
    }
    // Fallback for unexpected errors
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Delete own review
 * DELETE /api/v1/reviews/:reviewId
 */
export async function deleteReview(req: Request, res: Response) {
  const userId = req.user!.id;
  const { reviewId } = req.params as { reviewId: string };

  // Find review
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    return res.status(404).json({ message: 'Review not found' });
  }

  // Check if user owns the review
  if (review.userId !== userId) {
    return res.status(403).json({ message: 'You can only delete your own reviews' });
  }

  // Delete review
  try {
    await prisma.review.delete({
      where: { id: reviewId },
    });

    res.status(204).send();
  } catch (error) {
    // Handle Prisma errors
    if (handlePrismaError(error, res)) {
      return;
    }
    // Fallback for unexpected errors
    res.status(500).json({ message: 'Internal server error' });
  }
}
