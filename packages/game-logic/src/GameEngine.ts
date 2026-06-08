import type { Question as SchemaQuestion } from '@shared/question';
import { getSpecialtyMultiplier, MAX_SPECIALTY_MULTIPLIER } from '@shared/characterStats';
import type {
  GameState,
  GamePhase,
  TimerState,
  DamageEvent,
  PlayerState,
  Card,
  QuestionOption,
} from '@shared/websocket';
import type {
  EnginePlayerState,
  EngineCard,
  PlayCardResult,
  ExternalPlayCardResult,
  ExternalAuthorityState,
  GameEngineEvent,
  GameEngineEventMap,
} from './types';
import { QuestionDealer } from './QuestionDealer';
import { AntiCheatAnalyzer } from './AntiCheatAnalyzer';

/**
 * Core game engine for a CORA match.
 *
 * Responsibilities:
 *  - 5-minute match timer with 1-minute "extra point" phase (×2 multiplier)
 *  - Player health management (100 HP start)
 *  - Scoring: correct attack = 16 dmg, correct heal = 8 HP, with phase/specialty multipliers
 *  - Card dealing from a shuffled question pool (hand of 5, auto-refill)
 *  - Win condition evaluation (HP zero, timer expiry, surrender, draw)
 *
 * The engine is I/O-free. It emits events that the network layer (RoomManager)
 * listens to and broadcasts via WebSocket.
 */
export class GameEngine {
  // ─── Configuration ────────────────────────────────────────────
  static readonly MATCH_DURATION_MS = 180_000;          // 180 seconds
  static readonly EXTRA_POINT_THRESHOLD_MS = 60_000;    // last 1 minute
  static readonly ROUNDS_TO_WIN = 2;
  static readonly BASE_DAMAGE = 16;
  static readonly BASE_HEAL = 8;
  static readonly STARTING_HEALTH = 100;
  static readonly HAND_SIZE = 5;
  static readonly TICK_INTERVAL_MS = 1_000;             // 1 second
  static readonly EXTRA_POINT_MULTIPLIER = 2;
  static readonly MAX_EFFECT_MULTIPLIER = GameEngine.EXTRA_POINT_MULTIPLIER * MAX_SPECIALTY_MULTIPLIER;
  static readonly MAX_DAMAGE = GameEngine.BASE_DAMAGE * GameEngine.MAX_EFFECT_MULTIPLIER;
  static readonly MAX_HEAL = GameEngine.BASE_HEAL * GameEngine.MAX_EFFECT_MULTIPLIER;
  static readonly DAMAGE_LOG_MAX = 20;

  // ─── State ────────────────────────────────────────────────────
  private players: Map<string, EnginePlayerState> = new Map();
  private playerAddresses: [string, string];
  private dealer: QuestionDealer;
  private antiCheat: AntiCheatAnalyzer;
  private phase: GamePhase = 'normal';
  private remainingMs: number = GameEngine.MATCH_DURATION_MS;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private damageLog: DamageEvent[] = [];
  private started = false;
  private finished = false;
  private matchQueue: EngineCard[] = [];
  private currentRound: number = 1;
  private externalAuthority: boolean = false;
  private lastDeadlineNotifiedRound: number | null = null;

  // ─── Events ───────────────────────────────────────────────────
  private listeners: Map<string, Function[]> = new Map();

