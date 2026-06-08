"use client";

import { useState } from "react";
import { CharacterSelect } from "@/components/character/CharacterSelect";
import type { CharacterOption } from "@/components/character/characterTypes";

type BlinkCharacterGateProps = {
  title?: string;
  subtitle?: string;
  characters: CharacterOption[];
  selectedCharacterId?: string | null;
  onSelect: (characterId: string) => void;
  onContinue: () => void;
  onSurrender?: () => void;
};

export function BlinkCharacterGate({
  title = "Choose your scientist",
  subtitle = "Your wager is locked. Pick who enters the Blink match before we connect to the room.",
  characters,
  selectedCharacterId,
  onSelect,
  onContinue,
  onSurrender,
}: BlinkCharacterGateProps) {
  const [surrenderConfirmOpen, setSurrenderConfirmOpen] = useState(false);
  const canContinue = Boolean(selectedCharacterId);

  return (
    <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-center px-4 py-6 md:px-6">
      <div
        className="game-card flex flex-col p-5 shadow-2xl md:p-7"
        style={{
          border: "2px solid rgba(248,214,148,0.36)",
          background: "linear-gradient(180deg, #fff8e8 0%, #f3e6c9 100%)",
        }}
      >
        <div className="mb-5">
          <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.22em] text-[var(--tone-clay)]">
            Blink Character Lock
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[var(--tone-bark)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl font-gabarito text-sm text-[var(--warm-text)]">{subtitle}</p>
        </div>

        <CharacterSelect
          mode="post_deposit"
          characters={characters}
          selectedCharacterId={selectedCharacterId ?? undefined}
          selectionState={selectedCharacterId ? "selected" : "idle"}
          opponentStatus="hidden"
          showHeading={false}
          showLabels={false}
          showDevModeToggle={false}
          compactCards
          onSelect={onSelect}
        />

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {onSurrender && (
            <button
              type="button"
              onClick={() => setSurrenderConfirmOpen(true)}
              className="btn-game btn-game-secondary px-5 py-3 text-xs"
              style={{
                borderColor: "rgba(111,58,40,0.42)",
                boxShadow: "0 4px 0 rgba(111,58,40,0.22)",
                color: "rgba(111,58,40,0.72)",
              }}
            >
              Surrender
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={`btn-game btn-game-primary px-6 py-3 text-xs ${!canContinue ? "cursor-not-allowed opacity-50 grayscale" : ""}`}
          >
            Confirm Scientist
          </button>
        </div>
      </div>

      {surrenderConfirmOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(2,6,5,0.78)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 shadow-2xl md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender challenge?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">
              Your wager is already locked. Surrendering exits this Blink challenge and awards the match to your rival.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSurrenderConfirmOpen(false)}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Keep Choosing
              </button>
              <button
                type="button"
                onClick={() => {
                  setSurrenderConfirmOpen(false);
                  onSurrender?.();
                }}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Confirm Surrender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
