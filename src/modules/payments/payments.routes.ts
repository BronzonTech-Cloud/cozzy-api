import express, { Router } from 'express';

import { createCheckoutSession, stripeWebhook } from './payments.controller';
import { authGuard } from '../../middleware/auth';

export const paymentsRouter = Router();

/**
 * @swagger
 * /api/v1/payments/checkout:
 *   post:
 *     summary: Create Stripe checkout session
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *                 description: Order ID to create checkout session for
 *     responses:
 *       200:
 *         description: Checkout session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe Checkout URL
 *       400:
 *         description: Invalid order or order already paid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden (can only checkout own orders)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
paymentsRouter.post('/checkout', authGuard, createCheckoutSession);

/**
 * @swagger
 * /api/v1/payments/stripe/webhook:
 *   post:
 *     summary: Stripe webhook endpoint
 *     tags: [Payments]
 *     description: |
 *       This endpoint receives webhook events from Stripe.
 *       It updates order status when payment is completed.
 *       **Note:** This endpoint requires raw body for signature verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Stripe webhook event
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature or payload
 */
// Stripe requires raw body for signature verification
paymentsRouter.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
