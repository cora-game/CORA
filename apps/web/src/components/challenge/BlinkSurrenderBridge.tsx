"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { writeActiveDepositIntent, writeActiveMatchSession } from "@/lib/session/matchSession";

type BlinkSurrenderBridgeProps = {
  roomId: string;
  address: string;
  characterId?: string | null;
  confirmSignature?: string | null;
  onSettled: (message?: string) => void;
  onError: (message: string) => void;
};

export function BlinkSurrenderBridge({
  roomId,
  address,
  characterId,
  confirmSignature,
  onSettled,
  onError,
}: BlinkSurrenderBridgeProps) {
  const confirmSentRef = useRef(false);
  const surrenderSentRef = useRef(false);
  const settledRef = useRef(false);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { connectionState, confirmDeposit, surrender, lastRoomCancelled, lastSocketCloseInfo } = useMatchSocket({
    roomId,
    address,
    characterId: characterId ?? "einstein",
  });

  const clearTimers = useCallback(() => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    sendTimerRef.current = null;
    settleTimerRef.current = null;
    connectTimerRef.current = null;
  }, []);

  const settle = useCallback((message?: string) => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearTimers();
    writeActiveMatchSession(null);
    onSettled(message);
  }, [clearTimers, onSettled]);

  useEffect(() => {
    connectTimerRef.current = setTimeout(() => {
      if (surrenderSentRef.current || settledRef.current) return;
      settledRef.current = true;
      clearTimers();
      onError("Could not connect to the Blink room to surrender. Try again in a moment.");
    }, 10_000);

    return clearTimers;
  }, [clearTimers, onError]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (surrenderSentRef.current) return;

    if (confirmSignature && !confirmSentRef.current) {
      confirmSentRef.current = true;
      confirmDeposit(confirmSignature);
      writeActiveDepositIntent({ roomId, address, signature: confirmSignature });
    }

    surrenderSentRef.current = true;
    sendTimerRef.current = setTimeout(() => {
      surrender();
      settleTimerRef.current = setTimeout(() => {
        settle("Blink challenge surrendered.");
      }, 1_800);
    }, confirmSignature ? 150 : 0);
  }, [address, confirmDeposit, confirmSignature, connectionState, roomId, settle, surrender]);

  useEffect(() => {
    if (!surrenderSentRef.current) return;
    if (lastRoomCancelled) {
      settle("Blink challenge surrendered.");
    }
  }, [lastRoomCancelled, settle]);

  useEffect(() => {
    if (!surrenderSentRef.current) return;
    if (!lastSocketCloseInfo) return;
    if (lastSocketCloseInfo.code === 1008) {
      settle("Blink challenge closed.");
    }
  }, [lastSocketCloseInfo, settle]);

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
      <div
        className="frame-cut w-full max-w-md p-5 text-center shadow-2xl md:p-6"
        style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
      >
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[rgba(248,214,148,0.24)] border-t-[var(--tone-cream)]" />
        <p className="mt-4 font-caprasimo text-2xl text-[var(--tone-cream)]">Surrendering Blink match...</p>
        <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.78)]">
          Connecting to the room and submitting surrender with your locked wager state.
        </p>
      </div>
    </div>
  );
}
