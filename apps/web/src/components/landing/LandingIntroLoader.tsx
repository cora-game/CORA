"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LANDING_SCIENTISTS } from "./content";
import {
  getLandingIntroPreloadSources,
  getScientistIdleExpressionSrc,
} from "./heroAssets";

const LANDING_INTRO_MIN_MS = 1500;

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export function LandingIntroLoader({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = !!prefersReducedMotion;
  const [assetsReady, setAssetsReady] = useState(false);
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const minDelayTimer = window.setTimeout(() => {
      if (!cancelled) {
        setMinDelayElapsed(true);
      }
    }, LANDING_INTRO_MIN_MS);

    Promise.all(getLandingIntroPreloadSources().map(preloadImage)).then(() => {
      if (!cancelled) {
        setAssetsReady(true);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(minDelayTimer);
    };
  }, [active]);

  useEffect(() => {
    if (active && assetsReady && minDelayElapsed) {
      onComplete();
    }
  }, [active, assetsReady, minDelayElapsed, onComplete]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="landing-intro-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.45,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="fixed inset-0 z-[120] overflow-hidden bg-black"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_54%,rgba(248,214,148,0.08),rgba(0,0,0,0)_34%)]" />
          <div className="flex min-h-screen w-full items-center justify-center px-6">
            <div className="relative flex items-center justify-center gap-4 sm:gap-8">
              {LANDING_SCIENTISTS.map((scientist, index) => (
                <motion.div
                  key={scientist.id}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 12, scale: 0.96 }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1, y: 0, scale: 1 }
                      : {
                          opacity: 1,
                          y: [0, -10, 0],
                          scale: [1, 1.04, 1],
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.2 }
                      : {
                          duration: 1.2,
                          delay: index * 0.14,
                          repeat: Number.POSITIVE_INFINITY,
                          repeatType: "mirror",
                          ease: "easeInOut",
                        }
                  }
                  className="relative h-[94px] w-[94px] shrink-0 sm:h-[132px] sm:w-[132px] md:h-[168px] md:w-[168px]"
                >
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(248,214,148,0.22),rgba(248,214,148,0)_68%)] blur-xl" />
                  <Image
                    src={getScientistIdleExpressionSrc(scientist.id)}
                    alt={`${scientist.name} idle expression`}
                    width={168}
                    height={168}
                    sizes="(max-width: 640px) 94px, (max-width: 768px) 132px, 168px"
                    className="relative h-full w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.45)]"
                    priority
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
