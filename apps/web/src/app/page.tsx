"use client";
import { useEffect, useState } from "react";
import { Navbar } from "../components/landing/Navbar";
import { Hero } from "../components/landing/Hero";
import { TokenMarquee } from "../components/landing/TokenMarquee";
import { HowItWorks } from "../components/landing/HowItWorks";
import { Features } from "../components/landing/Features";
import { VideoSlot } from "../components/landing/VideoSlot";
import { CtaBanner } from "../components/landing/CtaBanner";
import { CursorGlow } from "../components/landing/CursorGlow";
import { Footer } from "../components/landing/Footer";
import { LandingIntroLoader } from "../components/landing/LandingIntroLoader";

const NAVBAR_REVEAL_DELAY_MS = 720;

export default function Home() {
  const [sceneKey, setSceneKey] = useState(0);
  const [introComplete, setIntroComplete] = useState(false);
  const [showNavbar, setShowNavbar] = useState(false);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const resetLandingViewport = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          setSceneKey((prev) => prev + 1);
        });
      });
    };

    resetLandingViewport();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetLandingViewport();
      }
    };

    const handlePopState = () => resetLandingViewport();

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (!introComplete) return;

    const revealTimer = window.setTimeout(() => {
      setShowNavbar(true);
    }, NAVBAR_REVEAL_DELAY_MS);

    return () => {
      window.clearTimeout(revealTimer);
    };
  }, [introComplete]);

  return (
    <>
      <LandingIntroLoader
        active={!introComplete}
        onComplete={() => setIntroComplete(true)}
      />

      {introComplete && (
        <>
          <CursorGlow />
          {showNavbar && <Navbar />}

          <main key={sceneKey} className="flex w-full flex-col">
            <Hero />
            <TokenMarquee />
            <Features />
            <HowItWorks />
            <VideoSlot />
            <CtaBanner />
          </main>

          <Footer />
        </>
      )}
    </>
  );
}
