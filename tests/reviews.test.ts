import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUser, createTestCategory, createTestProduct, cleanupDatabase } from './helpers';
import { prisma } from '../src/config/prisma';

const app = createApp();

describe('Reviews', () => {
  let userToken: string;
  let user2Token: string;
  let categoryId: string;
  let productId: string;
  let product2Id: string;
  let reviewId: string;

  beforeEach(async () => {
    await cleanupDatabase();
    await createTestUser('user@example.com', 'USER');
    await createTestUser('user2@example.com', 'USER');

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    userToken = loginRes.body.accessToken;

    const loginRes2 = await request(app).post('/api/v1/auth/login').send({
      email: 'user2@example.com',
      password: 'password123',
    });
    expect(loginRes2.status).toBe(200);
    expect(loginRes2.body).toHaveProperty('accessToken');
    user2Token = loginRes2.body.accessToken;

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

  describe('POST /api/v1/products/:productId/reviews', () => {
    it('should create review', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          title: 'Great product!',
          comment: 'This is an excellent product. Highly recommended!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('review');
      expect(res.body.review.rating).toBe(5);
      expect(res.body.review.title).toBe('Great product!');
      expect(res.body.review.comment).toBe('This is an excellent product. Highly recommended!');
      expect(res.body.review.verified).toBe(false); // User hasn't purchased
      expect(res.body.review.userId).toBeDefined();
      expect(res.body.review.productId).toBe(productId);
    });

    it('should create review with only rating', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.review.rating).toBe(4);
      expect(res.body.review.title).toBeNull();
      expect(res.body.review.comment).toBeNull();
    });

    it('should mark review as verified if user purchased product', async () => {
      // Create an order for the user with this product
      const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
      const order = await prisma.order.create({
        data: {
          userId: user!.id,
          status: 'PAID',
          totalCents: 1000,
          currency: 'USD',
          itemsCount: 1,
          paymentProvider: 'STRIPE',
          paymentIntentId: 'pi_test',
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          quantity: 1,
          unitPriceCents: 1000,
          subtotalCents: 1000,
        },
      });

      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.review.verified).toBe(true);
    });

    it('should reject duplicate review', async () => {
      // Create first review
      await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5 });

      // Try to create another review for same product
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 4 });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('You have already reviewed this product');
    });

    it('should reject review for non-existent product', async () => {
      const res = await request(app)
        .post('/api/v1/products/00000000-0000-0000-0000-000000000000/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should validate rating (1-5)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 6 });

      expect(res.status).toBe(400);
    });

    it('should validate rating minimum', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 0 });

      expect(res.status).toBe(400);
    });

    it('should validate title length', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          title: 'a'.repeat(201), // Exceeds 200 character limit
        });

      expect(res.status).toBe(400);
    });

    it('should validate comment length', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          comment: 'a'.repeat(2001), // Exceeds 2000 character limit
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${productId}/reviews`)
        .send({ rating: 5 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/products/:productId/reviews', () => {
    beforeEach(async () => {
      // Create third user for third review
      await createTestUser('user3@example.com', 'USER');

      // Create multiple reviews sequentially to ensure different timestamps
      const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
      const user2 = await prisma.user.findUnique({ where: { email: 'user2@example.com' } });
      const user3 = await prisma.user.findUnique({ where: { email: 'user3@example.com' } });

      // Create reviews sequentially with small delays to ensure different timestamps
      await prisma.review.create({
        data: {
          productId,
          userId: user!.id,
          rating: 5,
          title: 'Great!',
          comment: 'Excellent product',
        },
      });

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await prisma.review.create({
        data: {
          productId,
          userId: user2!.id,
          rating: 4,
          title: 'Good',
          comment: 'Good product',
        },
      });

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await prisma.review.create({
        data: {
          productId,
          userId: user3!.id,
          rating: 3,
          title: 'Average',
          comment: 'Average product',
        },
      });
    });

    it('should get product reviews', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reviews');
      expect(res.body.reviews).toHaveLength(3);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('averageRating');
      expect(res.body).toHaveProperty('totalReviews', 3);
    });

    it('should calculate average rating correctly', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews`);

      expect(res.status).toBe(200);
      // Average of 5, 4, 3 = 4.0
      expect(res.body.averageRating).toBe(4.0);
    });

    it('should paginate reviews', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews?page=1&limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('should sort reviews by newest (default)', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews`);

      expect(res.status).toBe(200);
      // Newest first, so last created should be first
      expect(res.body.reviews[0].rating).toBe(3); // Last created
    });

    it('should sort reviews by oldest', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews?sort=oldest`);

      expect(res.status).toBe(200);
      expect(res.body.reviews[0].rating).toBe(5); // First created
    });

    it('should sort reviews by rating high to low', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews?sort=rating_high`);

      expect(res.status).toBe(200);
      expect(res.body.reviews[0].rating).toBe(5);
      expect(res.body.reviews[1].rating).toBe(4);
      expect(res.body.reviews[2].rating).toBe(3);
    });

    it('should sort reviews by rating low to high', async () => {
      const res = await request(app).get(`/api/v1/products/${productId}/reviews?sort=rating_low`);

      expect(res.status).toBe(200);
      expect(res.body.reviews[0].rating).toBe(3);
      expect(res.body.reviews[1].rating).toBe(4);
      expect(res.body.reviews[2].rating).toBe(5);
    });

    it('should return empty list for product with no reviews', async () => {
      const res = await request(app).get(`/api/v1/products/${product2Id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(0);
      expect(res.body.totalReviews).toBe(0);
      expect(res.body.averageRating).toBe(0);
    });

    it('should reject non-existent product', async () => {
      const res = await request(app).get(
        '/api/v1/products/00000000-0000-0000-0000-000000000000/reviews',
      );

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });
  });

  describe('GET /api/v1/reviews/:reviewId', () => {
    beforeEach(async () => {
      const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
      const review = await prisma.review.create({
        data: {
          productId,
          userId: user!.id,
          rating: 5,
          title: 'Great product!',
          comment: 'Excellent',
        },
      });
      reviewId = review.id;
    });

    it('should get single review', async () => {
      const res = await request(app).get(`/api/v1/reviews/${reviewId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('review');
      expect(res.body.review.id).toBe(reviewId);
      expect(res.body.review.rating).toBe(5);
      expect(res.body.review).toHaveProperty('user');
      expect(res.body.review).toHaveProperty('product');
    });

    it('should reject non-existent review', async () => {
      const res = await request(app).get('/api/v1/reviews/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Review not found');
    });
  });

  describe('PATCH /api/v1/reviews/:reviewId', () => {
    beforeEach(async () => {
      const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
      const review = await prisma.review.create({
        data: {
          productId,
          userId: user!.id,
          rating: 5,
          title: 'Great product!',
          comment: 'Excellent',
        },
      });
      reviewId = review.id;
    });

    it('should update own review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 4,
          title: 'Updated title',
          comment: 'Updated comment',
        });

      expect(res.status).toBe(200);
      expect(res.body.review.rating).toBe(4);
      expect(res.body.review.title).toBe('Updated title');
      expect(res.body.review.comment).toBe('Updated comment');
    });

    it('should update only rating', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(200);
      expect(res.body.review.rating).toBe(3);
      expect(res.body.review.title).toBe('Great product!'); // Unchanged
    });

    it('should reject updating other user review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ rating: 1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You can only update your own reviews');
    });

    it('should reject updating non-existent review', async () => {
      const res = await request(app)
        .patch('/api/v1/reviews/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 4 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Review not found');
    });

    it('should validate input', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 6 });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).patch(`/api/v1/reviews/${reviewId}`).send({ rating: 4 });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/reviews/:reviewId', () => {
    beforeEach(async () => {
      const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
      const review = await prisma.review.create({
        data: {
          productId,
          userId: user!.id,
          rating: 5,
        },
      });
      reviewId = review.id;
    });

    it('should delete own review', async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(204);

      // Verify review is deleted
      const getRes = await request(app).get(`/api/v1/reviews/${reviewId}`);
      expect(getRes.status).toBe(404);
    });

    it('should reject deleting other user review', async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You can only delete your own reviews');
    });

    it('should reject deleting non-existent review', async () => {
      const res = await request(app)
        .delete('/api/v1/reviews/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Review not found');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).delete(`/api/v1/reviews/${reviewId}`);

      expect(res.status).toBe(401);
    });
  });
});
