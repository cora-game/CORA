"use client";

import { useEffect, useState } from "react";
import { ChallengeShareActions, ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { createChallengeCardFileName, renderChallengeCardJpg } from "@/lib/challenge/renderChallengeCardJpg";
import { createChallengeTweetIntent } from "@/lib/challenge/createChallengeLink";
import type { ActiveBlinkChallengeSession } from "@/lib/session/matchSession";

type BlinkChallengePanelProps = {
  challenge: ActiveBlinkChallengeSession;
  arenaLabel: string;
  statusLabel: string;
  waitingLabel: string;
  notificationPermission?: NotificationPermission | "unsupported";
  notice?: { text: string; tone: "success" | "error" } | null;
  canClear?: boolean;
  clearLabel?: string;
  onEnableNotifications?: () => void;
  onClose: () => void;
  onClear: () => void;
};

function formatTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function downloadShareFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function BlinkChallengePanel({
  challenge,
  arenaLabel,
  statusLabel,
  waitingLabel,
  notificationPermission = "unsupported",
  notice,
  canClear = false,
  clearLabel = "Clear",
  onEnableNotifications,
  onClose,
  onClear,
}: BlinkChallengePanelProps) {
  const [localNotice, setLocalNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const shareLink = challenge.blinkUrl;
  const token = challenge.token ?? "SOL";
  const wagerUsd = challenge.wagerUsd ?? "1.00";
  const expiresAt = formatTime(challenge.expiresAt);
  const joinDeadline = formatTime(challenge.joinDeadline);
  const shareTitle = "Do you think you can beat me?";
  const helperCopy = "Share the Blink URL to open the challenge in supported apps or the browser challenge page.";
  const description =
    challenge.status === "CHALLENGED" ? "A rival accepted. Join the room before the response window closes." : null;
  const displayNotice = notice ?? localNotice;

  useEffect(() => {
    if (!localNotice) return;
    const id = setTimeout(() => setLocalNotice(null), 5000);
    return () => clearTimeout(id);
  }, [localNotice]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setLocalNotice({ text: `${label} copied.`, tone: "success" });
    } catch {
      setLocalNotice({ text: "Copy failed. Select the link manually.", tone: "error" });
    }
  }

  async function buildShareImageFile() {
    try {
      const input = {
        title: shareTitle,
        challengerAddress: challenge.walletAddress,
        statusLabel,
        description,
        token,
        wagerUsd,
        arenaLabel,
        challengeLink: shareLink,
        showCharacterPortrait: false,
      };
      const blob = await renderChallengeCardJpg(input);
      return new File([blob], createChallengeCardFileName(input), { type: "image/jpeg" });
    } catch {
      setLocalNotice({ text: "Failed to generate JPG. Try again.", tone: "error" });
      return null;
    }
  }

  async function onSaveJpg() {
    const file = await buildShareImageFile();
    if (!file) return;
    downloadShareFile(file);
    setLocalNotice({ text: "Saved challenge card JPG.", tone: "success" });
  }

  async function onShareX() {
    const popup = window.open(
      createChallengeTweetIntent(shareLink, `I am waiting in ${arenaLabel}. Challenge me in CORA.`),
      "_blank",
      "noopener,noreferrer",
    );
    if (!popup) {
      setLocalNotice({ text: "Popup blocked. Allow popups and retry.", tone: "error" });
      return;
    }
    const file = await buildShareImageFile();
    if (file) downloadShareFile(file);
    setLocalNotice({ text: file ? "Opened X. JPG downloaded for attachment." : "Opened X directly.", tone: "success" });
  }

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-[rgba(10,15,12,0.86)] p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl">
        <div className="absolute right-2 top-2 z-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Blink challenge panel"
            className="px-2 py-1 font-gabarito text-lg font-black leading-none text-[rgba(244,240,230,0.82)] transition hover:text-[var(--tone-cream)]"
          >
            x
          </button>
          {canClear && (
            <button type="button" onClick={onClear} className="btn-game btn-game-secondary px-3 py-1.5 text-[10px]">
              {clearLabel}
            </button>
          )}
        </div>
        <div
          className="mb-3 frame-cut px-4 py-3 shadow-2xl"
          style={{ border: "2px solid rgba(248,214,148,0.42)", background: "linear-gradient(145deg, #10231b 0%, #18392d 100%)" }}
        >
          <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.22em] text-[var(--tone-mint)]">
            Active Blink Challenge
          </p>
          <p className="mt-1 font-caprasimo text-2xl text-[var(--tone-cream)]">{waitingLabel}</p>
          <p className="mt-1 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">
            {expiresAt ? `Open until around ${expiresAt}. ` : ""}
            {joinDeadline ? `Join deadline ${joinDeadline}. ` : ""}
            Normal matchmaking is paused until this challenge resolves.
          </p>
          {notificationPermission === "default" && onEnableNotifications && (
            <div className="mt-3">
              <p className="font-gabarito text-xs text-[rgba(244,240,230,0.72)]">
                Enable browser notifications so CORA can alert you when a rival accepts.
              </p>
              <button
                type="button"
                onClick={onEnableNotifications}
                className="mt-2 rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
                style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
              >
                Enable Notifications
              </button>
            </div>
          )}
        </div>
        <p className="mb-3 px-1 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{helperCopy}</p>
        <ChallengeShareCard
          title={shareTitle}
          challengerAddress={challenge.walletAddress}
          arenaLabel={arenaLabel}
          token={token}
          wagerUsd={wagerUsd}
          challengeLink={shareLink}
          description={description}
          statusLabel={statusLabel}
          showCharacterPortrait={false}
        />
        <ChallengeShareActions
          challengeLink={shareLink}
          notice={displayNotice}
          actionCopyLabel="Copy Blink URL"
          onCopy={() => copyText(challenge.blinkUrl, "Blink URL")}
          onSaveJpg={onSaveJpg}
          onShareX={onShareX}
        />
      </div>
    </div>
  );
}
