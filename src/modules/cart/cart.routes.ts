import { Router } from 'express';

import { authGuard } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { addToCartSchema, updateCartItemSchema } from './cart.schema';
import { addToCart, clearCart, getCart, removeCartItem, updateCartItem } from './cart.controller';

export const cartRouter = Router();

// All cart routes require authentication
cartRouter.use(authGuard);

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     description: Returns the user's shopping cart with all items and calculated totals
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cart:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CartItem'
 *                     totalCents:
 *                       type: integer
 *                       description: Total price in cents
 *                     itemsCount:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
cartRouter.get('/', getCart);

/**
 * @swagger
 * /api/v1/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     description: Adds a product to the user's cart. If the product already exists in the cart, the quantity is increased.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: Product ID to add to cart
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Quantity to add
 *     responses:
 *       201:
 *         description: Item added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/CartItem'
 *       400:
 *         description: Bad request (product not available, insufficient stock, etc.)
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
 */
cartRouter.post('/', validate({ body: addToCartSchema }), addToCart);

/**
 * @swagger
 * /api/v1/cart/{itemId}:
 *   patch:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     description: Updates the quantity of a specific item in the cart
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Cart item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: New quantity
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/CartItem'
 *       400:
 *         description: Bad request (insufficient stock, invalid quantity, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cart or cart item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
cartRouter.patch('/:itemId', validate({ body: updateCartItemSchema }), updateCartItem);

/**
 * @swagger
 * /api/v1/cart/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     description: Removes a specific item from the cart
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Cart item ID
 *     responses:
 *       204:
 *         description: Item removed successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cart or cart item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
cartRouter.delete('/:itemId', removeCartItem);

/**
 * @swagger
 * /api/v1/cart:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     description: Removes all items from the user's cart
 *     responses:
 *       204:
 *         description: Cart cleared successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cart not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
cartRouter.delete('/', clearCart);
