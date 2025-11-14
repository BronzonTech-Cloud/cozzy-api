import request from 'supertest';

import { createApp } from '../src/app';
import {
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';

const app = createApp();

describe('Cart', () => {
  let userToken: string;
  let categoryId: string;
  let productId: string;
  let product2Id: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create user and get token using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;

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

  describe('GET /api/v1/cart', () => {
    it('should get empty cart for new user', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cart');
      expect(res.body.cart).toHaveProperty('items');
      expect(res.body.cart.items).toHaveLength(0);
      expect(res.body.cart).toHaveProperty('totalCents', 0);
      expect(res.body.cart).toHaveProperty('itemsCount', 0);
    });

    it('should get cart with items', async () => {
      // Add items to cart
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: product2Id, quantity: 1 });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(2);
      expect(res.body.cart.totalCents).toBe(4000); // (2 * 1000) + (1 * 2000)
      expect(res.body.cart.itemsCount).toBe(3); // 2 + 1
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/cart');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/cart', () => {
    it('should add item to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('item');
      expect(res.body.item.productId).toBe(productId);
      expect(res.body.item.quantity).toBe(2);
      expect(res.body.item.product).toHaveProperty('id', productId);
    });

    it('should increase quantity when adding same product again', async () => {
      // Add product first time
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      // Add same product again
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.item.quantity).toBe(5); // 2 + 3
    });

    it('should reject adding non-existent product', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should reject adding inactive product', async () => {
      // Create inactive product using helper to ensure unique slug and proper setup
      const inactiveProduct = await createTestProduct(categoryId, {
        title: 'Inactive Product',
        active: false,
        stock: 10,
      });

      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: inactiveProduct.id, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Product is not available');
    });

    it('should reject adding product with insufficient stock', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 100 }); // More than available stock (10)

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should validate input', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 'invalid-uuid', quantity: -1 });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/cart').send({ productId, quantity: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/cart/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart
      const addRes = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      expect(addRes.status).toBe(201);
      expect(addRes.body).toHaveProperty('item');
      expect(addRes.body.item).not.toBeNull();
      expect(addRes.body.item).toHaveProperty('id');
      cartItemId = addRes.body.item.id;
    });

    it('should update cart item quantity', async () => {
      const res = await request(app)
        .patch(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.item.quantity).toBe(5);
    });

    it('should reject updating with insufficient stock', async () => {
      const res = await request(app)
        .patch(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 100 }); // More than available stock (10)

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should reject updating non-existent cart item', async () => {
      const res = await request(app)
        .patch('/api/v1/cart/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart item not found');
    });

    it('should validate input', async () => {
      const res = await request(app)
        .patch(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: -1 });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).patch(`/api/v1/cart/${cartItemId}`).send({ quantity: 5 });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/cart/:itemId', () => {
    let cartItemId: string;

    beforeEach(async () => {
      // Add item to cart
      const addRes = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      expect(addRes.status).toBe(201);
      expect(addRes.body).toHaveProperty('item');
      expect(addRes.body.item).not.toBeNull();
      expect(addRes.body.item).toHaveProperty('id');
      cartItemId = addRes.body.item.id;
    });

    it('should remove item from cart', async () => {
      const res = await request(app)
        .delete(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(204);

      // Verify item is removed
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(cartRes.body.cart.items).toHaveLength(0);
    });

    it('should reject removing non-existent cart item', async () => {
      const res = await request(app)
        .delete('/api/v1/cart/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart item not found');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).delete(`/api/v1/cart/${cartItemId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/cart', () => {
    beforeEach(async () => {
      // Add items to cart
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: product2Id, quantity: 1 });
    });

    it('should clear entire cart', async () => {
      const res = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(204);

      // Verify cart is empty
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(cartRes.body.cart.items).toHaveLength(0);
      expect(cartRes.body.cart.totalCents).toBe(0);
      expect(cartRes.body.cart.itemsCount).toBe(0);
    });

    it('should reject clearing non-existent cart', async () => {
      // Create another user without cart
      const user2Result = await createTestUserAndLogin(app, 'user2@example.com', 'USER');
      const user2Token = user2Result.token;

      const res = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart not found');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).delete('/api/v1/cart');

      expect(res.status).toBe(401);
    });
  });

  describe('Cart persistence', () => {
    it('should persist cart across requests', async () => {
      // Add item to cart
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 });

      // Get cart in separate request
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].quantity).toBe(2);
    });
  });
});
