"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { LANDING_SCIENTISTS } from "./content";
import { getScientistIdleExpressionSrc } from "./heroAssets";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#080c09_0%,#0f1a14_100%)] px-4 py-28 text-[#f4f0e6] md:px-8">
      <div className="absolute inset-0 arena-grid opacity-20" />

      {/* dim hero-scene callback on the right */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46vw] min-w-[380px] max-w-[720px] md:block">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,9,0)_0%,rgba(8,12,9,0.12)_24%,rgba(8,12,9,0.62)_100%)]" />
        <div className="absolute bottom-[-4%] right-[10%] h-[64%] w-[46%] min-w-[360px] opacity-[0.1]">
          <Image
            src="/assets/landing/objects.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 34vw, 680px"
            className="object-contain object-bottom-right"
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-y-[-4%] right-[-8%] w-[118%] opacity-[0.14]">
          <Image
            src="/assets/landing/bookcase_3.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 46vw, 820px"
            className="object-contain object-right"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* ambient orbs */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] animate-orb-breath rounded-full opacity-22"
        style={{ background: "radial-gradient(circle at center, var(--accent-primary) 0%, transparent 68%)", filter: "blur(8px)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[380px] w-[380px] animate-orb-breath rounded-full opacity-16"
        style={{ background: "radial-gradient(circle at center, var(--accent-secondary) 0%, transparent 68%)", filter: "blur(10px)", animationDelay: "2s" }}
      />

      {/* floating decorative cards (right side) */}
      <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 md:block">
        {LANDING_SCIENTISTS.map((s, i) => (
          <div
            key={s.id}
            className="animate-float-card mb-6 flex w-[110px] flex-col items-center rounded-2xl border-[3px] border-[rgba(248,214,148,0.2)] bg-[rgba(255,255,255,0.04)] p-3 backdrop-blur-sm"
            style={{ "--float-rot": i === 0 ? "4deg" : i === 1 ? "-3deg" : "2deg", animationDelay: `${i * 1.2}s`, opacity: 0.5 } as React.CSSProperties}
          >
            <div className="relative mb-2 h-14 w-14 overflow-hidden">
              <Image
                src={getScientistIdleExpressionSrc(s.id)}
                alt={`${s.name} idle expression`}
                fill
                sizes="56px"
                className="object-contain object-center"
              />
            </div>
            <p className="font-caprasimo text-[10px] text-[var(--tone-cream)]">{s.name}</p>
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 text-center md:flex-row md:items-end md:text-left">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl text-center md:text-left"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest opacity-60">
            The arena awaits
          </p>
          <h2 className="font-caprasimo mt-5 text-5xl leading-none md:text-7xl">
            Enter the arena of
            <br />
            <span style={{ color: "var(--tone-cream)" }}>impossible minds.</span>
          </h2>
          <p className="font-gabarito mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)] md:max-w-xl">
            Pick your scientist. Outsmart your rival. Shatter their base first.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center md:block"
        >
          <Link href="/connect" target="_blank" rel="noreferrer" className="btn-game btn-game-primary font-gabarito">
            <span className="relative z-10">Enter Arena</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative z-10">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
