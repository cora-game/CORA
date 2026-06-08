import { Hono } from 'hono';
import { getArenaHistory, getWalletHistory, getWalletPlayability } from '../services/goldrush';

export function createHistoryRouter() {
  const router = new Hono();

  router.get('/arena/:arenaId', async (c) => {
    const arenaId = c.req.param('arenaId');
    const history = await getArenaHistory(arenaId);
    return c.json({ items: history });
  });

  router.get('/wallet/:address', async (c) => {
    const history = await getWalletHistory();
    return c.json({ items: history });
  });

  router.get('/wallet/:address/playability', async (c) => {
    const address = c.req.param('address');
    const arena = c.req.query('arena') || 'unknown';
    const token = c.req.query('token') || 'SOL';

    const playability = await getWalletPlayability(address, arena, token);
    return c.json(playability);
  });

  return router;
}