  constructor(
    players: [{ address: string; characterId: string }, { address: string; characterId: string }] | [string, string],
    questions: SchemaQuestion[],
    options: { externalAuthority?: boolean } = {},
  ) {
    let normalizedPlayers: [{ address: string; characterId: string }, { address: string; characterId: string }];
    if (typeof players[0] === 'string') {
      const addresses = players as [string, string];
      normalizedPlayers = [
        { address: addresses[0], characterId: 'einstein' },
        { address: addresses[1], characterId: 'einstein' },
      ];
    } else {
      normalizedPlayers = players as [{ address: string; characterId: string }, { address: string; characterId: string }];
    }

    this.playerAddresses = [normalizedPlayers[0].address, normalizedPlayers[1].address];
    this.dealer = new QuestionDealer(questions);
    this.antiCheat = new AntiCheatAnalyzer();
    this.externalAuthority = options.externalAuthority ?? false;

    // Generate a shared queue of up to 100 cards for the entire match
    this.matchQueue = this.dealer.dealHand(100);

    // Initialize both players
    for (const p of normalizedPlayers) {
      // Both players start with a copy of the first 5 cards
      const hand = this.matchQueue.slice(0, GameEngine.HAND_SIZE).map(c => ({ ...c }));
      this.players.set(p.address, {
        address: p.address,
        health: GameEngine.STARTING_HEALTH,
        score: 0,
        roundsWon: 0,
        correctAnswers: 0,
        currentCorrectStreak: 0,
        hand,
        characterState: 'stay',
        queueIndex: GameEngine.HAND_SIZE, // Next card to draw is at index 5
        characterId: p.characterId,
      });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Start the match timer. Called once both players have deposited.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.finished = false;
    this.remainingMs = GameEngine.MATCH_DURATION_MS;
    this.phase = 'normal';

    this.timerInterval = setInterval(() => this.tick(), GameEngine.TICK_INTERVAL_MS);
    this.emit('stateUpdate', {});
  }

  /**
   * Force-stop the match for an explicit surrender.
   */
  stop(surrenderedAddress?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.clearTimer();

    if (surrenderedAddress) {
      const winnerAddress = this.playerAddresses.find(a => a !== surrenderedAddress)!;
      this.emit('gameOver', {
        winnerAddress,
        reason: 'surrender',
        surrenderedAddress,
        antiCheatVerdicts: this.antiCheat.getVerdicts()
      });
    }
  }

  surrender(playerAddress: string): void {
    this.stop(playerAddress);
  }

  /**
   * Whether the match has started and not yet finished.
   */
  isActive(): boolean {
    return this.started && !this.finished;
  }

  /**
   * Whether the match has finished.
   */
  isFinished(): boolean {
    return this.finished;
  }

  setExternalAuthority(enabled: boolean): void {
    this.externalAuthority = enabled;
  }

  // ─── Card Play ────────────────────────────────────────────────

  /**
   * Process a player playing a card with a selected answer.
   *
   * Returns a synchronous result so the caller can decide what to broadcast.
   */
  playCard(playerAddress: string, cardId: string, selectedOptionId: string): PlayCardResult {
    const player = this.players.get(playerAddress);
    const opponentAddress = this.playerAddresses.find(a => a !== playerAddress)!;
    const opponent = this.players.get(opponentAddress)!;

    if (!player || !opponent || this.finished) {
      return this.failResult(playerAddress, opponentAddress);
    }

    const now = Date.now();
    const lastPlay = player.lastPlayTimestamp || 0;

    // Check cooldown but don't return immediately, log to anti-cheat first
    const isCooldownHit = now - lastPlay < 500;

    if (isCooldownHit) {
      // Rate limit: 500ms cooldown
      this.antiCheat.recordPlay(playerAddress, false, true);
      return this.failResult(playerAddress, opponentAddress);
    }

    player.lastPlayTimestamp = now;

    // Find the card in the player's hand
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return this.failResult(playerAddress, opponentAddress);
    }

    const card = player.hand[cardIndex];
    const correct = card.correctOptionId === selectedOptionId;
    const phaseMultiplier = this.phase === 'extra_point' ? GameEngine.EXTRA_POINT_MULTIPLIER : 1;
    const specialtyMultiplier = getSpecialtyMultiplier(player.characterId, card.question.category);
    const multiplier = phaseMultiplier * specialtyMultiplier;

    let damage = 0;
    let heal = 0;

    if (correct) {
      player.correctAnswers += 1;
      player.currentCorrectStreak += 1;
      if (card.type === 'attack') {
        damage = GameEngine.BASE_DAMAGE * multiplier;
        opponent.health = Math.max(0, opponent.health - damage);
        player.score += damage;
        player.characterState = 'action';
        opponent.characterState = 'angry';
      } else {
        // heal
        heal = GameEngine.BASE_HEAL * multiplier;
        player.health = Math.min(GameEngine.STARTING_HEALTH, player.health + heal);
        player.score += heal;
        player.characterState = 'happy';
      }
    } else {
      // Wrong answer — no effect, but still consume the card
      player.currentCorrectStreak = 0;
      player.characterState = 'stay';
    }

    // Record the play in anti-cheat analyzer
    this.antiCheat.recordPlay(playerAddress, correct, false);

    // Remove the played card and deal a new one from the shared queue
    player.hand.splice(cardIndex, 1);
    if (player.queueIndex < this.matchQueue.length) {
      const newCard = this.matchQueue[player.queueIndex];
      player.hand.push({ ...newCard });
      player.queueIndex++;
    }

    // Record damage event
    if (correct) {
      const event: DamageEvent = {
        attackerAddress: playerAddress,
        targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
        damage: card.type === 'attack' ? damage : heal,
        multiplier,
        type: card.type,
        timestamp: Date.now(),
      };
      this.damageLog.push(event);
      if (this.damageLog.length > GameEngine.DAMAGE_LOG_MAX) {
        this.damageLog.shift();
      }
    }

    // Check HP-based win condition
    const roundOver = opponent.health <= 0;
    let gameOver = false;
    let winnerAddress: string | undefined = undefined;

    if (roundOver) {
      const winnerPlayer = this.players.get(playerAddress);
      if (winnerPlayer) winnerPlayer.roundsWon += 1;

      const p1 = this.players.get(this.playerAddresses[0])!;
      const p2 = this.players.get(this.playerAddresses[1])!;

      if (p1.roundsWon >= GameEngine.ROUNDS_TO_WIN || p2.roundsWon >= GameEngine.ROUNDS_TO_WIN) {
        gameOver = true;
        const outcome = this.determineMatchOutcome();
        winnerAddress = outcome.winnerAddress ?? undefined;
        this.finished = true;
        this.clearTimer();
        const verdicts = this.antiCheat.getVerdicts();
        this.emit('gameOver', {
          winnerAddress: outcome.winnerAddress,
          reason: outcome.reason === 'draw' ? 'draw' : 'hp_zero',
          antiCheatVerdicts: verdicts
        });
      } else {
        this.resetRound();
        this.emit('roundOver', { winnerAddress: playerAddress, reason: 'hp_zero' });
      }
    }

    this.emit('stateUpdate', {});

    return {
      success: true,
      correct,
      damage,
      heal,
      multiplier,
      cardType: card.type,
      targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
      attackerAddress: playerAddress,
      newTargetHealth: card.type === 'attack' ? opponent.health : player.health,
      newAttackerHealth: player.health,
      gameOver,
      winnerAddress,
      winReason: gameOver ? 'hp_zero' : undefined,
    };
  }

