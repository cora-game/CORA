import { Connection, Keypair } from '@solana/web3.js';
import type { WsMessage } from '@shared/websocket';
import { deriveMatchId } from '@shared/escrow';
import { CHARACTER_DEFS } from '@shared/characterStats';
import { Store } from './room/Store';
import { Network } from './room/Network';
import { Lifecycle } from './room/Lifecycle';
import { Engine } from './room/Engine';
import { Queue } from './room/Queue';
import { Blockchain } from './room/Blockchain';
import type { Room, RoomSocket } from './room/types';
import { createBlinkMatchStore, type BlinkMatch, type BlinkMatchStore } from '../services/blinkMatches';
import { createQueueMatchStore, type QueueMatchStore } from '../services/queueMatches';
import { BlinkTransactionBuilder } from '../services/BlinkTransactionBuilder';
import { submitSettlementTransaction } from '../utils/settlement';

export class RoomManager {
  public store: Store;
  public network: Network;
  public engine: Engine;
  public lifecycle: Lifecycle;
  public queue: Queue;
  public blockchain: Blockchain;
  public blinkMatches: BlinkMatchStore;
  public queueMatches: QueueMatchStore;
  private blinkJanitorInterval: ReturnType<typeof setInterval> | null = null;
  private publicJanitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: { queueMatches?: QueueMatchStore; blinkMatches?: BlinkMatchStore; erEnabled?: boolean } = {}) {
    this.store = new Store(options.erEnabled);
    this.network = new Network();
    this.engine = new Engine(this);
    this.lifecycle = new Lifecycle(this);
    this.queue = new Queue(this);
    this.blockchain = new Blockchain(this);
    this.blinkMatches = options.blinkMatches ?? createBlinkMatchStore();
    this.queueMatches = options.queueMatches ?? createQueueMatchStore();
  }

  public getRoom(roomId: string): Room | undefined {
    return this.store.getRoom(roomId);
  }

  public createRoom(roomId: string): Room {
    return this.store.createRoom(roomId);
  }

  /**
   * Step 1 of private room creation (true Blink flow).
   * Generates roomId + unsigned create_open_challenge tx.
   * DB row is NOT written yet — that happens in confirmPrivateRoom after on-chain confirmation.
   */
  public async createPrivateRoom(
    playerAPubkey: string,
    tokenMint: string,
    wagerAmount: bigint,
  ): Promise<{ roomId: string; transaction: string }> {
    const roomId = crypto.randomUUID();
    const matchIdBytes = deriveMatchId(roomId);

    const transaction = await BlinkTransactionBuilder.buildCreateOpenChallengeTransaction(
      playerAPubkey,
      matchIdBytes,
      tokenMint,
      wagerAmount,
    );

    return { roomId, transaction };
  }

  /**
   * Step 2 of private room creation (true Blink flow).
   * Verifies the create_open_challenge tx is confirmed on-chain, then writes the DB row.
   * Returns the BlinkMatch on success, or throws on timeout/failure.
   */
  public async confirmPrivateRoom(
    roomId: string,
    address: string,
    txSignature: string,
    tokenMint: string,
    wagerAmount: bigint,
  ): Promise<BlinkMatch> {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // 30-second confirmation timeout — matches on-chain deposit timeout
    const result = await connection.confirmTransaction(txSignature, 'confirmed');

    if (result.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
    }

    // On-chain confirmed — safe to write DB row with the pre-determined roomId
    const match = await this.blinkMatches.createPending({
      id: roomId,
      creatorWallet: address,
      tokenMint,
      wagerAmount,
    });
    console.log(`[Blink] Private room ${roomId} confirmed on-chain (tx: ${txSignature}). DB row written as PENDING.`);

    return match;
  }

  public joinPrivateRoom(playerBPubkey: string, roomId: string): 'ok' | 'not_found' | 'full' | 'cancelled' {
    return this.lifecycle.joinPrivateRoom(playerBPubkey, roomId);
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    return this.queue.queueMatch(address, signal);
  }

  public createBotMatch(
    address: string,
    options: { tokenMint?: string | null; wagerAmount?: bigint | null; characterId?: string | null } = {},
  ): Room {
    this.queue.removeAddress(address);
    void this.queue.releaseUnfundedPublicDepositRoom(address).catch((err) => {
      console.error(`[BotMatch] Failed to release unfinished public room for ${address.slice(0, 6)}..:`, err);
    });

    const activeRoom = this.queue.findActiveRoomForAddress(address);
    if (activeRoom) {
      if (this.canReplaceBotRoom(activeRoom, address)) {
        console.warn(`[BotMatch] Replacing stale bot room ${activeRoom.id} for ${address.slice(0, 6)}..`);
        this.lifecycle.destroyRoom(activeRoom.id);
      } else {
        return activeRoom;
      }
    }

    const roomId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const botAddress = Keypair.generate().publicKey.toBase58();
    const room = this.store.createRoom(roomId);
    const botCharacterId = this.randomBotCharacterId();

    room.status = 'depositing';
    room.roomType = 'bot';
    room.playerA = address;
    room.playerB = botAddress;
    room.botAddress = botAddress;
    room.playerBUnlocked = true;
    room.tokenMint = options.tokenMint ?? null;
    room.wagerAmount = options.wagerAmount ?? 0n;
    room.wagerUsdValue = '0.00';
    room.playerMeta.set(address, {
      hasDeposited: true,
      characterId: options.characterId && CHARACTER_DEFS[options.characterId] ? options.characterId : 'einstein',
    });
    room.playerMeta.set(botAddress, {
      hasDeposited: true,
      characterId: botCharacterId,
    });
    room.clients.set(botAddress, {
      ws: null,
      lastSeenAt: Date.now(),
    });
    this.store.trackPlayer(address, roomId);

    console.log(`[BotMatch] Created bot room ${roomId}: ${address.slice(0, 6)}.. vs ${botAddress.slice(0, 6)}.. (${botCharacterId})`);
    return room;
  }

  public joinRoom(roomId: string, address: string, ws: RoomSocket, characterId: string = 'einstein') {
    const room = this.store.getRoom(roomId);
    if (room) {
      this.lifecycle.joinRoom(roomId, address, ws, characterId);
      return;
    }

    void this.hydrateBlinkRoom(roomId)
      .then((hydrated) => {
        if (!hydrated) {
          ws.close(1008, 'Room not found or already finished');
          return;
        }
        this.lifecycle.joinRoom(roomId, address, ws, characterId);
      })
      .catch((err) => {
        console.error(`[RoomManager] Failed to hydrate Blink room ${roomId}:`, err);
        ws.close(1011, 'Room hydration failed');
      });
  }

  public leaveRoom(roomId: string, address: string, ws?: RoomSocket) {
    this.lifecycle.leaveRoom(roomId, address, ws);
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.store.getRoom(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      const signature = readStringPayload(message.payload, 'signature');
      if (signature) this.lifecycle.handleDeposit(room, address, signature);
    }

    if (message.type === 'cancelMatch') {
      this.lifecycle.cancelDuringDeposit(roomId, address);
    }

    if (message.type === 'requestSnapshot') {
      this.network.broadcastGameState(room);
      this.network.broadcastPresence(room);
    }

    if (message.type === 'surrender') {
      void this.lifecycle.surrender(roomId, address).catch((err) => {
        console.error(`[RoomManager] Surrender failed for ${address} in room ${roomId}:`, err);
      });
    }

    if (message.type === 'openCard' && room.status === 'playing') {
      const cardId = readStringPayload(message.payload, 'cardId');
      if (cardId) this.engine.handleOpenCard(room, address, cardId);
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      void this.engine.handlePlayCard(room, address, readPlayCardPayload(message.payload));
    }
  }

  public async getBlinkMatch(roomId: string): Promise<BlinkMatch | null> {
    return this.blinkMatches.get(roomId);
  }

  public async refreshBlinkMatchExpiry(roomId: string): Promise<BlinkMatch | null> {
    const match = await this.blinkMatches.get(roomId);
    if (!match) return null;

    const now = Date.now();
    if (match.status === 'PENDING' && now > Date.parse(match.expiresAt)) {
      return this.blinkMatches.expirePending(roomId);
    }
    if (match.status === 'CHALLENGED' && match.joinDeadline && now > Date.parse(match.joinDeadline)) {
      return this.blinkMatches.forfeitChallenged(roomId);
    }
    return match;
  }

  public hydrateBlinkRoom(matchOrRoomId: BlinkMatch | string): Promise<Room | null> {
    return this.hydrateBlinkRoomInternal(matchOrRoomId);
  }

  public startBlinkJanitor(intervalMs = 15_000): void {
    if (this.blinkJanitorInterval) return;
    this.blinkJanitorInterval = setInterval(() => {
      void this.runBlinkJanitorOnce();
    }, intervalMs);
  }

  public stopBlinkJanitor(): void {
    if (!this.blinkJanitorInterval) return;
    clearInterval(this.blinkJanitorInterval);
    this.blinkJanitorInterval = null;
  }

  public async runBlinkJanitorOnce(): Promise<void> {
    const updates = await this.blinkMatches.sweepExpired();
    for (const update of updates) {
      const room = this.store.getRoom(update.id);
      if (room) {
        this.network.broadcastToRoom(room, {
          type: 'roomCancelled',
          payload: {
            cancelledBy: null,
            reason: update.status === 'FORFEITED' ? 'deposit_timeout' : 'player_cancelled',
          },
        });
        this.lifecycle.destroyRoom(update.id);
      }

      // FORFEITED: trigger on-chain settlement awarding the challenger
      if (update.status === 'FORFEITED') {
        const match = await this.blinkMatches.get(update.id);
        if (match?.opponentWallet) {
          const matchIdBytes = deriveMatchId(update.id);
          try {
            await submitSettlementTransaction(0, matchIdBytes, match.opponentWallet);
            await this.blinkMatches.markCompleted(update.id);
            console.log(`[BlinkJanitor] FORFEITED match ${update.id} settled on-chain. Challenger ${match.opponentWallet} awarded. DB marked COMPLETED.`);
          } catch (err) {
            // Keep DB as FORFEITED — do NOT mark COMPLETED
            console.error(
              `[BlinkJanitor] Settlement FAILED for FORFEITED match ${update.id}. ` +
              `Challenger: ${match.opponentWallet}. DB remains FORFEITED.`,
              err,
            );
          }
        }
      }
    }
  }

  /** Periodically sweeps zombie public deposit rooms that have no timers, sockets, or deposits. */
  public startPublicRoomJanitor(intervalMs = 30_000): void {
    if (this.publicJanitorInterval) return;
    this.publicJanitorInterval = setInterval(() => {
      for (const room of this.store.getAllRooms()) {
        if (room.roomType !== 'public') continue;
        if (this.queue.isZombieDepositRoom(room)) {
          console.warn(`[Janitor] Abandoning zombie public room ${room.id}`);
          void this.lifecycle.abandonPublicRoom(room.id, 'zombie_room').catch((err) => {
            console.error(`[Janitor] Failed to abandon public room ${room.id}:`, err);
          });
        }
      }
    }, intervalMs);
  }

  public stopPublicRoomJanitor(): void {
    if (!this.publicJanitorInterval) return;
    clearInterval(this.publicJanitorInterval);
    this.publicJanitorInterval = null;
  }

  private async hydrateBlinkRoomInternal(matchOrRoomId: BlinkMatch | string): Promise<Room | null> {
    const existing = this.store.getRoom(typeof matchOrRoomId === 'string' ? matchOrRoomId : matchOrRoomId.id);
    if (existing) return existing;

    const match = typeof matchOrRoomId === 'string'
      ? await this.refreshBlinkMatchExpiry(matchOrRoomId)
      : matchOrRoomId;
    if (!match || match.status !== 'CHALLENGED' || !match.opponentWallet) return null;

    const room = this.store.createRoom(match.id);
    room.status = 'depositing';
    room.roomType = 'private';
    room.playerA = match.creatorWallet;
    room.playerB = match.opponentWallet;
    room.playerBUnlocked = true;
    room.tokenMint = match.tokenMint;
    room.wagerAmount = BigInt(match.wagerAmount);
    room.blinkJoinDeadline = match.joinDeadline ? Date.parse(match.joinDeadline) : null;
    // True flow: after accept_challenge, BOTH wagers are locked on-chain.
    // Both players are considered deposited — creator only needs to join WebSocket.
    room.playerMeta.set(match.creatorWallet, { hasDeposited: true, characterId: 'einstein' });
    room.playerMeta.set(match.opponentWallet, { hasDeposited: true, characterId: 'einstein' });
    this.store.trackPlayer(match.creatorWallet, match.id);
    this.store.trackPlayer(match.opponentWallet, match.id);

    void this.blockchain.fetchWagerUsd(room);
    return room;
  }

  private randomBotCharacterId(): string {
    const characterIds = Object.keys(CHARACTER_DEFS);
    return characterIds[Math.floor(Math.random() * characterIds.length)] ?? 'einstein';
  }

  private canReplaceBotRoom(room: Room, address: string): boolean {
    if (room.roomType !== 'bot') return false;
    if (room.status === 'settling' || room.status === 'finished') return true;
    if (room.engine && !room.engine.isActive()) return true;

    const playerIsHuman = address === room.playerA || address === room.playerB;
    const humanSocketConnected = playerIsHuman && Boolean(room.clients.get(address)?.ws);
    return room.status === 'depositing' && !humanSocketConnected;
  }
}

function readStringPayload(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function readPlayCardPayload(payload: unknown): { cardId?: string; selectedOptionId?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  return {
    cardId: typeof record.cardId === 'string' ? record.cardId : undefined,
    selectedOptionId: typeof record.selectedOptionId === 'string' ? record.selectedOptionId : undefined,
  };
}
