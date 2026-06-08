"use client";

import type { ReactNode } from "react";
import type { DepositStatus } from "./depositTypes";
import { DEPOSIT_STATUS_META } from "./depositTypes";

type DepositStatusCardProps = {
  status: DepositStatus;
  helperText?: string;
  countdownSeconds?: number;
  countdownSlot?: ReactNode;
  signature?: string | null;
  walletSlot?: ReactNode;
  retrySlot?: ReactNode;
  cancelSlot?: ReactNode;
};

export function DepositStatusCard({
  status,
  helperText,
  countdownSeconds,
  countdownSlot,
  signature,
  walletSlot,
  retrySlot,
  cancelSlot,
}: DepositStatusCardProps) {
  const meta = DEPOSIT_STATUS_META[status];
  const showCountdown = typeof countdownSeconds === "number" && countdownSeconds >= 0;
  const showSignature = Boolean(signature);
  const showActions = Boolean(retrySlot || cancelSlot);
  const showWalletSlot = Boolean(walletSlot);

  return (
    <div
      className="frame-cut relative w-full max-w-xl overflow-hidden p-4"
      style={{
        border: "1px solid rgba(248,214,148,0.24)",
        background:
          "linear-gradient(145deg, rgba(15,35,27,0.96), rgba(8,18,14,0.96))",
        boxShadow: "0 14px 26px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(248,214,148,0.08),transparent_48%)]" />
      <div className="relative">
        <p className="font-gabarito text-[11px] uppercase tracking-[0.16em] text-[#f8d694]">{meta.label}</p>
        <p className="mt-1 font-gabarito text-sm text-[rgba(203,227,193,0.9)]">{helperText ?? meta.helper}</p>

        {showCountdown && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="font-caprasimo text-5xl text-[#f8d694] drop-shadow-[0_4px_10px_rgba(0,0,0,0.38)]">
              {countdownSeconds}
            </p>
            {countdownSlot ? <div>{countdownSlot}</div> : null}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {showSignature ? (
            <div
              className="rounded-md border border-[rgba(248,214,148,0.2)] bg-[rgba(6,14,11,0.58)] px-2.5 py-2"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <p className="break-all font-gabarito text-[11px] text-[rgba(203,227,193,0.74)]">
                Signature: {signature}
              </p>
            </div>
          ) : null}

          {showWalletSlot ? <div>{walletSlot}</div> : null}

          {showActions ? (
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              {retrySlot}
              {cancelSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
