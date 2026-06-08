"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { writeActiveDepositIntent, writeActiveMatchSession } from "@/lib/session/matchSession";

type BlinkRoomJoinerProps = {
  roomId: string;
  address: string;
  role: "playerA" | "playerB";
  arenaId: string;
  scientistId?: string | null;
  token?: string | null;
  wagerUsd?: string | null;
  creatorConfirmSignature?: string | null;
  depositConfirmSignature?: string | null;
  title?: string;
  subtitle?: string;
  variant?: "fullscreen" | "notification";
  onBack?: () => void;
};

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function isTerminalRoomClose(closeInfo: { code: number; reason: string } | null) {
  if (!closeInfo) return false;
  const reason = closeInfo.reason.toLowerCase();
  return closeInfo.code === 1008 && (reason.includes("not found") || reason.includes("already finished"));
}

export function BlinkRoomJoiner({
  roomId,
  address,
  role,
  arenaId,
  scientistId,
  token,
  wagerUsd,
  creatorConfirmSignature,
  depositConfirmSignature,
  title = "Joining Blink Match",
  subtitle = "Connecting both players to the funded room.",
  variant = "fullscreen",
  onBack,
}: BlinkRoomJoinerProps) {
  const router = useRouter();
  const confirmSentRef = useRef(false);
  const routedRef = useRef(false);
  const { connectionState, gameState, confirmDeposit, reconnect, lastSocketCloseInfo } = useMatchSocket({
    roomId,
    address,
    characterId: scientistId ?? "einstein",
  });
  const terminalRoomClose = isTerminalRoomClose(lastSocketCloseInfo);

  function returnToLobby() {
    writeActiveMatchSession(null);
    onBack?.();
    if (!onBack) router.replace("/lobby");
  }

  useEffect(() => {
    if (terminalRoomClose) return;
    writeActiveMatchSession({
      walletAddress: address,
      address,
      roomId,
      role,
      arenaId,
      scientistId: scientistId ?? null,
      status: gameState?.status ?? "depositing",
      token: token ?? null,
      arenaToken: token ?? null,
      wagerUsd: wagerUsd ?? "1.00",
    });
  }, [address, arenaId, gameState?.status, role, roomId, scientistId, terminalRoomClose, token, wagerUsd]);

  useEffect(() => {
    if (!terminalRoomClose) return;
    writeActiveMatchSession(null);
  }, [terminalRoomClose]);

  useEffect(() => {
    const signature = depositConfirmSignature ?? (role === "playerA" ? creatorConfirmSignature : null);
    if (!signature) return;
    if (connectionState !== "connected") return;
    if (confirmSentRef.current) return;
    confirmSentRef.current = true;
    confirmDeposit(signature);
    writeActiveDepositIntent({ roomId, address, signature });
  }, [address, confirmDeposit, connectionState, creatorConfirmSignature, depositConfirmSignature, role, roomId]);

  useEffect(() => {
    if (routedRef.current) return;
    if (gameState?.status !== "playing") return;
    routedRef.current = true;
    writeActiveMatchSession({
      walletAddress: address,
      address,
      roomId,
      role,
      arenaId,
      scientistId: scientistId ?? null,
      status: "playing",
      token: token ?? null,
      arenaToken: token ?? null,
      wagerUsd: wagerUsd ?? "1.00",
    });
    const params = new URLSearchParams({ roomId, arena: arenaId });
    if (scientistId) params.set("scientist", scientistId);
    router.push(`/play?${params.toString()}`);
  }, [address, arenaId, gameState?.status, role, roomId, router, scientistId, token, wagerUsd]);

  const statusText =
    terminalRoomClose
      ? "This challenge room is no longer available."
      : connectionState === "connected"
      ? role === "playerA"
        ? "Room connected. Confirming creator presence..."
        : "Room connected. Waiting for creator..."
      : connectionState === "reconnecting"
        ? "Reconnecting..."
        : connectionState === "error" || connectionState === "disconnected"
          ? "Connection interrupted."
          : "Opening room socket...";

  if (variant === "notification") {
    return (
      <div className="fixed right-4 top-4 z-[88] w-[calc(100%-2rem)] max-w-md md:right-6 md:top-6">
        <div
          className="frame-cut px-4 py-3 shadow-2xl backdrop-blur-md"
          style={{ border: "2px solid rgba(248,214,148,0.42)", background: "linear-gradient(145deg, #10231b 0%, #18392d 100%)" }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-[var(--tone-cream)]" />
            <div className="min-w-0 flex-1">
              <p className="font-gabarito text-[10px] font-black uppercase tracking-[0.2em] text-[var(--tone-mint)]">
                {title}
              </p>
              <p className="mt-1 font-gabarito text-sm font-bold text-[var(--tone-cream)]">{statusText}</p>
              <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.72)]">{subtitle}</p>
              <p className="mt-2 truncate font-mono text-[11px] text-[rgba(244,240,230,0.58)]">
                Room {roomId} - {shortAddress(address)}
              </p>
              {lastSocketCloseInfo && (
                <p className="mt-1 font-mono text-[10px] text-[rgba(244,240,230,0.5)]">
                  Close code {lastSocketCloseInfo.code}{lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(connectionState === "error" || connectionState === "disconnected") && !terminalRoomClose && (
                  <button type="button" onClick={reconnect} className="btn-game btn-game-primary px-3 py-1.5 text-[10px]">
                    Retry
                  </button>
                )}
                {(onBack || terminalRoomClose) && (
                  <button type="button" onClick={terminalRoomClose ? returnToLobby : onBack} className="btn-game btn-game-secondary px-3 py-1.5 text-[10px]">
                    {terminalRoomClose ? "Back To Lobby" : "View Challenge"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-8 md:px-6">
      <div
        className="game-card w-full p-6 text-center shadow-2xl md:p-8"
        style={{
          border: "1px solid rgba(248,214,148,0.36)",
          background: "linear-gradient(140deg, rgba(12,21,17,0.97) 0%, rgba(18,31,25,0.97) 52%, rgba(28,45,37,0.97) 100%)",
        }}
      >
        {!terminalRoomClose && <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />}
        <p className="mt-4 font-caprasimo text-3xl text-[var(--tone-cream)]">
          {terminalRoomClose ? "Challenge Closed" : title}
        </p>
        <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
          {terminalRoomClose ? "This Blink room expired or was already finished. Return to the lobby to start fresh." : subtitle}
        </p>
        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-[rgba(248,214,148,0.18)] bg-[rgba(248,214,148,0.08)] px-3 py-1">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--tone-cream)]" />
          <span className="font-gabarito text-xs font-black uppercase tracking-[0.18em] text-[rgba(248,214,148,0.88)]">
            {statusText}
          </span>
        </div>
        <p className="mt-4 font-mono text-xs text-[rgba(244,240,230,0.7)]">
          Room {roomId} · {shortAddress(address)}
        </p>
        {lastSocketCloseInfo && (
          <p className="mt-2 font-mono text-xs text-[rgba(244,240,230,0.58)]">
            Close code {lastSocketCloseInfo.code}{lastSocketCloseInfo.reason ? `: ${lastSocketCloseInfo.reason}` : ""}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {(connectionState === "error" || connectionState === "disconnected") && !terminalRoomClose && (
            <button type="button" onClick={reconnect} className="btn-game btn-game-primary px-4 py-2 text-xs">
              Retry Connection
            </button>
          )}
          {(onBack || terminalRoomClose) && (
            <button type="button" onClick={returnToLobby} className="btn-game btn-game-secondary px-4 py-2 text-xs">
              Back To Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
