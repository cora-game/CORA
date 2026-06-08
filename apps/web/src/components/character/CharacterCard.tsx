"use client";

import Image from "next/image";
import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterOption } from "./characterTypes";
import { CHARACTER_DEFS } from "@shared/characterStats";

type CharacterCardProps = {
  character: CharacterOption;
  selected: boolean;
  disabled?: boolean;
  locked?: boolean;
  autoAssigned?: boolean;
  showNeutralDefault?: boolean;
  previewExpression?: "happy";
  compact?: boolean;
  index: number;
  onSelect: (characterId: string) => void;
};

export function CharacterCard({
  character,
  selected,
  disabled = false,
  locked = false,
  autoAssigned = false,
  showNeutralDefault = false,
  previewExpression = "happy",
  compact = false,
  index,
  onSelect,
}: CharacterCardProps) {
  const portraitControls = useAnimationControls();
  const hasMountedRef = useRef(false);
  const [failedExpressions, setFailedExpressions] = useState<Record<string, true>>({});
  const isInteractive = !disabled && !locked;
  const expressionName = selected ? previewExpression : "idle";
  const expressionSrc = useMemo(
    () => `/assets/characters/${character.id.trim().toLowerCase()}/exp/${expressionName}.png`,
    [character.id, expressionName],
  );
  const canRenderExpression = !failedExpressions[expressionSrc];
  const specialty = CHARACTER_DEFS[character.id]?.specialty ?? null;
  const specialtyLabel = specialty ? specialty[0].toUpperCase() + specialty.slice(1) : "Generalist";
  const specialtyMultiplier = CHARACTER_DEFS[character.id]?.specialtyMultiplier ?? 1;
  const roleLabel = `${specialtyLabel} Specialist`;
  const statusLabel = autoAssigned
    ? "Auto-assigned"
    : selected && locked
      ? "Locked In"
      : selected
        ? "Selected"
        : showNeutralDefault
          ? "Balanced Default"
          : "Tap to Select";

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      portraitControls.set({ scale: 1, y: 0 });
      return;
    }

    portraitControls.start({
      y: selected ? [0, -3, 0] : [0, 2, 0],
      scale: selected ? [1, 1.035, 1] : [1, 1.018, 1],
      transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
    });
  }, [selected, portraitControls]);

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (isInteractive) onSelect(character.id);
      }}
      disabled={!isInteractive}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: selected ? -5 : 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={isInteractive ? { y: selected ? -6 : -1.5 } : undefined}
      className={`game-card character-card-btn relative flex flex-col overflow-hidden p-4 text-left transition-transform ${compact ? "min-h-[320px]" : "min-h-[350px]"}`}
      style={{
        border: selected ? "3px solid #ba6931" : "3px solid rgba(111,58,40,0.38)",
        background: selected
          ? "linear-gradient(180deg, #fff5de 0%, #f6e7cc 100%)"
          : "linear-gradient(180deg, #fff9ea 0%, #f2e5cb 100%)",
        boxShadow: selected
          ? "0 22px 40px rgba(22,38,32,0.3), 0 0 0 3px rgba(248,214,148,0.45)"
          : "0 12px 24px rgba(41,32,25,0.22)",
        opacity: disabled && !selected ? 0.62 : 1,
        cursor: isInteractive ? "pointer" : "not-allowed",
      }}
      aria-pressed={selected}
      aria-disabled={!isInteractive}
    >
      <motion.div
        animate={portraitControls}
        className={`character-card-avatar relative mx-auto mb-4 aspect-square w-full overflow-hidden rounded-2xl ${compact ? "max-w-[190px]" : "max-w-[210px]"}`}
        style={{
          border: selected ? "2px solid rgba(248,214,148,0.94)" : "2px solid rgba(15,20,17,0.7)",
          background: character.portraitBg,
          boxShadow: selected ? "0 10px 24px rgba(16,26,22,0.45), 0 0 20px rgba(248,214,148,0.4)" : "0 8px 18px rgba(10,16,13,0.3)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,0.2),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,7,0.06)_0%,rgba(5,8,7,0.35)_100%)]" />
        <div className="relative z-10 grid h-full place-items-center">
          {canRenderExpression ? (
            <Image
              src={expressionSrc}
              alt={`${character.name} ${expressionName} expression`}
              fill
              sizes="210px"
              className="object-cover object-center"
              onError={() => {
                setFailedExpressions((prev) => {
                  if (prev[expressionSrc]) return prev;
                  return { ...prev, [expressionSrc]: true };
                });
              }}
            />
          ) : (
            <span className="font-caprasimo text-7xl text-[#f7e5bf]" style={{ textShadow: "0 6px 14px rgba(0,0,0,0.35)" }}>
              {character.initial}
            </span>
          )}
        </div>
      </motion.div>

      <div className="character-card-info flex flex-1 flex-col justify-between w-full h-full">
        <div>
          <p className="character-card-name font-caprasimo text-2xl leading-tight text-[#2a1b10]">{character.name}</p>
          <p className="character-card-base mt-1 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#664734]">
            Base: {character.base}
          </p>
          <div className="character-card-badge-row mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-[rgba(39,65,55,0.3)] bg-[rgba(239,247,237,0.92)] px-2 py-0.5 font-gabarito text-[10px] font-semibold uppercase tracking-wide text-[#274137]">
              {roleLabel}
            </span>
            <span className="rounded-full border border-[rgba(39,65,55,0.34)] bg-[rgba(226,236,222,0.9)] px-2 py-0.5 font-mono text-[10px] font-bold text-[#274137]">
              x{specialtyMultiplier.toFixed(1)}
            </span>
          </div>
        </div>

        <div className={`character-card-status-container ${compact ? "mt-4" : "mt-auto pt-2"}`}>
          <div
            className={`character-card-status rounded-xl border px-3 py-2 text-center font-gabarito text-[11px] font-bold uppercase tracking-[0.12em] ${
              selected
                ? "border-[rgba(248,214,148,0.52)] bg-[rgba(39,65,55,0.92)] text-[#f8d694]"
                : autoAssigned
                  ? "border-[rgba(186,105,49,0.4)] bg-[rgba(255,242,222,0.94)] text-[#8f5a1d]"
                  : "border-[rgba(111,58,40,0.28)] bg-[rgba(255,250,239,0.86)] text-[#6f3a28]"
            }`}
          >
            {statusLabel}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
