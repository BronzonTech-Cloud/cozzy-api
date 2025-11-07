import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createProductSchema, updateProductSchema } from './products.schema';
import {
  createProduct,
  deleteProduct,
  getProductBySlug,
  listProducts,
  updateProduct,
} from './products.controller';

export const productsRouter = Router();

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: List all products
 *     tags: [Products]
 *     parameters:
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
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
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
 */
productsRouter.get('/', listProducts);

/**
 * @swagger
 * /api/v1/products/{slug}:
 *   get:
 *     summary: Get product by slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Product slug
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productsRouter.get('/:slug', getProductBySlug);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create a new product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - priceCents
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priceCents:
 *                 type: integer
 *               currency:
 *                 type: string
 *                 default: USD
 *               sku:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               active:
 *                 type: boolean
 *                 default: true
 *               stock:
 *                 type: integer
 *                 default: 0
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 */
productsRouter.post(
  '/',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: createProductSchema }),
  createProduct,
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   patch:
 *     summary: Update a product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priceCents:
 *                 type: integer
 *               currency:
 *                 type: string
 *               sku:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               active:
 *                 type: boolean
 *               stock:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productsRouter.patch(
  '/:id',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: updateProductSchema }),
  updateProduct,
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Delete a product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productsRouter.delete('/:id', authGuard, requireRole('ADMIN'), deleteProduct);
