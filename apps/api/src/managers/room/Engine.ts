import { GameEngine } from '@cora/game-logic';
import type { EngineCard, PlayCardResult } from '@cora/game-logic';
import type { CardActionRejectedData, CardActionRejectedReason, MatchResult } from '@shared/websocket';
import { fetchMatchQuestions, loadPracticeQuestions } from '../../questions';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';

export class Engine {
  private CARD_ANSWER_TIMEOUT_MS = 10_000;
  private CARD_COUNTDOWN_TICK_MS = 1_000;
  private BOT_MIN_THINK_MS = 1_600;
  private BOT_MAX_THINK_MS = 4_200;
  private BOT_NEXT_ACTION_MIN_MS = 900;
  private BOT_NEXT_ACTION_MAX_MS = 2_400;
  private BOT_BASE_ACCURACY = 0.58;
  private BOT_LOW_HEALTH_ACCURACY = 0.68;
  private botLoops: Map<string, { stopped: boolean; timers: Set<ReturnType<typeof setTimeout>> }> = new Map();

  constructor(private manager: RoomManager) {}

  public async initializeEngine(room: Room) {
    if (!room.playerA || !room.playerB) {
      console.error(`Room ${room.id} missing player assignments. Cannot start.`);
      return;
    }

    const addresses: [string, string] = [room.playerA, room.playerB];
    const playersInfo: [{ address: string; characterId: string }, { address: string; characterId: string }] = [
      { address: addresses[0], characterId: room.playerMeta.get(addresses[0])?.characterId || 'einstein' },
      { address: addresses[1], characterId: room.playerMeta.get(addresses[1])?.characterId || 'einstein' }
    ];
    
    const questions =
      room.roomType === 'bot'
        ? loadPracticeQuestions()
        : await fetchMatchQuestions();

    if (questions.length === 0) {
      console.error(`No questions loaded! Cannot start match in room ${room.id}.`);
      return;
    }

    const engine = new GameEngine(playersInfo, questions, { externalAuthority: false });
    room.engine = engine;
    room.status = 'playing';

    // Wire engine events to WebSocket broadcasts
    engine.on('timerSync', () => {
      this.manager.network.broadcastToRoom(room, {
        type: 'timerSync',
        payload: engine.getTimerState(),
      });
    });

    engine.on('phaseChange', (data) => {
      console.log(`Room ${room.id} entering EXTRA POINT phase!`);
      this.manager.network.broadcastToRoom(room, {
        type: 'phaseChange',
        payload: data.phase,
      });
      this.manager.network.broadcastGameState(room);
    });

    engine.on('gameOver', (data) => {
      console.log(`Room ${room.id} game over! Winner: ${data.winnerAddress ?? 'draw'} (${data.reason})`);
      console.log('SETTLING: Outcome determined server-side, beginning payout flow...');
      this.stopBot(room);
      this.manager.lifecycle.clearAllOpenedCards(room);

      room.status = 'settling';
      this.manager.network.broadcastGameState(room);

      try {
        const finalScores = engine.getScores();
        const finalHealth = engine.getHealth();
        const finalRoundsWon = engine.getRoundsWon();
        const finalCorrectAnswers = engine.getCorrectAnswers();
        const verdicts = data.antiCheatVerdicts || {};
        let isRejected = false;
        let cheaterAddress: string | null = null;
        let isSuspicious = false;

        console.log(`[Anti-Cheat] Room ${room.id} verdicts:`);
        for (const [address, verdict] of Object.entries(verdicts)) {
          console.log(` - Player ${address}: ${verdict.verdict.toUpperCase()} (Score: ${verdict.trustScore.toFixed(2)})`);
          if (verdict.verdict === 'rejected') {
            isRejected = true;
            cheaterAddress = address;
            console.warn(`[Anti-Cheat] WARNING: Player ${address} was rejected for flags:`, verdict.flags.map(f => f.signal).join(', '));
          } else if (verdict.verdict === 'suspicious') {
            isSuspicious = true;
            console.warn(`[Anti-Cheat] WARNING: Player ${address} is suspicious. Flags:`, verdict.flags.map(f => f.signal).join(', '));
          }
          console.log(`[Anti-Cheat] Stats for ${address}:`, JSON.stringify(verdict.stats));
        }

        if (room.roomType === 'bot') {
          const result: MatchResult = {
            winnerAddress: data.winnerAddress,
            reason: data.reason,
            surrenderedAddress: data.surrenderedAddress,
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
            isBotMatch: true,
          };

          console.log(`[BotMatch] Room ${room.id} finished with no escrow settlement.`);
          this.manager.network.broadcastToRoom(room, {
            type: 'matchResult',
            payload: result,
          });
        } else if (isRejected && cheaterAddress) {
          console.error(`[Anti-Cheat] Match in Room ${room.id} REJECTED. Handling anti-cheat settlement.`);
          this.manager.blockchain.settleAntiCheat(room, cheaterAddress);

          const result: MatchResult = {
            winnerAddress: data.winnerAddress,
            reason: 'anti_cheat',
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
          };

          this.manager.network.broadcastToRoom(room, {
            type: 'matchInvalidated',
            payload: result,
          });
        } else if (!data.winnerAddress || data.reason === 'draw') {
          const result: MatchResult = {
            winnerAddress: null,
            reason: 'draw',
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
            antiCheatWarning: isSuspicious,
          };

          this.manager.blockchain.refundMatch(room, 'draw');
          this.manager.network.broadcastToRoom(room, {
            type: 'matchResult',
            payload: result,
          });
        } else {
          const result: MatchResult = {
            winnerAddress: data.winnerAddress,
            reason: data.reason,
            surrenderedAddress: data.surrenderedAddress,
            finalScores,
            finalHealth,
            finalRoundsWon,
            finalCorrectAnswers,
            antiCheatWarning: isSuspicious,
          };

          void this.manager.blockchain.settleMatch(room, data.winnerAddress).then((result) => {
            if (!result.ok) {
              console.error(`[RoomEngine] Settlement failed for room ${room.id}`);
            }
          }).catch((err) => {
            console.error(`[RoomEngine] Settlement threw for room ${room.id}:`, err);
          });
          this.manager.network.broadcastToRoom(room, {
            type: 'matchResult',
            payload: result,
          });
        }
      } catch (e) {
        console.error(`[RoomEngineManager] Error during game over processing for room ${room.id}:`, e);
        this.manager.blockchain.refundMatch(room, 'server_error');
        this.manager.network.broadcastToRoom(room, {
          type: 'matchResult',
          payload: {
            winnerAddress: null,
            reason: 'server_error',
            finalScores: engine.getScores(),
            finalHealth: engine.getHealth(),
            finalRoundsWon: engine.getRoundsWon(),
            finalCorrectAnswers: engine.getCorrectAnswers(),
          } satisfies MatchResult,
        });
      } finally {
        room.status = 'finished';
        if (room.roomType === 'private') {
          void this.manager.blinkMatches.markCompleted(room.id).catch((err) => {
            console.error(`[Blink] Failed to mark private room ${room.id} completed:`, err);
          });
        }
        console.log(`FINISHED: Room ${room.id} settlement dispatched.`);
        this.manager.network.broadcastGameState(room);
        
        // Clean up the room after 15 seconds
        setTimeout(() => {
          this.manager.lifecycle.destroyRoom(room.id);
        }, 15_000);
      }
    });

    engine.on('roundOver', (data) => {
      const roundNum = engine.getCurrentRound() - 1;
      const roundsWon = engine.getRoundsWon();
      console.log(`Room ${room.id} round ${roundNum} over. Winner: ${data.winnerAddress} (${data.reason})`);

      this.manager.lifecycle.clearAllOpenedCards(room);

      this.manager.network.broadcastToRoom(room, {
        type: 'roundOver',
        payload: {
          winnerAddress: data.winnerAddress,
          reason: data.reason,
          roundNumber: roundNum,
          roundsWon,
        }
      });
      this.manager.network.broadcastGameState(room);
    });

    engine.on('stateUpdate', () => {
      this.manager.network.broadcastGameState(room);
    });

    engine.start();
    console.log(`Room ${room.id} game engine started. 5-minute countdown begins!`);
    this.startBotIfNeeded(room);
    this.manager.network.broadcastGameState(room);
  }

