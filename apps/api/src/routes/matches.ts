import { isAddress } from 'viem';
import { Hono } from 'hono';
import type { RoomManager } from '../managers/RoomManager';
import { getClient, isSupabaseConfigured } from '../services/supabase';

export function createMatchesRouter(_roomManager: RoomManager) {
  const router = new Hono();

  router.get('/history/:wallet', async (c) => {
    const wallet = c.req.param('wallet');
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? '50') || 50, 1), 100);

    if (!isAddress(wallet)) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    if (!isSupabaseConfigured) {
      return c.json({ matches: [], total: 0 });
    }

    const supabase = await getClient();
    const { data, error } = await supabase
      .from('match_records')
      .select('*')
      .or(`player_a.eq.${wallet},player_b.eq.${wallet}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MatchHistory] Failed to list wallet history:', error);
      return c.json({ error: 'Failed to load match history' }, 500);
    }

    return c.json({
      matches: data ?? [],
      total: data?.length ?? 0,
    });
  });

  router.get('/record/:source/:id', async (c) => {
    const source = c.req.param('source');
    const id = c.req.param('id');

    if (source !== 'blink' && source !== 'queue') {
      return c.json({ error: 'source must be blink or queue' }, 400);
    }

    if (!isSupabaseConfigured) {
      return c.json({ error: 'Match record not found' }, 404);
    }

    const supabase = await getClient();
    const { data, error } = await supabase
      .from('match_records')
      .select('*')
      .eq('match_source', source)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[MatchHistory] Failed to get match record:', error);
      return c.json({ error: 'Failed to load match record' }, 500);
    }

    if (!data) {
      return c.json({ error: 'Match record not found' }, 404);
    }

    return c.json(data);
  });

  return router;
}
