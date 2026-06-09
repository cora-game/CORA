"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { IntroOverlay } from "@/components/lobby/IntroOverlay";

const GUEST_ADDRESS_STORAGE_KEY = "cora:guest-address";

function shortWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function writeStoredGuestAddress(address: string) {
  try {
    window.sessionStorage.setItem(GUEST_ADDRESS_STORAGE_KEY, address);
  } catch {
    // Guest mode can still create a fresh address from the lobby if storage is unavailable.
  }
}

export function ConnectWalletScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: connectedAddress, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  // Wallet state isn't known during SSR; gate it on mount to avoid a hydration
  // mismatch (wagmi reports "reconnecting" on the client's first render).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const connecting = mounted && (status === "connecting" || status === "reconnecting");
  const disconnecting = false;
  const [guestBusy, setGuestBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [introOverlayOpen, setIntroOverlayOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !window.localStorage.getItem("cora:introSeen");
    } catch {
      return false;
    }
  });
  const connected = mounted && isConnected && Boolean(connectedAddress);
  const address = connectedAddress ?? "";

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next) return "/lobby";
    if (!next.startsWith("/")) return "/lobby";
    return next;
  }, [searchParams]);

  const handleCloseIntro = useCallback(() => {
    setIntroOverlayOpen(false);
    try {
      window.localStorage.setItem("cora:introSeen", "1");
    } catch {
      // The intro is non-critical; blocked storage should not block arena entry.
    }
  }, []);

  function enterAsGuest() {
    if (guestBusy) return;
    setGuestBusy(true);
    // Guest mode generates a throwaway EVM address (bot practice only — it can't
    // be funded, so it cannot enter wager matches).
    writeStoredGuestAddress(privateKeyToAccount(generatePrivateKey()).address);
    router.push("/lobby?guest=1");
  }

  function connectWallet() {
    if (walletBusy || connecting) return;
    openConnectModal?.();
  }

  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-gradient-to-b from-[#121919] to-[#0a0f0c] px-4 py-8">
      {/* Background World Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Arena Grid */}
        <div className="arena-grid absolute inset-0 opacity-10" />

        {/* Ambient Radial Glows */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-clay)] opacity-15 mix-blend-screen blur-[120px]" />
        <div className="absolute left-[30%] top-[40%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-teal)] opacity-20 blur-[90px]" />
        <div className="absolute right-[30%] top-[60%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-sage)] opacity-10 blur-[100px]" />

        {/* Depth Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.85)_100%)]" />

        {/* Faint CORA "C" Emblem */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[45rem] font-caprasimo text-[var(--tone-cream)] opacity-[0.02] mix-blend-overlay">
          C
        </div>

        {/* Floating Badges / Cards */}
        <div className="animate-float-card absolute left-[15%] top-[25%] -rotate-12 text-5xl opacity-30 drop-shadow-xl">
          🧪
        </div>
        <div
          className="animate-float-card absolute right-[20%] top-[30%] rotate-6 text-6xl opacity-20 drop-shadow-xl"
          style={{ animationDelay: "1s" }}
        >
          🧬
        </div>
        <div
          className="animate-float-card absolute bottom-[20%] left-[25%] rotate-12 text-4xl opacity-40 drop-shadow-xl"
          style={{ animationDelay: "2s" }}
        >
          🔬
        </div>
        <div
          className="animate-float-card absolute bottom-[25%] right-[25%] -rotate-6 text-5xl opacity-20 drop-shadow-xl"
          style={{ animationDelay: "1.5s" }}
        >
          ⚔️
        </div>

        {/* Sparkle Dots / Soft Orbs */}
        <div className="animate-sparkle absolute left-[40%] top-[20%] h-2 w-2 rounded-full bg-[var(--tone-cream)] opacity-40" />
        <div
          className="animate-sparkle absolute bottom-[30%] right-[35%] h-3 w-3 rounded-full bg-[var(--tone-teal)] opacity-50"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="animate-sparkle absolute left-[30%] top-[60%] h-1.5 w-1.5 rounded-full bg-[var(--tone-clay)] opacity-60"
          style={{ animationDelay: "0.5s" }}
        />
      </div>

      {/* Centered Wallet Panel */}
      <section className="relative z-10 w-full max-w-md text-center">
        {/* Outer Glow */}
        <div className="animate-orb-breath absolute -inset-2 rounded-[24px] bg-[var(--tone-clay)] opacity-15 blur-xl" />

        {/* Inner Panel - Dark Game Card */}
        <div className="relative rounded-[20px] border-[4px] border-[var(--tone-bark)] bg-[#172318] p-8 shadow-[0_16px_48px_rgba(0,0,0,0.8)]">
          {/* Inner Frame Accent */}
          <div className="pointer-events-none absolute inset-1.5 rounded-[12px] border border-[rgba(248,214,148,0.15)]" />

          <div className="relative z-10">
            <p className="font-gabarito text-[11px] uppercase tracking-[0.24em] text-[var(--tone-cream)] opacity-80">
              Arena Access
            </p>
            <h1 className="mt-3 font-caprasimo text-4xl leading-none text-[var(--tone-cream)] md:text-5xl">
              Enter the Arena
            </h1>
            {!connected && (
              <p className="mt-4 font-gabarito text-sm text-[#8fa897]">
                Connect a wallet for wager matches, or try a no-stakes practice round.
              </p>
            )}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(248,214,148,0.34)] bg-[rgba(111,58,40,0.22)] px-3 py-1.5 shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f8d694] opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#f8d694]" />
              </span>
              <span className="font-gabarito text-[10px] font-black uppercase tracking-[0.16em] text-[#f8d694]">
                Live on Base Sepolia
              </span>
            </div>

            <div className={`${connected ? "mt-3" : "mt-8"} flex flex-col items-center gap-5`}>
              {!connected && (
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={connectWallet}
                      disabled={walletBusy || connecting}
                      className={`btn-game btn-game-primary min-h-[56px] w-full px-4 text-sm ${
                        walletBusy || connecting ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      {walletBusy || connecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                    <p className="font-gabarito text-[11px] leading-snug text-[#8fa897]">
                      Full queue, deposits, challenges, and on-chain rewards.
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={enterAsGuest}
                      disabled={guestBusy}
                      className={`btn-game btn-game-secondary min-h-[56px] w-full px-4 text-sm ${
                        guestBusy ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      {guestBusy ? "Opening..." : "Enter As Guest"}
                    </button>
                    <p className="font-gabarito text-[11px] leading-snug text-[#8fa897]">
                      Try CORA first. No wallet, deposit, or on-chain payout.
                    </p>
                  </div>
                </div>
              )}
              
              {connected ? (
                <div className="mt-2 flex flex-col items-center gap-5">
                  <div className="rounded-full border border-[var(--tone-teal)] bg-[rgba(60,92,95,0.2)] px-4 py-1.5 shadow-inner">
                    <p className="font-mono text-xs font-semibold tracking-wide text-[var(--tone-mint)]">
                      Wallet synced: {shortWallet(address)}
                    </p>
                  </div>
                  <Link
                    href={nextPath}
                    className="btn-game btn-game-primary w-full min-w-[200px]"
                  >
                    Enter Lobby
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void disconnect();
                    }}
                    disabled={disconnecting}
                    className={`font-gabarito text-xs font-bold uppercase tracking-[0.16em] text-[rgba(244,240,230,0.58)] underline decoration-dotted underline-offset-4 transition hover:text-[rgba(244,240,230,0.88)] ${
                      disconnecting ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect Wallet"}
                  </button>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-[rgba(186,105,49,0.2)] bg-[rgba(186,105,49,0.05)] p-4 shadow-inner">
                  <p className="font-gabarito text-xs leading-relaxed text-[var(--tone-cream)] opacity-70">
                    Guest practice lets you try CORA without a wallet. Connect later for queue, deposits, Blinks, and history.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <IntroOverlay isOpen={introOverlayOpen} onClose={handleCloseIntro} />
    </main>
  );
}
