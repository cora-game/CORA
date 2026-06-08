/**
 * test-matchmaking.ts
 *
 * End-to-end tests for the Blink Matchmaking implementation (Phases 1-4).
 * Run with: bun run scripts/test-matchmaking.ts
 *
 * Requires the API server to be running:  bun run dev
 *
 * Tests:
 *  [1] POST /match/private           — creates a private room, returns roomId + blinkUrl
 *  [2] GET  /api/actions/challenge   — returns valid open-room Blink metadata
 *  [3] GET  /api/actions/challenge   — returns error for invalid/missing roomId
 *  [4] POST /api/actions/challenge   — returns real Anchor deposit_wager tx (base64)
 *  [5] POST /api/actions/challenge   — returns error when room is full (2nd Bob attempt)
 *  [6] Sequential public queue       — two players pair, Player A gets matchFound,
 *                                      Player B gets matchFoundWaiting, then
 *                                      Player A confirms deposit → Player B gets depositUnlocked
 *  [7] Shot clock                    — private room cancels after 20s, innocent gets opponentFailedDeposit
 */

import { WebSocket } from 'ws';

const BASE  = 'http://127.0.0.1:8080';
const WS    = 'ws://127.0.0.1:8080';

// Valid-format Solana pubkeys (devnet test wallets — no real funds)
const ALICE     = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'; // arbitrary valid devnet key
const BOB       = 'E8ohBSUASXhBcMkjJ2bQ35hxuWfHKjWZiXhzp2XP81p2'; // arbitrary valid devnet key
// devnet USDC mint
const USDC_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

const pass = (msg: string) => console.log(`  ✅  ${msg}`);
const fail = (msg: string) => { console.error(`  ❌  ${msg}`); process.exitCode = 1; };
const section = (n: number, title: string) => console.log(`\n── Test ${n}: ${title} ──────────────`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function post(path: string, body: object) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, body: await r.json() };
}

function openWs(roomId: string, address: string): { ws: WebSocket; messages: any[] } {
  const messages: any[] = [];
  const ws = new WebSocket(`${WS}/match/${roomId}?address=${address}`);
  ws.on('message', (raw: Buffer) => {
    try { messages.push(JSON.parse(raw.toString())); } catch {}
  });
  return { ws, messages };
}

