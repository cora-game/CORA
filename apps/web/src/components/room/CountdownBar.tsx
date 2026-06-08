"use client";

type CountdownBarProps = {
  totalMs: number;
  remainingMs: number;
  label?: string;
};

function formatMs(ms: number) {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CountdownBar({
  totalMs,
  remainingMs,
  label = "Selection timer",
}: CountdownBarProps) {
  const safeTotal = Math.max(1, totalMs);
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = Math.min(100, Math.max(0, (safeRemaining / safeTotal) * 100));

  return (
    <div
      className="frame-cut frame-cut-sm w-full min-w-[220px] max-w-[360px] px-3 py-2"
      style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(13,24,20,0.86)" }}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="font-gabarito text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tone-cream)]/85">
          {label}
        </p>
        <p className="font-gabarito text-xs font-bold text-[var(--tone-cream)]">
          {formatMs(safeRemaining)}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(248,214,148,0.18)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ba6931,#d9a85b)] transition-[width] duration-500"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}
