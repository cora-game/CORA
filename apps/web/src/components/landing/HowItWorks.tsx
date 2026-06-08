"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANDING_STAGES } from "./content";
import { getLandingAccentStyle } from "./visuals";

const STAGE_MARKER_CHARACTERS = [
  ["turing"],
  ["curie"],
  ["einstein"],
  ["turing", "curie", "einstein"],
] as const;

function getHappyExpressionSrc(characterId: string) {
  return `/assets/characters/${characterId}/exp/happy.png`;
}

function CharacterMarker({
  index,
  active,
  isCompleted,
  accent,
}: {
  index: number;
  active: boolean;
  isCompleted: boolean;
  accent: string;
}) {
  const characterIds = STAGE_MARKER_CHARACTERS[index] ?? [];
  const background = active
    ? "rgba(255,250,240,0.98)"
    : isCompleted
      ? "rgba(255,248,236,0.92)"
      : "rgba(255,250,239,0.72)";
  const borderColor = active || isCompleted ? accent : "var(--warm-border)";
  const shadow = active ? "0 10px 24px rgba(41,32,25,0.16)" : undefined;

  if (characterIds.length === 1) {
    const characterId = characterIds[0];

    return (
      <div
        className={`relative h-11 w-11 overflow-hidden rounded-xl border-[2.5px] transition-all duration-300 ${active ? "shadow-md" : ""}`}
        style={{ borderColor, background, boxShadow: shadow }}
      >
        <Image
          src={getHappyExpressionSrc(characterId)}
          alt={`${characterId} happy expression`}
          fill
          sizes="44px"
          className="object-cover object-center scale-[1.06]"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative h-11 w-11 overflow-hidden rounded-xl border-[2.5px] transition-all duration-300 ${active ? "shadow-md" : ""}`}
      style={{ borderColor, background, boxShadow: shadow }}
    >
      <div className="relative h-full w-full">
        <div className="absolute left-1/2 top-[3px] h-[18px] w-[18px] -translate-x-1/2 overflow-hidden rounded-full border border-[rgba(255,250,240,0.95)] bg-[var(--warm-bg)]">
          <Image
            src={getHappyExpressionSrc(characterIds[0])}
            alt={`${characterIds[0]} happy expression`}
            fill
            sizes="18px"
            className="object-cover object-center scale-110"
          />
        </div>
        <div className="absolute bottom-[3px] left-[4px] h-[18px] w-[18px] overflow-hidden rounded-full border border-[rgba(255,250,240,0.95)] bg-[var(--warm-bg)]">
          <Image
            src={getHappyExpressionSrc(characterIds[1])}
            alt={`${characterIds[1]} happy expression`}
            fill
            sizes="18px"
            className="object-cover object-center scale-110"
          />
        </div>
        <div className="absolute bottom-[3px] right-[4px] h-[18px] w-[18px] overflow-hidden rounded-full border border-[rgba(255,250,240,0.95)] bg-[var(--warm-bg)]">
          <Image
            src={getHappyExpressionSrc(characterIds[2])}
            alt={`${characterIds[2]} happy expression`}
            fill
            sizes="18px"
            className="object-cover object-center scale-110"
          />
        </div>
      </div>
    </div>
  );
}

function StepRailMarker({
  index,
  active,
  isCompleted,
  accent,
}: {
  index: number;
  active: boolean;
  isCompleted: boolean;
  accent: string;
}) {
  if (!isCompleted) {
    return (
      <div
        className={`font-gabarito flex h-11 w-11 items-center justify-center rounded-xl border-[2.5px] text-xs font-black transition-all duration-300 ${
          active ? "shadow-md" : ""
        }`}
        style={{
          borderColor: active ? accent : "var(--warm-border)",
          background: active ? accent : "rgba(255,250,239,0.72)",
          color: active ? "#fffaf0" : "var(--warm-muted)",
        }}
      >
        {index + 1}
      </div>
    );
  }

  return (
    <CharacterMarker
      index={index}
      active={false}
      isCompleted
      accent={accent}
    />
  );
}

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressWidth = useTransform(scrollYProgress, [0.05, 0.92], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isMobile) return;
    const idx = Math.min(LANDING_STAGES.length - 1, Math.floor(latest * LANDING_STAGES.length * 0.98));
    setActive(Math.max(0, idx));
  });

  const stage = LANDING_STAGES[active];
  const stageStyle = useMemo(() => getLandingAccentStyle(stage.accent), [stage.accent]);
  const isPrimary = stage.accent === "primary";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  if (isMobile) {
    return (
      <section
        id="how-it-works"
        className="paper-grain relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(180deg, #f5edd8 0%, var(--warm-bg) 50%, #f5edd8 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-20 h-64 w-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(186,105,49,0.15), transparent 70%)" }} />
          <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full opacity-25" style={{ background: "radial-gradient(circle, rgba(60,92,95,0.15), transparent 70%)" }} />
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <div className="relative mx-auto max-w-md">
          <div className="mb-8 text-center">
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--warm-muted)]">
              How battles unfold
            </p>
            <h2 className="font-caprasimo mt-3 text-[2rem] leading-[1.05] text-[var(--warm-text)]">
              Pick your mind. <span className="text-[var(--tone-clay)]">Predict the move.</span>
            </h2>
            <p className="font-gabarito mt-3 text-sm text-[var(--warm-muted)]">
              Tap the card to move through each stage.
            </p>
          </div>

          <div className="mb-6 flex items-center justify-center gap-2">
            {LANDING_STAGES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className="rounded-full transition-transform active:scale-95"
                aria-label={`Go to ${s.label}`}
              >
                <StepRailMarker
                  index={i}
                  active={i === active}
                  isCompleted={i < active}
                  accent={i === active ? stageStyle.accent : s.accent === "primary" ? "var(--tone-clay)" : "var(--tone-teal)"}
                />
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.button
              key={stage.id}
              type="button"
              onClick={() => setActive((prev) => (prev + 1) % LANDING_STAGES.length)}
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="game-card relative block w-full overflow-hidden text-left"
            >
              <div className="h-1.5 w-full rounded-t-2xl accent-bar-slide" style={{ background: stageStyle.accent }} />
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: isPrimary ? "rgba(186,105,49,0.3)" : "rgba(60,92,95,0.3)" }} />

              <div className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl border-[2.5px]"
                      style={{
                        borderColor: stageStyle.accent,
                        background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                      }}
                    >
                      <CharacterMarker index={active} active isCompleted={false} accent={stageStyle.accent} />
                    </div>
                    <div>
                      <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--warm-muted)]">
                        {stage.label}
                      </p>
                      <span
                        className="font-gabarito mt-1 inline-flex rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em]"
                        style={{
                          background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                          color: stageStyle.accent,
                        }}
                      >
                        {stage.domain}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border-[2.5px] border-[var(--warm-border)] bg-[var(--warm-bg)] px-3 py-2 text-right">
                    <p className="font-mono text-xs font-black uppercase tracking-wide" style={{ color: stageStyle.accent }}>
                      {stage.stat}
                    </p>
                  </div>
                </div>

                <h3 className="font-caprasimo mt-6 text-[2rem] leading-[1.04] text-[var(--warm-text)]">{stage.title}</h3>
                <p className="font-gabarito mt-3 text-sm leading-6 text-[var(--warm-muted)]">{stage.summary}</p>

                <div className="mt-5 flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--warm-muted)]">
                    {active + 1} / {LANDING_STAGES.length}
                  </span>
                  <span className="font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--tone-clay)]">
                    Tap for next
                  </span>
                </div>
              </div>
            </motion.button>
          </AnimatePresence>
        </div>
      </section>
    );
  }

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="paper-grain relative h-[300vh]"
      style={{ background: "linear-gradient(180deg, #f5edd8 0%, var(--warm-bg) 50%, #f5edd8 100%)" }}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(186,105,49,0.15), transparent 70%)" }} />
        <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full opacity-25" style={{ background: "radial-gradient(circle, rgba(60,92,95,0.15), transparent 70%)" }} />
      </div>

      {/* subtle dots pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-4 py-16 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
            How battles unfold
          </p>
          <h2 className="font-caprasimo mt-3 text-3xl leading-tight text-[var(--warm-text)] md:text-5xl">
            Pick your mind.{" "}
            <span className="text-[var(--tone-clay)]">Predict the move. Shatter the base.</span>
          </h2>
        </motion.div>

        {/* step indicators */}
        <div className="mb-10 flex items-center gap-2">
          {LANDING_STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <StepRailMarker
                index={i}
                active={i === active}
                isCompleted={i < active}
                accent={i === active ? stageStyle.accent : s.accent === "primary" ? "var(--tone-clay)" : "var(--tone-teal)"}
              />
              {i < LANDING_STAGES.length - 1 && (
                <div className="h-0.5 w-8 rounded-full bg-[var(--warm-border)]">
                  {i < active && (
                    <motion.div
                      layoutId={`connector-${i}`}
                      className="h-full rounded-full"
                      style={{ background: "var(--tone-clay)" }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* stage card */}
        <div className="relative mx-auto w-full max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="game-card relative overflow-hidden"
            >
              {/* top accent bar */}
              <div className="h-1.5 w-full rounded-t-2xl accent-bar-slide" style={{ background: stageStyle.accent }} />

              {/* decorative blob inside card */}
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: isPrimary ? "rgba(186,105,49,0.3)" : "rgba(60,92,95,0.3)" }} />

              <div className="relative p-8 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="grid h-12 w-12 place-items-center rounded-xl border-[2.5px]"
                      style={{
                        borderColor: stageStyle.accent,
                        background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                      }}
                    >
                      <CharacterMarker
                        index={active}
                        active
                        isCompleted={false}
                        accent={stageStyle.accent}
                      />
                    </div>
                    <div>
                      <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
                        {stage.label}
                      </p>
                      <span
                        className="font-gabarito mt-1 inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                          color: stageStyle.accent,
                        }}
                      >
                        {stage.domain}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border-[2.5px] border-[var(--warm-border)] bg-[var(--warm-bg)] px-4 py-3 text-right">
                    <p className="font-mono text-sm font-black uppercase tracking-wide" style={{ color: stageStyle.accent }}>
                      {stage.stat}
                    </p>
                  </div>
                </div>

                <h3 className="font-caprasimo mt-7 max-w-3xl text-3xl leading-tight text-[var(--warm-text)] md:text-4xl">{stage.title}</h3>
                <p className="font-gabarito mt-4 max-w-3xl text-base leading-7 text-[var(--warm-muted)]">{stage.summary}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* progress bar */}
          <div className="mt-6 flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--warm-border)]">
              <motion.div
                className="h-full rounded-full"
                style={{ width: progressWidth, background: "var(--tone-clay)" }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--warm-muted)]">
              {active + 1} / {LANDING_STAGES.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
