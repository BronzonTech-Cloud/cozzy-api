import request from 'supertest';

import { createApp } from '../src/app';

const app = createApp();

describe('Health', () => {
  it('GET /api/v1/health returns ok with database connected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
    expect(typeof res.body.uptime).toBe('number');
  });
});
