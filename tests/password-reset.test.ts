import request from 'supertest';

import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { createTestUser, cleanupDatabase } from './helpers';

const app = createApp();

describe('Password Reset', () => {
  let userEmail: string;
  let userId: string;

  beforeEach(async () => {
    await cleanupDatabase();
    const user = await createTestUser('user@example.com', 'USER');
    userEmail = user.email;
    userId = user.id;
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
  });

  describe('POST /api/v1/auth/reset-password/:token', () => {
    let resetToken: string;

    beforeEach(async () => {
      // Request password reset
      await request(app).post('/api/v1/auth/forgot-password').send({
        email: userEmail,
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      resetToken = user?.resetPasswordToken!;
    });

    it('should reset password with valid token', async () => {
      const res = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'newpassword123',
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
        password: 'newpassword123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password/invalid-token').send({
        password: 'newpassword123',
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
        password: 'newpassword123',
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
        password: 'newpassword123',
      });

      expect(res1.status).toBe(200);

      // Try to use same token again
      const res2 = await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'anotherpassword123',
      });

      expect(res2.status).toBe(400);
      expect(res2.body).toHaveProperty('message', 'Invalid or expired reset token');
    });

    it('should hash password correctly', async () => {
      await request(app).post(`/api/v1/auth/reset-password/${resetToken}`).send({
        password: 'newpassword123',
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('newpassword123'); // Should be hashed
    });
  });
});

