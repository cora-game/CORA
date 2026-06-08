"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CHARACTER_DEFS, type QuestionCategory } from "@shared/characterStats";
import { LANDING_SCIENTISTS, type ScientistProfile } from "./content";
import { getLandingAccentStyle } from "./visuals";

const SPECIALTY_LABELS: Record<QuestionCategory, string> = {
  sequence: "Sequence",
  logical: "Logical",
  math: "Math",
};

function getScientistBasicPoseSrc(scientistId: string) {
  return `/assets/characters/${scientistId}/basic.png`;
}

function formatMultiplier(value: number) {
  return `${value.toFixed(1)}x`;
}

function getOuterNarration(specialty: QuestionCategory, specialtyMultiplier: number) {
  const bonusPercent = Math.round((specialtyMultiplier - 1) * 100);
  if (specialty === "math") {
    return `Math specialist with +${bonusPercent}% specialty power on correct answers.`;
  }
  if (specialty === "logical") {
    return `Logical specialist with +${bonusPercent}% specialty power on correct answers.`;
  }
  return `Sequence specialist with +${bonusPercent}% specialty power on correct answers.`;
}

function getRolePillLabel(specialty: QuestionCategory) {
  if (specialty === "math") return "Mathematician";
  if (specialty === "logical") return "Logician";
  return "Pattern Runner";
}

type CombatStatRow = {
  label: string;
  value: string;
  score: number;
  max: number;
};

function getCombatStatsRows(scientistId: string): CombatStatRow[] {
  const def = CHARACTER_DEFS[scientistId];
  if (!def) return [];

  const maxMultiplier = 3;
  return [
    {
      label: "Base Correct Power",
      value: formatMultiplier(1),
      score: 1,
      max: maxMultiplier,
    },
    {
      label: `${SPECIALTY_LABELS[def.specialty]} Specialty Power`,
      value: formatMultiplier(def.specialtyMultiplier),
      score: def.specialtyMultiplier,
      max: maxMultiplier,
    },
    {
      label: "Specialty + Extra Point Max",
      value: formatMultiplier(def.specialtyMultiplier * 2),
      score: def.specialtyMultiplier * 2,
      max: maxMultiplier,
    },
  ];
}

