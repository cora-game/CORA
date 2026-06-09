"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AnimatePresence, motion } from "framer-motion";
import { LobbySetup } from "./LobbySetup";
import { CharacterSelect } from "./CharacterSelect";
import { MatchmakingWaiting } from "./MatchmakingWaiting";
import { OpponentFound } from "./OpponentFound";
import { IntroOverlay } from "./IntroOverlay";
import { createBotMatch, getActiveMatchForAddress } from "@/lib/matchmaking/queueMatch";
import { useQueueSocket } from "@/hooks/useQueueSocket";
import {
  getPrivateChallenge,
  getWebChallengeUrl,
  type PrivateChallengeStatus,
} from "@/lib/matchmaking/privateChallenge";
import { getRuntimeConfig } from "@/lib/config/runtimeModes";
import { BlinkChallengePanel } from "@/components/challenge/BlinkChallengePanel";
import { BlinkCharacterGate } from "@/components/challenge/BlinkCharacterGate";
import { BlinkRoomJoiner } from "@/components/challenge/BlinkRoomJoiner";
import { BlinkSurrenderBridge } from "@/components/challenge/BlinkSurrenderBridge";
import { RoomPhaseShell } from "@/components/room/RoomPhaseShell";
import { CharacterSelect as CharacterSelectPanel } from "@/components/character/CharacterSelect";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { createBlinkChallengeSession } from "@/lib/challenge/createBlinkChallengeSession";
import {
  readActiveBlinkChallengeSession,
  getMatchSessionAddress,
  getMatchSessionToken,
  isLiveMatchSession,
  readActiveMatchSession,
  readLobbyDraftSnapshot,
  writeActiveBlinkChallengeSession,
  clearActiveMatchRoomSession,
  writeActiveMatchSession,
  writeLobbyDraftSnapshot,
  type ActiveBlinkChallengeSession,
  type ActiveMatchSession,
  type LobbyDraftSnapshot,
} from "@/lib/session/matchSession";
import { DepositIntentError } from "@/lib/evm/deposit";
import type {
  CharacterOption,
  CharacterSelectionState,
  OpponentCharacterStatus,
} from "@/components/character/characterTypes";

export type Scientist = {
  id: string;
  name: string;
  base: string;
  accentColor: string;
  portraitBg: string;
  initial: string;
};

export type Arena = {
  id: string;
  token: string;
  label: string;
  accent: string;
  frame: string;
  previewBg: string;
};

export const SCIENTISTS: Scientist[] = [
  {
    id: "turing",
    name: "Alan Turing",
    base: "The Computer",
    accentColor: "#9db496",
    portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
    initial: "T",
  },
  {
    id: "curie",
    name: "Marie Curie",
    base: "The Laboratory",
    accentColor: "#ba6931",
    portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
    initial: "C",
  },
  {
    id: "einstein",
    name: "Albert Einstein",
    base: "The Relativity Room",
    accentColor: "#f8d694",
    portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
    initial: "E",
  },
];

export const ARENAS: Arena[] = [
  {
    id: "eth",
    token: "ETH",
    label: "ETH Arena",
    accent: "#9db496",
    frame: "#274137",
    previewBg:
      "radial-gradient(circle at 20% 20%, rgba(157,180,150,0.28), transparent 45%), radial-gradient(circle at 80% 80%, rgba(203,227,193,0.22), transparent 45%), linear-gradient(155deg, #eef6ec 0%, #ddebd8 60%, #d2e2cd 100%)",
  },
  {
    id: "usdc",
    token: "USDC",
    label: "USDC Arena",
    accent: "#5b8def",
    frame: "#27407f",
    previewBg:
      "radial-gradient(circle at 22% 24%, rgba(91,141,239,0.30), transparent 48%), radial-gradient(circle at 75% 78%, rgba(39,64,127,0.22), transparent 44%), linear-gradient(150deg, #eef3fb 0%, #dbe6f7 58%, #c9d8ef 100%)",
  },
];

type Phase = "setup" | "character-select" | "waiting" | "found";
type MatchmakingState = "idle" | "searching" | "timeout" | "error";
type MatchmakingStage = "finding" | "verifying" | "preparing";
const FIXED_WAGER_USD = "1.00";
const BOT_OFFER_DELAY_MS = 15_000;
const BOT_MATCH_START_TIMEOUT_MS = 10_000;
// OpponentFound owns deposit transaction prefetching, so keep the cosmetic
// matched-state handoff almost instant. Otherwise Phantom feels late.
const POST_MATCH_FOUND_VERIFY_MS = 0;
const POST_MATCH_FOUND_PREPARE_MS = 0;
const BLINK_CHALLENGE_POLL_MS = 2_500;
const GUEST_ADDRESS_STORAGE_KEY = "cora:guest-address";
const PHASE_VARIANTS = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
};

const BLINK_TERMINAL_STATUSES = new Set<PrivateChallengeStatus>(["EXPIRED", "FORFEITED", "COMPLETED"]);
// Statuses the creator may dismiss from the Blink panel. PENDING = an open challenge no
// rival has accepted yet, so it is safe to abandon — any on-chain wager stays reclaimable
// via reclaim_challenge once it expires. CHALLENGED/ACTIVE have a committed opponent and
// must go through the surrender flow instead of a silent local clear.
const BLINK_CLEARABLE_STATUSES = new Set<PrivateChallengeStatus>([
  "EXPIRED",
  "FORFEITED",
  "COMPLETED",
  "PENDING",
]);

function toBaseUnitWager(wagerUsd: string) {
  const value = Number.parseFloat(wagerUsd);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value * 1_000_000);
}

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function readStoredGuestAddress() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(GUEST_ADDRESS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredGuestAddress(address: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GUEST_ADDRESS_STORAGE_KEY, address);
  } catch {
    // Session storage is a convenience; the active match session still carries the address.
  }
}

function generateGuestAddress() {
  return privateKeyToAccount(generatePrivateKey()).address;
}

type ActiveRoomSnapshot = ActiveMatchSession;

type ActiveMatchSurrenderBridgeProps = {
  roomId: string;
  address: string;
  onSubmitted: () => void;
  onTimeout: () => void;
};

function ActiveMatchSurrenderBridge({
  roomId,
  address,
  onSubmitted,
  onTimeout,
}: ActiveMatchSurrenderBridgeProps) {
  const { connectionState, surrender } = useMatchSocket({ roomId, address });
  const submittedRef = useRef(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!submittedRef.current) {
        onTimeout();
      }
    }, 10_000);
    return () => clearTimeout(timeoutId);
  }, [onTimeout]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    surrender();
    onSubmitted();
  }, [connectionState, onSubmitted, surrender]);

  return null;
}

