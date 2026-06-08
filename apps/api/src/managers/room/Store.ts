import { deriveMatchId } from '@shared/escrow';
import { isMagicBlockConfigured } from '../../services/magicblock';
import { Room } from './types';

export class Store {
  private rooms: Map<string, Room> = new Map();
  /** Reverse index: player wallet address → roomId for O(1) active-room lookups */
  private playerRooms: Map<string, string> = new Map();

  constructor(private defaultErEnabled = isMagicBlockConfigured()) {}

  public createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      matchIdBytes: deriveMatchId(roomId),
      clients: new Map(),
      status: 'waiting',
      playerMeta: new Map(),
      engine: null,
      openedCards: new Map(),
      roomType: 'public',
      playerA: null,
      playerB: null,
      botAddress: null,
      playerBUnlocked: false,
      tokenMint: null,
      wagerAmount: null,
      depositTimeouts: new Map(),
      erSessionPda: null,
      wagerUsdValue: null,
      blinkJoinDeadline: null,
      erEnabled: this.defaultErEnabled,
      erLifecycleStatus: 'none',
      erCardRegistry: new Map(),
      erNextCardNonce: 0,
      erProofMeta: null,
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      if (room.playerA) this.playerRooms.delete(room.playerA);
      if (room.playerB) this.playerRooms.delete(room.playerB);
    }
    this.rooms.delete(roomId);
  }

  /** Track a player's association with a room (O(1) reverse index). */
  public trackPlayer(address: string, roomId: string): void {
    this.playerRooms.set(address, roomId);
  }

  /** Remove a player's room association. */
  public untrackPlayer(address: string): void {
    this.playerRooms.delete(address);
  }

  /** O(1) lookup: find the active (non-finished) room a player belongs to. */
  public findRoomByPlayer(address: string): Room | undefined {
    const roomId = this.playerRooms.get(address);
    if (!roomId) return undefined;
    const room = this.rooms.get(roomId);
    if (!room) {
      // Stale index entry — clean up
      this.playerRooms.delete(address);
      return undefined;
    }
    if (room.status === 'finished') return undefined;
    return room;
  }
}
