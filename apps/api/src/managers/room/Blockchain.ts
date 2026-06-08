import { serverPublicKey, signSettlementAuthorization, submitRefundTransaction, submitSettlementTransaction, getServerKeypair } from '../../utils/settlement';
import {
  magicBlockService,
  packCardManifest,
  estimateErSetupRentLamports,
  EFFECT_ATTACK,
  EFFECT_HEAL,
  END_REASON_SINGLE_PLAYER_TIMEOUT,
  END_REASON_BOTH_PLAYERS_TIMEOUT,
  END_REASON_SERVER_CANCELLED,
  END_REASON_SURRENDER,
  getBaseLamportBalance,
  type BattleSessionState,
} from '../../services/magicblock';
import { getWagerUsdValue } from '../../services/goldrush';
import { deriveQuestionHash } from '../../utils/questionHash';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';
import type { MatchResult, WsMessage } from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';

const GAMEPLAY_MAX_ATTACK_EFFECT_VALUE = GameEngine.MAX_DAMAGE;
const GAMEPLAY_MAX_HEAL_EFFECT_VALUE = GameEngine.MAX_HEAL;
const DEPLOYED_MAX_EFFECT_VALUE = Number(process.env.CORA_BATTLE_MAX_EFFECT_VALUE ?? 100);
const REGISTERED_MAX_ATTACK_EFFECT_VALUE = Math.min(GAMEPLAY_MAX_ATTACK_EFFECT_VALUE, DEPLOYED_MAX_EFFECT_VALUE);
const REGISTERED_MAX_HEAL_EFFECT_VALUE = Math.min(GAMEPLAY_MAX_HEAL_EFFECT_VALUE, DEPLOYED_MAX_EFFECT_VALUE);

/**
 * Maximum cards per player to pre-commit in the inline manifest.
 * Must be <= 128 (MAX_CARD_SLOTS on-chain).
 */
const MAX_ER_MANIFEST_CARD_SLOTS = 128;
const DEFAULT_ER_MANIFEST_CARD_LIMIT = MAX_ER_MANIFEST_CARD_SLOTS;
const configuredErManifestCardLimit = Number(
  process.env.CORA_BATTLE_PRE_REGISTER_CARD_LIMIT ?? DEFAULT_ER_MANIFEST_CARD_LIMIT,
);
const ER_MANIFEST_CARD_LIMIT = Math.max(
  GameEngine.HAND_SIZE,
  Math.min(
    MAX_ER_MANIFEST_CARD_SLOTS,
    Number.isFinite(configuredErManifestCardLimit)
      ? Math.floor(configuredErManifestCardLimit)
      : DEFAULT_ER_MANIFEST_CARD_LIMIT,
  ),
);

const ER_SETUP_FEE_CUSHION_LAMPORTS = Math.max(
  500_000,
  Number(process.env.CORA_BATTLE_SETUP_FEE_CUSHION_LAMPORTS ?? 1_500_000),
);

export type SettlementResult =
  | { ok: true; signature?: string }
  | { ok: false; error: unknown };

export class Blockchain {
  constructor(private manager: RoomManager) {}

  /**
   * Fetches the USD value of the wager and updates the room state.
   */
  public async fetchWagerUsd(room: Room): Promise<void> {
    if (!room.tokenMint || !room.wagerAmount) return;

    try {
      const usd = await getWagerUsdValue(room.tokenMint, room.wagerAmount);
      if (usd && this.manager.store.getRoom(room.id)) {
        room.wagerUsdValue = usd;
        this.manager.network.broadcastGameState(room);
      }
    } catch (e) {
      console.error('[RoomBlockchain] Failed to fetch wager USD value:', e);
    }
  }

