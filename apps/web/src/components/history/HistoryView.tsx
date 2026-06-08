"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { getArenaHistory, getWalletHistory } from "@/lib/history/historyApi";
import type { MatchHistoryItem } from "@/lib/history/historyTypes";

type HistoryScope = "arena" | "wallet";

function shortValue(input: string) {
  if (input.length <= 14) return input;
  return `${input.slice(0, 6)}...${input.slice(-5)}`;
}

function toDisplayDate(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "Unknown time";
  return value.toLocaleString();
}

function normalizeScope(raw: string | null): HistoryScope {
  if (raw === "arena" || raw === "wallet") return raw;
  return "wallet";
}

function resultLabel(result?: MatchHistoryItem["result"]) {
  if (result === "win") return "WIN";
  if (result === "loss") return "LOSS";
  if (result === "draw") return "DRAW";
  return "UNKNOWN";
}

function settlementLabel(status?: MatchHistoryItem["settlementStatus"]) {
  if (status === "settled") return "SETTLED";
  if (status === "pending") return "PENDING";
  if (status === "failed") return "FAILED";
  return "UNKNOWN";
}

function resultBadgeStyle(result?: MatchHistoryItem["result"]) {
  if (result === "win") {
    return {
      border: "1px solid rgba(39,65,55,0.28)",
      background: "rgba(237,244,235,0.95)",
      color: "#274137",
    };
  }
  if (result === "loss") {
    return {
      border: "1px solid rgba(111,58,40,0.28)",
      background: "rgba(246,233,226,0.95)",
      color: "#6f3a28",
    };
  }
  return {
    border: "1px solid rgba(88,92,86,0.28)",
    background: "rgba(244,240,230,0.92)",
    color: "#5e5b53",
  };
}

