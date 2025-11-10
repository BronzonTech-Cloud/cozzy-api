import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUser, createTestCategory, createTestProduct, cleanupDatabase } from './helpers';

const app = createApp();

describe('Product Variants', () => {
  let adminToken: string;
  let userToken: string;
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    await cleanupDatabase();
    await createTestUser('admin@example.com', 'ADMIN');
    await createTestUser('user@example.com', 'USER');

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@example.com',
      password: 'password123',
    });
    adminToken = adminLogin.body.accessToken;

    const userLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });
    userToken = userLogin.body.accessToken;

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    const product = await createTestProduct(categoryId, { title: 'Test Product', stock: 10 });
    productId = product.id;
  });

  describe('GET /api/v1/products/:id/variants', () => {
    it('should get product variants', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/variants`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('variants');
      expect(res.body.variants).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get('/api/v1/products/00000000-0000-0000-0000-000000000000/variants');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/products/:id/variants', () => {
    it('should create product variant (Admin only)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Large',
          sku: 'PROD-LG-001',
          priceCents: 1500,
          stock: 5,
          images: ['https://example.com/image.jpg'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('variant');
      expect(res.body.variant).toHaveProperty('name', 'Size: Large');
      expect(res.body.variant).toHaveProperty('sku', 'PROD-LG-001');
      expect(res.body.variant).toHaveProperty('priceCents', 1500);
      expect(res.body.variant).toHaveProperty('stock', 5);
    });

    it('should create variant without optional fields', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Color: Red',
        });

      expect(res.status).toBe(201);
      expect(res.body.variant).toHaveProperty('name', 'Color: Red');
      expect(res.body.variant.stock).toBe(0);
      expect(res.body.variant.images).toEqual([]);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Size: Large',
        });

      expect(res.status).toBe(403);
    });

    it('should return 409 for duplicate SKU', async () => {
      // Create first variant
      await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Large',
          sku: 'PROD-LG-001',
        });

      // Try to create another with same SKU
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Medium',
          sku: 'PROD-LG-001',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'SKU already exists');
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required name field
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/variants/:id', () => {
    let variantId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Large',
          sku: 'PROD-LG-001',
          stock: 5,
        });

      variantId = res.body.variant.id;
    });

    it('should update product variant (Admin only)', async () => {
      const res = await request(app)
        .patch(`/api/v1/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Extra Large',
          stock: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.variant).toHaveProperty('name', 'Size: Extra Large');
      expect(res.body.variant).toHaveProperty('stock', 10);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .patch(`/api/v1/variants/${variantId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent variant', async () => {
      const res = await request(app)
        .patch('/api/v1/variants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(res.status).toBe(404);
    });

    it('should return 409 for duplicate SKU', async () => {
      // Create another variant with different SKU
      const res2 = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Medium',
          sku: 'PROD-MD-001',
        });
      const variantId2 = res2.body.variant.id;

      // Try to update first variant with second variant's SKU
      const res = await request(app)
        .patch(`/api/v1/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'PROD-MD-001',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/v1/variants/:id', () => {
    let variantId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Size: Large',
          sku: 'PROD-LG-001',
        });

      variantId = res.body.variant.id;
    });

    it('should delete product variant (Admin only)', async () => {
      const res = await request(app)
        .delete(`/api/v1/variants/${variantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Variant deleted successfully');

      // Verify variant is deleted
      const getRes = await request(app).get(`/api/v1/products/${productId}/variants`);
      expect(getRes.body.variants).toHaveLength(0);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .delete(`/api/v1/variants/${variantId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent variant', async () => {
      const res = await request(app)
        .delete('/api/v1/variants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});