  /**
   * Full ER setup pipeline using inline manifest (v5).
   *
   * Flow (5 tx, ~9-15s):
   *   Phase 1: createSession                   → 1 tx (base)
   *   Phase 2: setCardManifest(isPlayerA=true)  → 1 tx (base)
   *   Phase 3: setCardManifest(isPlayerA=false) → 1 tx (base)
   *   Phase 4: activateSession                  → 1 tx (base)
   *   Phase 5: delegateBattleSession            → 1 tx (base)
   *
   * Previously this was 99+ tx with registerCardV2 and delegateRegisteredCard loops.
   * On any error, erEnabled is flipped to false and the match continues engine-only.
   */
  public async createBattleSession(room: Room): Promise<void> {
    if (!room.erEnabled) {
      console.log(`[MagicBlock] ER disabled for room ${room.id} — running engine-only`);
      return;
    }
    if (DEPLOYED_MAX_EFFECT_VALUE < GAMEPLAY_MAX_ATTACK_EFFECT_VALUE) {
      console.warn(
        `[MagicBlock] ER compatibility mode for room ${room.id} — deployed cora-battle MAX_EFFECT_VALUE=${DEPLOYED_MAX_EFFECT_VALUE}. ` +
        `Attack effects above ${REGISTERED_MAX_ATTACK_EFFECT_VALUE} will be capped until web3 deploys MAX_EFFECT_VALUE=${GAMEPLAY_MAX_ATTACK_EFFECT_VALUE}.`,
      );
    }
    if (!room.playerA || !room.playerB) return;
    if (!room.engine) return;

    const keypair = getServerKeypair();
    const setupTxs: string[] = [];

    // Inline manifest: only need session account rent, no card accounts
    const [availableLamports, rentEstimate] = await Promise.all([
      getBaseLamportBalance(keypair.publicKey),
      estimateErSetupRentLamports(0), // no registered cards needed
    ]);
    const recommendedLamports = rentEstimate.sessionRentLamports + ER_SETUP_FEE_CUSHION_LAMPORTS;

    if (availableLamports < recommendedLamports) {
      console.warn(
        `[MagicBlock] ER disabled for room ${room.id} — insufficient server SOL for setup. ` +
        `Available=${availableLamports} lamports, recommended_min=${recommendedLamports}. ` +
        `Top up ${keypair.publicKey.toBase58()} on devnet.`,
      );
      room.erEnabled = false;
      room.erLifecycleStatus = 'failed';
      room.engine?.setExternalAuthority(false);
      return;
    }

    try {
      // ── Phase 1: Create Session ──────────────────────────────────
      room.erLifecycleStatus = 'creating';
      const questionHash = deriveQuestionHash(room.engine.getQuestions());

      const { sessionPda, signature: createSig } = await magicBlockService.createSession({
        roomId: room.id,
        playerA: room.playerA,
        playerB: room.playerB,
        questionHash,
        serverKeypair: keypair,
      });
      room.erSessionPda = sessionPda;
      setupTxs.push(createSig);
      console.log(`[MagicBlock] Phase 1/5 done — session created: ${sessionPda}`);

      // ── Phase 2+3: Commit inline manifests ────────────────────────
      room.erLifecycleStatus = 'registering';
      const queue = room.engine.getMatchQueue().slice(0, ER_MANIFEST_CARD_LIMIT);
      const cardDefs = queue.map(card => ({
        effectType: card.type === 'attack' ? EFFECT_ATTACK : EFFECT_HEAL,
        maxValue: card.type === 'attack' ? REGISTERED_MAX_ATTACK_EFFECT_VALUE : REGISTERED_MAX_HEAL_EFFECT_VALUE,
      }));
      const manifest = packCardManifest(cardDefs);

      console.log(
        `[MagicBlock] Committing inline manifest for room ${room.id}: ` +
        `${queue.length} slots per player.`,
      );

      // Commit manifests in parallel for both players
      const [manifestASig, manifestBSig] = await Promise.all([
        magicBlockService.setCardManifest({
          roomId: room.id,
          sessionPda,
          isPlayerA: true,
          totalSlots: queue.length,
          manifest,
          serverKeypair: keypair,
        }),
        magicBlockService.setCardManifest({
          roomId: room.id,
          sessionPda,
          isPlayerA: false,
          totalSlots: queue.length,
          manifest,
          serverKeypair: keypair,
        }),
      ]);
      setupTxs.push(manifestASig, manifestBSig);
      console.log(`[MagicBlock] Phase 2+3/5 done — both manifests committed`);

      // ── Phase 4: Activate session ────────────────────────────────
      room.erLifecycleStatus = 'activating';
      const activateSig = await magicBlockService.activateSession({
        roomId: room.id,
        sessionPda,
        serverKeypair: keypair,
      });
      setupTxs.push(activateSig);
      console.log(`[MagicBlock] Phase 4/5 done — session activated`);

      // ── Phase 5: Delegate session PDA ────────────────────────────
      room.erLifecycleStatus = 'delegating';
      const delegateSessionSig = await magicBlockService.delegateBattleSession({
        roomId: room.id,
        sessionPda,
        serverKeypair: keypair,
      });
      setupTxs.push(delegateSessionSig);
      console.log(`[MagicBlock] Phase 5/5 done — session delegated`);

      // ── Done ─────────────────────────────────────────────────────
      room.erLifecycleStatus = 'active';
      room.erProofMeta = {
        sessionPda,
        setupTxSignatures: setupTxs,
        terminalTxSignatures: [],
        status: 'Active',
        winner: null,
        endReason: null,
      };

      console.log(`[MagicBlock] ER setup complete for room ${room.id}. Session: ${sessionPda}. Manifest slots: ${queue.length}. Txs: ${setupTxs.length}`);

    } catch (err) {
      console.warn(`[MagicBlock] ER setup failed for room ${room.id}, falling back to engine-only:`, err);
      room.erEnabled = false;
      room.erLifecycleStatus = 'failed';
      room.engine?.setExternalAuthority(false);
    }
  }

