import { createPublicClient, createWalletClient, http, webSocket, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CORA_ESCROW_ABI } from '@shared/escrowAbi';

/**
 * Base Sepolia chain + CoraEscrow wiring for the API.
 *
 * Replaces the old Solana config (program id, instruction discriminators, account
 * layouts). Here everything is just the deployed contract address + the viem
 * clients and the server signer account.
 */

export const CHAIN = baseSepolia;

export const ESCROW_ADDRESS = (process.env.ESCROW_CONTRACT_ADDRESS ?? '') as Address;
export const hasEscrowConfigured = Boolean(ESCROW_ADDRESS) && ESCROW_ADDRESS.startsWith('0x');

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const wsUrl = process.env.BASE_SEPOLIA_WS_URL;

// Note: read clients are created WITHOUT a bound `chain` so their type matches
// viem's default `PublicClient` (avoids a composite-build type-serialization
// quirk). Reads (readContract/getBalance/waitForTransactionReceipt/watch) don't
// need a bound chain. Writes go through the wallet client, which IS chain-bound.

/** HTTP read client. */
export const publicClient: PublicClient = createPublicClient({
  transport: http(rpcUrl),
});

/** WebSocket client for event subscriptions (falls back to HTTP polling if no WS URL). */
export const wsPublicClient: PublicClient = wsUrl
  ? createPublicClient({ transport: webSocket(wsUrl) })
  : publicClient;

console.log(`[Chain] Base Sepolia RPC: ${rpcUrl}${wsUrl ? ` (WS: ${wsUrl})` : ' (no WS — event listener will poll)'}`);

/**
 * The server signer account, loaded from SERVER_PRIVATE_KEY.
 * Replaces the Solana ed25519 keypair. Must equal the contract's `serverSigner`.
 * Returns null if unset (local dev without on-chain settlement).
 */
let cachedAccount: ReturnType<typeof privateKeyToAccount> | null | undefined;
export function getServerAccount() {
  if (cachedAccount !== undefined) return cachedAccount;

  const raw = process.env.SERVER_PRIVATE_KEY?.trim();
  if (!raw) {
    console.warn('⚠️  SERVER_PRIVATE_KEY is missing — on-chain settlement disabled (local dev).');
    cachedAccount = null;
    return cachedAccount;
  }
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  cachedAccount = privateKeyToAccount(key);
  return cachedAccount;
}

/** Wallet client bound to the server signer (null when no key configured). */
export function getWalletClient(): WalletClient | null {
  const account = getServerAccount();
  if (!account) return null;
  return createWalletClient({ account, chain: CHAIN, transport: http(rpcUrl) });
}

export { CORA_ESCROW_ABI };
