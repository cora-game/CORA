"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type HeroLayerEntrance = "fade-rise" | "fade-up" | "rise" | "pop";

type HeroImageLayer = {
  type: "image";
  name: string;
  src: string;
  movement: number;
  direction: number;
  depth: number;
  delay: number;
  entrance: HeroLayerEntrance;
  frameClassName?: string;
  imageClassName?: string;
  objectPosition?: string;
  scale?: number;
};
type HeroLayer = HeroImageLayer;
type HeroDustParticle = {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  opacity: number;
};
type HeroToken = {
  src: string;
  left: string;
  top: string;
  width: string;
  depth: number;
  movement: number;
  direction: number;
  rotation: number;
  driftY: number;
  driftX: number;
  delay: number;
  duration: number;
  opacity: number;
};

const HERO_IMAGE_OVERSCAN = 1.03;
const HERO_POINTER_INPUT_RANGE = [0, 0.36, 0.5, 0.64, 1];
const HERO_POINTER_SENSITIVITY = 0.88;
const HERO_DUST_PARTICLES: HeroDustParticle[] = [
  { left: "-6%", top: "20%", size: 3, duration: 9.2, delay: 0.4, driftX: 84, driftY: 2, opacity: 0.34 },
  { left: "-10%", top: "28%", size: 2, duration: 7.8, delay: 1.2, driftX: 96, driftY: -1, opacity: 0.26 },
  { left: "-8%", top: "36%", size: 4, duration: 10.4, delay: 2.1, driftX: 88, driftY: 1, opacity: 0.3 },
  { left: "-12%", top: "44%", size: 3, duration: 8.6, delay: 0.8, driftX: 92, driftY: -2, opacity: 0.22 },
  { left: "-7%", top: "52%", size: 2, duration: 11.1, delay: 2.8, driftX: 104, driftY: 1, opacity: 0.28 },
  { left: "-9%", top: "60%", size: 3, duration: 9.7, delay: 1.7, driftX: 90, driftY: -1, opacity: 0.24 },
  { left: "-11%", top: "68%", size: 2, duration: 8.9, delay: 3.2, driftX: 98, driftY: 2, opacity: 0.2 },
  { left: "-5%", top: "76%", size: 3, duration: 10.8, delay: 2.5, driftX: 86, driftY: -2, opacity: 0.26 },
];
const HERO_TOKENS: HeroToken[] = [
  {
    src: "/assets/tokens/sol.png",
    left: "19%",
    top: "10%",
    width: "clamp(72px, 8vw, 132px)",
    depth: 9,
    movement: 12,
    direction: 1,
    rotation: -16,
    driftY: -16,
    driftX: 10,
    delay: 0.3,
    duration: 6.2,
    opacity: 1,
  },
  {
    src: "/assets/tokens/bonk.png",
    left: "15%",
    top: "39%",
    width: "clamp(52px, 5.8vw, 94px)",
    depth: 8,
    movement: 11,
    direction: 1,
    rotation: 12,
    driftY: -14,
    driftX: 7,
    delay: 0.8,
    duration: 5.9,
    opacity: 0.88,
  },
  {
    src: "/assets/tokens/pengu.png",
    left: "18%",
    top: "69%",
    width: "clamp(34px, 3.8vw, 60px)",
    depth: 8,
    movement: 9,
    direction: 1,
    rotation: -10,
    driftY: -11,
    driftX: 6,
    delay: 1.4,
    duration: 6.4,
    opacity: 0.76,
  },
  {
    src: "/assets/tokens/mew.png",
    left: "81%",
    top: "17%",
    width: "clamp(50px, 5.6vw, 88px)",
    depth: 8,
    movement: 11,
    direction: 1,
    rotation: 14,
    driftY: -12,
    driftX: -8,
    delay: 1.1,
    duration: 6.8,
    opacity: 0.84,
  },
  {
    src: "/assets/tokens/pepe.png",
    left: "86%",
    top: "46%",
    width: "clamp(34px, 3.8vw, 60px)",
    depth: 8,
    movement: 9,
    direction: 1,
    rotation: -18,
    driftY: -10,
    driftX: -7,
    delay: 0.6,
    duration: 5.7,
    opacity: 0.78,
  },
  {
    src: "/assets/tokens/usdc.png",
    left: "79%",
    top: "72%",
    width: "clamp(36px, 4vw, 62px)",
    depth: 8,
    movement: 8,
    direction: 1,
    rotation: 16,
    driftY: -9,
    driftX: -6,
    delay: 1.9,
    duration: 6,
    opacity: 0.74,
  },
];

