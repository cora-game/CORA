/**
 * CORA API stress test (local). Run: bun run scripts/stress.ts
 * Exercises: HTTP read load, rate limiter, bot-match creation, and WS matchmaking.
 */
import { Keypair } from '@solana/web3.js';

const BASE = process.env.STRESS_BASE_URL ?? 'http://localhost:8080';
const WS_BASE = BASE.replace(/^http/, 'ws');

type Sample = { ms: number; status: number; ok: boolean };

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function report(name: string, samples: Sample[], wallMs: number) {
  const lat = samples.map((s) => s.ms).sort((a, b) => a - b);
  const ok = samples.filter((s) => s.ok).length;
  const codes: Record<string, number> = {};
  for (const s of samples) codes[s.status] = (codes[s.status] ?? 0) + 1;
  const rps = (samples.length / wallMs) * 1000;
  console.log(`\n── ${name}`);
  console.log(`   requests     : ${samples.length}  (ok=${ok}, fail=${samples.length - ok})`);
  console.log(`   wall time    : ${wallMs.toFixed(0)} ms   throughput: ${rps.toFixed(0)} req/s`);
  console.log(`   latency ms   : p50=${pct(lat, 50).toFixed(1)}  p95=${pct(lat, 95).toFixed(1)}  p99=${pct(lat, 99).toFixed(1)}  max=${(lat.at(-1) ?? 0).toFixed(1)}`);
  console.log(`   status codes : ${JSON.stringify(codes)}`);
}

/** Run `total` tasks with at most `concurrency` in flight. */
async function pool<T>(total: number, concurrency: number, task: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(total);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const i = next++;
      if (i >= total) break;
      out[i] = await task(i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function timedFetch(path: string, init?: RequestInit & { fwd?: string }): Promise<Sample> {
  const headers = new Headers(init?.headers);
  // Unique IP per call → bypass the shared 60/min/IP rate-limit bucket.
  headers.set('x-forwarded-for', init?.fwd ?? `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}`);
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    await res.arrayBuffer();
    return { ms: performance.now() - t0, status: res.status, ok: res.ok };
  } catch {
    return { ms: performance.now() - t0, status: 0, ok: false };
  }
}

async function phaseHttp(name: string, path: string, total: number, concurrency: number) {
  const t0 = performance.now();
  const samples = await pool(total, concurrency, () => timedFetch(path));
  report(`${name}  GET ${path}  (conc=${concurrency})`, samples, performance.now() - t0);
}

async function phaseRateLimiter() {
  const fwd = '203.0.113.77'; // fixed IP → should hit the limiter
  const t0 = performance.now();
  const samples = await pool(75, 75, () => timedFetch('/health', { fwd }));
  const ok = samples.filter((s) => s.status === 200).length;
  const limited = samples.filter((s) => s.status === 429).length;
  report(`Rate limiter  (75 reqs, SAME ip)`, samples, performance.now() - t0);
  const verdict = ok <= 60 && limited >= 1 ? 'PASS' : 'CHECK';
  console.log(`   verdict      : ${verdict}  (expect ≤60 x 200, rest 429)  → 200=${ok} 429=${limited}`);
}

async function phaseBotMatches(total: number, concurrency: number) {
  const t0 = performance.now();
  const samples = await pool(total, concurrency, async () => {
    const address = Keypair.generate().publicKey.toBase58();
    return timedFetch('/match/bot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, tokenMint: 'SOL', wagerAmount: 0, characterId: 'einstein' }),
    });
  });
  report(`Bot match creation  POST /api/match/bot  (conc=${concurrency})`, samples, performance.now() - t0);
}

async function phaseWsMatchmaking(pairs: number) {
  const clients = pairs * 2;
  console.log(`\n── WS matchmaking  /queue  (${clients} clients → expect ${pairs} matches)`);
  let matched = 0;
  let joined = 0;
  let errors = 0;
  const matchTimes: number[] = [];
  const sockets: WebSocket[] = [];
  const opened = performance.now();

  await new Promise<void>((resolve) => {
    let settled = 0;
    const done = () => { if (++settled >= clients) resolve(); };
    const overall = setTimeout(resolve, 12000); // hard cap
    overall.unref?.();

    for (let i = 0; i < clients; i++) {
      const address = Keypair.generate().publicKey.toBase58();
      // Unique x-forwarded-for per WS so each upgrade gets its own rate-limit bucket
      // (mirrors production behind a proxy; without it all share 'unknown-ip').
      const ws = new WebSocket(`${WS_BASE}/queue?address=${address}`, {
        headers: { 'x-forwarded-for': `172.16.${(i / 256) | 0}.${i % 256}` },
      } as unknown as string[]);
      sockets.push(ws);
      const t0 = performance.now();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
          if (msg.type === 'queueJoined' || msg.type === 'queueStatus') joined++;
          if (msg.type === 'matchFound') {
            matched++;
            matchTimes.push(performance.now() - t0);
            done();
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { errors++; done(); };
    }
  });

  for (const ws of sockets) { try { ws.close(); } catch { /* noop */ } }
  matchTimes.sort((a, b) => a - b);
  console.log(`   connected    : ${clients}   joined/status events: ${joined}`);
  console.log(`   matchFound   : ${matched} / ${clients} clients  (≈${Math.floor(matched / 2)} pairs)`);
  console.log(`   match latency: p50=${pct(matchTimes, 50).toFixed(1)}ms p95=${pct(matchTimes, 95).toFixed(1)}ms max=${(matchTimes.at(-1) ?? 0).toFixed(1)}ms`);
  console.log(`   ws errors    : ${errors}   total wall: ${(performance.now() - opened).toFixed(0)}ms`);
}

async function main() {
  console.log(`CORA stress test → ${BASE}`);
  // Warm up / sanity
  const h = await timedFetch('/health');
  if (!h.ok) { console.error(`Health check failed (status ${h.status}). Is the API running?`); process.exit(1); }

  await phaseHttp('Read load', '/health', 2000, 100);
  await phaseHttp('Read load', '/api/questions', 1000, 100);
  await phaseRateLimiter();
  await phaseBotMatches(300, 40);
  await phaseWsMatchmaking(40);

  console.log('\n✅ stress test complete');
  process.exit(0);
}

main();
