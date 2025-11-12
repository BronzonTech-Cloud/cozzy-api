import request from 'supertest';

import { createApp } from '../src/app';
import {
  createTestUserAndLogin,
  createTestCategory,
  createTestProduct,
  cleanupDatabase,
} from './helpers';

const app = createApp();

describe('Products', () => {
  let adminToken: string;
  let categoryId: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create admin user and get token using helper
    const adminResult = await createTestUserAndLogin(app, 'admin@example.com', 'ADMIN');
    adminToken = adminResult.token;

    // Small delay to ensure user is fully visible before creating category
    await new Promise((resolve) => setTimeout(resolve, 100));

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    // Small delay to ensure category is fully visible before creating products
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('GET /api/v1/products', () => {
    it('should list products', async () => {
      await createTestProduct(categoryId, { title: 'Product 1' });
      await createTestProduct(categoryId, { title: 'Product 2' });

      const res = await request(app).get('/api/v1/products');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter products by search query', async () => {
      await createTestProduct(categoryId, { title: 'Laptop' });
      await createTestProduct(categoryId, { title: 'Mouse' });

      const res = await request(app).get('/api/v1/products?q=Laptop');

      expect(res.status).toBe(200);
      expect(res.body.items.some((p: { title: string }) => p.title.includes('Laptop'))).toBe(true);
    });

    it('should paginate products', async () => {
      await createTestProduct(categoryId, { title: 'Product 1' });
      await createTestProduct(categoryId, { title: 'Product 2' });

      const res = await request(app).get('/api/v1/products?page=1&limit=1');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.page).toBe(1);
    });
  });

  describe('GET /api/v1/products/:slug', () => {
    it('should get product by slug', async () => {
      const product = await createTestProduct(categoryId, { title: 'Test Product' });

      const res = await request(app).get(`/api/v1/products/${product.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.product.title).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get('/api/v1/products/non-existent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/products', () => {
    it('should create product as admin', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'New Product',
          description: 'Product description',
          priceCents: 5000,
          categoryId,
          stock: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.product.title).toBe('New Product');
    });

    it('should validate input', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          priceCents: -100,
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/products').send({
        title: 'New Product',
        description: 'Description',
        priceCents: 1000,
        categoryId,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/products/:id', () => {
    it('should update product as admin', async () => {
      const product = await createTestProduct(categoryId, { title: 'Old Title' });

      const res = await request(app)
        .patch(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.product.title).toBe('New Title');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .patch('/api/v1/products/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('should delete product as admin', async () => {
      const product = await createTestProduct(categoryId);

      const res = await request(app)
        .delete(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .delete('/api/v1/products/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
