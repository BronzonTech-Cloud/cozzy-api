import type { Request, Response } from 'express';
import request from 'supertest';
import { vi } from 'vitest';

import { createApp } from '../src/app';
import {
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';

vi.mock('../src/config/stripe', () => {
  const mockCreate = vi.fn().mockResolvedValue({ url: 'https://mock.checkout/session' });
  const mockConstructEvent = vi.fn().mockImplementation((body: Buffer) => {
    // Parse the body to get the orderId if it's in the request
    try {
      const parsed = JSON.parse(body.toString());
      const orderId = parsed?.data?.object?.metadata?.orderId || 'test-order-id';
      return {
        type: 'checkout.session.completed',
        data: { object: { metadata: { orderId }, payment_intent: 'pi_test' } },
      };
    } catch {
      return {
        type: 'checkout.session.completed',
        data: { object: { metadata: { orderId: 'test-order-id' }, payment_intent: 'pi_test' } },
      };
    }
  });
  return {
    stripe: {
      checkout: { sessions: { create: mockCreate } },
      webhooks: { constructEvent: mockConstructEvent },
    },
  };
});

vi.mock('../src/config/env', async () => {
  const actual = (await vi.importActual('../src/config/env')) as { env: Record<string, unknown> };
  return {
    ...actual,
    env: {
      ...actual.env,
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock',
    },
  };
});

const app = createApp();

describe('Payments', () => {
  let userToken: string;
  let categoryId: string;
  let productId: string;
  let orderId: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create user and get token using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    const product = await createTestProduct(categoryId, { title: 'Test Product', stock: 10 });
    productId = product.id;

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [{ productId, quantity: 1 }],
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body).toHaveProperty('order');
    expect(orderRes.body.order).not.toBeNull();
    expect(orderRes.body.order).toHaveProperty('id');
    orderId = orderRes.body.order.id;
  });

  describe('POST /api/v1/payments/checkout', () => {
    it('should create checkout session (Stripe mocked)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      expect(res.status).toBe(200);
      expect(res.body.url).toBe('https://mock.checkout/session');
    });

    it('should reject checkout for non-existent order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: 'non-existent-id' });

      expect(res.status).toBe(404);
    });

    it('should reject checkout for order not owned by user', async () => {
      const otherResult = await createTestUserAndLogin(app, 'other@example.com', 'USER');
      const otherToken = otherResult.token;

      const res = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/payments/checkout').send({ orderId });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/payments/stripe/webhook', () => {
    it('should handle webhook requests (Stripe mocked)', async () => {
      // Use the actual order ID from beforeEach
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId },
            payment_intent: 'pi_test_123',
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockEvent);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('received', true);
    });

    it('should handle webhook with no orderId in metadata', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
            payment_intent: 'pi_test_123',
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockEvent);

      expect(res.status).toBe(200);
    });

    it('should handle payment_intent.payment_failed event', async () => {
      // Create an order with a payment intent ID
      await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId });

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_123',
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockEvent);

      expect(res.status).toBe(200);
    });

    it('should handle unknown event types', async () => {
      const mockEvent = {
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockEvent);

      expect(res.status).toBe(200);
    });

    it('should return 400 for missing signature', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId },
            payment_intent: 'pi_test_123',
          },
        },
      };

      const res = await request(app).post('/api/v1/payments/stripe/webhook').send(mockEvent);

      expect(res.status).toBe(400);
      expect(res.text).toContain('Missing signature');
    });

    it('should return 400 for webhook signature verification error', async () => {
      const { stripe } = await import('../src/config/stripe');
      if (!stripe) {
        throw new Error('Stripe mock not configured');
      }
      vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orderId },
            payment_intent: 'pi_test_123',
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('stripe-signature', 'invalid-signature')
        .send(mockEvent);

      expect(res.status).toBe(400);
      expect(res.text).toContain('Webhook Error');
    });

    it('should return 500 when Stripe webhook secret is not configured', async () => {
      // Mock stripe as null and env without STRIPE_WEBHOOK_SECRET
      vi.doMock('../src/config/stripe', () => ({
        stripe: null,
      }));

      vi.doMock('../src/config/env', async () => {
        const actual = (await vi.importActual('../src/config/env')) as {
          env: Record<string, unknown>;
        };
        return {
          ...actual,
          env: {
            ...actual.env,
            STRIPE_WEBHOOK_SECRET: undefined,
          },
        };
      });

      // Clear the module cache and re-import
      vi.resetModules();
      const paymentsModule = await import('../src/modules/payments/payments.controller');
      const { stripeWebhook } = paymentsModule;

      // Create a mock request/response
      const mockReq = {
        headers: { 'stripe-signature': 'test-signature' },
        body: {
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { orderId },
              payment_intent: 'pi_test_123',
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as Response;

      await stripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Stripe webhook not configured' });
    });
  });
});