  /**
   * Apply an inline manifest effect on the ER.
   *
   * Every card consumption (correct, wrong, or timeout) must call this to keep
   * the slot counter in sync with the engine queue.
   */
  public async applyErCardEffect(
    room: Room,
    params: { owner: string; cardId: string; finalValue: number; scoreDelta: number },
  ): Promise<BattleSessionState | null> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return null;

    const actorIsA = params.owner === room.playerA;
    // Look up the exact slot index for this card from the queue
    const slot = room.engine.getMatchQueue().findIndex(c => c.id === params.cardId);
    
    if (slot === -1) {
      console.error(`[MagicBlock] Could not find card ${params.cardId} in match queue for room ${room.id}`);
      return null;
    }

    const finalValue = Math.min(params.finalValue, DEPLOYED_MAX_EFFECT_VALUE);
    const scoreDelta = Math.min(params.scoreDelta, finalValue * 100); // MAX_SCORE_MULTIPLIER = 100

    if (finalValue !== params.finalValue || scoreDelta !== params.scoreDelta) {
      console.warn(
        `[MagicBlock] Capping ER effect for room ${room.id}: requested finalValue=${params.finalValue}, ` +
        `scoreDelta=${params.scoreDelta}, slot=${slot}.`,
      );
    }

    await magicBlockService.applyEffect({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      slot,
      actorIsA,
      finalValue,
      scoreDelta,
      serverKeypair: getServerKeypair(),
    });