  public handleOpenCard(room: Room, address: string, cardId: string) {
    if (!cardId) {
      this.rejectCardAction(room, address, {
        action: 'openCard',
        reason: 'invalid_payload',
        recoverable: true,
      });
      return;
    }
    if (!room.engine || !room.engine.isActive()) {
      this.rejectCardAction(room, address, {
        action: 'openCard',
        reason: 'game_not_active',
        cardId,
        recoverable: false,
      });
      return;
    }

    const existing = room.openedCards.get(address);
    if (existing) {
      if (!this.isCardInHand(room, address, existing.cardId)) {
        console.warn(`Clearing stale opened card ${existing.cardId} for ${address} in room ${room.id}.`);
        this.manager.lifecycle.clearOpenedCard(room, address);
      } else if (existing.cardId === cardId) {
        const remainingMs = this.getRemainingAnswerMs(existing.openedAt);
        this.sendOpenCardAccepted(room, address, existing.cardId, remainingMs);
        this.sendCountdown(room, address, existing.cardId, remainingMs);
        return;
      } else {
        console.warn(`Player ${address} already has card ${existing.cardId} open in room ${room.id}. Ignoring.`);
        this.rejectCardAction(room, address, {
          action: 'openCard',
          reason: 'already_open',
          cardId,
          activeCardId: existing.cardId,
          recoverable: true,
        });
        this.sendCountdown(room, address, existing.cardId, this.getRemainingAnswerMs(existing.openedAt));
        return;
      }
    }

    const playerState = room.engine.getStateForPlayer(address);
    const cardInHand = playerState.hand.find(c => c.id === cardId);
    if (!cardInHand) {
      console.warn(`Card ${cardId} not found in ${address}'s hand. Ignoring openCard.`);
      this.rejectCardAction(room, address, {
        action: 'openCard',
        reason: 'not_in_hand',
        cardId,
        recoverable: true,
      });
      this.manager.network.broadcastGameState(room);
      return;
    }

    const openedAt = Date.now();
    console.log(`Player ${address} opened card ${cardId} in room ${room.id}. 10s countdown started.`);

    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, this.CARD_ANSWER_TIMEOUT_MS - elapsed);

