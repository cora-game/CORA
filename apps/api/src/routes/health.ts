import { Hono } from 'hono';

export function createHealthRouter() {
  const router = new Hono();

  router.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}
