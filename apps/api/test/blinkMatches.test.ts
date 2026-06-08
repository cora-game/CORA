import { describe, expect, test } from 'bun:test';
import { MemoryBlinkMatchStore } from '../src/services/blinkMatches';

const CREATOR = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const CHALLENGER = 'E8ohBSUASXhBcMkjJ2bQ35hxuWfHKjWZiXhzp2XP81p2';
const OTHER = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy';
const USDC_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

describe('MemoryBlinkMatchStore', () => {
  test('creates pending challenge and accepts it as challenged', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });

    expect(pending.status).toBe('PENDING');
    expect(pending.opponentWallet).toBeNull();

    const accepted = await store.acceptPending(pending.id, CHALLENGER);

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.match.status).toBe('CHALLENGED');
    expect(accepted.match.creatorWallet).toBe(CREATOR);
    expect(accepted.match.opponentWallet).toBe(CHALLENGER);
    expect(accepted.match.joinDeadline).toBeTruthy();
  });

  test('rejects duplicate challenger after first accept', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });

    const first = await store.acceptPending(pending.id, CHALLENGER);
    const second = await store.acceptPending(pending.id, OTHER);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'already_accepted' });
  });

  test('expires pending and forfeits challenged matches during sweep', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });
    const acceptedSource = await store.createPending({
      creatorWallet: OTHER,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });
    const accepted = await store.acceptPending(acceptedSource.id, CHALLENGER);
    expect(accepted.ok).toBe(true);

    const later = new Date(Date.now() + 20 * 60 * 1000);
    const updates = await store.sweepExpired(later);

    expect(updates).toContainEqual({ id: pending.id, status: 'EXPIRED' });
    expect(updates).toContainEqual({ id: acceptedSource.id, status: 'FORFEITED' });
    expect((await store.get(pending.id))?.status).toBe('EXPIRED');
    expect((await store.get(acceptedSource.id))?.status).toBe('FORFEITED');
  });

  test('marks creator deposit as active inside the response window', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });
    await store.acceptPending(pending.id, CHALLENGER);

    const active = await store.markActive(pending.id, CREATOR, 'sig-creator');

    expect(active?.status).toBe('ACTIVE');
    expect(active?.creatorDepositSignature).toBe('sig-creator');
  });

  test('uses pre-determined id when provided', async () => {
    const store = new MemoryBlinkMatchStore();
    const customId = 'my-custom-room-id-for-pda';
    const pending = await store.createPending({
      id: customId,
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });

    expect(pending.id).toBe(customId);
    expect(await store.get(customId)).not.toBeNull();
  });

  test('join window is ~30s (matches on-chain DEPOSIT_TIMEOUT_SECONDS)', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });

    const accepted = await store.acceptPending(pending.id, CHALLENGER);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    // Deadline should be ~30s from now
    const deadline = Date.parse(accepted.match.joinDeadline!);
    const now = Date.now();
    const diffMs = deadline - now;
    expect(diffMs).toBeGreaterThan(25_000);
    expect(diffMs).toBeLessThan(35_000);

    // Just before deadline: markActive should succeed
    const justBefore = new Date(deadline - 1000);
    const active = await store.markActive(pending.id, CREATOR, 'sig', justBefore);
    expect(active?.status).toBe('ACTIVE');
  });

  test('creator cannot accept their own challenge', async () => {
    const store = new MemoryBlinkMatchStore();
    const pending = await store.createPending({
      creatorWallet: CREATOR,
      tokenMint: USDC_MINT,
      wagerAmount: 1_000_000n,
    });

    const result = await store.acceptPending(pending.id, CREATOR);
    expect(result).toEqual({ ok: false, reason: 'creator_cannot_accept' });
  });
});
