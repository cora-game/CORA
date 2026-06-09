"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { Arena, Scientist } from "./LobbyScreen";
import { DepositIntentError, depositToMatch } from "@/lib/evm/deposit";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import type { DepositStatus } from "@/components/deposit/depositTypes";
import { writeActiveDepositIntent, writeActiveMatchSession } from "@/lib/session/matchSession";
import { getDepositMagicBlockUi } from "@/lib/magicblock/magicblockUi";
import { GAME_AUDIO, playOneShotAudio, unlockAudioPlayback, usePreloadedAudio } from "@/lib/audio/gameAudio";

type OpponentFoundProps = {
  myScientist: Scientist;
  myWallet: string;
  roomId: string;
  matchRole?: "playerA" | "playerB" | null;
  arena: Arena;
  wagerUsd: string;
  isGuest?: boolean;
  displayWalletAddress?: string;
  displayAsGuest?: boolean;
  onTimeout: () => void;
};

type SigningState = "idle" | "signing" | "waiting" | "error";

const AGREEMENT_TIMEOUT_SECONDS = 30;
const PHANTOM_SIGNING_WARNING_MS = 12_000;
const SIGNING_TIMEOUT_MS = 28_000;
const OPPONENT_FOUND_PRELOADED_AUDIO = [GAME_AUDIO.matched, GAME_AUDIO.countdown, GAME_AUDIO.battleMusic] as const;

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function identityLabel(address: string, isGuest: boolean) {
  return isGuest ? `Guest ${shortWallet(address)}` : shortWallet(address);
}

function rivalIdentityLabel(address: string, isBot: boolean) {
  return isBot ? `Bot ${shortWallet(address)}` : shortWallet(address);
}

function getRoomCancelledMessage(reason?: "player_cancelled" | "deposit_timeout" | "disconnect") {
  if (reason === "deposit_timeout") return "Deposit timed out. Returning to lobby.";
  if (reason === "disconnect") return "Match cancelled before battle start. Returning to lobby.";
  return "Match cancelled. Returning to lobby.";
}

