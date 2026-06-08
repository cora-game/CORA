import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CORA - History",
  description: "Match history is coming soon to CORA.",
};

export default function HistoryPage() {
  return (
    <main
      className="min-h-[100svh] px-4 py-6 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-4xl items-center justify-center">
        <section
          className="frame-cut w-full max-w-2xl p-6 md:p-8"
          style={{
            border: "1px solid rgba(248,214,148,0.24)",
            background: "linear-gradient(160deg, rgba(22,34,29,0.94), rgba(14,22,18,0.98))",
            boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          }}
        >
          <p className="font-gabarito text-[11px] uppercase tracking-[0.22em] text-[rgba(244,240,230,0.72)]">
            Match Records
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl text-[var(--tone-cream)] md:text-5xl">
            History Coming Soon
          </h1>
          <p className="mt-3 max-w-xl font-gabarito text-sm leading-6 text-[rgba(244,240,230,0.84)] md:text-base">
            We&apos;re still polishing wallet and arena match history. This page will come online once the full
            experience is ready.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                borderColor: "rgba(248,214,148,0.32)",
                background: "rgba(16,26,22,0.72)",
                color: "#f4f0e6",
              }}
            >
              Under Construction
            </span>
            <span
              className="rounded-full border px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                borderColor: "rgba(248,214,148,0.3)",
                background: "rgba(16,26,22,0.72)",
                color: "#d8ead4",
              }}
            >
              Wallet + Arena Views
            </span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/lobby"
              className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
              style={{
                border: "1px solid rgba(248,214,148,0.32)",
                color: "var(--tone-cream)",
                background: "rgba(19,32,26,0.9)",
              }}
            >
              Back To Lobby
            </Link>
            <Link
              href="/"
              className="font-gabarito text-[11px] font-bold uppercase tracking-wide text-[rgba(244,240,230,0.78)] underline underline-offset-4"
            >
              Return Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

