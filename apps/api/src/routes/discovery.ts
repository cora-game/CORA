import { Hono } from 'hono';

export function createDiscoveryRouter() {
  const router = new Hono();

  // Required by X/Twitter and wallets to discover Solana Actions on this domain.
  router.get('/actions.json', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Encoding, Accept-Encoding');

    return c.json({
      rules: [
        {
          pathPattern: '/api/actions/*',
          apiPath: '/api/actions/*',
        },
      ],
    });
  });

  return router;
}
