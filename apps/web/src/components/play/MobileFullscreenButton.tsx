"use client";

import { useCallback, useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isPhoneLandscape() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(orientation: landscape)").matches &&
    window.matchMedia("(max-width: 960px)").matches &&
    window.matchMedia("(max-height: 540px)").matches &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function hasFullscreenSupport() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
}

function getFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement || fullscreenDocument.webkitFullscreenElement || null;
}

export function MobileFullscreenButton() {
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateState = () => {
      setVisible(isPhoneLandscape() && hasFullscreenSupport());
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    updateState();
    window.addEventListener("resize", updateState);
    window.addEventListener("orientationchange", updateState);
    document.addEventListener("fullscreenchange", updateState);
    document.addEventListener("webkitfullscreenchange", updateState);

    return () => {
      window.removeEventListener("resize", updateState);
      window.removeEventListener("orientationchange", updateState);
      document.removeEventListener("fullscreenchange", updateState);
      document.removeEventListener("webkitfullscreenchange", updateState);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenDocument = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;

    if (getFullscreenElement()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        await fullscreenDocument.webkitExitFullscreen?.();
      }
      return;
    }

    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return;
    }

    await root.webkitRequestFullscreen?.();
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className="battle-fullscreen-button frame-cut frame-cut-sm"
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={isFullscreen}
    >
      <span className="battle-fullscreen-button__icon" aria-hidden="true">
        {isFullscreen ? "[-]" : "[ ]"}
      </span>
      <span>{isFullscreen ? "Exit" : "Full"}</span>
    </button>
  );
}
