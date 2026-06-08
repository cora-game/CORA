"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Arena, Scientist } from "./LobbyScreen";

type MatchmakingWaitingProps = {
  scientist: Scientist;
  opponentScientist?: Scientist | null;
  opponentWalletAddress?: string;
  arena: Arena;
  wagerUsd: string;
  walletAddress: string;
  isGuest?: boolean;
  state: "searching" | "timeout" | "error";
  stage: "finding" | "verifying" | "preparing";
  errorMessage?: string | null;
  /** 1-based position in the queue (from WS queue) */
  queuePosition?: number | null;
  /** Total players in queue (from WS queue) */
  queueDepth?: number | null;
  onRetry: () => void;
  onCancel: () => void;
};

const SEGMENTS = ["Finding Opponent", "Verifying Wallet", "Preparing Arena"] as const;

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function MatchmakingWaiting({
  scientist,
  opponentScientist,
  opponentWalletAddress,
  arena,
  wagerUsd,
  walletAddress,
  isGuest = false,
  state,
  stage,
  errorMessage,
  queuePosition,
  queueDepth,
  onRetry,
  onCancel,
}: MatchmakingWaitingProps) {
  const [activeLoopProgress, setActiveLoopProgress] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (state !== "searching") return;
    let rafId = 0;
    const startedAt = performance.now();
    const durationByStage: Record<"finding" | "verifying" | "preparing", number> = {
      finding: 2600,
      verifying: 2400,
      preparing: 2200,
    };

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const duration = durationByStage[stage];
      const loop = ((elapsed % duration) / duration) * 0.92 + 0.08;
      setActiveLoopProgress(loop);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [state, stage]);

  const isSearching = state === "searching";
  const stageIndex = stage === "finding" ? 0 : stage === "verifying" ? 1 : 2;
  const title =
    state === "timeout"
      ? "No opponent yet"
      : state === "error"
        ? "Matchmaking failed"
        : stage === "finding"
          ? "Finding your opponent"
          : stage === "verifying"
            ? "Verifying wallet"
            : "Preparing arena";
  const subtitle =
    state === "timeout"
      ? "Queue timed out. You can retry or go back."
      : state === "error"
        ? errorMessage ?? "Unable to reach matchmaking service."
        : queuePosition && queueDepth && stage === "finding"
          ? `Position ${queuePosition} of ${queueDepth} in queue`
          : null;
  const isFailureState = state === "timeout" || state === "error";
  const matchedOpponent = opponentScientist ?? null;
  const walletLabel = isGuest ? `Guest ${shortWallet(walletAddress)}` : shortWallet(walletAddress);
  const progressLabel = isSearching
    ? SEGMENTS[stageIndex]
    : state === "timeout"
      ? "Search timed out"
      : "Search failed";

  return (
    <div className="matchmaking-waiting-screen mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col items-center justify-center px-4 py-5 md:px-6 md:py-6">
      <div className="mb-3 flex w-full justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="btn-game btn-game-secondary px-4 py-2 text-[11px] shadow-sm"
        >
          Cancel
        </button>
      </div>

      <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--tone-cream)]/90">
        {arena.label} - ${wagerUsd} {arena.token}
      </p>
      <h1
        className="mt-2 text-center font-caprasimo text-4xl drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] md:text-5xl"
        style={{ color: isFailureState ? "#f8d694" : "var(--tone-cream)" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-2xl text-center font-gabarito text-sm text-[rgba(244,240,230,0.9)]">{subtitle}</p>
      )}

      <div className="matchmaking-duel-grid mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div
          className="matchmaking-player-card relative overflow-hidden rounded-2xl p-5 shadow-xl"
          style={{
            border: "2px solid rgba(111,58,40,0.62)",
            background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,214,148,0.2),transparent_52%)]" />
          <div className="matchmaking-card-content relative flex items-center gap-4">
            <div
              className="matchmaking-avatar relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{
                border: "2px solid rgba(111,58,40,0.6)",
                background: scientist.portraitBg,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              }}
            >
              {!failedImages[scientist.id] ? (
                <Image
                  src={`/assets/characters/${scientist.id.trim().toLowerCase()}/exp/idle.png`}
                  alt={`${scientist.name} portrait`}
                  fill
                  className="object-cover object-center"
                  onError={() => setFailedImages((prev) => ({ ...prev, [scientist.id]: true }))}
                />
              ) : (
                <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                  {scientist.initial}
                </span>
              )}
            </div>

            <div className="matchmaking-card-meta min-w-0">
              <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                You
              </span>
              <p className="matchmaking-name mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">{scientist.name}</p>
              <p className="matchmaking-detail mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">{scientist.base}</p>
              <p className="matchmaking-wallet mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">{walletLabel}</p>
            </div>
          </div>
        </div>

        <div className="matchmaking-vs-wrap grid place-items-center px-6">
          <div className="matchmaking-vs animate-orb-breath font-caprasimo text-6xl leading-none text-[var(--tone-cream)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" style={{ textShadow: "0 0 20px rgba(248,214,148,0.28)" }}>
            VS
          </div>
        </div>

        {matchedOpponent ? (
          <div
            className="matchmaking-player-card relative overflow-hidden rounded-2xl p-5 shadow-xl"
            style={{
              border: "2px solid rgba(111,58,40,0.62)",
              background: "linear-gradient(145deg, #fff4dd 0%, #f1dfc1 100%)",
              boxShadow: "0 14px 30px rgba(0,0,0,0.34)",
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(157,180,150,0.17),transparent_50%)]" />
            <div className="matchmaking-card-content relative flex items-center gap-4">
              <div
                className="matchmaking-avatar relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
                style={{
                  border: "2px solid rgba(111,58,40,0.6)",
                  background: matchedOpponent.portraitBg,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
                }}
              >
                {!failedImages[matchedOpponent.id] ? (
                  <Image
                    src={`/assets/characters/${matchedOpponent.id.trim().toLowerCase()}/exp/idle.png`}
                    alt={`${matchedOpponent.name} portrait`}
                    fill
                    className="object-cover object-center"
                    onError={() => setFailedImages((prev) => ({ ...prev, [matchedOpponent.id]: true }))}
                  />
                ) : (
                  <span className="font-caprasimo text-4xl text-[rgba(255,244,221,0.88)] drop-shadow-sm">
                    {matchedOpponent.initial}
                  </span>
                )}
              </div>
              <div className="matchmaking-card-meta min-w-0">
                <span className="inline-flex rounded-full border border-[rgba(111,58,40,0.38)] bg-[rgba(255,248,236,0.9)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tone-bark)]">
                  Opponent
                </span>
                <p className="matchmaking-name mt-2 truncate font-caprasimo text-2xl text-[var(--tone-bark)]">{matchedOpponent.name}</p>
                <p className="matchmaking-detail mt-0.5 truncate font-gabarito text-sm text-[rgba(58,37,24,0.85)]">{matchedOpponent.base}</p>
                {opponentWalletAddress ? (
                  <p className="matchmaking-wallet mt-2 font-mono text-xs font-semibold text-[var(--tone-forest)]">{shortWallet(opponentWalletAddress)}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="matchmaking-unknown-card relative grid min-h-[156px] place-items-center overflow-hidden rounded-2xl p-5 shadow-xl"
            style={{
              border: "2px dashed rgba(248,214,148,0.5)",
              background: "linear-gradient(145deg, rgba(15,35,27,0.96), rgba(8,18,14,0.96))",
              boxShadow: "0 14px 30px rgba(0,0,0,0.38)",
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(157,180,150,0.15),transparent_50%)]" />
            <div className="matchmaking-unknown-content relative text-center">
              <span className="matchmaking-unknown-label font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--tone-clay)] opacity-90">Scanning</span>
              <div className="matchmaking-unknown-avatar">
                <span>?</span>
              </div>
              <p className="matchmaking-unknown-wallet mt-2 font-mono text-xs font-semibold text-[var(--tone-cream)]">Searching...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 w-full">
        <p className="mb-2 text-center font-gabarito text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tone-cream)] opacity-85">
          {progressLabel}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SEGMENTS.map((segment, idx) => {
            const ratio =
              !isSearching
                ? 0
                : idx < stageIndex
                  ? 1
                  : idx === stageIndex
                    ? activeLoopProgress
                    : 0;
            return (
              <div key={segment}>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(248,214,148,0.14)] shadow-inner">
                  <div
                    className={`h-full rounded-full ${ratio > 0 ? "shimmer-bar" : ""}`}
                    style={{ width: `${ratio * 100}%`, backgroundColor: arena.accent }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isSearching && (
        <div className="mt-6 flex h-10 items-center justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="btn-game btn-game-primary px-6 py-2 text-sm shadow-md"
          >
            Keep Searching
          </button>
        </div>
      )}
    </div>
  );
}

