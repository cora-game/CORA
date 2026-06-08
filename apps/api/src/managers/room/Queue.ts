import type { QueueStatusData, WsMessage } from '@shared/websocket';
import type { RoomManager } from '../RoomManager';
import type { RoomSocket } from './types';
import type { Room } from './types';

interface QueueItem {
  address: string;
  ws?: RoomSocket;
  /** The /queue WebSocket (separate from room WS) — used for queue status events */
  queueWs?: RoomSocket;
  connected: boolean;
  resolve: (roomId: string, opponentAddress?: string) => void;
  enqueuedAt: number;
  ttlHandle?: ReturnType<typeof setTimeout>;
  graceHandle?: ReturnType<typeof setTimeout>;
}

export class Queue {
  private queue: QueueItem[] = [];
  private readonly QUEUE_TTL_MS = 300_000;
  private readonly RECONNECT_GRACE_MS = 30_000;

  constructor(private manager: RoomManager) {}

  public findActiveRoomForAddress(address: string) {
    const activeRoom = this.manager.store.findRoomByPlayer(address);

    if (activeRoom && this.isZombieDepositRoom(activeRoom)) {
      console.warn(`[Queue] Ignoring zombie deposit room ${activeRoom.id} for ${this.shortAddr(address)}.`);
      void this.manager.lifecycle.abandonPublicRoom(activeRoom.id, 'zombie_room').catch((err) => {
        console.error(`[Queue] Failed to abandon zombie room ${activeRoom.id}:`, err);
      });
      return undefined;
    }

    return activeRoom;
  }

  public async releaseUnfundedPublicDepositRoom(address: string): Promise<void> {
    const activeRoom = this.manager.store.findRoomByPlayer(address);
    if (!activeRoom || activeRoom.roomType !== 'public' || activeRoom.status !== 'depositing') return;

    const playerMeta = activeRoom.playerMeta.get(address);
    const hasDeposited = playerMeta?.hasDeposited ?? false;
    const opponentAddress = address === activeRoom.playerA ? activeRoom.playerB : activeRoom.playerA;
    const opponentMeta = opponentAddress ? activeRoom.playerMeta.get(opponentAddress) : null;
    const opponentHasDeposited = opponentMeta?.hasDeposited ?? false;
    if (hasDeposited && opponentHasDeposited) return;

    const innocentAddress = hasDeposited ? undefined : opponentAddress ?? undefined;
    console.warn(`[Queue] Releasing incomplete public deposit room ${activeRoom.id} for ${this.shortAddr(address)} before queue entry.`);
    await this.manager.lifecycle.cancelRoom(activeRoom.id, innocentAddress, {
      reason: 'player_cancelled',
      cancelledBy: address,
    });
  }

  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    await this.releaseUnfundedPublicDepositRoom(address);
    if (signal?.aborted) return '__aborted__';

    const activeRoom = this.findActiveRoomForAddress(address);
    if (activeRoom) {
      this.printQueueState('RECONNECT', `${this.shortAddr(address)} already in room ${activeRoom.id}`);
      return activeRoom.id;
    }

    const existing = this.queue.find((item) => item.address === address);
    if (existing) {
      this.printQueueState('REQUEUE', `${this.shortAddr(address)} already waiting; chaining request`);
      return new Promise<string>((resolve) => {
        const originalResolve = existing.resolve;
        existing.resolve = (roomId: string, opponentAddress?: string) => {
          originalResolve(roomId, opponentAddress);
          resolve(roomId);
        };
        this.bindAbort(signal, existing, address);
      });
    }

    const opponentIndex = this.queue.findIndex((item) => item.address !== address && item.connected);
    if (opponentIndex !== -1) {
      const playerAEntry = this.queue[opponentIndex];
      if (!playerAEntry) {
        throw new Error('Queue opponent disappeared before match creation');
      }

      const { roomId } = await this.createPersistedPublicMatch(playerAEntry.address, address);
      const removed = this.queue.splice(opponentIndex, 1)[0];
      if (!removed || removed.address !== playerAEntry.address) {
        await this.manager.queueMatches.markAbandoned(roomId, 'queue_race_opponent_changed');
        throw new Error('Queue opponent changed during match creation');
      }

      this.clearQueueTimers(removed);
      this.createPublicRoomFromPersistedMatch(roomId, removed.address, address);
      this.printQueueState('MATCH FOUND', `${this.shortAddr(playerAEntry.address)} vs ${this.shortAddr(address)} -> ${roomId}`);

      removed.resolve(roomId, address);
      return roomId;
    }

