"use client";

import { useEffect, useState } from "react";

type MobileLandscapeGateProps = {
  title?: string;
  message?: string;
};

function getShouldShowGate() {
  if (typeof window === "undefined") return false;
  const isSmallViewport = window.innerWidth < 960;
  const isPortrait = window.innerHeight > window.innerWidth;
  return isSmallViewport && isPortrait;
}

export function MobileLandscapeGate({
  title = "Rotate to landscape",
  message = "CORA battle is tuned for a wider arena. Turn your phone sideways to continue playing.",
}: MobileLandscapeGateProps) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const updateGate = () => {
      setShouldShow(getShouldShowGate());
    };

    updateGate();
    window.addEventListener("resize", updateGate);
    window.addEventListener("orientationchange", updateGate);

    return () => {
      window.removeEventListener("resize", updateGate);
      window.removeEventListener("orientationchange", updateGate);
    };
  }, []);

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(8,14,11,0.92)] p-5 backdrop-blur-md">
      <div
        className="frame-cut w-full max-w-sm px-5 py-6 text-center shadow-2xl"
        style={{
          border: "2px solid rgba(248,214,148,0.42)",
          background: "linear-gradient(145deg, rgba(16,35,27,0.98) 0%, rgba(24,57,45,0.98) 100%)",
        }}
      >
        <div className="mx-auto flex w-fit items-center justify-center gap-3 rounded-full border border-[rgba(248,214,148,0.24)] bg-[rgba(248,214,148,0.08)] px-4 py-2">
          <span className="text-3xl leading-none text-[var(--tone-cream)]">↺</span>
          <span className="font-gabarito text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tone-cream)]">
            Landscape Recommended
          </span>
        </div>
        <p className="mt-5 font-caprasimo text-3xl text-[var(--tone-cream)]">{title}</p>
        <p className="mt-3 font-gabarito text-sm leading-relaxed text-[rgba(244,240,230,0.82)]">{message}</p>
      </div>
    </div>
  );
}
