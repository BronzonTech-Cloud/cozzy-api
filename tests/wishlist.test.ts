import request from 'supertest';

import { createApp } from '../src/app';
import {
  createTestUser,
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';
import { prisma } from '../src/config/prisma';

const app = createApp();

describe('Wishlist', () => {
  let userToken: string;
  let user2Token: string;
  let categoryId: string;
  let productId: string;
  let product2Id: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create users and get tokens using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;

    const user2Result = await createTestUserAndLogin(app, 'user2@example.com', 'USER');
    user2Token = user2Result.token;

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    const product = await createTestProduct(categoryId, {
      title: 'Test Product',
      priceCents: 1000,
      stock: 10,
    });
    productId = product.id;

    const product2 = await createTestProduct(categoryId, {
      title: 'Test Product 2',
      priceCents: 2000,
      stock: 5,
    });
    product2Id = product2.id;
  });

  describe('GET /api/v1/wishlist', () => {
    it('should get empty wishlist for new user', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('wishlist');
      expect(res.body.wishlist).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });

    it('should get wishlist with items', async () => {
      // Add items to wishlist
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      await request(app)
        .post(`/api/v1/wishlist/${product2Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.wishlist).toHaveLength(2);
      expect(res.body.count).toBe(2);
      expect(res.body.wishlist[0]).toHaveProperty('product');
      expect(res.body.wishlist[0]).toHaveProperty('createdAt');
    });

    it('should return wishlist sorted by newest first', async () => {
      // Add first product
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Add second product
      await request(app)
        .post(`/api/v1/wishlist/${product2Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.wishlist).toHaveLength(2);
      // Newest should be first (product2Id)
      expect(res.body.wishlist[0].product.id).toBe(product2Id);
      expect(res.body.wishlist[1].product.id).toBe(productId);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/wishlist');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/wishlist/:productId', () => {
    it('should add product to wishlist', async () => {
      const res = await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('item');
      expect(res.body.item.product.id).toBe(productId);
      expect(res.body.item).toHaveProperty('createdAt');
    });

    it('should reject adding non-existent product', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should reject adding inactive product', async () => {
      // Create inactive product using helper to ensure unique slug
      const inactiveProduct = await createTestProduct(categoryId, {
        title: 'Inactive Product',
        active: false,
        stock: 10,
      });

      const res = await request(app)
        .post(`/api/v1/wishlist/${inactiveProduct.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Product is not available');
    });

    it('should reject adding duplicate product', async () => {
      // Add product first time
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Try to add same product again
      const res = await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Product is already in wishlist');
    });

    it('should allow different users to add same product', async () => {
      // User 1 adds product
      const res1 = await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res1.status).toBe(201);

      // User 2 adds same product
      const res2 = await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res2.status).toBe(201);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post(`/api/v1/wishlist/${productId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/wishlist/:productId', () => {
    beforeEach(async () => {
      // Add product to wishlist
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);
    });

    it('should remove product from wishlist', async () => {
      const res = await request(app)
        .delete(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(204);

      // Verify product is removed
      const getRes = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(getRes.body.wishlist).toHaveLength(0);
    });

    it('should reject removing non-existent product from wishlist', async () => {
      const res = await request(app)
        .delete(`/api/v1/wishlist/${product2Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found in wishlist');
    });

    it('should reject removing product from other user wishlist', async () => {
      // User 1 has product in wishlist
      // User 2 tries to remove it
      const res = await request(app)
        .delete(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found in wishlist');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).delete(`/api/v1/wishlist/${productId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/wishlist/check/:productId', () => {
    it('should return false for product not in wishlist', async () => {
      const res = await request(app)
        .get(`/api/v1/wishlist/check/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.inWishlist).toBe(false);
      expect(res.body.productId).toBe(productId);
    });

    it('should return true for product in wishlist', async () => {
      // Add product to wishlist
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app)
        .get(`/api/v1/wishlist/check/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.inWishlist).toBe(true);
      expect(res.body.productId).toBe(productId);
    });

    it('should reject checking non-existent product', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist/check/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get(`/api/v1/wishlist/check/${productId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Wishlist isolation', () => {
    it('should isolate wishlists between users', async () => {
      // User 1 adds product
      await request(app)
        .post(`/api/v1/wishlist/${productId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // User 2 adds different product
      await request(app)
        .post(`/api/v1/wishlist/${product2Id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      // Check User 1's wishlist
      const res1 = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res1.body.wishlist).toHaveLength(1);
      expect(res1.body.wishlist[0].product.id).toBe(productId);

      // Check User 2's wishlist
      const res2 = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res2.body.wishlist).toHaveLength(1);
      expect(res2.body.wishlist[0].product.id).toBe(product2Id);
    });
  });
});