  /**
   * Validate and consume a card while leaving combat authority to an external
   * source (MagicBlock ER). This preserves private answer validation,
   * anti-cheat, card refill, and animation hints, but does not mutate HP,
   * round wins, or terminal match outcome locally.
   */
  playCardNonAuthoritative(playerAddress: string, cardId: string, selectedOptionId: string): ExternalPlayCardResult {
    const player = this.players.get(playerAddress);
    const opponentAddress = this.playerAddresses.find(a => a !== playerAddress)!;
    const opponent = this.players.get(opponentAddress)!;

    if (!player || !opponent || this.finished) {
      return this.failExternalResult(playerAddress, opponentAddress);
    }

    const now = Date.now();
    const lastPlay = player.lastPlayTimestamp || 0;
    const isCooldownHit = now - lastPlay < 500;

    if (isCooldownHit) {
      this.antiCheat.recordPlay(playerAddress, false, true);
      return this.failExternalResult(playerAddress, opponentAddress);
    }

    player.lastPlayTimestamp = now;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return this.failExternalResult(playerAddress, opponentAddress);
    }

    const card = player.hand[cardIndex];
    const correct = card.correctOptionId === selectedOptionId;
    const phaseMultiplier = this.phase === 'extra_point' ? GameEngine.EXTRA_POINT_MULTIPLIER : 1;
    const specialtyMultiplier = getSpecialtyMultiplier(player.characterId, card.question.category);
    const multiplier = phaseMultiplier * specialtyMultiplier;
    const finalValue = correct
      ? (card.type === 'attack' ? GameEngine.BASE_DAMAGE : GameEngine.BASE_HEAL) * multiplier
      : 0;
    const scoreDelta = correct ? finalValue : 0;

