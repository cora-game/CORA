/**
 * Backend smoke test for the Blink "soft commitment" flow.
 *
 * Requires API server:
 *   cd apps/api && bun run dev
 *
 * Requires transaction-building env for the accept/deposit calls:
 *   SERVER_KEYPAIR and SOLANA_RPC_URL
 */

import { WebSocket } from 'ws';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8080';
const WS_BASE = process.env.WS_BASE || 'ws://127.0.0.1:8080';

const CREATOR = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const CHALLENGER = 'E8ohBSUASXhBcMkjJ2bQ35hxuWfHKjWZiXhzp2XP81p2';
const USDC_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

async function post(path: string, body: object) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload as Record<string, unknown>;
}

async function get(path: string) {
  const response = await fetch(`${BASE}${path}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload as Record<string, unknown>;
}

function openWs(roomId: string, address: string) {
  const messages: Array<Record<string, unknown>> = [];
  const ws = new WebSocket(`${WS_BASE}/match/${roomId}?address=${address}`);
  ws.on('message', (raw) => {
    try {
      messages.push(JSON.parse(raw.toString()) as Record<string, unknown>);
    } catch {
      return;
    }
  });
  return { ws, messages };
}

function waitFor(
  messages: Array<Record<string, unknown>>,
  predicate: (message: Record<string, unknown>) => boolean,
  label: string,
  timeoutMs = 8000,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const found = messages.find(predicate);
      if (found) {
        clearInterval(timer);
        resolve(found);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}. Seen: ${messages.map((m) => String(m.type)).join(', ')}`));
      }
    }, 100);
  });
}

async function run() {
  console.log(`[BlinkSoft] Server: ${BASE}`);
  await get('/health');

  const created = await post('/match/private', {
    address: CREATOR,
    tokenMint: USDC_MINT,
    wagerAmount: 1_000_000,
  });
  const roomId = readString(created, 'roomId');
  const blinkUrl = readString(created, 'blinkUrl');
  if (!roomId || !blinkUrl) throw new Error(`Create response missing roomId/blinkUrl: ${JSON.stringify(created)}`);
  console.log(`[BlinkSoft] Created private challenge ${roomId}`);
  console.log(`[BlinkSoft] Blink URL: ${blinkUrl}`);

  const metadata = await get(`/api/actions/challenge?roomId=${roomId}`);
  if (metadata.type !== 'action') throw new Error('Blink metadata did not return an action payload');
  console.log('[BlinkSoft] GET metadata ok');

  const challengerTx = await post(`/api/actions/challenge?roomId=${roomId}`, {
    account: CHALLENGER,
  });
  const challengerTransaction = readString(challengerTx, 'transaction');
  if (!challengerTransaction) throw new Error('Missing challenger transaction');
  console.log(`[BlinkSoft] Challenger transaction built (${Buffer.from(challengerTransaction, 'base64').length} bytes)`);

  const challenged = await get(`/match/private/${roomId}`);
  if (challenged.status !== 'CHALLENGED') {
    throw new Error(`Expected CHALLENGED after accept, got ${challenged.status}`);
  }
  console.log('[BlinkSoft] DB status is CHALLENGED');

  const creator = openWs(roomId, CREATOR);
  const challenger = openWs(roomId, CHALLENGER);
  await new Promise((resolve) => setTimeout(resolve, 500));

  await waitFor(creator.messages, isGameStateStatus('depositing'), 'creator depositing state');
  await waitFor(challenger.messages, isGameStateStatus('depositing'), 'challenger depositing state');
  console.log('[BlinkSoft] WebSocket hydration ok');

  const creatorTx = await post(`/api/actions/challenge?roomId=${roomId}`, {
    account: CREATOR,
  });
  const creatorTransaction = readString(creatorTx, 'transaction');
  if (!creatorTransaction) throw new Error('Missing creator deposit transaction');
  console.log(`[BlinkSoft] Creator deposit transaction built (${Buffer.from(creatorTransaction, 'base64').length} bytes)`);

  creator.ws.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig-creator-smoke' } }));
  await waitFor(creator.messages, isGameStateStatus('playing'), 'playing state');
  console.log('[BlinkSoft] Room reached playing');

  creator.ws.close();
  challenger.ws.close();

  console.log('[BlinkSoft] PASS');
}

run().catch((err) => {
  console.error('[BlinkSoft] FAIL', err);
  process.exit(1);
});

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function isGameStateStatus(status: string) {
  return (message: Record<string, unknown>) => {
    if (message.type !== 'gameStateUpdate') return false;
    const payload = message.payload;
    return Boolean(payload && typeof payload === 'object' && (payload as Record<string, unknown>).status === status);
  };
}
