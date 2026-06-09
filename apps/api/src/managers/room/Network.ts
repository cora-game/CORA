import type { GameState, PresenceUpdateData, ScoreUpdateData, WsMessage } from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';
import type { Room, RoomSocket } from './types';

export class Network {
  /** Safe WebSocket send wrapper */
  public safeSend(ws: RoomSocket | null | undefined, data: unknown): void {
    if (!ws) return;
    try {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      console.warn(`[SafeSend] WebSocket send failed:`, e);
    }
  }

  /**
   * Broadcast a message to all connected clients in a room.
   */
  public broadcastToRoom(room: Room, message: WsMessage) {
    const raw = JSON.stringify(message);
    for (const client of room.clients.values()) {
      this.safeSend(client.ws, raw);
    }
  }

  public broadcastGameState(room: Room) {
    const addresses = Array.from(room.clients.keys());

    for (const address of addresses) {
      const client = room.clients.get(address);
      if (!client?.ws) continue;

      let payload: GameState;

      if (room.engine && (room.status === 'playing' || room.status === 'settling' || room.status === 'finished')) {
        // Engine owns the game state
        payload = {
          ...room.engine.getStateForPlayer(address),
          tokenMint: room.tokenMint || 'ETH',
          wagerAmount: room.wagerAmount?.toString() || '0',
          wagerEthValue: room.wagerEthValue || undefined,
          roomType: room.roomType,
        };
        this.applyPresence(room, payload);
      } else {
        // Pre-game state (waiting / depositing)
        // Use room.playerA/playerB as source of truth for opponent identity,
        // since room.clients may not have both WS connections yet.
        const opponentAddress = (() => {
          if (room.playerA && room.playerB) {
            return address === room.playerA ? room.playerB : room.playerA;
          }
          // Fallback to checking connected clients
          return addresses.find(a => a !== address);
        })();
        payload = {
          status: room.status,
          player: {
            address,
            baseHealth: 100,
            characterState: 'stay',
            score: 0,
            roundsWon: 0,
            correctAnswers: 0,
            currentCorrectStreak: 0,
            characterId: room.playerMeta.get(address)?.characterId || 'einstein',
            isConnected: Boolean(room.clients.get(address)?.ws),
            lastSeenAt: room.clients.get(address)?.lastSeenAt,
          },
          opponent: opponentAddress
            ? {
              address: opponentAddress,
              baseHealth: 100,
              characterState: 'stay',
              score: 0,
              roundsWon: 0,
              correctAnswers: 0,
              currentCorrectStreak: 0,
              characterId: room.playerMeta.get(opponentAddress)?.characterId || 'einstein',
              isConnected: Boolean(room.clients.get(opponentAddress)?.ws),
              lastSeenAt: room.clients.get(opponentAddress)?.lastSeenAt,
            }
            : {
              address: 'Waiting for opponent...',
              baseHealth: 100,
              characterState: 'stay',
              score: 0,
              roundsWon: 0,
              correctAnswers: 0,
              currentCorrectStreak: 0,
              characterId: 'einstein',
              isConnected: false,
            },
          hand: [],
          timer: {
            totalDurationMs: GameEngine.MATCH_DURATION_MS,
            remainingMs: GameEngine.MATCH_DURATION_MS,
            phase: 'normal',
            extraPointThresholdMs: GameEngine.EXTRA_POINT_THRESHOLD_MS,
          },
          damageLog: [],
          currentRound: 1,
          roundsToWin: GameEngine.ROUNDS_TO_WIN,
          tokenMint: room.tokenMint || 'ETH',
          wagerAmount: room.wagerAmount?.toString() || '0',
          wagerEthValue: room.wagerEthValue || undefined,
          roomType: room.roomType,
        };
      }

      this.safeSend(client.ws, {
        type: 'gameStateUpdate',
        payload,
      } as WsMessage<GameState>);
    }
  }

  public broadcastPresence(room: Room) {
    const payload: PresenceUpdateData = { players: {} };
    for (const [address, client] of room.clients) {
      payload.players[address] = {
        isConnected: address === room.botAddress || Boolean(client.ws),
        lastSeenAt: client.lastSeenAt,
      };
    }
    this.broadcastToRoom(room, { type: 'presenceUpdate', payload });
  }

  private applyPresence(room: Room, state: GameState): void {
    const playerClient = room.clients.get(state.player.address);
    const opponentClient = room.clients.get(state.opponent.address);
    const opponentIsBot = room.botAddress !== null && state.opponent.address === room.botAddress;

    state.player.isConnected = Boolean(playerClient?.ws);
    state.player.lastSeenAt = playerClient?.lastSeenAt;
    state.opponent.isConnected = opponentIsBot || Boolean(opponentClient?.ws);
    state.opponent.lastSeenAt = opponentClient?.lastSeenAt;
  }

  /**
   * Broadcast live score update to both players after every card play or expiry.
   */
  public broadcastScoreUpdate(room: Room) {
    if (!room.engine) return;

    const scores = room.engine.getScores();
    const health = room.engine.getHealth();
    const addresses = Array.from(room.clients.keys());

    for (const address of addresses) {
      const client = room.clients.get(address);
      if (!client?.ws) continue;

      const opponentAddress = addresses.find(a => a !== address) ?? '';

      const scoreData: ScoreUpdateData = {
        playerAddress: address,
        opponentAddress,
        playerScore: scores[address] ?? 0,
        opponentScore: scores[opponentAddress] ?? 0,
        playerHealth: health[address] ?? 0,
        opponentHealth: health[opponentAddress] ?? 0,
      };

      this.safeSend(client.ws, {
        type: 'scoreUpdate',
        payload: scoreData,
      });
    }
  }
}
