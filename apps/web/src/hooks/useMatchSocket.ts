import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GameState,
  WsMessage,
  TimerState,
  DamageEvent,
  GamePhase,
  MatchResult,
  MatchResultPayload,
  CardCountdownData,
  OpenCardAcceptedData,
  CardActionRejectedData,
  CardExpiredData,
  ScoreUpdateData,
  RoundOverData,
  CardType,
  PresenceUpdateData,
} from '@shared/websocket';

type ConnectionState = 'connecting' | 'reconnecting' | 'connected' | 'disconnected' | 'error';
type SocketCloseInfo = {
  code: number;
  reason: string;
  wasClean: boolean;
};

interface PlayCardResult {
  correct: boolean;
  damage: number;
  heal: number;
  multiplier: number;
  cardType: CardType;
}

interface MatchFoundPayload {
  roomId: string;
  role?: string;
  opponentAddress?: string;
  roomType?: 'public' | 'private' | 'bot';
}

interface RoomCancelledPayload {
  cancelledBy?: string | null;
  reason: 'player_cancelled' | 'deposit_timeout' | 'disconnect';
}

interface UseMatchSocketParams {
  roomId: string;
  address: string;
  characterId?: string;
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, '');
}

const MATCH_SOCKET_OPEN_TIMEOUT_MS = 6_000;
const MATCH_SOCKET_SNAPSHOT_TIMEOUT_MS = 10_000;
const MATCH_SOCKET_SNAPSHOT_RETRY_MS = 1_000;
const MATCH_SOCKET_RECONNECT_DELAY_MS = 350;
const MATCH_SOCKET_MAX_AUTO_RECONNECTS = 4;

function isSettlementPayload(value: unknown): value is MatchResultPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.winner === 'string' &&
    typeof payload.matchId === 'string' &&
    typeof payload.settlementSignature === 'string' &&
    typeof payload.serverAddress === 'string'
  );
}

function isMatchSummaryPayload(value: unknown): value is MatchResult {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    (typeof payload.winnerAddress === 'string' || payload.winnerAddress === null) &&
    typeof payload.reason === 'string' &&
    typeof payload.finalScores === 'object' &&
    typeof payload.finalHealth === 'object'
  );
}

