"use client";

import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const [isVisible, setIsVisible] = useState(false);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isVisible) setIsVisible(true);
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => setIsVisible(false);

    const tick = () => {
      setPosition({ ...targetRef.current });
      frameRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(620px circle at ${position.x}px ${position.y}px, rgba(186,105,49,0.08), transparent 50%)`,
        }}
      />
      <div
        className="pointer-events-none fixed z-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: position.x,
          top: position.y,
          background: "rgba(157,180,150,0.34)",
          boxShadow: "0 0 12px 3px rgba(157,180,150,0.2)",
        }}
      />
    </>
  );
}