export function OpponentFound({
  myScientist,
  myWallet,
  roomId,
  matchRole,
  arena,
  wagerUsd,
  isGuest = false,
  displayWalletAddress,
  displayAsGuest = isGuest,
  onTimeout,
}: OpponentFoundProps) {
  const router = useRouter();
  const { address: walletPublicKey } = useAccount();
  const [secondsLeft, setSecondsLeft] = useState(AGREEMENT_TIMEOUT_SECONDS);
  const [signingState, setSigningState] = useState<SigningState>("idle");
  const [signedDepositSignature, setSignedDepositSignature] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isCancellingMatch, setIsCancellingMatch] = useState(false);
  const [connectionIssueBannerVisible, setConnectionIssueBannerVisible] = useState(false);
  const [walletApprovalTakingLong, setWalletApprovalTakingLong] = useState(false);
  const [depositReminderOpen, setDepositReminderOpen] = useState(false);
  const [myExpressionUnavailable, setMyExpressionUnavailable] = useState(false);
  const [battleLaunchCountdown, setBattleLaunchCountdown] = useState<number | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const depositIntentConfirmedRef = useRef(false);
  const lastHandledDepositUnlockAtRef = useRef<number | null>(null);
  const cancelFiredRef = useRef(false);
  const matchedSoundPlayedRef = useRef(false);
  const lastCountdownSoundRef = useRef<number | null>(null);
  const myHappyExpressionSrc = useMemo(
    () => `/assets/characters/${myScientist.id.trim().toLowerCase()}/exp/happy.png`,
    [myScientist.id],
  );

  const walletAddress = isGuest ? myWallet : walletPublicKey ?? myWallet;
  const visibleWalletAddress = displayWalletAddress ?? (isGuest ? myWallet : walletAddress);
  const displayWalletLabel = identityLabel(visibleWalletAddress, displayAsGuest);
  usePreloadedAudio(OPPONENT_FOUND_PRELOADED_AUDIO);
  const signed = signingState === "waiting";
  const {
    connectionState,
    gameState,
    lastSocketCloseInfo,
    depositUnlockedAt,
    opponentFailedDepositAt,
    lastRoomCancelled,
    lastMatchFound,
    confirmDeposit,
    cancelMatch,
    reconnect,
  } = useMatchSocket({
    roomId,
    address: walletAddress,
    characterId: myScientist.id,
  });
  const isBotMatch = roomId.startsWith("bot-") || gameState?.roomType === "bot";
  const isBattleSnapshotReady = gameState?.status === "playing" && (gameState.hand?.length ?? 0) > 0;
  const hasOpponent = Boolean(gameState?.opponent?.address) && !gameState?.opponent.address.includes("Waiting");
  const opponentAddress = hasOpponent ? gameState?.opponent.address ?? null : null;
  const socketRole =
    lastMatchFound?.roomId === roomId && (lastMatchFound.role === "playerA" || lastMatchFound.role === "playerB")
      ? lastMatchFound.role
      : null;
  const effectiveRole = matchRole ?? socketRole;
  const isPlayerBWaitingUnlock =
    effectiveRole === "playerB" && !depositUnlockedAt && !signedDepositSignature && signingState !== "signing";
  const isPlayerAWaitingForPlayerB =
    effectiveRole === "playerA" && signingState === "waiting" && Boolean(signedDepositSignature);
  const shouldShowCountdown = !isBotMatch && !isPlayerBWaitingUnlock && signingState !== "waiting";
  const canAttemptSign =
    Boolean(walletPublicKey) &&
    signingState !== "signing" &&
    signingState !== "waiting" &&
    !isBotMatch &&
    !isPlayerBWaitingUnlock &&
    !signed;
  const reassignedRoomId =
    lastMatchFound?.roomId && lastMatchFound.roomId !== roomId ? lastMatchFound.roomId : null;
  const roomCancelledNotice = useMemo(
    () => (lastRoomCancelled ? getRoomCancelledMessage(lastRoomCancelled.reason) : null),
    [lastRoomCancelled],
  );
  const magicBlockUi = getDepositMagicBlockUi({
    erEnabled: undefined,
    erStatus: undefined,
    status: gameState?.status,
    effectiveRole,
    signingState,
    depositUnlockedAt,
  });
  const hasArenaPreparationSignal =
    gameState?.status === "playing" ||
    gameState?.status === "settling";
  const playerBHasCompletedSecondDeposit =
    effectiveRole === "playerB" &&
    Boolean(depositUnlockedAt) &&
    Boolean(signedDepositSignature);
  const playerHasSignedDeposit =
    signingState === "waiting" &&
    Boolean(signedDepositSignature) &&
    !isPlayerBWaitingUnlock;
  const displayedMagicBlockUi =
    battleLaunchCountdown !== null
      ? {
          ...magicBlockUi,
          tone: "magicblock" as const,
          badgeLabel: "Battle Ready",
          title: `Starting in ${battleLaunchCountdown}`,
          detail: "Final room sync complete. Keep this window open.",
          progress: 100,
          showPulse: false,
        }
      : isBotMatch && !hasArenaPreparationSignal
      ? {
          ...magicBlockUi,
          tone: "magicblock" as const,
          badgeLabel: "Practice Arena",
          title: "Preparing practice round",
          detail: "No deposit needed. Setting up the arena.",
          progress: 45,
          showPulse: true,
        }
      : playerHasSignedDeposit && !hasArenaPreparationSignal
      ? {
          ...magicBlockUi,
          tone: "standard" as const,
          badgeLabel: "Fast Arena",
          title: playerBHasCompletedSecondDeposit ? "Syncing MagicBlock" : "Fast Arena queued",
          detail: playerBHasCompletedSecondDeposit
            ? "Both deposits signed. Preparing the fast arena."
            : "Deposit signed. Waiting for the rival wager.",
          progress: playerBHasCompletedSecondDeposit ? 45 : 30,
          showPulse: true,
        }
      : magicBlockUi;
  const showArenaStatusStrip = isBotMatch || playerHasSignedDeposit || battleLaunchCountdown !== null;
  const isMagicBlockArenaLoading = displayedMagicBlockUi.tone === "magicblock";
  const isArenaProcessing = displayedMagicBlockUi.tone === "magicblock" || displayedMagicBlockUi.showPulse;

  // On EVM there is no "prepare tx" step — the deposit is a single contract call
  // (`deposit(matchId)` with value = wager) built and sent at sign time.

  useEffect(() => {
    if (matchedSoundPlayedRef.current) return;
    matchedSoundPlayedRef.current = true;
    playOneShotAudio(GAME_AUDIO.matched, { volume: 0.85 });
  }, []);

  useEffect(() => {
    if (battleLaunchCountdown === null) {
      lastCountdownSoundRef.current = null;
      return;
    }
    if (battleLaunchCountdown < 1 || battleLaunchCountdown > 3) return;
    if (lastCountdownSoundRef.current === battleLaunchCountdown) return;

    lastCountdownSoundRef.current = battleLaunchCountdown;
    playOneShotAudio(GAME_AUDIO.countdown, { volume: 0.9 });
  }, [battleLaunchCountdown]);

  useEffect(() => {
    const readyForBattle = isBotMatch
      ? isBattleSnapshotReady
      : signingState === "waiting" && isBattleSnapshotReady && Boolean(signedDepositSignature);

    if (!readyForBattle) {
      const resetTimer = window.setTimeout(() => setBattleLaunchCountdown(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const countdownTimers = [
      window.setTimeout(() => setBattleLaunchCountdown(3), 0),
      window.setTimeout(() => setBattleLaunchCountdown(2), 1000),
      window.setTimeout(() => setBattleLaunchCountdown(1), 2000),
    ];
    const launchTimer = window.setTimeout(() => {
      writeActiveMatchSession({
        walletAddress,
        address: walletAddress,
        displayAddress: visibleWalletAddress,
        displayAsGuest,
        roomId,
        role: effectiveRole ?? null,
        roomType: isBotMatch ? "bot" : null,
        isGuest,
        arenaId: arena.id,
        scientistId: myScientist.id,
        status: "playing",
        token: arena.token,
        arenaToken: arena.token,
        wagerUsd,
      });
      if (signedDepositSignature) {
        writeActiveDepositIntent({
          roomId,
          address: walletAddress,
          signature: signedDepositSignature,
        });
      }
      const params = new URLSearchParams({
        roomId,
        arena: arena.id,
        scientist: myScientist.id,
      });
      router.push(`/play?${params.toString()}`);
    }, 3000);

    return () => {
      for (const timerId of countdownTimers) {
        window.clearTimeout(timerId);
      }
      window.clearTimeout(launchTimer);
    };
  }, [
    signingState,
    router,
    walletAddress,
    visibleWalletAddress,
    displayAsGuest,
    roomId,
    arena.id,
    arena.token,
    wagerUsd,
    myScientist.id,
    signedDepositSignature,
    isBattleSnapshotReady,
    effectiveRole,
    isBotMatch,
    isGuest,
  ]);

  useEffect(() => {
    if (isBotMatch || isPlayerBWaitingUnlock || signingState === "waiting" || signingState === "signing" || signingState === "error") return;

    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }

    const id = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [
    signed,
    signingState,
    secondsLeft,
    onTimeout,
    router,
    walletAddress,
    roomId,
    arena.id,
    arena.token,
    wagerUsd,
    myScientist.id,
    isPlayerBWaitingUnlock,
    isBotMatch,
  ]);

  useEffect(() => {
    if (!lastRoomCancelled) return;
    const timerId = setTimeout(() => {
      onTimeout();
    }, 1800);
    return () => clearTimeout(timerId);
  }, [lastRoomCancelled, onTimeout]);

  useEffect(() => {
    if (!opponentFailedDepositAt) return;
    onTimeout();
  }, [opponentFailedDepositAt, onTimeout]);

  useEffect(() => {
    if (!signedDepositSignature) return;
    if (connectionState !== "connected") return;
    if (depositIntentConfirmedRef.current) return;

    confirmDeposit(signedDepositSignature);
    depositIntentConfirmedRef.current = true;
  }, [confirmDeposit, connectionState, signedDepositSignature]);

  useEffect(() => {
    if (effectiveRole !== "playerB") return;
    if (!depositUnlockedAt) return;
    if (lastHandledDepositUnlockAtRef.current === depositUnlockedAt) return;
    lastHandledDepositUnlockAtRef.current = depositUnlockedAt;
    setSecondsLeft(AGREEMENT_TIMEOUT_SECONDS);
  }, [depositUnlockedAt, effectiveRole]);

  useEffect(() => {
    if (signingState !== "signing") {
      const resetTimerId = setTimeout(() => {
        setWalletApprovalTakingLong(false);
      }, 0);
      return () => clearTimeout(resetTimerId);
    }

    const timerId = setTimeout(() => {
      setWalletApprovalTakingLong(true);
    }, PHANTOM_SIGNING_WARNING_MS);

    return () => clearTimeout(timerId);
  }, [signingState]);

  // Clear retry-in-progress flag once the socket settles to any non-reconnecting state.
  useEffect(() => {
    if (!isRetryingConnection) return;
    if (connectionState === "reconnecting") return;
    const timerId = setTimeout(() => {
      setIsRetryingConnection(false);
    }, 0);
    return () => clearTimeout(timerId);
  }, [connectionState, isRetryingConnection]);

  function isInsufficientFundsError(error: unknown) {
    if (error instanceof DepositIntentError) {
      return error.code === "insufficient_balance";
    }

    const raw = error instanceof Error ? error.message : String(error);
    const logs: string = (() => {
      if (error && typeof error === "object" && "logs" in error) {
        const value = (error as { logs?: unknown }).logs;
        if (Array.isArray(value)) return value.join(" ").toLowerCase();
      }
      return "";
    })();

    return `${raw} ${logs}`.toLowerCase().includes("insufficient") || logs.includes("lamport") || logs.includes("0x1");
  }

  function isWalletCancelledDepositError(error: unknown) {
    if (error instanceof DepositIntentError) {
      return error.code === "wallet_declined" || error.message === "signing_timeout" || error.message.includes("aborted");
    }

    const raw = error instanceof Error ? error.message : String(error);
    const combined = `${error instanceof Error ? error.name : ""} ${raw}`.toLowerCase();
    return (
      combined.includes("rejected") ||
      combined.includes("denied") ||
      combined.includes("cancel") ||
      combined.includes("signing_timeout") ||
      combined.includes("user rejected") ||
      combined.includes("aborted")
    );
  }

  function classifyDepositError(error: unknown): string {
    if (error instanceof DepositIntentError) {
      switch (error.code) {
        case "wallet_declined":
          return "You cancelled the transaction in your wallet.";
        case "insufficient_balance":
          return "Insufficient Balance";
        case "wallet_not_connected":
          return "Wallet disconnected. Reconnect and retry.";
        case "wallet_signing_not_supported":
          return "Your wallet does not support transaction signing.";
        case "rpc_error":
          return "Transaction expired before it could be confirmed. Please retry.";
        case "network_error":
          return "Unable to reach the game server. Check your connection and retry.";
        case "unknown":
          if (error.message === "signing_timeout") {
            return "Wallet approval timed out. Returning to lobby so you can queue again.";
          }
          break;
        default:
          break;
      }
    }

    const raw = error instanceof Error ? error.message : String(error);
    const logs: string = (() => {
      if (error && typeof error === "object" && "logs" in error) {
        const value = (error as { logs?: unknown }).logs;
        if (Array.isArray(value)) return value.join(" ").toLowerCase();
      }
      return "";
    })();
    const combined = `${raw} ${logs}`.toLowerCase();

    if (combined.includes("rejected") || combined.includes("cancel")) return "You cancelled the transaction in your wallet.";
    if (
      combined.includes("insufficient") ||
      combined.includes("lamport") ||
      logs.includes("0x1") ||
      combined.includes('"custom":1') ||
      combined.includes('"custom": 1') ||
      combined.includes("instructionerror") ||
      combined.includes("balance") ||
      combined.includes("fund")
    ) {
      return "Insufficient Balance";
    }
    if (combined.includes("blockhash") || combined.includes("expired")) {
      return "Transaction expired before it could be confirmed. Please retry.";
    }
    if (combined.includes("simulation failed")) {
      return "Transaction simulation failed. This usually means insufficient funds or a network issue.";
    }
    if (combined.includes("network") || combined.includes("timeout")) {
      return "Network error. Check your connection and retry.";
    }

    return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw || "Deposit signing failed. Please retry.";
  }

  // Show a timed top-center banner whenever the socket drops unexpectedly.
  useEffect(() => {
    if (connectionState === "connected") {
      hasConnectedOnceRef.current = true;
      return;
    }
    if (!hasConnectedOnceRef.current) return;
    if (connectionState !== "error" && connectionState !== "disconnected") return;
    const showTimerId = setTimeout(() => {
      setConnectionIssueBannerVisible(true);
    }, 0);
    const hideTimerId = setTimeout(() => setConnectionIssueBannerVisible(false), 6000);
    return () => {
      clearTimeout(showTimerId);
      clearTimeout(hideTimerId);
    };
  }, [connectionState]);

  async function onSignDeposit() {
    setDepositReminderOpen(false);
    console.info("[OpponentFound] Deposit click", {
      roomId,
      role: effectiveRole ?? "unknown",
      connectionState,
      hasWallet: Boolean(walletPublicKey),
      canAttemptSign,
      playerBLocked: isPlayerBWaitingUnlock,
      depositUnlockedAt,
      countdownSeconds: secondsLeft,
      signingState,
    });
    if (!canAttemptSign) return;

    setInsufficientFunds(false);
    setErrorText(null);
    setErrorVisible(false);
    setWalletApprovalTakingLong(false);
    setSigningState("signing");

    await unlockAudioPlayback([GAME_AUDIO.battleMusic]);

    let signingTimeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const signingTimeout = new Promise<never>((_, reject) => {
        signingTimeoutId = setTimeout(() => {
          reject(new DepositIntentError("unknown", "signing_timeout"));
        }, SIGNING_TIMEOUT_MS);
      });
      // The wager is server-authoritative: the API initialized the on-chain match
      // with this exact amount (wei) and broadcasts it in the game state.
      const wagerWei = BigInt(gameState?.wagerAmount || "1000000000000000");
      const signature = await Promise.race([
        depositToMatch({ roomId, wagerWei, token: gameState?.tokenMint }),
        signingTimeout,
      ]);

      if (!signature) {
        throw new Error("Missing transaction signature");
      }

      setSignedDepositSignature(signature);
      setSigningState("waiting");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof DepositIntentError ? error.code : "unknown";
      const errorName = error instanceof Error ? error.name : typeof error;
      const userCancelledDeposit = isWalletCancelledDepositError(error);
      const logPayload = {
        roomId,
        role: effectiveRole ?? "unknown",
        connectionState,
        errorCode,
        errorName,
        errorMsg,
      };
      if (userCancelledDeposit) {
        console.info(`[OpponentFound] Deposit signing cancelled: [${errorCode}] ${errorMsg}`, logPayload);
      } else {
        console.error(`[OpponentFound] Deposit signing failed: [${errorCode}] ${errorMsg}`, logPayload);
      }
      const message = classifyDepositError(error);
      const hasInsufficientFunds = isInsufficientFundsError(error);
      setSigningState("error");
      setErrorText(message);
      setErrorVisible(true);
      if (hasInsufficientFunds) {
        setInsufficientFunds(true);
      }
      if (userCancelledDeposit && !cancelFiredRef.current) {
        cancelFiredRef.current = true;
        cancelMatch();
        window.setTimeout(() => {
          onTimeout();
        }, 900);
      }
    } finally {
      if (signingTimeoutId) {
        clearTimeout(signingTimeoutId);
      }
    }
  }

  function onRequestDeposit() {
    if (!canAttemptSign) return;
    setDepositReminderOpen(true);
  }

  function onConfirmDepositReminder() {
    if (!canAttemptSign) return;
    void onSignDeposit();
  }

  function onCancelMatch() {
    // Ref guard prevents multiple rapid clicks from firing onTimeout() more than once
    // before the component unmounts (state updates are async, refs are synchronous).
    if (cancelFiredRef.current) return;
    cancelFiredRef.current = true;
    setIsCancellingMatch(true);
    cancelMatch();
    onTimeout();
  }

  function onRetryConnection() {
    if (isRetryingConnection) return;
    setIsRetryingConnection(true);
    reconnect();
  }

  useEffect(() => {
    if (!errorVisible) return;
    const duration = insufficientFunds ? 30_000 : 12_000;
    const timerId = setTimeout(() => {
      setErrorVisible(false);
      setErrorText(null);
      setSigningState("idle");
      setInsufficientFunds(false);
    }, duration);
    return () => clearTimeout(timerId);
  }, [errorVisible, insufficientFunds]);

  function getDepositHint() {
    const isDisconnected = connectionState === "error" || connectionState === "disconnected";
    const isReconnecting = connectionState === "reconnecting";
    if (reassignedRoomId) {
      return `Server reassigned to room ${reassignedRoomId}. Return to queue to continue sync.`;
    }
    if (insufficientFunds) {
      return `Top up your ${arena.token} wallet to cover $${wagerUsd} wager + ~0.001 SOL in fees, then retry.`;
    }
    if (isBotMatch) {
      if (battleLaunchCountdown !== null) return `Practice battle starts in ${battleLaunchCountdown}...`;
      if (isBattleSnapshotReady) return "Practice round ready. Starting battle.";
      return "No deposit needed. Preparing your practice round.";
    }
    if (!walletPublicKey) return "Connect your wallet first.";
    if (isPlayerBWaitingUnlock) {
      if (isDisconnected) {
        const code = lastSocketCloseInfo?.code;
        return `Connection issue while waiting${code ? ` (${code})` : ""}. Retry or cancel to return to lobby.`;
      }
      if (isReconnecting) return "Reconnecting... waiting for Player A to deposit.";
      return "Waiting for Player A to deposit first.";
    }
    if (isPlayerAWaitingForPlayerB) return "Deposit signed. Waiting for Player B.";
    if (effectiveRole === "playerB" && depositUnlockedAt && signingState === "idle") {
      return "Player A deposited. Your turn to sign.";
    }
    if (connectionState === "reconnecting") return "Reconnecting to room server...";
    if (connectionState === "error" || connectionState === "disconnected") return "Socket disconnected. Retry connection.";
    if (lastRoomCancelled) return getRoomCancelledMessage(lastRoomCancelled.reason);
    if (opponentFailedDepositAt) return "Opponent did not deposit in time. Returning to lobby.";
    if (battleLaunchCountdown !== null) return `Battle starts in ${battleLaunchCountdown}...`;
    if (walletApprovalTakingLong) {
      return "Phantom approval has been open for a while. Close the old prompt if needed, then retry for a fresh transaction.";
    }
    if (signingState === "signing") return "Confirm this transaction in Phantom.";
    if (signingState === "waiting") {
      if (depositUnlockedAt) return "Deposit signed. Waiting for opponent confirmation.";
      return "Deposit signed. Waiting for room confirmation.";
    }
    return `Auto-cancel in ${secondsLeft}s if not signed.`;
  }

  function getDepositStatus(): DepositStatus {
    if (insufficientFunds) return "insufficient_funds";
    if (opponentFailedDepositAt) return "opponent_failed";
    if (signingState === "error") return "error";
    if (isBotMatch) return isBattleSnapshotReady || battleLaunchCountdown !== null ? "confirmed" : "practice";
    if (!walletPublicKey) return "wallet_required";
    if (signingState === "signing") return "signing";
    if (battleLaunchCountdown !== null) return "confirmed";
    if (isBattleSnapshotReady && signedDepositSignature) return "confirmed";
    if (signingState === "waiting") return "waiting_opponent";
    if (signedDepositSignature) return "submitted";
    return "idle";
  }

  function getPrimaryButtonLabel() {
    const isDisconnected = connectionState === "error" || connectionState === "disconnected";
    const isReconnecting = connectionState === "reconnecting";
    if (isBotMatch) return "Preparing Practice...";
    if (isPlayerBWaitingUnlock) {
      if (isDisconnected) return "Disconnected...";
      if (isReconnecting) return "Reconnecting...";
      return "Waiting For Player A...";
    }
    if (isPlayerAWaitingForPlayerB) return "Waiting For Player B...";
    if (insufficientFunds) return "Retry After Top-Up";
    if (signingState === "signing") return "Signing In Wallet...";
    if (signingState === "waiting") return "Waiting For Opponent...";
    if (signingState === "error") return "Retry Deposit";
    return "Deposit";
  }



  return (
    <div
      className={`opponent-found-screen mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col overflow-x-hidden overflow-y-auto px-4 py-6 md:h-[100svh] md:overflow-hidden md:px-6 md:py-8 ${
        isBotMatch ? "opponent-found-screen--bot" : ""
      }`}
    >
      {/* Opponent failed to deposit popup */}
      {opponentFailedDepositAt && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid #c0392b",
              background: "linear-gradient(145deg, #2c1810 0%, #3d1f14 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[#e74c3c]">
              Match Cancelled
            </p>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
              Your opponent did not sign the deposit in time. Returning to character select...
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.15)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "#e74c3c",
                  animationName: "alertDrain",
                  animationDuration: "3500ms",
                  animationTimingFunction: "linear",
                  animationFillMode: "forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
      {roomCancelledNotice && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid rgba(186,105,49,0.86)",
              background: "linear-gradient(145deg, #2c1810 0%, #3d2315 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[#f8d694]">Match cancelled</p>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">{roomCancelledNotice}</p>
          </div>
        </div>
      )}
      {isBotMatch && (
        <div className="opponent-found-practice-banner z-[75] mx-auto w-full max-w-xl self-center px-4">
          <div
            className="opponent-found-practice-card frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid rgba(248,214,148,0.55)",
              background: "linear-gradient(145deg, rgba(13,24,20,0.96) 0%, rgba(25,43,35,0.96) 100%)",
            }}
          >
            <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.18em] text-[#f8d694]">
              Practice mode
            </p>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
              {displayAsGuest
                ? "You are trying CORA in a no-stakes round. Connect a wallet when you are ready for real matches."
                : "This is a no-stakes practice round. Connect a wallet when you are ready for real matches."}
            </p>
          </div>
        </div>
      )}
      {errorVisible && errorText && (
        <div className="fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
          <div
            className="frame-cut px-3 py-2 shadow-xl backdrop-blur-md"
            style={{
              border: "2px solid var(--tone-clay)",
              background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[var(--tone-bark)]">
                Deposit Signing Error
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorVisible(false);
                  setErrorText(null);
                  setSigningState("idle");
                  setInsufficientFunds(false);
                }}
                className="font-gabarito text-xs font-bold leading-none text-[var(--tone-bark)] opacity-60 hover:opacity-100"
                aria-label="Close alert"
              >
                X
              </button>
            </div>
            <p className="mt-1 break-words font-gabarito text-xs text-[var(--warm-text)]">
              {errorText}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(0,0,0,0.15)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "var(--tone-clay)",
                  animationName: "alertDrain",
                  animationDuration: insufficientFunds ? "30000ms" : "12000ms",
                  animationTimingFunction: "linear",
                  animationFillMode: "forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
      {walletApprovalTakingLong && signingState === "signing" && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid var(--tone-clay)",
              background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            }}
          >
            <p className="font-caprasimo text-base text-[var(--tone-bark)]">
              Phantom Taking Too Long
            </p>
            <p className="mt-1 font-gabarito text-sm text-[var(--warm-text)]">
              If the wallet popup has been sitting open, the transaction can expire. Close the old prompt and retry to get a fresh deposit transaction.
            </p>
          </div>
        </div>
      )}
      {connectionIssueBannerVisible && (
        <div className="fixed left-1/2 top-6 z-[80] w-full max-w-md -translate-x-1/2">
          <div
            className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
            style={{
              border: "2px solid rgba(186,105,49,0.72)",
              background: "linear-gradient(145deg, #2c1e10 0%, #3d2a14 100%)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-caprasimo text-base text-[#f8d694]">
                Connection issue while waiting
              </p>
              <button
                type="button"
                onClick={() => setConnectionIssueBannerVisible(false)}
                className="font-gabarito text-xs font-bold leading-none text-[#f8d694] opacity-60 hover:opacity-100"
                aria-label="Dismiss connection banner"
              >
                ✕
              </button>
            </div>
            {lastSocketCloseInfo && (
              <p className="mt-1 font-mono text-xs text-[rgba(244,240,230,0.72)]">
                Close code {lastSocketCloseInfo.code}{lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}
              </p>
            )}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]">
              <div
                className="h-full"
                style={{
                  width: "100%",
                  background: "#f8d694",
                  animationName: "alertDrain",
                  animationDuration: "6000ms",
                  animationTimingFunction: "linear",
                  animationFillMode: "forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}
      {depositReminderOpen && canAttemptSign && !isBotMatch && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(2,6,5,0.78)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-md p-5 text-center shadow-2xl md:p-6"
            style={{
              border: "1px solid rgba(248,214,148,0.42)",
              background: "linear-gradient(145deg, rgba(13,24,20,0.98) 0%, rgba(22,35,29,0.98) 100%)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.46)",
            }}
          >
            <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.18em] text-[#f8d694]">
              Deposit rule reminder
            </p>
            <p className="mt-2 font-caprasimo text-3xl leading-tight text-[var(--tone-cream)]">
              Confirm wager deposit
            </p>
            <p className="mt-4 font-gabarito text-sm text-[rgba(244,240,230,0.88)]">
              Wager: <span className="font-black text-[var(--tone-cream)]">${wagerUsd}</span> on{" "}
              <span className="font-black text-[var(--tone-cream)]">{arena.token}</span> arena.
            </p>
            <p className="mt-2 rounded-xl border border-[rgba(248,214,148,0.18)] bg-[rgba(248,214,148,0.08)] px-3 py-2 font-gabarito text-sm text-[#f1dfc1]">
              Winner takes the settled pot; surrendering or leaving can forfeit your wager.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDepositReminderOpen(false)}
                className="btn-game btn-game-secondary px-5 py-3 text-xs"
                style={{
                  borderColor: "rgba(248,214,148,0.34)",
                  background: "rgba(248,214,148,0.08)",
                  boxShadow: "0 4px 0 rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
                  color: "rgba(255,246,224,0.92)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDepositReminder}
                disabled={!canAttemptSign}
                className={`btn-game btn-game-primary px-4 py-2 text-xs shadow-xl ${
                  canAttemptSign ? "" : "cursor-not-allowed opacity-55"
                }`}
              >
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="opponent-found-heading flex-shrink-0 text-center">
      <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--tone-cream)]/90">
        {arena.label} · ${wagerUsd} {arena.token}
      </p>
      <h1 className="mt-2 font-caprasimo text-4xl text-[var(--tone-cream)] drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] md:text-5xl">
        {isBotMatch ? "Practice Rival Locked" : "Rival Locked"}
      </h1>
      {!isBotMatch && (
        <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.9)]">
          Sign the deposit before the timer expires.
        </p>
      )}
      </div>

      <div className="opponent-found-duel-grid mt-6 grid w-full flex-shrink-0 grid-cols-1 gap-3 md:mt-8 md:gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div
          className="opponent-found-player-card relative overflow-hidden rounded-2xl p-5 shadow-xl"
          style={{
            border: "2px solid rgba(111,58,40,0.62)",
            background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,214,148,0.2),transparent_52%)]" />
          <div className="opponent-found-card-content relative flex items-center gap-4">
            <div
              className="opponent-found-avatar grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{
                border: "2px solid rgba(111,58,40,0.6)",
                background: myScientist.portraitBg,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              {!myExpressionUnavailable ? (
                <div className="relative h-full w-full">
                  <Image
                    src={myHappyExpressionSrc}
                    alt={`${myScientist.name} happy expression`}
                    fill
                    sizes="80px"
                    className="object-cover object-center"
                    onError={() => setMyExpressionUnavailable(true)}
                  />
                </div>
              ) : (
                <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                  {myScientist.initial}
                </span>
              )}
            </div>

            <div className="opponent-found-card-meta min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                You
              </span>
              <p className="opponent-found-name mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">{myScientist.name}</p>
              <p className="opponent-found-detail mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">{myScientist.base}</p>
              <p className="opponent-found-wallet mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">{displayWalletLabel}</p>
            </div>
          </div>
        </div>

        <div className="opponent-found-vs-wrap grid place-items-center px-4 py-1 md:px-6">
          <div className="opponent-found-vs animate-orb-breath font-caprasimo text-5xl leading-none text-[var(--tone-cream)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] md:text-6xl" style={{ textShadow: "0 0 20px rgba(248,214,148,0.28)" }}>
            VS
          </div>
        </div>

        <div
          className="opponent-found-player-card relative overflow-hidden rounded-2xl p-5 shadow-xl"
          style={{
            border: "2px solid rgba(111,58,40,0.62)",
            background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(157,180,150,0.17),transparent_50%)]" />
          <div className="opponent-found-card-content relative flex items-center gap-4">
            <div
              className="opponent-found-avatar grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{
                border: "2px solid rgba(111,58,40,0.6)",
                background: "linear-gradient(150deg, #5a321f 0%, #7a4529 65%, #3f2418 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                ?
              </span>
            </div>
            <div className="opponent-found-card-meta min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                Rival
              </span>
              <p className="opponent-found-name mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">
                Your Rival
              </p>
              <p className="opponent-found-detail mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">
                Character revealed when battle starts.
              </p>
              <p className="opponent-found-wallet mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">
                {opponentAddress ? rivalIdentityLabel(opponentAddress, isBotMatch) : "Syncing rival..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="opponent-found-deposit-area flex min-h-0 flex-1 flex-col justify-end overflow-visible pb-4 md:overflow-y-auto">
        <div
          className="opponent-found-deposit-shell mt-6 w-full rounded-2xl border p-4 shadow-xl md:mt-8 md:p-5"
          style={{
            borderColor: "rgba(248,214,148,0.35)",
            background: "linear-gradient(160deg, rgba(12,21,17,0.72), rgba(19,32,26,0.72))",
          }}
        >
          <DepositPanel
            title={isBotMatch ? "Practice round" : undefined}
            token={arena.token}
            wagerUsd={wagerUsd}
            status={getDepositStatus()}
            helperText={getDepositHint()}
            countdownSeconds={shouldShowCountdown ? secondsLeft : undefined}
            countdownSlot={
              signingState === "signing" ? (
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{
                    border: "1px solid rgba(248,214,148,0.26)",
                    background: "linear-gradient(145deg, rgba(248,214,148,0.14), rgba(203,227,193,0.1))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-[#f8d694] animate-pulse" />
                  <span className="font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[#f8d694]">
                    Opening Phantom...
                  </span>
                </div>
              ) : null
            }
            signature={signedDepositSignature}
            canPrimaryAction={canAttemptSign}
            primaryActionLabel={getPrimaryButtonLabel()}
            onPrimaryAction={isBotMatch ? undefined : onRequestDeposit}
            statusStripSlot={
              showArenaStatusStrip ? (
                <div className="mx-auto flex min-h-[58px] w-full max-w-xl items-center justify-center">
                  <div
                    className="w-full rounded-2xl px-3 py-2"
                    style={{
                      border:
                        displayedMagicBlockUi.tone === "magicblock"
                          ? "1px solid rgba(157,180,150,0.34)"
                          : "1px solid rgba(248,214,148,0.24)",
                      background:
                        displayedMagicBlockUi.tone === "magicblock"
                          ? "linear-gradient(145deg, rgba(157,180,150,0.14), rgba(60,92,95,0.12))"
                          : "linear-gradient(145deg, rgba(248,214,148,0.10), rgba(255,255,255,0.04))",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex shrink-0 rounded-full border border-[rgba(255,255,255,0.16)] px-2.5 py-1 font-gabarito text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tone-cream)]">
                        {displayedMagicBlockUi.badgeLabel}
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-gabarito text-xs font-bold uppercase tracking-[0.08em] text-[rgba(244,240,230,0.92)]">
                          {displayedMagicBlockUi.title}
                        </p>
                        <p className="truncate font-gabarito text-xs text-[rgba(244,240,230,0.72)]">
                          {displayedMagicBlockUi.detail}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className={`h-full rounded-full ${
                          displayedMagicBlockUi.showPulse && !isArenaProcessing ? "animate-pulse" : ""
                        }`}
                        style={{
                          width: isArenaProcessing ? "100%" : `${displayedMagicBlockUi.progress ?? 0}%`,
                          backgroundImage: isMagicBlockArenaLoading
                            ? "linear-gradient(90deg, #5f806d 0%, #9db496 35%, #e1f2d8 50%, #9db496 65%, #5f806d 100%)"
                            : isArenaProcessing
                              ? "linear-gradient(90deg, #ba6931 0%, #f8d694 35%, #fff6e0 50%, #f8d694 65%, #ba6931 100%)"
                              : "linear-gradient(90deg, #f8d694 0%, #ba6931 100%)",
                          backgroundSize: isArenaProcessing ? "200% 100%" : undefined,
                          animation: isArenaProcessing ? "shimmer 2s linear infinite" : undefined,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null
            }
            walletSlot={
              !walletPublicKey && !isGuest ? (
                <div className="pt-1">
                  <HydratedWalletButton />
                </div>
              ) : null
            }
            retrySlot={
              connectionState === "error" || connectionState === "disconnected" ? (
                <button
                  type="button"
                  onClick={onRetryConnection}
                  disabled={isRetryingConnection}
                  className={`btn-game btn-game-secondary px-3 py-1.5 text-[10px] shadow-sm ${
                    isRetryingConnection ? "cursor-not-allowed opacity-55" : ""
                  }`}
                >
                  {isRetryingConnection ? "Retrying..." : "Retry Connection"}
                </button>
              ) : null
            }
            cancelSlot={
              signingState === "idle" || signingState === "error" ? (
                <button
                  type="button"
                  onClick={onCancelMatch}
                  disabled={isCancellingMatch}
                  className={`btn-game btn-game-secondary px-3 py-1.5 text-[10px] shadow-sm ${
                    isCancellingMatch ? "cursor-not-allowed opacity-55" : ""
                  }`}
                >
                  {isCancellingMatch ? "Leaving..." : "Cancel Match"}
                </button>
              ) : null
            }
            extraSlot={null}
          />
        </div>
      </div>


    </div>
  );
}
