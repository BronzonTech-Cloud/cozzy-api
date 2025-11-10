import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUser, createTestCategory, createTestProduct, cleanupDatabase } from './helpers';

const app = createApp();

describe('Search', () => {
  let categoryId: string;
  let product1Id: string;
  let product2Id: string;

  beforeEach(async () => {
    await cleanupDatabase();
    await createTestUser('user@example.com', 'USER');

    const category = await createTestCategory('Electronics');
    categoryId = category.id;

    const product1 = await createTestProduct(categoryId, {
      title: 'Laptop Computer',
      priceCents: 100000,
      stock: 5,
    });
    product1Id = product1.id;

    const product2 = await createTestProduct(categoryId, {
      title: 'Smartphone Device',
      priceCents: 50000,
      stock: 10,
    });
    product2Id = product2.id;
  });

  describe('GET /api/v1/products/search', () => {
    it('should search products by query', async () => {
      const res = await request(app).get('/api/v1/products/search').query({ q: 'Laptop' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products).toBeInstanceOf(Array);
      expect(res.body.products.length).toBeGreaterThan(0);
      expect(res.body.products[0].title).toContain('Laptop');
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ categoryId });

      expect(res.status).toBe(200);
      expect(res.body.products.every((p: { categoryId: string }) => p.categoryId === categoryId)).toBe(
        true,
      );
    });

    it('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ minPrice: 60000, maxPrice: 150000 });

      expect(res.status).toBe(200);
      expect(
        res.body.products.every(
          (p: { priceCents: number }) => p.priceCents >= 60000 && p.priceCents <= 150000,
        ),
      ).toBe(true);
    });

    it('should filter by stock availability', async () => {
      const res = await request(app).get('/api/v1/products/search').query({ inStock: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.products.every((p: { stock: number }) => p.stock > 0)).toBe(true);
    });

    it('should sort by price ascending', async () => {
      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ sortBy: 'priceCents', sortOrder: 'asc' });

      expect(res.status).toBe(200);
      const prices = res.body.products.map((p: { priceCents: number }) => p.priceCents);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ page: 1, limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 1);
      expect(res.body.pagination).toHaveProperty('totalPages');
      expect(res.body.pagination).toHaveProperty('hasMore');
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const res = await request(app).get('/api/v1/search/suggestions').query({ q: 'Lap' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestions');
      expect(res.body.suggestions).toBeInstanceOf(Array);
      expect(res.body.suggestions.length).toBeGreaterThan(0);
      expect(res.body.suggestions[0]).toHaveProperty('id');
      expect(res.body.suggestions[0]).toHaveProperty('title');
      expect(res.body.suggestions[0]).toHaveProperty('slug');
    });

    it('should return empty array for query less than 2 characters', async () => {
      const res = await request(app).get('/api/v1/search/suggestions').query({ q: 'L' });

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toEqual([]);
    });

    it('should return empty array for no query', async () => {
      const res = await request(app).get('/api/v1/search/suggestions');

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toEqual([]);
    });

    it('should limit suggestions to 10', async () => {
      // Create more products
      for (let i = 0; i < 15; i++) {
        await createTestProduct(categoryId, {
          title: `Product ${i}`,
          priceCents: 1000,
        });
      }

      const res = await request(app).get('/api/v1/search/suggestions').query({ q: 'Product' });

      expect(res.status).toBe(200);
      expect(res.body.suggestions.length).toBeLessThanOrEqual(10);
    });
  });
});

