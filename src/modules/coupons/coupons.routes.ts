import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  validateCoupon,
} from './coupons.controller';
import { createCouponSchema, updateCouponSchema, validateCouponSchema } from './coupons.schema';

export const couponsRouter = Router();

/**
 * @swagger
 * /api/v1/coupons:
 *   get:
 *     summary: List all coupons (Admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coupons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coupons:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Coupon'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 */
couponsRouter.get('/', authGuard, requireRole('ADMIN'), listCoupons);

/**
 * @swagger
 * /api/v1/coupons:
 *   post:
 *     summary: Create coupon (Admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponInput'
 *     responses:
 *       201:
 *         description: Coupon created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coupon:
 *                   $ref: '#/components/schemas/Coupon'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       409:
 *         description: Coupon code already exists
 */
couponsRouter.post(
  '/',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: createCouponSchema }),
  createCoupon,
);

/**
 * @swagger
 * /api/v1/coupons/validate:
 *   post:
 *     summary: Validate coupon code
 *     tags: [Coupons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, totalCents]
 *             properties:
 *               code:
 *                 type: string
 *               totalCents:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Coupon is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid: { type: boolean, example: true }
 *                 coupon:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     code: { type: string }
 *                     description: { type: string, nullable: true }
 *                     discountType: { type: string, enum: [PERCENTAGE, FIXED_AMOUNT] }
 *                     discountValue: { type: integer }
 *                 discountCents: { type: integer, description: 'Calculated discount in cents' }
 *                 finalTotalCents: { type: integer, description: 'Total after discount' }
 *       400:
 *         description: Coupon is invalid (expired, inactive, usage limit reached, etc.)
 *       404:
 *         description: Coupon not found
 */
couponsRouter.post('/validate', validate({ body: validateCouponSchema }), validateCoupon);

/**
 * @swagger
 * /api/v1/coupons/{id}:
 *   patch:
 *     summary: Update coupon (Admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coupon ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponInput'
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coupon:
 *                   $ref: '#/components/schemas/Coupon'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Coupon code already exists
 */
couponsRouter.patch(
  '/:id',
  authGuard,
  requireRole('ADMIN'),
  validate({ body: updateCouponSchema }),
  updateCoupon,
);

/**
 * @swagger
 * /api/v1/coupons/{id}:
 *   delete:
 *     summary: Delete coupon (Admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coupon ID
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Coupon deleted successfully' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
couponsRouter.delete('/:id', authGuard, requireRole('ADMIN'), deleteCoupon);
