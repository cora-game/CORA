"use client";

import type { ReactNode } from "react";
import type { RoomPhase } from "./roomPhaseTypes";
import { ROOM_PHASE_LABELS } from "./roomPhaseTypes";

type RoomPhaseHeaderProps = {
  phase: RoomPhase;
  title?: ReactNode;
  subtitle?: ReactNode;
  statusSlot?: ReactNode;
  rightPanelSlot?: ReactNode;
  preHeadingSlot?: ReactNode;
  hideTitleBlock?: boolean;
};

export function RoomPhaseHeader({
  phase,
  title,
  subtitle,
  statusSlot,
  rightPanelSlot,
  preHeadingSlot,
  hideTitleBlock,
}: RoomPhaseHeaderProps) {
  const labels = ROOM_PHASE_LABELS[phase];

  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
      {!hideTitleBlock ? (
        <div>
          {preHeadingSlot ? <div className="mb-3">{preHeadingSlot}</div> : null}
        <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[#f8d694]">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-caprasimo text-[2rem] leading-none text-[#fff8ea] drop-shadow-[0_5px_10px_rgba(0,0,0,0.45)] md:text-[2.6rem]">
          {title ?? labels.title}
        </h1>
        <p className="mt-2 max-w-2xl font-gabarito text-[13px] text-[rgba(244,240,230,0.9)]">
          {subtitle ?? labels.subtitle}
        </p>
        </div>
      ) : <div />}

      {(statusSlot || rightPanelSlot) && (
        <div className="flex flex-col items-start gap-2 md:items-end">
          {statusSlot}
          {rightPanelSlot}
        </div>
      )}
    </header>
  );
}
