"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { RoomPhaseHeader } from "./RoomPhaseHeader";
import type { RoomPhase } from "./roomPhaseTypes";

type RoomPhaseShellProps = {
  phase: RoomPhase;
  title?: ReactNode;
  subtitle?: ReactNode;
  preHeadingSlot?: ReactNode;
  statusSlot?: ReactNode;
  rightPanelSlot?: ReactNode;
  children: ReactNode;
  footerSlot?: ReactNode;
  className?: string;
  withTransition?: boolean;
  hideTitleBlock?: boolean;
};

const PHASE_TRANSITION = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
};

function ShellContent({
  phase,
  title,
  subtitle,
  preHeadingSlot,
  statusSlot,
  rightPanelSlot,
  children,
  footerSlot,
  className,
  hideTitleBlock,
}: Omit<RoomPhaseShellProps, "withTransition">) {
  return (
    <div className={`mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-4 py-5 text-[#1f2b24] md:px-6 md:py-6 ${className ?? ""}`}>
      <RoomPhaseHeader
        phase={phase}
        title={title}
        subtitle={subtitle}
        preHeadingSlot={preHeadingSlot}
        statusSlot={statusSlot}
        rightPanelSlot={rightPanelSlot}
        hideTitleBlock={hideTitleBlock}
      />

      <main className="flex flex-1 flex-col">{children}</main>

      {footerSlot ? <footer className="mt-5">{footerSlot}</footer> : null}
    </div>
  );
}

export function RoomPhaseShell({
  withTransition = true,
  ...props
}: RoomPhaseShellProps) {
  if (!withTransition) {
    return <ShellContent {...props} />;
  }

  return (
    <motion.div
      variants={PHASE_TRANSITION}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10"
    >
      <ShellContent {...props} />
    </motion.div>
  );
}