      this.sendCountdown(room, address, cardId, remaining);
    }, this.CARD_COUNTDOWN_TICK_MS);

    const timeoutHandle = setTimeout(() => {
      void this.expireCard(room, address, cardId);
    }, this.CARD_ANSWER_TIMEOUT_MS);

    room.openedCards.set(address, {
      cardId,
      openedAt,
      countdownInterval,
      timeoutHandle,
    });
    this.sendOpenCardAccepted(room, address, cardId, this.CARD_ANSWER_TIMEOUT_MS);
    this.sendCountdown(room, address, cardId, this.CARD_ANSWER_TIMEOUT_MS);
  }

  public async expireCard(room: Room, address: string, cardId: string) {
    if (!room.engine || !room.engine.isActive()) return;

    console.log(`Card ${cardId} expired for player ${address} in room ${room.id} (timeout).`);

    this.manager.lifecycle.clearOpenedCard(room, address);
    room.engine.playCard(address, cardId, '__timeout__');

    this.sendCardExpired(room, address, cardId, 'timeout');

    this.manager.network.broadcastScoreUpdate(room);
  }

  public async handlePlayCard(room: Room, address: string, payload: { cardId?: string; selectedOptionId?: string }) {
    if (!room.engine || !room.engine.isActive()) {
      this.rejectCardAction(room, address, {
        action: 'playCard',
        reason: 'game_not_active',
        cardId: payload.cardId,
        recoverable: false,
      });
      return;
    }

    const { cardId, selectedOptionId } = payload;
    if (!cardId || !selectedOptionId) {
      this.rejectCardAction(room, address, {
        action: 'playCard',
        reason: 'invalid_payload',
        cardId,
        recoverable: true,
      });
      return;
    }

    const opened = room.openedCards.get(address);
    if (!opened || opened.cardId !== cardId) {
      const canRecoverPracticePlay = room.roomType === 'bot'
        && !opened
        && this.isCardInHand(room, address, cardId);

      if (!canRecoverPracticePlay) {
        const reason: CardActionRejectedReason = opened ? 'different_card_open' : 'not_opened';
        const logReason = opened
          ? `while card ${opened.cardId} is open`
          : 'without opening it first';
        console.warn(`Player ${address} tried to play card ${cardId} ${logReason} in room ${room.id}.`);
        this.rejectCardAction(room, address, {
          action: 'playCard',
          reason,
          cardId,
          activeCardId: opened?.cardId,
          recoverable: true,
        });
        this.manager.network.broadcastGameState(room);
        return;
      }

      console.warn(
        `[RoomEngineManager] Recovering bot-practice play for ${address}: ` +
        `card ${cardId} was answered without tracked open state in room ${room.id}.`,
      );
    } else {
      this.manager.lifecycle.clearOpenedCard(room, address);
    }

    console.log(`Player ${address} played card ${cardId} with answer ${selectedOptionId} in room ${room.id}`);

    const result: PlayCardResult = room.engine.playCard(address, cardId, selectedOptionId);
    if (!result.success) {
      console.warn(`Card play failed for ${address} in room ${room.id}`);
      return;
    }

    if (result.correct) {
      this.manager.network.broadcastToRoom(room, {
        type: 'damageEvent',
        payload: {
          attackerAddress: result.attackerAddress,
          targetAddress: result.targetAddress,
          damage: result.cardType === 'attack' ? result.damage : result.heal,
          multiplier: result.multiplier,
          type: result.cardType,
          timestamp: Date.now(),
        },
      });
    }

    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'playCardResult',
      payload: {
        correct: result.correct,
        damage: result.damage,
        heal: result.heal,
        multiplier: result.multiplier,
        cardType: result.cardType,
      },
    });

    this.manager.network.broadcastScoreUpdate(room);

    setTimeout(() => {
      if (room.engine && room.engine.isActive()) {
        room.engine.resetCharacterStates();
      }
    }, 1000);
  }

  public stopBot(room: Room): void {
    const loop = this.botLoops.get(room.id);
    if (!loop) return;
    loop.stopped = true;
    for (const timer of loop.timers) clearTimeout(timer);
    loop.timers.clear();
    this.botLoops.delete(room.id);
  }

  private startBotIfNeeded(room: Room): void {
    if (room.roomType !== 'bot' || !room.botAddress || !room.engine) return;
    this.stopBot(room);

    const loop = { stopped: false, timers: new Set<ReturnType<typeof setTimeout>>() };
    this.botLoops.set(room.id, loop);

    const schedule = (delayMs: number, action: () => void | Promise<void>) => {
      if (loop.stopped) return;
      const timer = setTimeout(() => {
        loop.timers.delete(timer);
        if (loop.stopped) return;
        void Promise.resolve(action()).catch((err) => {
          console.error(`[BotMatch] Bot action failed in room ${room.id}:`, err);
          this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_NEXT_ACTION_MIN_MS, this.BOT_NEXT_ACTION_MAX_MS));
        });
      }, delayMs);
      loop.timers.add(timer);
    };

    this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_MIN_THINK_MS, this.BOT_MAX_THINK_MS), schedule);
  }

  private scheduleBotTurn(
    room: Room,
    loop: { stopped: boolean; timers: Set<ReturnType<typeof setTimeout>> },
    delayMs: number,
    scheduleOverride?: (delayMs: number, action: () => void | Promise<void>) => void,
  ): void {
    const schedule = scheduleOverride ?? ((delay: number, action: () => void | Promise<void>) => {
      if (loop.stopped) return;
      const timer = setTimeout(() => {
        loop.timers.delete(timer);
        if (loop.stopped) return;
        void Promise.resolve(action()).catch((err) => {
          console.error(`[BotMatch] Bot action failed in room ${room.id}:`, err);
          this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_NEXT_ACTION_MIN_MS, this.BOT_NEXT_ACTION_MAX_MS));
        });
      }, delay);
      loop.timers.add(timer);
    });

    schedule(delayMs, async () => {
      if (loop.stopped || room.status !== 'playing' || !room.engine?.isActive() || !room.botAddress) return;
      if (room.openedCards.has(room.botAddress)) {
        this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_NEXT_ACTION_MIN_MS, this.BOT_NEXT_ACTION_MAX_MS));
        return;
      }

      const card = this.chooseBotCard(room, room.botAddress);
      if (!card) {
        this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_NEXT_ACTION_MIN_MS, this.BOT_NEXT_ACTION_MAX_MS));
        return;
      }

      this.handleOpenCard(room, room.botAddress, card.id);
      const answerDelay = this.randomBetween(this.BOT_MIN_THINK_MS, this.BOT_MAX_THINK_MS);

      schedule(answerDelay, async () => {
        if (loop.stopped || room.status !== 'playing' || !room.engine?.isActive() || !room.botAddress) return;
        const selectedOptionId = this.chooseBotAnswer(room, room.botAddress, card);
        await this.handlePlayCard(room, room.botAddress, {
          cardId: card.id,
          selectedOptionId,
        });

        if (!loop.stopped && room.status === 'playing' && room.engine?.isActive()) {
          this.scheduleBotTurn(room, loop, this.randomBetween(this.BOT_NEXT_ACTION_MIN_MS, this.BOT_NEXT_ACTION_MAX_MS));
        }
      });
    });
  }

  private chooseBotCard(room: Room, botAddress: string): EngineCard | null {
    const hand = room.engine?.getServerHandForPlayer(botAddress) ?? [];
    if (hand.length === 0) return null;

    const health = room.engine?.getHealth()[botAddress] ?? GameEngine.STARTING_HEALTH;
    const healCards = hand.filter((card) => card.type === 'heal');
    const attackCards = hand.filter((card) => card.type === 'attack');

    if (healCards.length > 0 && health <= 72 && Math.random() < 0.7) {
      return this.randomItem(healCards);
    }
    if (healCards.length > 0 && health < GameEngine.STARTING_HEALTH && Math.random() < 0.28) {
      return this.randomItem(healCards);
    }
    if (attackCards.length > 0) {
      return this.randomItem(attackCards);
    }
    return this.randomItem(hand);
  }

  private chooseBotAnswer(room: Room, botAddress: string, card: EngineCard): string {
    const health = room.engine?.getHealth()[botAddress] ?? GameEngine.STARTING_HEALTH;
    const accuracy = card.type === 'heal' && health <= 55 ? this.BOT_LOW_HEALTH_ACCURACY : this.BOT_BASE_ACCURACY;
    if (Math.random() < accuracy) {
      return card.correctOptionId;
    }

    const wrongOptions = card.question.options.filter((option) => option.id !== card.correctOptionId);
    return this.randomItem(wrongOptions)?.id ?? card.correctOptionId;
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  private randomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private sendOpenCardAccepted(room: Room, address: string, cardId: string, remainingMs: number): void {
    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'openCardAccepted',
      payload: { cardId, remainingMs },
    });
  }

  private sendCountdown(room: Room, address: string, cardId: string, remainingMs: number): void {
    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'cardCountdown',
      payload: { cardId, remainingMs },
    });
  }

  private sendCardExpired(
    room: Room,
    address: string,
    cardId: string,
    reason: 'timeout' | 'rejected' = 'timeout',
  ): void {
    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'cardExpired',
      payload: { cardId, reason },
    });
  }

  private rejectCardAction(
    room: Room,
    address: string,
    rejection: Omit<CardActionRejectedData, 'message'>,
  ): void {
    const payload: CardActionRejectedData = {
      ...rejection,
      message: this.getCardActionRejectedMessage(rejection.reason),
    };
    const client = room.clients.get(address);
    this.manager.network.safeSend(client?.ws, {
      type: 'cardActionRejected',
      payload,
    });

    if (rejection.cardId) {
      this.sendCardExpired(room, address, rejection.cardId, 'rejected');
    }
  }

  private getCardActionRejectedMessage(reason: CardActionRejectedReason): string {
    switch (reason) {
      case 'game_not_active':
        return 'This battle is not accepting card actions right now.';
      case 'invalid_payload':
        return 'Card action was incomplete. Please try again.';
      case 'not_in_hand':
        return 'Card sync was lost. Please reopen a card.';
      case 'already_open':
        return 'Another card is already open.';
      case 'not_opened':
        return 'Card was not open on the server. Please reopen it.';
      case 'different_card_open':
        return 'A different card is open on the server. Please resync and try again.';
      default:
        return 'Card action was rejected. Please try again.';
    }
  }

  private getRemainingAnswerMs(openedAt: number): number {
    return Math.max(0, this.CARD_ANSWER_TIMEOUT_MS - (Date.now() - openedAt));
  }

  private isCardInHand(room: Room, address: string, cardId: string): boolean {
    return room.engine?.getServerHandForPlayer(address).some((card) => card.id === cardId) ?? false;
  }
}
