import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { deleteProductVariant, updateProductVariant } from './variants.controller';
import { updateVariantSchema } from './variants.schema';

export const variantsRouter = Router();

/**
 * @swagger
 * /api/v1/variants/{id}:
 *   patch:
 *     summary: Update product variant (Admin only)
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
 *         description: Variant ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductVariantInput'
 *     responses:
 *       200:
 *         description: Variant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variant:
 *                   $ref: '#/components/schemas/ProductVariant'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: SKU already exists
 */
variantsRouter.patch(
  '/:id',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: updateVariantSchema }),
  updateProductVariant,
);

/**
 * @swagger
 * /api/v1/variants/{id}:
 *   delete:
 *     summary: Delete product variant (Admin only)
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
 *         description: Variant ID
 *     responses:
 *       200:
 *         description: Variant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Variant deleted successfully' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
variantsRouter.delete('/:id', authGuard, requireRole('ADMIN'), deleteProductVariant);
