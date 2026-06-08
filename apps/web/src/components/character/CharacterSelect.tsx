"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CharacterCard } from "./CharacterCard";
import type {
  CharacterOption,
  CharacterSelectionState,
  CharacterSelectMode,
  OpponentCharacterStatus,
} from "./characterTypes";
import { CountdownBar } from "@/components/room/CountdownBar";
import { RoomStatusRail } from "@/components/room/RoomStatusRail";
import type { RoomStatusBadge } from "@/components/room/PlayerRoomStatus";

export type CharacterSelectProps = {
  mode?: CharacterSelectMode;
  characters: CharacterOption[];
  selectedCharacterId?: string;
  showHeading?: boolean;
  showLabels?: boolean;
  selectionState?: CharacterSelectionState;
  autoAssignedCharacterId?: string;
  neutralDefaultCharacterId?: string;
  locked?: boolean;
  disabled?: boolean;
  deadlineMs?: number;
  opponentStatus?: OpponentCharacterStatus;
  autoAssignLabel?: string;
  countdownSlot?: ReactNode;
  opponentStatusSlot?: ReactNode;
  roomStatusSlot?: ReactNode;
  showDevModeToggle?: boolean;
  compactCards?: boolean;
  onSelect: (characterId: string) => void;
};

function renderOpponentStatus(status: OpponentCharacterStatus, autoAssignLabel: string) {
  switch (status) {
    case "hidden":
      return "Opponent choice hidden";
    case "waiting":
      return "Waiting for opponent selection";
    case "picked":
      return "Opponent has selected";
    case "locked":
      return "Opponent selection locked";
    case "auto_assigned":
      return autoAssignLabel;
    default:
      return "Waiting for opponent selection";
  }
}

function getSelectionStateLine(selectionState: CharacterSelectionState) {
  switch (selectionState) {
    case "selected":
      return "Character selected. Lock will happen when phase advances.";
    case "locked":
      return "Character locked. Waiting for opponent lock.";
    case "auto_assigned":
      return "Auto-assigned balanced default because timer expired.";
    case "expired":
      return "Selection closed. Entering ready state.";
    default:
      return "Choose your character.";
  }
}

function getOpponentBadges(status?: OpponentCharacterStatus): RoomStatusBadge[] {
  if (!status || status === "hidden") return ["connected", "matched"];
  if (status === "waiting") return ["connected", "matched", "selecting"];
  if (status === "picked") return ["connected", "matched", "selecting"];
  if (status === "locked") return ["connected", "matched", "locked", "ready"];
  return ["connected", "matched", "auto_assigned", "ready"];
}

