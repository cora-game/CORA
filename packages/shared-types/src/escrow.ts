import { sha256, toBytes, type Hex, type Address, type TypedDataDomain } from 'viem';

/**
 * Shared constants between the CoraEscrow Solidity contract (Base Sepolia) and
 * the backend/frontend. These MUST match src/CoraEscrow.sol.
 */
export const ESCROW_CONSTANTS = {
  /** Base Sepolia chain id. */
  CHAIN_ID: 84532,
  /** Seconds before an undeposited match can be refunded. */
  DEPOSIT_TIMEOUT_SECONDS: 30,
  /** Seconds before a stuck active match can be refunded. */
  MATCH_TIMEOUT_SECONDS: 900,
  /** Seconds an open challenge stays acceptable. */
  CHALLENGE_EXPIRY_SECONDS: 900,
  /** Protocol fee, basis points. */
  FEE_BASIS_POINTS: 250,
  BASIS_POINTS_DIVISOR: 10_000,
  /** The exact fee percentage as a readable number. */
  FEE_PERCENTAGE: 2.5,
} as const;

/**
 * EIP-712 typed-data definition for the settlement signature.
 * Mirrors `Settlement(uint8 action,bytes32 matchId,address target)` and the
 * `{name:"CoraEscrow", version:"1"}` domain in CoraEscrow.sol.
 *
 * The backend signs this with the server EOA (viem `signTypedData`); the
 * contract recovers the signer via ecrecover and checks it equals `serverSigner`.
 */
export const SETTLEMENT_EIP712 = {
  domainName: 'CoraEscrow',
  domainVersion: '1',
  types: {
    Settlement: [
      { name: 'action', type: 'uint8' },
      { name: 'matchId', type: 'bytes32' },
      { name: 'target', type: 'address' },
    ],
  },
} as const;

export interface SettlementTypedDataParams {
  action: number;
  matchId: Hex;
  target: Address;
  chainId: number;
  verifyingContract: Address;
}

/**
 * Builds the full EIP-712 typed-data payload for a settlement, ready to pass to
 * viem's `signTypedData` (backend) or `verifyTypedData` (anywhere).
 */
export function buildSettlementTypedData(params: SettlementTypedDataParams) {
  const domain: TypedDataDomain = {
    name: SETTLEMENT_EIP712.domainName,
    version: SETTLEMENT_EIP712.domainVersion,
    chainId: params.chainId,
    verifyingContract: params.verifyingContract,
  };

  return {
    domain,
    types: SETTLEMENT_EIP712.types,
    primaryType: 'Settlement' as const,
    message: {
      action: params.action,
      matchId: params.matchId,
      target: params.target,
    },
  };
}

/**
 * Deterministic 32-byte (bytes32) match id derived from a room identifier.
 *
 * The backend creates human-readable room ids (e.g. "room-1714300000000"); the
 * contract keys matches by `bytes32`. Both backend and frontend call this so
 * they agree on the on-chain id. Uses viem's `sha256` so it is isomorphic
 * (works in Bun and the browser).
 *
 * @returns 0x-prefixed 32-byte hex string suitable for the `matchId` argument.
 */
export function deriveMatchId(roomId: string): Hex {
  return sha256(toBytes(roomId));
}

/**
 * On-chain match lifecycle. Maps to the Solidity `Status` enum (offset by None=0).
 */
export type OnChainMatchStatus =
  | 'WaitingDeposit'
  | 'Active'
  | 'Settled'
  | 'Refunded';

/** Numeric Status enum values from CoraEscrow.sol. */
export const ON_CHAIN_STATUS: Record<OnChainMatchStatus, number> = {
  WaitingDeposit: 1,
  Active: 2,
  Settled: 3,
  Refunded: 4,
};

/**
 * Settlement actions passed to `settleMatch`.
 *   0 — Normal: `target` is the winner (97.5% of pool, 2.5% fee).
 *   1 — Anti-Cheat: `target` is the cheater (honest player refunded, fee = stake).
 */
export const SETTLEMENT_ACTION = {
  WINNER: 0,
  CHEATER: 1,
} as const;

// ─── Wager tokens ──────────────────────────────────────────────
// CORA supports a native-ETH wager and an ERC-20 wager (USDC). On-chain,
// `token == address(0)` means native ETH; otherwise it's the ERC-20 address.

export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export type TokenSymbol = 'ETH' | 'USDC';

export interface TokenInfo {
  symbol: TokenSymbol;
  /** On-chain address; address(0) for native ETH. */
  address: Address;
  decimals: number;
  /** Default per-player wager, in base units (wei / 6-dp USDC). */
  defaultWager: bigint;
}

/** Circle's official USDC on Base Sepolia (override via env if needed). */
const DEFAULT_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;

function envUsdcAddress(): Address {
  // Works in both the API (process.env.USDC_ADDRESS) and the web build
  // (NEXT_PUBLIC_USDC_ADDRESS inlined by Next). Falls back to the canonical one.
  try {
    const fromEnv =
      (typeof process !== 'undefined' &&
        (process.env?.NEXT_PUBLIC_USDC_ADDRESS || process.env?.USDC_ADDRESS)) ||
      '';
    if (fromEnv && fromEnv.startsWith('0x')) return fromEnv as Address;
  } catch {
    // process not available — use default.
  }
  return DEFAULT_USDC_ADDRESS;
}

export const SUPPORTED_TOKENS: Record<TokenSymbol, TokenInfo> = {
  ETH: { symbol: 'ETH', address: NATIVE_ETH_ADDRESS, decimals: 18, defaultWager: BigInt('1000000000000000') }, // 0.001 ETH
  USDC: { symbol: 'USDC', address: envUsdcAddress(), decimals: 6, defaultWager: BigInt('1000000') }, // 1 USDC
};

/** Resolve a symbol ("ETH"/"USDC") or 0x address to its TokenInfo, or null. */
export function resolveToken(input: string | null | undefined): TokenInfo | null {
  if (!input) return null;
  const upper = input.toUpperCase();
  if (upper === 'ETH' || upper === 'USDC') return SUPPORTED_TOKENS[upper as TokenSymbol];
  const lower = input.toLowerCase();
  for (const t of Object.values(SUPPORTED_TOKENS)) {
    if (t.address.toLowerCase() === lower) return t;
  }
  return null;
}

/** True when a token symbol/address represents the native ETH wager. */
export function isNativeEth(token: string | null | undefined): boolean {
  if (!token) return true;
  return token.toUpperCase() === 'ETH' || token.toLowerCase() === NATIVE_ETH_ADDRESS;
}
