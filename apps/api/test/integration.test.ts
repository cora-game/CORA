import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import type { Subprocess } from 'bun';

const PORT = 9876;
const BASE_URL = `http://localhost:${PORT}`;
const WS_BASE = `ws://localhost:${PORT}`;

/**
 * Helper: collect WS messages until a condition is met or timeout.
 */
function collectMessages(
  ws: WebSocket,
  condition: (msgs: any[]) => boolean,
  timeoutMs = 5000,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const msgs: any[] = [];
    const timer = setTimeout(() => {
      resolve(msgs); // resolve with what we have
    }, timeoutMs);

    ws.addEventListener('message', (event) => {
      const parsed = JSON.parse(event.data as string);
      msgs.push(parsed);
      if (condition(msgs)) {
        clearTimeout(timer);
        resolve(msgs);
      }
    });
  });
}

/**
 * Helper: wait for a specific message type.
 */
function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeoutMs);

    ws.addEventListener('message', function handler(event) {
      const parsed = JSON.parse(event.data as string);
      if (parsed.type === type) {
        clearTimeout(timer);
        ws.removeEventListener('message', handler);
        resolve(parsed);
      }
    });
  });
}

/**
 * Helper: wait until WS is open.
 */
function waitForOpen(ws: WebSocket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeoutMs);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
    ws.addEventListener('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

let serverProc: Subprocess | null = null;

beforeAll(async () => {
  // Start the server in background
  serverProc = Bun.spawn(['bun', 'run', 'src/index.ts'], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, PORT: String(PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Wait for server to be ready
  const maxRetries = 20;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) break;
    } catch {}
    await Bun.sleep(250);
  }
});

afterAll(() => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
});

describe('Integration: Health Check', () => {
  test('GET /health returns ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});

describe('Integration: Matchmaking', () => {
  test('two players are paired via POST /match', async () => {
    // Player 1 queues (blocks until paired)
    const p1Promise = fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'integ-player-1' }),
    });

    // Small delay then player 2 queues
    await Bun.sleep(100);

    const p2Res = await fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'integ-player-2' }),
    });

    const p1Res = await p1Promise;
    const body1 = await p1Res.json() as any;
    const body2 = await p2Res.json() as any;

    expect(body1.roomId).toBeDefined();
    expect(body2.roomId).toBeDefined();
    expect(body1.roomId).toBe(body2.roomId);
    expect(body1.role).toBe('playerA');
    expect(body2.role).toBe('playerB');
  });

  test('POST /match without address returns 400', async () => {
    const res = await fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('POST /match with invalid JSON returns 400', async () => {
    const res = await fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('Integration: Full Match Flow', () => {
  /**
   * Creates a WebSocket and immediately starts buffering all messages.
   * Returns helpers to wait for specific message types from the buffer.
   */
  function createBufferedWs(url: string) {
    const ws = new WebSocket(url);
    const buffer: any[] = [];
    const waiters: Array<{ type: string; resolve: (msg: any) => void }> = [];

    ws.addEventListener('message', (event) => {
      const parsed = JSON.parse(event.data as string);
      buffer.push(parsed);

      // Check if any waiter matches
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (parsed.type === waiters[i].type) {
          const waiter = waiters.splice(i, 1)[0];
          waiter.resolve(parsed);
        }
      }
    });

    const openPromise = new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (e) => reject(e));
    });

    function waitFor(type: string, predicate?: (msg: any) => boolean, timeoutMs = 5000): Promise<any> {
      // Check buffer first
      const idx = buffer.findIndex(m => m.type === type && (!predicate || predicate(m)));
      if (idx !== -1) {
        const [msg] = buffer.splice(idx, 1);
        return Promise.resolve(msg);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for ${type}. Buffer: ${JSON.stringify(buffer.map(m => m.type))}`));
        }, timeoutMs);

        // Override the message handler to also check predicate
        const handler = (event: MessageEvent) => {
          const parsed = JSON.parse(event.data as string);
          if (parsed.type === type && (!predicate || predicate(parsed))) {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            resolve(parsed);
          }
        };
        ws.addEventListener('message', handler);
      });
    }

    return { ws, buffer, waitFor, openPromise };
  }

  test('complete game lifecycle via WebSocket', async () => {
    // Step 1: Matchmake two players
    const p1Promise = fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'ws-flow-A' }),
    });
    await Bun.sleep(100);
    const p2Res = await fetch(`${BASE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'ws-flow-B' }),
    });
    const p1Res = await p1Promise;
    const roomId = ((await p1Res.json()) as any).roomId;
    expect(roomId).toBeDefined();

    // Step 2: Connect via WebSocket with eager buffering
    const c1 = createBufferedWs(`${WS_BASE}/match/${roomId}?address=ws-flow-A`);
    const c2 = createBufferedWs(`${WS_BASE}/match/${roomId}?address=ws-flow-B`);

    await Promise.all([c1.openPromise, c2.openPromise]);

    // Step 3: Wait for depositing status (first message might be 'waiting' for player who connected first)
    const isDepositing = (m: any) => m.payload?.status === 'depositing';
    const state1 = await c1.waitFor('gameStateUpdate', isDepositing);
    const state2 = await c2.waitFor('gameStateUpdate', isDepositing);

    expect(state1.payload.status).toBe('depositing');
    expect(state2.payload.status).toBe('depositing');
    expect(state1.payload.player.address).toBe('ws-flow-A');
    expect(state2.payload.player.address).toBe('ws-flow-B');

    // Step 4: Both players confirm deposit → transitions to playing
    c1.ws.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig-A' } }));
    c2.ws.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig-B' } }));

    const isPlaying = (m: any) => m.payload?.status === 'playing';
    const ps1 = await c1.waitFor('gameStateUpdate', isPlaying);
    const ps2 = await c2.waitFor('gameStateUpdate', isPlaying);

    expect(ps1.payload.status).toBe('playing');
    expect(ps1.payload.hand.length).toBeGreaterThan(0);
    expect(ps2.payload.status).toBe('playing');
    expect(ps2.payload.hand.length).toBeGreaterThan(0);

    // Step 5: Player A opens a card → receives cardCountdown
    const cardId = ps1.payload.hand[0].id;

    c1.ws.send(JSON.stringify({ type: 'openCard', payload: { cardId } }));

    const countdown = await c1.waitFor('cardCountdown');
    expect(countdown.payload.cardId).toBe(cardId);
    expect(countdown.payload.remainingMs).toBe(10_000);

    // Step 6: Player A plays the card → receives playCardResult
    const optionId = ps1.payload.hand[0].question.options[0].id;
    c1.ws.send(JSON.stringify({
      type: 'playCard',
      payload: { cardId, selectedOptionId: optionId },
    }));

    const result = await c1.waitFor('playCardResult');
    expect(result.payload).toHaveProperty('correct');
    expect(result.payload).toHaveProperty('damage');
    expect(result.payload).toHaveProperty('heal');

    const score = await c1.waitFor('scoreUpdate');
    expect(score.payload).toHaveProperty('playerScore');
    expect(score.payload).toHaveProperty('opponentScore');

    // Cleanup
    c1.ws.close();
    c2.ws.close();
  }, 15000);
});


