import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createReviewSchema, updateReviewSchema } from './reviews.schema';
import {
  createReview,
  deleteReview,
  getProductReviews,
  getReview,
  updateReview,
} from './reviews.controller';

export const reviewsRouter = Router();

/**
 * @swagger
 * /api/v1/products/{productId}/reviews:
 *   post:
 *     summary: Create a review for a product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5 stars
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 description: Review title (optional)
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Review comment (optional)
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 review:
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Product not found
 *       409:
 *         description: User has already reviewed this product
 */
reviewsRouter.post(
  '/products/:productId/reviews',
  authGuard,
  validate({ body: createReviewSchema }),
  createReview,
);

/**
 * @swagger
 * /api/v1/products/{productId}/reviews:
 *   get:
 *     summary: Get product reviews
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, rating_high, rating_low]
 *           default: newest
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 averageRating:
 *                   type: number
 *                   description: Average rating (1-5)
 *                 totalReviews:
 *                   type: integer
 *       404:
 *         description: Product not found
 */
reviewsRouter.get('/products/:productId/reviews', getProductReviews);

/**
 * @swagger
 * /api/v1/reviews/{reviewId}:
 *   get:
 *     summary: Get a single review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 review:
 *                   $ref: '#/components/schemas/Review'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
reviewsRouter.get('/reviews/:reviewId', getReview);

/**
 * @swagger
 * /api/v1/reviews/{reviewId}:
 *   patch:
 *     summary: Update own review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 review:
 *                   $ref: '#/components/schemas/Review'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only update own reviews)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
reviewsRouter.patch(
  '/reviews/:reviewId',
  authGuard,
  validate({ body: updateReviewSchema }),
  updateReview,
);

/**
 * @swagger
 * /api/v1/reviews/{reviewId}:
 *   delete:
 *     summary: Delete own review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Review ID
 *     responses:
 *       204:
 *         description: Review deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only delete own reviews)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
reviewsRouter.delete('/reviews/:reviewId', authGuard, deleteReview);
