"use client";

import { motion } from "framer-motion";

type Phase = {
  tag: string;
  status: string;
  live?: boolean;
  accent: "clay" | "teal";
  title: string;
  goal: string;
  items: string[];
};

const PHASES: Phase[] = [
  {
    tag: "Phase 0",
    status: "Live",
    live: true,
    accent: "clay",
    title: "MVP Live + $CORA Launch",
    goal: "Prove the core loop on-chain and launch the token.",
    items: [
      "Real-time 1v1 logic battles — cards, HP, 10s answer window",
      "Instant matchmaking + free bot practice (no wallet)",
      "Private challenges via shareable links",
      "On-chain escrow + settlement — winner takes 97.5%",
      "ETH / USDC wagers on Base Sepolia",
      "$CORA token launch on Base",
    ],
  },
  {
    tag: "Phase 1",
    status: "Q3 2026",
    accent: "teal",
    title: "Harden & Content",
    goal: "Make it sticky and trustworthy before real money.",
    items: [
      "Question bank v2 — new categories + difficulty scaling",
      "Leaderboards, ELO & real wallet history",
      "Anti-cheat hardening + server-authoritative timing",
      "$CORA utility v1 — reduced rake when wagering in $CORA",
      "Reliability: reconnect/resume, settlement observability",
    ],
  },
  {
    tag: "Phase 2",
    status: "Q4 2026",
    accent: "clay",
    title: "Mainnet Launch",
    goal: "Real stakes, safely.",
    items: [
      "Security audit of escrow + battle programs",
      "Mainnet deploy + funded treasury & fee flow",
      "Squads multisig on upgrade authority",
      "Mainnet tokens + price-aware wager limits",
      "$CORA as a wager arena · public launch",
    ],
  },
  {
    tag: "Phase 3",
    status: "Q1 2027",
    accent: "teal",
    title: "Competitive & Social",
    goal: "Turn matches into a scene.",
    items: [
      "Ranked seasons + ELO tiers, rewards in $CORA",
      "Tournaments & brackets (Blink-powered entry)",
      "Spectator mode + shareable match recaps",
      "Friends, rematch, clans / teams",
      "Backend scale-out (Redis matchmaking)",
    ],
  },
  {
    tag: "Phase 4",
    status: "2027+",
    accent: "clay",
    title: "Ecosystem & $CORA Utility",
    goal: "Platform + deepen token value.",
    items: [
      "Mobile / PWA duels",
      "Community question packs (creator revenue-share)",
      "$CORA staking + season pass + governance",
      "Partner arenas / branded tokens",
      "Public SDK / Blinks to embed challenges anywhere",
    ],
  },
];

function accentColor(accent: Phase["accent"]) {
  return accent === "clay" ? "var(--tone-clay)" : "var(--tone-teal)";
}

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="paper-grain relative overflow-hidden px-4 py-20 md:px-8 md:py-28"
      style={{ background: "linear-gradient(180deg, #f5edd8 0%, var(--warm-bg) 50%, #f5edd8 100%)" }}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-32 h-64 w-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(186,105,49,0.15), transparent 70%)" }} />
        <div className="absolute -right-20 bottom-24 h-72 w-72 rounded-full opacity-25" style={{ background: "radial-gradient(circle, rgba(60,92,95,0.15), transparent 70%)" }} />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative mx-auto max-w-3xl">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 text-center"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
            Where we&apos;re headed
          </p>
          <h2 className="font-caprasimo mt-3 text-3xl leading-tight text-[var(--warm-text)] md:text-5xl">
            The road to <span className="text-[var(--tone-clay)]">mainnet &amp; beyond</span>
          </h2>
          <p className="font-gabarito mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--warm-muted)]">
            From a live devnet arena and the $CORA launch to audited mainnet stakes, ranked seasons, and an open challenge ecosystem.
          </p>
        </motion.div>

        {/* timeline */}
        <div className="relative">
          {/* vertical rail */}
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-[var(--warm-border)] md:left-[23px]" aria-hidden="true" />

          <div className="flex flex-col gap-6">
            {PHASES.map((phase, i) => {
              const accent = accentColor(phase.accent);
              return (
                <motion.div
                  key={phase.tag}
                  initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex gap-4 md:gap-6"
                >
                  {/* node */}
                  <div className="relative z-10 shrink-0">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl border-[2.5px] font-mono text-sm font-black md:h-12 md:w-12"
                      style={{
                        borderColor: accent,
                        background: phase.live ? accent : "var(--warm-bg)",
                        color: phase.live ? "#fffaf0" : accent,
                      }}
                    >
                      {i}
                    </div>
                  </div>

                  {/* card */}
                  <div className="game-card relative flex-1 overflow-hidden">
                    <div className="h-1.5 w-full rounded-t-2xl" style={{ background: accent }} />
                    <div className="relative p-5 md:p-7">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-gabarito text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--warm-muted)]">
                            {phase.tag}
                          </span>
                          {phase.live ? (
                            <span
                              className="font-gabarito inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#fffaf0]"
                              style={{ background: accent }}
                            >
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fffaf0] opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#fffaf0]" />
                              </span>
                              {phase.status}
                            </span>
                          ) : (
                            <span
                              className="font-mono rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                              style={{ borderColor: "var(--warm-border)", color: accent }}
                            >
                              {phase.status}
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="font-caprasimo mt-3 text-2xl leading-tight text-[var(--warm-text)] md:text-[1.75rem]">
                        {phase.title}
                      </h3>
                      <p className="font-gabarito mt-1.5 text-sm italic text-[var(--warm-muted)]">{phase.goal}</p>

                      <ul className="mt-4 flex flex-col gap-2">
                        {phase.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <span
                              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: accent }}
                              aria-hidden="true"
                            />
                            <span className="font-gabarito text-sm leading-6 text-[var(--warm-text)]">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <p className="font-gabarito mt-10 text-center text-xs text-[var(--warm-muted)]">
          Roadmap is directional and may evolve. Currently live on Base Sepolia.
        </p>
      </div>
    </section>
  );
}