const HERO_LAYERS: HeroLayer[] = [
  {
    type: "image",
    name: "base",
    src: "/assets/landing/base.png",
    movement: 0,
    direction: 0,
    depth: 0,
    delay: 0,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "bookcase-3",
    src: "/assets/landing/bookcase_3.png",
    movement: 3,
    direction: -1,
    depth: 1,
    delay: 0.05,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "bookcase-2",
    src: "/assets/landing/bookcase_2.png",
    movement: 7,
    direction: -1,
    depth: 2,
    delay: 0.15,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "title",
    src: "/assets/logo/landscape_warm.png",
    movement: 9,
    direction: 0.45,
    depth: 3,
    delay: 0.28,
    entrance: "fade-up",
    frameClassName:
      "left-1/2 top-[39%] h-[34%] w-[86%] -translate-x-1/2 -translate-y-1/2 md:h-[38%]",
    imageClassName: "object-contain",
    objectPosition: "center center",
    scale: 1,
  },
  {
    type: "image",
    name: "bookcase-1",
    src: "/assets/landing/bookcase_1.png",
    movement: 11,
    direction: 1,
    depth: 4,
    delay: 0.36,
    entrance: "fade-rise",
  },
  {
    type: "image",
    name: "table",
    src: "/assets/landing/table.png",
    movement: 10,
    direction: 0.85,
    depth: 5,
    delay: 0.48,
    entrance: "rise",
  },
  {
    type: "image",
    name: "drawer",
    src: "/assets/landing/drawer.png",
    movement: 16,
    direction: 1,
    depth: 6,
    delay: 0.58,
    entrance: "rise",
  },
  {
    type: "image",
    name: "objects",
    src: "/assets/landing/objects.png",
    movement: 14,
    direction: 1,
    depth: 7,
    delay: 0.7,
    entrance: "pop",
  },
];

const HERO_MOBILE_TOKENS: HeroToken[] = [
  {
    src: "/assets/tokens/sol.png",
    left: "18%",
    top: "18%",
    width: "clamp(42px, 11vw, 60px)",
    depth: 9,
    movement: 6,
    direction: 1,
    rotation: -12,
    driftY: -8,
    driftX: 6,
    delay: 0.2,
    duration: 6.2,
    opacity: 0.96,
  },
  {
    src: "/assets/tokens/bonk.png",
    left: "69%",
    top: "13%",
    width: "clamp(34px, 9vw, 50px)",
    depth: 8,
    movement: 6,
    direction: 1,
    rotation: 10,
    driftY: -8,
    driftX: -5,
    delay: 0.7,
    duration: 5.8,
    opacity: 0.88,
  },
  {
    src: "/assets/tokens/mew.png",
    left: "10%",
    top: "41%",
    width: "clamp(28px, 7.5vw, 42px)",
    depth: 8,
    movement: 5,
    direction: 1,
    rotation: 12,
    driftY: -7,
    driftX: 5,
    delay: 1.1,
    duration: 6.6,
    opacity: 0.8,
  },
  {
    src: "/assets/tokens/pepe.png",
    left: "78%",
    top: "39%",
    width: "clamp(26px, 7vw, 40px)",
    depth: 8,
    movement: 5,
    direction: 1,
    rotation: -14,
    driftY: -6,
    driftX: -4,
    delay: 1.5,
    duration: 5.6,
    opacity: 0.74,
  },
  {
    src: "/assets/tokens/pengu.png",
    left: "20%",
    top: "63%",
    width: "clamp(24px, 6.5vw, 36px)",
    depth: 8,
    movement: 4,
    direction: 1,
    rotation: -8,
    driftY: -5,
    driftX: 4,
    delay: 1.9,
    duration: 6.1,
    opacity: 0.68,
  },
  {
    src: "/assets/tokens/usdc.png",
    left: "73%",
    top: "61%",
    width: "clamp(24px, 6.5vw, 36px)",
    depth: 8,
    movement: 4,
    direction: 1,
    rotation: 14,
    driftY: -5,
    driftX: -4,
    delay: 2.2,
    duration: 5.9,
    opacity: 0.68,
  },
] as const;

