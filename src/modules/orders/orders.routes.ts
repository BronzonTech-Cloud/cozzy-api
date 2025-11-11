import { Router } from 'express';

import { authGuard, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  cancelOrder,
  getOrderHistory,
  getOrderTracking,
  updateOrderStatus,
} from './order-status.controller';
import { orderHistoryQuerySchema, updateOrderStatusSchema } from './order-status.schema';
import { createOrderSchema } from './orders.schema';
import { createOrder, getOrder, listOrders } from './orders.controller';

export const ordersRouter = Router();

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *               currency:
 *                 type: string
 *                 default: USD
 *               couponId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional coupon id to apply to the order
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
ordersRouter.use(authGuard);
ordersRouter.post('/', validate({ body: createOrderSchema }), createOrder);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: List orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Regular users can only see their own orders.
 *       Admins can see all orders.
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
ordersRouter.get('/', listOrders);

/**
 * @swagger
 * /api/v1/orders/history:
 *   get:
 *     summary: Get order history with filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED, FULFILLED, REFUNDED]
 *         description: Filter by order status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders until this date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of orders to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of orders to skip
 *     responses:
 *       200:
 *         description: Order history with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     hasMore: { type: boolean }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
ordersRouter.get('/history', validate({ query: orderHistoryQuerySchema }), getOrderHistory);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Regular users can only access their own orders.
 *       Admins can access any order.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only access own orders)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
ordersRouter.get('/:id', getOrder);

/**
 * @swagger
 * /api/v1/orders/{id}/status:
 *   patch:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, CANCELLED, FULFILLED, REFUNDED]
 *               note:
 *                 type: string
 *                 maxLength: 500
 *               trackingNumber:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
ordersRouter.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validate({ body: updateOrderStatusSchema }),
  updateOrderStatus,
);

/**
 * @swagger
 * /api/v1/orders/{id}/tracking:
 *   get:
 *     summary: Get order tracking information
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order tracking information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     status: { type: string, enum: [PENDING, PAID, CANCELLED, FULFILLED, REFUNDED] }
 *                     trackingNumber: { type: string, nullable: true }
 *                     shippedAt: { type: string, format: date-time, nullable: true }
 *                     deliveredAt: { type: string, format: date-time, nullable: true }
 *                     statusHistory:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrderStatusHistory'
 *                     items: { type: array, items: { $ref: '#/components/schemas/OrderItem' } }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only access own orders)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
ordersRouter.get('/:id/tracking', getOrderTracking);

/**
 * @swagger
 * /api/v1/orders/{id}/cancel:
 *   post:
 *     summary: Cancel order (User)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Cannot cancel order (invalid status)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only cancel own orders)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
ordersRouter.post('/:id/cancel', cancelOrder);
