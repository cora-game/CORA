import type { WsMessage, MatchResult } from '@shared/websocket';
import { deriveMatchId } from '@shared/escrow';
import type { Room, RoomSocket } from './types';
import type { RoomManager } from '../RoomManager';
import { submitSettlementTransaction } from '../../utils/settlement';

export class Lifecycle {
  private DEPOSIT_TIMEOUT_MS = 30_000;
  private startingRooms = new Set<string>();

  constructor(private manager: RoomManager) {}

  public createPrivateRoom(playerAPubkey: string, tokenMint: string, wagerAmount: bigint): string {
    const roomId = `private-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const room = this.manager.store.createRoom(roomId);
    
    room.status = 'depositing';
    room.playerMeta.set(playerAPubkey, { hasDeposited: false, characterId: 'einstein' });
    room.roomType = 'private';
    room.playerA = playerAPubkey;
    room.tokenMint = tokenMint;
    room.wagerAmount = wagerAmount;
    this.manager.store.trackPlayer(playerAPubkey, roomId);

    console.log(`[Private] Room ${roomId} created for Player A: ${playerAPubkey}`);
    this.armDepositTimeout(room, playerAPubkey);

    this.manager.blockchain.fetchWagerUsd(room);

    return roomId;
  }

  public joinPrivateRoom(playerBPubkey: string, roomId: string): 'ok' | 'not_found' | 'full' | 'cancelled' {
    const room = this.manager.store.getRoom(roomId);
    if (!room || room.roomType !== 'private') return 'not_found';
    if (room.status !== 'depositing') return 'cancelled';
    if (room.playerB !== null) return 'full';
    if (room.playerA === playerBPubkey) return 'full';

    room.playerB = playerBPubkey;
    room.playerMeta.set(playerBPubkey, { hasDeposited: false, characterId: 'einstein' });
    this.manager.store.trackPlayer(playerBPubkey, roomId);
    console.log(`[Private] Player B ${playerBPubkey} joined room ${roomId}`);
    return 'ok';
  }

  public joinRoom(roomId: string, address: string, ws: RoomSocket, characterId: string = 'einstein') {
    const room = this.manager.store.getRoom(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found for join.`);
      ws.close(1008, 'Room not found or already finished');
      return;
    }

    if (room.status === 'finished') {
      console.warn(`Room ${roomId} already finished for join.`);
      ws.close(1008, 'Room already finished');
      return;
    }

    const client = room.clients.get(address);

    if (client) {
      console.log(`Player ${address} reconnected to room ${roomId}`);
      const previousWs = client.ws;
      client.ws = ws;
      client.lastSeenAt = Date.now();
      if (previousWs && previousWs !== ws) {
        try {
          previousWs.close(1000, 'Replaced by newer connection');
        } catch (e) {
          console.warn(`Failed to close previous socket for ${address} in room ${roomId}:`, e);
        }
      }
      const meta = room.playerMeta.get(address);
      if (meta) meta.characterId = characterId;
    } else {
      if (room.clients.size >= 2) {
        console.warn(`Room ${roomId} is full.`);
        ws.close(1008, 'Room is full');
        return;
      }

      console.log(`Player ${address} joined room ${roomId} as ${characterId}`);
      room.clients.set(address, {
        ws,
        lastSeenAt: Date.now(),
      });

      // Preserve hasDeposited if already true (hydrated private Blink room).
      // hydrateBlinkRoomInternal sets both players to hasDeposited: true after
      // accept_challenge locks both wagers on-chain. Overwriting to false here
      // would prevent the room from ever transitioning to playing.
      const existingMeta = room.playerMeta.get(address);
      room.playerMeta.set(address, {
        hasDeposited: existingMeta?.hasDeposited ?? false,
        characterId,
        depositSignature: existingMeta?.depositSignature,
      });
    }

    if (room.status === 'waiting' && room.clients.size === 2) {
      room.status = 'depositing';
      console.log(`Room ${roomId} has 2 players. Transitioning to depositing!`);
    }

    if (room.status === 'depositing' && room.playerA && room.playerB) {
      const metaA = room.playerMeta.get(room.playerA);
      const metaB = room.playerMeta.get(room.playerB);
      if ((metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false) && this.hasRequiredPlayerConnections(room)) {
        for (const t of room.depositTimeouts.values()) clearTimeout(t);
        room.depositTimeouts.clear();
        console.log(`Room ${roomId}: Late join triggered game start — both already deposited!`);
        this.markPublicQueueActive(room);
        this.startGameWhenReady(room);
        return;
      }
    }

    this.manager.network.broadcastGameState(room);
    this.manager.network.broadcastPresence(room);

    if (room.status === 'depositing' && address === room.playerB && room.playerBUnlocked) {
      const meta = room.playerMeta.get(address);
      if (!meta?.hasDeposited) {
        this.manager.network.safeSend(ws, {
          type: 'depositUnlocked',
          payload: { roomId: room.id },
        } satisfies WsMessage);
      }
    }
  }

  public leaveRoom(roomId: string, address: string, ws?: RoomSocket) {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    const client = room.clients.get(address);
    if (!client) return;
    if (!client.ws) return;

    if (ws && client.ws !== ws) {
      console.log(`Ignoring stale disconnect for player ${address} in room ${roomId}`);
      return;
    }

    client.ws = null;
    client.lastSeenAt = Date.now();

    if (room.status === 'playing') {
      console.log(`Player ${address} disconnected from active room ${roomId}. Presence updated; match remains open.`);
      this.manager.network.broadcastPresence(room);
      this.manager.network.broadcastGameState(room);
    } else if (room.status === 'depositing') {
      const metaA = room.playerA ? room.playerMeta.get(room.playerA) : null;
      const metaB = room.playerB ? room.playerMeta.get(room.playerB) : null;
      const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);

      if (allDeposited) {
        console.log(`Player ${address} disconnected from funded room ${roomId}. Presence updated; waiting for reconnect or surrender.`);
        this.manager.network.broadcastPresence(room);
        this.manager.network.broadcastGameState(room);
        return;
      }

      const opponentAddress = address === room.playerA ? room.playerB : room.playerA;
      console.log(`Player ${address} disconnected during depositing in room ${roomId}. Cancelling room immediately.`);
      void this.cancelRoom(roomId, opponentAddress ?? undefined, { reason: 'disconnect', cancelledBy: address }).catch((err) => {
        console.error(`[Lifecycle] Failed to cancel disconnected room ${roomId}:`, err);
      });
    }
  }

  public cancelDuringDeposit(roomId: string, cancelledBy: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    if (room.status !== 'depositing') return;
    if (cancelledBy !== room.playerA && cancelledBy !== room.playerB) return;

    console.log(`[Cancel] ${cancelledBy} cancelled deposit room ${roomId}.`);
    void this.cancelRoom(roomId, null, { reason: 'player_cancelled', cancelledBy }).catch((err) => {
      console.error(`[Lifecycle] Failed to cancel room ${roomId}:`, err);
    });
  }

  public handleDeposit(room: Room, address: string, signature: string) {
    console.log(`Player ${address} confirmed deposit with signature ${signature} in room ${room.id}`);

    if (
      room.roomType === 'private' &&
      address === room.playerA &&
      room.blinkJoinDeadline &&
      Date.now() > room.blinkJoinDeadline
    ) {
      console.log(`[Blink] Creator deposit missed join deadline in room ${room.id}. Forfeiting.`);
      void this.manager.blinkMatches.forfeitChallenged(room.id)
        .then(async (forfeitedMatch) => {
          // Trigger on-chain settlement awarding the challenger
          if (forfeitedMatch?.opponentWallet) {
            const matchIdBytes = deriveMatchId(room.id);
            try {
              await submitSettlementTransaction(0, matchIdBytes, forfeitedMatch.opponentWallet);
              await this.manager.blinkMatches.markCompleted(room.id);
              console.log(`[Blink] FORFEITED room ${room.id} settled on-chain. Challenger ${forfeitedMatch.opponentWallet} awarded. DB marked COMPLETED.`);
            } catch (settlementErr) {
              // Keep DB as FORFEITED — do NOT mark COMPLETED
              console.error(
                `[Blink] Settlement FAILED for FORFEITED room ${room.id}. ` +
                `Challenger: ${forfeitedMatch.opponentWallet}. DB remains FORFEITED.`,
                settlementErr,
              );
            }
          }
        })
        .catch((err) => {
          console.error(`[Blink] Failed to mark room ${room.id} forfeited:`, err);
        });
      void this.cancelRoom(room.id, room.playerB ?? undefined, {
        reason: 'deposit_timeout',
        cancelledBy: address,
      }).catch((err) => {
        console.error(`[Lifecycle] Failed to cancel forfeited Blink room ${room.id}:`, err);
      });
      return;
    }

    const timer = room.depositTimeouts.get(address);
    if (timer) {
      clearTimeout(timer);
      room.depositTimeouts.delete(address);
    }

    const existing = room.playerMeta.get(address);
    room.playerMeta.set(address, {
      hasDeposited: true,
      characterId: existing?.characterId ?? 'einstein',
      depositSignature: signature,
    });

    if (room.queueMatchPersisted && room.tokenMint && room.wagerAmount) {
      void this.manager.queueMatches.updateTokenInfo(room.id, room.tokenMint, room.wagerAmount).catch((err) => {
        console.error(`[Lifecycle] Failed to update queue token info ${room.id}:`, err);
      });
    }

    // True flow: for private rooms, both wagers are already locked on-chain
    // after accept_challenge. Creator's deposit confirmation via WebSocket
    // just means they've connected. Mark the match as ACTIVE in DB.
    if (room.roomType === 'private' && address === room.playerA) {
      void this.manager.blinkMatches.markActive(room.id, address, signature).then((match) => {
        if (match?.status === 'FORFEITED') {
          void this.cancelRoom(room.id, room.playerB ?? undefined, {
            reason: 'deposit_timeout',
            cancelledBy: address,
          }).catch((err) => {
            console.error(`[Lifecycle] Failed to cancel forfeited private room ${room.id}:`, err);
          });
        }
      }).catch((err) => {
        console.error(`[Blink] Failed to mark private room ${room.id} active:`, err);
      });
    }

    const isPlayerA = address === room.playerA;

    if (isPlayerA && !room.playerBUnlocked && room.playerB) {
      room.playerBUnlocked = true;
      const playerBMeta = room.playerMeta.get(room.playerB);
      const playerBAlreadyDeposited = playerBMeta?.hasDeposited ?? false;

      if (!playerBAlreadyDeposited) {
        const playerBClient = room.clients.get(room.playerB);
        this.manager.network.safeSend(playerBClient?.ws, {
          type: 'depositUnlocked',
          payload: { roomId: room.id },
        } satisfies WsMessage);
        this.armDepositTimeout(room, room.playerB);
      }
      console.log(`Room ${room.id}: Player A deposited. Player B unlocked.`);
    }

    if (!room.playerA || !room.playerB) return;
    const metaA = room.playerMeta.get(room.playerA);
    const metaB = room.playerMeta.get(room.playerB);
    const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);

    if (allDeposited && room.status === 'depositing') {
      for (const t of room.depositTimeouts.values()) clearTimeout(t);
      room.depositTimeouts.clear();

      if (!this.hasRequiredPlayerConnections(room)) {
        console.log(`Room ${room.id}: Both deposited but not all sockets are connected. Waiting for reconnect.`);
        this.manager.network.broadcastGameState(room);
        this.manager.network.broadcastPresence(room);
        return;
      }

      this.markPublicQueueActive(room);
      console.log(`Room ${room.id} both players deposited. Initializing game engine!`);
      this.startGameWhenReady(room);
    }
  }

  private markPublicQueueActive(room: Room): void {
    if (!room.queueMatchPersisted || !room.playerA || !room.playerB) return;

    const sigA = room.playerMeta.get(room.playerA)?.depositSignature ?? '';
    const sigB = room.playerMeta.get(room.playerB)?.depositSignature ?? '';
    void this.manager.queueMatches.markActive(room.id, sigA, sigB).catch((err) => {
      console.error(`[Lifecycle] Failed to mark queue match active ${room.id}:`, err);
    });
  }

  private startGameWhenReady(room: Room): void {
    if (room.engine || this.startingRooms.has(room.id)) return;

    this.startingRooms.add(room.id);
    void this.manager.engine.initializeEngine(room).catch((err) => {
      console.error(`[RoomLifecycle] Failed to initialize game engine for room ${room.id}:`, err);
    }).finally(() => {
      this.startingRooms.delete(room.id);
    });
  }

  private hasRequiredPlayerConnections(room: Room): boolean {
    if (!room.playerA || !room.playerB) return false;

    const playerAConnected = Boolean(room.clients.get(room.playerA)?.ws);
    const playerBConnected = room.playerB === room.botAddress || Boolean(room.clients.get(room.playerB)?.ws);

    return playerAConnected && playerBConnected;
  }

  public armDepositTimeout(room: Room, address: string): void {
    const existing = room.depositTimeouts.get(address);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      console.log(`[ShotClock] Player ${address} timed out in room ${room.id}. Cancelling.`);
      const opponentAddress = address === room.playerA ? room.playerB : room.playerA;
      void this.cancelRoom(room.id, opponentAddress ?? undefined, { reason: 'deposit_timeout', cancelledBy: address }).catch((err) => {
        console.error(`[Lifecycle] Failed to cancel timed-out room ${room.id}:`, err);
      });
    }, this.DEPOSIT_TIMEOUT_MS);

    room.depositTimeouts.set(address, timer);
  }

  public async cancelRoom(
    roomId: string,
    innocentAddress?: string | null,
    options?: { reason?: string; cancelledBy?: string | null },
  ): Promise<void> {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    const reason = options?.reason ?? 'deposit_timeout';

    // Check if the innocent player had deposited — if so, trigger a refund before re-queue
    const innocentMeta = innocentAddress ? room.playerMeta.get(innocentAddress) : null;
    const innocentHadDeposited = innocentMeta?.hasDeposited ?? false;

    console.log(`[Cancel] Room ${roomId} cancelled. Innocent: ${innocentAddress ?? 'none'} (deposited: ${innocentHadDeposited})`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    this.manager.network.broadcastToRoom(room, {
      type: 'roomCancelled',
      payload: {
        cancelledBy: options?.cancelledBy ?? null,
        reason,
      },
    });

    if (innocentAddress) {
      // Refund the innocent player's deposit if they had already deposited
      if (innocentHadDeposited && room.roomType !== 'bot') {
        console.log(`[Cancel] Refunding innocent player ${innocentAddress} deposit for room ${roomId}.`);
        this.manager.blockchain.refundMatch(room, 'server_error');
      }

      const client = room.clients.get(innocentAddress);
      const innocentWs = client?.ws;

      if (innocentWs) {
        this.manager.network.safeSend(innocentWs, { type: 'opponentFailedDeposit', payload: {} } satisfies WsMessage);
      } else {
        console.log(`[Cancel] ${innocentAddress} already disconnected — skipping re-queue.`);
      }
    }

    if (room.queueMatchPersisted) {
      await this.persistPublicRoomCancellation(room, options);
    }

    this.closeRoomSockets(room, 'Match cancelled');
    this.destroyRoom(roomId);
  }

  public async abandonPublicRoom(roomId: string, reason: string): Promise<void> {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    if (room.queueMatchPersisted) {
      await this.manager.queueMatches.markAbandoned(room.id, reason);
    }

    this.destroyRoom(roomId);
  }

  private async persistPublicRoomCancellation(
    room: Room,
    options?: { reason?: string; cancelledBy?: string | null },
  ): Promise<void> {
    if (!room.queueMatchPersisted) return;

    const reason = options?.reason ?? 'cancelled';
    const cancelledBy = options?.cancelledBy ?? null;
    const playerA = room.playerA;
    const playerB = room.playerB;

    if (!playerA || !playerB) {
      await this.manager.queueMatches.markAbandoned(room.id, reason);
      return;
    }

    const aDeposited = room.playerMeta.get(playerA)?.hasDeposited ?? false;
    const bDeposited = room.playerMeta.get(playerB)?.hasDeposited ?? false;

    if (reason === 'deposit_timeout') {
      if (aDeposited && !bDeposited) {
        await this.manager.queueMatches.markForfeited(room.id, playerA, `deposit_timeout:${playerB}`);
        return;
      }

      if (bDeposited && !aDeposited) {
        await this.manager.queueMatches.markForfeited(room.id, playerB, `deposit_timeout:${playerA}`);
        return;
      }

      await this.manager.queueMatches.markCancelled(room.id, 'deposit_timeout:no_deposit');
      return;
    }

    if (reason === 'zombie_room' || reason === 'server_cleanup') {
      await this.manager.queueMatches.markAbandoned(room.id, reason);
      return;
    }

    await this.manager.queueMatches.markCancelled(
      room.id,
      cancelledBy ? `${reason}:${cancelledBy}` : reason,
    );
  }

  private closeRoomSockets(room: Room, reason: string): void {
    for (const [address, client] of room.clients) {
      if (!client.ws) continue;
      try {
        client.ws.close(1000, reason);
        client.ws = null;
        client.lastSeenAt = Date.now();
      } catch (error) {
        console.warn(`[RoomLifecycle] Failed to close room socket for ${address} in ${room.id}:`, error);
      }
    }
  }

  public destroyRoom(roomId: string): void {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;

    console.log(`[RoomLifecycle] Destroying room ${roomId}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    this.clearAllOpenedCards(room);
    this.manager.engine.stopBot(room);

    if (room.engine) {
      room.engine.stop();
    }

    this.manager.store.deleteRoom(roomId);
  }

  public async surrender(roomId: string, surrenderedAddress: string): Promise<void> {
    const room = this.manager.store.getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing' && room.status !== 'depositing') return;
    if (surrenderedAddress !== room.playerA && surrenderedAddress !== room.playerB) return;

    const winnerAddress = surrenderedAddress === room.playerA ? room.playerB : room.playerA;
    if (!winnerAddress) return;
    const metaA = room.playerA ? room.playerMeta.get(room.playerA) : null;
    const metaB = room.playerB ? room.playerMeta.get(room.playerB) : null;
    const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);
    if (!allDeposited) {
      console.log(`[Surrender] Ignoring surrender in room ${roomId}; both deposits are not confirmed.`);
      return;
    }

    console.log(`[Surrender] ${surrenderedAddress} surrendered room ${roomId}. Winner: ${winnerAddress}`);

    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();
    this.clearAllOpenedCards(room);

    // ER-authoritative surrender: send surrender_match instruction to ER
    if (room.erEnabled && room.erSessionPda) {
      try {
        await this.manager.blockchain.surrenderErMatch(room, surrenderedAddress);
        // finalizeTerminalErSession handles settlement + broadcast
        return;
      } catch (e) {
        console.error(`[Surrender] ER surrender failed for room ${roomId}, falling back to engine:`, e);
        await this.manager.blockchain.handleErFatalError(room, 'surrender', e);
        return;
      }
    }

    // Non-ER path: engine-only surrender
    if (room.engine) {
      room.engine.surrender(surrenderedAddress);
      return;
    }

    room.status = 'settling';
    this.manager.network.broadcastGameState(room);
    if (room.roomType !== 'bot') {
      void this.manager.blockchain.settleMatch(room, winnerAddress).then((result) => {
        if (!result.ok) {
          console.error(`[Lifecycle] Settlement failed for room ${room.id}`);
        }
      });
    }

    const result: MatchResult = {
      winnerAddress,
      reason: 'surrender',
      surrenderedAddress,
      finalScores: {},
      finalHealth: {},
      finalRoundsWon: {},
      finalCorrectAnswers: {},
      isBotMatch: room.roomType === 'bot',
    };

    this.manager.network.broadcastToRoom(room, {
      type: 'matchResult',
      payload: result,
    });
    room.status = 'finished';
    this.manager.network.broadcastGameState(room);
    setTimeout(() => {
      this.destroyRoom(roomId);
    }, 15_000);
  }

  public clearOpenedCard(room: Room, address: string) {
    const opened = room.openedCards.get(address);
    if (!opened) return;

    if (opened.countdownInterval) clearInterval(opened.countdownInterval);
    if (opened.timeoutHandle) clearTimeout(opened.timeoutHandle);
    room.openedCards.delete(address);
  }

  public clearAllOpenedCards(room: Room) {
    for (const address of room.openedCards.keys()) {
      this.clearOpenedCard(room, address);
    }
  }
}