const HERO_MOBILE_LAYERS: HeroLayer[] = [
  {
    type: "image",
    name: "bookcase-3-mobile",
    src: "/assets/landing/bookcase_3.png",
    movement: 0,
    direction: 0,
    depth: 0,
    delay: 0.05,
    entrance: "fade-rise",
    imageClassName: "object-cover",
    objectPosition: "center 18%",
    scale: 1.38,
  },
  {
    type: "image",
    name: "title-mobile",
    src: "/assets/logo/landscape_warm.png",
    movement: 4,
    direction: 0.25,
    depth: 4,
    delay: 0.2,
    entrance: "fade-up",
    frameClassName: "left-1/2 top-[42%] h-[26%] w-[94%] -translate-x-1/2 -translate-y-1/2",
    imageClassName: "object-contain",
    objectPosition: "center center",
    scale: 1.12,
  },
  {
    type: "image",
    name: "table-mobile",
    src: "/assets/landing/table.png",
    movement: 5,
    direction: 0.6,
    depth: 6,
    delay: 0.34,
    entrance: "rise",
    imageClassName: "object-cover",
    objectPosition: "center bottom",
    scale: 1.24,
  },
  {
    type: "image",
    name: "objects-mobile",
    src: "/assets/landing/objects.png",
    movement: 7,
    direction: 0.8,
    depth: 7,
    delay: 0.46,
    entrance: "pop",
    imageClassName: "object-cover",
    objectPosition: "center bottom",
    scale: 1.18,
  },
] as const;

const layerInitialByEntrance: Record<
  HeroLayerEntrance,
  { opacity: number; y?: number; scale?: number }
> = {
  "fade-rise": { opacity: 0, y: 22 },
  "fade-up": { opacity: 0, y: 18, scale: 0.96 },
  rise: { opacity: 0, y: 56 },
  pop: { opacity: 0, y: 8, scale: 0.96 },
};

function isImageLayer(layer: HeroLayer): layer is HeroImageLayer {
  return layer.type === "image";
}

function useResponsiveMotionScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const syncScale = () => setScale(mediaQuery.matches ? 0 : 1);

    syncScale();
    mediaQuery.addEventListener("change", syncScale);

    return () => mediaQuery.removeEventListener("change", syncScale);
  }, []);

  return scale;
}

function useIsMobileLanding() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

function HeroLayerView({
  layer,
  pointerX,
  pointerY,
  motionScale,
  shouldReduceMotion,
  ready,
}: {
  layer: HeroLayer;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  motionScale: number;
  shouldReduceMotion: boolean;
  ready: boolean;
}) {
  const movement = shouldReduceMotion ? 0 : layer.movement * motionScale * HERO_POINTER_SENSITIVITY;
  const directedMovement = movement * layer.direction;
  const x = useTransform(pointerX, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 1.08,
    -directedMovement * 0.34,
    0,
    directedMovement * 0.34,
    directedMovement * 1.08,
  ]);
  const y = useTransform(pointerY, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 0.38,
    -directedMovement * 0.14,
    0,
    directedMovement * 0.14,
    directedMovement * 0.38,
  ]);
  const initialState = shouldReduceMotion
    ? { opacity: 0 }
    : layerInitialByEntrance[layer.entrance];
  const initialFilter = shouldReduceMotion
    ? "blur(0px)"
    : layer.entrance === "pop"
      ? "blur(10px)"
      : layer.entrance === "rise"
        ? "blur(14px)"
        : "blur(12px)";
  const animateState = ready ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" } : { ...initialState, filter: initialFilter };
  const transition = shouldReduceMotion
    ? { duration: 0.25, delay: 0 }
    : layer.entrance === "rise"
      ? {
          type: "spring" as const,
          damping: 24,
          stiffness: 92,
          mass: 0.9,
          delay: layer.delay,
        }
      : layer.entrance === "pop"
        ? {
            type: "spring" as const,
            damping: 18,
            stiffness: 120,
            mass: 0.7,
            delay: layer.delay,
          }
        : {
            duration: 0.9,
            delay: layer.delay,
            ease: [0.16, 1, 0.3, 1] as const,
          };

  return (
    <motion.div
      initial={{ ...initialState, filter: initialFilter }}
      animate={animateState}
      transition={transition}
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{
        x,
        y,
        zIndex: layer.depth,
        willChange: "transform, opacity",
      }}
    >
      <div
        className={`absolute inset-0 ${layer.frameClassName ?? ""}`.trim()}
      >
        <Image
          src={layer.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          fill
          priority
          sizes="100vw"
          className={`pointer-events-none select-none ${layer.imageClassName ?? "object-contain"}`.trim()}
          style={{
            objectPosition: layer.objectPosition ?? "center center",
            transform: `scale(${layer.scale ?? HERO_IMAGE_OVERSCAN})`,
          }}
        />
      </div>
    </motion.div>
  );
}

