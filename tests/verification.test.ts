import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { createTestUserAndLogin, cleanupDatabase } from './helpers';

const app = createApp();

describe('Email Verification', () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create user and get token using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;
    userId = userResult.user.id;
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should request verification email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(
        'message',
        'Verification email sent. Please check your inbox.',
      );

      // Check that verification token was saved
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.verificationToken).toBeDefined();
      expect(user?.verificationTokenExpires).toBeDefined();
      expect(user?.emailVerified).toBe(false);
    });

    it('should return 400 if email is already verified', async () => {
      // Verify email first
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Email is already verified');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).post('/api/v1/auth/verify-email');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/verify-email/:token', () => {
    it('should verify email with valid token', async () => {
      // Request verification email first
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${userToken}`);

      // Get the token from database
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const token = user?.verificationToken;
      expect(token).toBeDefined();

      // Verify email
      const res = await request(app).get(`/api/v1/auth/verify-email/${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Email verified successfully');

      // Check that email is verified and token is cleared
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.verificationToken).toBeNull();
      expect(updatedUser?.verificationTokenExpires).toBeNull();
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/verify-email/invalid-token');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired verification token');
    });

    it('should return 400 for expired token', async () => {
      // Ensure user is visible before updating
      let user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
        try {
          await prisma.$executeRaw`SELECT 1`;
          user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) break;
        } catch {
          // Continue to next attempt
        }
      }

      if (!user) {
        throw new Error(`User with ID ${userId} not found. Cannot update verification token.`);
      }

      // Create expired token
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago

      // Update with retry logic
      let updated = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
        try {
          await prisma.$executeRaw`SELECT 1`;
          await prisma.user.update({
            where: { id: userId },
            data: {
              verificationToken: 'expired-token',
              verificationTokenExpires: expiredDate,
            },
          });
          updated = true;
          break;
        } catch (error) {
          if (attempt < 7) {
            // Continue to next attempt
          } else {
            throw error;
          }
        }
      }

      if (!updated) {
        throw new Error('Failed to update user verification token after retries');
      }

      const res = await request(app).get('/api/v1/auth/verify-email/expired-token');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired verification token');
    });

    it('should not verify email twice with same token', async () => {
      // Request verification email first
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${userToken}`);

      // Get the token from database
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const token = user?.verificationToken;

      // Verify email first time
      const res1 = await request(app).get(`/api/v1/auth/verify-email/${token}`);
      expect(res1.status).toBe(200);

      // Try to verify again with same token
      const res2 = await request(app).get(`/api/v1/auth/verify-email/${token}`);
      expect(res2.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('should resend verification email', async () => {
      // Request verification email first
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${userToken}`);

      const user1 = await prisma.user.findUnique({ where: { id: userId } });
      const firstToken = user1?.verificationToken;

      // Resend verification email
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(
        'message',
        'Verification email resent. Please check your inbox.',
      );

      // Check that new token was generated
      const user2 = await prisma.user.findUnique({ where: { id: userId } });
      expect(user2?.verificationToken).toBeDefined();
      expect(user2?.verificationToken).not.toBe(firstToken);
    });

    it('should return 400 if email is already verified', async () => {
      // First, ensure user is visible before trying to update
      let user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
        try {
          await prisma.$executeRaw`SELECT 1`;
          user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) break;
        } catch {
          // Continue to next attempt
        }
      }

      if (!user) {
        throw new Error(`User with ID ${userId} not found. Cannot verify email.`);
      }

      // Verify email first - add retry logic for visibility
      let updated = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
        try {
          await prisma.$executeRaw`SELECT 1`;
          await prisma.user.update({
            where: { id: userId },
            data: { emailVerified: true },
          });
          updated = true;
          break;
        } catch (error) {
          if (attempt < 7) {
            // Continue to next attempt
          } else {
            throw error;
          }
        }
      }

      if (!updated) {
        throw new Error('Failed to update user emailVerified status');
      }

      // Wait for update to be visible
      await new Promise((resolve) => setTimeout(resolve, 200));

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Email is already verified');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).post('/api/v1/auth/resend-verification');
      expect(res.status).toBe(401);
    });
  });
});
