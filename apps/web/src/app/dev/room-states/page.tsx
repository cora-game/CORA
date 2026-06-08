"use client";

import { useMemo, useState } from "react";
import { CharacterSelect } from "@/components/character/CharacterSelect";
import type {
  CharacterOption,
  CharacterSelectionState,
  CharacterSelectMode,
  OpponentCharacterStatus,
} from "@/components/character/characterTypes";
import { DepositPanel } from "@/components/deposit/DepositPanel";
import type { DepositStatus } from "@/components/deposit/depositTypes";
import { RoomPhaseShell } from "@/components/room/RoomPhaseShell";
import type { RoomPhase } from "@/components/room/roomPhaseTypes";
import { RoomStatusRail } from "@/components/room/RoomStatusRail";
import { getRuntimeConfig } from "@/lib/config/runtimeModes";

const CHARACTERS: CharacterOption[] = [
  {
    id: "turing",
    name: "Alan Turing",
    base: "The Computer",
    accentColor: "#9db496",
    portraitBg: "linear-gradient(160deg, #152920 0%, #274137 60%, #0d1f18 100%)",
    initial: "T",
  },
  {
    id: "curie",
    name: "Marie Curie",
    base: "The Laboratory",
    accentColor: "#ba6931",
    portraitBg: "linear-gradient(160deg, #3d1f0a 0%, #5c2e12 60%, #210e04 100%)",
    initial: "C",
  },
  {
    id: "einstein",
    name: "Albert Einstein",
    base: "The Relativity Room",
    accentColor: "#f8d694",
    portraitBg: "linear-gradient(160deg, #12122a 0%, #1e1e3f 60%, #080814 100%)",
    initial: "E",
  },
];

const PHASES: RoomPhase[] = [
  "setup",
  "matchmaking",
  "depositing",
  "selecting_character",
  "playing",
  "finished",
  "error",
];

const DEPOSIT_STATUSES: DepositStatus[] = [
  "idle",
  "wallet_required",
  "signing",
  "submitted",
  "confirmed",
  "waiting_opponent",
  "opponent_failed",
  "expired",
  "error",
];

type Preset = {
  id: string;
  label: string;
  mode: CharacterSelectMode;
  phase: RoomPhase;
  selectionState: CharacterSelectionState;
  opponentStatus: OpponentCharacterStatus;
  depositStatus: DepositStatus;
  selectedCharacterId?: string;
  autoAssignedCharacterId?: string;
  deadlineMs?: number;
};

const PRESETS: Preset[] = [
  {
    id: "old-flow",
    label: "Old Flow / Pre-Queue",
    mode: "pre_queue",
    phase: "setup",
    selectionState: "selected",
    opponentStatus: "hidden",
    depositStatus: "idle",
    selectedCharacterId: "turing",
  },
  {
    id: "new-flow",
    label: "New Flow / Post-Deposit",
    mode: "post_deposit",
    phase: "selecting_character",
    selectionState: "selected",
    opponentStatus: "picked",
    depositStatus: "confirmed",
    selectedCharacterId: "curie",
    deadlineMs: 18000,
  },
  {
    id: "timeout-auto-assign",
    label: "Timeout Auto-Assign",
    mode: "post_deposit",
    phase: "selecting_character",
    selectionState: "auto_assigned",
    opponentStatus: "auto_assigned",
    depositStatus: "waiting_opponent",
    autoAssignedCharacterId: "einstein",
    deadlineMs: 0,
  },
  {
    id: "locked-ready",
    label: "Locked / Ready",
    mode: "post_deposit",
    phase: "playing",
    selectionState: "locked",
    opponentStatus: "locked",
    depositStatus: "confirmed",
    selectedCharacterId: "turing",
  },
];

function labelFromPhase(phase: RoomPhase) {
  return phase.replace("_", " ");
}

