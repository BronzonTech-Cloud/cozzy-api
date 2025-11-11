import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import {
  createTestUser,
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';

const app = createApp();

describe('Order Status Tracking', () => {
  let userToken: string;
  let adminToken: string;
  let categoryId: string;
  let productId: string;
  let orderId: string;

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

    // Create an order
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [{ productId, quantity: 2 }],
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body).toHaveProperty('order');
    expect(orderRes.body.order).not.toBeNull();
    expect(orderRes.body.order).toHaveProperty('id');
    orderId = orderRes.body.order.id;
  });

  describe('PATCH /api/v1/orders/:id/status', () => {
    it('should update order status (Admin only)', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PAID',
          note: 'Payment received',
        });

      expect(res.status).toBe(200);
      expect(res.body.order).toHaveProperty('status', 'PAID');

      // Check status history was created
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });
      expect(history.length).toBeGreaterThan(1); // Initial + new status
      expect(history[0].status).toBe('PAID');
      expect(history[0].note).toBe('Payment received');
    });

    it('should set shippedAt when status changes to FULFILLED', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'FULFILLED',
          trackingNumber: 'TRACK123',
        });

      expect(res.status).toBe(200);
      expect(res.body.order).toHaveProperty('status', 'FULFILLED');
      expect(res.body.order).toHaveProperty('trackingNumber', 'TRACK123');
      expect(res.body.order.shippedAt).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'PAID',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .patch('/api/v1/orders/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PAID',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/orders/:id/tracking', () => {
    it('should get order tracking information', async () => {
      // Update order status first
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'FULFILLED',
          trackingNumber: 'TRACK123',
        });

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order).toHaveProperty('status');
      expect(res.body.order).toHaveProperty('trackingNumber', 'TRACK123');
      expect(res.body.order).toHaveProperty('statusHistory');
      expect(res.body.order.statusHistory).toBeInstanceOf(Array);
      expect(res.body.order.statusHistory.length).toBeGreaterThan(0);
    });

    it('should return 403 for other user orders', async () => {
      await createTestUser('other@example.com', 'USER');
      const otherLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'other@example.com',
        password: 'password123',
      });
      const otherToken = otherLogin.body.accessToken;

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to view any order', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderId}/tracking`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/orders/:id/cancel', () => {
    it('should cancel order (User)', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order).toHaveProperty('status', 'CANCELLED');

      // Check stock was restored
      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product?.stock).toBe(10); // Original stock restored
    });

    it('should create status history entry on cancel', async () => {
      await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });

      const cancelledEntry = history.find((h) => h.status === 'CANCELLED');
      expect(cancelledEntry).toBeDefined();
      expect(cancelledEntry?.note).toBe('Cancelled by user');
    });

    it('should return 400 if order cannot be cancelled', async () => {
      // Update order to FULFILLED
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'FULFILLED',
        });

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 403 for other user orders', async () => {
      await createTestUser('other@example.com', 'USER');
      const otherLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'other@example.com',
        password: 'password123',
      });
      const otherToken = otherLogin.body.accessToken;

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/orders/history', () => {
    it('should get order history with filters', async () => {
      // Create another order
      const orderRes2 = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        });
      const orderId2 = orderRes2.body.order.id;

      // Update second order status
      await request(app)
        .patch(`/api/v1/orders/${orderId2}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PAID',
        });

      // Get history filtered by status
      const res = await request(app)
        .get('/api/v1/orders/history')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ status: 'PAID' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orders');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.orders.every((o: { status: string }) => o.status === 'PAID')).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/orders/history')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ limit: 1, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('limit', 1);
      expect(res.body.pagination).toHaveProperty('offset', 0);
      expect(res.body.pagination).toHaveProperty('hasMore');
    });

    it('should filter by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const res = await request(app)
        .get('/api/v1/orders/history')
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.orders).toBeInstanceOf(Array);
    });
  });
});
