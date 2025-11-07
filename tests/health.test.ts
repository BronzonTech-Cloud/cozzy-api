import request from 'supertest';

import { createApp } from '../src/app';

const app = createApp();

describe('Health', () => {
  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
