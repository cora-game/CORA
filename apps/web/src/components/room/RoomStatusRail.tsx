"use client";

import type { ReactNode } from "react";
import { PlayerRoomStatus, type RoomStatusBadge } from "./PlayerRoomStatus";

type RoomStatusRow = {
  id: string;
  label: string;
  subtitle?: string;
  badges: RoomStatusBadge[];
  rightSlot?: ReactNode;
};

type RoomStatusRailProps = {
  title?: string;
  rows: RoomStatusRow[];
};

export function RoomStatusRail({
  title = "Room Status",
  rows,
}: RoomStatusRailProps) {
  return (
    <aside className="w-full">
      <p className="mb-2 font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--tone-cream)]/75">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <PlayerRoomStatus
            key={row.id}
            label={row.label}
            subtitle={row.subtitle}
            badges={row.badges}
            rightSlot={row.rightSlot}
          />
        ))}
      </div>
    </aside>
  );
}