export default function DevRoomStatesPage() {
  const runtimeConfig = getRuntimeConfig();
  const previewEnabled = runtimeConfig.allowDevRoomPreview;

  const [mode, setMode] = useState<CharacterSelectMode>("pre_queue");
  const [phase, setPhase] = useState<RoomPhase>("setup");
  const [selectionState, setSelectionState] = useState<CharacterSelectionState>("idle");
  const [opponentStatus, setOpponentStatus] = useState<OpponentCharacterStatus>("waiting");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>("idle");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>(undefined);
  const [autoAssignedCharacterId, setAutoAssignedCharacterId] = useState<string | undefined>(undefined);
  const [deadlineMs, setDeadlineMs] = useState<number | undefined>(undefined);

  const selectionLocked = selectionState === "locked" || selectionState === "expired";
  const selectionDisabled = selectionState === "expired";
  const selectedLabel = useMemo(
    () => CHARACTERS.find((character) => character.id === selectedCharacterId)?.name ?? "None",
    [selectedCharacterId],
  );

  function applyPreset(preset: Preset) {
    setMode(preset.mode);
    setPhase(preset.phase);
    setSelectionState(preset.selectionState);
    setOpponentStatus(preset.opponentStatus);
    setDepositStatus(preset.depositStatus);
    setSelectedCharacterId(preset.selectedCharacterId);
    setAutoAssignedCharacterId(preset.autoAssignedCharacterId);
    setDeadlineMs(preset.deadlineMs);
  }

  function onSelectionStateChange(nextState: CharacterSelectionState) {
    setSelectionState(nextState);

    if (nextState === "idle") {
      setSelectedCharacterId(undefined);
      setAutoAssignedCharacterId(undefined);
      return;
    }

    if (nextState === "auto_assigned") {
      setSelectedCharacterId(undefined);
      setAutoAssignedCharacterId((current) => current ?? CHARACTERS[0]?.id);
      return;
    }

    setAutoAssignedCharacterId(undefined);
  }

  if (!previewEnabled) {
    return (
      <main
        className="grid min-h-[100svh] place-items-center px-4"
        style={{
          backgroundColor: "#f5f1e8",
          backgroundImage:
            "linear-gradient(rgba(39,65,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      >
        <div
          className="frame-cut w-full max-w-xl p-5 text-center"
          style={{ border: "1px solid rgba(186,105,49,0.34)", background: "rgba(255,250,242,0.97)" }}
        >
          <p className="font-caprasimo text-3xl text-[#1f2b24]">Dev Preview Disabled</p>
          <p className="mt-2 font-gabarito text-sm text-[#73512d]">
            Enable <code>NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW=true</code> to access this test surface.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div
      className="min-h-[100svh]"
      style={{
        backgroundColor: "#f5f1e8",
        backgroundImage:
          "linear-gradient(rgba(39,65,55,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(39,65,55,0.045) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      <RoomPhaseShell
        phase={phase}
        title="Flow-Safe Room State Preview"
        subtitle="Local mock states for both old and new flow variants."
        withTransition={false}
        statusSlot={
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#274137]"
            style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)" }}
          >
            /dev/room-states
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <section
            className="frame-cut p-4"
            style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.88)" }}
          >
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[#5e7768]">
              Quick Presets
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide text-[#274137]"
                  style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.92)" }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section
            className="frame-cut p-4"
            style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.88)" }}
          >
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[#5e7768]">
              Manual Controls
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="font-gabarito text-xs text-[#4f6759]">
                Flow mode
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as CharacterSelectMode)}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  <option value="pre_queue">pre_queue</option>
                  <option value="post_deposit">post_deposit</option>
                </select>
              </label>

              <label className="font-gabarito text-xs text-[#4f6759]">
                Room phase
                <select
                  value={phase}
                  onChange={(event) => setPhase(event.target.value as RoomPhase)}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  {PHASES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </select>
              </label>

              <label className="font-gabarito text-xs text-[#4f6759]">
                Selection state
                <select
                  value={selectionState}
                  onChange={(event) => onSelectionStateChange(event.target.value as CharacterSelectionState)}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  <option value="idle">idle</option>
                  <option value="selected">selected</option>
                  <option value="locked">locked</option>
                  <option value="auto_assigned">auto_assigned</option>
                  <option value="expired">expired</option>
                </select>
              </label>

              <label className="font-gabarito text-xs text-[#4f6759]">
                Opponent status
                <select
                  value={opponentStatus}
                  onChange={(event) => setOpponentStatus(event.target.value as OpponentCharacterStatus)}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  <option value="hidden">hidden</option>
                  <option value="waiting">waiting</option>
                  <option value="picked">picked</option>
                  <option value="locked">locked</option>
                  <option value="auto_assigned">auto_assigned</option>
                </select>
              </label>

              <label className="font-gabarito text-xs text-[#4f6759]">
                Deposit status
                <select
                  value={depositStatus}
                  onChange={(event) => setDepositStatus(event.target.value as DepositStatus)}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  {DEPOSIT_STATUSES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </select>
              </label>

              <label className="font-gabarito text-xs text-[#4f6759]">
                Countdown
                <select
                  value={String(deadlineMs ?? -1)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setDeadlineMs(next < 0 ? undefined : next);
                  }}
                  className="mt-1 w-full rounded border border-[rgba(39,65,55,0.2)] bg-white px-2 py-2 text-xs text-[#274137]"
                >
                  <option value="-1">off</option>
                  <option value="25000">25s</option>
                  <option value="18000">18s</option>
                  <option value="8000">8s</option>
                  <option value="0">0s</option>
                </select>
              </label>
            </div>
          </section>

          <RoomStatusRail
            title="Preview Snapshot"
            rows={[
              {
                id: "you",
                label: "You",
                subtitle: `Mode ${mode} | Character ${selectedLabel}`,
                badges:
                  selectionState === "locked"
                    ? ["connected", "matched", "deposited", "selecting", "locked", "ready"]
                    : selectionState === "auto_assigned"
                      ? ["connected", "matched", "deposited", "auto_assigned", "ready"]
                      : ["connected", "matched", "deposited", "selecting"],
              },
              {
                id: "opponent",
                label: "Opponent",
                subtitle: `Phase ${labelFromPhase(phase)}`,
                badges:
                  opponentStatus === "locked"
                    ? ["connected", "matched", "locked", "ready"]
                    : opponentStatus === "auto_assigned"
                      ? ["connected", "matched", "auto_assigned", "ready"]
                      : ["connected", "matched", "selecting"],
              },
            ]}
          />

          <CharacterSelect
            mode={mode}
            characters={CHARACTERS}
            selectedCharacterId={selectedCharacterId}
            selectionState={selectionState}
            autoAssignedCharacterId={autoAssignedCharacterId}
            neutralDefaultCharacterId={CHARACTERS[0]?.id}
            locked={selectionLocked}
            disabled={selectionDisabled}
            deadlineMs={deadlineMs}
            opponentStatus={opponentStatus}
            onSelect={(characterId) => {
              setSelectedCharacterId(characterId);
              if (selectionState === "idle") {
                setSelectionState("selected");
              }
            }}
          />

          <DepositPanel
            token="SOL"
            wagerUsd="1.00"
            status={depositStatus}
            countdownSeconds={depositStatus === "idle" || depositStatus === "signing" ? 24 : undefined}
            helperText="Mocked dev state preview only."
            signature={
              depositStatus === "submitted" ||
                depositStatus === "confirmed" ||
                depositStatus === "waiting_opponent"
                ? "5Bf9...mockSignature"
                : null
            }
            canPrimaryAction={depositStatus === "idle" || depositStatus === "error"}
            primaryActionLabel={depositStatus === "error" ? "Retry Deposit" : "Sign Deposit"}
            onPrimaryAction={() => {
              setDepositStatus("signing");
            }}
            retrySlot={
              depositStatus === "error" ? (
                <button
                  type="button"
                  onClick={() => setDepositStatus("idle")}
                  className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
                >
                  Reset Error
                </button>
              ) : null
            }
            cancelSlot={
              <button
                type="button"
                onClick={() => setDepositStatus("expired")}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "#fffdfa" }}
              >
                Expire
              </button>
            }
          />
        </div>
      </RoomPhaseShell>
    </div>
  );
}
