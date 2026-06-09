import type { GameStatus } from '@shared/websocket';
import type { Hex } from 'viem';
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

export interface Room {
  id: string;
  /** 0x bytes32 match id derived from room id — the on-chain CoraEscrow match key. */
  matchId: Hex;
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
  /** Whether Player B has been sent their deposit unlock yet (sequential unlock) */
  playerBUnlocked: boolean;
  /** Vestigial token identifier — always "ETH" on Base Sepolia (native wager). */
  tokenMint: string | null;
  /** Per-player wager amount, in wei. */
  wagerAmount: bigint | null;
  /** Per-player 30s shot clocks during the deposit phase */
  depositTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  /** Human-readable ETH value of the wager. */
  wagerEthValue?: string | null;
  /** Challenge creator response deadline for private soft-commitment rooms */
  blinkJoinDeadline?: number | null;
}