    if (correct) {
      player.correctAnswers += 1;
      player.currentCorrectStreak += 1;
      if (card.type === 'attack') {
        player.characterState = 'action';
        opponent.characterState = 'angry';
      } else {
        player.characterState = 'happy';
      }
    } else {
      player.currentCorrectStreak = 0;
      player.characterState = 'stay';
    }

    this.antiCheat.recordPlay(playerAddress, correct, false);

    player.hand.splice(cardIndex, 1);
    let replacementCard: EngineCard | undefined;
    if (player.queueIndex < this.matchQueue.length) {
      replacementCard = { ...this.matchQueue[player.queueIndex] };
      player.hand.push(replacementCard);
      player.queueIndex++;
    }

    if (correct) {
      const event: DamageEvent = {
        attackerAddress: playerAddress,
        targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
        damage: finalValue,
        multiplier,
        type: card.type,
        timestamp: Date.now(),
      };
      this.damageLog.push(event);
      if (this.damageLog.length > GameEngine.DAMAGE_LOG_MAX) {
        this.damageLog.shift();
      }
    }

    return {
      success: true,
      correct,
      damage: card.type === 'attack' ? finalValue : 0,
      heal: card.type === 'heal' ? finalValue : 0,
      multiplier,
      cardType: card.type,
      targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
      attackerAddress: playerAddress,
      newTargetHealth: card.type === 'attack' ? opponent.health : player.health,
      newAttackerHealth: player.health,
      gameOver: false,
      effectType: correct ? card.type : 'none',
      finalValue,
      scoreDelta,
      replacementCard,
    };
  }

  /**
   * Reset character states to 'stay'. Called by caller (e.g. RoomManager) after animations.
   */
  resetRound(): void {
    this.currentRound += 1;
    this.remainingMs = GameEngine.MATCH_DURATION_MS;
    this.phase = 'normal';
    for (const player of this.players.values()) {
      player.health = GameEngine.STARTING_HEALTH;
      player.characterState = 'stay';
    }
    // Broadcast updated state so frontend sees new round, reset health, and timer
    this.emit('stateUpdate', {});
  }

  resetCharacterStates(): void {
    for (const player of this.players.values()) {
      player.characterState = 'stay';
    }
    this.emit('stateUpdate', {});
  }

  // ─── State Accessors ─────────────────────────────────────────

  /**
   * Get anti-cheat verdicts for all players.
   * Typically called after the match finishes.
   */
  getAntiCheatVerdicts() {
    return this.antiCheat.getVerdicts();
  }

  /**
   * Project authoritative public combat state from an external runtime back
   * into the engine-facing state used by websocket broadcasts.
   */
  applyAuthoritativeState(state: ExternalAuthorityState): void {
    const playerA = this.players.get(state.playerA);
    const playerB = this.players.get(state.playerB);
    if (!playerA || !playerB) return;

    playerA.health = state.healthA;
    playerB.health = state.healthB;
    playerA.roundsWon = state.scoreA;
    playerB.roundsWon = state.scoreB;
    playerA.score = state.gameScoreA;
    playerB.score = state.gameScoreB;

    if (this.currentRound !== state.currentRound) {
      this.lastDeadlineNotifiedRound = null;
    }
    this.currentRound = state.currentRound;

    if (typeof state.roundDeadline === 'number' && state.roundDeadline > 0) {
      const remaining = state.roundDeadline * 1000 - Date.now();
      this.remainingMs = Math.max(0, remaining);
      this.phase = this.remainingMs <= GameEngine.EXTRA_POINT_THRESHOLD_MS ? 'extra_point' : 'normal';
    }

    if (state.status === 'Finished' || state.status === 'Cancelled') {
      this.finished = true;
      this.clearTimer();
    } else if (this.started && !this.finished && !this.timerInterval && this.remainingMs > 0) {
      this.timerInterval = setInterval(() => this.tick(), GameEngine.TICK_INTERVAL_MS);
    }

    this.emit('stateUpdate', {});
  }

  /**
   * Build the GameState payload for a specific player.
   * Each player sees their own hand but not the opponent's.
   */
  getStateForPlayer(address: string): Omit<GameState, 'tokenMint' | 'wagerAmount' | 'roomType'> {
    const player = this.players.get(address)!;
    const opponentAddress = this.playerAddresses.find(a => a !== address)!;
    const opponent = this.players.get(opponentAddress)!;

    return {
      status: this.finished ? 'finished' : 'playing',
      player: this.toPlayerState(player),
      opponent: this.toPlayerState(opponent),
      hand: this.toClientCards(player.hand),
      timer: this.getTimerState(),
      damageLog: [...this.damageLog],
      currentRound: this.currentRound,
      roundsToWin: GameEngine.ROUNDS_TO_WIN,
    };
  }

  /**
   * Get current timer state.
   */
  getTimerState(): TimerState {
    return {
      totalDurationMs: GameEngine.MATCH_DURATION_MS,
      remainingMs: this.remainingMs,
      phase: this.phase,
      extraPointThresholdMs: GameEngine.EXTRA_POINT_THRESHOLD_MS,
    };
  }

  /**
   * Get scores for all players.
   */
  getScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      scores[addr] = state.score;
    }
    return scores;
  }

  /**
   * Get health for all players.
   */
  getHealth(): Record<string, number> {
    const health: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      health[addr] = state.health;
    }
    return health;
  }

  /**
   * Get rounds won for all players.
   */
  getRoundsWon(): Record<string, number> {
    const rounds: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      rounds[addr] = state.roundsWon;
    }
    return rounds;
  }

  /**
   * Get correct answer counts for all players.
   */
  getCorrectAnswers(): Record<string, number> {
    const correctAnswers: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      correctAnswers[addr] = state.correctAnswers;
    }
    return correctAnswers;
  }

  /**
   * Get current round number (1-based).
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Get the full list of valid questions for this match (for question hash derivation).
   */
  getQuestions(): SchemaQuestion[] {
    return this.dealer.getQuestions();
  }

  /**
   * Snapshot the shared match queue for backend setup flows such as ER card
   * registration. Returned cards include correct answers and must stay server-only.
   */
  getMatchQueue(): EngineCard[] {
    return this.matchQueue.map(card => ({ ...card }));
  }

  /**
   * Server-only hand snapshot, including correct answers for automated opponents.
   */
  getServerHandForPlayer(address: string): EngineCard[] {
    const player = this.players.get(address);
    if (!player) return [];
    return player.hand.map(card => ({ ...card }));
  }

  /**
   * Get all player addresses.
   */
  getPlayerAddresses(): [string, string] {
    return this.playerAddresses;
  }

  // ─── Event System ─────────────────────────────────────────────

  on<E extends GameEngineEvent>(event: E, callback: (data: GameEngineEventMap[E]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off<E extends GameEngineEvent>(event: E, callback: Function): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx !== -1) cbs.splice(idx, 1);
    }
  }

  private emit<E extends GameEngineEvent>(event: E, data: GameEngineEventMap[E]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (err) {
          console.error(`GameEngine event handler error [${event}]:`, err);
        }
      }
    }
  }

  // ─── Timer Internals ─────────────────────────────────────────

  private tick(): void {
    if (this.finished) {
      this.clearTimer();
      return;
    }

    this.remainingMs = Math.max(0, this.remainingMs - GameEngine.TICK_INTERVAL_MS);

    // Check for phase transition: normal → extra_point
    if (
      this.phase === 'normal' &&
      this.remainingMs <= GameEngine.EXTRA_POINT_THRESHOLD_MS
    ) {
      this.phase = 'extra_point';
      this.emit('phaseChange', { phase: 'extra_point' });
    }

    // Emit timer sync every tick
    this.emit('timerSync', {
      remainingMs: this.remainingMs,
      phase: this.phase,
    });

    if (this.externalAuthority && this.remainingMs <= 0) {
      this.clearTimer();
      if (this.lastDeadlineNotifiedRound !== this.currentRound) {
        this.lastDeadlineNotifiedRound = this.currentRound;
        this.emit('roundDeadline', { roundNumber: this.currentRound });
      }
      return;
    }

    // Time's up - determine this round, then finalize when best-of-3 is complete.
    if (this.remainingMs <= 0) {
      const winner = this.determineRoundWinner();
      if (winner) {
        const winnerPlayer = this.players.get(winner);
        if (winnerPlayer) winnerPlayer.roundsWon += 1;
      }

      const p1 = this.players.get(this.playerAddresses[0])!;
      const p2 = this.players.get(this.playerAddresses[1])!;

      const maxRoundsReached = this.currentRound >= GameEngine.ROUNDS_TO_WIN * 2 - 1;

      if (p1.roundsWon >= GameEngine.ROUNDS_TO_WIN || p2.roundsWon >= GameEngine.ROUNDS_TO_WIN || maxRoundsReached) {
        const outcome = this.determineMatchOutcome();
        this.finished = true;
        this.clearTimer();
        this.emit('gameOver', {
          winnerAddress: outcome.winnerAddress,
          reason: outcome.reason === 'draw' ? 'draw' : 'time_up',
          antiCheatVerdicts: this.antiCheat.getVerdicts()
        });
      } else {
        this.resetRound();
        this.emit('roundOver', { winnerAddress: winner, reason: 'time_up' });
      }
    }
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * When a round expires, determine round winner by HP, then correct answers.
   */
  private determineRoundWinner(): string | null {
    const [addrA, addrB] = this.playerAddresses;
    const a = this.players.get(addrA)!;
    const b = this.players.get(addrB)!;

    if (a.health !== b.health) {
      return a.health > b.health ? addrA : addrB;
    }
    if (a.correctAnswers !== b.correctAnswers) {
      return a.correctAnswers > b.correctAnswers ? addrA : addrB;
    }
    return null;
  }

  /**
   * Final checker: rounds won, then score, then health left.
   * If every category is equal, the match is a draw.
   */
  private determineMatchOutcome(): { winnerAddress: string | null; reason: 'rounds_won' | 'score' | 'health_left' | 'draw' } {
    const [addrA, addrB] = this.playerAddresses;
    const a = this.players.get(addrA)!;
    const b = this.players.get(addrB)!;

    if (a.roundsWon !== b.roundsWon) {
      return { winnerAddress: a.roundsWon > b.roundsWon ? addrA : addrB, reason: 'rounds_won' };
    }
    if (a.score !== b.score) {
      return { winnerAddress: a.score > b.score ? addrA : addrB, reason: 'score' };
    }
    if (a.health !== b.health) {
      return { winnerAddress: a.health > b.health ? addrA : addrB, reason: 'health_left' };
    }
    return { winnerAddress: null, reason: 'draw' };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Convert internal player state to client-safe PlayerState.
   */
  private toPlayerState(player: EnginePlayerState): PlayerState {
    return {
      address: player.address,
      baseHealth: player.health,
      characterState: player.characterState,
      score: player.score,
      roundsWon: player.roundsWon,
      correctAnswers: player.correctAnswers,
      currentCorrectStreak: player.currentCorrectStreak,
      characterId: player.characterId,
      isConnected: true,
    };
  }

  /**
   * Strip correct answers from cards before sending to clients.
   */
  private toClientCards(hand: EngineCard[]): Card[] {
    return hand.map(card => ({
      id: card.id,
      type: card.type,
      question: {
        id: card.question.id,
        text: card.question.questionText,
        options: card.question.options.map(opt => ({
          id: opt.id,
          text: opt.text,
        } as QuestionOption)),
      },
    }));
  }

  /**
   * Build a failure PlayCardResult.
   */
  private failResult(playerAddress: string, opponentAddress: string): PlayCardResult {
    const player = this.players.get(playerAddress);
    const opponent = this.players.get(opponentAddress);
    return {
      success: false,
      correct: false,
      damage: 0,
      heal: 0,
      multiplier: 1,
      cardType: 'attack',
      targetAddress: opponentAddress,
      attackerAddress: playerAddress,
      newTargetHealth: opponent?.health ?? 0,
      newAttackerHealth: player?.health ?? 0,
      gameOver: false,
    };
  }

  private failExternalResult(playerAddress: string, opponentAddress: string): ExternalPlayCardResult {
    return {
      ...this.failResult(playerAddress, opponentAddress),
      effectType: 'none',
      finalValue: 0,
      scoreDelta: 0,
    };
  }
}