    return this.syncErState(room);
  }

  /**
   * Consume a slot on-chain for a wrong answer or timeout — no HP effect.
   */
  public async consumeErSlotEmpty(
    room: Room,
    owner: string,
    cardId: string,
  ): Promise<BattleSessionState | null> {
    return this.applyErCardEffect(room, {
      owner,
      cardId,
      finalValue: 0,
      scoreDelta: 0,
    });
  }

  /**
   * Surrender the ER match. Calls surrender_match instruction which immediately
   * sets status=Finished and winner=opponent on-chain.
   */
  public async surrenderErMatch(room: Room, surrenderingPlayer: string): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda) return;

    await magicBlockService.surrenderMatch({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      surrenderingPlayer,
      serverKeypair: getServerKeypair(),
    });

    const erState = await this.syncErState(room);
    await this.finalizeTerminalErSession(room, erState);
  }

  public async syncErState(room: Room): Promise<BattleSessionState | null> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return null;

    const erState = await magicBlockService.getSessionState(room.erSessionPda);
    room.engine.applyAuthoritativeState(erState);
    if (room.erProofMeta) {
      room.erProofMeta.status = erState.status;
      room.erProofMeta.winner = erState.winner;
      room.erProofMeta.endReason = erState.endReason;
    }
    return erState;
  }

  public async resolveRoundDeadline(room: Room): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return;

    const keypair = getServerKeypair();
    const playerAConnected = Boolean(room.playerA && room.clients.get(room.playerA)?.ws);
    const playerBConnected = Boolean(room.playerB && (room.playerB === room.botAddress || room.clients.get(room.playerB)?.ws));

    if (playerAConnected && playerBConnected) {
      await magicBlockService.resolveRoundByState({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        serverKeypair: keypair,
      });
    } else if (!playerAConnected && !playerBConnected) {
      await magicBlockService.cancelSession({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        reason: END_REASON_BOTH_PLAYERS_TIMEOUT,
        serverKeypair: keypair,
      });
    } else {
      const timedOutPlayer = playerAConnected ? room.playerB : room.playerA;
      if (!timedOutPlayer) return;
      await magicBlockService.timeoutPlayerForRound({
        roomId: room.id,
        sessionPda: room.erSessionPda,
        timedOutPlayer,
        serverKeypair: keypair,
      });
    }

    const erState = await this.syncErState(room);
    if (erState) {
      await this.finalizeTerminalErSession(room, erState);
    }
  }

  public async cancelErSession(room: Room, reason: number = END_REASON_SERVER_CANCELLED): Promise<void> {
    if (!room.erEnabled || !room.erSessionPda) return;

    await magicBlockService.cancelSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      reason,
      serverKeypair: getServerKeypair(),
    });
    const erState = await this.syncErState(room);
    if (erState) {
      await this.finalizeTerminalErSession(room, erState);
    }
  }

  public async handleErFatalError(room: Room, context: string, error: unknown): Promise<void> {
    console.error(`[MagicBlock] Fatal ER failure in room ${room.id} during ${context}:`, error);

    if (
      room.erLifecycleStatus === 'delegating' ||
      room.erLifecycleStatus === 'active' ||
      room.erLifecycleStatus === 'committing'
    ) {
      console.warn(
        `[MagicBlock] Skipping cancelSession for delegated ER room ${room.id}; ` +
        `falling back to local server_error finalization because cancelSession is not compatible with delegated ownership.`,
      );
      this.forceLocalErFailure(room);
      return;
    }

    try {
      await this.cancelErSession(room);
      return;
    } catch (cancelError) {
      console.error(`[MagicBlock] ER cancel failed for room ${room.id}; forcing local server_error fallback:`, cancelError);
    }

    this.forceLocalErFailure(room);
  }

  /**
   * Finalize a terminal ER session: commit + undelegate session only.
   *
   * With inline manifest, there are no RegisteredCard accounts to commit/undelegate.
   * Settlement flow: commitBattleSession → undelegateBattleSession (2 tx, ~4s).
   */
  public async finalizeTerminalErSession(room: Room, state?: BattleSessionState | null): Promise<boolean> {
    if (!room.erEnabled || !room.erSessionPda || !room.engine) return false;
    if (room.erLifecycleStatus === 'committing' || room.erLifecycleStatus === 'finished') return true;

    const erState = state ?? await this.syncErState(room);
    if (!erState || (erState.status !== 'Finished' && erState.status !== 'Cancelled')) return false;

    room.erLifecycleStatus = 'committing';
    room.status = 'settling';
    this.manager.engine.stopBot(room);
    this.manager.lifecycle.clearAllOpenedCards(room);
    this.manager.network.broadcastGameState(room);

    const keypair = getServerKeypair();
    const terminalTxs: string[] = [];

    // No more card commit/undelegate loops — inline manifest means session only.
    terminalTxs.push(await magicBlockService.commitBattleSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      serverKeypair: keypair,
    }));

    terminalTxs.push(await magicBlockService.undelegateBattleSession({
      roomId: room.id,
      sessionPda: room.erSessionPda,
      serverKeypair: keypair,
    }));

    const finalState = await magicBlockService.getSessionState(room.erSessionPda);
    room.engine.applyAuthoritativeState(finalState);
    room.erLifecycleStatus = 'finished';
    if (room.erProofMeta) {
      room.erProofMeta.terminalTxSignatures.push(...terminalTxs);
      room.erProofMeta.status = finalState.status;
      room.erProofMeta.winner = finalState.winner;
      room.erProofMeta.endReason = finalState.endReason;
    }

    this.dispatchErMatchResult(room, finalState);
    room.status = 'finished';
    this.manager.network.broadcastGameState(room);

    setTimeout(() => {
      this.manager.lifecycle.destroyRoom(room.id);
    }, 15_000);

    return true;
  }

  /**
   * Broadcasts settlement-signed match result to all connected clients and submits to oracle.
   */
  public async settleMatch(room: Room, winnerAddress: string): Promise<SettlementResult> {
    // Verify winner against ER if available (ER is source of truth)
    if (room.erSessionPda) {
      try {
        const erState = await magicBlockService.getSessionState(room.erSessionPda);
        if (erState.status === 'Finished' && erState.winner && erState.winner !== winnerAddress) {
          console.error(`[INTEGRITY] ER winner mismatch! ER=${erState.winner} Engine=${winnerAddress}`);
          winnerAddress = erState.winner;
        }
      } catch (err) {
        console.warn('[MagicBlock] Could not verify ER state:', err);
      }
    }

    // Normal match outcome: action = 0
    const action = 0;
    const settlementSignature = signSettlementAuthorization(
      action,
      room.matchIdBytes,
      winnerAddress,
    );

    let transactionSignature: string | undefined;
    try {
      transactionSignature = await submitSettlementTransaction(action, room.matchIdBytes, winnerAddress);
      console.log(`[RoomBlockchain] On-chain settlement completed. Tx: ${transactionSignature}`);
      if (room.queueMatchPersisted) {
        await this.manager.queueMatches.markCompleted(room.id, winnerAddress);
      }
    } catch (err) {
      console.error(`[RoomBlockchain] Auto-settlement failed:`, err);
      if (room.queueMatchPersisted) {
        await this.manager.queueMatches.markSettlementFailed(room.id, winnerAddress, err);
      }
      return { ok: false, error: err };
    }

    for (const client of room.clients.values()) {
      this.manager.network.safeSend(client.ws, {
        type: 'settlementAuthorization',
        payload: {
          winner: winnerAddress,
          matchId: Buffer.from(room.matchIdBytes).toString('hex'),
          settlementSignature,
          serverPublicKey,
        }
      } as WsMessage);
    }

    return { ok: true, signature: transactionSignature };
  }

  /**
   * Settles an anti-cheat invalidated match on-chain.
   */
  public settleAntiCheat(room: Room, cheaterAddress: string): void {
    // Anti-cheat penalty outcome: action = 1
    const action = 1;

    // We only need to tell the contract who the cheater is. The contract will refund the honest player 
    // and send the cheater's funds to the treasury.
    submitSettlementTransaction(action, room.matchIdBytes, cheaterAddress)
      .then(tx => console.log(`[RoomBlockchain] Anti-Cheat penalty on-chain settlement completed. Tx: ${tx}`))
      .catch(err => console.error(`[RoomBlockchain] Anti-Cheat Auto-settlement failed:`, err));
  }

  /**
   * Refunds both players. This should only be used for draws and server errors.
   */
  public refundMatch(room: Room, reason: 'draw' | 'server_error'): void {
    submitRefundTransaction(room.matchIdBytes)
      .then(tx => console.log(`[RoomBlockchain] Refund completed for ${reason}. Tx: ${tx}`))
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('TimeoutNotReached')) {
          console.warn(
            `[RoomBlockchain] Refund for ${reason} is timeout-gated on-chain and cannot be executed yet. ` +
            `Match UI/result has been finalized locally.`,
          );
          return;
        }
        console.error(`[RoomBlockchain] Refund failed for ${reason}:`, err);
      });
  }

  private dispatchErMatchResult(room: Room, finalState: BattleSessionState): void {
    const engine = room.engine;
    if (!engine) return;

    const finalScores = {
      [finalState.playerA]: finalState.gameScoreA,
      [finalState.playerB]: finalState.gameScoreB,
    };
    const finalHealth = {
      [finalState.playerA]: finalState.healthA,
      [finalState.playerB]: finalState.healthB,
    };
    const finalRoundsWon = {
      [finalState.playerA]: finalState.scoreA,
      [finalState.playerB]: finalState.scoreB,
    };
    const finalCorrectAnswers = engine.getCorrectAnswers();
    const verdicts = engine.getAntiCheatVerdicts();
    const antiCheatWarning = Object.values(verdicts).some(
      verdict => verdict.verdict === 'suspicious' || verdict.verdict === 'rejected',
    );
    const erProof = this.buildErProofPayload(room);
    const isBotMatch = room.roomType === 'bot';

    if (finalState.status === 'Finished' && finalState.winner) {
      const reason = finalState.endReason === END_REASON_SINGLE_PLAYER_TIMEOUT
        ? 'time_up'
        : finalState.endReason === END_REASON_SURRENDER
          ? 'surrender'
          : 'hp_zero';

      if (isBotMatch) {
        console.log(`[BotMatch] ER result finalized for ${room.id}; skipping escrow settlement.`);
      } else {
        void this.settleMatch(room, finalState.winner).then((result) => {
          if (!result.ok) {
            console.error(`[RoomBlockchain] Settlement failed for ER room ${room.id}`);
          }
        });
      }
      this.manager.network.broadcastToRoom(room, {
        type: 'matchResult',
        payload: {
          winnerAddress: finalState.winner,
          reason,
          surrenderedAddress: finalState.endReason === END_REASON_SURRENDER
            ? (finalState.winner === finalState.playerA ? finalState.playerB : finalState.playerA)
            : undefined,
          finalScores,
          finalHealth,
          finalRoundsWon,
          finalCorrectAnswers,
          antiCheatWarning: isBotMatch ? false : antiCheatWarning,
          isBotMatch,
          erProof,
        } satisfies MatchResult,
      });
      return;
    }

    const refundReason = finalState.endReason === END_REASON_SERVER_CANCELLED ? 'server_error' : 'draw';
    if (isBotMatch) {
      console.log(`[BotMatch] ER result finalized for ${room.id}; skipping escrow refund.`);
    } else {
      this.refundMatch(room, refundReason);
    }
    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: {
        winnerAddress: null,
        reason: refundReason === 'server_error' ? 'server_error' : 'draw',
        finalScores,
        finalHealth,
        finalRoundsWon,
        finalCorrectAnswers,
        antiCheatWarning: isBotMatch ? false : antiCheatWarning,
        isBotMatch,
        erProof,
      } satisfies MatchResult,
    });
  }

  private buildErProofPayload(room: Room): MatchResult['erProof'] {
    if (!room.erProofMeta) return undefined;

    return {
      erSessionPda: room.erProofMeta.sessionPda,
      explorerUrl: `https://explorer.solana.com/address/${room.erProofMeta.sessionPda}?cluster=devnet`,
      erEnabled: room.erEnabled,
      status: room.erProofMeta.status,
      winner: room.erProofMeta.winner,
      endReason: room.erProofMeta.endReason,
      setupTxSignatures: room.erProofMeta.setupTxSignatures,
      terminalTxSignatures: room.erProofMeta.terminalTxSignatures,
    };
  }

  private forceLocalErFailure(room: Room): void {
    if (room.status === 'finished') return;

    room.erEnabled = false;
    room.erLifecycleStatus = 'failed';
    if (room.erProofMeta) {
      room.erProofMeta.status = 'Cancelled';
      room.erProofMeta.endReason = END_REASON_SERVER_CANCELLED;
    }

    const engine = room.engine;
    const result: MatchResult = {
      winnerAddress: null,
      reason: 'server_error',
      finalScores: engine?.getScores() ?? {},
      finalHealth: engine?.getHealth() ?? {},
      finalRoundsWon: engine?.getRoundsWon() ?? {},
      finalCorrectAnswers: engine?.getCorrectAnswers() ?? {},
      isBotMatch: room.roomType === 'bot',
      erProof: this.buildErProofPayload(room),
    };

    engine?.setExternalAuthority(false);
    this.manager.engine.stopBot(room);
    this.manager.lifecycle.clearAllOpenedCards(room);
    engine?.stop();

    room.status = 'finished';
    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: result,
    });
    this.manager.network.broadcastGameState(room);

    setTimeout(() => {
      this.manager.lifecycle.destroyRoom(room.id);
    }, 15_000);
  }
}
