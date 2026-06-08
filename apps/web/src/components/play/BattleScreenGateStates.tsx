import Link from "next/link";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";

const SCREEN_BACKGROUND =
  "radial-gradient(circle at 50% 24%, rgba(168,143,104,0.2), transparent 46%), linear-gradient(180deg, #26372f 0%, #1a2822 45%, #111a16 100%)";

type MatchContextMissingStateProps = {
  errorMessage: string;
};

export function MatchContextMissingState({ errorMessage }: MatchContextMissingStateProps) {
  return (
    <main className="grid min-h-[100svh] place-items-center px-4" style={{ background: SCREEN_BACKGROUND }}>
      <div
        className="frame-cut w-full max-w-lg p-5 text-center"
        style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(13,24,20,0.9)" }}
      >
        <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Match Context Missing</p>
        <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.82)]">{errorMessage}</p>
        <div className="mt-4">
          <Link
            href="/lobby"
            className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
            style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
          >
            Back To Lobby
          </Link>
        </div>
      </div>
    </main>
  );
}

export function WalletRequiredState() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-4" style={{ background: SCREEN_BACKGROUND }}>
      <div
        className="frame-cut w-full max-w-md p-5 text-center"
        style={{ border: "1px solid rgba(248,214,148,0.35)", background: "rgba(13,24,20,0.9)" }}
      >
        <p className="font-caprasimo text-3xl text-[var(--tone-cream)]">Wallet Required</p>
        <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.82)]">
          Connect Phantom to enter battle and sign match deposit.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <HydratedWalletButton />
          <Link
            href="/lobby"
            className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
            style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
          >
            Back To Lobby
          </Link>
        </div>
      </div>
    </main>
  );
}
