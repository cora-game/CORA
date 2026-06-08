"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const thumbnailBackground = `
  radial-gradient(circle at 18% 22%, rgba(186, 105, 49, 0.35), transparent 40%),
  radial-gradient(circle at 78% 68%, rgba(157, 180, 150, 0.2), transparent 44%),
  linear-gradient(135deg, rgba(157, 180, 150, 0.08), rgba(39, 65, 55, 0.12)),
  linear-gradient(0deg, rgba(15, 26, 20, 0.9), rgba(15, 26, 20, 0.9))
`;

const gameplayVideoUrl =
  "https://res.cloudinary.com/dnnn036jy/video/upload/q_auto/f_auto/v1778563860/GameplayVideo_x1dcyl.mp4";
const gameplayPosterUrl =
  "https://res.cloudinary.com/dnnn036jy/video/upload/so_0,q_auto,f_auto/v1778563860/GameplayVideo_x1dcyl.jpg";

export function VideoSlot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const introOpacity = useTransform(scrollYProgress, [0.05, 0.26, 0.5], [1, 1, 0]);
  const introScale = useTransform(scrollYProgress, [0.05, 0.5], [1.2, 1]);
  const introY = useTransform(scrollYProgress, [0.05, 0.5], ["2%", "-8%"]);

  const boxScale = useTransform(scrollYProgress, [0.2, 0.58], [1.14, 1]);
  const boxOpacity = useTransform(scrollYProgress, [0.18, 0.48], [0, 1]);
  const boxY = useTransform(scrollYProgress, [0.2, 0.58], ["8%", "0%"]);
  const boxBgScale = useTransform(scrollYProgress, [0.2, 0.58], [1.26, 1]);
  const boxExitY = useTransform(scrollYProgress, [0.74, 1], ["0%", "-8%"]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    setIsMuted(false);

    video.play().catch(() => {
      video.muted = true;
      setIsMuted(true);
      void video.play().catch(() => {
        // Ignore autoplay failures. The controls stay available for user interaction.
      });
    });
  }, []);

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  }

  return (
    <section
      id="replay"
      ref={containerRef}
      style={{ position: "relative" }}
      className="relative min-h-[220vh] bg-[radial-gradient(circle_at_10%_76%,rgba(157,180,150,0.14),transparent_44%),radial-gradient(circle_at_84%_24%,rgba(39,65,55,0.35),transparent_40%),linear-gradient(150deg,#0d1811_0%,#0f1a14_50%,#0d1710_100%)]"
    >
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-4 py-14 md:px-8 md:py-16">
        <motion.div
          style={{ opacity: introOpacity, scale: introScale, y: introY, background: thumbnailBackground }}
          className="frame-cut absolute inset-4 -z-10 overflow-hidden border border-[var(--color-border)] md:inset-8"
        >
          <div className="arena-grid absolute inset-0 opacity-35" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,26,20,0.1),rgba(15,26,20,0.7))]" />
        </motion.div>

        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center md:inset-x-8"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Watch the duel flow
          </p>
          <h2 className="font-caprasimo mx-auto mt-4 max-w-5xl text-4xl leading-tight md:text-6xl">
            See how brilliant minds{" "}
            <span className="text-[var(--tone-cream)]">clash in the arena.</span>
          </h2>
        </motion.div>

        <motion.div
          style={{ scale: boxScale, opacity: boxOpacity, y: boxY }}
          className="mx-auto w-full max-w-4xl"
        >
          <motion.div
            style={{ y: boxExitY }}
            className="frame-cut relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_28px_80px_rgba(111,58,40,0.14)]"
          >
            <motion.div
              className="pointer-events-none absolute inset-0 z-0"
              style={{ background: thumbnailBackground, scale: boxBgScale }}
            >
              <div className="arena-grid absolute inset-0 opacity-35" />
            </motion.div>
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,rgba(15,26,20,0.82),rgba(15,26,20,0.96))]" />

            <div className="relative z-10 p-4 md:p-8">
              <div className="frame-cut relative aspect-video w-full overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  poster={gameplayPosterUrl}
                  muted={isMuted}
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  aria-label="Arena gameplay demo"
                >
                  <source src={gameplayVideoUrl} type="video/mp4" />
                </video>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,26,20,0.04),rgba(15,26,20,0.18))]" />
                <button
                  type="button"
                  onClick={toggleMute}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-[rgba(255,248,232,0.22)] bg-[rgba(13,24,17,0.82)] px-4 py-2 font-gabarito text-xs font-bold uppercase tracking-[0.18em] text-[var(--tone-cream)] transition hover:bg-[rgba(13,24,17,0.92)]"
                  aria-label={isMuted ? "Unmute gameplay video" : "Mute gameplay video"}
                >
                  <span aria-hidden="true">{isMuted ? "Sound Off" : "Sound On"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
