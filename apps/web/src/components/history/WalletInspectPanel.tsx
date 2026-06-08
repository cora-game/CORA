"use client";

import { useEffect, useState } from "react";
import { getWalletArenaPlayability, getWalletHistory } from "@/lib/history/historyApi";
import type { MatchHistoryItem, WalletPlayability } from "@/lib/history/historyTypes";

type WalletInspectPanelProps = {
  open: boolean;
  onClose: () => void;
  address: string;
  arenaId: string;
  token: string;
  title?: string;
};

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function shortSignature(signature: string) {
  if (signature.length <= 14) return signature;
  return `${signature.slice(0, 6)}...${signature.slice(-5)}`;
}

function resultLabel(result?: MatchHistoryItem["result"]) {
  if (result === "win") return "WIN";
  if (result === "loss") return "LOSS";
  if (result === "draw") return "DRAW";
  return "UNKNOWN";
}

function toDateLabel(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
}

export function WalletInspectPanel({
  open,
  onClose,
  address,
  arenaId,
  token,
  title = "Wallet Inspect",
}: WalletInspectPanelProps) {
  const [playability, setPlayability] = useState<WalletPlayability | null>(null);
  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !address) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    Promise.all([
      getWalletArenaPlayability({ address, arenaId, token }),
      getWalletHistory(address),
    ])
      .then(([playabilityResult, historyResult]) => {
        if (cancelled) return;
        setPlayability(playabilityResult);
        setItems(historyResult.slice(0, 6));
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Wallet inspect unavailable.";
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, address, arenaId, token]);

  if (!open) return null;

  const readinessLabel = loading
    ? "Inspecting wallet..."
    : !playability?.reliable
      ? "Unable to inspect"
      : playability.playable
        ? "Arena playable"
        : `Needs ${token}`;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-[rgba(7,12,10,0.76)] p-4 backdrop-blur-sm">
      <div
        className="frame-cut relative w-full max-w-2xl p-4 md:p-5"
        style={{
          border: "1px solid rgba(248,214,148,0.34)",
          background: "linear-gradient(160deg, rgba(12,21,17,0.98), rgba(17,29,24,0.96))",
          boxShadow: "0 20px 35px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#f8d694]">Wallet Inspect</p>
            <h3 className="mt-1 font-caprasimo text-3xl text-[var(--tone-cream)]">{title}</h3>
            <p className="mt-1 font-mono text-xs text-[rgba(244,240,230,0.82)]">{shortAddress(address)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
            style={{
              border: "1px solid rgba(248,214,148,0.3)",
              color: "var(--tone-cream)",
              background: "rgba(17,29,24,0.9)",
            }}
          >
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            className="frame-cut frame-cut-sm p-3"
            style={{ border: "1px solid rgba(248,214,148,0.24)", background: "rgba(16,26,22,0.78)" }}
          >
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-wide text-[#f8d694]">Arena playable</p>
            <p className="mt-1 font-caprasimo text-2xl text-[var(--tone-cream)]">{readinessLabel}</p>
            {playability?.reason && (
              <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">{playability.reason}</p>
            )}
          </div>
          <div
            className="frame-cut frame-cut-sm p-3"
            style={{ border: "1px solid rgba(248,214,148,0.24)", background: "rgba(16,26,22,0.78)" }}
          >
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-wide text-[#f8d694]">Balance check</p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.86)]">
              Token balance: {playability?.tokenBalance ?? "--"}
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.86)]">
              Required balance: {playability?.requiredBalance ?? "--"}
            </p>
            <p className="mt-1 font-gabarito text-[11px] text-[rgba(244,240,230,0.7)]">
              Last checked: {playability?.lastCheckedAt ? toDateLabel(playability.lastCheckedAt) : "--"}
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`wallet-skeleton-${index}`}
                className="frame-cut frame-cut-sm h-14 animate-pulse"
                style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(248,214,148,0.08)" }}
              />
            ))}
            <p className="font-gabarito text-xs text-[rgba(244,240,230,0.82)]">Loading match records...</p>
          </div>
        )}

        {!loading && error && (
          <div
            className="frame-cut frame-cut-sm p-3"
            style={{ border: "1px solid rgba(186,105,49,0.5)", background: "rgba(78,41,25,0.36)" }}
          >
            <p className="font-gabarito text-xs font-semibold uppercase tracking-wide text-[#f8d694]">
              Match history unavailable. Try again later.
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.84)]">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div
            className="frame-cut frame-cut-sm p-3"
            style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(16,26,22,0.72)" }}
          >
            <p className="font-gabarito text-sm text-[rgba(244,240,230,0.86)]">No CORA matches found yet.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="max-h-[34vh] space-y-2 overflow-auto pr-1">
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[rgba(244,240,230,0.78)]">
              Recent matches
            </p>
            {items.map((item) => (
              <div
                key={item.id}
                className="frame-cut frame-cut-sm p-3"
                style={{
                  border: "1px solid rgba(248,214,148,0.25)",
                  background: "linear-gradient(150deg, rgba(255,244,221,0.94), rgba(241,223,193,0.94))",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[rgba(39,65,55,0.24)] bg-[rgba(237,244,235,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-black uppercase tracking-[0.1em] text-[#274137]">
                      {resultLabel(item.result)}
                    </span>
                    <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#6f3a28]">
                      {item.token} Arena
                    </p>
                  </div>
                  <p className="font-gabarito text-[11px] text-[#5e7768]">{toDateLabel(item.timestamp)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-gabarito text-[11px] font-semibold uppercase tracking-[0.08em] text-[#274137]">
                    {item.opponent ? `vs ${shortSignature(item.opponent)}` : "vs Unknown"}
                  </p>
                  {item.wagerUsd && (
                    <span className="rounded-full border border-[rgba(111,58,40,0.24)] bg-[rgba(255,248,236,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#6f3a28]">
                      ${item.wagerUsd}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#274137]">Sig {shortSignature(item.signature)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