    return new Promise((resolve) => {
      const queueItem: QueueItem = {
        address,
        connected: true,
        resolve,
        enqueuedAt: Date.now(),
      };

      queueItem.ttlHandle = setTimeout(() => {
        this.removeQueueItem(queueItem);
        this.printQueueState('TTL EXPIRED', `${this.shortAddr(address)} removed after 5m timeout`);
      }, this.QUEUE_TTL_MS);

      this.queue.push(queueItem);
      this.bindAbort(signal, queueItem, address);
      this.broadcastQueuePositions();
      this.printQueueState('WAITING', `${this.shortAddr(address)} added to queue`);
    });
  }

  /**
   * WebSocket-based queue entry. Instead of hanging an HTTP request,
   * this pushes real-time events (queueJoined, queueStatus, matchFound)
   * over the provided /queue WebSocket.
   */
  public async queueMatchWs(address: string, queueWs: RoomSocket): Promise<void> {
    await this.releaseUnfundedPublicDepositRoom(address);

    // Check for active room (reconnect)
    const activeRoom = this.findActiveRoomForAddress(address);
    if (activeRoom) {
      const role = activeRoom.playerA === address ? 'playerA' : 'playerB';
      const opponentAddress = address === activeRoom.playerA ? activeRoom.playerB : activeRoom.playerA;
      this.manager.network.safeSend(queueWs, {
        type: 'matchFound',
        payload: { roomId: activeRoom.id, role, opponentAddress: opponentAddress ?? '', roomType: activeRoom.roomType },
      } satisfies WsMessage);
      this.printQueueState('RECONNECT (WS)', `${this.shortAddr(address)} already in room ${activeRoom.id}`);
      return;
    }

    // Already queued — attach WS to existing item
    const existing = this.queue.find((item) => item.address === address);
    if (existing) {
      existing.queueWs = queueWs;
      existing.connected = true;
      if (existing.graceHandle) {
        clearTimeout(existing.graceHandle);
        existing.graceHandle = undefined;
      }
      this.sendQueueStatus(existing, 'queueJoined');
      this.printQueueState('REATTACH (WS)', `${this.shortAddr(address)} WS attached to existing queue item`);
      return;
    }

    // Try instant match
    const opponentIndex = this.queue.findIndex((item) => item.address !== address && item.connected);
    if (opponentIndex !== -1) {
      const playerAEntry = this.queue[opponentIndex];
      if (!playerAEntry) {
        this.manager.network.safeSend(queueWs, {
          type: 'queueLeft',
          payload: { reason: 'match_creation_failed' },
        } satisfies WsMessage);
        return;
      }

      let roomId: string;
      try {
        const persisted = await this.createPersistedPublicMatch(playerAEntry.address, address);
        roomId = persisted.roomId;
      } catch (err) {
        console.error('[Queue] Failed to persist public WS match:', err);
        this.manager.network.safeSend(queueWs, {
          type: 'queueLeft',
          payload: { reason: 'match_creation_failed' },
        } satisfies WsMessage);
        return;
      }

      const removed = this.queue.splice(opponentIndex, 1)[0];
      if (!removed || removed.address !== playerAEntry.address) {
        await this.manager.queueMatches.markAbandoned(roomId, 'queue_race_opponent_changed');
        this.manager.network.safeSend(queueWs, {
          type: 'queueLeft',
          payload: { reason: 'match_creation_failed' },
        } satisfies WsMessage);
        return;
      }

      this.clearQueueTimers(removed);
      const room = this.createPublicRoomFromPersistedMatch(roomId, removed.address, address);
      this.printQueueState('MATCH FOUND (WS)', `${this.shortAddr(removed.address)} vs ${this.shortAddr(address)} -> ${roomId}`);

      removed.resolve(roomId, address);

      // Notify current player (Player B) via their queue WS
      this.manager.network.safeSend(queueWs, {
        type: 'matchFound',
        payload: { roomId, role: 'playerB', opponentAddress: removed.address, roomType: room.roomType },
      } satisfies WsMessage);

      this.broadcastQueuePositions();
      return;
    }

    // No opponent — add to queue and wait
    const queueItem: QueueItem = {
      address,
      queueWs,
      connected: true,
      resolve: (roomId: string, opponentAddress?: string) => {
        // When matched via the HTTP path, also notify the queueWs.
        if (queueItem.queueWs) {
          this.manager.network.safeSend(queueItem.queueWs, {
            type: 'matchFound',
            payload: { roomId, role: 'playerA', opponentAddress: opponentAddress ?? '', roomType: 'public' },
          } satisfies WsMessage);
        }
      },
      enqueuedAt: Date.now(),
    };

    queueItem.ttlHandle = setTimeout(() => {
      this.removeQueueItem(queueItem);
      if (queueItem.queueWs) {
        this.manager.network.safeSend(queueItem.queueWs, {
          type: 'queueLeft',
          payload: { reason: 'ttl_expired' },
        } satisfies WsMessage);
      }
      this.broadcastQueuePositions();
      this.printQueueState('TTL EXPIRED (WS)', `${this.shortAddr(address)} removed after 5m timeout`);
    }, this.QUEUE_TTL_MS);

    this.queue.push(queueItem);
    this.sendQueueStatus(queueItem, 'queueJoined');
    this.broadcastQueuePositions();
    this.printQueueState('WAITING (WS)', `${this.shortAddr(address)} added to queue`);
  }

  public isQueued(address: string): boolean {
    return this.queue.some((item) => item.address === address);
  }

  public detachQueueWs(address: string, queueWs: RoomSocket): void {
    const item = this.queue.find((candidate) => candidate.address === address && candidate.queueWs === queueWs);
    if (!item) return;

    item.queueWs = undefined;
    item.connected = false;

    if (item.graceHandle) clearTimeout(item.graceHandle);
    item.graceHandle = setTimeout(() => {
      if (item.connected) return;
      this.clearQueueTimers(item);
      if (this.removeQueueItem(item)) {
        item.resolve('__aborted__');
        this.printQueueState('WS GRACE EXPIRED', `${this.shortAddr(address)} left matchmaking`);
      }
    }, this.RECONNECT_GRACE_MS);

    this.broadcastQueuePositions();
    this.printQueueState('WS DETACHED', `${this.shortAddr(address)} can reconnect without losing queue`);
  }

  public cancelQueueWs(address: string, queueWs: RoomSocket): void {
    const item = this.queue.find((candidate) => candidate.address === address && candidate.queueWs === queueWs);
    if (!item) return;

    this.manager.network.safeSend(queueWs, {
      type: 'queueLeft',
      payload: { reason: 'cancelled' },
    } satisfies WsMessage);
    this.clearQueueTimers(item);
    if (this.removeQueueItem(item)) {
      item.resolve('__aborted__');
      this.printQueueState('CANCELLED (WS)', `${this.shortAddr(address)} left matchmaking`);
    }
  }

  public removeAddress(address: string, reason: 'cancelled' | 'ttl_expired' | 'error' = 'cancelled'): boolean {
    const item = this.queue.find((candidate) => candidate.address === address);
    if (!item) return false;

    if (item.queueWs) {
      this.manager.network.safeSend(item.queueWs, {
        type: 'queueLeft',
        payload: { reason },
      } satisfies WsMessage);
    }

    this.clearQueueTimers(item);
    const removed = this.removeQueueItem(item);
    if (removed) {
      item.resolve('__aborted__');
      this.printQueueState('REMOVED', `${this.shortAddr(address)} left queue (${reason})`);
    }
    return removed;
  }

  private bindAbort(
    signal: AbortSignal | undefined,
    queueItem: QueueItem,
    address: string,
  ): void {
    if (!signal) return;
    if (signal.aborted) {
      if (this.removeQueueItem(queueItem)) {
        queueItem.resolve('__aborted__');
        this.printQueueState('ABORTED', `${this.shortAddr(address)} left matchmaking`);
      }
      return;
    }
    signal.addEventListener('abort', () => {
      this.clearQueueTimers(queueItem);
      if (this.removeQueueItem(queueItem)) {
        queueItem.resolve('__aborted__');
        this.printQueueState('ABORTED', `${this.shortAddr(address)} left matchmaking`);
      }
    }, { once: true });
  }

  private removeQueueItem(queueItem: QueueItem): boolean {
    const index = this.queue.indexOf(queueItem);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    this.broadcastQueuePositions();
    return true;
  }

  private async createPersistedPublicMatch(playerA: string, playerB: string): Promise<{ roomId: string }> {
    const roomId = this.createPublicRoomId();
    await this.manager.queueMatches.create({
      id: roomId,
      playerA,
      playerB,
      tokenMint: null,
      wagerAmount: 0n,
    });
    return { roomId };
  }

  private createPublicRoomFromPersistedMatch(roomId: string, playerA: string, playerB: string): Room {
    const room = this.manager.store.createRoom(roomId);
    room.roomType = 'public';
    room.queueMatchPersisted = true;
    room.playerA = playerA;
    room.playerB = playerB;
    room.status = 'depositing';
    this.manager.store.trackPlayer(playerA, roomId);
    this.manager.store.trackPlayer(playerB, roomId);
    this.manager.lifecycle.armDepositTimeout(room, playerA);
    return room;
  }

  private clearQueueTimers(queueItem: QueueItem): void {
    if (queueItem.ttlHandle) {
      clearTimeout(queueItem.ttlHandle);
      queueItem.ttlHandle = undefined;
    }
    if (queueItem.graceHandle) {
      clearTimeout(queueItem.graceHandle);
      queueItem.graceHandle = undefined;
    }
  }

  public isZombieDepositRoom(room: Room): boolean {
    if (room.status !== 'depositing') return false;

    const hasAnyDepositTimer = room.depositTimeouts.size > 0;
    const hasAnyLiveSocket = Array.from(room.clients.values()).some((client) => Boolean(client.ws));
    const hasAnyDeposit = [room.playerA, room.playerB].some((address) => {
      if (!address) return false;
      return room.playerMeta.get(address)?.hasDeposited ?? false;
    });

    return !hasAnyDepositTimer && !hasAnyLiveSocket && !hasAnyDeposit;
  }

  private shortAddr(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 4)}..${address.slice(-4)}`;
  }

  private createPublicRoomId(): string {
    return `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private printQueueState(event: string, detail = ''): void {
    const waiting = this.queue.map((item) => this.shortAddr(item.address)).join(', ') || 'empty';
    const activeRooms = this.manager.store.getAllRooms().filter((room) => room.status !== 'finished').length;
    console.log(`[Queue] ${event}${detail ? ` - ${detail}` : ''} | waiting=${waiting} | activeRooms=${activeRooms}`);
  }

  // ─── Queue Position Broadcasting ──────────────────────────────

  /** Send queue status to a single player */
  private sendQueueStatus(item: QueueItem, type: 'queueJoined' | 'queueStatus' = 'queueStatus'): void {
    if (!item.queueWs) return;
    const position = this.queue.indexOf(item) + 1;
    const payload: QueueStatusData = {
      position,
      estimatedWaitMs: null,
      queueDepth: this.queue.length,
    };
    this.manager.network.safeSend(item.queueWs, { type, payload } satisfies WsMessage);
  }

  /** Broadcast updated positions to ALL waiting players after any queue mutation */
  private broadcastQueuePositions(): void {
    for (const item of this.queue) {
      this.sendQueueStatus(item);
    }
  }

  /** Expose queue depth for health/admin endpoints */
  public getQueueDepth(): number {
    return this.queue.length;
  }
}
