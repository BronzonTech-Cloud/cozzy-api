import request from 'supertest';
import { vi } from 'vitest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { createTestUser, cleanupDatabase } from './helpers';

const app = createApp();

// Mock sendEmail for testing email failure scenarios
const mockSendEmail = vi.fn();
vi.mock('../src/utils/email', async () => {
  const actual = await vi.importActual('../src/utils/email');
  return {
    ...actual,
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  };
});

describe('Password Reset', () => {
  let userEmail: string;
  let userId: string;

  beforeEach(async () => {
    await cleanupDatabase();
    const user = await createTestUser('user@example.com', 'USER');
    userEmail = user.email;
    userId = user.id;
    // Reset mock to default behavior (resolve successfully)
    mockSendEmail.mockResolvedValue(undefined);
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should send password reset email for existing user', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(
        'message',
        'If an account with that email exists, a password reset link has been sent.',
      );

      // Check that reset token was saved
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.resetPasswordToken).toBeDefined();
      expect(user?.resetPasswordExpires).toBeDefined();
      expect(user?.resetPasswordExpires!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return same message for non-existent email (security)', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'nonexistent@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(
        'message',
        'If an account with that email exists, a password reset link has been sent.',
      );
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'invalid-email',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({});

      expect(res.status).toBe(400);
    });

    it('should generate new token on each request', async () => {
      // First request
      await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      const user1 = await prisma.user.findUnique({ where: { id: userId } });
      const firstToken = user1?.resetPasswordToken;

      // Second request
      await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      const user2 = await prisma.user.findUnique({ where: { id: userId } });
      const secondToken = user2?.resetPasswordToken;

      expect(secondToken).toBeDefined();
      expect(secondToken).not.toBe(firstToken);
    });

    it('should return 400 for email longer than 254 characters', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // 263 characters
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: longEmail,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid email format');
    });

    it('should clear token if email sending fails', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      expect(res.status).toBe(500);

      // Token should be cleared after email failure
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.resetPasswordToken).toBeNull();
      expect(user?.resetPasswordExpires).toBeNull();
    });
  });

  describe('POST /api/v1/auth/reset-password/:token', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Request password reset
      await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      // Wait for token to be visible (handle potential visibility delays in CI)
      let user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }

        user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.resetPasswordToken) {
          break;
        }
      }

      if (!user?.resetPasswordToken) {
        throw new Error('Reset token not found after retries');
      }
      resetToken = user.resetPasswordToken;
    });

    it('should reset password with valid token', async () => {
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'NewPassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset successfully');

      // Check that token is cleared
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.resetPasswordToken).toBeNull();
      expect(user?.resetPasswordExpires).toBeNull();

      // Verify new password works
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: userEmail,
        password: 'NewPassword123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password/invalid-token').send({
        password: 'NewPassword123',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired reset token');
    });

    it('should return 400 for expired token', async () => {
      // Create expired token
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 2); // 2 hours ago

      await prisma.user.update({
        where: { id: userId },
        data: {
          resetPasswordToken: 'expired-token',
          resetPasswordExpires: expiredDate,
        },
      });

      const res = await request(app).post('/api/v1/auth/reset-password/expired-token').send({
        password: 'NewPassword123',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid or expired reset token');
    });

    it('should return 400 for password too short', async () => {
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'short',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({});

      expect(res.status).toBe(400);
    });

    it('should not allow using same token twice', async () => {
      // First reset
      const res1 = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'NewPassword123',
      });

      expect(res1.status).toBe(200);

      // Try to use same token again
      const res2 = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'AnotherPassword123',
      });

      expect(res2.status).toBe(400);
      expect(res2.body).toHaveProperty('message', 'Invalid or expired reset token');
    });

    it('should hash password correctly', async () => {
      await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'NewPassword123',
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('NewPassword123'); // Should be hashed
    });

    it('should return 400 for password with insufficient complexity', async () => {
      // Password with only 2 complexity requirements (lowercase + numbers)
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 3 of the following');
    });

    it('should accept password with 3 complexity requirements', async () => {
      // Password with uppercase, lowercase, and numbers (3 requirements)
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'Password123',
      });

      expect(res.status).toBe(200);
    });

    it('should accept password with all 4 complexity requirements', async () => {
      // Password with uppercase, lowercase, numbers, and special chars
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
    });
  });
});
