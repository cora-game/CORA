"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "#roster", label: "Minds" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#replay", label: "Arena" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setSolid(latest > 60);
  });

  return (
    <motion.nav
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed left-0 right-0 top-0 z-50 px-4 py-3 transition-all duration-500 md:px-6 ${solid
        ? "border-b border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        : "border-b border-transparent"
        }`}
      style={solid ? { backdropFilter: "blur(28px) saturate(140%)", WebkitBackdropFilter: "blur(28px) saturate(140%)", backgroundColor: "rgba(99, 99, 99, 0.55)" } : { backgroundColor: "transparent" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="group flex items-center" aria-label="Cora home">
          <Image
            src="/assets/logo/landscape_warm.png"
            alt="Cora"
            width={175}
            height={44}
            priority
            className="h-9 w-auto md:h-10"
          />
        </Link>

        <div
          className="relative hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHovered(null)}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHovered(link.href)}
              className="font-gabarito relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/80 transition-colors duration-150 hover:text-white"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
            >
              <AnimatePresence>
                {hovered === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_20px_rgba(111,58,40,0.1)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              <span className="relative">{link.label}</span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-[rgba(18,29,23,0.62)] text-[#f4f0e6] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-[rgba(27,42,34,0.82)] md:hidden"
        >
          <span className="sr-only">Menu</span>
          <div className="flex flex-col gap-1.5">
            <span className={`block h-0.5 w-5 rounded-full bg-current transition ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 rounded-full bg-current transition ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>

        <Link
          href="/connect"
          target="_blank"
          rel="noreferrer"
          className="hidden md:inline-flex"
          aria-hidden="true"
          tabIndex={-1}
        >
          <span
            className="btn-game btn-game-primary font-gabarito !px-5 !py-2 !text-sm"
            style={{ borderWidth: "2px" }}
          >
            <span className="relative z-10">Enter Arena</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative z-10"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </Link>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-3 max-w-7xl md:hidden"
          >
            <div className="frame-cut overflow-hidden border border-white/10 bg-[rgba(16,24,20,0.88)] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl px-4 py-3 font-gabarito text-sm font-bold uppercase tracking-[0.16em] text-[#f4f0e6] transition hover:bg-white/6"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <Link
                href="/connect"
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="btn-game btn-game-primary mt-3 flex w-full justify-center !px-5 !py-3 !text-sm"
                style={{ borderWidth: "2px" }}
              >
                <span className="relative z-10">Enter Arena</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative z-10"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
