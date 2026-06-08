import type { GameStatus } from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';

export type RoomType = 'public' | 'private' | 'bot';

export interface RoomSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface RoomClient {
  ws: RoomSocket | null;
  lastSeenAt: number;
}

export interface ServerPlayerMeta {
  hasDeposited: boolean;
  characterId: string;
  depositSignature?: string;
}

export interface OpenedCard {
  cardId: string;
  openedAt: number;
  countdownInterval: ReturnType<typeof setInterval> | null;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

/** Registry entry for a single card registered on the ER session */
export interface ErRegisteredCard {
  cardPda: string;
  owner: string;
  cardId: string;
  effectType: number;
  maxValue: number;
  isDelegated: boolean;
  isConsumed: boolean;
}

/** ER lifecycle status tracked on the room */
export type ErLifecycleStatus =
  | 'none'           // ER not enabled or not yet started
  | 'creating'       // createSession in progress
  | 'registering'    // registerCardV2 calls in progress
  | 'activating'     // activateSession in progress
  | 'delegating'     // delegation in progress
  | 'active'         // session fully delegated, ready for gameplay
  | 'committing'     // commit/undelegate in progress (terminal)
  | 'finished'       // terminal — ER session committed
  | 'failed';        // setup or runtime ER error; fallback to engine-only

/** Proof metadata stored for API responses */
export interface ErProofMeta {
  sessionPda: string;
  setupTxSignatures: string[];
  terminalTxSignatures: string[];
  status: string | null;
  winner: string | null;
  endReason: number | null;
}

export interface Room {
  id: string;
  /** 32-byte match ID derived from room ID — used for on-chain PDA derivation */
  matchIdBytes: Uint8Array;
  clients: Map<string, RoomClient>;
  status: GameStatus;
  playerMeta: Map<string, ServerPlayerMeta>;
  engine: GameEngine | null;
  /** Tracks which card each player has currently opened (one at a time per player) */
  openedCards: Map<string, OpenedCard>;
  /** 'private' rooms are created via /match/private, 'public' via FIFO, 'bot' via practice queue fallback */
  roomType: RoomType;
  /** True only when a public FIFO room has a corresponding queue_matches row. */
  queueMatchPersisted?: boolean;
  /** Role-assigned player addresses — set at pairing time, never from URL params */
  playerA: string | null;
  playerB: string | null;
  /** Server-controlled opponent address for bot practice matches. */
  botAddress: string | null;
  /** Whether Player B has been sent their deposit_wager transaction yet (sequential unlock) */
  playerBUnlocked: boolean;
  /** SPL token mint for this match — stored server-side, never derived from client input */
  tokenMint: string | null;
  /** Wager amount in token base units (e.g. USDC: 1 USDC = 1_000_000) */
  wagerAmount: bigint | null;
  /** Per-player 20s shot clocks during the deposit phase */
  depositTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  /** Ephemeral Rollup session PDA (set when MagicBlock is enabled) */
  erSessionPda: string | null;
  /** USD value of the wager */
  wagerUsdValue?: string | null;
  /** Blink creator response deadline for private soft-commitment rooms */
  blinkJoinDeadline?: number | null;

  /** Whether this room uses ER as the authoritative source of truth */
  erEnabled: boolean;
  /** Current ER lifecycle phase */
  erLifecycleStatus: ErLifecycleStatus;
  /** Per-card ER registry, keyed by `<playerAddress>:<engineCardId>` */
  erCardRegistry: Map<string, ErRegisteredCard>;
  /** Monotonic compact ID source for lazily registered replacement cards */
  erNextCardNonce: number;
  /** Proof metadata for the /proof API endpoint */
  erProofMeta: ErProofMeta | null;
}
