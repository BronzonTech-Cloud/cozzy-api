import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { cleanupDatabase, createTestUserAndLogin } from './helpers';

const app = createApp();

describe('Coupons', () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create users and get tokens, ensuring login succeeds
    const adminResult = await createTestUserAndLogin(app, 'admin@example.com', 'ADMIN');
    adminToken = adminResult.token;

    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;

    // Small delay to ensure users are fully visible before test operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify tokens are set
    if (!adminToken || !userToken) {
      throw new Error('Failed to obtain authentication tokens in test setup');
    }
  });

  describe('POST /api/v1/coupons', () => {
    it('should create coupon (Admin only)', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SAVE10',
          description: '10% off',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minPurchase: 5000,
          maxDiscount: 1000,
          usageLimit: 100,
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
          active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('coupon');
      expect(res.body.coupon).toHaveProperty('code', 'SAVE10');
      expect(res.body.coupon).toHaveProperty('discountType', 'PERCENTAGE');
      expect(res.body.coupon).toHaveProperty('discountValue', 10);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('should return 409 for duplicate code', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      // Create first coupon
      await request(app).post('/api/v1/coupons').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SAVE10',
          discountType: 'FIXED_AMOUNT',
          discountValue: 500,
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Coupon code already exists');
    });

    it('should return 400 if validUntil is before validFrom', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() - 1);

      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'validUntil must be after validFrom');
    });
  });

  describe('GET /api/v1/coupons', () => {
    it('should list coupons (Admin only)', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      // Create a coupon
      await request(app).post('/api/v1/coupons').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      });

      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('coupons');
      expect(res.body.coupons).toBeInstanceOf(Array);
      expect(res.body.coupons.length).toBeGreaterThan(0);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/coupons/validate', () => {
    let couponId: string;
    let couponCode: string;

    beforeEach(async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const coupon = await prisma.coupon.create({
        data: {
          code: 'SAVE10',
          description: '10% off',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minPurchase: 5000,
          maxDiscount: 1000,
          usageLimit: 100,
          validFrom,
          validUntil,
          active: true,
        },
      });

      couponId = coupon.id;
      couponCode = coupon.code;
    });

    it('should validate valid coupon', async () => {
      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 10000,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid', true);
      expect(res.body).toHaveProperty('discountCents');
      expect(res.body).toHaveProperty('finalTotalCents');
      expect(res.body.discountCents).toBe(1000); // 10% of 10000, capped at maxDiscount
    });

    it('should calculate percentage discount correctly', async () => {
      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 5000,
      });

      expect(res.status).toBe(200);
      expect(res.body.discountCents).toBe(500); // 10% of 5000
    });

    it('should calculate fixed amount discount correctly', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const fixedCoupon = await prisma.coupon.create({
        data: {
          code: 'FIXED500',
          discountType: 'FIXED_AMOUNT',
          discountValue: 500,
          validFrom,
          validUntil,
          active: true,
        },
      });

      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: fixedCoupon.code,
        totalCents: 10000,
      });

      expect(res.status).toBe(200);
      expect(res.body.discountCents).toBe(500);
    });

    it('should return 404 for non-existent coupon', async () => {
      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: 'INVALID',
        totalCents: 10000,
      });

      expect(res.status).toBe(404);
    });

    it('should return 400 for inactive coupon', async () => {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { active: false },
      });

      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 10000,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Coupon is not active');
    });

    it('should return 400 for expired coupon', async () => {
      await prisma.coupon.update({
        where: { id: couponId },
        data: {
          validUntil: new Date(Date.now() - 86400000), // Yesterday
        },
      });

      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 10000,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Coupon has expired');
    });

    it('should return 400 if minimum purchase not met', async () => {
      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 3000, // Less than minPurchase of 5000
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 400 if usage limit reached', async () => {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usageCount: 100 }, // At limit
      });

      const res = await request(app).post('/api/v1/coupons/validate').send({
        code: couponCode,
        totalCents: 10000,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Coupon usage limit reached');
    });
  });

  describe('PATCH /api/v1/coupons/:id', () => {
    let couponId: string;

    beforeEach(async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const coupon = await prisma.coupon.create({
        data: {
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom,
          validUntil,
          active: true,
        },
      });

      couponId = coupon.id;
    });

    it('should update coupon (Admin only)', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated description',
          discountValue: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.coupon).toHaveProperty('description', 'Updated description');
      expect(res.body.coupon).toHaveProperty('discountValue', 15);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          description: 'Updated',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent coupon', async () => {
      const res = await request(app)
        .patch('/api/v1/coupons/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated',
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 for negative minPurchase', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minPurchase: -100,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('minPurchase must be a non-negative integer');
    });

    it('should return 400 for negative maxDiscount', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxDiscount: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('maxDiscount must be a non-negative integer');
    });

    it('should return 400 for negative usageLimit', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          usageLimit: -10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('usageLimit must be a non-negative integer');
    });

    it('should return 400 for invalid date format', async () => {
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          validFrom: 'invalid-date',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid date format');
    });

    it('should return 400 when validUntil is before validFrom', async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() - 1); // Yesterday

      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('validUntil must be after validFrom');
    });

    it('should return 409 for duplicate coupon code', async () => {
      // Create another coupon
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const otherCoupon = await prisma.coupon.create({
        data: {
          code: 'OTHER10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom,
          validUntil,
          active: true,
        },
      });

      // Try to update first coupon with second coupon's code
      const res = await request(app)
        .patch(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: otherCoupon.code,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Coupon code already exists');
    });
  });

  describe('DELETE /api/v1/coupons/:id', () => {
    let couponId: string;

    beforeEach(async () => {
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      const coupon = await prisma.coupon.create({
        data: {
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          validFrom,
          validUntil,
          active: true,
        },
      });

      couponId = coupon.id;
    });

    it('should delete coupon (Admin only)', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Coupon deleted successfully');

      // Verify coupon is deleted
      const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
      expect(coupon).toBeNull();
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${couponId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent coupon', async () => {
      const res = await request(app)
        .delete('/api/v1/coupons/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
