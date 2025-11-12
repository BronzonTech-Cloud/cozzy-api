import request from 'supertest';

import { createApp } from '../src/app';
import { createTestUserAndLogin, cleanupDatabase } from './helpers';

const app = createApp();

describe('Address', () => {
  let userToken: string;

  beforeEach(async () => {
    await cleanupDatabase();

    // Create user and get token using helper
    const userResult = await createTestUserAndLogin(app, 'user@example.com', 'USER');
    userToken = userResult.token;
  });

  describe('GET /api/v1/profile/addresses', () => {
    it('should get empty addresses list', async () => {
      const res = await request(app)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('addresses');
      expect(res.body.addresses).toHaveLength(0);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/profile/addresses');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/profile/addresses', () => {
    it('should create a new address', async () => {
      const res = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Home',
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
          phone: '+1234567890',
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('address');
      expect(res.body.address).toHaveProperty('label', 'Home');
      expect(res.body.address).toHaveProperty('firstName', 'John');
      expect(res.body.address).toHaveProperty('lastName', 'Doe');
      expect(res.body.address).toHaveProperty('street', '123 Main St');
      expect(res.body.address).toHaveProperty('city', 'New York');
      expect(res.body.address).toHaveProperty('state', 'NY');
      expect(res.body.address).toHaveProperty('zipCode', '10001');
      expect(res.body.address).toHaveProperty('country', 'US');
      expect(res.body.address).toHaveProperty('phone', '+1234567890');
      expect(res.body.address).toHaveProperty('isDefault', true);
    });

    it('should create address with default country', async () => {
      const res = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Work',
          firstName: 'Jane',
          lastName: 'Smith',
          street: '456 Oak Ave',
          city: 'Los Angeles',
          zipCode: '90001',
        });

      expect(res.status).toBe(201);
      expect(res.body.address).toHaveProperty('country', 'US');
    });

    it('should unset other default addresses when setting new default', async () => {
      // Create first default address
      const res1 = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Home',
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
          isDefault: true,
        });

      expect(res1.status).toBe(201);
      const address1Id = res1.body.address.id;

      // Create second default address
      const res2 = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Work',
          firstName: 'John',
          lastName: 'Doe',
          street: '456 Oak Ave',
          city: 'Los Angeles',
          zipCode: '90001',
          isDefault: true,
        });

      expect(res2.status).toBe(201);

      // Check that first address is no longer default
      const getRes = await request(app)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`);

      const address1 = getRes.body.addresses.find((a: { id: string }) => a.id === address1Id);
      expect(address1.isDefault).toBe(false);
      expect(res2.body.address.isDefault).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Home',
          // Missing required fields
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/profile/addresses/:id', () => {
    let addressId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Home',
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
        });

      addressId = res.body.address.id;
    });

    it('should update address', async () => {
      const res = await request(app)
        .patch(`/api/v1/profile/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          street: '789 Updated St',
          city: 'Boston',
        });

      expect(res.status).toBe(200);
      expect(res.body.address).toHaveProperty('street', '789 Updated St');
      expect(res.body.address).toHaveProperty('city', 'Boston');
    });

    it('should set address as default and unset others', async () => {
      // Create another address
      const res2 = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Work',
          firstName: 'John',
          lastName: 'Doe',
          street: '456 Oak Ave',
          city: 'Los Angeles',
          zipCode: '90001',
          isDefault: true,
        });

      // Update first address to be default
      const res = await request(app)
        .patch(`/api/v1/profile/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isDefault: true });

      expect(res.status).toBe(200);
      expect(res.body.address.isDefault).toBe(true);

      // Check that second address is no longer default
      const getRes = await request(app)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`);

      const address2 = getRes.body.addresses.find(
        (a: { id: string }) => a.id === res2.body.address.id,
      );
      expect(address2.isDefault).toBe(false);
    });

    it('should return 404 for non-existent address', async () => {
      const res = await request(app)
        .patch('/api/v1/profile/addresses/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ street: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 404 for address belonging to another user', async () => {
      const otherResult = await createTestUserAndLogin(app, 'other@example.com', 'USER');
      const otherToken = otherResult.token;

      // Try to update address from different user
      const res = await request(app)
        .patch(`/api/v1/profile/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ street: 'Hacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/profile/addresses/:id', () => {
    let addressId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          label: 'Home',
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
        });

      addressId = res.body.address.id;
    });

    it('should delete address', async () => {
      const res = await request(app)
        .delete(`/api/v1/profile/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Address deleted successfully');

      // Verify address is deleted
      const getRes = await request(app)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${userToken}`);

      expect(getRes.body.addresses).toHaveLength(0);
    });

    it('should return 404 for non-existent address', async () => {
      const res = await request(app)
        .delete('/api/v1/profile/addresses/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 for address belonging to another user', async () => {
      const otherResult = await createTestUserAndLogin(app, 'other@example.com', 'USER');
      const otherToken = otherResult.token;

      const res = await request(app)
        .delete(`/api/v1/profile/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