export function useMatchSocket({ roomId, address, characterId }: UseMatchSocketParams) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastSocketError, setLastSocketError] = useState<string | null>(null);
  const [lastSocketCloseInfo, setLastSocketCloseInfo] = useState<SocketCloseInfo | null>(null);
  const [lastSocketIssueAt, setLastSocketIssueAt] = useState<number | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settlementResult, setSettlementResult] = useState<MatchResultPayload | null>(null);
  const [matchSummaryResult, setMatchSummaryResult] = useState<MatchResult | null>(null);
  const [matchInvalidated, setMatchInvalidated] = useState<MatchResult | null>(null);
  const [lastDamageEvent, setLastDamageEvent] = useState<DamageEvent | null>(null);
  const [lastPlayResult, setLastPlayResult] = useState<(PlayCardResult & { at: number }) | null>(null);
  const [lastOpenCardAccepted, setLastOpenCardAccepted] = useState<(OpenCardAcceptedData & { at: number }) | null>(null);
  const [lastCardActionRejected, setLastCardActionRejected] = useState<(CardActionRejectedData & { at: number }) | null>(null);
  const [lastCardCountdown, setLastCardCountdown] = useState<CardCountdownData | null>(null);
  const [lastCardExpired, setLastCardExpired] = useState<(CardExpiredData & { at: number }) | null>(null);
  const [lastScoreUpdate, setLastScoreUpdate] = useState<ScoreUpdateData | null>(null);
  const [lastRoundOver, setLastRoundOver] = useState<(RoundOverData & { at: number }) | null>(null);
  const [lastPresenceUpdate, setLastPresenceUpdate] = useState<(PresenceUpdateData & { at: number }) | null>(null);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('normal');
  const [depositUnlockedAt, setDepositUnlockedAt] = useState<number | null>(null);
  const [opponentFailedDepositAt, setOpponentFailedDepositAt] = useState<number | null>(null);
  const [lastRoomCancelled, setLastRoomCancelled] = useState<(RoomCancelledPayload & { at: number }) | null>(null);
  const [lastMatchFound, setLastMatchFound] = useState<(MatchFoundPayload & { at: number }) | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const wsBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080');
  const characterQuery = characterId ? `&characterId=${encodeURIComponent(characterId)}` : "";
  const socketUrl =
    roomId && address
      ? `${wsBaseUrl}/match/${roomId}?address=${encodeURIComponent(address)}${characterQuery}`
      : null;

  useEffect(() => {
    if (!socketUrl) return;

    let isCleaningUp = false;
    let hasReceivedGameState = false;
    let snapshotTimerId: ReturnType<typeof setTimeout> | null = null;
    let snapshotRetryTimerId: ReturnType<typeof setInterval> | null = null;
    let reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
    let reconnectQueued = false;
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;
    const clearSnapshotTimers = () => {
      if (snapshotTimerId) {
        clearTimeout(snapshotTimerId);
        snapshotTimerId = null;
      }
      if (snapshotRetryTimerId) {
        clearInterval(snapshotRetryTimerId);
        snapshotRetryTimerId = null;
      }
    };
    const reconnectSocket = (reason: string) => {
      if (isCleaningUp || socketRef.current !== ws || reconnectQueued) return;
      if (reconnectNonce >= MATCH_SOCKET_MAX_AUTO_RECONNECTS) {
        setConnectionState('error');
        setLastSocketIssueAt(Date.now());
        setLastSocketError(`${reason}. Rejoin the room to continue.`);
        setLastSocketCloseInfo({
          code: 0,
          reason,
          wasClean: false,
        });
        return;
      }

      reconnectQueued = true;
      console.warn(`[useMatchSocket] ${reason}; reconnecting.`);
      setConnectionState('reconnecting');
      setLastSocketIssueAt(Date.now());
      setLastSocketError(null);
      setLastSocketCloseInfo({
        code: 0,
        reason,
        wasClean: false,
      });
      clearSnapshotTimers();
      try {
        ws.close();
      } catch {
        // Ignore close failures during reconnect.
      }
      reconnectTimerId = setTimeout(() => {
        if (isCleaningUp || socketRef.current !== ws) return;
        setReconnectNonce((prev) => prev + 1);
      }, MATCH_SOCKET_RECONNECT_DELAY_MS);
    };
    const requestSnapshot = () => {
      if (isCleaningUp || socketRef.current !== ws || hasReceivedGameState) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: 'requestSnapshot', payload: {} }));
      } catch {
        reconnectSocket('Match room snapshot request failed');
      }
    };
    const openTimerId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        reconnectSocket('Match socket open timed out');
      }
    }, MATCH_SOCKET_OPEN_TIMEOUT_MS);

    queueMicrotask(() => {
      setConnectionState((prev) => {
        if (reconnectNonce > 0 || prev === 'reconnecting') {
          return 'reconnecting';
        }
        return 'connecting';
      });
    });

    ws.onopen = () => {
      clearTimeout(openTimerId);
      setConnectionState('connected');
      setLastSocketError(null);
      setLastSocketCloseInfo(null);
      setLastSocketIssueAt(null);
      requestSnapshot();
      snapshotRetryTimerId = setInterval(requestSnapshot, MATCH_SOCKET_SNAPSHOT_RETRY_MS);
      snapshotTimerId = setTimeout(() => {
        if (!hasReceivedGameState) {
          reconnectSocket('Match room snapshot timed out');
        }
      }, MATCH_SOCKET_SNAPSHOT_TIMEOUT_MS);
    };

    ws.onmessage = (event) => {
      if (isCleaningUp || socketRef.current !== ws) return;
      try {
        const message: WsMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'gameStateUpdate':
            hasReceivedGameState = true;
            clearSnapshotTimers();
            setConnectionState('connected');
            setLastSocketError(null);
            setLastSocketCloseInfo(null);
            setLastSocketIssueAt(null);
            setGameState(message.payload as GameState);
            break;

          case 'settlementAuthorization':
            if (isSettlementPayload(message.payload)) {
              setSettlementResult(message.payload);
            }
            break;

          case 'matchResult':
            if (isMatchSummaryPayload(message.payload)) {
              setMatchSummaryResult(message.payload);
            } else if (isSettlementPayload(message.payload)) {
              setSettlementResult(message.payload);
            }
            break;

          case 'matchInvalidated':
            setMatchInvalidated(message.payload as MatchResult);
            break;

          case 'timerSync':
            setGameState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                timer: message.payload as TimerState,
              };
            });
            break;

          case 'damageEvent':
            setLastDamageEvent(message.payload as DamageEvent);
            break;

          case 'phaseChange':
            setCurrentPhase(message.payload as GamePhase);
            break;

          case 'depositUnlocked':
            setDepositUnlockedAt(Date.now());
            break;

          case 'opponentFailedDeposit':
            setOpponentFailedDepositAt(Date.now());
            break;

          case 'roomCancelled':
            setLastRoomCancelled({
              ...(message.payload as RoomCancelledPayload),
              at: Date.now(),
            });
            break;

          case 'matchFound':
            setLastMatchFound({
              ...(message.payload as MatchFoundPayload),
              at: Date.now(),
            });
            break;

          // Legacy/forward-compat alias used in some older flows.
          case 'matchFoundWaiting':
            setLastMatchFound({
              ...(message.payload as MatchFoundPayload),
              at: Date.now(),
            });
            break;

          case 'playCardResult':
            setLastPlayResult({
              ...(message.payload as PlayCardResult),
              at: Date.now(),
            });
            break;

          case 'openCardAccepted':
            setLastOpenCardAccepted({
              ...(message.payload as OpenCardAcceptedData),
              at: Date.now(),
            });
            break;

          case 'cardActionRejected':
            setLastCardActionRejected({
              ...(message.payload as CardActionRejectedData),
              at: Date.now(),
            });
            break;

          case 'cardCountdown':
            setLastCardCountdown(message.payload as CardCountdownData);
            break;

          case 'cardExpired':
            setLastCardExpired({
              ...(message.payload as CardExpiredData),
              at: Date.now(),
            });
            break;

          case 'scoreUpdate':
            setLastScoreUpdate(message.payload as ScoreUpdateData);
            break;

          case 'presenceUpdate':
            setLastPresenceUpdate({
              ...(message.payload as PresenceUpdateData),
              at: Date.now(),
            });
            break;

          case 'roundOver':
            setLastRoundOver({
              ...(message.payload as RoundOverData),
              at: Date.now(),
            });
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };

    ws.onclose = (event) => {
      if (isCleaningUp || socketRef.current !== ws) return;
      clearSnapshotTimers();
      if (!event.wasClean && event.code !== 1000) {
        reconnectSocket(`Match socket closed unexpectedly (${event.code})`);
        return;
      }
      setConnectionState('disconnected');
      setLastSocketIssueAt(Date.now());
      setLastSocketCloseInfo({
        code: event.code,
        reason: event.reason || '',
        wasClean: event.wasClean,
      });
    };

    ws.onerror = (error) => {
      if (isCleaningUp || socketRef.current !== ws) return;
      console.warn('WebSocket error; retrying match socket.', error);
      reconnectSocket('Match socket error');
    };

    return () => {
      isCleaningUp = true;
      clearTimeout(openTimerId);
      clearSnapshotTimers();
      if (reconnectTimerId) {
        clearTimeout(reconnectTimerId);
      }
      ws.close();
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [socketUrl, reconnectNonce]);

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(JSON.stringify({ type, payload } as WsMessage));
  }, []);

  const openCard = useCallback(
    (cardId: string) => {
      sendMessage('openCard', { cardId });
    },
    [sendMessage],
  );

  const playCard = useCallback(
    (cardId: string, selectedOptionId: string) => {
      sendMessage('playCard', { cardId, selectedOptionId });
    },
    [sendMessage],
  );

  const confirmDeposit = useCallback(
    (signature: string) => {
      sendMessage('confirmDeposit', { signature });
    },
    [sendMessage],
  );

  const cancelMatch = useCallback(() => {
    sendMessage('cancelMatch', {});
  }, [sendMessage]);

  const surrender = useCallback(() => {
    sendMessage('surrender', {});
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    setConnectionState('reconnecting');
    setLastSocketError(null);
    setLastSocketCloseInfo(null);
    setReconnectNonce((prev) => prev + 1);
  }, []);

  return {
    connectionState,
    socketUrl,
    lastSocketError,
    lastSocketCloseInfo,
    lastSocketIssueAt,
    gameState,
    settlementResult,
    matchSummaryResult,
    matchInvalidated,
    lastDamageEvent,
    lastPlayResult,
    lastOpenCardAccepted,
    lastCardActionRejected,
    lastCardCountdown,
    lastCardExpired,
    lastScoreUpdate,
    lastRoundOver,
    lastPresenceUpdate,
    currentPhase,
    depositUnlockedAt,
    opponentFailedDepositAt,
    lastRoomCancelled,
    lastMatchFound,
    openCard,
    playCard,
    confirmDeposit,
    cancelMatch,
    surrender,
    reconnect,
  };
}
