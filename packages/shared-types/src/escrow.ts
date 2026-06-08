import { createHash } from 'crypto';

/**
 * Shared constants between smart contract and backend/frontend.
 * These MUST match the values in packages/solana-program/.../constants.rs
 *
 * Smart contract seeds (Rust):
 *   MATCH_SEED = b"match"
 *   VAULT_SEED = b"vault"
 */
export const ESCROW_CONSTANTS = {
  MATCH_SEED: 'match',
  VAULT_SEED: 'vault',
  CHALLENGE_SEED: 'challenge',
  CHALLENGE_VAULT_SEED: 'challenge_vault',
  CONFIG_SEED: 'config',
  DEPOSIT_TIMEOUT_SECONDS: 30,
  MATCH_TIMEOUT_SECONDS: 900,
  CHALLENGE_EXPIRY_SECONDS: 900,
  FEE_BASIS_POINTS: 250,
  BASIS_POINTS_DIVISOR: 10_000,
  /** The exact fee percentage as a readable number */
  FEE_PERCENTAGE: 2.5,
  /** Current version of MatchState struct (must match state.rs) */
  MATCH_STATE_VERSION: 1,
  /** Current version of OpenChallengeState struct (must match state.rs) */
  OPEN_CHALLENGE_STATE_VERSION: 1,
  /** Current version of ProgramConfig struct (must match state.rs) */
  PROGRAM_CONFIG_VERSION: 1,
} as const;

/**
 * Settlement message format.
 * Both backend (signing) and smart contract (verification) must use the same format.
 *
 * Format: 65 bytes total
 *   - action (1 byte): 0 for Normal, 1 for Anti-Cheat Penalty
 *   - match_id (32 bytes)
 *   - target_pubkey (32 bytes): Winner if action=0, Cheater if action=1
 *
 * The smart contract reconstructs this message from on-chain state and verifies
 * the ed25519 signature against it.
 */
import bs58 from 'bs58';

export function buildSettlementMessage(
  action: number,
  matchIdBytes: Uint8Array,
  targetAddress: string,
): Uint8Array {
  const message = new Uint8Array(65);
  message[0] = action;
  message.set(matchIdBytes, 1);
  const targetPubkeyBytes = bs58.decode(targetAddress);
  message.set(targetPubkeyBytes, 33);
  return message;
}

/**
 * Generates a deterministic 32-byte match ID from a room identifier.
 *
 * The backend creates human-readable room IDs (e.g., "room-1714300000000").
 * The smart contract requires a fixed [u8; 32] match ID for PDA derivation.
 *
 * This function bridges the two by hashing the room ID into 32 bytes using SHA-256.
 * Both backend and frontend must use this same function to derive the on-chain match ID.
 *
 * @param roomId The human-readable room identifier from matchmaking
 * @returns 32-byte Uint8Array suitable for on-chain match_id parameter
 */
export function deriveMatchId(roomId: string): Uint8Array {
  const hash = createHash('sha256').update(roomId).digest();
  return new Uint8Array(hash);
}

/**
 * On-chain match lifecycle.
 * Maps to the Rust enum MatchStatus in state.rs.
 */
export type OnChainMatchStatus =
  | 'WaitingDeposit'
  | 'Active'
  | 'Settled'
  | 'Refunded';

/**
 * Maps backend GameStatus to on-chain MatchStatus.
 * Not all backend statuses have on-chain equivalents (e.g., 'waiting' is purely off-chain).
 */
export const GAME_TO_CHAIN_STATUS: Record<string, OnChainMatchStatus | null> = {
  waiting: null,       // Off-chain only — before initialize_match is called
  depositing: 'WaitingDeposit',
  playing: 'Active',
  settling: 'Active',  // On-chain still Active until settlement tx confirms
  finished: null,      // Could be 'Settled' or 'Refunded' — determined by settlement flow
};
