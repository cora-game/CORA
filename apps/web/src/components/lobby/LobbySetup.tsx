"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
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
  const color = active ? "#4d2a18" : "var(--tone-bark)";
  if (token === "SOL") {
    const solColor = active ? "#214335" : "#4f6f5b";
    return (
      <svg width="20" height="20" viewBox="0 0 35 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: solColor }}>
        <path d="M6.3 0L0 6.3h28.7l6.3-6.3H6.3zm28.7 11.8L28.7 18.2H0l6.3-6.4h28.7zm-28.7 12L0 30h28.7l6.3-6.3H6.3z" fill="currentColor" />
      </svg>
    );
  }
  if (token === "MEW") {
    const mewColor = active ? "#1f3c3f" : "#3C5C5F";
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: mewColor }}>
        <path
          d="M6.5 9 4.8 5.2a.6.6 0 0 1 .94-.7L9 7.2c.9-.4 1.95-.7 3-.7 1.08 0 2.12.26 3.03.72l3.24-2.73a.6.6 0 0 1 .94.7L17.5 9c1.55 1.44 2.5 3.47 2.5 5.74C20 19.31 16.42 22 12 22s-8-2.69-8-7.26C4 12.47 4.95 10.44 6.5 9Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
      <path d="M12 8.5c-1.5 0-2.8-1.5-3-3.2C8.8 3.5 10.2 2 12 2s3.2 1.5 3 3.3c-.2 1.7-1.5 3.2-3 3.2zM6.5 11.5c-1.2 0-2.4-1.2-2.5-2.8C3.8 7 5 6 6.5 6s2.5 1 2.5 2.7c-.1 1.6-1.3 2.8-2.5 2.8zM17.5 11.5c-1.2 0-2.4-1.2-2.5-2.8C14.8 7 16 6 17.5 6s2.5 1 2.5 2.7c-.1 1.6-1.3 2.8-2.5 2.8zM12 11c2.5 0 4.5 2 5.5 4.5.2.5.5 1 .5 1.5C18 19 15.5 22 12 22s-6-3-6-5c0-.5.3-1 .5-1.5C7.5 13 9.5 11 12 11z" fill="currentColor" />
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
  const { wallet: selectedWallet, connect, connecting } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [walletBusy, setWalletBusy] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const ARENA_ASSET_VERSION = "2026-05-12-arena-refresh-1";
  const COMING_SOON_ARENA_ID = "mew";
  const COMING_SOON_ARENA_IDS = new Set(["bonk", COMING_SOON_ARENA_ID]);
  const NULL_ARENA_IMAGE_URL = `/assets/arena/null.png?v=${ARENA_ASSET_VERSION}`;
  const SOL_ARENA_IMAGE_URL = `/assets/arena/sol.png?v=${ARENA_ASSET_VERSION}`;
  const BONK_ARENA_IMAGE_URL = `/assets/arena/bonk.png?v=${ARENA_ASSET_VERSION}`;
  const MEW_ARENA_IMAGE_URL = `/assets/arena/mew.png?v=${ARENA_ASSET_VERSION}`;
  const selectedArena = arenas.find((arena) => arena.id === selectedArenaId) ?? null;
  const mewArena = {
    id: COMING_SOON_ARENA_ID,
    token: "MEW",
    label: "MEW Arena",
    accent: "#b6afa1",
    frame: "#3C5C5F",
    previewBg:
      "radial-gradient(circle at 22% 24%, rgba(218,212,203,0.42), transparent 48%), radial-gradient(circle at 75% 78%, rgba(149,141,128,0.24), transparent 44%), linear-gradient(150deg, #f3efe7 0%, #ddd6ca 58%, #cbc3b7 100%)",
  } satisfies Arena;
  const selectedArenaDisplay = selectedArena ?? (selectedArenaId === COMING_SOON_ARENA_ID ? mewArena : null);
  const comingSoonArenaVisible = selectedArenaId !== null && COMING_SOON_ARENA_IDS.has(selectedArenaId);
  const actionDisabled = !mounted || comingSoonArenaVisible || !walletConnected || !canPlay;
  const actionLabel = comingSoonArenaVisible ? "Coming Soon" : "Pick Scientist";
  const guestAddressLabel = guestAddress ? `Guest ${truncateWallet(guestAddress)}` : "Guest";
  const identityLabel = !mounted
    ? "Wallet not connected"
    : guestMode
      ? guestAddressLabel
      : walletConnected
        ? truncateWallet(walletAddress)
        : "Wallet not connected";
  let arenaImageUrl = NULL_ARENA_IMAGE_URL;
  if (selectedArenaDisplay?.token === "SOL") {
    arenaImageUrl = SOL_ARENA_IMAGE_URL;
  } else if (selectedArenaDisplay?.token === "BONK") {
    arenaImageUrl = BONK_ARENA_IMAGE_URL;
  } else if (selectedArenaDisplay?.token === "MEW") {
    arenaImageUrl = MEW_ARENA_IMAGE_URL;
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
    token: selectedArena?.token ?? "SOL",
    enabled: playabilityEnabled,
  });

  async function openWalletEntry() {
    if (walletBusy || connecting) return;

    if (!selectedWallet) {
      setWalletModalVisible(true);
      return;
    }

    setWalletBusy(true);
    try {
      await connect();
    } catch {
      // Wallet cancellation should keep the player in the lobby without breaking setup.
    } finally {
      setWalletBusy(false);
    }
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
    const preloads = [NULL_ARENA_IMAGE_URL, SOL_ARENA_IMAGE_URL, BONK_ARENA_IMAGE_URL, MEW_ARENA_IMAGE_URL];
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
  }, [BONK_ARENA_IMAGE_URL, MEW_ARENA_IMAGE_URL, NULL_ARENA_IMAGE_URL, SOL_ARENA_IMAGE_URL]);

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
              const flavor = arena.token === "SOL" ? "The Classic Arena" : "Meme Battleground";
              const checkStyle =
                arena.token === "BONK"
                  ? {
                      border: "1px solid rgba(111,58,40,0.48)",
                      background: "#f8d694",
                      color: "#6f3a28",
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
                      ? arena.token === "SOL"
                        ? "linear-gradient(180deg, #eef6ec 0%, #d2e2cd 100%)"
                        : "linear-gradient(180deg, #fff1cf 0%, #f8d694 100%)"
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
              onClick={() => onSelectArena(COMING_SOON_ARENA_ID)}
              className={`frame-cut lobby-setup-arena-option relative w-full px-3 py-2.5 text-left transition-all duration-200 sm:px-4 sm:py-3 ${
                selectedArenaId === COMING_SOON_ARENA_ID ? "-translate-y-1 shadow-lg" : "opacity-85 hover:-translate-y-0.5"
              }`}
              style={{
                border: `2.5px solid ${
                  selectedArenaId === COMING_SOON_ARENA_ID ? "#85A1A5" : "rgba(111,58,40,0.28)"
                }`,
                background:
                  selectedArenaId === COMING_SOON_ARENA_ID
                    ? "linear-gradient(180deg, #c8d8da 0%, #9db8bc 45%, #85A1A5 100%)"
                    : "linear-gradient(180deg, #fffaf0 0%, #efe3c8 100%)",
                boxShadow:
                  selectedArenaId === COMING_SOON_ARENA_ID
                    ? "0 8px 0 rgba(60,92,95,0.24), 0 14px 24px rgba(60,92,95,0.22)"
                    : "0 5px 0 rgba(111,58,40,0.14), 0 10px 20px rgba(111,58,40,0.08)",
              }}
            >
              <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:justify-start sm:gap-2.5">
                <div
                  className="lobby-setup-arena-token-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-inner sm:h-10 sm:w-10"
                  style={{
                    background:
                      selectedArenaId === COMING_SOON_ARENA_ID
                        ? "linear-gradient(180deg, #c8d8da 0%, #9db8bc 45%, #85A1A5 100%)"
                        : mewArena.previewBg,
                    border: `1.5px solid ${selectedArenaId === COMING_SOON_ARENA_ID ? "#3C5C5F" : mewArena.accent}`,
                  }}
                >
                  <ArenaIcon token="MEW" active={selectedArenaId === COMING_SOON_ARENA_ID} />
                </div>
                <div className="text-center sm:text-left">
                  <p
                    className="font-gabarito text-sm font-bold tracking-wide sm:text-base"
                    style={{ color: selectedArenaId === COMING_SOON_ARENA_ID ? "#173235" : "var(--tone-bark)" }}
                  >
                    MEW
                  </p>
                  <p
                    className="font-gabarito text-[9px] uppercase tracking-wide sm:text-[10px]"
                    style={{ color: selectedArenaId === COMING_SOON_ARENA_ID ? "rgba(23,50,53,0.76)" : "var(--warm-text)" }}
                  >
                    Meme Battleground
                  </p>
                </div>
              </div>
              {selectedArenaId === COMING_SOON_ARENA_ID && (
                <div
                  className="lobby-setup-arena-check"
                  style={{ border: "1px solid rgba(60,92,95,0.45)", background: "rgba(248,250,248,0.75)", color: "#173235" }}
                >
                  {"\u2713"}
                </div>
              )}
            </button>
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
                {walletBusy || connecting ? "Connecting..." : selectedWallet ? "Connect Wallet" : "Select Wallet"}
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
