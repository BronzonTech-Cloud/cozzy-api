import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUser, cleanupDatabase } from './helpers';

const app = createApp();

describe('Profile', () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    await cleanupDatabase();
    const user = await createTestUser('user@example.com', 'USER');
    userId = user.id;

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(loginRes.status).toBe(200);
    userToken = loginRes.body.accessToken;
  });

  describe('GET /api/v1/profile', () => {
    it('should get user profile', async () => {
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id', userId);
      expect(res.body.user).toHaveProperty('email', 'user@example.com');
      expect(res.body.user).toHaveProperty('name', 'Test User');
      expect(res.body.user).toHaveProperty('role', 'USER');
      expect(res.body.user).toHaveProperty('emailVerified', false);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/profile', () => {
    it('should update user name', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('name', 'Updated Name');
      expect(res.body.user).toHaveProperty('email', 'user@example.com');
    });

    it('should update user email and reset verification', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'newemail@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', 'newemail@example.com');
      expect(res.body.user).toHaveProperty('emailVerified', false);
    });

    it('should update both name and email', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Name', email: 'newemail@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('name', 'New Name');
      expect(res.body.user).toHaveProperty('email', 'newemail@example.com');
      expect(res.body.user).toHaveProperty('emailVerified', false);
    });

    it('should return 409 if email is already in use', async () => {
      await createTestUser('existing@example.com', 'USER');

      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'existing@example.com' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Email already in use');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty name', async () => {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/profile/password', () => {
    it('should change password successfully', async () => {
      const res = await request(app)
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password changed successfully');

      // Verify new password works
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'user@example.com',
        password: 'newpassword123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('should return 401 for incorrect current password', async () => {
      const res = await request(app)
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'Current password is incorrect');
    });

    it('should return 400 if passwords do not match', async () => {
      const res = await request(app)
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmPassword: 'differentpassword',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const res = await request(app)
        .patch('/api/v1/profile/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'short',
          confirmPassword: 'short',
        });

      expect(res.status).toBe(400);
    });
  });
});

