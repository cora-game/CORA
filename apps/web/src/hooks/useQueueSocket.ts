'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { QueueStatusData, WsMessage } from '@shared/websocket';

export type QueueState = 'idle' | 'connecting' | 'queued' | 'matched' | 'expired' | 'cancelled' | 'error';

interface MatchFoundResult {
  roomId: string;
  role: 'playerA' | 'playerB';
  opponentAddress: string;
  roomType?: 'public' | 'private' | 'bot';
}

interface UseQueueSocketReturn {
  /** Current state of the queue lifecycle */
  queueState: QueueState;
  /** Queue position and depth (null while not queued) */
  queueStatus: QueueStatusData | null;
  /** Match result once found (null while waiting) */
  matchResult: MatchFoundResult | null;
  /** Connect to the queue WS and start matchmaking */
  connect: (address: string) => void;
  /** Cancel matchmaking and close the WS */
  cancel: () => void;
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, '');
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 500;

/**
 * React hook for WebSocket-based matchmaking queue.
 *
 * Replaces the old HTTP long-poll `queueMatch()` flow with real-time
 * queue events: queueJoined → queueStatus → matchFound.
 */
export function useQueueSocket(): UseQueueSocketReturn {
  const [queueState, setQueueState] = useState<QueueState>('idle');
  const [queueStatus, setQueueStatus] = useState<QueueStatusData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchFoundResult | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const addressRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  // Use refs to track mutable state that the onclose handler needs.
  // This avoids the stale-closure problem where onclose captures
  // the queueState/matchResult values from the render when openSocket was called.
  const queueStateRef = useRef<QueueState>(queueState);
  const matchResultRef = useRef<MatchFoundResult | null>(matchResult);
  const openSocketRef = useRef<(address: string) => void>(() => {});

  useEffect(() => {
    queueStateRef.current = queueState;
  }, [queueState]);

  useEffect(() => {
    matchResultRef.current = matchResult;
  }, [matchResult]);

  const wsBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080');

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      intentionalCloseRef.current = true;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const openSocket = useCallback((address: string) => {
    cleanup();
    intentionalCloseRef.current = false;

    const socketUrl = `${wsBaseUrl}/queue?address=${encodeURIComponent(address)}`;
    console.info('[useQueueSocket] Opening connection to', socketUrl);
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;
    setQueueState('connecting');

    ws.onopen = () => {
      console.info('[useQueueSocket] Connected');
      setQueueState('queued');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'queueJoined':
            setQueueState('queued');
            setQueueStatus(message.payload as QueueStatusData);
            break;

          case 'queueStatus':
            setQueueStatus(message.payload as QueueStatusData);
            break;

          case 'matchFound': {
            const payload = message.payload as MatchFoundResult;
            console.info('[useQueueSocket] Match found:', payload.roomId, payload.role);
            setMatchResult(payload);
            setQueueState('matched');
            setQueueStatus(null);
            intentionalCloseRef.current = true;
            ws.close(1000, 'Match found');
            if (socketRef.current === ws) {
              socketRef.current = null;
            }
            break;
          }

          case 'queueLeft': {
            const payload = message.payload as { reason: string };
            setQueueStatus(null);
            if (payload.reason === 'ttl_expired') {
              setQueueState('expired');
            } else if (payload.reason === 'cancelled') {
              setQueueState('cancelled');
            } else {
              setQueueState('error');
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[useQueueSocket] Failed to parse message', err);
      }
    };

    ws.onclose = (event) => {
      if (intentionalCloseRef.current || socketRef.current !== ws) return;

      // Use refs for current values (not stale closure values)
      if (queueStateRef.current === 'matched' || matchResultRef.current) return;

      // Attempt reconnect for unexpected closes
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && addressRef.current) {
        reconnectAttemptsRef.current += 1;
        console.warn(
          `[useQueueSocket] Connection lost (code ${event.code}, reason: ${event.reason || 'none'}), reconnecting (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`,
        );
        setQueueState('connecting');
        reconnectTimerRef.current = setTimeout(() => {
          if (addressRef.current) {
            openSocketRef.current(addressRef.current);
          }
        }, RECONNECT_DELAY_MS);
      } else {
        console.warn(`[useQueueSocket] Connection lost (code ${event.code}), no more reconnect attempts.`);
        setQueueState('error');
        setQueueStatus(null);
      }
    };

    ws.onerror = () => {
      // WebSocket error events don't carry useful info — onclose handles recovery.
      // Only log if we're not already in an intentional close.
      if (!intentionalCloseRef.current) {
        console.warn('[useQueueSocket] WebSocket error (details not available in browser). Will reconnect on close.');
      }
    };
  }, [wsBaseUrl, cleanup]);

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  const connect = useCallback((address: string) => {
    addressRef.current = address;
    reconnectAttemptsRef.current = 0;
    setMatchResult(null);
    setQueueStatus(null);
    openSocket(address);
  }, [openSocket]);

  const cancel = useCallback(() => {
    // Send cancelQueue before closing
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'cancelQueue', payload: {} }));
      } catch {
        // Ignore send failures during close
      }
    }
    cleanup();
    addressRef.current = null;
    setQueueState('cancelled');
    setQueueStatus(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    queueState,
    queueStatus,
    matchResult,
    connect,
    cancel,
  };
}
