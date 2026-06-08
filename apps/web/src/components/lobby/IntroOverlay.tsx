"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type IntroOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PanelData = {
  title: string;
  copy: string;
  assetUrl: string;
};

const PANELS: PanelData[] = [
  {
    title: "Set Up Devnet",
    copy: "Connect your wallet, switch to Solana Devnet, and grab faucet SOL so wager matches can sign safely while you test CORA.",
    assetUrl: "/assets/intro/intro-wallet-devnet.webm",
  },
  {
    title: "Play Cards",
    copy: "Pick attack or heal cards from your hand, then answer fast-paced multiple choice questions to trigger their powerful effects and dominate the arena!",
    assetUrl: "/assets/intro/intro-cards.webm",
  },
  {
    title: "Beat The Timer",
    copy: "Speed is everything! Questions are timed, and the entire match runs on a global clock. Think fast, answer correctly, and keep your pressure up!",
    assetUrl: "/assets/intro/intro-timer.webm",
  },
  {
    title: "Practice Or Wager",
    copy: "Choose your path. Warm up in free practice bot matches without a wallet, or deposit a token wager to battle real rivals and win the pool!",
    assetUrl: "/assets/intro/intro-practice-wager.webm",
  },
];

const INTRO_VIDEO_HOLD_MS = 1_000;

export function IntroOverlay({ isOpen, onClose }: IntroOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [assetsAvailable, setAssetsAvailable] = useState<Record<string, boolean>>({});

  // Dynamic asset availability check
  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => setCurrentStep(0));
    const checkAssets = async () => {
      const results: Record<string, boolean> = {};
      for (const panel of PANELS) {
        try {
          const res = await fetch(panel.assetUrl, { method: "HEAD" });
          results[panel.assetUrl] = res.ok;
        } catch {
          results[panel.assetUrl] = false;
        }
      }
      setAssetsAvailable(results);
    };
    void checkAssets();
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < PANELS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md intro-overlay-backdrop"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="intro-overlay-modal frame-cut relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          style={{
            border: "2px solid rgba(248, 214, 148, 0.42)",
            background: "linear-gradient(150deg, #10231b 0%, #0d1a14 100%)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
          }}
        >
          {/* Top border highlight glow */}
          <div className="intro-overlay-glow absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--tone-mint,#cbefc1)] to-transparent opacity-60" />

          {/* Content Body Grid */}
          <div className="intro-overlay-grid grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
            {/* Visual Panel Area - Left 7 columns */}
            <div className="intro-overlay-visual col-span-1 md:col-span-7 relative flex items-center justify-center min-h-[300px] md:min-h-0 bg-black/40 border-b md:border-b-0 md:border-r border-white/10 p-6">
              {assetsAvailable[PANELS[currentStep].assetUrl] ? (
                // Play Real Asset if Available
                <div className="intro-overlay-video-wrapper relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 shadow-lg">
                  <IntroPanelVideo
                    key={PANELS[currentStep].assetUrl}
                    src={PANELS[currentStep].assetUrl}
                    title={PANELS[currentStep].title}
                  />
                </div>
              ) : (
                // Beautiful Premium Animated CSS/SVG fallback Mockup
                <div className="intro-overlay-mockup-wrapper relative w-full max-w-[480px] aspect-video rounded-lg overflow-hidden border border-white/10 bg-[#0d1612] shadow-2xl flex flex-col justify-between">
                  <div className="absolute inset-0 arena-grid opacity-10 pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

                  {/* Fallback 0: Wallet / Devnet Mockup */}
                  {currentStep === 0 && (
                    <WalletDevnetMockup />
                  )}

                  {/* Fallback 1: Play Cards Mockup */}
                  {currentStep === 1 && (
                    <PlayCardsMockup />
                  )}

                  {/* Fallback 2: Beat The Timer Mockup */}
                  {currentStep === 2 && (
                    <TimerMockup />
                  )}

                  {/* Fallback 3: Practice or Wager Mockup */}
                  {currentStep === 3 && (
                    <WagerMockup />
                  )}
                </div>
              )}
            </div>

            {/* Copy / Action Area - Right 5 columns */}
            <div className="intro-overlay-content col-span-1 md:col-span-5 flex flex-col justify-between p-6 md:p-8">
              <div className="intro-overlay-text-wrapper space-y-4">
                <div className="intro-overlay-step-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--tone-mint,#cbefc1)]/20 bg-[var(--tone-mint,#cbefc1)]/5">
                  <span className="intro-overlay-step-pill-dot h-2 w-2 rounded-full bg-[var(--tone-mint,#cbefc1)] animate-pulse" />
                  <span className="intro-overlay-step-pill-text font-gabarito text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tone-mint,#cbefc1)]">
                    Step {currentStep + 1} of {PANELS.length}
                  </span>
                </div>

                <h2 className="intro-overlay-title font-caprasimo text-3xl text-white leading-tight">
                  {PANELS[currentStep].title}
                </h2>

                <p className="intro-overlay-copy font-gabarito text-sm leading-relaxed text-[var(--tone-cream,#f3efe7)]/80">
                  {PANELS[currentStep].copy}
                </p>
              </div>

              {/* Navigation Stack */}
              <div className="intro-overlay-nav mt-8 space-y-4">
                <div className="intro-overlay-nav-flex flex items-center justify-between gap-3">
                  {/* Step indicators */}
                  <div className="intro-overlay-dots-container flex gap-2">
                    {PANELS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentStep(idx)}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          idx === currentStep
                            ? "w-6 bg-[var(--tone-mint,#cbefc1)]"
                            : "w-2.5 bg-white/20 hover:bg-white/40"
                        }`}
                        aria-label={`Go to step ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <div className="intro-overlay-btn-group flex items-center gap-2">
                    {currentStep < PANELS.length - 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSkip}
                          className="px-3 py-2 font-gabarito text-xs font-bold uppercase tracking-wide text-white/50 transition-colors hover:text-white"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={handleNext}
                          className="btn-game btn-game-primary px-6 py-2.5 text-xs shadow-md"
                        >
                          Next
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-game btn-game-primary px-6 py-3 text-xs shadow-lg"
                      >
                        Enter Arena
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function IntroPanelVideo({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [src]);

  function handleLoadedData() {
    const video = videoRef.current;
    if (!video) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    video.pause();
    video.currentTime = 0;

    holdTimerRef.current = setTimeout(() => {
      if (!videoRef.current) return;
      void videoRef.current.play().catch(() => {
        // Muted inline playback should be allowed; if not, the first frame remains visible.
      });
    }, INTRO_VIDEO_HOLD_MS);
  }

  function handleEnded() {
    const video = videoRef.current;
    if (!video) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    video.pause();

    holdTimerRef.current = setTimeout(() => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => {
        // Keep the final frame visible if replay is blocked.
      });
    }, INTRO_VIDEO_HOLD_MS);
  }

  return (
    <video
      ref={videoRef}
      src={src}
      aria-label={title}
      muted
      playsInline
      preload="auto"
      onLoadedData={handleLoadedData}
      onEnded={handleEnded}
      className="h-full w-full object-cover"
    />
  );
}

