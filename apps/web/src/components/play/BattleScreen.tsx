"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Card, CharacterState, GameStatus } from "@shared/websocket";
import { useMatchSocket } from "../../hooks/useMatchSocket";
import { MatchContextMissingState, WalletRequiredState } from "./BattleScreenGateStates";
import { MobileLandscapeGate } from "./MobileLandscapeGate";
import { MobileFullscreenButton } from "./MobileFullscreenButton";
import { BattleScreenOverlays } from "./BattleScreenOverlays";
import { BattleScreenStatusLayer, type BattleUiAlert } from "./BattleScreenStatusLayer";
import { GAME_AUDIO, playOneShotAudio, useLoopingAudio, usePreloadedAudio } from "@/lib/audio/gameAudio";
import { createBlinkChallengeSession } from "@/lib/challenge/createBlinkChallengeSession";
import { createChallengeLink, createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";
import { createMatchResultCardFileName, renderMatchResultCardPng } from "@/lib/challenge/renderMatchResultCardPng";
import {
  clearMatchSessionState,
  getMatchSessionAddress,
  isGuestBotMatchSession,
  readActiveDepositIntent,
  readActiveMatchSession,
  writeActiveBlinkChallengeSession,
  writeActiveMatchSession,
  type ActiveBlinkChallengeSession,
  type ActiveMatchSession,
} from "@/lib/session/matchSession";

type MatchOutcome = {
  cardId: string;
  outcome: "correct" | "wrong" | "timeout";
  at: number;
};

const ANSWER_TIME_SEC = 10;
const ANSWER_FEEDBACK_DISPLAY_MS = 1200;
const EMPTY_HAND: Card[] = [];
const CARD_PLACEHOLDER_COUNT = 5;
const FIXED_WAGER_USD = "1.00";
const SOCKET_ALERT_DISPLAY_MS = 12000;
const SHARE_NOTICE_DISPLAY_MS = 5000;
const REACTION_DISPLAY_MS = 1900;
const ENDGAME_TRANSITION_TOTAL_MS = 2500;
const ENDGAME_BASE_FADE_DELAY_MS = 480;
const ENDGAME_NEUTRAL_DELAY_MS = 180;
const ENDGAME_IMPACT_FLASH_MS = 340;
const ENDGAME_CRACK_REVEAL_DELAY_MS = 200;
const ENDGAME_SMOKE_REVEAL_DELAY_MS = 360;
const ARENA_TOKEN_BY_ID: Record<string, string> = {
  sol: "SOL",
  bonk: "BONK",
  mew: "MEW",
};
const ARENA_IMAGE_BY_ID: Record<string, string> = {
  sol: "/assets/arena/sol_wide.png",
  bonk: "/assets/arena/bonk_wide.png",
  mew: "/assets/arena/mew_wide.png",
};
const CARD_ART_BY_TYPE: Record<Card["type"], string> = {
  attack: "/assets/cards/attack.png",
  heal: "/assets/cards/heal.png",
};
const CARD_BACKGROUND_BY_TYPE: Record<Card["type"], string> = {
  attack: "#8a5633",
  heal: "#738b6c",
};
const CHARACTER_REACTION_EXPRESSIONS: CharacterExpression[] = ["happy", "confident", "hurt"];

const CARD_TRANSFORMS = [
  "translate-y-2 -rotate-6",
  "translate-y-0 -rotate-3",
  "-translate-y-1 rotate-0",
  "translate-y-0 rotate-3",
  "translate-y-2 rotate-6",
] as const;

const BATTLE_PRELOADED_AUDIO = [
  GAME_AUDIO.battleMusic,
  GAME_AUDIO.healing,
  GAME_AUDIO.hitted,
  GAME_AUDIO.hitting,
  GAME_AUDIO.win,
  GAME_AUDIO.lose,
  GAME_AUDIO.right,
  GAME_AUDIO.wrong,
] as const;

function getCardTransform(index: number) {
  if (index < CARD_TRANSFORMS.length) {
    return CARD_TRANSFORMS[index];
  }
  return index % 2 === 0 ? "translate-y-2 -rotate-2" : "translate-y-2 rotate-2";
}

const DESTROYED_SMOKE_PARTICLES = [
  { key: "p0", x: "12%", y: "74%", scale: 0.7, driftX: -20, driftY: -14, delay: 0.0 },
  { key: "p1", x: "26%", y: "64%", scale: 0.9, driftX: -12, driftY: -26, delay: 0.05 },
  { key: "p2", x: "42%", y: "72%", scale: 1, driftX: 2, driftY: -22, delay: 0.02 },
  { key: "p3", x: "58%", y: "66%", scale: 0.85, driftX: 14, driftY: -20, delay: 0.08 },
  { key: "p4", x: "72%", y: "76%", scale: 0.95, driftX: 18, driftY: -12, delay: 0.03 },
  { key: "p5", x: "84%", y: "68%", scale: 0.78, driftX: 24, driftY: -24, delay: 0.06 },
] as const;

function getStatusLabel(status: GameStatus) {
  if (status === "waiting") return "Waiting Opponent";
  if (status === "depositing") return "Deposit Phase";
  if (status === "playing") return "Playing";
  if (status === "settling") return "Settling";
  return "Finished";
}

function shortenAddress(address?: string) {
  if (!address) return "Unknown";
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function playerIdentityLabel(address: string | undefined, isGuest: boolean) {
  const shortAddress = shortenAddress(address);
  return isGuest && shortAddress !== "Unknown" ? `Guest ${shortAddress}` : shortAddress;
}

function rivalIdentityLabel(address: string | undefined, isBot: boolean) {
  const shortAddress = shortenAddress(address);
  return isBot && shortAddress !== "Unknown" ? `Bot ${shortAddress}` : shortAddress;
}

function formatMatchClock(remainingMs?: number) {
  if (!Number.isFinite(remainingMs) || remainingMs === undefined) {
    return "03:00";
  }
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toBaseUnitWager(wagerUsd: string) {
  const parsed = Number.parseFloat(wagerUsd);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(1, Math.round(parsed * 1_000_000_000));
}

function clearLobbyReturnState() {
  clearMatchSessionState();
}

type BattleSide = "player" | "opponent";

type ProjectileState = {
  id: string;
  from: BattleSide;
  to: BattleSide;
  src: string | null;
};

type BaseFxState = "idle" | "hit" | "heal";
type CharacterSpriteState = "stay" | "action";
type CharacterExpression = "happy" | "confident" | "hurt";
type AnswerFeedback = "correct" | "wrong";
type CharacterReaction = {
  id: string;
  expression: CharacterExpression;
};

function getCharacterVisual(characterId?: string) {
  if (characterId === "turing") {
    return {
      initial: "T",
      portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
      baseGlyph: "</>",
    };
  }
  if (characterId === "curie") {
    return {
      initial: "C",
      portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
      baseGlyph: "⚗",
    };
  }
  if (characterId === "einstein") {
    return {
      initial: "E",
      portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
      baseGlyph: "✦",
    };
  }
  return {
    initial: (characterId?.slice(0, 1) ?? "R").toUpperCase(),
    portraitBg: "linear-gradient(160deg, #173026 0%, #274137 60%, #10231b 100%)",
    baseGlyph: "⌬",
  };
}

function getCharacterName(characterId?: string) {
  const normalizedId = characterId?.trim().toLowerCase();
  if (normalizedId === "turing") return "Alan Turing";
  if (normalizedId === "curie") return "Marie Curie";
  if (normalizedId === "einstein") return "Albert Einstein";
  return "Unknown Scientist";
}

function resolveCharacterSpriteState(characterState?: CharacterState, isActioning = false): CharacterSpriteState {
  if (isActioning || characterState === "action") return "action";
  return "stay";
}

function getCharacterSpriteSrc(characterId?: string, state: CharacterSpriteState = "stay") {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  return `/assets/characters/${normalizedId}/${state}.png`;
}

function getCharacterExpressionSrc(characterId?: string, expression: CharacterExpression = "happy") {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  return `/assets/characters/${normalizedId}/exp/${expression}.png`;
}

function getCharacterProjectileSrc(characterId?: string) {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  if (normalizedId === "turing") {
    const variant = Math.random() < 0.5 ? 0 : 1;
    return `/assets/characters/turing/projectile_${variant}.png`;
  }
  return `/assets/characters/${normalizedId}/projectile.png`;
}

function getCharacterBaseSrc(characterId: string | undefined, side: BattleSide) {
  const normalizedId = characterId?.trim().toLowerCase();
  if (!normalizedId) return null;
  if (normalizedId === "einstein") {
    return side === "player"
      ? "/assets/characters/einstein/base_left.png"
      : "/assets/characters/einstein/base_right.png";
  }
  return `/assets/characters/${normalizedId}/base.png`;
}

export function BattleScreen() {
  const searchParams = useSearchParams();
  const roomIdParam = searchParams.get("roomId");
  const arenaIdParam = searchParams.get("arena");
  const [activeMatchSession, setActiveMatchSession] = useState<ActiveMatchSession | null>(null);
  const [matchSessionHydrated, setMatchSessionHydrated] = useState(false);
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;

  const connectedWalletAddress = publicKey?.toBase58() ?? "";
  const matchSessionAddress = getMatchSessionAddress(activeMatchSession);
  const roomMatchesSession = Boolean(roomIdParam && activeMatchSession?.roomId === roomIdParam);
  const guestMatchesSession = isGuestBotMatchSession(activeMatchSession) && Boolean(matchSessionAddress);
  const walletMatchesSession = Boolean(connectedWalletAddress && matchSessionAddress && connectedWalletAddress === matchSessionAddress);
  const canUseMatchSession = matchSessionHydrated && roomMatchesSession && (walletMatchesSession || guestMatchesSession);
  const address = canUseMatchSession && guestMatchesSession ? matchSessionAddress : connectedWalletAddress;
  const roomId = canUseMatchSession ? activeMatchSession?.roomId ?? "" : "";
  const arenaId = canUseMatchSession ? activeMatchSession?.arenaId ?? arenaIdParam ?? "sol" : arenaIdParam ?? "sol";
  const arenaToken = ARENA_TOKEN_BY_ID[arenaId] ?? "SOL";
  const wagerUsd = canUseMatchSession ? activeMatchSession?.wagerUsd ?? FIXED_WAGER_USD : FIXED_WAGER_USD;
  const preSignedDepositSig = canUseMatchSession ? readActiveDepositIntent(roomId, address) : null;
  const requiresWalletConnect = matchSessionHydrated && !address && !guestMatchesSession;
  const playGuardError = !roomIdParam
    ? "Missing roomId. Return to lobby and enter the match from the found flow."
    : !matchSessionHydrated
      ? null
      : !activeMatchSession
        ? "Missing local match session. Return to lobby and enter the match from the found flow."
        : activeMatchSession.roomId !== roomIdParam
          ? "This play link does not match your active local match session."
        : !matchSessionAddress
          ? "Local match session is missing a player address. Return to lobby and rejoin the match."
          : !guestMatchesSession && connectedWalletAddress && matchSessionAddress !== connectedWalletAddress
              ? "Connected wallet does not match the wallet that started this match."
              : null;

  const {
    connectionState,
    socketUrl,
    lastSocketError,
    lastSocketCloseInfo,
    lastSocketIssueAt,
    gameState,
    settlementResult,
    matchSummaryResult,
    matchInvalidated,
    lastPresenceUpdate,
    lastRoomCancelled,
    lastDamageEvent,
    lastPlayResult,
    lastOpenCardAccepted,
    lastCardActionRejected,
    lastCardCountdown,
    lastCardExpired,
    currentPhase,
    openCard,
    playCard,
    confirmDeposit,
    cancelMatch,
    surrender,
    reconnect,
  } = useMatchSocket({ roomId, address, characterId: activeMatchSession?.scientistId ?? undefined });

  useEffect(() => {
    queueMicrotask(() => {
      setActiveMatchSession(readActiveMatchSession());
      setMatchSessionHydrated(true);
    });
  }, []);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeQuestionCard, setActiveQuestionCard] = useState<Card | null>(null);
  const [activeCardAccepted, setActiveCardAccepted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_TIME_SEC);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [gameNotice, setGameNotice] = useState<{ id: string; message: string; tone: "action" | "phase" } | null>(null);
  const [characterActionSide, setCharacterActionSide] = useState<BattleSide | null>(null);
  const [characterActionKind, setCharacterActionKind] = useState<"attack" | "heal" | null>(null);
  const [projectile, setProjectile] = useState<ProjectileState | null>(null);
  const [playerBaseFx, setPlayerBaseFx] = useState<BaseFxState>("idle");
  const [opponentBaseFx, setOpponentBaseFx] = useState<BaseFxState>("idle");
  const [playerReaction, setPlayerReaction] = useState<CharacterReaction | null>(null);
  const [opponentReaction, setOpponentReaction] = useState<CharacterReaction | null>(null);
  const [outcomes, setOutcomes] = useState<MatchOutcome[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [shareNotice, setShareNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createdBlinkChallenge, setCreatedBlinkChallenge] = useState<ActiveBlinkChallengeSession | null>(null);
  const [createBlinkBusy, setCreateBlinkBusy] = useState(false);
  const [settlementDetailsOpen, setSettlementDetailsOpen] = useState(false);
  const [surrenderModalOpen, setSurrenderModalOpen] = useState(false);
  const [pendingSurrenderAfterReconnect, setPendingSurrenderAfterReconnect] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const [failedCharacterSprites, setFailedCharacterSprites] = useState<Record<string, true>>({});
  const [failedProjectileSprites, setFailedProjectileSprites] = useState<Record<string, true>>({});
  const [failedBaseSprites, setFailedBaseSprites] = useState<Record<string, true>>({});
  const [failedArenaSprites, setFailedArenaSprites] = useState<Record<string, true>>({});
  const [showSettlementOverlay, setShowSettlementOverlay] = useState(false);
  const [endgameDefeatedSide, setEndgameDefeatedSide] = useState<BattleSide | null>(null);
  const [endgameBaseFadeActive, setEndgameBaseFadeActive] = useState(false);
  const [endgameAnimationActive, setEndgameAnimationActive] = useState(false);
  const [endgameImpactFlashActive, setEndgameImpactFlashActive] = useState(false);
  const [endgameCrackVisible, setEndgameCrackVisible] = useState(false);
  const [endgameSmokeVisible, setEndgameSmokeVisible] = useState(false);

  const pendingCardIdRef = useRef<string | null>(null);
  const lastProcessedPlayAtRef = useRef(0);
  const lastProcessedOpenAcceptedAtRef = useRef(0);
  const lastProcessedCardRejectedAtRef = useRef(0);
  const lastProcessedExpiredAtRef = useRef(0);
  const lastDamageTimestampRef = useRef(0);
  const depositConfirmedRef = useRef(false);
  const extraPointShownRef = useRef(false);
  const previousOpponentConnectedRef = useRef<boolean | null>(null);
  const gameNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPlayerStreakRef = useRef(0);
  const previousOpponentStreakRef = useRef(0);
  const previousRoundsWonRef = useRef<{ player: number; opponent: number } | null>(null);
  const endgameTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const lastEndgameResultKeyRef = useRef<string | null>(null);
  const lastKnownCommittedRef = useRef(false);
  const lastTerminalSoundKeyRef = useRef<string | null>(null);
  const playerActionControls = useAnimationControls();
  const opponentActionControls = useAnimationControls();
  const playerBaseControls = useAnimationControls();
  const opponentBaseControls = useAnimationControls();

  const clearEndgameTransitionTimers = useCallback(() => {
    for (const timerId of endgameTimersRef.current) {
      clearTimeout(timerId);
    }
    endgameTimersRef.current = [];
  }, []);

  const resetEndgameVisualState = useCallback(() => {
    setShowSettlementOverlay(false);
    setEndgameDefeatedSide(null);
    setEndgameBaseFadeActive(false);
    setEndgameAnimationActive(false);
    setEndgameImpactFlashActive(false);
    setEndgameCrackVisible(false);
    setEndgameSmokeVisible(false);
  }, []);

  const showGameNotice = useCallback(
    (message: string, tone: "action" | "phase" = "action", durationMs = 2100) => {
    if (gameNoticeTimerRef.current) {
      clearTimeout(gameNoticeTimerRef.current);
      gameNoticeTimerRef.current = null;
    }
    setGameNotice({ id: `${Date.now()}`, message, tone });
    gameNoticeTimerRef.current = setTimeout(() => {
      setGameNotice(null);
      gameNoticeTimerRef.current = null;
    }, durationMs);
  },
    [],
  );

  const showReaction = useCallback(
    (side: BattleSide, expression: CharacterExpression, durationMs = REACTION_DISPLAY_MS) => {
      const id = `${side}:${expression}:${Date.now()}`;
      if (side === "player") {
        if (playerReactionTimerRef.current) {
          clearTimeout(playerReactionTimerRef.current);
          playerReactionTimerRef.current = null;
        }
        setPlayerReaction({ id, expression });
        playerReactionTimerRef.current = setTimeout(() => {
          setPlayerReaction((prev) => (prev?.id === id ? null : prev));
          playerReactionTimerRef.current = null;
        }, durationMs);
        return;
      }
      if (opponentReactionTimerRef.current) {
        clearTimeout(opponentReactionTimerRef.current);
        opponentReactionTimerRef.current = null;
      }
      setOpponentReaction({ id, expression });
      opponentReactionTimerRef.current = setTimeout(() => {
        setOpponentReaction((prev) => (prev?.id === id ? null : prev));
        opponentReactionTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const resetActiveCard = useCallback(() => {
    if (answerFeedbackTimerRef.current) {
      clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = null;
    }
    setActiveCardId(null);
    setActiveQuestionCard(null);
    setActiveCardAccepted(false);
    setAnswerLocked(false);
    setSelectedOptionId(null);
    setAnswerFeedback(null);
    pendingCardIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (gameNoticeTimerRef.current) {
        clearTimeout(gameNoticeTimerRef.current);
      }
      if (answerFeedbackTimerRef.current) {
        clearTimeout(answerFeedbackTimerRef.current);
      }
      if (playerReactionTimerRef.current) {
        clearTimeout(playerReactionTimerRef.current);
      }
      if (opponentReactionTimerRef.current) {
        clearTimeout(opponentReactionTimerRef.current);
      }
      clearEndgameTransitionTimers();
    };
  }, [clearEndgameTransitionTimers]);

  const hand = gameState?.hand ?? EMPTY_HAND;
  const displaySlots = hand.length > 0 ? hand.length : CARD_PLACEHOLDER_COUNT;
  const status = gameState?.status ?? "waiting";
  const player = gameState?.player;
  const opponent = gameState?.opponent;

  usePreloadedAudio(BATTLE_PRELOADED_AUDIO);

  useLoopingAudio(GAME_AUDIO.battleMusic, {
    enabled: roomId.length > 0,
    loop: true,
    volume: 0.18,
  });

  const activeCard = useMemo(
    () => (activeCardId ? activeQuestionCard ?? hand.find((card) => card.id === activeCardId) ?? null : null),
    [activeQuestionCard, hand, activeCardId],
  );

  useEffect(() => {
    if (!lastOpenCardAccepted) return;
    if (lastOpenCardAccepted.at === lastProcessedOpenAcceptedAtRef.current) return;
    lastProcessedOpenAcceptedAtRef.current = lastOpenCardAccepted.at;
    if (lastOpenCardAccepted.cardId !== pendingCardIdRef.current && lastOpenCardAccepted.cardId !== activeCardId) return;

    setActiveCardAccepted(true);
    setSecondsLeft(Math.max(0, Math.ceil(lastOpenCardAccepted.remainingMs / 1000)));
  }, [activeCardId, lastOpenCardAccepted]);

  useEffect(() => {
    if (!lastCardCountdown) return;
    if (lastCardCountdown.cardId !== pendingCardIdRef.current && lastCardCountdown.cardId !== activeCardId) return;

    setActiveCardAccepted(true);
    setSecondsLeft(Math.max(0, Math.ceil(lastCardCountdown.remainingMs / 1000)));
  }, [activeCardId, lastCardCountdown]);

  useEffect(() => {
    if (!lastCardActionRejected) return;
    if (lastCardActionRejected.at === lastProcessedCardRejectedAtRef.current) return;
    lastProcessedCardRejectedAtRef.current = lastCardActionRejected.at;

    const rejectedCardId = lastCardActionRejected.cardId ?? lastCardActionRejected.activeCardId ?? null;
    const affectsActiveCard =
      !rejectedCardId ||
      rejectedCardId === pendingCardIdRef.current ||
      rejectedCardId === activeCardId ||
      lastCardActionRejected.activeCardId === activeCardId;

    if (affectsActiveCard) {
      queueMicrotask(() => {
        resetActiveCard();
        showGameNotice(lastCardActionRejected.message || "Card sync lost. Please reopen the card.", "action", 2800);
      });
    }
  }, [activeCardId, lastCardActionRejected, resetActiveCard, showGameNotice]);

  useEffect(() => {
    if (!lastCardExpired) return;
    if (lastCardExpired.at === lastProcessedExpiredAtRef.current) return;
    lastProcessedExpiredAtRef.current = lastCardExpired.at;

    if (lastCardExpired.reason === "rejected") {
      queueMicrotask(() => resetActiveCard());
      return;
    }

    queueMicrotask(() => {
      setOutcomes((prev) => [
        ...prev,
        {
          cardId: lastCardExpired.cardId,
          outcome: "timeout",
          at: lastCardExpired.at,
        },
      ]);
      playOneShotAudio(GAME_AUDIO.wrong, { volume: 0.88 });
      showGameNotice("No damage this turn.");
      resetActiveCard();
    });
  }, [lastCardExpired, resetActiveCard, showGameNotice]);

  useEffect(() => {
    if (!lastPlayResult) return;
    if (lastPlayResult.at === lastProcessedPlayAtRef.current) return;
    lastProcessedPlayAtRef.current = lastPlayResult.at;

    const cardId = pendingCardIdRef.current ?? "unknown";
    setOutcomes((prev) => [
      ...prev,
      {
        cardId,
        outcome: lastPlayResult.correct ? "correct" : "wrong",
        at: lastPlayResult.at,
      },
    ]);
    playOneShotAudio(lastPlayResult.correct ? GAME_AUDIO.right : GAME_AUDIO.wrong, {
      volume: lastPlayResult.correct ? 0.82 : 0.88,
    });
    if (lastPlayResult.correct) {
      showReaction("player", "happy");
    }
    if (lastPlayResult.cardType === "heal" && lastPlayResult.heal > 0) {
      showGameNotice(`Healed: +${lastPlayResult.heal} HP`);
    } else if (lastPlayResult.cardType === "attack" && lastPlayResult.damage > 0) {
      showGameNotice(`Attack landed: -${lastPlayResult.damage} HP`);
    } else {
      showGameNotice("No damage this turn.");
    }
    setAnswerFeedback(lastPlayResult.correct ? "correct" : "wrong");
    if (answerFeedbackTimerRef.current) {
      clearTimeout(answerFeedbackTimerRef.current);
    }
    answerFeedbackTimerRef.current = setTimeout(() => {
      setActiveCardId(null);
      setActiveQuestionCard(null);
      setActiveCardAccepted(false);
      setAnswerLocked(false);
      setSelectedOptionId(null);
      setAnswerFeedback(null);
      pendingCardIdRef.current = null;
      answerFeedbackTimerRef.current = null;
    }, ANSWER_FEEDBACK_DISPLAY_MS);
  }, [lastPlayResult, showGameNotice, showReaction]);

  useEffect(() => {
    if (!lastDamageEvent) return;
    if (lastDamageEvent.timestamp === lastDamageTimestampRef.current) return;
    lastDamageTimestampRef.current = lastDamageEvent.timestamp;

    const attackerSide: BattleSide =
      lastDamageEvent.attackerAddress === player?.address ? "player" : "opponent";
    const targetSide: BattleSide =
      lastDamageEvent.targetAddress === player?.address
        ? "player"
        : lastDamageEvent.targetAddress === opponent?.address
          ? "opponent"
          : attackerSide === "player"
            ? "opponent"
            : "player";
    const actionKind = lastDamageEvent.type === "heal" ? "heal" : "attack";
    const attackerCharacterId = attackerSide === "player" ? player?.characterId : opponent?.characterId;
    const shouldSpawnProjectile = actionKind === "attack" && lastDamageEvent.damage > 0;
    const projectileSrc = shouldSpawnProjectile ? getCharacterProjectileSrc(attackerCharacterId) : null;

    setCharacterActionSide(attackerSide);
    setCharacterActionKind(actionKind);
    const projectileSpawnTimer = setTimeout(() => {
      if (shouldSpawnProjectile) {
        setProjectile({
          id: `${lastDamageEvent.timestamp}`,
          from: attackerSide,
          to: targetSide,
          src: projectileSrc,
        });
      } else {
        setProjectile(null);
      }
    }, 0);

    const actionResetTimer = setTimeout(() => {
      setCharacterActionSide(null);
      setCharacterActionKind(null);
    }, 360);
    const projectileHitTimer = setTimeout(() => {
      if (actionKind === "heal") {
        playOneShotAudio(GAME_AUDIO.healing, { volume: 0.86 });
      } else if (lastDamageEvent.damage > 0) {
        playOneShotAudio(attackerSide === "player" ? GAME_AUDIO.hitting : GAME_AUDIO.hitted, {
          volume: 0.88,
        });
      }
      setProjectile(null);
      if (targetSide === "player") {
        setPlayerBaseFx(actionKind === "heal" ? "heal" : "hit");
      } else {
        setOpponentBaseFx(actionKind === "heal" ? "heal" : "hit");
      }
    }, 440);
    const baseFxResetTimer = setTimeout(() => {
      setPlayerBaseFx("idle");
      setOpponentBaseFx("idle");
    }, 840);
    const hurtReactionTimer =
      actionKind === "attack" && lastDamageEvent.damage > 0
        ? setTimeout(() => {
          showReaction(targetSide, "hurt");
        }, 420)
        : null;

    return () => {
      clearTimeout(projectileSpawnTimer);
      clearTimeout(actionResetTimer);
      clearTimeout(projectileHitTimer);
      clearTimeout(baseFxResetTimer);
      if (hurtReactionTimer) {
        clearTimeout(hurtReactionTimer);
      }
    };
  }, [lastDamageEvent, opponent?.address, player?.address, opponent?.characterId, player?.characterId, showReaction]);

  const isPlayable = status === "playing" && connectionState === "connected";
  const hasTerminalResult = Boolean(settlementResult) || Boolean(matchSummaryResult) || Boolean(matchInvalidated);
  const isRoomCancelled = Boolean(lastRoomCancelled);
  const hasResolvedMatchResult = hasTerminalResult || isRoomCancelled;
  const isMatchComplete = hasTerminalResult || isRoomCancelled || status === "finished";
  const isCommittedState = status === "playing" || status === "settling";
  // eslint-disable-next-line react-hooks/refs -- preserve surrender eligibility across transient disconnect renders
  const canSurrenderByState = !isMatchComplete && (isCommittedState || lastKnownCommittedRef.current);
  const canCancelMatch = connectionState === "connected" && !isMatchComplete && (status === "waiting" || status === "depositing");
  const canSurrenderMatch = connectionState === "connected" && canSurrenderByState;
  const isDeviceOffline = typeof navigator !== "undefined" && !navigator.onLine;

  useEffect(() => {
    if (connectionState !== "connected") return;
    const timerId = setTimeout(() => {
      setIsRejoining(false);
    }, 0);
    return () => clearTimeout(timerId);
  }, [connectionState]);

  useEffect(() => {
    if (isCommittedState) {
      lastKnownCommittedRef.current = true;
    }
    if (isMatchComplete) {
      lastKnownCommittedRef.current = false;
    }
  }, [isCommittedState, isMatchComplete]);

  function onOpenCard(card: Card) {
    if (!isPlayable || activeCardId || isMatchComplete) return;
    if (answerFeedbackTimerRef.current) {
      clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = null;
    }
    setActiveCardId(card.id);
    setActiveQuestionCard(card);
    setActiveCardAccepted(false);
    setSecondsLeft(ANSWER_TIME_SEC);
    setAnswerLocked(false);
    setSelectedOptionId(null);
    setAnswerFeedback(null);
    pendingCardIdRef.current = card.id;
    openCard(card.id);
  }

  function onAnswer(optionId: string) {
    if (!activeCard || !activeCardAccepted || answerLocked || !isPlayable || isMatchComplete) return;
    setSelectedOptionId(optionId);
    setAnswerLocked(true);
    pendingCardIdRef.current = activeCard.id;
    playCard(activeCard.id, optionId);
  }

  function onCancelMatch() {
    if (!canCancelMatch) return;
    cancelMatch();
  }

  function onOpenSurrenderModal() {
    if (!canSurrenderMatch) return;
    setSurrenderModalOpen(true);
  }

  function onConfirmSurrender() {
    if (!canSurrenderByState) return;
    if (connectionState === "connected") {
      surrender();
      setSurrenderModalOpen(false);
      return;
    }
    setPendingSurrenderAfterReconnect(true);
    reconnect();
    setSurrenderModalOpen(false);
  }

  function onReconnectToRoom() {
    setIsRejoining(true);
    reconnect();
  }

  const playerScore = player?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const playerRoundsWon = player?.roundsWon ?? 0;
  const opponentRoundsWon = opponent?.roundsWon ?? 0;
  const playerCurrentCorrectStreak = player?.currentCorrectStreak ?? 0;
  const opponentCurrentCorrectStreak = opponent?.currentCorrectStreak ?? 0;
  const playerBaseHp = player?.baseHealth ?? 100;
  const opponentBaseHp = opponent?.baseHealth ?? 100;

  const correctCount = outcomes.filter((item) => item.outcome === "correct").length;
  const timeoutCount = outcomes.filter((item) => item.outcome === "timeout").length;
  const wrongCount = outcomes.filter((item) => item.outcome === "wrong").length;

  const winnerAddress =
    settlementResult?.winner ?? matchSummaryResult?.winnerAddress ?? matchInvalidated?.winnerAddress ?? null;
  const matchResultReason = matchSummaryResult?.reason ?? matchInvalidated?.reason ?? null;
  const isBotMatch =
    roomId.startsWith("bot-") ||
    gameState?.roomType === "bot" ||
    matchSummaryResult?.isBotMatch === true ||
    matchInvalidated?.isBotMatch === true;
  const displayPlayerAddress = activeMatchSession?.displayAddress?.trim() || address;
  const displayPlayerAsGuest = activeMatchSession?.displayAsGuest ?? guestMatchesSession;
  const surrenderedAddress = matchSummaryResult?.surrenderedAddress ?? matchInvalidated?.surrenderedAddress ?? null;
  const didCurrentPlayerSurrender = matchResultReason === "surrender" && surrenderedAddress === address;
  const didOpponentSurrender =
    matchResultReason === "surrender" && Boolean(surrenderedAddress) && surrenderedAddress !== address;
  const isDraw = matchResultReason === "draw";
  const isServerErrorFallback = matchResultReason === "server_error";
  const roomCancelledTitle =
    lastRoomCancelled?.reason === "deposit_timeout"
      ? "Deposit timed out"
      : lastRoomCancelled?.reason === "disconnect"
        ? "Match cancelled before battle start"
        : "Match cancelled";
  const roomCancelledSubtitle =
    lastRoomCancelled?.reason === "deposit_timeout"
      ? "Deposit confirmation did not complete in time."
      : lastRoomCancelled?.reason === "disconnect"
        ? "A player disconnected before the battle was ready."
        : "A player cancelled this room before battle start.";
  const settlementText = isRoomCancelled
    ? roomCancelledTitle
    : didCurrentPlayerSurrender
      ? "You Surrendered"
      : didOpponentSurrender
        ? "Opponent Surrendered"
        : winnerAddress
          ? winnerAddress === player?.address
            ? "You Win"
            : "You Lose"
          : isDraw
            ? "Draw"
            : matchInvalidated
              ? "Match Invalidated"
              : "Match Finished";
  const settlementSubtitle = isRoomCancelled
    ? roomCancelledSubtitle
    : matchInvalidated
      ? "Match invalidated."
      : isServerErrorFallback
        ? "Fast arena proof was unavailable. Wager resolution is being handled safely."
      : didCurrentPlayerSurrender
        ? "You forfeited this match. Settlement is being resolved."
        : didOpponentSurrender
          ? "Your rival surrendered. Settlement is being resolved."
          : isDraw
            ? "The match ended evenly. Settlement is being resolved."
            : winnerAddress
              ? winnerAddress === address
                ? isBotMatch
                  ? "Practice win. No Solana payout in no-stakes rounds."
                  : "Victory secured."
                : isBotMatch
                  ? "Practice loss. You did not lose Solana."
                  : "Rival took this round."
              : "Match results are being finalized."
  const settlementStatus = isRoomCancelled
    ? "Cancelled"
    : matchInvalidated
      ? "Invalidated"
      : settlementResult
        ? "Settled"
        : isServerErrorFallback
          ? "Review"
        : matchSummaryResult
          ? "Finalized"
          : "Pending";
  const settlementOutcomeKind = isRoomCancelled
    ? "cancelled"
    : matchInvalidated
      ? "invalidated"
      : isServerErrorFallback
        ? "server_error"
      : didCurrentPlayerSurrender
        ? "player_surrender"
        : didOpponentSurrender
          ? "opponent_surrender"
          : isDraw
            ? "draw"
            : winnerAddress
              ? winnerAddress === address
                ? "win"
                : "lose"
              : "pending";
  const resultDefeatedSide =
    settlementOutcomeKind === "lose" || settlementOutcomeKind === "player_surrender"
      ? "player"
      : settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender"
        ? "opponent"
        : null;
  const isSurrenderOutcome =
    settlementOutcomeKind === "player_surrender" || settlementOutcomeKind === "opponent_surrender";
  const endgameResultKey = hasResolvedMatchResult
    ? [
      settlementOutcomeKind,
      winnerAddress ?? "none",
      matchResultReason ?? "none",
      surrenderedAddress ?? "none",
      settlementResult?.matchId ?? "none",
      lastRoomCancelled?.at ?? "none",
      isSurrenderOutcome ? "surrender" : "standard",
    ].join("|")
    : null;
  const settlementStatusStyle = isRoomCancelled
    ? { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" }
    : matchInvalidated
      ? { color: "#8a3f2b", background: "rgba(185,96,62,0.14)", border: "1px solid rgba(138,63,43,0.34)" }
      : settlementResult
        ? { color: "#214335", background: "rgba(103,149,123,0.18)", border: "1px solid rgba(33,67,53,0.28)" }
        : isServerErrorFallback
          ? { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" }
        : matchSummaryResult
          ? { color: "#486357", background: "rgba(103,149,123,0.14)", border: "1px solid rgba(72,99,87,0.22)" }
        : { color: "#6f3a28", background: "rgba(214,174,119,0.2)", border: "1px solid rgba(111,58,40,0.25)" };
  const settlementEmojiMood =
    isRoomCancelled || isDraw || matchInvalidated
      ? null
      : didCurrentPlayerSurrender || (winnerAddress && winnerAddress !== address)
        ? { player: "hurt" as const, opponent: "confident" as const }
        : didOpponentSurrender || (winnerAddress && winnerAddress === address)
          ? { player: "confident" as const, opponent: "hurt" as const }
          : null;
  const showWinnerLine = Boolean(winnerAddress && !isRoomCancelled && !didCurrentPlayerSurrender && !didOpponentSurrender && (matchInvalidated || winnerAddress !== address));
  const arenaLabel = `${arenaToken} Arena`;
  const didWin = winnerAddress ? winnerAddress === address : false;
  const challengeStatusLabel = didWin ? "Winner" : "Rematch";
  const displaySecondsLeft =
    activeCardAccepted && activeCard && lastCardCountdown && lastCardCountdown.cardId === activeCard.id
      ? Math.max(0, Math.ceil(lastCardCountdown.remainingMs / 1000))
      : secondsLeft;
  const displayCountdownLabel = activeCardAccepted ? `${displaySecondsLeft}` : "...";
  const roundsToWin = gameState?.roundsToWin ?? 2;
  const maxRounds = Math.max(1, roundsToWin * 2 - 1);
  const currentRound = Math.min(maxRounds, Math.max(1, gameState?.currentRound ?? 1));
  const roundText = `Round ${currentRound}/${maxRounds}`;
  const remainingMatchClock = formatMatchClock(gameState?.timer?.remainingMs);
  const hasMatchSocket = Boolean(socketUrl);
  const isSocketRecovering = connectionState === "connecting" || connectionState === "reconnecting";
  const hasSocketIssue = connectionState === "error" || connectionState === "disconnected";
  const isRoomStateLoading = hasMatchSocket && !gameState && isSocketRecovering;
  const isRoomUnavailable = Boolean(lastSocketIssueAt) && hasMatchSocket && !gameState && hasSocketIssue;
  const presenceOpponentConnected =
    opponent?.address && lastPresenceUpdate?.players
      ? lastPresenceUpdate.players[opponent.address]?.isConnected
      : undefined;
  const opponentIsConnected = presenceOpponentConnected ?? opponent?.isConnected ?? true;
  const showOpponentAwayStatus = connectionState === "connected" && !isMatchComplete && !opponentIsConnected;
  const socketCloseText = lastSocketCloseInfo
    ? `Close code ${lastSocketCloseInfo.code}${lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}`
    : null;
  const showDisconnectedOverlay =
    Boolean(lastSocketIssueAt) &&
    connectionState !== "connected" &&
    !isMatchComplete &&
    !isRoomCancelled;
  const showRoomGateModal = isRoomUnavailable && !showOpponentAwayStatus && !showDisconnectedOverlay;
  const roomGateTitle = isRoomStateLoading
    ? "Syncing Room State"
    : isRoomUnavailable
      ? "You were disconnected"
      : status === "waiting"
        ? "Waiting For Battle"
        : "Room Locked";
  const roomGateMessage = isRoomStateLoading
    ? "Rejoining battle room after refresh. Waiting for server snapshot."
    : isRoomUnavailable
      ? "Your match is still active. Rejoin to continue."
      : `Current room status: ${getStatusLabel(status)}.`;
  const statusLabel = getStatusLabel(status);
  const phaseKey = gameState?.timer?.phase ?? currentPhase;
  const phaseLabel = phaseKey === "extra_point" ? "Phase: Extra Point x2" : "Phase: Normal";
  const winnerLineText =
    showWinnerLine && winnerAddress
      ? `Winner: ${shortenAddress(winnerAddress)}`
      : null;
  const settlementPayload = settlementResult
    ? {
      matchId: settlementResult.matchId,
      serverPublicKey: settlementResult.serverPublicKey,
      settlementSignature: settlementResult.settlementSignature,
    }
    : null;
  const opponentIdentityLabel = opponent?.address
    ? rivalIdentityLabel(opponent.address, isBotMatch)
    : isRoomStateLoading
      ? "Syncing..."
      : "Unknown";
  const playerAddressLabel = playerIdentityLabel(displayPlayerAddress, displayPlayerAsGuest);
  const regularMatchShareTitle = didWin ? "I just won in a CORA match" : "I just battled in a CORA match";
  const challengeShareTitle = didWin
    ? `I just won against ${opponentIdentityLabel}.`
    : `Matched against ${opponentIdentityLabel}, but this is not the end.`;
  const challengeDescription = didWin
    ? `I just won against ${opponentIdentityLabel} in CORA. Think you can beat me?`
    : `Matched against ${opponentIdentityLabel} in CORA, but this is not the end. Challenge me.`;
  const playerCharacterId = player?.characterId ?? undefined;
  const opponentCharacterId = opponent?.characterId ?? undefined;
  const playerCharacterName = getCharacterName(playerCharacterId);
  const opponentCharacterName = getCharacterName(opponentCharacterId);
  const playerResultExpressionSrc = getCharacterExpressionSrc(playerCharacterId, didWin ? "confident" : "hurt");
  const opponentResultExpressionSrc = getCharacterExpressionSrc(opponentCharacterId, didWin ? "hurt" : "confident");
  const challengeCharacterExpressionSrc = getCharacterExpressionSrc(playerCharacterId, didWin ? "confident" : "happy");
  const settlementExpressionSrc = settlementEmojiMood
    ? {
      player: getCharacterExpressionSrc(playerCharacterId, settlementEmojiMood.player),
      opponent: getCharacterExpressionSrc(opponentCharacterId, settlementEmojiMood.opponent),
    }
    : null;
  const playerVisual = getCharacterVisual(playerCharacterId);
  const opponentVisual = getCharacterVisual(opponentCharacterId);
  const playerSpriteState = resolveCharacterSpriteState(player?.characterState, characterActionSide === "player");
  const opponentSpriteState = resolveCharacterSpriteState(opponent?.characterState, characterActionSide === "opponent");
  const playerFacingBase = characterActionSide === "player" && characterActionKind === "heal";
  const opponentFacingBase = characterActionSide === "opponent" && characterActionKind === "heal";
  const playerSpriteSrc = getCharacterSpriteSrc(playerCharacterId, playerSpriteState);
  const opponentSpriteSrc = getCharacterSpriteSrc(opponentCharacterId, opponentSpriteState);
  const playerBaseSrc = getCharacterBaseSrc(playerCharacterId, "player");
  const opponentBaseSrc = getCharacterBaseSrc(opponentCharacterId, "opponent");
  const forcedPlayerHurtReaction =
    endgameDefeatedSide === "player" && !showSettlementOverlay
      ? ({ id: "endgame-player-hurt", expression: "hurt" } as const)
      : null;
  const forcedOpponentHurtReaction =
    endgameDefeatedSide === "opponent" && !showSettlementOverlay
      ? ({ id: "endgame-opponent-hurt", expression: "hurt" } as const)
      : null;
  const forcedPlayerConfidentReaction =
    endgameDefeatedSide === "opponent" && !showSettlementOverlay
      ? ({ id: "endgame-player-confident", expression: "confident" } as const)
      : null;
  const forcedOpponentConfidentReaction =
    endgameDefeatedSide === "player" && !showSettlementOverlay
      ? ({ id: "endgame-opponent-confident", expression: "confident" } as const)
      : null;
  const displayPlayerReaction = forcedPlayerHurtReaction ?? forcedPlayerConfidentReaction ?? playerReaction;
  const displayOpponentReaction = forcedOpponentHurtReaction ?? forcedOpponentConfidentReaction ?? opponentReaction;
  const playerReactionSrc = displayPlayerReaction
    ? getCharacterExpressionSrc(playerCharacterId, displayPlayerReaction.expression)
    : null;
  const opponentReactionSrc = displayOpponentReaction
    ? getCharacterExpressionSrc(opponentCharacterId, displayOpponentReaction.expression)
    : null;
  const hasPlayerSprite = Boolean(playerSpriteSrc && !failedCharacterSprites[playerSpriteSrc]);
  const hasOpponentSprite = Boolean(opponentSpriteSrc && !failedCharacterSprites[opponentSpriteSrc]);
  const hasPlayerBaseSprite = Boolean(playerBaseSrc && !failedBaseSprites[playerBaseSrc]);
  const hasOpponentBaseSprite = Boolean(opponentBaseSrc && !failedBaseSprites[opponentBaseSrc]);
  const hasPlayerReactionSprite = Boolean(playerReactionSrc && !failedCharacterSprites[playerReactionSrc]);
  const hasOpponentReactionSprite = Boolean(opponentReactionSrc && !failedCharacterSprites[opponentReactionSrc]);
  const playerBaseHpPct = Math.max(0, Math.min(100, playerBaseHp));
  const opponentBaseHpPct = Math.max(0, Math.min(100, opponentBaseHp));
  const targetArenaImageUrl = ARENA_IMAGE_BY_ID[arenaId] ?? null;
  const playerBaseDefeatActive = endgameDefeatedSide === "player";
  const opponentBaseDefeatActive = endgameDefeatedSide === "opponent";
  const defeatedBaseSoftMode = isSurrenderOutcome;
  const playerDestroyedEffectActive = playerBaseDefeatActive && endgameAnimationActive;
  const opponentDestroyedEffectActive = opponentBaseDefeatActive && endgameAnimationActive;
  const showEndgameNotice = isMatchComplete && !showSettlementOverlay && !hasResolvedMatchResult;
  const activeGameNotice = showEndgameNotice
    ? {
        id: "endgame-lock",
        message: "Match finished. Cards locked while result syncs.",
        tone: "phase" as const,
      }
    : gameNotice;

  useEffect(() => {
    const schedule = (callback: () => void, delayMs = 0) => {
      const timerId = setTimeout(callback, delayMs);
      endgameTimersRef.current.push(timerId);
    };

    if (!isMatchComplete || !endgameResultKey) {
      clearEndgameTransitionTimers();
      lastEndgameResultKeyRef.current = null;
      schedule(() => {
        resetEndgameVisualState();
      });
      return;
    }

    if (lastEndgameResultKeyRef.current === endgameResultKey) {
      return;
    }
    lastEndgameResultKeyRef.current = endgameResultKey;
    clearEndgameTransitionTimers();

    if (lastTerminalSoundKeyRef.current !== endgameResultKey) {
      lastTerminalSoundKeyRef.current = endgameResultKey;
      if (settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender") {
        playOneShotAudio(GAME_AUDIO.win, { volume: 0.92 });
      } else if (settlementOutcomeKind === "lose" || settlementOutcomeKind === "player_surrender") {
        playOneShotAudio(GAME_AUDIO.lose, { volume: 0.92 });
      }
    }

    schedule(() => {
      setShowSettlementOverlay(false);
      setEndgameDefeatedSide(resultDefeatedSide);
      setEndgameBaseFadeActive(false);
      setEndgameAnimationActive(Boolean(resultDefeatedSide));
      setEndgameImpactFlashActive(false);
      setEndgameCrackVisible(false);
      setEndgameSmokeVisible(false);
    });

    if (!resultDefeatedSide) {
      schedule(() => {
        setShowSettlementOverlay(true);
      }, ENDGAME_NEUTRAL_DELAY_MS);
      return;
    }

    schedule(() => {
      setEndgameImpactFlashActive(true);
      if (resultDefeatedSide === "player") {
        setPlayerBaseFx("hit");
        showReaction("player", "hurt", ENDGAME_TRANSITION_TOTAL_MS + 320);
      } else {
        setOpponentBaseFx("hit");
        showReaction("opponent", "hurt", ENDGAME_TRANSITION_TOTAL_MS + 320);
      }
    });
    schedule(() => {
      setEndgameCrackVisible(true);
    }, ENDGAME_CRACK_REVEAL_DELAY_MS);
    schedule(() => {
      setEndgameSmokeVisible(true);
    }, ENDGAME_SMOKE_REVEAL_DELAY_MS);
    schedule(() => {
      setEndgameImpactFlashActive(false);
    }, ENDGAME_IMPACT_FLASH_MS);

    schedule(() => {
      setEndgameBaseFadeActive(true);
    }, ENDGAME_BASE_FADE_DELAY_MS);
    schedule(() => {
      setShowSettlementOverlay(true);
      setEndgameAnimationActive(false);
      setPlayerBaseFx("idle");
      setOpponentBaseFx("idle");
    }, ENDGAME_TRANSITION_TOTAL_MS);

    return () => {
      clearEndgameTransitionTimers();
    };
  }, [
    clearEndgameTransitionTimers,
    endgameResultKey,
    isMatchComplete,
    resetEndgameVisualState,
    resultDefeatedSide,
    settlementOutcomeKind,
    showReaction,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function preloadExpressions(characterId?: string) {
      if (!characterId) return;
      for (const expression of CHARACTER_REACTION_EXPRESSIONS) {
        const src = getCharacterExpressionSrc(characterId, expression);
        if (!src) continue;
        const preloader = new window.Image();
        preloader.src = src;
      }
    }

    preloadExpressions(playerCharacterId);
    preloadExpressions(opponentCharacterId);
  }, [playerCharacterId, opponentCharacterId]);

  const challengeOrigin = typeof window === "undefined" ? null : window.location.origin;
  const challengeLink = createChallengeLink({
    origin: challengeOrigin,
    arenaId,
    token: arenaToken,
    wagerUsd,
    refAddress: address,
  });
  const cleanLobbyHref = "/lobby";

  function onReturnToLobbyWithActiveRoom() {
    writeActiveMatchSession({
      roomId,
      arenaId,
      arenaToken,
      token: arenaToken,
      wagerUsd,
      address,
      walletAddress: address,
      displayAddress: displayPlayerAddress,
      displayAsGuest: displayPlayerAsGuest,
      roomType: isBotMatch ? "bot" : activeMatchSession?.roomType ?? null,
      isGuest: guestMatchesSession,
      status: "playing",
      canSurrenderByState,
    });
  }

  useEffect(() => {
    if (playerSpriteState !== "action") {
      playerActionControls.start({
        scale: 1,
        y: 0,
        transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }

    playerActionControls.start({
      scale: [1, 1.05, 1],
      y: [0, -5, 0],
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    });
  }, [playerSpriteState, playerActionControls]);

  useEffect(() => {
    if (opponentSpriteState !== "action") {
      opponentActionControls.start({
        scale: 1,
        y: 0,
        transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }

    opponentActionControls.start({
      scale: [1, 1.05, 1],
      y: [0, -5, 0],
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    });
  }, [opponentSpriteState, opponentActionControls]);

  useEffect(() => {
    if (playerBaseFx === "hit") {
      playerBaseControls.start({
        x: [0, -8, 7, -5, 3, 0],
        y: [0, -1, 0],
        scale: [1, 1.01, 1],
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    if (playerBaseFx === "heal") {
      playerBaseControls.start({
        x: 0,
        y: [0, -2, 0],
        scale: [1, 1.04, 1],
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    playerBaseControls.start({
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
    });
  }, [playerBaseFx, playerBaseControls]);

  useEffect(() => {
    if (opponentBaseFx === "hit") {
      opponentBaseControls.start({
        x: [0, 8, -7, 5, -3, 0],
        y: [0, -1, 0],
        scale: [1, 1.01, 1],
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    if (opponentBaseFx === "heal") {
      opponentBaseControls.start({
        x: 0,
        y: [0, -2, 0],
        scale: [1, 1.04, 1],
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      });
      return;
    }
    opponentBaseControls.start({
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
    });
  }, [opponentBaseFx, opponentBaseControls]);

  useEffect(() => {
    if (status !== "depositing" || connectionState !== "connected") return;
    if (depositConfirmedRef.current) return;
    if (!preSignedDepositSig) return;

    confirmDeposit(preSignedDepositSig);
    depositConfirmedRef.current = true;
  }, [status, connectionState, preSignedDepositSig, confirmDeposit]);

  useEffect(() => {
    const phase = gameState?.timer?.phase ?? currentPhase;
    if (phase !== "extra_point") return;
    if (extraPointShownRef.current) return;

    extraPointShownRef.current = true;
    showGameNotice("Extra Point - every move matters.", "phase");
  }, [currentPhase, gameState?.timer?.phase, showGameNotice]);

  useEffect(() => {
    if (!isMatchComplete && !isRoomCancelled) return;
    clearLobbyReturnState();
  }, [isMatchComplete, isRoomCancelled]);

  useEffect(() => {
    if (!pendingSurrenderAfterReconnect) return;
    if (connectionState !== "connected") return;

    const timerId = setTimeout(() => {
      if (!canSurrenderByState) {
        setPendingSurrenderAfterReconnect(false);
        return;
      }
      surrender();
      setPendingSurrenderAfterReconnect(false);
    }, 0);
    return () => clearTimeout(timerId);
  }, [pendingSurrenderAfterReconnect, connectionState, canSurrenderByState, surrender]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (!opponent?.address) return;

    const previous = previousOpponentConnectedRef.current;
    previousOpponentConnectedRef.current = opponentIsConnected;
    if (previous === null || previous === opponentIsConnected) return;

    const notifyTimer = setTimeout(() => {
      if (opponentIsConnected) {
        showGameNotice("Opponent reconnected", "phase");
      } else {
        showGameNotice("Opponent disconnected", "phase");
      }
    }, 0);

    return () => clearTimeout(notifyTimer);
  }, [connectionState, opponent?.address, opponentIsConnected, showGameNotice]);

  useEffect(() => {
    const previous = previousPlayerStreakRef.current;
    previousPlayerStreakRef.current = playerCurrentCorrectStreak;
    if (playerCurrentCorrectStreak >= 3 && playerCurrentCorrectStreak !== previous) {
      showReaction("player", "confident");
    }
  }, [playerCurrentCorrectStreak, showReaction]);

  useEffect(() => {
    const previous = previousOpponentStreakRef.current;
    previousOpponentStreakRef.current = opponentCurrentCorrectStreak;
    if (opponentCurrentCorrectStreak >= 3 && opponentCurrentCorrectStreak !== previous) {
      showReaction("opponent", "confident");
    }
  }, [opponentCurrentCorrectStreak, showReaction]);

  useEffect(() => {
    const previous = previousRoundsWonRef.current;
    if (!previous) {
      previousRoundsWonRef.current = {
        player: playerRoundsWon,
        opponent: opponentRoundsWon,
      };
      return;
    }

    if (playerRoundsWon === previous.player && opponentRoundsWon === previous.opponent) {
      return;
    }

    const playerRoundDelta = playerRoundsWon - previous.player;
    const opponentRoundDelta = opponentRoundsWon - previous.opponent;

    if (playerRoundDelta > 0 && opponentRoundDelta <= 0) {
      showGameNotice("Round winner: You", "phase", 3200);
    } else if (opponentRoundDelta > 0 && playerRoundDelta <= 0) {
      showGameNotice("Round winner: Your rival", "phase", 3200);
    }

    previousRoundsWonRef.current = {
      player: playerRoundsWon,
      opponent: opponentRoundsWon,
    };
  }, [playerRoundsWon, opponentRoundsWon, showGameNotice]);

  const alerts: BattleUiAlert[] = [];
  const socketMessage = socketCloseText ?? lastSocketError ?? "Socket disconnected from match server.";
  if (lastSocketIssueAt && !showDisconnectedOverlay) {
    alerts.push({
      id: `socket:${lastSocketIssueAt}`,
      title: "Server Connection Issue",
      message: socketMessage,
      tone: "error",
      autoDismissMs: SOCKET_ALERT_DISPLAY_MS,
      actionLabel: undefined,
      onAction: undefined,
    });
  }
  if (connectionState === "reconnecting" && !showDisconnectedOverlay) {
    alerts.push({
      id: "socket:reconnecting",
      title: "Rejoining room",
      message: "Your match is still active. Rejoining battle room now.",
      tone: "warning",
      autoDismissMs: 0,
    });
  }
  if (isBotMatch && !isMatchComplete) {
    alerts.push({
      id: "bot:generated-practice-wallets",
      title: "Practice Mode",
      message: displayPlayerAsGuest
        ? "You are trying CORA in a no-stakes round. Connect a wallet when you are ready for real matches."
        : "This is a no-stakes practice round. Connect a wallet when you are ready for real matches.",
      tone: "warning",
      autoDismissMs: 14000,
    });
  }

  const missingPreSignedDeposit = !isBotMatch && status === "depositing" && connectionState === "connected" && !preSignedDepositSig;
  if (missingPreSignedDeposit) {
    alerts.push({
      id: "deposit:missing_pre_signed_intent",
      title: "Deposit Sync Error",
      message: "Missing pre-signed deposit intent. Return to lobby and start from match setup.",
      tone: "warning",
      autoDismissMs: 0,
    });
  }
  if (lastRoomCancelled) {
    alerts.push({
      id: `room:cancelled:${lastRoomCancelled.at}`,
      title: roomCancelledTitle,
      message: roomCancelledSubtitle,
      tone: "warning",
      autoDismissMs: 0,
    });
  }

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts[alert.id]);
  const autoDismissKeys = visibleAlerts
    .filter((alert) => alert.autoDismissMs > 0)
    .map((alert) => `${alert.id}:${alert.autoDismissMs}`)
    .join("|");

  useEffect(() => {
    const timerIds: Array<ReturnType<typeof setTimeout>> = [];

    for (const alert of visibleAlerts) {
      if (alert.autoDismissMs <= 0) continue;
      const timerId = setTimeout(() => {
        setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }));
      }, alert.autoDismissMs);
      timerIds.push(timerId);
    }

    return () => {
      for (const timerId of timerIds) {
        clearTimeout(timerId);
      }
    };
  }, [autoDismissKeys, visibleAlerts]);

  function dismissAlert(alertId: string) {
    setDismissedAlerts((prev) => ({ ...prev, [alertId]: true }));
  }

  function markCharacterSpriteFailed(src: string) {
    setFailedCharacterSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  function markProjectileSpriteFailed(src: string) {
    setFailedProjectileSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  function markBaseSpriteFailed(src: string) {
    setFailedBaseSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  function markArenaSpriteFailed(src: string) {
    setFailedArenaSprites((prev) => {
      if (prev[src]) return prev;
      return { ...prev, [src]: true };
    });
  }

  async function onCopyChallengeLink() {
    const shareableBlinkLink = createdBlinkChallenge?.blinkUrl ?? challengeLink;
    if (!shareableBlinkLink) {
      setShareNotice({ text: "Challenge link unavailable on this client.", tone: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(shareableBlinkLink);
      setShareNotice({ text: "Challenge link copied.", tone: "success" });
    } catch {
      setShareNotice({ text: "Copy failed. Please copy manually from the link below.", tone: "error" });
    }
  }

  async function buildMatchResultShareFile() {
    try {
      const input = {
        title: regularMatchShareTitle,
        arenaLabel,
        wagerUsd,
        playerCharacterName,
        opponentCharacterName,
        playerAddressLabel,
        opponentAddressLabel: opponentIdentityLabel,
        playerExpressionSrc: playerResultExpressionSrc,
        opponentExpressionSrc: opponentResultExpressionSrc,
        roundsLabel: `${playerRoundsWon}-${opponentRoundsWon}`,
        correctCount,
        wrongCount,
        timeoutCount,
      };
      const blob = await renderMatchResultCardPng(input);
      return new File([blob], createMatchResultCardFileName(input), { type: "image/png" });
    } catch {
      setShareNotice({ text: "Failed to generate PNG. Try again.", tone: "error" });
      return null;
    }
  }

  async function buildChallengeShareImageFile() {
    const shareableBlinkLink = createdBlinkChallenge?.blinkUrl ?? challengeLink;
    if (!shareableBlinkLink) return null;
    try {
      const blob = await renderChallengeCardJpg({
        title: challengeShareTitle,
        challengerAddress: address,
        statusLabel: challengeStatusLabel,
        description: null,
        token: arenaToken,
        wagerUsd,
        arenaLabel,
        challengeLink: shareableBlinkLink,
        characterExpressionSrc: challengeCharacterExpressionSrc,
      });
      const fileName = createChallengeCardFileName({
        title: challengeShareTitle,
        challengerAddress: address,
        statusLabel: challengeStatusLabel,
        description: null,
        token: arenaToken,
        wagerUsd,
        arenaLabel,
        challengeLink: shareableBlinkLink,
        characterExpressionSrc: challengeCharacterExpressionSrc,
      });
      return new File([blob], fileName, { type: "image/jpeg" });
    } catch {
      setShareNotice({ text: "Failed to generate JPG. Try again.", tone: "error" });
      return null;
    }
  }

  function downloadShareFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function onSaveChallengeJpg() {
    const imageFile = await buildChallengeShareImageFile();
    if (!imageFile) return;
    downloadShareFile(imageFile);
    setShareNotice({ text: "Saved challenge card JPG.", tone: "success" });
  }

  async function onSaveMatchResultPng() {
    const imageFile = await buildMatchResultShareFile();
    if (!imageFile) return;
    downloadShareFile(imageFile);
    setShareNotice({ text: "Saved match result PNG.", tone: "success" });
  }

  async function onShareChallengeToX() {
    const shareableBlinkLink = createdBlinkChallenge?.blinkUrl ?? challengeLink;
    if (!shareableBlinkLink) {
      setShareNotice({ text: "Challenge link unavailable on this client.", tone: "error" });
      return;
    }
    const imageFile = await buildChallengeShareImageFile();

    const intent = createChallengeTweetIntent(shareableBlinkLink, challengeDescription);
    const popup = window.open(intent, "_blank", "noopener,noreferrer");
    if (!popup) {
      setShareNotice({ text: "Popup blocked. Allow popups and retry.", tone: "error" });
      return;
    }
    if (imageFile) {
      downloadShareFile(imageFile);
      setShareNotice({ text: "Opened X directly. JPG downloaded, attach it to the tweet.", tone: "success" });
      return;
    }
    setShareNotice({ text: "Opened X directly.", tone: "success" });
  }

  async function onCreateBlinkFromResult() {
    if (guestMatchesSession || !connectedWalletAddress) {
      setShareNotice({ text: "Connect wallet before creating a Blink challenge.", tone: "error" });
      return;
    }
    const wagerAmount = toBaseUnitWager(wagerUsd);
    if (!wagerAmount) {
      setShareNotice({ text: "Invalid wager amount.", tone: "error" });
      return;
    }

    setCreateBlinkBusy(true);
    setShareNotice(null);
    try {
      const snapshot = await createBlinkChallengeSession({
        connection,
        wallet,
        walletAddress: connectedWalletAddress,
        tokenMint: arenaToken,
        wagerAmount,
        wagerUsd,
        arenaId,
        scientistId: playerCharacterId ?? null,
        origin: typeof window === "undefined" ? null : window.location.origin,
      });
      writeActiveBlinkChallengeSession(snapshot);
      setCreatedBlinkChallenge(snapshot);
      setShareNotice({ text: "Blink challenge funded and live.", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create Blink challenge.";
      setShareNotice({ text: message, tone: "error" });
    } finally {
      setCreateBlinkBusy(false);
    }
  }

  useEffect(() => {
    if (!shareNotice) return;
    const id = setTimeout(() => {
      setShareNotice(null);
    }, SHARE_NOTICE_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [shareNotice]);

  if (playGuardError) {
    return <MatchContextMissingState errorMessage={playGuardError} />;
  }

  if (requiresWalletConnect) {
    return <WalletRequiredState />;
  }

  return (
    <main
      className="battle-screen h-[100svh] overflow-hidden px-3 py-2 md:px-5 md:py-3"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
      }}
    >
      <MobileLandscapeGate />
      <MobileFullscreenButton />

      <BattleScreenStatusLayer
        visibleAlerts={visibleAlerts}
        socketUrl={socketUrl}
        onDismissAlert={dismissAlert}
      />

      <div className="battle-shell mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col">
        <header className="battle-room-header mb-1 flex shrink-0 flex-wrap items-center justify-between gap-1.5">
          <p className="battle-room-id font-gabarito text-xs uppercase tracking-[0.18em] text-[var(--tone-cream)]/85">
            Battle Room - {roomId}
          </p>
          <div className="battle-status-row flex flex-wrap items-center gap-1.5">
            <span
              className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {roundText}
            </span>
            <span
              className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {remainingMatchClock}
            </span>
            <span
              className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
            >
              {statusLabel} - {connectionState}
            </span>
            <span
              className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
              style={{
                border: "1px solid rgba(39,65,55,0.2)",
                background:
                  phaseKey === "extra_point"
                    ? "rgba(53,93,63,0.92)"
                    : "rgba(19,32,26,0.86)",
                color: "var(--tone-cream)",
              }}
            >
              {phaseLabel}
            </span>
            <span
              className="battle-rival-pill rounded-full px-2.5 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                border: "1px solid rgba(248,214,148,0.32)",
                background: opponentIsConnected ? "rgba(39,65,55,0.52)" : "rgba(111,58,40,0.52)",
                color: "var(--tone-cream)",
              }}
            >
              Rival {opponentIsConnected ? "Connected" : "Away"}
            </span>
            {canCancelMatch && (
              <button
                type="button"
                onClick={onCancelMatch}
                className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.38)", background: "rgba(19,32,26,0.9)", color: "var(--tone-cream)" }}
              >
                Cancel Match
              </button>
            )}
            {canSurrenderMatch && (
              <button
                type="button"
                onClick={onOpenSurrenderModal}
                className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.45)", background: "rgba(77,42,24,0.9)", color: "var(--tone-cream)" }}
              >
                Surrender
              </button>
            )}
            {(isMatchComplete || isRoomCancelled) && (
              <Link
                href={cleanLobbyHref}
                onClick={clearLobbyReturnState}
                className="battle-status-pill frame-cut frame-cut-sm px-2.5 py-0.5 font-gabarito text-[11px] font-bold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(19,32,26,0.86)", color: "var(--tone-cream)" }}
              >
                Return To Lobby
              </Link>
            )}
          </div>
        </header>

        <section
          className="battle-arena-frame frame-cut relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-2"
          style={{
            border: "1px solid rgba(248,214,148,0.28)",
            background:
              "radial-gradient(circle at 50% 18%, rgba(248,214,148,0.16), transparent 45%), linear-gradient(160deg, rgba(12,21,17,0.92), rgba(17,29,24,0.94))",
          }}
        >
          <div
            className="battle-player-strip relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-1.5 md:px-5"
            style={{ borderBottom: "1px solid rgba(248,214,148,0.12)" }}
          >
            <div className="min-w-0">
              <p className="battle-player-meta flex min-w-0 flex-wrap items-center gap-1.5 font-gabarito text-xs text-[rgba(244,240,230,0.88)]">
                <span className="font-bold text-[var(--tone-cream)]">You</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Score {playerScore}</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Rounds {playerRoundsWon}</span>
              </p>
              {address && (
                <p className="mt-0.5 font-mono text-[10px] text-[rgba(244,240,230,0.58)]">{playerAddressLabel}</p>
              )}
            </div>
            <p className="battle-vs font-caprasimo text-2xl leading-none text-[var(--tone-cream)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)] md:text-3xl">VS</p>
            <div className="min-w-0 text-right">
              <p className="battle-player-meta flex min-w-0 flex-wrap items-center justify-end gap-1.5 font-gabarito text-xs text-[rgba(244,240,230,0.88)]">
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Score {opponentScore}</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="rounded-full px-1.5 py-px text-[10px]" style={{ background: "rgba(39,65,55,0.38)", border: "1px solid rgba(248,214,148,0.18)" }}>Rounds {opponentRoundsWon}</span>
                <span className="opacity-40">{"\u00B7"}</span>
                <span className="font-bold text-[var(--tone-cream)]">Rival</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[rgba(244,240,230,0.58)]">{opponentIdentityLabel}</p>
            </div>
          </div>

          <div className="battle-stage relative min-h-0 flex-1 overflow-hidden pt-[4.25rem]">
            {targetArenaImageUrl && !failedArenaSprites[targetArenaImageUrl] && (
              <div className="pointer-events-none absolute inset-0 z-0">
                <Image
                  src={targetArenaImageUrl}
                  alt={`${arenaId} arena background`}
                  fill
                  sizes="100vw"
                  className="object-cover object-center opacity-60"
                  onError={() => markArenaSpriteFailed(targetArenaImageUrl)}
                />
                <motion.div
                  className="absolute left-[-18%] top-[8%] h-[34%] w-[56%] rounded-full blur-[52px]"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(248,214,148,0) 0%, rgba(248,214,148,0.08) 28%, rgba(248,214,148,0.18) 50%, rgba(248,214,148,0.08) 72%, rgba(248,214,148,0) 100%)",
                    mixBlendMode: "screen",
                  }}
                  animate={{
                    x: [0, 90, 0],
                    y: [0, 8, 0],
                    opacity: [0.18, 0.34, 0.18],
                  }}
                  transition={{ duration: 8.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute right-[-14%] top-[42%] h-[26%] w-[42%] rounded-full blur-[44px]"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(157,180,150,0) 0%, rgba(157,180,150,0.08) 28%, rgba(157,180,150,0.16) 52%, rgba(157,180,150,0.08) 76%, rgba(157,180,150,0) 100%)",
                    mixBlendMode: "screen",
                  }}
                  animate={{
                    x: [0, -72, 0],
                    y: [0, -10, 0],
                    opacity: [0.14, 0.28, 0.14],
                  }}
                  transition={{ duration: 10.8, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                />
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(42% 36% at 50% 36%, rgba(255,244,214,0.06) 0%, rgba(255,244,214,0.02) 40%, rgba(255,244,214,0) 72%)",
                    mixBlendMode: "screen",
                  }}
                  animate={{ opacity: [0.12, 0.26, 0.12] }}
                  transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute inset-0 bg-[rgba(12,21,17,0.4)] mix-blend-multiply" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(12,21,17,0.8)_100%)]" />
              </div>
            )}
            <AnimatePresence mode="wait">
              {activeGameNotice && (
                <motion.div
                  key={activeGameNotice.id}
                  initial={{ opacity: 0, y: -8, x: "-50%", scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                  exit={{ opacity: 0, y: -4, x: "-50%", scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="battle-notice pointer-events-none frame-cut absolute left-1/2 top-[-2rem] z-30 w-[min(92vw,34rem)] px-4 py-2.5 shadow-xl"
                  style={{
                    border:
                      activeGameNotice.tone === "phase"
                        ? "1px solid rgba(248,214,148,0.46)"
                        : "1px solid rgba(157,180,150,0.52)",
                    background:
                      activeGameNotice.tone === "phase"
                        ? "linear-gradient(145deg, rgba(54,36,21,0.93), rgba(29,20,12,0.94))"
                        : "linear-gradient(145deg, rgba(28,46,38,0.93), rgba(14,25,21,0.94))",
                    boxShadow:
                      activeGameNotice.tone === "phase"
                        ? "0 12px 28px rgba(64,43,24,0.45)"
                        : "0 12px 28px rgba(19,40,31,0.45)",
                  }}
                >
                  <p
                    className="battle-notice-kicker font-gabarito text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{
                      color:
                        activeGameNotice.tone === "phase"
                          ? "rgba(248,214,148,0.88)"
                          : "rgba(173,209,164,0.86)",
                    }}
                  >
                    {activeGameNotice.tone === "phase" ? "Battle Update" : "Combat Update"}
                  </p>
                  <p className="battle-notice-message mt-0.5 font-gabarito text-sm font-bold uppercase tracking-[0.07em] text-[var(--tone-cream)] md:text-[15px]">
                    {activeGameNotice.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div
              className="pointer-events-none absolute inset-x-[6%] bottom-[7%] z-0 h-[28%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(248,214,148,0.22) 0%, rgba(82,96,68,0.18) 42%, transparent 72%)",
              }}
            />
            <div
              className="battle-base battle-base-player pointer-events-none absolute -left-[7%] bottom-[5%] z-0 w-[clamp(200px,27vw,400px)] transition-all duration-[1500ms] ease-out"
              style={{
                opacity:
                  playerBaseDefeatActive && endgameBaseFadeActive
                    ? defeatedBaseSoftMode
                      ? 0.22
                      : 0.05
                    : 0.9,
                transform:
                  playerBaseDefeatActive && endgameBaseFadeActive
                    ? defeatedBaseSoftMode
                      ? "translateY(12px) scale(0.965)"
                      : "translateY(18px) scale(0.94)"
                    : "translateY(0) scale(1)",
              }}
            >
              <motion.div
                className="relative h-full w-full"
                style={{
                  aspectRatio: "1700 / 1269",
                  filter:
                    playerBaseFx === "hit"
                      ? "drop-shadow(0 0 24px rgba(186,105,49,0.42))"
                      : playerBaseFx === "heal"
                        ? "drop-shadow(0 0 24px rgba(157,180,150,0.45))"
                        : "drop-shadow(0 10px 16px rgba(0,0,0,0.28))",
                }}
                animate={playerBaseControls}
              >
                {hasPlayerBaseSprite && playerBaseSrc ? (
                  <Image
                    src={playerBaseSrc}
                    alt={`${playerCharacterId ?? "player"} base`}
                    fill
                    sizes="(max-width: 768px) 200px, 400px"
                    className="object-contain object-left-bottom"
                    onError={() => markBaseSpriteFailed(playerBaseSrc)}
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center rounded-2xl border"
                    style={{
                      borderColor: "rgba(248,214,148,0.36)",
                      background: "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                      boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{playerVisual.baseGlyph}</span>
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      playerDestroyedEffectActive && endgameImpactFlashActive
                        ? defeatedBaseSoftMode
                          ? "radial-gradient(circle at 54% 46%, rgba(203,95,72,0.4), rgba(203,95,72,0.04) 44%, rgba(203,95,72,0) 66%)"
                          : "radial-gradient(circle at 54% 46%, rgba(224,73,56,0.62), rgba(224,73,56,0.12) 42%, rgba(224,73,56,0) 66%)"
                        : playerBaseFx === "hit"
                          ? "radial-gradient(circle at 50% 45%, rgba(186,105,49,0.38), rgba(186,105,49,0))"
                          : playerBaseFx === "heal"
                            ? "radial-gradient(circle at 50% 45%, rgba(157,180,150,0.24), rgba(157,180,150,0))"
                            : "transparent",
                    opacity: playerDestroyedEffectActive && endgameImpactFlashActive ? 1 : 0.9,
                  }}
                />
                {playerDestroyedEffectActive && endgameCrackVisible && (
                  <div className="pointer-events-none absolute inset-[6%] z-[2] overflow-hidden rounded-[14px]">
                    <span
                      className="absolute left-[34%] top-[10%] h-[78%] w-[2px] rounded-full"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(245,227,210,0.88), rgba(85,24,16,0.78) 34%, rgba(20,8,7,0.85) 100%)",
                        transform: "rotate(-16deg)",
                        boxShadow: "0 0 10px rgba(227,88,70,0.24)",
                      }}
                    />
                    <span
                      className="absolute left-[54%] top-[16%] h-[66%] w-[2px] rounded-full"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(245,227,210,0.84), rgba(102,27,19,0.72) 38%, rgba(20,8,7,0.84) 100%)",
                        transform: "rotate(22deg)",
                        boxShadow: "0 0 8px rgba(227,88,70,0.2)",
                      }}
                    />
                    <span
                      className="absolute left-[18%] top-[42%] h-[2px] w-[56%] rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20,8,7,0), rgba(104,30,20,0.8), rgba(20,8,7,0.92))",
                        transform: "rotate(-18deg)",
                      }}
                    />
                    <span
                      className="absolute right-[14%] top-[58%] h-[2px] w-[40%] rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20,8,7,0), rgba(104,30,20,0.84), rgba(20,8,7,0.94))",
                        transform: "rotate(24deg)",
                      }}
                    />
                  </div>
                )}
                {playerDestroyedEffectActive && endgameSmokeVisible && (
                  <div className="pointer-events-none absolute inset-0 z-[3]">
                    {DESTROYED_SMOKE_PARTICLES.map((particle) => (
                      <motion.span
                        key={`player-${particle.key}`}
                        className="absolute rounded-full"
                        style={{
                          left: particle.x,
                          top: particle.y,
                          width: `${Math.round(16 * particle.scale)}px`,
                          height: `${Math.round(14 * particle.scale)}px`,
                          background:
                            "radial-gradient(circle at 45% 40%, rgba(170,178,170,0.82), rgba(76,84,78,0.4) 58%, rgba(20,20,20,0) 100%)",
                          filter: "blur(0.2px)",
                        }}
                        initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                        animate={{
                          opacity: [0, defeatedBaseSoftMode ? 0.34 : 0.5, defeatedBaseSoftMode ? 0.4 : 0.62, 0],
                          scale: [0.58, 0.96, 1.14, 1.35],
                          x: [0, particle.driftX * 0.45 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftX * (defeatedBaseSoftMode ? 0.72 : 1)],
                          y: [0, particle.driftY * 0.36 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftY * 0.76 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftY * (defeatedBaseSoftMode ? 0.72 : 1)],
                        }}
                        transition={{
                          duration: defeatedBaseSoftMode ? 1.85 : 2.05,
                          ease: [0.2, 1, 0.35, 1],
                          delay: particle.delay,
                        }}
                      />
                    ))}
                  </div>
                )}
                {playerDestroyedEffectActive && endgameSmokeVisible && (
                  <div
                    className="pointer-events-none absolute -bottom-1 left-[8%] h-[22%] w-[88%]"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 40%, rgba(83,89,81,0.36), rgba(83,89,81,0.12) 48%, rgba(83,89,81,0) 74%)",
                    }}
                  />
                )}
              </motion.div>
            </div>

            <div
              className="battle-base battle-base-opponent pointer-events-none absolute -right-[7%] bottom-[5%] z-0 w-[clamp(200px,27vw,400px)] transition-all duration-[1500ms] ease-out"
              style={{
                opacity:
                  opponentBaseDefeatActive && endgameBaseFadeActive
                    ? defeatedBaseSoftMode
                      ? 0.22
                      : 0.05
                    : 0.9,
                transform:
                  opponentBaseDefeatActive && endgameBaseFadeActive
                    ? defeatedBaseSoftMode
                      ? "translateY(12px) scale(0.965)"
                      : "translateY(18px) scale(0.94)"
                    : "translateY(0) scale(1)",
              }}
            >
              <motion.div
                className="relative h-full w-full"
                style={{
                  aspectRatio: "1700 / 1269",
                  filter:
                    opponentBaseFx === "hit"
                      ? "drop-shadow(0 0 24px rgba(186,105,49,0.42))"
                      : opponentBaseFx === "heal"
                        ? "drop-shadow(0 0 24px rgba(157,180,150,0.45))"
                        : "drop-shadow(0 10px 16px rgba(0,0,0,0.28))",
                }}
                animate={opponentBaseControls}
              >
                {hasOpponentBaseSprite && opponentBaseSrc ? (
                  <Image
                    src={opponentBaseSrc}
                    alt={`${opponentCharacterId ?? "opponent"} base`}
                    fill
                    sizes="(max-width: 768px) 200px, 400px"
                    className={`object-contain object-right-bottom ${opponentCharacterId?.trim().toLowerCase() === "einstein" ? "" : "-scale-x-100"
                      }`}
                    onError={() => markBaseSpriteFailed(opponentBaseSrc)}
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center rounded-2xl border"
                    style={{
                      borderColor: "rgba(248,214,148,0.36)",
                      background: "linear-gradient(150deg, rgba(37,63,51,0.9), rgba(18,33,27,0.94))",
                      boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="font-caprasimo text-3xl text-[rgba(248,214,148,0.88)]">{opponentVisual.baseGlyph}</span>
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      opponentDestroyedEffectActive && endgameImpactFlashActive
                        ? defeatedBaseSoftMode
                          ? "radial-gradient(circle at 46% 46%, rgba(203,95,72,0.4), rgba(203,95,72,0.04) 44%, rgba(203,95,72,0) 66%)"
                          : "radial-gradient(circle at 46% 46%, rgba(224,73,56,0.62), rgba(224,73,56,0.12) 42%, rgba(224,73,56,0) 66%)"
                        : opponentBaseFx === "hit"
                          ? "radial-gradient(circle at 50% 45%, rgba(186,105,49,0.38), rgba(186,105,49,0))"
                          : opponentBaseFx === "heal"
                            ? "radial-gradient(circle at 50% 45%, rgba(157,180,150,0.24), rgba(157,180,150,0))"
                            : "transparent",
                    opacity: opponentDestroyedEffectActive && endgameImpactFlashActive ? 1 : 0.9,
                  }}
                />
                {opponentDestroyedEffectActive && endgameCrackVisible && (
                  <div className="pointer-events-none absolute inset-[6%] z-[2] overflow-hidden rounded-[14px]">
                    <span
                      className="absolute right-[34%] top-[10%] h-[78%] w-[2px] rounded-full"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(245,227,210,0.88), rgba(85,24,16,0.78) 34%, rgba(20,8,7,0.85) 100%)",
                        transform: "rotate(16deg)",
                        boxShadow: "0 0 10px rgba(227,88,70,0.24)",
                      }}
                    />
                    <span
                      className="absolute right-[54%] top-[16%] h-[66%] w-[2px] rounded-full"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(245,227,210,0.84), rgba(102,27,19,0.72) 38%, rgba(20,8,7,0.84) 100%)",
                        transform: "rotate(-22deg)",
                        boxShadow: "0 0 8px rgba(227,88,70,0.2)",
                      }}
                    />
                    <span
                      className="absolute right-[18%] top-[42%] h-[2px] w-[56%] rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20,8,7,0), rgba(104,30,20,0.8), rgba(20,8,7,0.92))",
                        transform: "rotate(18deg)",
                      }}
                    />
                    <span
                      className="absolute left-[14%] top-[58%] h-[2px] w-[40%] rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(20,8,7,0), rgba(104,30,20,0.84), rgba(20,8,7,0.94))",
                        transform: "rotate(-24deg)",
                      }}
                    />
                  </div>
                )}
                {opponentDestroyedEffectActive && endgameSmokeVisible && (
                  <div className="pointer-events-none absolute inset-0 z-[3]">
                    {DESTROYED_SMOKE_PARTICLES.map((particle) => (
                      <motion.span
                        key={`opponent-${particle.key}`}
                        className="absolute rounded-full"
                        style={{
                          left: particle.x,
                          top: particle.y,
                          width: `${Math.round(16 * particle.scale)}px`,
                          height: `${Math.round(14 * particle.scale)}px`,
                          background:
                            "radial-gradient(circle at 45% 40%, rgba(170,178,170,0.82), rgba(76,84,78,0.4) 58%, rgba(20,20,20,0) 100%)",
                          filter: "blur(0.2px)",
                        }}
                        initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                        animate={{
                          opacity: [0, defeatedBaseSoftMode ? 0.34 : 0.5, defeatedBaseSoftMode ? 0.4 : 0.62, 0],
                          scale: [0.58, 0.96, 1.14, 1.35],
                          x: [0, particle.driftX * 0.45 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftX * (defeatedBaseSoftMode ? 0.72 : 1)],
                          y: [0, particle.driftY * 0.36 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftY * 0.76 * (defeatedBaseSoftMode ? 0.72 : 1), particle.driftY * (defeatedBaseSoftMode ? 0.72 : 1)],
                        }}
                        transition={{
                          duration: defeatedBaseSoftMode ? 1.85 : 2.05,
                          ease: [0.2, 1, 0.35, 1],
                          delay: particle.delay,
                        }}
                      />
                    ))}
                  </div>
                )}
                {opponentDestroyedEffectActive && endgameSmokeVisible && (
                  <div
                    className="pointer-events-none absolute -bottom-1 left-[8%] h-[22%] w-[88%]"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 40%, rgba(83,89,81,0.36), rgba(83,89,81,0.12) 48%, rgba(83,89,81,0) 74%)",
                    }}
                  />
                )}
              </motion.div>
            </div>

            <div className="battle-base-meter battle-base-meter-player absolute left-3 top-3 z-20 w-[clamp(132px,17vw,190px)] md:left-5">
              <div className="battle-base-meter-labels flex items-center justify-between gap-2">
                <p className="battle-base-meter-title font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(244,240,230,0.82)]">Base</p>
                <p className="battle-base-meter-value font-mono text-[11px] text-[rgba(244,240,230,0.86)]">{playerBaseHp} / 100</p>
              </div>
              <div className="battle-base-meter-track mt-1 h-2 overflow-hidden rounded-full border border-[rgba(248,214,148,0.34)] bg-[rgba(19,32,26,0.72)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${playerBaseHpPct}%`,
                    background: "linear-gradient(90deg, #d9a85b, #ba6931)",
                  }}
                />
              </div>
            </div>

            <div className="battle-base-meter battle-base-meter-opponent absolute right-3 top-3 z-20 w-[clamp(132px,17vw,190px)] text-right md:right-5">
              <div className="battle-base-meter-labels flex items-center justify-between gap-2">
                <p className="battle-base-meter-value font-mono text-[11px] text-[rgba(244,240,230,0.86)]">{opponentBaseHp} / 100</p>
                <p className="battle-base-meter-title font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(244,240,230,0.82)]">Base</p>
              </div>
              <div className="battle-base-meter-track mt-1 h-2 overflow-hidden rounded-full border border-[rgba(248,214,148,0.34)] bg-[rgba(19,32,26,0.72)]">
                <div
                  className="ml-auto h-full rounded-full"
                  style={{
                    width: `${opponentBaseHpPct}%`,
                    background: "linear-gradient(270deg, #d9a85b, #ba6931)",
                  }}
                />
              </div>
            </div>

            <motion.div
              className={`battle-character battle-character-player absolute left-[21%] bottom-[12%] z-[6] aspect-[4/5] w-[clamp(110px,16vw,176px)] transition-all duration-300 ${characterActionSide === "player" ? "-translate-y-2 rotate-[-2deg]" : ""
                }`}
              animate={playerActionControls}
            >
              <div className="relative h-full w-full animate-soft-breath">
                <AnimatePresence>
                  {displayPlayerReaction && playerReactionSrc && hasPlayerReactionSprite && (
                    <motion.div
                      key={displayPlayerReaction.id}
                      className="pointer-events-none absolute -left-[5.6rem] top-6 z-20 md:-left-[6.2rem]"
                      initial={{ opacity: 0, y: 8, scale: 0.88 }}
                      animate={{ opacity: 1, y: [8, 0, -1], scale: [0.88, 1.04, 1] }}
                      exit={{ opacity: 0, y: -7, scale: 0.96 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="relative rounded-[22px] border p-1.5"
                        style={{
                          borderColor: "rgba(248,214,148,0.58)",
                          background: "linear-gradient(150deg, rgba(255,249,235,0.98), rgba(246,228,195,0.98))",
                          boxShadow: "0 12px 22px rgba(0,0,0,0.28)",
                        }}
                      >
                        <div className="relative h-20 w-20 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.16)] md:h-[5.5rem] md:w-[5.5rem]">
                          <Image
                            src={playerReactionSrc}
                            alt={`${playerCharacterId ?? "player"} ${displayPlayerReaction.expression} reaction`}
                            fill
                            sizes="(max-width: 768px) 80px, 88px"
                            className="object-cover object-center"
                            onError={() => markCharacterSpriteFailed(playerReactionSrc)}
                          />
                        </div>
                        <span
                          className="absolute -right-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-r border-b"
                          style={{
                            borderColor: "rgba(248,214,148,0.58)",
                            background: "rgba(246,228,195,0.98)",
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hasPlayerSprite && playerSpriteSrc ? (
                  <Image
                    src={playerSpriteSrc}
                    alt={`${playerCharacterId ?? "player"} ${playerSpriteState} portrait`}
                    fill
                    sizes="(max-width: 768px) 130px, 200px"
                    className={`object-contain object-center transition-transform duration-200 ${playerFacingBase ? "-scale-x-100" : ""}`}
                    onError={() => markCharacterSpriteFailed(playerSpriteSrc)}
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <span className="font-caprasimo text-7xl text-[rgba(255,244,221,0.9)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
                      {playerVisual.initial}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              className={`battle-character battle-character-opponent absolute right-[21%] bottom-[12%] z-[6] aspect-[4/5] w-[clamp(110px,16vw,176px)] transition-all duration-300 ${characterActionSide === "opponent" ? "-translate-y-2 rotate-[2deg]" : ""
                }`}
              animate={opponentActionControls}
            >
              <div className="relative h-full w-full animate-soft-breath">
                <AnimatePresence>
                  {displayOpponentReaction && opponentReactionSrc && hasOpponentReactionSprite && (
                    <motion.div
                      key={displayOpponentReaction.id}
                      className="pointer-events-none absolute -right-[5.6rem] top-6 z-20 md:-right-[6.2rem]"
                      initial={{ opacity: 0, y: 8, scale: 0.88 }}
                      animate={{ opacity: 1, y: [8, 0, -1], scale: [0.88, 1.04, 1] }}
                      exit={{ opacity: 0, y: -7, scale: 0.96 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="relative rounded-[22px] border p-1.5"
                        style={{
                          borderColor: "rgba(248,214,148,0.58)",
                          background: "linear-gradient(150deg, rgba(255,249,235,0.98), rgba(246,228,195,0.98))",
                          boxShadow: "0 12px 22px rgba(0,0,0,0.28)",
                        }}
                      >
                        <div className="relative h-20 w-20 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.16)] md:h-[5.5rem] md:w-[5.5rem]">
                          <Image
                            src={opponentReactionSrc}
                            alt={`${opponentCharacterId ?? "opponent"} ${displayOpponentReaction.expression} reaction`}
                            fill
                            sizes="(max-width: 768px) 80px, 88px"
                            className="object-cover object-center"
                            onError={() => markCharacterSpriteFailed(opponentReactionSrc)}
                          />
                        </div>
                        <span
                          className="absolute -left-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-l border-t"
                          style={{
                            borderColor: "rgba(248,214,148,0.58)",
                            background: "rgba(246,228,195,0.98)",
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hasOpponentSprite && opponentSpriteSrc ? (
                  <Image
                    src={opponentSpriteSrc}
                    alt={`${opponentCharacterId ?? "opponent"} ${opponentSpriteState} portrait`}
                    fill
                    sizes="(max-width: 768px) 130px, 200px"
                    className={`object-contain object-center transition-transform duration-200 ${opponentFacingBase ? "" : "-scale-x-100"}`}
                    onError={() => markCharacterSpriteFailed(opponentSpriteSrc)}
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <span className="font-caprasimo text-7xl text-[rgba(255,244,221,0.9)] drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
                      {opponentVisual.initial}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {projectile && (
              <motion.div
                key={projectile.id}
                className="pointer-events-none absolute left-1/2 top-[42%] z-[12] h-12 w-12 -translate-x-1/2 -translate-y-1/2"
                initial={{
                  x: projectile.from === "player" ? -180 : 180,
                  y: projectile.from === "player" ? 40 : -40,
                  opacity: 0.22,
                  scale: 0.72,
                }}
                animate={{
                  x: projectile.to === "player" ? -210 : 210,
                  y: projectile.to === "player" ? 10 : -10,
                  opacity: 1,
                  scale: 1,
                }}
                transition={{ duration: 0.42, ease: [0.2, 1, 0.3, 1] }}
              >
                <div className="relative h-full w-full">
                  <div
                    className="absolute inset-0 rounded-full blur-[7px]"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(248,214,148,0.62) 0%, rgba(248,214,148,0.28) 46%, rgba(248,214,148,0) 76%)",
                    }}
                  />
                  {projectile.src && !failedProjectileSprites[projectile.src] ? (
                    <Image
                      src={projectile.src}
                      alt="Projectile effect"
                      fill
                      sizes="48px"
                      className="object-contain object-center drop-shadow-[0_0_8px_rgba(248,214,148,0.38)]"
                      onError={() => markProjectileSpriteFailed(projectile.src!)}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <span className="font-caprasimo text-lg text-[var(--tone-cream)] drop-shadow-[0_0_8px_rgba(248,214,148,0.5)]">
                        {"\u2726"}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </div>

          <div className="battle-hand-panel relative z-20 shrink-0 px-3 pb-3 pt-0.5 md:px-5">
            <AnimatePresence>
              {activeCard && status === "playing" && !isMatchComplete && (
                <motion.div
                  key={activeCard.id}
                  initial={{ opacity: 0, y: 10, x: "-50%", scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                  exit={{ opacity: 0, y: 6, x: "-50%", scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="battle-question-card pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[min(92vw,48rem)] overflow-hidden rounded-[18px] p-2 md:p-2.5"
                  style={{
                    border: "1px solid rgba(248,214,148,0.36)",
                    background: "linear-gradient(150deg, rgba(255,246,228,0.96), rgba(243,221,185,0.96))",
                    boxShadow: "0 14px 26px rgba(0,0,0,0.28)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-gabarito text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6d8373]">
                        Question
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-gabarito text-sm font-semibold leading-snug text-[#1f2b24] md:text-base">
                        {activeCard.question.text}
                      </p>
                    </div>
                    <p className="shrink-0 font-caprasimo text-3xl leading-none text-[#ba6931]">{displayCountdownLabel}</p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 md:gap-2">
                    {activeCard.question.options.map((option) => {
                      const isSelected = selectedOptionId === option.id;
                      const selectedCorrect = isSelected && answerFeedback === "correct";
                      const selectedWrong = isSelected && answerFeedback === "wrong";
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!activeCardAccepted || answerLocked || isMatchComplete}
                          onClick={() => onAnswer(option.id)}
                          className="relative min-h-10 overflow-hidden rounded-xl px-2.5 py-2 text-left transition hover:-translate-y-0.5 disabled:cursor-default"
                          style={{
                            border: selectedCorrect
                              ? "1px solid rgba(76,120,82,0.58)"
                              : selectedWrong
                                ? "1px solid rgba(140,70,48,0.62)"
                                : isSelected
                                  ? "1px solid rgba(186,105,49,0.5)"
                                  : "1px solid rgba(111,58,40,0.24)",
                            background: selectedCorrect
                              ? "linear-gradient(160deg, rgba(86,133,93,0.98), rgba(53,93,63,0.98))"
                              : selectedWrong
                                ? "linear-gradient(160deg, rgba(233,201,184,0.98), rgba(188,116,83,0.96))"
                                : isSelected
                                  ? "linear-gradient(160deg, rgba(248,225,181,0.98), rgba(231,190,128,0.96))"
                                  : "linear-gradient(160deg, rgba(255,250,239,0.96), rgba(243,224,191,0.96))",
                            boxShadow: isSelected
                              ? "0 0 0 2px rgba(248,214,148,0.18), 0 8px 14px rgba(77,42,24,0.16)"
                              : "0 6px 10px rgba(77,42,24,0.12)",
                            opacity: !activeCardAccepted || (answerLocked && !isSelected) ? 0.72 : 1,
                          }}
                        >
                          <span
                            className="font-gabarito text-[10px] font-black uppercase tracking-wider"
                            style={{ color: selectedWrong ? "#6f3a28" : selectedCorrect ? "rgba(240,249,238,0.96)" : "#6d8373" }}
                          >
                            {option.id}
                          </span>
                          <span
                            className="ml-2 font-gabarito text-xs font-semibold md:text-sm"
                            style={{ color: selectedWrong ? "#3f2419" : selectedCorrect ? "rgba(249,253,248,0.96)" : "#1f2b24" }}
                          >
                            {option.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="battle-hand-prompt mb-3 flex justify-center">
              <p
                className={`inline-flex items-center rounded-full px-3 py-1 text-center font-gabarito text-xs ${
                  isPlayable && !activeCard && !isMatchComplete
                    ? "font-bold uppercase tracking-[0.14em]"
                    : "font-medium"
                }`}
                style={
                  isPlayable && !activeCard && !isMatchComplete
                    ? {
                        color: "rgba(255,248,235,0.98)",
                        border: "1px solid rgba(248,214,148,0.28)",
                        background:
                          "linear-gradient(180deg, rgba(38,58,49,0.84) 0%, rgba(20,35,29,0.88) 100%)",
                        boxShadow:
                          "0 10px 20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,248,235,0.08)",
                        textShadow: "0 2px 8px rgba(0,0,0,0.34)",
                      }
                    : {
                        color: "rgba(244,240,230,0.86)",
                      }
                }
              >
                {isMatchComplete
                  ? "Match locked. Resolving final sequence."
                  : activeCard && status === "playing"
                    ? activeCardAccepted
                      ? "Choose an answer."
                      : "Opening card..."
                    : isPlayable
                      ? "Pick a card from your hand"
                      : "Waiting for server state..."}
              </p>
            </div>

            <div className="battle-card-row mx-auto flex max-w-4xl items-end justify-center gap-2 md:gap-3">
              {Array.from({ length: displaySlots }).map((_, index) => {
                const card = hand[index] ?? null;
                const active = card ? activeCardId === card.id : false;
                const visuallyActive = active && !isMatchComplete;
                const transformClass = getCardTransform(index);
                const cardDisabled = !card || !isPlayable || Boolean(activeCardId) || isMatchComplete;
                const cardArtSrc = card ? CARD_ART_BY_TYPE[card.type] : null;
                const cardBackground = card ? CARD_BACKGROUND_BY_TYPE[card.type] : null;
                return (
                  <button
                    key={card?.id ?? `placeholder-${index}`}
                    type="button"
                    onClick={() => {
                      if (card) onOpenCard(card);
                    }}
                    disabled={cardDisabled}
                    className={`battle-hand-card relative aspect-[5/7] w-[13vw] min-w-[58px] max-w-[118px] overflow-hidden rounded-[18px] px-2 py-2 text-left transition duration-200 ease-out enabled:hover:-translate-y-2 enabled:hover:scale-[1.03] ${transformClass}`}
                    style={{
                      border: visuallyActive ? "2px solid rgba(248,214,148,0.95)" : "2px solid rgba(111,58,40,0.52)",
                      background: cardBackground
                        ? cardBackground
                        : cardDisabled
                          ? "linear-gradient(165deg, rgba(228,210,181,0.84) 0%, rgba(205,183,156,0.84) 100%)"
                          : "linear-gradient(165deg, #fff7e6 0%, #f6dfbd 100%)",
                      opacity: visuallyActive ? 1 : cardDisabled ? 0.68 : 1,
                      boxShadow: visuallyActive
                        ? "0 0 0 2px rgba(248,214,148,0.25), 0 16px 28px rgba(0,0,0,0.34)"
                        : "0 12px 22px rgba(0,0,0,0.3)",
                    }}
                  >
                    {cardArtSrc ? (
                      <div className="pointer-events-none absolute inset-[6%] overflow-hidden rounded-[14px] border border-[rgba(255,245,230,0.2)]">
                        <Image
                          src={cardArtSrc}
                          alt={`${card?.type ?? "battle"} card`}
                          fill
                          sizes="(max-width: 768px) 118px, 130px"
                          className="object-cover object-center"
                        />
                      </div>
                    ) : (
                      <>
                        <div
                          className="pointer-events-none absolute inset-[8%] rounded-2xl"
                          style={{
                            border: "1px solid rgba(111,58,40,0.24)",
                            background:
                              "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.38), transparent 44%), linear-gradient(150deg, rgba(255,245,226,0.64), rgba(241,217,181,0.68))",
                          }}
                        />
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "repeating-linear-gradient(135deg, rgba(111,58,40,0.08) 0 6px, rgba(111,58,40,0) 6px 14px)",
                          }}
                        />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <BattleScreenOverlays
        showRoomGateModal={showRoomGateModal}
        roomGateTitle={roomGateTitle}
        roomGateMessage={roomGateMessage}
        hasSocketIssue={hasSocketIssue}
        onReconnect={onReconnectToRoom}
        cleanLobbyHref={cleanLobbyHref}
        onReturnToLobby={clearLobbyReturnState}
        onDisconnectedReturnToLobby={onReturnToLobbyWithActiveRoom}
        showDisconnectedOverlay={showDisconnectedOverlay}
        isDeviceOffline={isDeviceOffline}
        isRejoining={isRejoining}
        onConfirmSurrender={onConfirmSurrender}
        isMatchComplete={isMatchComplete}
        showSettlementOverlay={showSettlementOverlay}
        surrenderModalOpen={surrenderModalOpen}
        canSurrenderMatch={canSurrenderMatch}
        onCloseSurrenderModal={() => setSurrenderModalOpen(false)}
        settlementText={settlementText}
        settlementSubtitle={settlementSubtitle}
        isBotMatch={isBotMatch}
        settlementOutcomeKind={settlementOutcomeKind}
        settlementEmojiMood={settlementEmojiMood}
        settlementExpressionSrc={settlementExpressionSrc}
        settlementStatus={settlementStatus}
        settlementStatusStyle={settlementStatusStyle}
        winnerLineText={winnerLineText}
        playerRoundsWon={playerRoundsWon}
        opponentRoundsWon={opponentRoundsWon}
        correctCount={correctCount}
        timeoutCount={timeoutCount}
        wrongCount={wrongCount}
        settlementDetailsOpen={settlementDetailsOpen}
        onToggleSettlementDetails={() => setSettlementDetailsOpen((prev) => !prev)}
        settlementPayload={settlementPayload}
        onOpenShareModal={() => setShareModalOpen(true)}
        shareModalOpen={shareModalOpen}
        onCloseShareModal={() => setShareModalOpen(false)}
        address={address}
        arenaLabel={arenaLabel}
        arenaToken={arenaToken}
        wagerUsd={wagerUsd}
        regularMatchShareTitle={regularMatchShareTitle}
        playerCharacterName={playerCharacterName}
        opponentCharacterName={opponentCharacterName}
        playerAddressLabel={playerAddressLabel}
        opponentAddressLabel={opponentIdentityLabel}
        playerResultExpressionSrc={playerResultExpressionSrc}
        opponentResultExpressionSrc={opponentResultExpressionSrc}
        challengeShareTitle={challengeShareTitle}
        challengeStatusLabel={challengeStatusLabel}
        challengeCharacterExpressionSrc={challengeCharacterExpressionSrc}
        createdBlinkChallenge={createdBlinkChallenge}
        createBlinkBusy={createBlinkBusy}
        onSaveMatchResultPng={onSaveMatchResultPng}
        onCreateBlinkFromResult={onCreateBlinkFromResult}
        onCopyChallengeLink={onCopyChallengeLink}
        onSaveChallengeJpg={onSaveChallengeJpg}
        onShareChallengeToX={onShareChallengeToX}
        shareNotice={shareNotice}
      />
    </main>
  );
}
