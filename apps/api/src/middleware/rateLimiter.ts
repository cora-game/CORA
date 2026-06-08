import type { MiddlewareHandler } from 'hono';

// In-memory store for rate limiting: Map<IP, { count, resetTime }>
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per IP

export const rateLimiter: MiddlewareHandler = async (c, next) => {
  // Try to get IP from x-forwarded-for header, fallback to 'unknown'
  const ip = c.req.header('x-forwarded-for') || 'unknown-ip';
  const now = Date.now();

  let record = rateLimitMap.get(ip);

  // If new record or time window expired, reset
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + WINDOW_MS };
  }

  // Increment count
  record.count++;
  rateLimitMap.set(ip, record);

  // Trigger occasional cleanup (1% chance per request) to prevent memory leak
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  // Check if over limit
  if (record.count > MAX_REQUESTS) {
    return c.json(
      { error: 'Too Many Requests', retryAfterMs: record.resetTime - now },
      429
    );
  }

  await next();
};
