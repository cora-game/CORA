"use client";

import type { MatchHistoryItem } from "@/lib/history/historyTypes";

type HistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: MatchHistoryItem[];
  loading?: boolean;
  error?: string | null;
};

function shortSignature(signature: string) {
  if (signature.length <= 14) return signature;
  return `${signature.slice(0, 6)}...${signature.slice(-5)}`;
}

function toDisplayDate(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "Unknown time";
  return value.toLocaleString();
}

function resultLabel(item: MatchHistoryItem) {
  if (item.result === "win") return "WIN";
  if (item.result === "loss") return "LOSS";
  if (item.result === "draw") return "DRAW";
  return "UNKNOWN";
}

function settlementLabel(item: MatchHistoryItem) {
  if (item.settlementStatus === "settled") return "SETTLED";
  if (item.settlementStatus === "pending") return "PENDING";
  if (item.settlementStatus === "failed") return "FAILED";
  return "UNKNOWN";
}

function resultBadgeStyle(result: MatchHistoryItem["result"]) {
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

export function HistoryDrawer({
  open,
  onClose,
  title = "Match History",
  items,
  loading = false,
  error = null,
}: HistoryDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(7,12,10,0.76)] p-4 backdrop-blur-sm">
      <div
        className="frame-cut relative w-full max-w-3xl p-4 md:p-5"
        style={{
          border: "1px solid rgba(248,214,148,0.34)",
          background:
            "radial-gradient(circle at 15% 10%, rgba(248,214,148,0.12), transparent 42%), linear-gradient(160deg, rgba(12,21,17,0.98), rgba(17,29,24,0.96))",
          boxShadow: "0 20px 35px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#f8d694]">History</p>
            <h3 className="mt-1 font-caprasimo text-3xl text-[var(--tone-cream)]">{title}</h3>
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

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`history-skeleton-${index}`}
                className="frame-cut frame-cut-sm h-16 animate-pulse"
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
              History unavailable. Try again later.
            </p>
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.84)]">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div
            className="frame-cut frame-cut-sm p-4"
            style={{ border: "1px solid rgba(248,214,148,0.2)", background: "rgba(16,26,22,0.72)" }}
          >
            <p className="font-gabarito text-sm text-[rgba(244,240,230,0.86)]">No CORA matches found yet.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
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
                    <span
                      className="rounded-full px-2.5 py-0.5 font-gabarito text-[10px] font-black uppercase tracking-[0.12em]"
                      style={resultBadgeStyle(item.result)}
                    >
                      {resultLabel(item)}
                    </span>
                    <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#6f3a28]">
                      {item.token} Arena
                    </p>
                  </div>
                  <p className="font-gabarito text-[11px] text-[#5e7768]">{toDisplayDate(item.timestamp)}</p>
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
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-[rgba(39,65,55,0.24)] bg-[rgba(237,244,235,0.95)] px-2 py-0.5 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]">
                    {settlementLabel(item)}
                  </span>
                  <p className="font-mono text-[11px] text-[#274137]">Sig {shortSignature(item.signature)}</p>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

