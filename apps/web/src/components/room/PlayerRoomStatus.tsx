"use client";

import type { ReactNode } from "react";

export type RoomStatusBadge =
  | "connected"
  | "matched"
  | "deposited"
  | "selecting"
  | "locked"
  | "auto_assigned"
  | "ready";

type PlayerRoomStatusProps = {
  label: string;
  subtitle?: string;
  badges: RoomStatusBadge[];
  rightSlot?: ReactNode;
};

const BADGE_STYLES: Record<RoomStatusBadge, { label: string; border: string; text: string; bg: string }> = {
  connected: {
    label: "Connected",
    border: "1px solid rgba(157,180,150,0.35)",
    text: "#e2eddc",
    bg: "rgba(39,65,55,0.65)",
  },
  matched: {
    label: "Matched",
    border: "1px solid rgba(248,214,148,0.32)",
    text: "#f4f0e6",
    bg: "rgba(39,65,55,0.52)",
  },
  deposited: {
    label: "Deposited",
    border: "1px solid rgba(157,180,150,0.38)",
    text: "#dff0d6",
    bg: "rgba(39,93,52,0.55)",
  },
  selecting: {
    label: "Selecting",
    border: "1px solid rgba(248,214,148,0.36)",
    text: "#f8d694",
    bg: "rgba(111,58,40,0.55)",
  },
  locked: {
    label: "Locked",
    border: "1px solid rgba(157,180,150,0.38)",
    text: "#e2eddc",
    bg: "rgba(39,65,55,0.6)",
  },
  auto_assigned: {
    label: "Auto-assigned",
    border: "1px solid rgba(248,214,148,0.36)",
    text: "#f8d694",
    bg: "rgba(111,58,40,0.62)",
  },
  ready: {
    label: "Ready",
    border: "1px solid rgba(157,180,150,0.4)",
    text: "#ddf1d3",
    bg: "rgba(35,86,49,0.62)",
  },
};

export function PlayerRoomStatus({
  label,
  subtitle,
  badges,
  rightSlot,
}: PlayerRoomStatusProps) {
  return (
    <div
      className="frame-cut p-3"
      style={{ border: "1px solid rgba(248,214,148,0.28)", background: "rgba(13,24,20,0.84)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--tone-cream)]/85">
            {label}
          </p>
          {subtitle ? (
            <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.76)]">{subtitle}</p>
          ) : null}
        </div>
        {rightSlot}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {badges.map((badge) => {
          const style = BADGE_STYLES[badge];
          return (
            <span
              key={badge}
              className="frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-wide"
              style={{ border: style.border, color: style.text, background: style.bg }}
            >
              {style.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
