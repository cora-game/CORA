"use client";

type WalletInspectButtonProps = {
  onClick: () => void;
  label?: string;
};

export function WalletInspectButton({ onClick, label = "Inspect Wallet" }: WalletInspectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="frame-cut frame-cut-sm px-2.5 py-1 font-gabarito text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--tone-cream)] transition hover:-translate-y-0.5"
      style={{
        border: "1px solid rgba(248,214,148,0.32)",
        background: "linear-gradient(145deg, rgba(20,34,28,0.94), rgba(11,20,16,0.96))",
      }}
    >
      {label}
    </button>
  );
}