export function LobbyScreen() {
  const runtimeConfig = getRuntimeConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: publicKey } = useAccount();
  const challengeMode = searchParams.get("challenge") === "1";
  const challengedBy = searchParams.get("ref");
  const requestedArena = searchParams.get("arena");
  const requestedToken = searchParams.get("token");
  const requestedWager = searchParams.get("wager");
  const requestedScientist = searchParams.get("scientist");
  const requestedGuest = searchParams.get("guest") === "1";
  const previewPhase = searchParams.get("previewPhase");
  const previewSelectStateParam = searchParams.get("previewSelectState");
  const previewOpponentStatusParam = searchParams.get("previewOpponentStatus");
  const resumeQueue = searchParams.get("resumeQueue") === "1";
  const hasRequestedArena = requestedArena ? ARENAS.some((arena) => arena.id === requestedArena) : false;
  const initialScientist =
    requestedScientist ? SCIENTISTS.find((scientist) => scientist.id === requestedScientist) ?? null : null;

  const [phase, setPhase] = useState<Phase>(() => (resumeQueue && hasRequestedArena ? "character-select" : "setup"));
  const [selectedArenaId, setSelectedArenaId] = useState<string | null>(() => {
    if (!requestedArena) return null;
    return ARENAS.some((arena) => arena.id === requestedArena) ? requestedArena : null;
  });
  const [selectedScientist, setSelectedScientist] = useState<Scientist | null>(initialScientist);
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null);
  const [matchedRole, setMatchedRole] = useState<"playerA" | "playerB" | null>(null);
  const [matchmakingState, setMatchmakingState] = useState<MatchmakingState>("idle");
  const [isTutorialMode, setIsTutorialMode] = useState(false);
  const [introOverlayOpen, setIntroOverlayOpen] = useState(false);
  const [matchmakingStage, setMatchmakingStage] = useState<MatchmakingStage>("finding");
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [botOfferOpen, setBotOfferOpen] = useState(false);
  const [botOfferDismissed, setBotOfferDismissed] = useState(false);
  const [botMatchBusy, setBotMatchBusy] = useState(false);
  const [guestAddress, setGuestAddress] = useState("");
  const [loginMode, setLoginMode] = useState<"wallet" | "guest">(() => (requestedGuest ? "guest" : "wallet"));
  const [activeMatchBannerSnapshot, setActiveMatchBannerSnapshot] = useState<ActiveRoomSnapshot | null>(null);
  const [activeMatchSurrenderSnapshot, setActiveMatchSurrenderSnapshot] = useState<ActiveRoomSnapshot | null>(null);
  const [activeMatchSurrenderModalOpen, setActiveMatchSurrenderModalOpen] = useState(false);
  const [activeMatchToast, setActiveMatchToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [activeBlinkChallenge, setActiveBlinkChallenge] = useState<ActiveBlinkChallengeSession | null>(null);
  const [blinkChallengePanelOpen, setBlinkChallengePanelOpen] = useState(false);
  const [blinkChallengeBusy, setBlinkChallengeBusy] = useState(false);
  const [blinkChallengeNotice, setBlinkChallengeNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [blinkCreateConfirmOpen, setBlinkCreateConfirmOpen] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [blinkJoinSnapshot, setBlinkJoinSnapshot] = useState<ActiveBlinkChallengeSession | null>(null);
  const [blinkCharacterSelectOpen, setBlinkCharacterSelectOpen] = useState(false);
  const [blinkConfirmingOpen, setBlinkConfirmingOpen] = useState(false);
  const [blinkSurrenderSnapshot, setBlinkSurrenderSnapshot] = useState<ActiveBlinkChallengeSession | null>(null);
  const [pendingErRecovery, setPendingErRecovery] = useState(false);
  const [erSettling, setErSettling] = useState(false);
  const matchmakingAbortRef = useRef<AbortController | null>(null);
  const matchmakingRequestIdRef = useRef(0);
  const userCancelledRef = useRef(false);
  const foundTransitionTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const autoRequeueStartedRef = useRef(false);
  const draftHydratedRef = useRef(false);
  const activeRoomHydratedRef = useRef(false);
  const activeRoomLookupAbortRef = useRef<AbortController | null>(null);
  const blinkChallengeHydratedRef = useRef(false);
  const activeBlinkChallengeRef = useRef<ActiveBlinkChallengeSession | null>(null);
  const lastBlinkBrowserNoticeRoomRef = useRef<string | null>(null);

  // WebSocket-based queue (replaces HTTP long-poll)
  const queueSocket = useQueueSocket();

  const ensureGuestAddress = useCallback(() => {
    const existingAddress = guestAddress || readStoredGuestAddress();
    if (existingAddress) {
      if (existingAddress !== guestAddress) {
        setGuestAddress(existingAddress);
      }
      return existingAddress;
    }

    const nextAddress = generateGuestAddress();
    writeStoredGuestAddress(nextAddress);
    setGuestAddress(nextAddress);
    return nextAddress;
  }, [guestAddress]);

  useEffect(() => {
    if (!requestedGuest) return;
    queueMicrotask(() => {
      ensureGuestAddress();
      setLoginMode("guest");
    });
  }, [ensureGuestAddress, requestedGuest]);

  const selectedArena = useMemo(
    () => ARENAS.find((arena) => arena.id === selectedArenaId) ?? null,
    [selectedArenaId],
  );
  const characterOptions = useMemo<CharacterOption[]>(
    () => SCIENTISTS.map((scientist) => ({ ...scientist })),
    [],
  );
  const previewEnabled = runtimeConfig.allowDevRoomPreview;
  const previewSelectionState: CharacterSelectionState =
    previewSelectStateParam === "selected" ||
      previewSelectStateParam === "locked" ||
      previewSelectStateParam === "auto_assigned" ||
      previewSelectStateParam === "expired"
      ? previewSelectStateParam
      : "idle";
  const previewOpponentStatus: OpponentCharacterStatus =
    previewOpponentStatusParam === "hidden" ||
      previewOpponentStatusParam === "picked" ||
      previewOpponentStatusParam === "locked" ||
      previewOpponentStatusParam === "auto_assigned"
      ? previewOpponentStatusParam
      : "waiting";
  const previewSelectionId =
    previewSelectionState === "auto_assigned" ? undefined : selectedScientist?.id;
  const previewAutoAssignedCharacterId =
    previewSelectionState === "auto_assigned"
      ? selectedScientist?.id ?? SCIENTISTS[0]?.id
      : undefined;
  const isSelectingCharacterPreview =
    previewEnabled &&
    previewPhase === "selecting_character" &&
    Boolean(selectedArena);

  const walletConnected = Boolean(publicKey);
  const walletAddress = publicKey ?? "";
  const isGuestMode = loginMode === "guest";
  const usesGuestIdentity = isGuestMode || isTutorialMode;
  const matchmakerAddress = usesGuestIdentity ? guestAddress : walletAddress;
  const walletAddr = matchmakerAddress || (usesGuestIdentity ? "Guest" : "Not connected");
  const showsWalletIdentityInTutorial = isTutorialMode && Boolean(walletAddress);
  const displayWalletAddr = showsWalletIdentityInTutorial ? walletAddress : walletAddr;
  const displayWalletAsGuest = usesGuestIdentity && !showsWalletIdentityInTutorial;

  useEffect(() => {
    const storedGuestAddress = readStoredGuestAddress();
    if (!storedGuestAddress) return;

    queueMicrotask(() => {
      setGuestAddress(storedGuestAddress);
      if (!walletAddress && loginMode === "wallet" && !matchedRoomId) {
        setLoginMode("guest");
      }
    });
  }, [loginMode, matchedRoomId, walletAddress]);

  useEffect(() => {
    if (isTutorialMode) return;
    if (!walletAddress || loginMode !== "guest") return;
    if (matchedRoomId || phase === "waiting" || phase === "found") return;

    queueMicrotask(() => setLoginMode("wallet"));
  }, [isTutorialMode, loginMode, matchedRoomId, phase, walletAddress]);

  const activeBlinkStatus = activeBlinkChallenge?.status as PrivateChallengeStatus | undefined;
  const hasBlockingBlinkChallenge =
    Boolean(activeBlinkChallenge) &&
    activeBlinkChallenge?.walletAddress === walletAddress &&
    activeBlinkStatus !== undefined &&
    !BLINK_TERMINAL_STATUSES.has(activeBlinkStatus);
  const activeBlinkArena =
    activeBlinkChallenge?.arenaId ? ARENAS.find((arena) => arena.id === activeBlinkChallenge.arenaId) ?? null : null;
  const activeBlinkArenaLabel = activeBlinkArena?.label ?? "CORA Arena";
  const activeBlinkStatusLabel =
    activeBlinkStatus === "CHALLENGED"
      ? "Accepted"
      : activeBlinkStatus === "ACTIVE"
        ? "Active"
        : activeBlinkStatus === "FORFEITED"
          ? "Forfeited"
          : activeBlinkStatus === "EXPIRED"
            ? "Expired"
            : "Open Challenge";
  const activeBlinkWaitingLabel =
    activeBlinkStatus === "CHALLENGED"
      ? "Rival accepted. Joining room..."
      : activeBlinkStatus === "ACTIVE"
        ? "Challenge active. Rejoining room..."
        : "Waiting for a rival to accept.";
  const activeMatchBannerArena =
    activeMatchBannerSnapshot?.arenaId ? ARENAS.find((arena) => arena.id === activeMatchBannerSnapshot.arenaId) ?? null : null;
  const activeMatchBannerToken = getMatchSessionToken(activeMatchBannerSnapshot) ?? activeMatchBannerArena?.token ?? "SOL";
  const activeMatchBannerWager = activeMatchBannerSnapshot?.wagerUsd ?? FIXED_WAGER_USD;
  const canSurrenderActiveMatch = activeMatchBannerSnapshot?.canSurrenderByState === true;

  const wagerNumber = Number(FIXED_WAGER_USD);
  const hasValidWager = Number.isFinite(wagerNumber) && wagerNumber > 0;

  const canStart = (walletConnected || isGuestMode) && Boolean(selectedArena) && hasValidWager && (isGuestMode || !hasBlockingBlinkChallenge);
  const canQueue = Boolean(selectedScientist) && Boolean(selectedArena) && (isGuestMode || !hasBlockingBlinkChallenge);
  const waitingMissingContext = phase === "waiting" && (!selectedArena || !selectedScientist);
  const foundMissingContext =
    phase === "found" && (!selectedArena || !selectedScientist || !matchedRoomId);
  const phaseContextIssue = useMemo(() => (
    waitingMissingContext
      ? {
        title: "Queue session missing context",
        detail: "Room setup was refreshed before queue state finished syncing.",
      }
      : foundMissingContext
        ? {
          title: "Match room context missing",
          detail: "Opponent-found state lost required room data. Return to character select and re-queue.",
        }
        : null
  ), [foundMissingContext, waitingMissingContext]);
  const showPendingErRecovery = pendingErRecovery && Boolean(walletAddress);
  const showErSettling = erSettling && Boolean(phaseContextIssue) && Boolean(matchedRoomId) && Boolean(walletAddress);

  const clearFoundTransitionTimers = useCallback(() => {
    for (const timerId of foundTransitionTimeoutsRef.current) {
      clearTimeout(timerId);
    }
    foundTransitionTimeoutsRef.current = [];
  }, []);

  const openRecoveredRoom = useCallback((snapshot: {
    roomId: string;
    role?: "playerA" | "playerB" | null;
    status?: string | null;
    arenaId?: string | null;
    token?: string | null;
    wagerUsd?: string | null;
    scientistId?: string | null;
  }) => {
    const nextArenaId =
      snapshot.arenaId && ARENAS.some((arena) => arena.id === snapshot.arenaId)
        ? snapshot.arenaId
        : selectedArenaId;
    const nextScientistId = snapshot.scientistId ?? selectedScientist?.id ?? null;
    const nextScientist =
      nextScientistId ? SCIENTISTS.find((scientist) => scientist.id === nextScientistId) ?? null : null;
    const nextArena = nextArenaId ? ARENAS.find((arena) => arena.id === nextArenaId) ?? null : null;

    if (nextArenaId && nextArenaId !== selectedArenaId) {
      setSelectedArenaId(nextArenaId);
    }
    if (nextScientist && nextScientist.id !== selectedScientist?.id) {
      setSelectedScientist(nextScientist);
    }

    setMatchedRoomId(snapshot.roomId);
    setMatchedRole(snapshot.role ?? null);
    setMatchmakingState("idle");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
    setPendingErRecovery(false);
    clearFoundTransitionTimers();

    writeActiveMatchSession({
      walletAddress,
      address: walletAddress,
      roomId: snapshot.roomId,
      role: snapshot.role ?? null,
      arenaId: nextArenaId ?? null,
      scientistId: nextScientist?.id ?? null,
      status: snapshot.status ?? null,
      token: snapshot.token ?? nextArena?.token ?? null,
      arenaToken: snapshot.token ?? nextArena?.token ?? null,
      wagerUsd: snapshot.wagerUsd ?? FIXED_WAGER_USD,
    });

    if (snapshot.status === "playing") {
      const params = new URLSearchParams({
        roomId: snapshot.roomId,
        arena: nextArenaId ?? "sol",
      });
      if (nextScientist?.id) {
        params.set("scientist", nextScientist.id);
      }
      router.replace(`/play?${params.toString()}`);
      return;
    }

    setPhase("found");
  }, [
    clearFoundTransitionTimers,
    router,
    selectedArenaId,
    selectedScientist,
    setMatchedRoomId,
    setMatchedRole,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setPendingErRecovery,
    setPhase,
    setSelectedArenaId,
    setSelectedScientist,
    walletAddress,
  ]);

  const clearActiveMatchBanner = useCallback(() => {
    writeActiveMatchSession(null);
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
  }, []);

  const clearActiveBlinkChallenge = useCallback((toastText?: string, tone: "success" | "error" = "success") => {
    writeActiveBlinkChallengeSession(null);
    setActiveBlinkChallenge(null);
    setBlinkJoinSnapshot(null);
    setBlinkCharacterSelectOpen(false);
    setBlinkConfirmingOpen(false);
    setBlinkSurrenderSnapshot(null);
    setBlinkChallengePanelOpen(false);
    if (toastText) setActiveMatchToast({ text: toastText, tone });
  }, [
    setActiveBlinkChallenge,
    setActiveMatchToast,
    setBlinkCharacterSelectOpen,
    setBlinkConfirmingOpen,
    setBlinkSurrenderSnapshot,
    setBlinkChallengePanelOpen,
    setBlinkJoinSnapshot,
  ]);

  const openBlinkJoin = useCallback((
    challenge: ActiveBlinkChallengeSession,
    presentation: "notification" | "select" | "confirm" = "notification",
  ) => {
    const nextArenaId =
      challenge.arenaId && ARENAS.some((arena) => arena.id === challenge.arenaId)
        ? challenge.arenaId
        : selectedArenaId ?? "sol";
    const nextScientistId = challenge.scientistId ?? selectedScientist?.id ?? "einstein";
    const nextScientist =
      SCIENTISTS.find((scientist) => scientist.id === nextScientistId) ??
      SCIENTISTS.find((scientist) => scientist.id === "einstein") ??
      SCIENTISTS[0] ??
      null;

    if (nextArenaId && nextArenaId !== selectedArenaId) setSelectedArenaId(nextArenaId);
    if (nextScientist && nextScientist.id !== selectedScientist?.id) setSelectedScientist(nextScientist);

    matchmakingAbortRef.current?.abort();
    matchmakingAbortRef.current = null;
    clearFoundTransitionTimers();
    setMatchmakingState("idle");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setBlinkChallengePanelOpen(false);
    setBlinkCharacterSelectOpen(presentation === "select");
    setBlinkConfirmingOpen(presentation === "confirm");
    setBlinkJoinSnapshot({
      ...challenge,
      arenaId: nextArenaId,
      scientistId: nextScientist?.id ?? null,
    });
  }, [
    clearFoundTransitionTimers,
    selectedArenaId,
    selectedScientist,
    setBlinkCharacterSelectOpen,
    setBlinkConfirmingOpen,
    setBlinkChallengePanelOpen,
    setBlinkJoinSnapshot,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setSelectedArenaId,
    setSelectedScientist,
  ]);

  const maybeNotifyBlinkAccepted = useCallback((challenge: ActiveBlinkChallengeSession) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (lastBlinkBrowserNoticeRoomRef.current === challenge.roomId) return;

    lastBlinkBrowserNoticeRoomRef.current = challenge.roomId;
    const notification = new Notification("CORA Blink Challenge Accepted", {
      body: "A rival accepted your Blink challenge. Open the lobby to confirm your presence and enter the match.",
      tag: `cora-blink-${challenge.roomId}`,
    });

    notification.onclick = () => {
      window.focus();
      setPendingErRecovery(false);
      setBlinkCharacterSelectOpen(true);
      setBlinkConfirmingOpen(false);
      notification.close();
    };
  }, [setBlinkCharacterSelectOpen, setBlinkConfirmingOpen, setPendingErRecovery]);

  const enableBlinkBrowserNotifications = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setBlinkChallengeNotice({ text: "Browser notifications are not supported here.", tone: "error" });
      setBrowserNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
      setBlinkChallengeNotice({
        text:
          permission === "granted"
            ? "Browser notifications enabled."
            : permission === "denied"
              ? "Browser notifications were blocked."
              : "Browser notifications were dismissed.",
        tone: permission === "granted" ? "success" : "error",
      });
    } catch {
      setBlinkChallengeNotice({ text: "Could not enable browser notifications.", tone: "error" });
    }
  }, []);

  const commitCreateBlinkChallenge = useCallback(async () => {
    if (!walletAddress || !selectedArena) {
      setBlinkChallengeNotice({ text: "Connect wallet and select an arena first.", tone: "error" });
      return;
    }
    if (hasBlockingBlinkChallenge) {
      setBlinkChallengePanelOpen(true);
      return;
    }

    const wagerAmount = toBaseUnitWager(FIXED_WAGER_USD);
    if (!wagerAmount) {
      setBlinkChallengeNotice({ text: "Invalid wager amount.", tone: "error" });
      return;
    }

    setBlinkChallengeBusy(true);
    setBlinkChallengeNotice({ text: "Opening your wallet. Please sign to fund the challenge...", tone: "success" });
    setBlinkCreateConfirmOpen(false);
    setBlinkChallengeNotice(null);
    try {
      const snapshot = await createBlinkChallengeSession({
        walletAddress,
        tokenMint: selectedArena.token,
        wagerAmount,
        wagerUsd: FIXED_WAGER_USD,
        arenaId: selectedArena.id,
        scientistId: selectedScientist?.id ?? null,
        origin: typeof window === "undefined" ? null : window.location.origin,
      });
      writeActiveBlinkChallengeSession(snapshot);
      setActiveBlinkChallenge(snapshot);
      setBlinkChallengePanelOpen(true);
      setBlinkChallengeNotice({ text: "Blink challenge funded and live.", tone: "success" });
    } catch (error) {
      const message =
        error instanceof DepositIntentError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create Blink challenge.";
      setBlinkChallengeNotice({ text: message, tone: "error" });
      setActiveMatchToast({ text: message, tone: "error" });
    } finally {
      setBlinkChallengeBusy(false);
    }
  }, [
    hasBlockingBlinkChallenge,
    selectedArena,
    selectedScientist,
    setActiveBlinkChallenge,
    setActiveMatchToast,
    setBlinkChallengeBusy,
    setBlinkChallengeNotice,
    setBlinkChallengePanelOpen,
    walletAddress,
  ]);

  const handleCreateBlinkChallenge = useCallback(() => {
    if (!walletAddress || !selectedArena) {
      setBlinkChallengeNotice({ text: "Connect wallet and select an arena first.", tone: "error" });
      return;
    }
    if (hasBlockingBlinkChallenge) {
      setBlinkChallengePanelOpen(true);
      return;
    }
    setBlinkCreateConfirmOpen(true);
  }, [hasBlockingBlinkChallenge, selectedArena, walletAddress]);

  const handleRejoinActiveMatch = useCallback(() => {
    if (!activeMatchBannerSnapshot?.roomId) return;
    writeActiveMatchSession(activeMatchBannerSnapshot);
    const params = new URLSearchParams({
      roomId: activeMatchBannerSnapshot.roomId,
      arena: activeMatchBannerSnapshot.arenaId ?? "sol",
    });
    setActiveMatchBannerSnapshot(null);
    setActiveMatchSurrenderSnapshot(null);
    setActiveMatchSurrenderModalOpen(false);
    router.push(`/play?${params.toString()}`);
  }, [
    activeMatchBannerSnapshot,
    router,
  ]);

  const handleConfirmActiveMatchSurrender = useCallback(() => {
    if (!activeMatchBannerSnapshot?.roomId) return;
    const surrenderAddress = getMatchSessionAddress(activeMatchBannerSnapshot) || walletAddress;
    if (!surrenderAddress) {
      clearActiveMatchBanner();
      setActiveMatchToast({ text: "Could not connect - try rejoining instead", tone: "error" });
      return;
    }

    setActiveMatchSurrenderModalOpen(false);
    setActiveMatchSurrenderSnapshot({
      ...activeMatchBannerSnapshot,
      walletAddress: surrenderAddress,
      address: surrenderAddress,
    });
  }, [activeMatchBannerSnapshot, clearActiveMatchBanner, walletAddress]);

  const handleActiveMatchSurrenderSubmitted = useCallback(() => {
    clearActiveMatchBanner();
    setActiveMatchToast({ text: "Surrender submitted", tone: "success" });
  }, [clearActiveMatchBanner]);

  const handleActiveMatchSurrenderTimeout = useCallback(() => {
    clearActiveMatchBanner();
    setActiveMatchToast({ text: "Could not connect - try rejoining instead", tone: "error" });
  }, [clearActiveMatchBanner]);

  const startBotMatch = useCallback(async () => {
    const playerAddress = isGuestMode ? ensureGuestAddress() : walletAddress;

    if (!playerAddress) {
      setMatchmakingState("error");
      setMatchmakingError("Connect a wallet or enter as guest before starting practice.");
      return;
    }
    if (!selectedArena || !selectedScientist) {
      setMatchmakingState("error");
      setMatchmakingError("Choose an arena and scientist before starting practice.");
      return;
    }

    userCancelledRef.current = true;
    setBotMatchBusy(true);
    setBotOfferOpen(false);
    setBotOfferDismissed(true);
    setMatchmakingState("searching");
    setMatchmakingStage("preparing");
    setMatchmakingError(null);
    clearFoundTransitionTimers();
    queueSocket.cancel();
    matchmakingAbortRef.current?.abort();

    const controller = new AbortController();
    matchmakingAbortRef.current = controller;
    const requestId = ++matchmakingRequestIdRef.current;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, BOT_MATCH_START_TIMEOUT_MS);

    try {
      const result = await createBotMatch({
        address: playerAddress,
        tokenMint: selectedArena.token,
        wagerAmount: toBaseUnitWager(FIXED_WAGER_USD),
        characterId: selectedScientist.id,
        signal: controller.signal,
      });

      if (requestId !== matchmakingRequestIdRef.current) return;

      setMatchedRoomId(result.roomId);
      setMatchedRole(result.role ?? "playerA");
      setMatchmakingState("idle");
      setMatchmakingStage("finding");
      setActiveMatchToast({
        text: isGuestMode ? "Practice rival found. Entering the arena." : "Practice rival found. Entering the arena.",
        tone: "success",
      });
      setPhase("found");
    } catch (error) {
      if (controller.signal.aborted) {
        if (!timedOut) return;

        const message = "Practice took too long to start. Tap Practice Now again.";
        setMatchmakingState("timeout");
        setMatchmakingStage("finding");
        setMatchmakingError(message);
        setActiveMatchToast({ text: message, tone: "error" });
        setPhase(isGuestMode ? "character-select" : "waiting");
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to start practice.";
      setMatchmakingState("error");
      setMatchmakingStage("finding");
      setMatchmakingError(message);
      setActiveMatchToast({ text: message, tone: "error" });
      setPhase(isGuestMode ? "character-select" : "waiting");
    } finally {
      if (matchmakingAbortRef.current === controller) {
        matchmakingAbortRef.current = null;
      }
      clearTimeout(timeoutId);
      setBotMatchBusy(false);
    }
  }, [
    clearFoundTransitionTimers,
    ensureGuestAddress,
    isGuestMode,
    queueSocket,
    selectedArena,
    selectedScientist,
    walletAddress,
    setActiveMatchToast,
    setBotMatchBusy,
    setBotOfferDismissed,
    setBotOfferOpen,
    setMatchedRole,
    setMatchedRoomId,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setPhase,
  ]);

  const startTutorialFlow = useCallback(() => {
    setIsTutorialMode(true);
    setSelectedArenaId("sol");
    setLoginMode("guest");
    ensureGuestAddress();
    setPhase("character-select");
  }, [
    ensureGuestAddress,
    setIsTutorialMode,
    setLoginMode,
    setPhase,
    setSelectedArenaId,
  ]);

  const startTutorialMatch = useCallback(async () => {
    if (!selectedScientist) {
      setMatchmakingState("error");
      setMatchmakingError("Choose a scientist before starting the tutorial.");
      return;
    }

    const tutorialAddress = ensureGuestAddress();

    userCancelledRef.current = true;
    setBotMatchBusy(true);
    setMatchmakingState("searching");
    setMatchmakingStage("preparing");
    setMatchmakingError(null);
    clearFoundTransitionTimers();
    queueSocket.cancel();
    matchmakingAbortRef.current?.abort();

    const controller = new AbortController();
    matchmakingAbortRef.current = controller;
    const requestId = ++matchmakingRequestIdRef.current;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, BOT_MATCH_START_TIMEOUT_MS);

    try {
      const result = await createBotMatch({
        address: tutorialAddress,
        tokenMint: "SOL",
        wagerAmount: toBaseUnitWager(FIXED_WAGER_USD),
        characterId: selectedScientist.id,
        signal: controller.signal,
      });

      if (requestId !== matchmakingRequestIdRef.current) return;

      setMatchedRoomId(result.roomId);
      setMatchedRole(result.role ?? "playerA");
      setMatchmakingState("idle");
      setMatchmakingStage("finding");

      writeActiveMatchSession({
        walletAddress: tutorialAddress,
        address: tutorialAddress,
        displayAddress: walletAddress || tutorialAddress,
        displayAsGuest: !walletAddress,
        roomId: result.roomId,
        role: result.role ?? "playerA",
        roomType: "bot",
        isGuest: true,
        isTutorial: true,
        arenaId: "eth",
        scientistId: selectedScientist.id,
        status: "playing",
        token: "ETH",
        arenaToken: "ETH",
        wagerUsd: FIXED_WAGER_USD,
      });

      setPhase("found");
    } catch (error) {
      if (controller.signal.aborted) {
        if (!timedOut) return;
        const message = "Tutorial took too long to start. Please try again.";
        setMatchmakingState("timeout");
        setMatchmakingStage("finding");
        setMatchmakingError(message);
        setActiveMatchToast({ text: message, tone: "error" });
        setPhase("character-select");
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to start tutorial.";
      setMatchmakingState("error");
      setMatchmakingStage("finding");
      setMatchmakingError(message);
      setActiveMatchToast({ text: message, tone: "error" });
      setPhase("character-select");
    } finally {
      if (matchmakingAbortRef.current === controller) {
        matchmakingAbortRef.current = null;
      }
      clearTimeout(timeoutId);
      setBotMatchBusy(false);
    }
  }, [
    selectedScientist,
    clearFoundTransitionTimers,
    ensureGuestAddress,
    queueSocket,
    setActiveMatchToast,
    setBotMatchBusy,
    setMatchedRole,
    setMatchedRoomId,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setPhase,
    walletAddress,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const introSeen = window.localStorage.getItem("cora:introSeen");
      if (!introSeen && phase === "setup" && !challengeMode && !activeMatchBannerSnapshot && !pendingErRecovery && !blinkJoinSnapshot) {
        queueMicrotask(() => setIntroOverlayOpen(true));
      }
    }
  }, [phase, challengeMode, activeMatchBannerSnapshot, pendingErRecovery, blinkJoinSnapshot]);

  const handleCloseIntro = useCallback(() => {
    setIntroOverlayOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cora:introSeen", "1");
    }
  }, [setIntroOverlayOpen]);

  const beginMatchmaking = useCallback(() => {
    if (isGuestMode) {
      void startBotMatch();
      return;
    }

    if (!walletAddress) {
      setMatchmakingState("error");
      setMatchmakingError("Connect wallet before entering queue.");
      return;
    }
    if (hasBlockingBlinkChallenge) {
      setBlinkChallengePanelOpen(true);
      setActiveMatchToast({ text: "Finish or clear your active Blink challenge before queueing.", tone: "error" });
      return;
    }
    userCancelledRef.current = false;
    setMatchmakingState("searching");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setBotOfferOpen(false);
    setBotOfferDismissed(false);
    setMatchedRoomId(null);
    setMatchedRole(null);
    setPhase("waiting");
    queueSocket.connect(walletAddress, selectedArena?.token ?? "ETH");
  }, [
    hasBlockingBlinkChallenge,
    isGuestMode,
    queueSocket,
    selectedArena,
    startBotMatch,
    walletAddress,
    setActiveMatchToast,
    setBlinkChallengePanelOpen,
    setBotOfferDismissed,
    setBotOfferOpen,
    setMatchedRole,
    setMatchedRoomId,
    setMatchmakingError,
    setMatchmakingStage,
    setMatchmakingState,
    setPhase,
  ]);

  function cancelMatchmaking() {
    userCancelledRef.current = true;
    queueSocket.cancel();
    // Also abort any legacy HTTP request if still in flight
    matchmakingAbortRef.current?.abort();
    clearFoundTransitionTimers();
    setBotOfferOpen(false);
    setBotOfferDismissed(false);
    writeActiveMatchSession(null);
    setMatchedRole(null);
    setMatchmakingState("idle");
    setMatchmakingStage("finding");
    setMatchmakingError(null);
    setPhase("character-select");
  }

  // React to WS queue match result
  useEffect(() => {
    if (!queueSocket.matchResult) return;
    if (userCancelledRef.current) return;

    const { roomId, role } = queueSocket.matchResult;
    const requestId = ++matchmakingRequestIdRef.current;

    setMatchedRoomId(roomId);
    setMatchedRole(role ?? null);
    setMatchmakingState("searching");
    setMatchmakingStage("verifying");
    clearFoundTransitionTimers();

    const verifyTimer = setTimeout(() => {
      if (requestId !== matchmakingRequestIdRef.current) return;
      setMatchmakingStage("preparing");

      const prepareTimer = setTimeout(() => {
        if (requestId !== matchmakingRequestIdRef.current) return;
        setMatchmakingState("idle");
        setPhase("found");
      }, POST_MATCH_FOUND_PREPARE_MS);
      foundTransitionTimeoutsRef.current.push(prepareTimer);
    }, POST_MATCH_FOUND_VERIFY_MS);

    foundTransitionTimeoutsRef.current.push(verifyTimer);
  }, [queueSocket.matchResult, clearFoundTransitionTimers]);

  // React to WS queue state changes (expired / error)
  useEffect(() => {
    if (queueSocket.queueState === 'expired') {
      queueMicrotask(() => {
        setMatchmakingState("timeout");
        setMatchmakingStage("finding");
        setMatchmakingError("No opponent found yet. Retry to keep searching.");
      });
    } else if (queueSocket.queueState === 'error' && !userCancelledRef.current) {
      queueMicrotask(() => {
        setMatchmakingState("error");
        setMatchmakingStage("finding");
        setMatchmakingError("Queue connection lost. Retry to reconnect.");
      });
    }
  }, [queueSocket.queueState]);

  useEffect(() => {
    if (
      phase !== "waiting" ||
      matchmakingState !== "searching" ||
      matchmakingStage !== "finding" ||
      botOfferDismissed ||
      botMatchBusy ||
      matchedRoomId
    ) {
      return;
    }

    const timerId = setTimeout(() => {
      setBotOfferOpen(true);
    }, BOT_OFFER_DELAY_MS);

    return () => clearTimeout(timerId);
  }, [
    botMatchBusy,
    botOfferDismissed,
    matchedRoomId,
    matchmakingStage,
    matchmakingState,
    phase,
  ]);

  useEffect(() => {
    return () => {
      matchmakingAbortRef.current?.abort();
      for (const timerId of foundTransitionTimeoutsRef.current) {
        clearTimeout(timerId);
      }
      foundTransitionTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    activeBlinkChallengeRef.current = activeBlinkChallenge;
  }, [activeBlinkChallenge]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (blinkChallengeHydratedRef.current) return;
    blinkChallengeHydratedRef.current = true;
    const snapshot = readActiveBlinkChallengeSession();
    if (!snapshot) return;
    const normalized: ActiveBlinkChallengeSession = {
      ...snapshot,
      webChallengeUrl: snapshot.webChallengeUrl ?? getWebChallengeUrl(window.location.origin, snapshot.roomId),
    };
    writeActiveBlinkChallengeSession(normalized);
    queueMicrotask(() => {
      setActiveBlinkChallenge(normalized);
      if (!normalized.status || !BLINK_TERMINAL_STATUSES.has(normalized.status as PrivateChallengeStatus)) {
        setBlinkChallengePanelOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeMatchToast) return;
    const timeoutId = setTimeout(() => {
      setActiveMatchToast(null);
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [activeMatchToast]);

  // NOTE: Presence polling removed; WS queue provides real-time status.

  useEffect(() => {
    if (!blinkChallengeNotice) return;
    const timeoutId = setTimeout(() => setBlinkChallengeNotice(null), 6000);
    return () => clearTimeout(timeoutId);
  }, [blinkChallengeNotice]);

  useEffect(() => {
    if (!walletAddress || !activeBlinkChallenge) return;
    if (activeBlinkChallenge.walletAddress === walletAddress) return;
    queueMicrotask(() => setBlinkChallengePanelOpen(false));
  }, [activeBlinkChallenge, walletAddress]);

  useEffect(() => {
    if (!activeBlinkChallenge?.roomId) return;
    if (walletAddress && activeBlinkChallenge.walletAddress !== walletAddress) return;
    const currentStatus = activeBlinkChallenge.status as PrivateChallengeStatus | undefined;
    if (currentStatus && BLINK_TERMINAL_STATUSES.has(currentStatus)) return;

    let cancelled = false;
    const controller = new AbortController();

    async function refreshBlinkChallenge() {
      const snapshot = activeBlinkChallengeRef.current;
      if (!snapshot?.roomId) return;
      try {
        const latest = await getPrivateChallenge(snapshot.roomId, controller.signal);
        if (cancelled) return;

        const next: ActiveBlinkChallengeSession = {
          ...snapshot,
          status: latest.status,
          expiresAt: latest.expiresAt,
          joinDeadline: latest.joinDeadline,
          token: snapshot.token ?? latest.tokenMint,
        };

        if (latest.status === "CHALLENGED" || latest.status === "ACTIVE") {
          writeActiveBlinkChallengeSession(next);
          setActiveBlinkChallenge(next);
          if (latest.status === "CHALLENGED") {
            maybeNotifyBlinkAccepted(next);
          }
          const alreadyHandlingRoom =
            blinkJoinSnapshot?.roomId === next.roomId && (blinkCharacterSelectOpen || blinkConfirmingOpen);
          if (!alreadyHandlingRoom) {
            openBlinkJoin(next);
          }
          return;
        }

        if (BLINK_TERMINAL_STATUSES.has(latest.status)) {
          const text =
            latest.status === "EXPIRED"
              ? "Blink challenge expired."
              : latest.status === "FORFEITED"
                ? "Blink challenge forfeited."
                : "Blink challenge completed.";
          clearActiveBlinkChallenge(text, latest.status === "COMPLETED" ? "success" : "error");
          return;
        }

        writeActiveBlinkChallengeSession(next);
        setActiveBlinkChallenge(next);
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        console.warn("[BlinkChallenge] Status refresh failed", error);
      }
    }

    void refreshBlinkChallenge();
    const intervalId = setInterval(() => {
      void refreshBlinkChallenge();
    }, BLINK_CHALLENGE_POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(intervalId);
    };
  }, [
    activeBlinkChallenge?.roomId,
    activeBlinkChallenge?.status,
    activeBlinkChallenge?.walletAddress,
    blinkCharacterSelectOpen,
    blinkConfirmingOpen,
    blinkJoinSnapshot?.roomId,
    maybeNotifyBlinkAccepted,
    walletAddress,
    openBlinkJoin,
    clearActiveBlinkChallenge,
  ]);

  useEffect(() => {
    if (!resumeQueue || autoRequeueStartedRef.current) return;
    if (phase !== "character-select") return;
    if (!canQueue || matchmakingState !== "idle") return;

    const timeoutId = setTimeout(() => {
      autoRequeueStartedRef.current = true;
      beginMatchmaking();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [resumeQueue, phase, canQueue, matchmakingState, walletAddress, beginMatchmaking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const snapshot = readLobbyDraftSnapshot();
      if (!snapshot) return;

      queueMicrotask(() => {
        if (!selectedArenaId && snapshot.arenaId && ARENAS.some((arena) => arena.id === snapshot.arenaId)) {
          setSelectedArenaId(snapshot.arenaId);
        }

        if (!selectedScientist && snapshot.scientistId) {
          const restoredScientist = SCIENTISTS.find((scientist) => scientist.id === snapshot.scientistId) ?? null;
          if (restoredScientist) {
            setSelectedScientist(restoredScientist);
          }
        }
      });
    } catch {
      // Ignore malformed draft state.
    }
  }, [selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeRoomHydratedRef.current) return;
    activeRoomHydratedRef.current = true;

    const snapshot = readActiveMatchSession();
    if (!snapshot) return;

    queueMicrotask(() => {
      const snapshotAddress = getMatchSessionAddress(snapshot);
      if (snapshot.isGuest && snapshotAddress) {
        writeStoredGuestAddress(snapshotAddress);
        setGuestAddress(snapshotAddress);
        setLoginMode("guest");
      }

      if (!selectedArenaId && snapshot.arenaId && ARENAS.some((arena) => arena.id === snapshot.arenaId)) {
        setSelectedArenaId(snapshot.arenaId);
      }

      if (!selectedScientist && snapshot.scientistId) {
        const restoredScientist = SCIENTISTS.find((scientist) => scientist.id === snapshot.scientistId) ?? null;
        if (restoredScientist) {
          setSelectedScientist(restoredScientist);
        }
      }

      if (isLiveMatchSession(snapshot)) {
        setActiveMatchBannerSnapshot(snapshot);
      }
    });
  }, [selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: LobbyDraftSnapshot = {
      arenaId: selectedArenaId,
      scientistId: selectedScientist?.id ?? null,
    };
    writeLobbyDraftSnapshot(snapshot);
  }, [selectedArenaId, selectedScientist?.id]);

  useEffect(() => {
    if (!walletAddress) {
      activeRoomLookupAbortRef.current?.abort();
      activeRoomLookupAbortRef.current = null;
      return;
    }

    const storedSnapshot = readActiveMatchSession();
    const storedSnapshotAddress = getMatchSessionAddress(storedSnapshot);
    const isStoredDepositingSnapshot =
      storedSnapshot?.status === "depositing" && Boolean(storedSnapshot.roomId) && phase === "setup";

    if (storedSnapshot && storedSnapshotAddress && storedSnapshotAddress !== walletAddress) {
      writeActiveMatchSession(null);
      queueMicrotask(() => {
        setActiveMatchBannerSnapshot(null);
        setPendingErRecovery(false);
      });
    } else if (storedSnapshot?.roomId && phase === "setup") {
      if (isLiveMatchSession(storedSnapshot)) {
        queueMicrotask(() => {
          setActiveMatchBannerSnapshot(storedSnapshot);
        });
      } else if (isStoredDepositingSnapshot) {
        queueMicrotask(() => {
          setPendingErRecovery(true);
        });
      } else {
        queueMicrotask(() => {
          openRecoveredRoom(storedSnapshot);
        });
      }
    }

    const controller = new AbortController();
    activeRoomLookupAbortRef.current?.abort();
    activeRoomLookupAbortRef.current = controller;

    void (async () => {
      let pollAttempts = 0;

      const clearRecoveryToSetup = (toastText?: string) => {
        writeActiveMatchSession(null);
        setPendingErRecovery(false);
        setMatchedRoomId(null);
        setMatchedRole(null);
        setMatchmakingState("idle");
        setMatchmakingStage("finding");
        setMatchmakingError(null);
        setActiveMatchBannerSnapshot(null);
        setPhase("setup");
        if (toastText) {
          setActiveMatchToast({ text: toastText, tone: "error" });
        }
      };

      try {
        while (!controller.signal.aborted) {
          try {
            const activeMatch = await getActiveMatchForAddress(walletAddress, controller.signal);
            if (controller.signal.aborted) return;

            if (!activeMatch.inRoom || !activeMatch.roomId) {
              const snapshot = readActiveMatchSession();
              if (getMatchSessionAddress(snapshot) === walletAddress) {
                writeActiveMatchSession(null);
                setActiveMatchBannerSnapshot(null);
              }

              if (isStoredDepositingSnapshot) {
                clearRecoveryToSetup();
              } else {
                setPendingErRecovery(false);
              }
              return;
            }

            const latestSnapshot = readActiveMatchSession();
            const isTerminalMatch = activeMatch.status ? BLINK_TERMINAL_STATUSES.has(activeMatch.status as PrivateChallengeStatus) : false;

            if (isTerminalMatch) {
              clearRecoveryToSetup();
              return;
            }

            if (activeMatch.roomType === "private" && activeMatch.status === "depositing") {
              clearActiveMatchRoomSession();
              setPendingErRecovery(false);
              setActiveMatchBannerSnapshot(null);
              setMatchedRoomId(null);
              setMatchedRole(null);
              setMatchmakingState("idle");
              setMatchmakingStage("finding");
              setMatchmakingError(null);

              const blinkSnapshot = activeBlinkChallengeRef.current;
              if (activeMatch.role === "playerA" && blinkSnapshot?.roomId === activeMatch.roomId) {
                openBlinkJoin(blinkSnapshot, latestSnapshot?.scientistId ? "confirm" : "select");
                return;
              }

              if (activeMatch.role === "playerB") {
                router.replace(`/challenge/${activeMatch.roomId}`);
                return;
              }

              setPhase("setup");
              return;
            }

            if (activeMatch.status === "playing") {
              const liveSnapshot: ActiveRoomSnapshot = {
                walletAddress,
                address: walletAddress,
                roomId: activeMatch.roomId,
                role: activeMatch.role ?? latestSnapshot?.role ?? null,
                arenaId: latestSnapshot?.arenaId ?? selectedArenaId,
                scientistId: latestSnapshot?.scientistId ?? selectedScientist?.id ?? null,
                status: "playing",
                token: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                arenaToken: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                wagerUsd: latestSnapshot?.wagerUsd ?? FIXED_WAGER_USD,
                canSurrenderByState: latestSnapshot?.canSurrenderByState ?? false,
              };
              writeActiveMatchSession(liveSnapshot);
              setActiveMatchBannerSnapshot(liveSnapshot);

              if (isStoredDepositingSnapshot) {
                openRecoveredRoom(liveSnapshot);
              }
              return;
            }

            if (isStoredDepositingSnapshot) {
              if (activeMatch.status === "finished") {
                clearRecoveryToSetup();
                return;
              }

              setPendingErRecovery(true);
            } else {
              openRecoveredRoom({
                roomId: activeMatch.roomId,
                role: activeMatch.role ?? latestSnapshot?.role ?? null,
                status: activeMatch.status ?? latestSnapshot?.status ?? null,
                arenaId: latestSnapshot?.arenaId ?? selectedArenaId,
                token: getMatchSessionToken(latestSnapshot) ?? selectedArena?.token ?? null,
                wagerUsd: latestSnapshot?.wagerUsd ?? FIXED_WAGER_USD,
                scientistId: latestSnapshot?.scientistId ?? selectedScientist?.id ?? null,
              });
              return;
            }

            pollAttempts = 0;
          } catch (error) {
            if (controller.signal.aborted) return;

            if (!isStoredDepositingSnapshot) {
              throw error;
            }

            pollAttempts += 1;
            if (pollAttempts >= 5) {
              console.warn("Failed to confirm pending match status.", error);
              clearRecoveryToSetup("Could not confirm match status");
              return;
            }
          }

          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(resolve, 2000);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              resolve();
            }, { once: true });
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to restore active room.", error);
      } finally {
        if (activeRoomLookupAbortRef.current === controller) {
          activeRoomLookupAbortRef.current = null;
        }
      }
    })();

    return () => {
      controller.abort();
      if (activeRoomLookupAbortRef.current === controller) {
        activeRoomLookupAbortRef.current = null;
      }
    };
  }, [walletAddress, phase, openBlinkJoin, openRecoveredRoom, router, selectedArena, selectedArenaId, selectedScientist]);

  useEffect(() => {
    if (phase === "found" && pendingErRecovery) {
      queueMicrotask(() => {
        setPendingErRecovery(false);
      });
    }
  }, [pendingErRecovery, phase]);

  useEffect(() => {
    if (!phaseContextIssue || !matchedRoomId || !walletAddress) return;

    let cancelled = false;
    let inFlight = false;

    const pollMatchSettlement = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const activeMatch = await getActiveMatchForAddress(walletAddress);
        if (cancelled) return;

        if (!activeMatch.inRoom || activeMatch.status !== "depositing") {
          setErSettling(false);
        } else {
          setErSettling(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to poll ER settlement state.", error);
        }
      } finally {
        inFlight = false;
      }
    };

    queueMicrotask(() => {
      if (!cancelled) {
        setErSettling(true);
      }
    });
    void pollMatchSettlement();
    const intervalId = setInterval(() => {
      void pollMatchSettlement();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [matchedRoomId, phaseContextIssue, walletAddress]);

  useEffect(() => {
    if (isTutorialMode) return;

    const sessionAddress = isGuestMode ? guestAddress : walletAddress;
    if (!sessionAddress || !matchedRoomId) return;
    writeActiveMatchSession({
      walletAddress: sessionAddress,
      address: sessionAddress,
      roomId: matchedRoomId,
      role: matchedRole,
      roomType: matchedRoomId.startsWith("bot-") ? "bot" : null,
      isGuest: isGuestMode,
      arenaId: selectedArena?.id ?? null,
      scientistId: selectedScientist?.id ?? null,
      status: phase === "found" ? "depositing" : null,
      token: selectedArena?.token ?? null,
      arenaToken: selectedArena?.token ?? null,
      wagerUsd: FIXED_WAGER_USD,
    });
  }, [guestAddress, isGuestMode, isTutorialMode, walletAddress, matchedRoomId, matchedRole, selectedArena?.id, selectedArena?.token, selectedScientist?.id, phase]);

  return (
    <div
      className="relative min-h-[100svh] overflow-x-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(168,143,104,0.22), transparent 45%), linear-gradient(180deg, #2b3a32 0%, #223229 50%, #1a251f 100%)",
      }}
    >
      {activeMatchSurrenderSnapshot?.roomId && getMatchSessionAddress(activeMatchSurrenderSnapshot) && (
        <ActiveMatchSurrenderBridge
          roomId={activeMatchSurrenderSnapshot.roomId}
          address={getMatchSessionAddress(activeMatchSurrenderSnapshot)}
          onSubmitted={handleActiveMatchSurrenderSubmitted}
          onTimeout={handleActiveMatchSurrenderTimeout}
        />
      )}
      {blinkSurrenderSnapshot?.roomId && blinkSurrenderSnapshot.walletAddress && (
        <BlinkSurrenderBridge
          roomId={blinkSurrenderSnapshot.roomId}
          address={blinkSurrenderSnapshot.walletAddress}
          characterId={selectedScientist?.id ?? blinkSurrenderSnapshot.scientistId ?? null}
          confirmSignature={blinkSurrenderSnapshot.createSignature}
          onSettled={(message) => {
            clearActiveBlinkChallenge(message ?? "Blink challenge surrendered.", "success");
            writeActiveMatchSession(null);
          }}
          onError={(message) => {
            setBlinkSurrenderSnapshot(null);
            setActiveMatchToast({ text: message, tone: "error" });
          }}
        />
      )}
      {activeMatchBannerSnapshot && (
        <div className="fixed inset-x-0 top-0 z-[90] p-3 md:p-4">
          <div
            className="mx-auto w-full max-w-5xl frame-cut px-4 py-3 shadow-2xl md:px-5"
            style={{
              border: "1px solid rgba(248,214,148,0.36)",
              background:
                "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(248,214,148,0.82)]">
                  {"\u2694"} You have an active match
                </p>
                <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
                  {activeMatchBannerArena?.label ?? "Arena battle"} - ${activeMatchBannerWager} {activeMatchBannerToken}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRejoinActiveMatch}
                  className="btn-game btn-game-primary px-4 py-2 text-xs shadow-xl"
                >
                  Rejoin Match
                </button>
                {canSurrenderActiveMatch && (
                  <button
                    type="button"
                    onClick={() => setActiveMatchSurrenderModalOpen(true)}
                    className="btn-game btn-game-secondary px-4 py-2 text-xs shadow-xl"
                  >
                    Surrender Match
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {activeMatchToast && (
        <div className="lobby-active-match-toast fixed left-1/2 top-24 z-[100] w-full max-w-md -translate-x-1/2 px-4">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border:
                activeMatchToast.tone === "success"
                  ? "2px solid rgba(157,180,150,0.7)"
                  : "2px solid rgba(186,105,49,0.78)",
              background:
                activeMatchToast.tone === "success"
                  ? "linear-gradient(145deg, #1b2d25 0%, #274137 100%)"
                  : "linear-gradient(145deg, #2c1810 0%, #3d2315 100%)",
            }}
          >
            <p className="font-gabarito text-sm font-bold text-[rgba(244,240,230,0.92)]">{activeMatchToast.text}</p>
          </div>
        </div>
      )}
      {blinkCreateConfirmOpen && selectedArena && (
        <div className="fixed inset-0 z-[84] grid place-items-center bg-[rgba(7,12,10,0.78)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{
              border: "1px solid rgba(248,214,148,0.42)",
              background: "linear-gradient(145deg, rgba(255,248,236,0.98) 0%, rgba(243,232,206,0.98) 100%)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.38)",
            }}
          >
            <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.22em] text-[rgba(111,58,40,0.72)]">
              Blink Confirmation
            </p>
            <p className="mt-2 font-caprasimo text-4xl leading-none text-[#4d2a18]">Create Blink challenge?</p>
            <p className="mt-3 font-gabarito text-sm text-[rgba(58,37,24,0.86)]">
              CORA will open your wallet next so you can fund the challenge. Confirm the setup first to avoid the wallet popup feeling abrupt.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-[rgba(111,58,40,0.18)] bg-[rgba(255,255,255,0.74)] px-3 py-2">
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(111,58,40,0.62)]">Arena</p>
                <p className="mt-1 font-gabarito text-sm font-black text-[#1f1b18]">{selectedArena.label}</p>
              </div>
              <div className="rounded-2xl border border-[rgba(111,58,40,0.18)] bg-[rgba(255,255,255,0.74)] px-3 py-2">
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(111,58,40,0.62)]">Wager</p>
                <p className="mt-1 font-gabarito text-sm font-black text-[#1f1b18]">${FIXED_WAGER_USD}</p>
              </div>
              <div className="rounded-2xl border border-[rgba(111,58,40,0.18)] bg-[rgba(255,255,255,0.74)] px-3 py-2">
                <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(111,58,40,0.62)]">Scientist</p>
                <p className="mt-1 truncate font-gabarito text-sm font-black text-[#1f1b18]">
                  {selectedScientist?.name ?? "Choose later"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setBlinkCreateConfirmOpen(false)}
                className="btn-game btn-game-secondary px-5 py-3 text-xs"
                style={{
                  borderColor: "rgba(111,58,40,0.42)",
                  boxShadow: "0 4px 0 rgba(111,58,40,0.22)",
                  color: "rgba(111,58,40,0.42)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void commitCreateBlinkChallenge()}
                disabled={blinkChallengeBusy}
                className="btn-game btn-game-primary px-4 py-2 text-xs disabled:opacity-60"
              >
                {blinkChallengeBusy ? (
  <span className="flex items-center gap-2">
    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    Opening wallet...
  </span>
) : "Confirm And Open Wallet"}
              </button>
            </div>
          </div>
        </div>
      )}
      {blinkChallengePanelOpen && activeBlinkChallenge && (
        <BlinkChallengePanel
          challenge={activeBlinkChallenge}
          arenaLabel={activeBlinkArenaLabel}
          statusLabel={activeBlinkStatusLabel}
          waitingLabel={activeBlinkWaitingLabel}
          notificationPermission={browserNotificationPermission}
          notice={blinkChallengeNotice}
          canClear={Boolean(activeBlinkStatus && BLINK_CLEARABLE_STATUSES.has(activeBlinkStatus))}
          clearLabel={activeBlinkStatus === "PENDING" ? "Dismiss Challenge" : "Clear"}
          onEnableNotifications={enableBlinkBrowserNotifications}
          onClose={() => setBlinkChallengePanelOpen(false)}
          onClear={() =>
            clearActiveBlinkChallenge(
              activeBlinkStatus === "PENDING"
                ? "Challenge dismissed. Your wager is reclaimable on-chain after it expires."
                : "Blink challenge cleared locally.",
              "success",
            )
          }
        />
      )}
      {blinkJoinSnapshot && !blinkConfirmingOpen && !blinkCharacterSelectOpen && (
        <div className="fixed inset-x-0 top-0 z-[88] p-3 md:p-4">
          <div
            className="mx-auto w-full max-w-5xl frame-cut px-4 py-3 shadow-2xl md:px-5"
            style={{
              border: "1px solid rgba(248,214,148,0.36)",
              background:
                "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(248,214,148,0.82)]">
                  {"\u2694"} Rival Accepted
                </p>
                <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
                  A rival accepted your Blink challenge. Open the challenge to choose your scientist and confirm your presence.
                </p>
                <p className="mt-2 truncate font-mono text-[11px] text-[rgba(244,240,230,0.58)]">
                  Room {blinkJoinSnapshot.roomId} - {shortenAddress(blinkJoinSnapshot.walletAddress)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingErRecovery(false);
                      setBlinkCharacterSelectOpen(true);
                      setBlinkConfirmingOpen(false);
                    }}
                    className="btn-game btn-game-secondary px-3 py-1.5 text-[10px]"
                  >
                    View Challenge
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeMatchSurrenderModalOpen && activeMatchBannerSnapshot && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender match?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Surrendering ends the match. Your rival receives the wager. Confirm?
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveMatchSurrenderModalOpen(false)}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmActiveMatchSurrender}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Confirm Surrender
              </button>
            </div>
          </div>
        </div>
      )}
      {activeMatchSurrenderSnapshot && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-md p-5 text-center md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />
            <p className="mt-4 font-caprasimo text-2xl text-[var(--tone-cream)]">Connecting to room...</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
              Submitting surrender as soon as the match socket reconnects.
            </p>
          </div>
        </div>
      )}
      {/* Background World Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="paper-grain absolute inset-0 opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(12,18,15,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,24,20,0.26)_0%,rgba(9,13,11,0.42)_100%)]" />

        {/* Warm Spotlight Glow behind the modal */}
        <div className="absolute left-1/2 top-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-clay)] opacity-14 mix-blend-screen blur-[160px]" />

        {/* Ambient floating doodles */}
        <div className="absolute left-[8%] top-[14%] opacity-20 md:left-[11%] md:top-[11%]">
          <div className="animate-float-card text-6xl drop-shadow-md" style={{ transform: "rotate(-12deg)" }}>
            <div className="h-6 w-6 rounded-full border border-[rgba(248,214,148,0.38)] bg-[rgba(248,214,148,0.14)]" />
          </div>
        </div>
        <div className="absolute right-[9%] top-[20%] opacity-20 md:right-[14%] md:top-[17%]" style={{ animationDelay: "0.4s" }}>
          <div className="animate-float-card text-5xl drop-shadow-md" style={{ transform: "rotate(15deg)" }}>
            <div className="h-5 w-5 rounded-full border border-[rgba(157,180,150,0.42)] bg-[rgba(157,180,150,0.15)]" />
          </div>
        </div>
        <div className="absolute bottom-[17%] left-[10%] opacity-20 md:bottom-[20%] md:left-[15%]" style={{ animationDelay: "1.2s" }}>
          <div className="animate-float-card text-5xl drop-shadow-md" style={{ transform: "rotate(-8deg)" }}>
            <div className="h-5 w-5 rounded-full border border-[rgba(203,227,193,0.42)] bg-[rgba(203,227,193,0.16)]" />
          </div>
        </div>
        <div className="absolute bottom-[21%] right-[10%] opacity-20 md:bottom-[24%] md:right-[13%]" style={{ animationDelay: "0.8s" }}>
          <div className="animate-float-card text-6xl drop-shadow-md" style={{ transform: "rotate(6deg)" }}>
            <div className="h-6 w-6 rounded-full border border-[rgba(186,105,49,0.4)] bg-[rgba(186,105,49,0.14)]" />
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[45rem] font-caprasimo text-[var(--tone-bark)] opacity-[0.04]">
          C
        </div>
        <div className="animate-sparkle absolute left-[30%] top-[20%] h-2 w-2 rounded-full bg-[var(--tone-clay)] opacity-45" />
        <div className="animate-sparkle absolute bottom-[25%] right-[25%] h-3 w-3 rounded-full bg-[var(--tone-teal)] opacity-45" style={{ animationDelay: "1s" }} />
        <div className="animate-sparkle absolute left-[20%] top-[50%] h-1.5 w-1.5 rounded-full bg-[var(--tone-sage)] opacity-60" style={{ animationDelay: "0.5s" }} />
      </div>
      {challengeMode && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{ border: "2px solid var(--tone-clay)", background: "var(--warm-surface)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
              Challenge Received
            </p>
            <p className="mt-1 font-gabarito text-xs text-[var(--warm-text)]">
              {challengedBy ? `From ${shortenAddress(challengedBy)}` : "A rival challenged you."}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-[var(--tone-forest)]">
              {requestedToken ?? "SOL"} arena - ${requestedWager ?? FIXED_WAGER_USD}
            </p>
          </div>
        </div>
      )}
      {!walletConnected && !isGuestMode && (phase === "waiting" || phase === "found") && (
        <div className="fixed left-4 top-4 z-[70] w-full max-w-sm md:left-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--warm-surface)" }}
          >
            <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
              Wallet disconnected
            </p>
            <p className="mt-1 font-gabarito text-xs text-[var(--warm-text)]">
              Reconnect wallet before continuing queue or deposit confirmation.
            </p>
          </div>
        </div>
      )}
      {botOfferOpen && phase === "waiting" && (
        <div className="fixed inset-0 z-[88] grid place-items-center bg-[rgba(2,6,5,0.72)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-md p-5 text-center shadow-2xl md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Practice now?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">
              Queue is taking longer than usual. You can warm up in a no-stakes round with no Solana won or lost.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setBotOfferOpen(false);
                  setBotOfferDismissed(true);
                }}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Keep Queueing
              </button>
              <button
                type="button"
                onClick={startBotMatch}
                disabled={botMatchBusy}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                style={{ border: "1px solid rgba(157,180,150,0.44)", color: "var(--tone-cream)", background: "rgba(39,65,55,0.96)" }}
              >
                {botMatchBusy ? "Starting..." : "Practice Now"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isSelectingCharacterPreview && selectedArena && (
        <RoomPhaseShell
          phase="selecting_character"
          title="Lock your character"
          subtitle="Preview-only phase shell. Final flow is not wired yet."
          statusSlot={
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide"
                style={{ border: `1px solid ${selectedArena.frame}`, color: selectedArena.frame, background: "var(--color-surface)" }}
              >
                {selectedArena.label}
              </span>
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-mono text-xs font-semibold tracking-wide text-[var(--tone-cream)]"
                style={{ border: "1px solid var(--tone-bark)", background: "var(--color-surface)" }}
              >
                ${FIXED_WAGER_USD} {selectedArena.token}
              </span>
            </div>
          }
        >
          <CharacterSelectPanel
            mode="post_deposit"
            characters={characterOptions}
            selectedCharacterId={previewSelectionId}
            selectionState={previewSelectionState}
            autoAssignedCharacterId={previewAutoAssignedCharacterId}
            neutralDefaultCharacterId={SCIENTISTS[0]?.id}
            deadlineMs={18_000}
            opponentStatus={previewOpponentStatus}
            onSelect={(characterId) => {
              const next = SCIENTISTS.find((scientist) => scientist.id === characterId) ?? null;
              setSelectedScientist(next);
            }}
          />
        </RoomPhaseShell>
      )}
      {!isSelectingCharacterPreview && (
        blinkJoinSnapshot && blinkCharacterSelectOpen ? (
          <BlinkCharacterGate
            title="Choose your scientist"
            subtitle="Your rival accepted. Pick your scientist before confirming presence and entering the room."
            characters={characterOptions}
            selectedCharacterId={selectedScientist?.id ?? null}
            onSelect={(characterId) => {
              const next = SCIENTISTS.find((scientist) => scientist.id === characterId) ?? null;
              setSelectedScientist(next);
            }}
            onContinue={() => {
              if (!selectedScientist) return;
              setBlinkCharacterSelectOpen(false);
              setBlinkConfirmingOpen(true);
            }}
            onSurrender={() => setBlinkSurrenderSnapshot(blinkJoinSnapshot)}
          />
        ) : blinkJoinSnapshot && blinkConfirmingOpen ? (
          <BlinkRoomJoiner
            roomId={blinkJoinSnapshot.roomId}
            address={blinkJoinSnapshot.walletAddress}
            role="playerA"
            arenaId={blinkJoinSnapshot.arenaId ?? "sol"}
            scientistId={selectedScientist?.id ?? blinkJoinSnapshot.scientistId ?? "einstein"}
            token={blinkJoinSnapshot.token}
            wagerUsd={blinkJoinSnapshot.wagerUsd ?? FIXED_WAGER_USD}
            creatorConfirmSignature={blinkJoinSnapshot.createSignature}
            title="Confirming your match..."
            subtitle="Confirming your creator presence before entering the arena."
            onBack={() => {
              writeActiveMatchSession(null);
              setBlinkConfirmingOpen(false);
              setBlinkCharacterSelectOpen(true);
            }}
          />
        ) : showPendingErRecovery ? (
          <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
            <div
              className="game-card w-full p-6 text-center shadow-2xl md:p-8"
              style={{
                border: "1px solid rgba(248,214,148,0.36)",
                background:
                  "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
              }}
            >
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />
              <p className="mt-4 font-caprasimo text-3xl text-[var(--tone-cream)]">Confirming your match...</p>
              <div className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(248,214,148,0.18)] bg-[rgba(248,214,148,0.08)] px-3 py-1">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--tone-cream)]" />
                <span className="font-gabarito text-xs font-black uppercase tracking-[0.18em] text-[rgba(248,214,148,0.88)]">
                  Escrow resolver is settling
                </span>
              </div>
              <p className="mt-4 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
                We&apos;re waiting for the latest room state before sending you back into the lobby.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearActiveMatchRoomSession();
                  setPendingErRecovery(false);
                  setErSettling(false);
                  setMatchedRoomId(null);
                  setMatchedRole(null);
                  setMatchmakingState("idle");
                  setMatchmakingStage("finding");
                  setMatchmakingError(null);
                  setPhase("setup");
                }}
                className="btn-game btn-game-secondary mt-6 px-4 py-2 text-xs"
              >
                Back To Lobby
              </button>
            </div>
          </div>
        ) : phaseContextIssue ? (
          <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
            <div
              className="game-card w-full p-6 md:p-8 shadow-2xl"
              style={{ border: "2px solid var(--tone-bark)", background: "var(--warm-surface)" }}
            >
              <p className="font-caprasimo text-3xl text-[var(--tone-bark)]">{phaseContextIssue.title}</p>
              <p className="mt-2 font-gabarito text-sm text-[var(--warm-text)]">{phaseContextIssue.detail}</p>
              {showErSettling && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(60,92,95,0.16)] bg-[rgba(60,92,95,0.08)] px-3 py-1">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#3C5C5F]" />
                  <span className="font-gabarito text-xs font-black uppercase tracking-[0.18em] text-[#3C5C5F]">
                    Settling match...
                  </span>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={showErSettling}
                  onClick={() => {
                    writeActiveMatchSession(null);
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
                    setPhase("character-select");
                  }}
                  className={`btn-game btn-game-primary px-4 py-2 text-xs ${showErSettling ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  Back To Character Select
                </button>
                <button
                  type="button"
                  disabled={showErSettling}
                  onClick={() => {
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setSelectedScientist(initialScientist);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
                    setPhase("setup");
                  }}
                  className={`btn-game btn-game-secondary px-4 py-2 text-xs ${showErSettling ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  Restart Lobby
                </button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div
                key="setup"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <LobbySetup
                  walletAddress={walletAddr}
                  walletConnected={walletConnected}
                  guestMode={isGuestMode}
                  guestAddress={guestAddress || null}
                  arenas={ARENAS}
                  selectedArenaId={selectedArenaId}
                  onSelectArena={setSelectedArenaId}
                  wagerUsd={FIXED_WAGER_USD}
                  canPlay={canStart}
                  onPlay={() => {
                    if (canStart) {
                      setPhase("character-select");
                    }
                  }}
                  onCreateBlinkChallenge={handleCreateBlinkChallenge}
                  blinkChallengeBusy={blinkChallengeBusy}
                  hasActiveBlinkChallenge={hasBlockingBlinkChallenge}
                  onTryFreeTutorial={startTutorialFlow}
                  onReplayIntro={() => setIntroOverlayOpen(true)}
                />
              </motion.div>
            )}

            {phase === "character-select" && selectedArena && (
              <motion.div
                key="character-select"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <CharacterSelect
                  scientists={SCIENTISTS}
                  selected={selectedScientist}
                  onSelect={setSelectedScientist}
                  onBack={() => {
                    setIsTutorialMode(false);
                    setPhase("setup");
                  }}
                  onContinue={() => {
                    if (isTutorialMode) {
                      void startTutorialMatch();
                    } else if (canQueue) {
                      beginMatchmaking();
                    }
                  }}
                  arena={selectedArena}
                  wagerUsd={FIXED_WAGER_USD}
                  walletAddress={displayWalletAddr}
                  isGuest={isGuestMode || isTutorialMode}
                  displayAsGuest={displayWalletAsGuest}
                  continueLabel={isTutorialMode ? "Start Tutorial" : isGuestMode ? "Practice Now" : "Enter Queue"}
                  continueBusy={botMatchBusy}
                />
              </motion.div>
            )}

            {phase === "waiting" && selectedScientist && selectedArena && (
              <motion.div
                key="waiting"
                variants={PHASE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <MatchmakingWaiting
                  scientist={selectedScientist}
                  arena={selectedArena}
                  wagerUsd={FIXED_WAGER_USD}
                  walletAddress={walletAddr}
                  isGuest={isGuestMode}
                  state={matchmakingState === "idle" ? "searching" : matchmakingState}
                  stage={matchmakingStage}
                  errorMessage={matchmakingError}
                  queuePosition={queueSocket.queueStatus?.position ?? null}
                  queueDepth={queueSocket.queueStatus?.queueDepth ?? null}
                  onRetry={() => {
                    beginMatchmaking();
                  }}
                  onCancel={cancelMatchmaking}
                />
              </motion.div>
            )}

            {phase === "found" && selectedScientist && selectedArena && matchedRoomId && (
              <motion.div
                key="found"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="relative z-10"
              >
                <OpponentFound
                  myScientist={selectedScientist}
                  myWallet={walletAddr}
                  displayWalletAddress={displayWalletAddr}
                  displayAsGuest={displayWalletAsGuest}
                  roomId={matchedRoomId}
                  matchRole={matchedRole}
                  arena={selectedArena}
                  wagerUsd={FIXED_WAGER_USD}
                  isGuest={usesGuestIdentity}
                  onTimeout={() => {
                    // Fully reset matchmaking state — abort any hanging HTTP request,
                    // clear timers, and go back to character-select so the user can
                    // re-queue cleanly without phantom queue entries.
                    matchmakingAbortRef.current?.abort();
                    matchmakingAbortRef.current = null;
                    clearFoundTransitionTimers();
                    writeActiveMatchSession(null);
                    setMatchedRoomId(null);
                    setMatchedRole(null);
                    setMatchmakingState("idle");
                    setMatchmakingStage("finding");
                    setMatchmakingError(null);
                    setPhase("character-select");
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )
      )}
      <IntroOverlay
        isOpen={introOverlayOpen}
        onClose={handleCloseIntro}
      />
    </div>
  );
}
