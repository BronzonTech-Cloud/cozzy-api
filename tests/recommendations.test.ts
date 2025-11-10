import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { createTestUser, createTestCategory, createTestProduct, cleanupDatabase } from './helpers';

const app = createApp();

describe('Product Recommendations', () => {
  let userToken: string;
  let category1Id: string;
  let category2Id: string;
  let product1Id: string;
  let product2Id: string;
  let product3Id: string;

  beforeEach(async () => {
    await cleanupDatabase();
    const user = await createTestUser('user@example.com', 'USER');

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });
    userToken = loginRes.body.accessToken;

    const category1 = await createTestCategory('Electronics');
    category1Id = category1.id;

    const category2 = await createTestCategory('Books');
    category2Id = category2.id;

    const product1 = await createTestProduct(category1Id, {
      title: 'Laptop',
      priceCents: 100000,
      stock: 5,
    });
    product1Id = product1.id;

    const product2 = await createTestProduct(category1Id, {
      title: 'Smartphone',
      priceCents: 50000,
      stock: 10,
    });
    product2Id = product2.id;

    const product3 = await createTestProduct(category2Id, {
      title: 'Book',
      priceCents: 2000,
      stock: 20,
    });
    product3Id = product3.id;
  });

  describe('GET /api/v1/products/recommendations', () => {
    it('should get personalized recommendations based on purchase history', async () => {
      // Create an order with product from category1
      const order = await prisma.order.create({
        data: {
          userId: (await prisma.user.findUnique({ where: { email: 'user@example.com' } }))!.id,
          status: 'PAID',
          totalCents: 100000,
          currency: 'USD',
          itemsCount: 1,
          paymentProvider: 'STRIPE',
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product1Id,
          quantity: 1,
          unitPriceCents: 100000,
          subtotalCents: 100000,
        },
      });

      const res = await request(app)
        .get('/api/v1/products/recommendations')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products).toBeInstanceOf(Array);
      // Should recommend products from same category (category1)
      expect(
        res.body.products.some((p: { categoryId: string }) => p.categoryId === category1Id),
      ).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/products/recommendations');

      expect(res.status).toBe(401);
    });

    it('should return products even without purchase history', async () => {
      const res = await request(app)
        .get('/api/v1/products/recommendations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toBeInstanceOf(Array);
      expect(res.body.products.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const res = await request(app)
        .get('/api/v1/products/recommendations')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/v1/products/:id/related', () => {
    it('should get related products from same category', async () => {
      const res = await request(app).get(`/api/v1/products/${product1Id}/related`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products).toBeInstanceOf(Array);
      // All related products should be from same category
      expect(
        res.body.products.every((p: { categoryId: string }) => p.categoryId === category1Id),
      ).toBe(true);
      // Should not include the product itself
      expect(res.body.products.every((p: { id: string }) => p.id !== product1Id)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${product1Id}/related`)
        .query({ limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeLessThanOrEqual(1);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get(
        '/api/v1/products/00000000-0000-0000-0000-000000000000/related',
      );

      expect(res.status).toBe(404);
    });

    it('should only return products in stock', async () => {
      // Create out of stock product in same category
      await createTestProduct(category1Id, {
        title: 'Out of Stock Product',
        priceCents: 1000,
        stock: 0,
      });

      const res = await request(app).get(`/api/v1/products/${product1Id}/related`);

      expect(res.status).toBe(200);
      expect(res.body.products.every((p: { stock: number }) => p.stock > 0)).toBe(true);
    });
  });
});