function HeroTokenView({
  token,
  pointerX,
  pointerY,
  motionScale,
  shouldReduceMotion,
  ready,
}: {
  token: HeroToken;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  motionScale: number;
  shouldReduceMotion: boolean;
  ready: boolean;
}) {
  const movement = shouldReduceMotion ? 0 : token.movement * motionScale * HERO_POINTER_SENSITIVITY;
  const directedMovement = movement * token.direction;
  const x = useTransform(pointerX, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 1.02,
    -directedMovement * 0.3,
    0,
    directedMovement * 0.3,
    directedMovement * 1.02,
  ]);
  const y = useTransform(pointerY, HERO_POINTER_INPUT_RANGE, [
    -directedMovement * 0.28,
    -directedMovement * 0.12,
    0,
    directedMovement * 0.12,
    directedMovement * 0.28,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.92, filter: "blur(10px)" }}
      animate={
        ready
          ? { opacity: token.opacity, y: 0, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, y: 26, scale: 0.92, filter: "blur(10px)" }
      }
      transition={{
        duration: shouldReduceMotion ? 0.25 : 0.82,
        delay: shouldReduceMotion ? 0 : token.delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="pointer-events-none absolute"
      style={{
        left: token.left,
        top: token.top,
        width: token.width,
        zIndex: token.depth,
        x,
        y,
        willChange: "transform, opacity",
      }}
    >
      <motion.div
        animate={
          shouldReduceMotion
            ? { y: 0, x: 0, rotate: token.rotation }
            : {
                y: [0, token.driftY, 0],
                x: [0, token.driftX, 0],
                rotate: [token.rotation, token.rotation + 5, token.rotation - 3, token.rotation],
              }
        }
        transition={{
          duration: shouldReduceMotion ? 0.01 : token.duration,
          delay: token.delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative aspect-square"
        style={{
          filter: token.depth >= 8 ? "drop-shadow(0 18px 24px rgba(0,0,0,0.24))" : "drop-shadow(0 10px 18px rgba(0,0,0,0.16))",
        }}
      >
        <Image
          src={token.src}
          alt=""
          aria-hidden="true"
          fill
          sizes="96px"
          className="pointer-events-none select-none object-contain"
        />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const [ready, setReady] = useState(false);
  const motionScale = useResponsiveMotionScale();
  const isMobile = useIsMobileLanding();
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = !!prefersReducedMotion;
  const sectionRef = useRef<HTMLElement | null>(null);
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const activeLayers = isMobile ? HERO_MOBILE_LAYERS : HERO_LAYERS;
  const baseLayer = activeLayers.find(
    (layer): layer is HeroImageLayer => layer.name === "base" && isImageLayer(layer)
  );
  const interactiveLayers = activeLayers.filter((layer) => layer.name !== "base");
  const visibleTokens = isMobile ? HERO_MOBILE_TOKENS : HERO_TOKENS;
  const pointerX = rawX;
  const pointerY = rawY;

  useEffect(() => {
    const activateTimer = window.setTimeout(() => {
      setReady(true);
    }, 24);

    return () => {
      window.clearTimeout(activateTimer);
    };
  }, []);

  useEffect(() => {
    if (shouldReduceMotion || motionScale === 0) {
      rawX.set(0.5);
      rawY.set(0.5);
      return;
    }

    function syncPointer(clientX: number, clientY: number) {
      const section = sectionRef.current;
      if (!section) return;
      const { left, top, width, height } = section.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      rawX.set(Math.min(Math.max((clientX - left) / width, 0), 1));
      rawY.set(Math.min(Math.max((clientY - top) / height, 0), 1));
    }

    function handleWindowPointerMove(event: PointerEvent) {
      syncPointer(event.clientX, event.clientY);
    }

    function handleWindowPointerLeave() {
      rawX.set(0.5);
      rawY.set(0.5);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerleave", handleWindowPointerLeave);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerleave", handleWindowPointerLeave);
    };
  }, [motionScale, rawX, rawY, shouldReduceMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[#090f0d]"
    >
      <div className={`relative left-1/2 mx-auto w-screen -translate-x-1/2 overflow-visible ${isMobile ? "aspect-[4/5]" : "aspect-[4096/2589]"}`}>
        {baseLayer && (
          <motion.div
            initial={{
              ...(shouldReduceMotion ? { opacity: 0 } : layerInitialByEntrance[baseLayer.entrance]),
              filter: shouldReduceMotion ? "blur(0px)" : "blur(14px)",
            }}
            animate={
              ready
                ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                : {
                    ...(shouldReduceMotion ? { opacity: 0 } : layerInitialByEntrance[baseLayer.entrance]),
                    filter: shouldReduceMotion ? "blur(0px)" : "blur(14px)",
                  }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.25, delay: 0 }
                : {
                    duration: 0.9,
                    delay: baseLayer.delay,
                    ease: [0.16, 1, 0.3, 1] as const,
                  }
            }
            className="pointer-events-none absolute inset-0 overflow-visible"
            style={{ zIndex: baseLayer.depth, willChange: "opacity" }}
          >
            <Image
              src={baseLayer.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              fill
              priority
              sizes="100vw"
              className="pointer-events-none select-none object-contain"
              style={{
                objectPosition: "center center",
                transform: `scale(${HERO_IMAGE_OVERSCAN})`,
              }}
            />
          </motion.div>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 2,
            background:
              "radial-gradient(58% 48% at 50% 28%, rgba(246,214,149,0.2) 0%, rgba(246,214,149,0.12) 24%, rgba(246,214,149,0.05) 42%, rgba(246,214,149,0) 72%)",
            mixBlendMode: "screen",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 3,
            background:
              "radial-gradient(42% 34% at 50% 34%, rgba(255,239,200,0.18) 0%, rgba(255,239,200,0.08) 30%, rgba(255,239,200,0) 68%), radial-gradient(28% 26% at 34% 44%, rgba(246,214,149,0.08) 0%, rgba(246,214,149,0) 72%)",
            mixBlendMode: "screen",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 8,
            background:
              "linear-gradient(180deg, rgba(2,5,4,0.16) 0%, rgba(2,5,4,0.02) 26%, rgba(2,5,4,0) 42%, rgba(2,5,4,0.12) 68%, rgba(2,5,4,0.34) 100%), radial-gradient(84% 76% at 50% 54%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.16) 100%)",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 6,
            background:
              "radial-gradient(30% 22% at 52% 52%, rgba(255,244,214,0.12) 0%, rgba(255,244,214,0.05) 36%, rgba(255,244,214,0) 74%), linear-gradient(90deg, rgba(7,14,11,0) 0%, rgba(7,14,11,0.05) 18%, rgba(255,241,204,0.08) 50%, rgba(7,14,11,0.05) 82%, rgba(7,14,11,0) 100%)",
            mixBlendMode: "screen",
          }}
        />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 7 }}>
          {HERO_DUST_PARTICLES.map((particle, index) => (
            <motion.span
              key={`${particle.left}-${particle.top}-${index}`}
              className="absolute rounded-full"
              style={{
                left: particle.left,
                top: particle.top,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background:
                  "radial-gradient(circle, rgba(255,248,228,0.94) 0%, rgba(255,236,194,0.52) 44%, rgba(255,236,194,0) 76%)",
                boxShadow: "0 0 8px rgba(255,236,194,0.14)",
              }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.85 }}
              animate={{
                opacity: [0, particle.opacity, particle.opacity, 0],
                x: [0, particle.driftX * 0.55, particle.driftX],
                y: [0, particle.driftY * 0.5, particle.driftY],
                scale: [0.85, 1, 0.92],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>

        {interactiveLayers.map((layer) => (
          <HeroLayerView
            key={layer.name}
            layer={layer}
            pointerX={pointerX}
            pointerY={pointerY}
            motionScale={motionScale}
            shouldReduceMotion={shouldReduceMotion}
            ready={ready}
          />
        ))}

        {visibleTokens.map((token) => (
          <HeroTokenView
            key={`${token.src}-${token.left}-${token.top}`}
            token={token}
            pointerX={pointerX}
            pointerY={pointerY}
            motionScale={motionScale}
            shouldReduceMotion={shouldReduceMotion}
            ready={ready}
          />
        ))}
      </div>
    </section>
  );
}
