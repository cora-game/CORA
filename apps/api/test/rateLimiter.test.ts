import { test, expect, describe } from 'bun:test';
import { Hono } from 'hono';
import { rateLimiter } from '../src/middleware/rateLimiter';

function createTestApp() {
  const app = new Hono();
  app.use('/*', rateLimiter);
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimiter', () => {
  test('allows requests under the limit', async () => {
    const app = createTestApp();
    const ip = `allow-${Date.now()}`;
    const res = await app.request('/test', { headers: { 'x-forwarded-for': ip } });
    expect(res.status).toBe(200);
  });

  test('blocks at 61st request with 429', async () => {
    const app = createTestApp();
    const ip = `block-${Date.now()}`;
    for (let i = 0; i < 60; i++) {
      await app.request('/test', { headers: { 'x-forwarded-for': ip } });
    }
    const res = await app.request('/test', { headers: { 'x-forwarded-for': ip } });
    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfterMs).toBeGreaterThan(0);
  });

  test('different IPs have independent limits', async () => {
    const app = createTestApp();
    const ip1 = `ind1-${Date.now()}`;
    const ip2 = `ind2-${Date.now()}`;
    for (let i = 0; i < 61; i++) {
      await app.request('/test', { headers: { 'x-forwarded-for': ip1 } });
    }
    const res = await app.request('/test', { headers: { 'x-forwarded-for': ip2 } });
    expect(res.status).toBe(200);
  });

  test('works without x-forwarded-for header', async () => {
    const app = createTestApp();
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
