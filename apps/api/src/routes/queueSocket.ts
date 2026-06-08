import type { WSEvents } from 'hono/ws';
import type { RoomManager } from '../managers/RoomManager';
import type { WsMessage } from '@shared/websocket';

/**
 * WebSocket route handler for /queue — replaces the HTTP long-poll matchmaking flow.
 *
 * Lifecycle:
 *   1. Client opens WS to /queue?address=<wallet>
 *   2. Server checks for active rooms (reconnect) or enters queue
 *   3. Server pushes queueJoined / queueStatus / matchFound / queueLeft events
 *   4. Client can send cancelQueue to leave
 *   5. WS close also removes from queue
 */
export function createQueueSocketRoute(roomManager: RoomManager) {
  return (address: string | undefined): WSEvents => {
    if (!address) {
      return {
        onOpen(_event, ws) {
          ws.close(1008, 'Address query param is required');
        },
      };
    }

    let queued = false;
    let cancelled = false;

    return {
      onOpen(_event, ws) {
        queued = true;
        void roomManager.queue.queueMatchWs(address, ws).catch((err) => {
          console.error('[QueueWS] Unhandled queueMatchWs failure:', err);
          roomManager.network.safeSend(ws, {
            type: 'queueLeft',
            payload: { reason: 'match_creation_failed' },
          } satisfies WsMessage);
          ws.close(1011, 'Match creation failed');
        });
      },

      onMessage(event, ws) {
        try {
          const msg: WsMessage = JSON.parse(
            typeof event.data === 'string' ? event.data : event.data.toString(),
          );

          if (msg.type === 'cancelQueue') {
            console.log(`[QueueWS] ${address.slice(0, 6)}.. sent cancelQueue`);
            cancelled = true;
            roomManager.queue.cancelQueueWs(address, ws);
            ws.close(1000, 'Queue cancelled by client');
          }
        } catch {
          // Ignore unparseable messages
        }
      },

      onClose(_event, ws) {
        if (queued && !cancelled) {
          roomManager.queue.detachQueueWs(address, ws);
        }
      },
    };
  };
}
