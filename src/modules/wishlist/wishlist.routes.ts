import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import {
  addToWishlist,
  checkWishlist,
  getWishlist,
  removeFromWishlist,
} from './wishlist.controller';

export const wishlistRouter = Router();

// All wishlist routes require authentication
wishlistRouter.use(authGuard);

/**
 * @swagger
 * /api/v1/wishlist:
 *   get:
 *     summary: Get user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     description: Returns all products in the user's wishlist
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wishlist:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       product:
 *                         $ref: '#/components/schemas/Product'
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: integer
 *                   description: Total number of items in wishlist
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
wishlistRouter.get('/', getWishlist);

/**
 * @swagger
 * /api/v1/wishlist/{productId}:
 *   post:
 *     summary: Add product to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     description: Adds a product to the user's wishlist
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID to add to wishlist
 *     responses:
 *       201:
 *         description: Product added to wishlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 item:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     product:
 *                       $ref: '#/components/schemas/Product'
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request (product not available)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Product already in wishlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
wishlistRouter.post('/:productId', addToWishlist);

/**
 * @swagger
 * /api/v1/wishlist/{productId}:
 *   delete:
 *     summary: Remove product from wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     description: Removes a product from the user's wishlist
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID to remove from wishlist
 *     responses:
 *       204:
 *         description: Product removed from wishlist successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Product not found in wishlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
wishlistRouter.delete('/:productId', removeFromWishlist);

/**
 * @swagger
 * /api/v1/wishlist/check/{productId}:
 *   get:
 *     summary: Check if product is in wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     description: Checks whether a specific product is in the user's wishlist
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID to check
 *     responses:
 *       200:
 *         description: Check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inWishlist:
 *                   type: boolean
 *                   description: Whether the product is in wishlist
 *                 productId:
 *                   type: string
 *                   format: uuid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
wishlistRouter.get('/check/:productId', checkWishlist);
