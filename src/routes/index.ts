import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes';
import { usersRouter } from '../modules/users/users.routes';
import { categoriesRouter } from '../modules/categories/categories.routes';
import { productsRouter } from '../modules/products/products.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';

export const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 ts:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/categories', categoriesRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
