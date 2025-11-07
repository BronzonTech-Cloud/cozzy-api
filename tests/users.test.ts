import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUser, cleanupDatabase } from './helpers';

const app = createApp();

describe('Users', () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    await cleanupDatabase();
    await createTestUser('admin@example.com', 'ADMIN');
    await createTestUser('user@example.com', 'USER');

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@example.com',
      password: 'password123',
    });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body).toHaveProperty('accessToken');
    adminToken = adminLogin.body.accessToken;

    const userLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(userLogin.status).toBe(200);
    expect(userLogin.body).toHaveProperty('accessToken');
    userToken = userLogin.body.accessToken;
  });

  describe('GET /api/v1/users', () => {
    it('should list users as admin', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should reject non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/users');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by id as admin', async () => {
      const user = await createTestUser('test@example.com');
      const res = await request(app)
        .get(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