export function CharacterSelect({
  mode = "pre_queue",
  characters,
  selectedCharacterId,
  showHeading = true,
  showLabels = true,
  selectionState = "idle",
  autoAssignedCharacterId,
  neutralDefaultCharacterId,
  locked = false,
  disabled = false,
  deadlineMs,
  opponentStatus,
  autoAssignLabel = "Opponent auto-assigned balanced default",
  countdownSlot,
  opponentStatusSlot,
  roomStatusSlot,
  showDevModeToggle = true,
  compactCards = false,
  onSelect,
}: CharacterSelectProps) {
  const [devMode, setDevMode] = useState(false);
  const hasAuxMeta = Boolean(
    countdownSlot ||
      opponentStatusSlot ||
      roomStatusSlot ||
      deadlineMs !== undefined ||
      opponentStatus,
  );
  const title = mode === "post_deposit" ? "Lock your character" : "Choose your character";
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const autoAssignedCharacter = characters.find((character) => character.id === autoAssignedCharacterId) ?? null;
  const selectionLine = getSelectionStateLine(selectionState);
  const shouldShowAutoPickCopy = deadlineMs !== undefined && selectionState !== "expired";
  const canShowDefaultHint = mode === "post_deposit";
  const totalMs = 30_000;
  const remainingMs = deadlineMs ?? totalMs;
  const statusLine = useMemo(() => {
    if (selectedCharacter) return `Selected: ${selectedCharacter.name}`;
    if (autoAssignedCharacter) return `Auto-assigned: ${autoAssignedCharacter.name}`;
    return "Pick your scientist to continue.";
  }, [autoAssignedCharacter, selectedCharacter]);

  return (
    <section className={`character-select-panel flex flex-col ${compactCards ? "" : "flex-1"}`}>
      {showHeading && (
        <div className="mb-4">
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6d8373]">
            {mode === "post_deposit" ? "Character Lock" : "Character Select"}
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">{title}</h1>
        </div>
      )}

      {showLabels && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgba(111,58,40,0.35)] bg-[rgba(253,248,233,0.92)] px-3 py-1 font-gabarito text-[11px] font-bold uppercase tracking-[0.12em] text-[#6f3a28]">
              Roster
            </span>
            <span className="rounded-full border border-[rgba(39,65,55,0.25)] bg-[rgba(241,248,240,0.92)] px-3 py-1 font-gabarito text-xs text-[#2f4a3d]">
              {statusLine}
            </span>
          </div>
          {showDevModeToggle && (
            <button
              type="button"
              onClick={() => setDevMode((value) => !value)}
              className={`rounded-full border px-3 py-1 font-gabarito text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                devMode
                  ? "border-[rgba(248,214,148,0.7)] bg-[rgba(39,65,55,0.88)] text-[#f8d694]"
                  : "border-[rgba(111,58,40,0.32)] bg-[rgba(253,248,233,0.86)] text-[#6f3a28]"
              }`}
            >
              Dev Mode: {devMode ? "On" : "Off"}
            </button>
          )}
        </div>
      )}

      {devMode && (
        <div
          className="frame-cut mb-5 space-y-3 p-3"
          style={{ border: "2px solid rgba(248,214,148,0.36)", background: "rgba(13,24,20,0.66)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-gabarito text-xs font-bold uppercase tracking-[0.14em] text-[#f8d694]">
              Draft Debug
            </p>
            <p className="font-mono text-[11px] text-[rgba(248,214,148,0.88)]">
              state={selectionState} | locked={String(locked)} | disabled={String(disabled)}
            </p>
          </div>

          {countdownSlot ? (
            countdownSlot
          ) : (
            deadlineMs !== undefined && (
              <CountdownBar
                totalMs={totalMs}
                remainingMs={remainingMs}
                label="Character selection timer"
              />
            )
          )}

          {opponentStatusSlot ? (
            opponentStatusSlot
          ) : (
            opponentStatus && (
              <span
                className="frame-cut frame-cut-sm inline-flex px-3 py-2 font-gabarito text-xs font-semibold text-[#f4f0e6]"
                style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(28,38,32,0.88)" }}
              >
                {renderOpponentStatus(opponentStatus, autoAssignLabel)}
              </span>
            )
          )}
          {!hasAuxMeta && (
            <p className="font-gabarito text-xs text-[rgba(244,240,230,0.82)]">
              No countdown/opponent sync metadata in this phase.
            </p>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div
              className="frame-cut p-3"
              style={{ border: "1px solid rgba(248,214,148,0.32)", background: "rgba(31,44,37,0.9)" }}
            >
              <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[#f8d694]">
                Your Selection
              </p>
              <p className="mt-1 font-gabarito text-xs text-[#f4f0e6]">
                {selectedCharacter?.name ?? autoAssignedCharacter?.name ?? "No character selected yet."}
              </p>
              <p className="mt-1 font-gabarito text-xs text-[rgba(244,240,230,0.8)]">{selectionLine}</p>
              {shouldShowAutoPickCopy && (
                <p className="mt-2 font-gabarito text-[11px] text-[rgba(248,214,148,0.92)]">
                  Auto-pick if time expires.
                </p>
              )}
            </div>
            {roomStatusSlot ?? (
              <RoomStatusRail
                title="Selection Status"
                rows={[
                  {
                    id: "you",
                    label: "You",
                    subtitle: selectedCharacter?.name ?? autoAssignedCharacter?.name ?? "Waiting for pick",
                    badges:
                      selectionState === "locked"
                        ? ["connected", "matched", "deposited", "selecting", "locked", "ready"]
                        : selectionState === "auto_assigned"
                          ? ["connected", "matched", "deposited", "auto_assigned", "ready"]
                          : selectionState === "selected"
                            ? ["connected", "matched", "deposited", "selecting"]
                            : ["connected", "matched", "deposited", "selecting"],
                  },
                  {
                    id: "opponent",
                    label: "Opponent",
                    subtitle: opponentStatus === "waiting" ? "Choosing character" : "Selection state synced",
                    badges: getOpponentBadges(opponentStatus),
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}

      <div className={`character-select-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${compactCards ? "items-start" : "flex-1"}`}>
        {characters.map((character, index) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={selectedCharacterId === character.id}
            autoAssigned={autoAssignedCharacterId === character.id}
            showNeutralDefault={canShowDefaultHint && neutralDefaultCharacterId === character.id}
            previewExpression="happy"
            compact={compactCards}
            disabled={disabled}
            locked={locked}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