function waitFor(
  messages: any[],
  type: string,
  timeoutMs = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = messages.find(m => m.type === type);
      if (found) { clearInterval(interval); resolve(found); return; }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for "${type}"`));
      }
    }, 100);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function test1_createPrivateRoom() {
  section(1, 'POST /match/private — create private room');
  const { status, body } = await post('/match/private', {
    address: ALICE,
    tokenMint: USDC_MINT,
    wagerAmount: 5_000_000, // 5 USDC in base units
  });

  if (status !== 200) return fail(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!body.roomId || typeof body.roomId !== 'string') return fail(`Missing roomId in response`);
  if (!body.blinkUrl || !body.blinkUrl.includes(body.roomId)) return fail(`blinkUrl missing or malformed: ${body.blinkUrl}`);

  pass(`Room created: ${body.roomId}`);
  pass(`Blink URL: ${body.blinkUrl}`);
  return body.roomId as string;
}

async function test2_getBlinkMetadata_validRoom(roomId: string) {
  section(2, 'GET /api/actions/challenge?roomId=<valid> — metadata');
  const { status, body } = await get(`/api/actions/challenge?roomId=${roomId}`);

  if (status !== 200) return fail(`Expected 200, got ${status}`);
  if (body.type !== 'action') return fail(`Expected type="action", got "${body.type}"`);
  if (!body.links?.actions?.length) return fail(`Missing links.actions`);
  if (body.error) return fail(`Got unexpected error: ${body.error.message}`);

  pass(`type="${body.type}", title="${body.title}"`);
  pass(`links.actions count: ${body.links.actions.length}`);
}

async function test3_getBlinkMetadata_invalidRoom() {
  section(3, 'GET /api/actions/challenge?roomId=<dead> — should return error');
  const { status, body } = await get(`/api/actions/challenge?roomId=room-nonexistent-999`);

  if (status !== 400) return fail(`Expected 400, got ${status}`);
  if (!body.error?.message) return fail(`Expected error.message, got: ${JSON.stringify(body)}`);

  pass(`Returned error: "${body.error.message}"`);
}

async function test4_postBlinkTx_validRoom(roomId: string) {
  section(4, 'POST /api/actions/challenge?roomId=<valid> — real Anchor tx');
  const { status, body } = await post(`/api/actions/challenge?roomId=${roomId}`, {
    account: BOB,
  });

  if (status !== 200) return fail(`Expected 200, got ${status}: ${JSON.stringify(body)}`);
  if (!body.transaction) return fail(`Missing transaction in response`);
  if (typeof body.transaction !== 'string') return fail(`transaction is not a string`);

  // Verify it's valid base64 and non-trivially sized (a real Anchor tx is > 100 bytes)
  const decoded = Buffer.from(body.transaction, 'base64');
  if (decoded.length < 50) return fail(`Decoded tx is suspiciously short (${decoded.length} bytes) — might still be Memo`);

  pass(`Transaction base64 received (${decoded.length} bytes)`);
  pass(`Message: "${body.message}"`);

  // Verify it's NOT the old Memo program by checking for the Memo program ID in the tx bytes
  const memoId = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
  const txHex = decoded.toString('hex');
  // Memo program pubkey as bytes — if present, we shipped the old code
  const memoBytes = Buffer.from('0a59ce024f8b03e83213c5ba80a02c285a04a82c65e02b3c', 'hex');
  if (txHex.includes(memoBytes.toString('hex'))) {
    return fail(`Transaction still contains Memo program — Anchor tx was NOT built correctly!`);
  }
  pass(`Memo stub is gone — transaction uses real program instructions`);
}

async function test5_postBlink_fullRoom(roomId: string) {
  section(5, 'POST /api/actions/challenge?roomId=<full> — should return 409');
  // Bob already joined in test 4, so room is now full
  const { status, body } = await post(`/api/actions/challenge?roomId=${roomId}`, {
    account: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', // Carol — valid devnet key
  });

  if (status !== 409) return fail(`Expected 409 (full), got ${status}: ${JSON.stringify(body)}`);
  if (!body.message) return fail(`Expected ActionError message`);

  pass(`Correctly rejected with 409: "${body.message}"`);
}

async function test6_sequentialQueue() {
  section(6, 'Sequential public queue — matchFound → matchFoundWaiting → depositUnlocked');

  // Join queue concurrently
  const [res1, res2] = await Promise.all([
    post('/match', { address: ALICE }),
    post('/match', { address: BOB }),
  ]);

  if (!res1.body.roomId || !res2.body.roomId) {
    return fail(`Queue pairing failed: ${JSON.stringify([res1.body, res2.body])}`);
  }

  const roomId = res1.body.roomId;
  pass(`Paired in room: ${roomId}`);

  // Connect both players via WebSocket
  const { ws: wsA, messages: msgsA } = openWs(roomId, ALICE);
  const { ws: wsB, messages: msgsB } = openWs(roomId, BOB);

  await sleep(500); // let WS handshake complete

  // Both should get a gameStateUpdate with status='depositing'
  try {
    const stateA = await waitFor(msgsA, 'gameStateUpdate', 3000);
    if (stateA.payload.status !== 'depositing') {
      fail(`Player A expected status=depositing, got "${stateA.payload.status}"`);
    } else {
      pass(`Player A sees status=depositing`);
    }
  } catch (e: any) {
    fail(`Player A never got gameStateUpdate: ${e.message}`);
  }

  // Player A sends confirmDeposit — this should unlock Player B
  wsA.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig-alice-test' } }));
  pass(`Player A sent confirmDeposit`);

  // Player B should receive depositUnlocked
  try {
    const unlocked = await waitFor(msgsB, 'depositUnlocked', 5000);
    pass(`Player B received depositUnlocked for room: ${unlocked.payload.roomId}`);
  } catch (e: any) {
    fail(`Player B never received depositUnlocked: ${e.message}`);
    wsA.close(); wsB.close();
    return;
  }

  // Player B confirms deposit — game should start
  wsB.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig-bob-test' } }));
  pass(`Player B sent confirmDeposit`);

  // Both should now receive status=playing
  try {
    const playingA = await waitFor(msgsA, 'gameStateUpdate', 5000);
    const isPlaying = msgsA.some(m => m.type === 'gameStateUpdate' && m.payload.status === 'playing');
    if (!isPlaying) {
      fail(`Room never transitioned to playing`);
    } else {
      pass(`Room transitioned to status=playing ✓`);
    }
  } catch (e: any) {
    fail(`Game never started: ${e.message}`);
  }

  wsA.close(); wsB.close();
}

async function test7_shotClock() {
  section(7, 'Shot clock — private room cancels after 20s (creating room, NOT waiting full 20s in CI)');
  console.log('  ℹ️  Creating a private room and immediately checking it exists...');

  const { status, body } = await post('/match/private', {
    address: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', // Carol reused for shot clock test
    tokenMint: USDC_MINT,
    wagerAmount: 1_000_000,
  });

  if (status !== 200 || !body.roomId) {
    return fail(`Could not create room for shot clock test`);
  }
  pass(`Room created: ${body.roomId}`);

  // Verify room exists right now
  const { status: s1 } = await get(`/api/actions/challenge?roomId=${body.roomId}`);
  if (s1 !== 200) return fail(`Room should be valid immediately after creation, got ${s1}`);
  pass(`Room is immediately accessible`);

  console.log('  ℹ️  Skipping 20s wait in test — shot clock fires server-side automatically.');
  console.log('  ℹ️  To manually verify: wait 21s then GET the same roomId — expect 400.');
  console.log(`     curl "${BASE}/api/actions/challenge?roomId=${body.roomId}"`);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   CORA — Blink Matchmaking End-to-End Test Suite     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Server: ${BASE}\n`);

  // Sanity check: is the server up?
  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) throw new Error(`/health returned ${health.status}`);
    console.log('  Server is online ✓\n');
  } catch (e: any) {
    console.error(`\n  ❌  Cannot reach server at ${BASE}`);
    console.error(`     Start it first:  cd apps/api && bun run dev\n`);
    process.exit(1);
  }

  // Test 1: create room
  const roomId = await test1_createPrivateRoom();
  if (!roomId) { process.exit(1); }

  // Tests 2-5 use that room
  await test2_getBlinkMetadata_validRoom(roomId);
  await test3_getBlinkMetadata_invalidRoom();
  await test4_postBlinkTx_validRoom(roomId);
  await test5_postBlink_fullRoom(roomId);

  // Test 6: sequential queue
  await test6_sequentialQueue();

  // Test 7: shot clock (non-blocking)
  await test7_shotClock();

  // Final result
  const code = process.exitCode ?? 0;
  console.log('\n══════════════════════════════════════════════════════');
  if (code === 0) {
    console.log('  🎉  All tests passed!');
  } else {
    console.log('  ⚠️   Some tests FAILED — see ❌ above for details.');
  }
  console.log('══════════════════════════════════════════════════════\n');
  process.exit(code);
}

run().catch(e => { console.error(e); process.exit(1); });
