"use client";

import { useEffect, useRef } from "react";

type OneShotAudioOptions = {
  volume?: number;
};

type LoopingAudioOptions = {
  enabled?: boolean;
  loop?: boolean;
  volume?: number;
};

export const GAME_AUDIO = {
  battleMusic: "/assets/audio/music/battle.mp3",
  countdown: "/assets/audio/sfx/countdown.mp3",
  healing: "/assets/audio/sfx/healing.mp3",
  hitted: "/assets/audio/sfx/hitted.mp3",
  hitting: "/assets/audio/sfx/hitting.mp3",
  lose: "/assets/audio/sfx/lose.mp3",
  matched: "/assets/audio/sfx/matched.mp3",
  right: "/assets/audio/sfx/right.mp3",
  win: "/assets/audio/sfx/win.mp3",
  wrong: "/assets/audio/sfx/wrong.mp3",
} as const;

const audioCache = new Map<string, HTMLAudioElement>();
let audioUnlocked = false;

function safelyPlay(audio: HTMLAudioElement) {
  const playback = audio.play();
  if (!playback) return;
  playback.catch(() => {
    // Ignore autoplay and interruption failures. The next user interaction can retry.
  });
}

function getCachedAudio(src: string) {
  let audio = audioCache.get(src);
  if (audio) return audio;

  audio = new Audio(src);
  audio.preload = "auto";
  audioCache.set(src, audio);
  return audio;
}

export function preloadAudio(src: string) {
  if (typeof window === "undefined") return;
  const audio = getCachedAudio(src);
  audio.load();
}

export async function unlockAudioPlayback(sources: readonly string[] = []) {
  if (typeof window === "undefined") return;
  if (audioUnlocked) return;

  const audioToPrime =
    sources.length > 0
      ? sources.map((src) => getCachedAudio(src))
      : [getCachedAudio(GAME_AUDIO.battleMusic)];

  await Promise.all(
    audioToPrime.map(async (audio) => {
      const previousMuted = audio.muted;
      const previousVolume = audio.volume;
      try {
        audio.muted = true;
        audio.volume = 0;
        audio.currentTime = 0;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // If Chrome still refuses here, the normal retry-on-interaction flow remains as backup.
      } finally {
        audio.muted = previousMuted;
        audio.volume = previousVolume;
      }
    }),
  );

  audioUnlocked = true;
}

export function usePreloadedAudio(sources: readonly string[]) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const src of sources) {
      preloadAudio(src);
    }
  }, [sources]);
}

export function playOneShotAudio(src: string, options: OneShotAudioOptions = {}) {
  if (typeof window === "undefined") return;

  const audio = getCachedAudio(src);
  audio.pause();
  audio.currentTime = 0;
  audio.volume = options.volume ?? 1;
  audio.preload = "auto";
  safelyPlay(audio);
}

export function useLoopingAudio(src: string, options: LoopingAudioOptions = {}) {
  const { enabled = true, loop = true, volume = 1 } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    const audio = audioRef.current ?? new Audio(src);
    audioRef.current = audio;
    audio.src = src;
    audio.loop = loop;
    audio.volume = volume;
    audio.preload = "auto";

    let retryAttached = false;

    const tryPlay = () => {
      const playback = audio.play();
      if (!playback) return;
      playback
        .then(() => {
          if (retryAttached) {
            window.removeEventListener("pointerdown", tryPlay);
            window.removeEventListener("keydown", tryPlay);
            retryAttached = false;
          }
        })
        .catch(() => {
          if (retryAttached) return;
          retryAttached = true;
          window.addEventListener("pointerdown", tryPlay, { once: true });
          window.addEventListener("keydown", tryPlay, { once: true });
        });
    };

    tryPlay();

    return () => {
      if (retryAttached) {
        window.removeEventListener("pointerdown", tryPlay);
        window.removeEventListener("keydown", tryPlay);
      }
      audio.pause();
      audio.currentTime = 0;
    };
  }, [enabled, loop, src, volume]);
}
