import express, { Router } from 'express';

import { createCheckoutSession, stripeWebhook } from './payments.controller';
import { authGuard } from '../../middleware/auth';

export const paymentsRouter = Router();

paymentsRouter.post('/checkout', authGuard, createCheckoutSession);

// Stripe requires raw body for signature verification
paymentsRouter.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
