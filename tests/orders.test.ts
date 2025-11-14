import request from 'supertest';

import { createApp } from '../src/app';
import {
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';

const app = createApp();

describe('Orders', () => {
  let userToken: string;
  let adminToken: string;
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create users and get tokens using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;

    const adminResult = await createTestUserAndLogin(app, 'admin@example.com', 'ADMIN');
    adminToken = adminResult.token;

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    const product = await createTestProduct(categoryId, { title: 'Test Product', stock: 10 });
    productId = product.id;
  });

  describe('POST /api/v1/orders', () => {
    it('should create order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.order).toHaveProperty('id');
      expect(res.body.order.status).toBe('PENDING');
      expect(res.body.order.itemsCount).toBe(2);
    });

    it('should reject order with insufficient stock', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 100 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should reject order with invalid product', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: 'invalid-id', quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          items: [{ productId, quantity: 1 }],
        });

      expect(res.status).toBe(401);
    });

    it('should apply valid coupon to order', async () => {
      // Create a valid coupon
      const couponRes = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'ORDER10',
          description: '10% off',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
          active: true,
        });

      expect(couponRes.status).toBe(201);
      const couponId = couponRes.body.coupon.id;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
          couponId,
        });

      expect(res.status).toBe(201);
      expect(res.body.order).toHaveProperty('couponId', couponId);
      expect(res.body.order.discountCents).toBeGreaterThan(0);
    });

    it('should reject order with invalid coupon', async () => {
      // Use a valid UUID format that doesn't exist
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
          couponId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Coupon not found');
    });

    it('should reject order with expired coupon', async () => {
      // Create an expired coupon
      const couponRes = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'EXPIRED10',
          description: 'Expired coupon',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          validUntil: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          active: true,
        });

      expect(couponRes.status).toBe(201);
      const couponId = couponRes.body.coupon.id;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
          couponId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should list user orders', async () => {
      // Create an order first (if not already created in beforeEach)
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      // If order creation failed, skip this test
      expect(createRes.status).toBe(201);

      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    });

    it('should list all orders as admin', async () => {
      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      const res = await request(app)
        .get('/api/v1/orders?all=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should get order by id', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      const orderId = createRes.body.order.id;

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order.id).toBe(orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .get('/api/v1/orders/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('should allow admin to access any order', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });

      const orderId = createRes.body.order.id;

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
