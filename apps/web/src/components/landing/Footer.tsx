"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="border-t border-[var(--color-border)] bg-[var(--background)] px-4 py-12 md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="relative h-10 w-[140px]">
            <Image
              src="/assets/logo/landscape_warm.png"
              alt="Cora"
              fill
              sizes="140px"
              className="object-contain object-left"
            />
          </div>
          <p className="font-gabarito mt-2 text-sm text-[var(--color-muted)]">
            © 2026 Cora. Cognitive arena.
          </p>
        </div>

        <div className="font-gabarito flex flex-wrap items-center gap-6 text-sm font-bold text-[var(--color-muted)]">
          {[
            { label: "Discord", href: "#" },
            { label: "X / Twitter", href: "#" },
            { label: "Docs", href: "#" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors duration-150 hover:text-[var(--accent-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </motion.footer>
  );
}
