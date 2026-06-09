import type { Question as SchemaQuestion, Option as SchemaOption } from './question';

export type CharacterState = 'stay' | 'action' | 'angry' | 'happy';
export type CardType = 'heal' | 'attack';
export type GameStatus = 'waiting' | 'depositing' | 'playing' | 'settling' | 'finished';
export type GamePhase = 'normal' | 'extra_point';

export interface PlayerState {
  address: string;
  baseHealth: number;
  characterState: CharacterState;
  score: number;
  roundsWon: number;
  correctAnswers: number;
  currentCorrectStreak: number;
  characterId: string;
  isConnected: boolean;
  lastSeenAt?: number;
}

export interface TimerState {
  /** Total match duration in ms (300000 = 5 min) */
  totalDurationMs: number;
  /** Remaining time in ms */
  remainingMs: number;
  /** Current game phase */
  phase: GamePhase;
  /** Threshold in ms when extra_point phase begins (60000 = last 1 min) */
  extraPointThresholdMs: number;
}

export interface DamageEvent {
  attackerAddress: string;
  targetAddress: string;
  damage: number;
  multiplier: number;
  type: CardType;
  timestamp: number;
}

export interface Question {
  id: SchemaQuestion['id'];
  text: SchemaQuestion['questionText'];
  options: QuestionOption[];
}

export interface QuestionOption {
  id: SchemaOption['id'];
  text: SchemaOption['text'];
}

export interface Card {
  id: string;
  type: CardType;
  question: Question;
}

export interface GameState {
  status: GameStatus;
  player: PlayerState;
  opponent: PlayerState;
  hand: Card[];
  timer: TimerState;
  damageLog: DamageEvent[];
  /** Current round number (1-based) */
  currentRound: number;
  /** Number of rounds needed to win the match */
  roundsToWin: number;
  /** Vestigial token identifier — always "ETH" on Base Sepolia (native wager). */
  tokenMint: string;
  /** Per-player wager amount, in wei (stringified). */
  wagerAmount: string;
  /** Wager value in ETH (human-readable), when computed. */
  wagerEthValue?: string;
  /** Public, private, or bot practice match */
  roomType: 'public' | 'private' | 'bot';
}

// ─── Card Countdown Pipeline Types ────────────────────────────

export interface CardCountdownData {
  cardId: string;
  /** Remaining time in ms for this card's answer window */
  remainingMs: number;
}

export interface OpenCardAcceptedData {
  cardId: string;
  /** Remaining time in ms for this card's answer window */
  remainingMs: number;
}

export type CardActionRejectedReason =
  | 'game_not_active'
  | 'invalid_payload'
  | 'not_in_hand'
  | 'already_open'
  | 'not_opened'
  | 'different_card_open';

export interface CardActionRejectedData {
  action: 'openCard' | 'playCard';
  reason: CardActionRejectedReason;
  /** Card requested by the client, when one was provided. */
  cardId?: string;
  /** Currently server-open card, when the rejection was caused by another open card. */
  activeCardId?: string;
  /** True when the client should refresh state and let the player try again. */
  recoverable: boolean;
  /** Short UI-safe explanation for toast/copy. */
  message: string;
}

export interface CardExpiredData {
  /** The card that timed out */
  cardId: string;
  /** Omitted by older servers; treat omitted as a normal timeout. */
  reason?: 'timeout' | 'rejected';
}

export interface ScoreUpdateData {
  playerAddress: string;
  opponentAddress: string;
  playerScore: number;
  opponentScore: number;
  playerHealth: number;
  opponentHealth: number;
}

export interface RoundOverData {
  /** Address of the player who won this round */
  winnerAddress: string | null;
  /** Why the round ended */
  reason: 'hp_zero' | 'time_up';
  /** What round just finished (1-based) */
  roundNumber: number;
  /** Rounds won by each player after this round */
  roundsWon: Record<string, number>;
}

