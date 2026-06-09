"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWalletArenaPlayability } from "@/hooks/useWalletArenaPlayability";
import type { Arena } from "./LobbyScreen";

type LobbySetupProps = {
  walletAddress: string;
  walletConnected: boolean;
  guestMode: boolean;
  guestAddress: string | null;
  arenas: Arena[];
  selectedArenaId: string | null;
  onSelectArena: (arenaId: string) => void;
  wagerUsd: string;
  canPlay: boolean;
  onPlay: () => void;
  onCreateBlinkChallenge: () => void;
  blinkChallengeBusy: boolean;
  hasActiveBlinkChallenge: boolean;
  onTryFreeTutorial: () => void;
  onReplayIntro: () => void;
};

function truncateWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function ArenaIcon({ token, active }: { token: string; active: boolean }) {
  if (token === "ETH") {
    const ethColor = active ? "#214335" : "#4f6f5b";
    // Ethereum diamond.
    return (
      <svg width="18" height="22" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: ethColor }}>
        <path d="M12 0 3 15l9 5 9-5L12 0Z" fill="currentColor" opacity="0.85" />
        <path d="M12 22 3 17l9 13 9-13-9 5Z" fill="currentColor" />
      </svg>
    );
  }
  // USDC (default): blue circle with a dollar glyph.
  const usdcColor = active ? "#27407f" : "#5b8def";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: usdcColor }}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff" fontFamily="sans-serif">$</text>
    </svg>
  );
}

function HeaderPill({
  children,
  tone = "info",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  tone?: "info" | "action" | "disabled";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const isButton = Boolean(onClick);
  const toneStyle =
    tone === "action"
      ? {
          border: "2px solid rgba(248,214,148,0.34)",
          background: "linear-gradient(180deg, rgba(111,58,40,0.88) 0%, rgba(72,39,25,0.92) 100%)",
          boxShadow: "inset 0 1px 0 rgba(248,214,148,0.18), 0 10px 24px rgba(0,0,0,0.22)",
          color: "#f8d694",
        }
      : tone === "disabled"
        ? {
            border: "2px solid rgba(88,88,82,0.72)",
            background: "linear-gradient(180deg, rgba(34,38,34,0.9) 0%, rgba(24,28,24,0.95) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            color: "rgba(244,240,230,0.62)",
          }
        : {
            border: "2px solid var(--tone-bark)",
            background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
            boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2), 0 10px 24px rgba(0,0,0,0.22)",
            color: "var(--tone-mint)",
          };
  const className = `frame-cut frame-cut-sm inline-flex items-center gap-1.5 px-2.5 py-1.5 font-gabarito text-[10px] font-bold uppercase tracking-wide shadow-lg transition sm:gap-2 sm:px-3 sm:py-2 sm:text-xs sm:tracking-wider ${
    isButton && !disabled ? "hover:-translate-y-0.5 hover:brightness-110" : ""
  } ${disabled ? "cursor-not-allowed grayscale" : ""}`;

  if (isButton) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className} style={toneStyle}>
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={toneStyle}>
      {children}
    </div>
  );
}

