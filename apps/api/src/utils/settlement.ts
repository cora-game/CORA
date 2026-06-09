import type { Address, Hex } from 'viem';
import { parseEther } from 'viem';
import { buildSettlementTypedData, ESCROW_CONSTANTS } from '@shared/escrow';
import {
  CHAIN,
  CORA_ESCROW_ABI,
  ESCROW_ADDRESS,
  getServerAccount,
  getWalletClient,
  hasEscrowConfigured,
  publicClient,
} from '../config/chain';

/**
 * Server-side settlement for the CoraEscrow contract on Base Sepolia.
 *
 * The server signer (an EVM EOA from SERVER_PRIVATE_KEY) is the contract's
 * `serverSigner`. It both signs the EIP-712 settlement authorization AND submits
 * the `settleMatch` transaction. This mirrors the old Solana flow where the
 * server ed25519 keypair signed the 65-byte message and submitted the tx.
 */

const serverAccount = getServerAccount();
export const serverAddress: string = serverAccount?.address ?? '0x0000000000000000000000000000000000000000';

if (!serverAccount) {
  console.warn('[Settlement] No SERVER_PRIVATE_KEY — settlement/refund will be skipped.');
} else if (!hasEscrowConfigured) {
  console.warn('[Settlement] No ESCROW_CONTRACT_ADDRESS — settlement/refund will be skipped.');
} else {
  console.log(`[Settlement] Server signer ${serverAccount.address} → escrow ${ESCROW_ADDRESS}`);
}

const enabled = Boolean(serverAccount) && hasEscrowConfigured;

/**
 * Signs the EIP-712 `Settlement` authorization. Returns a 0x signature that the
 * contract verifies via ecrecover against `serverSigner`.
 *
 * @param action 0 for Normal (winner), 1 for Anti-Cheat (cheater)
 * @param matchId 0x bytes32 match id
 * @param target winner (action 0) or cheater (action 1) EVM address
 */
export async function signSettlementAuthorization(
  action: number,
  matchId: Hex,
  target: string,
): Promise<Hex> {
  const account = getServerAccount();
  if (!account) throw new Error('SERVER_PRIVATE_KEY not configured');

  const typedData = buildSettlementTypedData({
    action,
    matchId,
    target: target as Address,
    chainId: ESCROW_CONSTANTS.CHAIN_ID,
    verifyingContract: ESCROW_ADDRESS,
  });

  return account.signTypedData(typedData);
}

/** Retry helper with exponential backoff for transient RPC errors. */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Settlement] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`, (err as Error).message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

/**
 * Creates a match on-chain so both players can deposit. Server-only (referee).
 * Called when a room is paired, before players deposit their ETH.
 */
export async function initializeMatchOnChain(
  matchId: Hex,
  token: string,
  wager: bigint,
  playerA: string,
  playerB: string,
): Promise<string> {
  const wallet = getWalletClient();
  if (!enabled || !wallet) {
    console.log('[Settlement] initializeMatch skipped — no signer/contract configured.');
    return 'SKIPPED_NO_CONFIG';
  }

  // Idempotent: skip if the match already exists on-chain.
  const existing = await withRetry(() =>
    publicClient.readContract({ address: ESCROW_ADDRESS, abi: CORA_ESCROW_ABI, functionName: 'matches', args: [matchId] }),
  );
  // matches() returns a tuple; status is index 4 (0 = None) — [playerA, playerB, token, wager, status, ...].
  if (existing && Number((existing as readonly unknown[])[4]) !== 0) {
    return 'ALREADY_INITIALIZED';
  }

  const hash = await withRetry(() =>
    wallet.writeContract({
      chain: CHAIN,
      account: getServerAccount()!,
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: 'initializeMatch',
      args: [matchId, token as Address, wager, playerA as Address, playerB as Address],
    }),
  );
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
  console.log(`[Settlement] initializeMatch ${matchId} (token ${token}, wager ${wager}). Tx: ${hash}`);
  return hash;
}

/**
 * Signs and submits `settleMatch`.
 *
 * @param action 0 winner, 1 anti-cheat cheater
 * @param matchId 0x bytes32
 * @param target winner / cheater address
 * @returns the settlement tx hash, or a SKIPPED_* sentinel
 */
export async function submitSettlementTransaction(
  action: number,
  matchId: Hex,
  target: string,
): Promise<string> {
  const wallet = getWalletClient();
  if (!enabled || !wallet) {
    console.log('[Settlement] Skipped — no signer/contract configured.');
    return 'SKIPPED_NO_CONFIG';
  }

  // If the match isn't Active on-chain (never deposited, or already settled), skip.
  const m = (await withRetry(() =>
    publicClient.readContract({ address: ESCROW_ADDRESS, abi: CORA_ESCROW_ABI, functionName: 'matches', args: [matchId] }),
  )) as readonly unknown[];
  const status = Number(m[4]);
  if (status !== 2 /* Active */) {
    console.warn(`[Settlement] Match ${matchId} not Active on-chain (status=${status}). Skipping.`);
    return 'SKIPPED_NOT_ACTIVE';
  }

  const signature = await signSettlementAuthorization(action, matchId, target);

  console.log(`[Settlement] Submitting settleMatch for ${matchId} → target ${target} (action ${action})`);
  const hash = await withRetry(() =>
    wallet.writeContract({
      chain: CHAIN,
      account: getServerAccount()!,
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: 'settleMatch',
      args: [matchId, action, target as Address, signature],
    }),
  );
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
  console.log(`[Settlement] Success! Tx: ${hash}`);
  return hash;
}

/**
 * Submits the timeout-gated `refund`. Used for draws/server-errors (will revert
 * with TimeoutNotReached until the on-chain timeout elapses, same as Solana).
 */
export async function submitRefundTransaction(matchId: Hex): Promise<string> {
  const wallet = getWalletClient();
  if (!enabled || !wallet) {
    console.log('[Refund] Skipped — no signer/contract configured.');
    return 'SKIPPED_NO_CONFIG';
  }

  const m = (await withRetry(() =>
    publicClient.readContract({ address: ESCROW_ADDRESS, abi: CORA_ESCROW_ABI, functionName: 'matches', args: [matchId] }),
  )) as readonly unknown[];
  const status = Number(m[4]);
  if (status !== 1 /* WaitingDeposit */ && status !== 2 /* Active */) {
    console.warn(`[Refund] Match ${matchId} not refundable on-chain (status=${status}). Skipping.`);
    return 'SKIPPED_NOT_REFUNDABLE';
  }

  console.log(`[Refund] Submitting refund for ${matchId}`);
  const hash = await withRetry(() =>
    wallet.writeContract({
      chain: CHAIN,
      account: getServerAccount()!,
      address: ESCROW_ADDRESS,
      abi: CORA_ESCROW_ABI,
      functionName: 'refund',
      args: [matchId],
    }),
  );
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
  console.log(`[Refund] Success! Tx: ${hash}`);
  return hash;
}

/** Convert an ETH-denominated human string (e.g. "0.01") to wei. */
export function ethToWei(eth: string): bigint {
  return parseEther(eth);
}
