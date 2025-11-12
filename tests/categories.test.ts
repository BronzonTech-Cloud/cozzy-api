import request from 'supertest';

import { createApp } from '../src/app';
import {
  createTestUser,
  createTestUserAndLogin,
  createTestCategory,
  cleanupDatabase,
} from './helpers';

const app = createApp();

describe('Categories', () => {
  let adminToken: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create admin user and get token using helper
    const adminResult = await createTestUserAndLogin(app, 'admin@example.com', 'ADMIN');
    adminToken = adminResult.token;
  });

  describe('GET /api/v1/categories', () => {
    it('should list all categories', async () => {
      const cat1 = await createTestCategory('Electronics');
      const cat2 = await createTestCategory('Clothing');

      // Wait for categories to be visible
      await new Promise((resolve) => setTimeout(resolve, 300));

      const res = await request(app).get('/api/v1/categories');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('categories');
      // Categories might not be visible immediately, so check if at least one exists
      // The test should pass if categories are created, even if not immediately visible
      if (res.body.categories.length === 0) {
        console.warn('Categories not visible yet, but were created:', {
          cat1: cat1.id,
          cat2: cat2.id,
        });
      }
      expect(res.body.categories.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/categories/:slug', () => {
    it('should get category by slug', async () => {
      await createTestCategory('Electronics', 'electronics');

      const res = await request(app).get('/api/v1/categories/electronics');

      expect(res.status).toBe(200);
      expect(res.body.category.slug).toBe('electronics');
    });

    it('should return 404 for non-existent category', async () => {
      const res = await request(app).get('/api/v1/categories/non-existent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/categories', () => {
    it('should create category as admin', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Category' });

      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe('New Category');
    });

    it('should reject duplicate category name', async () => {
      await createTestCategory('Electronics');

      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Electronics' });

      expect(res.status).toBe(409);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/categories').send({ name: 'New Category' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update category as admin', async () => {
      const category = await createTestCategory('Old Name');

      const res = await request(app)
        .patch(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe('New Name');
    });

    it('should return 404 for non-existent category', async () => {
      const res = await request(app)
        .patch('/api/v1/categories/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete category as admin', async () => {
      const category = await createTestCategory('To Delete');

      const res = await request(app)
        .delete(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent category', async () => {
      const res = await request(app)
        .delete('/api/v1/categories/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