export function LobbySetup({
  walletAddress,
  walletConnected,
  guestMode,
  guestAddress,
  arenas,
  selectedArenaId,
  onSelectArena,
  wagerUsd,
  canPlay,
  onPlay,
  onCreateBlinkChallenge,
  blinkChallengeBusy,
  hasActiveBlinkChallenge,
  onTryFreeTutorial,
  onReplayIntro,
}: LobbySetupProps) {
  const { status: walletStatus } = useAccount();
  const { openConnectModal } = useConnectModal();
  const connecting = walletStatus === "connecting" || walletStatus === "reconnecting";
  const [walletBusy, setWalletBusy] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const ARENA_ASSET_VERSION = "2026-06-10-base-eth-usdc";
  const NULL_ARENA_IMAGE_URL = `/assets/arena/null.png?v=${ARENA_ASSET_VERSION}`;
  const ETH_ARENA_IMAGE_URL = `/assets/arena/eth.png?v=${ARENA_ASSET_VERSION}`;
  const USDC_ARENA_IMAGE_URL = `/assets/arena/usdc.png?v=${ARENA_ASSET_VERSION}`;
  const selectedArena = arenas.find((arena) => arena.id === selectedArenaId) ?? null;
  const selectedArenaDisplay = selectedArena;
  const comingSoonArenaVisible = false;
  const actionDisabled = !mounted || !walletConnected || !canPlay;
  const actionLabel = "Pick Scientist";
  const guestAddressLabel = guestAddress ? `Guest ${truncateWallet(guestAddress)}` : "Guest";
  const identityLabel = !mounted
    ? "Wallet not connected"
    : guestMode
      ? guestAddressLabel
      : walletConnected
        ? truncateWallet(walletAddress)
        : "Wallet not connected";
  let arenaImageUrl = NULL_ARENA_IMAGE_URL;
  if (selectedArenaDisplay?.token === "ETH") {
    arenaImageUrl = ETH_ARENA_IMAGE_URL;
  } else if (selectedArenaDisplay?.token === "USDC") {
    arenaImageUrl = USDC_ARENA_IMAGE_URL;
  }
  const [displayedArenaImageUrl, setDisplayedArenaImageUrl] = useState<string>(arenaImageUrl);
  const [loadedArenaImageUrls, setLoadedArenaImageUrls] = useState<Record<string, true>>({
    [arenaImageUrl]: true,
  });
  const incomingArenaImageUrl = arenaImageUrl !== displayedArenaImageUrl ? arenaImageUrl : null;
  const incomingArenaImageReady = incomingArenaImageUrl ? Boolean(loadedArenaImageUrls[incomingArenaImageUrl]) : false;

  const playabilityEnabled = !guestMode && walletConnected && Boolean(selectedArena) && !comingSoonArenaVisible;
  const { playability, loading, error } = useWalletArenaPlayability({
    address: walletConnected ? walletAddress : "",
    arenaId: selectedArena?.id ?? "",
    token: selectedArena?.token ?? "ETH",
    enabled: playabilityEnabled,
  });

  function openWalletEntry() {
    if (walletBusy || connecting) return;
    openConnectModal?.();
  }

  const tokenBalanceValue = !selectedArenaDisplay
    ? "--"
    : comingSoonArenaVisible
      ? "Soon"
    : guestMode
      ? "Practice"
    : !mounted || !walletConnected
      ? "--"
    : loading
      ? "..."
    : error || !playability?.reliable
      ? "N/A"
      : (playability.tokenBalance ?? "--");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preloads = [NULL_ARENA_IMAGE_URL, ETH_ARENA_IMAGE_URL, USDC_ARENA_IMAGE_URL];
    for (const url of preloads) {
      const image = new window.Image();
      image.onload = () => {
        setLoadedArenaImageUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      };
      image.onerror = () => {
        setLoadedArenaImageUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      };
      image.src = url;
    }
  }, [ETH_ARENA_IMAGE_URL, USDC_ARENA_IMAGE_URL, NULL_ARENA_IMAGE_URL]);

  useEffect(() => {
    if (!incomingArenaImageUrl || typeof window === "undefined") return;
    if (loadedArenaImageUrls[incomingArenaImageUrl]) return;

    let cancelled = false;
    const image = new window.Image();
    const targetUrl = incomingArenaImageUrl;
    const markLoaded = () => {
      if (cancelled) return;
      setLoadedArenaImageUrls((prev) => (prev[targetUrl] ? prev : { ...prev, [targetUrl]: true }));
    };

    image.onload = markLoaded;
    image.onerror = markLoaded;
    image.src = targetUrl;
    if (image.complete) {
      markLoaded();
    }

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [incomingArenaImageUrl, loadedArenaImageUrls]);

  useEffect(() => {
    if (!incomingArenaImageUrl || !incomingArenaImageReady) return;
    const id = setTimeout(() => {
      setDisplayedArenaImageUrl(incomingArenaImageUrl);
    }, 320);
    return () => clearTimeout(id);
  }, [incomingArenaImageReady, incomingArenaImageUrl]);

  return (
    <div className="lobby-setup-screen relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-3 py-3 sm:px-4 sm:py-5 md:px-6 md:py-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-6 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <HeaderPill>
            <span className="h-3 w-3 rounded-full border border-[var(--tone-teal)] bg-[var(--tone-clay)] sm:h-4 sm:w-4" />
            <span className="font-mono text-[10px] font-semibold tracking-wide text-[var(--tone-cream)] sm:text-xs">
              {identityLabel}
            </span>
          </HeaderPill>

          <div
            className="frame-cut frame-cut-sm inline-flex items-center gap-1.5 px-2.5 py-1.5 shadow-lg sm:gap-2 sm:px-3 sm:py-2"
            style={{
              border: "2px solid var(--tone-bark)",
              background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
              boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
            }}
          >
            <span className="font-gabarito text-[10px] font-bold uppercase tracking-wide text-[var(--tone-mint)] opacity-90 sm:text-xs sm:tracking-wider">
              Wager ${wagerUsd || "0"}
              {selectedArenaDisplay ? ` · ${selectedArenaDisplay.token}` : ""}
            </span>
          </div>

          <div
            className="frame-cut frame-cut-sm inline-flex items-center gap-1.5 px-2.5 py-1.5 shadow-lg sm:gap-2 sm:px-3 sm:py-2"
            style={{
              border: "2px solid var(--tone-bark)",
              background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
              boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
            }}
          >
            <span className="font-gabarito text-[10px] font-bold uppercase tracking-wide text-[var(--tone-mint)] opacity-90 sm:text-xs sm:tracking-wider">
              {guestMode ? (
                "Guest Mode"
              ) : (
                <>
                  {selectedArenaDisplay ? `${selectedArenaDisplay.token}` : "Token"}: {tokenBalanceValue}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderPill tone="action" onClick={onReplayIntro}>
            Replay Intro
          </HeaderPill>
          <HeaderPill tone="disabled" disabled>
            History Coming Soon
          </HeaderPill>
        </div>
      </header>

      <div
        className="game-card game-card-static lobby-setup-card mt-1 flex grow w-full flex-col overflow-hidden shadow-2xl sm:mt-2 md:flex-row"
        style={{
          border: "3px solid var(--tone-bark)",
          background: "linear-gradient(180deg, #e7d8bb 0%, #dccaa7 100%)",
          boxShadow: "0 6px 0 rgba(111,58,40,0.35), 0 24px 55px rgba(8,15,12,0.45)",
        }}
      >
        <section
          className="lobby-setup-arena-panel w-full shrink-0 border-b p-3 sm:p-5 md:w-[320px] md:border-b-0 md:border-r"
          style={{
            borderColor: "rgba(111,58,40,0.34)",
            background: "linear-gradient(180deg, #fff8e8 0%, #f3e6c9 100%)",
            boxShadow: "inset -1px 0 0 rgba(111,58,40,0.2), inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          <p className="font-gabarito text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tone-bark)] opacity-80 sm:text-[11px] sm:tracking-[0.2em]">
            Arena Token
          </p>
          <p className="mb-3 mt-0.5 font-gabarito text-[11px] text-[var(--warm-text)] sm:mb-4 sm:mt-1 sm:text-xs">Select your battleground</p>
          <div className="lobby-setup-arena-list flex flex-row gap-2 sm:flex-col sm:gap-0 sm:space-y-3">
            {arenas.map((arena) => {
              const active = selectedArenaId === arena.id;
              const flavor = arena.token === "ETH" ? "Native ETH Arena" : "Stablecoin Arena";
              const checkStyle =
                arena.token === "USDC"
                  ? {
                      border: "1px solid rgba(39,64,127,0.48)",
                      background: "#cfe0fb",
                      color: "#27407f",
                    }
                  : {
                      border: "1px solid rgba(17,44,35,0.45)",
                      background: "#d7f0d4",
                      color: "#143324",
                    };

              return (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => onSelectArena(arena.id)}
                  className={`frame-cut lobby-setup-arena-option relative w-full px-3 py-2.5 text-left transition-all duration-200 sm:px-4 sm:py-3 ${
                    !active ? "opacity-90 hover:-translate-y-0.5" : "-translate-y-1 shadow-lg"
                  }`}
                  style={{
                    border: `2.5px solid ${active ? arena.accent : "rgba(111,58,40,0.28)"}`,
                    background: active
                      ? arena.token === "ETH"
                        ? "linear-gradient(180deg, #eef6ec 0%, #d2e2cd 100%)"
                        : "linear-gradient(180deg, #eef3fb 0%, #c9d8ef 100%)"
                      : "linear-gradient(180deg, #fffaf0 0%, #efe3c8 100%)",
                    boxShadow: active
                      ? `0 8px 0 rgba(111,58,40,0.22), 0 14px 24px ${arena.accent}55`
                      : "0 5px 0 rgba(111,58,40,0.14), 0 10px 20px rgba(111,58,40,0.08)",
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-start sm:gap-2.5">
                    <div
                      className="lobby-setup-arena-token-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-inner transition-colors duration-200 sm:h-10 sm:w-10"
                      style={{ background: arena.previewBg, border: `1.5px solid ${arena.accent}` }}
                    >
                      <ArenaIcon token={arena.token} active={active} />
                    </div>
                    <div className="text-center sm:text-left">
                      <p
                        className="font-gabarito text-sm font-bold tracking-wide sm:text-base"
                        style={{ color: active ? "#4d2a18" : "var(--tone-bark)" }}
                      >
                        {arena.token}
                      </p>
                      <p className="font-gabarito text-[9px] uppercase tracking-wide text-[var(--warm-text)] opacity-80 sm:text-[10px]">
                        {flavor}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <div
                      className="lobby-setup-arena-check"
                      style={checkStyle}
                    >
                      {"\u2713"}
                    </div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="frame-cut lobby-setup-arena-option lobby-setup-more-option relative w-full cursor-not-allowed px-3 py-2.5 text-left opacity-65 grayscale sm:px-4 sm:py-3"
              style={{
                border: "2.5px dashed rgba(111,58,40,0.18)",
                background: "linear-gradient(180deg, #efebe3 0%, #ded7ca 100%)",
                boxShadow: "0 5px 0 rgba(111,58,40,0.06), 0 10px 18px rgba(111,58,40,0.04)",
              }}
            >
              <p className="font-gabarito text-xs font-bold uppercase tracking-[0.16em] text-[rgba(77,42,24,0.56)] sm:text-sm sm:tracking-[0.18em] flex items-center justify-center w-full">
                <span className="hidden sm:inline">and more to come</span>
                <span className="inline sm:hidden text-lg font-bold" style={{ marginTop: '-2px' }}>+</span>
              </p>
            </button>
          </div>
        </section>

        <section
          className="lobby-setup-hero relative flex min-h-[300px] grow flex-col justify-between overflow-hidden p-4 sm:min-h-[400px] sm:p-6 md:min-h-[500px] md:p-8"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url('${displayedArenaImageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {incomingArenaImageUrl && (
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${
                incomingArenaImageReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `url('${incomingArenaImageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,rgba(8,15,12,0)_0%,rgba(8,15,12,0.46)_62%,rgba(8,15,12,0.68)_100%)]" />
          <div className="arena-grid pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay" />
          {selectedArena && (
            <div
              className="pointer-events-none absolute -right-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full blur-3xl sm:-right-20 sm:h-72 sm:w-72"
              style={{ background: `${selectedArena.accent}4d` }}
            />
          )}

          <div className="pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center font-caprasimo text-[16rem] text-white opacity-[0.04] mix-blend-overlay sm:text-[30rem]">
            C
          </div>

          <div className="lobby-setup-hero-copy relative z-10 max-w-lg">
            <p
              className="font-gabarito text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tone-cream)] opacity-90 sm:text-[11px] sm:tracking-[0.24em]"
              style={{ textShadow: "0 4px 18px rgba(0,0,0,0.78), 0 2px 4px rgba(0,0,0,0.56)" }}
            >
              Pre-Match Lobby
            </p>
            <h1
              className="lobby-setup-title mt-1.5 font-caprasimo text-[2rem] leading-none text-[#fffaf0] sm:mt-2 sm:text-4xl md:text-5xl"
              style={{ textShadow: "0 10px 30px rgba(0,0,0,0.82), 0 3px 6px rgba(0,0,0,0.58)" }}
            >
              Choose Your Arena
            </h1>
            <p
              className="mt-2 max-w-md font-gabarito text-xs text-[var(--tone-cream)] sm:mt-3 sm:text-sm"
              style={{ textShadow: "0 4px 18px rgba(0,0,0,0.78), 0 2px 4px rgba(0,0,0,0.56)" }}
            >
              {selectedArenaDisplay ? `Selected: ${selectedArenaDisplay.token} Arena` : "Pick SOL, BONK, or MEW, lock the wager, then draft your scientist."}
            </p>
          </div>

          <div className="lobby-setup-action-block relative z-10 mt-auto flex w-full flex-col items-end justify-end pt-8 sm:pt-12">
            <div className="flex w-full shrink-0 flex-col items-center gap-2.5 sm:gap-3 md:w-auto md:items-end">
              {!selectedArenaDisplay ? (
                <p className="mb-1 font-gabarito text-[11px] text-[var(--tone-cream)] opacity-80 text-center sm:mb-2 sm:text-xs md:text-right">
                  Select a token to wager, or practice for free
                </p>
              ) : (
                mounted && !walletConnected && !guestMode && (
                  <p className="mb-1 font-gabarito text-[11px] text-[var(--tone-cream)] opacity-80 text-center sm:mb-2 sm:text-xs md:text-right">
                    Connect wallet to draft, or practice for free
                  </p>
                )
              )}
              <div className="flex w-full flex-col gap-2.5 sm:gap-3 md:w-auto md:flex-row">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onTryFreeTutorial}
                  className="btn-game btn-game-secondary lobby-setup-main-action w-full px-5 py-3 text-xs shadow-2xl transition-all sm:px-8 sm:py-4 sm:text-base md:w-auto border border-[var(--tone-mint,#cbefc1)]/30 text-[var(--tone-mint,#cbefc1)] bg-[var(--tone-mint,#cbefc1)]/5"
                >
                  Practice for Free
                </motion.button>
                <motion.button
                  whileHover={!actionDisabled ? { y: -2 } : undefined}
                  whileTap={!actionDisabled ? { scale: 0.98 } : undefined}
                  type="button"
                  onClick={() => {
                    if (!actionDisabled) {
                      onPlay();
                    }
                  }}
                  disabled={actionDisabled}
                  className={`btn-game btn-game-primary lobby-setup-main-action w-full px-5 py-3 text-xs shadow-2xl transition-all sm:px-10 sm:py-4 sm:text-base md:w-auto ${
                    actionDisabled ? "cursor-not-allowed opacity-50 grayscale" : ""
                  }`}
                >
                  {actionLabel}
                </motion.button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="lobby-setup-footer mt-3 flex w-full flex-col gap-2 sm:mt-4">
        <div className="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center">
            {mounted && !walletConnected && (
              <button
                type="button"
                onClick={openWalletEntry}
                disabled={walletBusy || connecting}
                className={`btn-game btn-game-primary px-4 py-2.5 text-[11px] shadow-md sm:px-6 sm:py-3 sm:text-xs ${
                  walletBusy || connecting ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {walletBusy || connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onCreateBlinkChallenge}
            disabled={!selectedArena || comingSoonArenaVisible || !mounted || !walletConnected || blinkChallengeBusy}
            className={`btn-game btn-game-secondary shrink-0 px-4 py-2 text-[11px] shadow-md sm:px-5 sm:text-xs ${
              !selectedArena || comingSoonArenaVisible || !mounted || !walletConnected || blinkChallengeBusy ? "opacity-50" : ""
            }`}
          >
            {blinkChallengeBusy ? "Opening Blink..." : hasActiveBlinkChallenge ? "View Active Blink" : "Create Blink Challenge"}
          </button>
        </div>

        {mounted && !walletConnected && (
          <p className="w-full font-gabarito text-xs leading-relaxed text-[var(--tone-cream)] opacity-80">
            {guestMode
              ? "You are in guest practice. Connect a wallet when you are ready for deposits, Blinks, and the full CORA experience."
              : "Connect a wallet to unlock queue and deposit signing."}
          </p>
        )}
      </div>
    </div>
  );
}