// Messages sent from Client -> Server
export type ClientToServerEvents = {
  openCard: (data: { cardId: string }) => void;
  playCard: (data: { cardId: string; selectedOptionId: string }) => void;
  confirmDeposit: (data: { signature: string }) => void;
  cancelMatch: () => void;
  surrender: () => void;
  /** Sent on /queue WS to cancel matchmaking */
  cancelQueue: () => void;
};

// Settlement result payload sent after match ends
export interface MatchResultPayload {
  winner: string;
  /** 32-byte match id as 0x hex — the on-chain matchId key */
  matchId: string;
  /** Server's EIP-712 settlement signature (0x hex). Settlement is submitted
   *  server-side; this is informational/auditable for the client. */
  settlementSignature: string;
  /** Server signer EVM address — matches `serverSigner` in CoraEscrow. */
  serverAddress: string;
}

/** Queue status payload sent on /queue WS */
export interface QueueStatusData {
  /** 1-based position in the queue */
  position: number;
  /** Estimated wait time in ms (null if unknown) */
  estimatedWaitMs: number | null;
  /** Total number of players currently in queue */
  queueDepth: number;
}

// Messages sent from Server -> Client
export type ServerToClientEvents = {
  opponentFailedDeposit: (data: {}) => void;
  roomCancelled: (data: { cancelledBy?: string | null; reason: 'player_cancelled' | 'deposit_timeout' | 'disconnect' }) => void;
  matchFound: (data: { roomId: string; role: 'playerA' | 'playerB'; opponentAddress: string; roomType?: 'public' | 'private' | 'bot' }) => void;
  depositUnlocked: (data: { roomId: string }) => void;
  gameStateUpdate: (state: GameState) => void;
  settlementAuthorization: (result: MatchResultPayload) => void;
  matchResult: (result: MatchResult) => void;
  matchInvalidated: (result: MatchResult) => void; // New event for anti-cheat rejections
  surrenderRejected: (data: { message: string }) => void;
  timerSync: (timer: TimerState) => void;
  damageEvent: (event: DamageEvent) => void;
  phaseChange: (phase: GamePhase) => void;
  roundOver: (data: RoundOverData) => void;
  playCardResult: (result: { correct: boolean; damage: number; heal: number; multiplier: number; cardType: CardType }) => void;
  openCardAccepted: (data: OpenCardAcceptedData) => void;
  cardActionRejected: (data: CardActionRejectedData) => void;
  cardCountdown: (data: CardCountdownData) => void;
  cardExpired: (data: CardExpiredData) => void;
  scoreUpdate: (data: ScoreUpdateData) => void;
  presenceUpdate: (data: PresenceUpdateData) => void;
  /** Queue-phase: sent when player successfully joins the queue */
  queueJoined: (data: QueueStatusData) => void;
  /** Queue-phase: periodic position updates while waiting */
  queueStatus: (data: QueueStatusData) => void;
  /** Queue-phase: sent when player is removed from queue (not via matchFound) */
  queueLeft: (data: { reason: 'cancelled' | 'ttl_expired' | 'error' }) => void;
};

export interface MatchResult {
  winnerAddress: string | null;
  reason: 'hp_zero' | 'time_up' | 'surrender' | 'anti_cheat' | 'draw' | 'server_error';
  finalScores: Record<string, number>;
  finalHealth: Record<string, number>;
  finalRoundsWon?: Record<string, number>;
  finalCorrectAnswers?: Record<string, number>;
  surrenderedAddress?: string;
  antiCheatWarning?: boolean; // True if the match was suspicious but still settled
  /** True when this was a practice match against the server bot, with no wager payout/loss. */
  isBotMatch?: boolean;
}

export interface PresenceUpdateData {
  players: Record<string, { isConnected: boolean; lastSeenAt?: number }>;
}

// Serialization format for native WebSocket (since we aren't using Socket.io)
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}
