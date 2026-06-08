"use client";

type HistoryButtonProps = {
  onClick?: () => void;
  href?: string;
  label?: string;
  comingSoon?: boolean;
};

const SHARED_CLASSNAME =
  "frame-cut frame-cut-sm inline-flex items-center gap-2 px-3 py-2 font-gabarito text-xs font-bold uppercase tracking-wider text-[var(--tone-cream)] opacity-90 shadow-lg";
const SHARED_STYLE = {
  border: "2px solid var(--tone-bark)",
  background: "linear-gradient(180deg, #1b3429 0%, #14271f 100%)",
  boxShadow: "inset 0 1px 0 rgba(203,227,193,0.2)",
} as const;

export function HistoryButton({ onClick, label = "Match History", comingSoon = true }: HistoryButtonProps) {
  if (comingSoon) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${SHARED_CLASSNAME} cursor-not-allowed opacity-60 grayscale`}
        style={SHARED_STYLE}
      >
        {label}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className={SHARED_CLASSNAME} style={SHARED_STYLE}>
      {label}
    </button>
  );
}