function ScientistCard({
  scientist,
  index,
  isExpanded,
  onToggle,
}: {
  scientist: ScientistProfile;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const accentStyle = useMemo(() => getLandingAccentStyle(scientist.accent), [scientist.accent]);
  const isPrimary = scientist.accent === "primary";
  const basicPoseSrc = getScientistBasicPoseSrc(scientist.id);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const characterDef = CHARACTER_DEFS[scientist.id];
  const combatStatsRows = useMemo(() => getCombatStatsRows(scientist.id), [scientist.id]);
  const specialtyLabel = characterDef ? SPECIALTY_LABELS[characterDef.specialty] : "Unknown";
  const specialtyBonusPercent = characterDef ? Math.round((characterDef.specialtyMultiplier - 1) * 100) : 0;
  const rolePillLabel = characterDef ? getRolePillLabel(characterDef.specialty) : scientist.archetype;
  const summaryText = characterDef
    ? getOuterNarration(characterDef.specialty, characterDef.specialtyMultiplier)
    : scientist.short;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 95, damping: 20, mass: 0.85, delay: index * 0.1 }}
      className={`group relative ${isExpanded ? "z-50" : "z-10 hover:z-20"}`}
    >
      {/* hover glow */}
      <div className="absolute -inset-1 rounded-[24px] opacity-0 blur-xl transition duration-500 group-hover:opacity-30" style={{ backgroundColor: accentStyle.accent }} />

      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        className="game-card relative z-20 flex h-full cursor-pointer flex-col overflow-hidden text-left outline-none"
      >
        {/* portrait area */}
        <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden bg-[var(--tone-ecru)]">
          {!imageUnavailable && (
            <Image
              src={basicPoseSrc}
              alt={`${scientist.name} basic pose`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-center"
              onError={() => setImageUnavailable(true)}
            />
          )}

          {/* colored background wash */}
          <div
            className={`absolute inset-0 ${imageUnavailable ? "opacity-20" : "opacity-10"}`}
            style={{
              background: isPrimary
                ? "radial-gradient(circle at 50% 40%, rgba(186,105,49,0.3), transparent 70%)"
                : "radial-gradient(circle at 50% 40%, rgba(60,92,95,0.3), transparent 70%)",
            }}
          />

          {/* fallback portrait placeholder */}
          {imageUnavailable && (
            <div className="relative mb-3 flex flex-col items-center">
              {/* head circle */}
              <div
                className="grid h-20 w-20 place-items-center rounded-full border-[3px] shadow-md"
                style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)" }}
              >
                <span className="text-3xl">{scientist.emoji}</span>
              </div>
              {/* coat body shape */}
              <div
                className="-mt-2 h-12 w-16 rounded-b-2xl border-x-[3px] border-b-[3px] opacity-60"
                style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.08)" : "rgba(60,92,95,0.08)" }}
              />
            </div>
          )}

          {/* rarity badge */}
          <div className="absolute right-3 top-3 z-10">
            <span
              className="font-gabarito rounded-lg border-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", color: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.12)" : "rgba(60,92,95,0.12)" }}
            >
              +{specialtyBonusPercent}% Bonus
            </span>
          </div>

          {/* archetype badge */}
          <div className="absolute left-3 top-3 z-10">
            <span
              className="font-gabarito rounded-lg border-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", color: "#fffaf0", background: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)" }}
            >
              {rolePillLabel}
            </span>
          </div>

        </div>

        {/* card body */}
        <div className="p-5 md:p-6">
          <h3 className="font-caprasimo text-2xl text-[var(--warm-text)] md:text-3xl">{scientist.name}</h3>
          <p className="font-gabarito mt-2 text-sm text-[var(--warm-muted)]">{summaryText}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
            Base: {scientist.baseConcept}
          </p>

          {/* mobile expand */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden sm:hidden"
              >
                <div className="mt-6 space-y-5 border-t border-[var(--warm-border)] pt-6">
                  <p className="font-gabarito text-sm leading-relaxed text-[var(--warm-muted)]">{scientist.detail}</p>
                  <div className="flex items-center justify-between rounded-xl border border-[var(--warm-border)] bg-[rgba(255,248,236,0.7)] px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                      Specialty: <span className="font-bold text-[var(--warm-text)]">{specialtyLabel}</span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                      Bonus: <span className="font-bold text-[var(--warm-text)]">+{specialtyBonusPercent}%</span>
                    </p>
                  </div>
                  <div className="space-y-4 pt-2">
                    {combatStatsRows.map((stat, i) => (
                      <div key={stat.label}>
                        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                          <span>{stat.label}</span>
                          <span className="font-bold text-[var(--warm-text)]">{stat.value}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.1)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stat.score / stat.max) * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: accentStyle.accent }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex items-center justify-center border-t border-[var(--warm-border)] pt-4 opacity-50 transition-opacity duration-300 group-hover:opacity-100">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
              {isExpanded ? "Close Stats" : "View Stats"}
            </span>
          </div>
        </div>
      </div>

      {/* desktop drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute bottom-0 top-0 z-0 hidden overflow-hidden shadow-2xl sm:block ${index === 1 ? "sm:right-full sm:-mr-4 lg:left-full lg:right-auto lg:-ml-4 lg:-mr-0" : index === 2 ? "sm:left-full sm:-ml-4 lg:right-full lg:left-auto lg:-mr-4 lg:-ml-0" : "sm:left-full sm:-ml-4 lg:left-full lg:-ml-4"}`}
          >
            <div className="relative flex h-full w-[300px] flex-col overflow-hidden rounded-2xl border-[3px] border-[var(--tone-bark)] bg-[var(--warm-surface)] p-6 pl-8">
              <div className="mb-4">
                <span className="font-gabarito rounded-lg border-2 px-2.5 py-1 text-[10px] font-bold uppercase" style={{ borderColor: accentStyle.accent, color: accentStyle.accent, backgroundColor: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)" }}>
                  Stats and Intel
                </span>
              </div>
              <p className="font-gabarito text-sm leading-relaxed text-[var(--warm-muted)]">{scientist.detail}</p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--warm-border)] bg-[rgba(255,248,236,0.7)] px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                  Specialty: <span className="font-bold text-[var(--warm-text)]">{specialtyLabel}</span>
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                  Bonus: <span className="font-bold text-[var(--warm-text)]">+{specialtyBonusPercent}%</span>
                </p>
              </div>
              <div className="mt-8 space-y-5">
                {combatStatsRows.map((stat, i) => (
                  <div key={stat.label}>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                      <span>{stat.label}</span>
                      <span className="font-bold text-[var(--warm-text)]">{stat.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.1)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stat.score / stat.max) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: accentStyle.accent }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Features() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <section
      id="roster"
      className="paper-grain relative overflow-hidden px-4 py-16 md:px-8 md:py-28"
      style={{ background: "linear-gradient(180deg, var(--warm-bg) 0%, #f5edd8 100%)" }}
    >
      {/* decorative dots */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
            Meet the Minds
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="font-caprasimo mt-3 text-4xl leading-tight text-[var(--warm-text)] md:mt-4 md:text-6xl"
          >
            Every mind has a strategy.{" "}
            <span className="text-[var(--tone-clay)]">Every base has a weakness.</span>
          </motion.h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mt-14 lg:grid-cols-3">
          {LANDING_SCIENTISTS.map((scientist, index) => (
            <ScientistCard
              key={scientist.id}
              scientist={scientist}
              index={index}
              isExpanded={expandedId === scientist.id}
              onToggle={() => toggleExpand(scientist.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