export function HistoryView() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const connectedAddress = publicKey?.toBase58() ?? "";

  const requestedScope = normalizeScope(searchParams.get("scope"));
  const arenaId = (searchParams.get("arena") ?? "sol").trim().toLowerCase();
  const token = (searchParams.get("token") ?? "SOL").trim().toUpperCase();
  const requestedAddress = (searchParams.get("address") ?? "").trim();
  const scope: HistoryScope =
    requestedScope === "wallet" && (requestedAddress || connectedAddress) ? "wallet" : "arena";
  const walletAddress = requestedAddress || connectedAddress;

  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageTitle = scope === "wallet" ? "Wallet History" : "Arena History";
  const pageEyebrow = scope === "wallet" ? "Match Records" : "Arena Records";
  const subtitle =
    scope === "wallet"
      ? walletAddress
        ? `Showing matches tied to ${shortValue(walletAddress)}.`
        : "Connect wallet or pass address in query string."
      : `Showing recent matches for ${token} arena.`;
  const settledCount = items.filter((item) => item.settlementStatus === "settled").length;
  const viewKey = `${scope}:${arenaId}:${token}:${walletAddress || "none"}`;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    const task =
      scope === "wallet"
        ? walletAddress
          ? getWalletHistory(walletAddress)
          : Promise.resolve<MatchHistoryItem[]>([])
        : getArenaHistory(arenaId);

    task
      .then((result) => {
        if (cancelled) return;
        setItems(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load history right now.";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope, walletAddress, arenaId]);

  const switchHref = useMemo(() => {
    if (scope === "wallet") {
      return `/history?scope=arena&arena=${encodeURIComponent(arenaId)}&token=${encodeURIComponent(token)}`;
    }
    const params = new URLSearchParams({
      scope: "wallet",
      arena: arenaId,
      token,
    });
    if (walletAddress) {
      params.set("address", walletAddress);
    }
    return `/history?${params.toString()}`;
  }, [scope, arenaId, token, walletAddress]);

  return (
    <main
      className="min-h-[100svh] px-4 py-6 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <motion.div
          className="mb-4 flex flex-wrap items-center justify-between gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[rgba(244,240,230,0.75)]">
              {pageEyebrow}
            </p>
            <h1 className="mt-1 font-caprasimo text-4xl text-[var(--tone-cream)]">{pageTitle}</h1>
            <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={switchHref}
              className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              {scope === "wallet" ? "View Arena" : "View Wallet"}
            </Link>
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
            >
              Back To Lobby
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mb-4 flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        >
          <motion.span
            className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ borderColor: "rgba(248,214,148,0.32)", background: "rgba(16,26,22,0.72)", color: "#f4f0e6" }}
            whileHover={{ y: -1 }}
          >
            {items.length} matches
          </motion.span>
          <motion.span
            className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ borderColor: "rgba(248,214,148,0.3)", background: "rgba(16,26,22,0.72)", color: "#d8ead4" }}
            whileHover={{ y: -1 }}
          >
            {settledCount} settled
          </motion.span>
          <motion.span
            className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ borderColor: "rgba(248,214,148,0.3)", background: "rgba(16,26,22,0.72)", color: "#f4f0e6" }}
            whileHover={{ y: -1 }}
          >
            {token} arena
          </motion.span>
          <motion.span
            className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ borderColor: "rgba(248,214,148,0.3)", background: "rgba(16,26,22,0.72)", color: "#f4f0e6" }}
            whileHover={{ y: -1 }}
          >
            {scope === "wallet" ? shortValue(walletAddress || "Wallet") : `${Math.min(items.length, 5)} recent`}
          </motion.span>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key={`${viewKey}:loading`}
              className="space-y-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`history-row-${index}`}
                  className="frame-cut frame-cut-sm h-16 animate-pulse"
                  style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(248,214,148,0.08)" }}
                />
              ))}
              <p className="font-gabarito text-xs text-[rgba(244,240,230,0.82)]">Loading match records...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key={`${viewKey}:error`}
              className="frame-cut frame-cut-sm p-4"
              style={{ border: "1px solid rgba(186,105,49,0.5)", background: "rgba(78,41,25,0.36)" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#f8d694]">
                Match history unavailable. Try again later.
              </p>
              <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.84)]">{error}</p>
            </motion.div>
          ) : items.length === 0 ? (
            <motion.div
              key={`${viewKey}:empty`}
              className="frame-cut frame-cut-sm p-4"
              style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(16,26,22,0.72)" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-gabarito text-sm text-[rgba(244,240,230,0.86)]">No CORA matches found yet.</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${viewKey}:items`}
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {items.map((item, index) => (
                <motion.article
                  key={item.id}
                  className="frame-cut frame-cut-sm p-3"
                  style={{
                    border: "1px solid rgba(248,214,148,0.25)",
                    background: "linear-gradient(150deg, rgba(255,244,221,0.94), rgba(241,223,193,0.94))",
                  }}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.26,
                    delay: index * 0.035,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 font-gabarito text-[10px] font-black uppercase tracking-[0.12em]"
                        style={resultBadgeStyle(item.result)}
                      >
                        {resultLabel(item.result)}
                      </span>
                      <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#6f3a28]">
                        {item.token} Arena
                      </p>
                    </div>
                    <p className="font-gabarito text-[11px] text-[#5e7768]">{toDisplayDate(item.timestamp)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-gabarito text-[11px] font-semibold uppercase tracking-[0.08em] text-[#274137]">
                      {item.opponent ? `vs ${shortValue(item.opponent)}` : "vs Unknown"}
                    </p>
                    {item.wagerUsd && (
                      <span className="rounded-full border border-[rgba(111,58,40,0.24)] bg-[rgba(255,248,236,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#6f3a28]">
                        ${item.wagerUsd}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-[rgba(39,65,55,0.24)] bg-[rgba(237,244,235,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]">
                      {settlementLabel(item.settlementStatus)}
                    </span>
                    <p className="font-mono text-[11px] text-[#274137]">Sig {shortValue(item.signature)}</p>
                  </div>
                  {item.explorerUrl && (
                    <a
                      href={item.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex font-gabarito text-[11px] font-bold uppercase tracking-wide text-[#274137] underline underline-offset-2"
                    >
                      Open Explorer
                    </a>
                  )}
                </motion.article>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