/* Fallback 0: Wallet / Devnet Setup Mockup */
function WalletDevnetMockup() {
  return (
    <div className="wallet-mockup relative flex h-full w-full flex-col justify-between overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(248,214,148,0.16),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(203,239,193,0.12),transparent_38%)]" />

      <div className="wallet-mockup-header relative flex items-center justify-between">
        <div>
          <p className="font-gabarito text-[9px] font-black uppercase tracking-[0.18em] text-[#f8d694]">
            Wallet Setup
          </p>
          <p className="mt-1 font-caprasimo text-lg text-white">Ready For Devnet</p>
        </div>
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="rounded-full border border-[var(--tone-mint,#cbefc1)]/30 bg-[var(--tone-mint,#cbefc1)]/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--tone-mint,#cbefc1)]"
        >
          Devnet
        </motion.div>
      </div>

      <div className="wallet-mockup-body relative grid flex-1 place-items-center">
        <div className="wallet-mockup-card w-full max-w-[340px] rounded-xl border border-white/10 bg-black/45 p-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[linear-gradient(145deg,#6f3a28,#f8d694)]" />
              <div>
                <p className="font-gabarito text-xs font-bold text-white">Phantom Wallet</p>
                <p className="font-mono text-[9px] text-white/45">HpuHN...6YNC</p>
              </div>
            </div>
            <span className="rounded-full bg-[var(--tone-mint,#cbefc1)]/12 px-2 py-1 font-mono text-[8px] font-bold text-[var(--tone-mint,#cbefc1)]">
              Connected
            </span>
          </div>

          <div className="wallet-mockup-steps mt-4 space-y-3">
            {[
              ["Connect wallet", "Done"],
              ["Switch network", "Devnet"],
              ["Faucet SOL", "+2 SOL"],
            ].map(([label, value], index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0.45, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.2, repeat: Infinity, repeatDelay: 2.2, duration: 0.35 }}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="font-gabarito text-[11px] font-bold text-white/80">{label}</span>
                <span className="font-mono text-[9px] font-black uppercase tracking-wide text-[#f8d694]">{value}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Fallback 1: Play Cards Animated Mockup */
function PlayCardsMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col justify-between w-full h-full p-4 overflow-hidden">
      {/* Opponent Card base */}
      <div className="flex justify-between items-center bg-black/40 border border-white/5 rounded p-2 text-left">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f8d694,transparent)] border border-[#f8d694]/40" />
          <div>
            <div className="text-[10px] font-bold text-white/90 font-gabarito">Rival AI</div>
            <div className="text-[9px] text-[#f8d694] font-mono">HP: 80/100</div>
          </div>
        </div>
        <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: step === 3 ? "70%" : "80%" }}
            className="h-full bg-gradient-to-r from-red-500 to-orange-400"
          />
        </div>
      </div>

      {/* Screen action center */}
      <div className="flex-grow flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-[10px] font-mono text-white/50 tracking-wider font-bold"
            >
              YOUR TURN: PICK A CARD
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/80 border border-white/10 p-2.5 rounded shadow-xl max-w-[260px] text-center"
            >
              <div className="text-[9px] font-black uppercase text-[var(--tone-mint)] font-mono tracking-wider mb-1">
                Trigger Attack
              </div>
              <div className="text-[10px] text-white font-gabarito mb-1.5 leading-snug">
                Which scientist formulated the laws of motion?
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="border border-white/10 rounded p-1 text-[8px] font-mono text-white/40">Albert Einstein</div>
                <div className="border border-[var(--tone-mint)]/40 bg-[var(--tone-mint)]/10 rounded p-1 text-[8px] font-mono text-[var(--tone-mint)] font-bold">
                  Isaac Newton
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {/* Laser trail */}
              <motion.div
                initial={{ y: 80, height: 10, opacity: 1 }}
                animate={{ y: -80, height: 40, opacity: [1, 1, 0] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-1 bg-gradient-to-t from-[var(--tone-mint)] to-white rounded-full shadow-[0_0_8px_#cbefc1]"
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 2.5, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="absolute top-8 w-8 h-8 rounded-full bg-[var(--tone-mint)]/40 blur-sm"
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: -40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="font-caprasimo text-xl text-red-400 font-bold"
            >
              -10 HP!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating cursor */}
        {step === 0 && (
          <motion.div
            animate={{ x: [50, 0], y: [60, 40], scale: [1, 0.9, 1] }}
            transition={{ duration: 1.2, repeat: 0 }}
            className="absolute z-10 w-4 h-4 text-[var(--tone-mint)] pointer-events-none drop-shadow-md"
            style={{ left: "55%", top: "45%" }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M4 2l16 11.5-6.5 1.5 5 8-3.5 2-5-8.5L4 18V2z" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Hand of 3 Cards */}
      <div className="flex gap-2 justify-center items-end h-16 pt-1">
        {/* Card 1 */}
        <motion.div
          animate={{
            y: step === 0 ? [0, -4, 0] : 0,
            scale: step === 0 ? 1 : 0.95,
            borderColor: step === 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.15)",
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-14 h-14 bg-gradient-to-t from-emerald-950/80 to-emerald-900/60 border border-emerald-500/30 rounded flex flex-col justify-between p-1 text-[8px] font-bold text-center"
        >
          <div className="text-emerald-400 font-mono text-[6px]">HEAL</div>
          <div className="text-white/80 font-gabarito leading-none">Recover +15</div>
        </motion.div>

        {/* Card 2 (Target of selection) */}
        <motion.div
          animate={{
            y: step === 0 ? 0 : step === 1 ? -12 : step === 2 ? [ -12, 0 ] : 0,
            scale: step === 1 ? 1.15 : 1,
            borderColor: step === 1 ? "rgba(203,239,193,0.8)" : "rgba(255,255,255,0.15)",
            boxShadow: step === 1 ? "0 0 12px rgba(203,239,193,0.3)" : "none",
          }}
          className="w-16 h-16 bg-gradient-to-t from-red-950/90 to-red-900/60 border border-red-500/30 rounded flex flex-col justify-between p-1.5 text-[8px] font-bold text-center z-10"
        >
          <div className="text-red-400 font-mono text-[6px] tracking-wide">ATTACK</div>
          <div className="text-white font-gabarito leading-none">Attack -10</div>
        </motion.div>

        {/* Card 3 */}
        <div className="w-14 h-14 bg-gradient-to-t from-emerald-950/80 to-emerald-900/60 border border-emerald-500/30 rounded flex flex-col justify-between p-1 text-[8px] font-bold text-center opacity-70">
          <div className="text-emerald-400 font-mono text-[6px]">HEAL</div>
          <div className="text-white/80 font-gabarito leading-none">Recover +15</div>
        </div>
      </div>
    </div>
  );
}

/* Fallback 2: Beat The Timer Animated Mockup */
function TimerMockup() {
  const [seconds, setSeconds] = useState(10);
  const [correctFlash, setCorrectFlash] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          // Trigger correct answer flash animation and reset timer
          setCorrectFlash(true);
          setTimeout(() => setCorrectFlash(false), 900);
          return 10;
        }
        return prev - 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, []);

  const strokeColor =
    correctFlash
      ? "#cbefc1" // teal success
      : seconds > 5
      ? "#34d399" // green
      : seconds > 2
      ? "#fbbf24" // warning yellow
      : "#ef4444"; // critical red

  // SVG dash circle properties
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (seconds / 10) * circumference;

  return (
    <div className="relative flex items-center justify-between w-full h-full p-6">
      {/* Question Card Block */}
      <div className="flex-grow max-w-[240px] bg-black/60 border border-white/10 rounded p-3 text-left">
        <div className="text-[9px] font-bold text-[#f8d694] font-mono tracking-wider mb-1">
          BATTLE FIELD QUESTION
        </div>
        <div className="text-[11px] text-white/90 font-gabarito leading-snug mb-2 font-medium">
          What is the approximate speed of light?
        </div>
        <div className="space-y-1">
          <div className="border border-white/5 rounded p-1 text-[8px] font-mono text-white/40">150,000 km/s</div>
          <motion.div
            animate={{
              borderColor: correctFlash ? "rgba(203,239,193,0.8)" : "rgba(255,255,255,0.05)",
              background: correctFlash ? "rgba(203,239,193,0.15)" : "transparent",
            }}
            className="border border-white/5 rounded p-1 text-[8px] font-mono text-white/80"
          >
            300,000 km/s
          </motion.div>
        </div>
      </div>

      {/* Clock Panel on Right */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Animated Ring */}
          <svg className="absolute w-full h-full -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-white/5 fill-none"
              strokeWidth="4"
            />
            <motion.circle
              cx="40"
              cy="40"
              r={radius}
              className="fill-none transition-all duration-300"
              stroke={strokeColor}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Numeric Tick */}
          <motion.div
            animate={{
              scale: seconds <= 2 && !correctFlash ? [1, 1.2, 1] : 1,
              color: strokeColor,
            }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="font-caprasimo text-xl font-bold"
          >
            {correctFlash ? "✓" : seconds}
          </motion.div>
        </div>
        <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-black">
          {correctFlash ? "CORRECT!" : seconds <= 2 ? "HURRY!" : "SECONDS"}
        </div>
      </div>
    </div>
  );
}

/* Fallback 3: Practice or Wager Mockup */
function WagerMockup() {
  return (
    <div className="grid grid-cols-2 gap-4 w-full h-full p-4 items-center">
      {/* Practice Option */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="h-full border border-white/10 bg-[#121915]/60 hover:bg-[#121915]/90 rounded p-2.5 flex flex-col justify-between text-center transition-colors group"
      >
        <div className="mx-auto w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-lg">
          🤖
        </div>
        <div>
          <div className="text-[11px] font-bold text-white font-gabarito">Free Practice</div>
          <div className="text-[8px] text-[var(--tone-cream,#f3efe7)]/60 font-mono mt-0.5">
            VS. BOT RIVAL
          </div>
        </div>
        <div className="space-y-0.5 text-[8px] text-white/50 text-left font-gabarito bg-black/20 p-1 rounded">
          <div>· No wallet needed</div>
          <div>· Master the deck</div>
          <div>· Zero stakes</div>
        </div>
        <div className="text-[8px] font-black uppercase text-emerald-400 font-mono tracking-wider">
          Safe Playground
        </div>
      </motion.div>

      {/* Wager Option */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="relative h-full border border-[var(--tone-mint,#cbefc1)]/30 bg-[#16271c]/70 hover:bg-[#16271c]/90 rounded p-2.5 flex flex-col justify-between text-center transition-colors overflow-hidden group shadow-lg"
      >
        {/* Animated sheen overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

        <div className="mx-auto w-10 h-10 rounded-full border border-[var(--tone-mint,#cbefc1)]/40 bg-[var(--tone-mint,#cbefc1)]/10 flex items-center justify-center text-lg text-[var(--tone-mint)] shadow-[0_0_8px_rgba(203,239,193,0.2)]">
          ◎
        </div>
        <div>
          <div className="text-[11px] font-bold text-white font-gabarito">Wager Match</div>
          <div className="text-[8px] text-[var(--tone-mint)] font-mono mt-0.5">
            VS. REAL RIVALS
          </div>
        </div>
        <div className="space-y-0.5 text-[8px] text-white/70 text-left font-gabarito bg-emerald-950/40 p-1 border border-emerald-900/20 rounded">
          <div>· Double your wager</div>
          <div>· Solana escrows</div>
          <div>· Instant payouts</div>
        </div>
        <div className="text-[8px] font-black uppercase text-[var(--tone-mint)] font-mono tracking-wider">
          Competitive Arena
        </div>
      </motion.div>
    </div>
  );
}
