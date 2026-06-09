import { Hono } from 'hono';
import { formatEther, isAddress, type Address } from 'viem';
import { publicClient } from '../config/chain';

/**
 * Match history + wallet playability.
 *
 * History is still mocked (as before). Playability now checks the wallet's
 * native ETH balance on Base Sepolia via viem, replacing the Solana GoldRush
 * token-balance lookup.
 */

interface MatchHistoryItem {
  id: string;
  signature: string;
  timestamp: string;
  arenaId: string;
  token: string;
  wagerEth?: string;
  result?: 'win' | 'loss' | 'draw' | 'unknown';
  opponent?: string;
  settlementStatus?: 'settled' | 'pending' | 'failed' | 'unknown';
}

function generateMockHistory(arenaId: string, opponentPrefix: string): MatchHistoryItem[] {
  const now = Date.now();
  return [
    { id: `${arenaId}-recent-1`, signature: '0x5R6q…J8k2', timestamp: new Date(now - 1000 * 60 * 38).toISOString(), arenaId, token: 'ETH', wagerEth: '0.01', result: 'win', opponent: `${opponentPrefix}1`, settlementStatus: 'settled' },
    { id: `${arenaId}-recent-2`, signature: '0x7Nzf…Q2br', timestamp: new Date(now - 1000 * 60 * 95).toISOString(), arenaId, token: 'ETH', wagerEth: '0.01', result: 'loss', opponent: `${opponentPrefix}2`, settlementStatus: 'settled' },
    { id: `${arenaId}-recent-3`, signature: '0x4ddP…rK61', timestamp: new Date(now - 1000 * 60 * 180).toISOString(), arenaId, token: 'ETH', wagerEth: '0.005', result: 'unknown', opponent: `${opponentPrefix}3`, settlementStatus: 'pending' },
  ];
}

export function createHistoryRouter() {
  const router = new Hono();

  router.get('/arena/:arenaId', async (c) => {
    const arenaId = c.req.param('arenaId');
    return c.json({ items: generateMockHistory(arenaId, 'plyr-') });
  });

  router.get('/wallet/:address', async (c) => {
    return c.json({ items: generateMockHistory('arena-global', 'opp-') });
  });

  router.get('/wallet/:address/playability', async (c) => {
    const address = c.req.param('address');

    if (!isAddress(address)) {
      return c.json({ playable: false, reason: 'Invalid address', reliable: false, lastCheckedAt: new Date().toISOString() });
    }

    try {
      const balance = await publicClient.getBalance({ address: address as Address });
      const playable = balance > 0n;
      return c.json({
        playable,
        reason: playable ? undefined : 'No Base Sepolia ETH — fund your wallet from a faucet.',
        tokenBalance: balance.toString(),
        tokenBalanceEth: formatEther(balance),
        reliable: true,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Playability] getBalance error:', err instanceof Error ? err.message : err);
      return c.json({ playable: false, reason: 'Failed to fetch balance', reliable: false, lastCheckedAt: new Date().toISOString() });
    }
  });

  return router;
}
