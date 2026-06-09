import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChallengeShareActions, ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";
import { MatchResultShareCard } from "@/components/play/MatchResultShareCard";
import type { ActiveBlinkChallengeSession } from "@/lib/session/matchSession";

type SettlementPayload = {
  matchId: string;
  serverAddress: string;
  settlementSignature: string;
} | null;

type ShareNotice = {
  text: string;
  tone: "success" | "error";
} | null;

type SettlementEmojiMood = {
  player: "confident" | "hurt";
  opponent: "confident" | "hurt";
} | null;

type SettlementExpressionSrc = {
  player: string | null;
  opponent: string | null;
} | null;

type SettlementOutcomeKind =
  | "win"
  | "lose"
  | "opponent_surrender"
  | "player_surrender"
  | "draw"
  | "invalidated"
  | "cancelled"
  | "server_error"
  | "pending";

type BattleScreenOverlaysProps = {
  showRoomGateModal: boolean;
  roomGateTitle: string;
  roomGateMessage: string;
  hasSocketIssue: boolean;
  onReconnect: () => void;
  cleanLobbyHref: string;
  onReturnToLobby: () => void;
  onDisconnectedReturnToLobby: () => void;
  showDisconnectedOverlay: boolean;
  isDeviceOffline: boolean;
  isRejoining: boolean;
  onConfirmSurrender: () => void;
  isMatchComplete: boolean;
  showSettlementOverlay: boolean;
  surrenderModalOpen: boolean;
  canSurrenderMatch: boolean;
  onCloseSurrenderModal: () => void;
  settlementText: string;
  settlementSubtitle: string;
  isBotMatch: boolean;
  settlementOutcomeKind: SettlementOutcomeKind;
  settlementEmojiMood: SettlementEmojiMood;
  settlementExpressionSrc: SettlementExpressionSrc;
  settlementStatus: string;
  settlementStatusStyle: CSSProperties;
  winnerLineText: string | null;
  playerRoundsWon: number;
  opponentRoundsWon: number;
  correctCount: number;
  timeoutCount: number;
  wrongCount: number;
  settlementDetailsOpen: boolean;
  onToggleSettlementDetails: () => void;
  settlementPayload: SettlementPayload;
  onOpenShareModal: () => void;
  shareModalOpen: boolean;
  onCloseShareModal: () => void;
  address: string;
  arenaLabel: string;
  arenaToken: string;
  wagerUsd: string;
  regularMatchShareTitle: string;
  playerCharacterName: string;
  opponentCharacterName: string;
  playerAddressLabel: string;
  opponentAddressLabel: string;
  playerResultExpressionSrc: string | null;
  opponentResultExpressionSrc: string | null;
  challengeShareTitle: string;
  challengeStatusLabel: string;
  challengeCharacterExpressionSrc: string | null;
  createdBlinkChallenge: ActiveBlinkChallengeSession | null;
  createBlinkBusy: boolean;
  onSaveMatchResultPng: () => Promise<void>;
  onCreateBlinkFromResult: () => Promise<void>;
  onCopyChallengeLink: () => Promise<void>;
  onSaveChallengeJpg: () => Promise<void>;
  onShareChallengeToX: () => Promise<void>;
  shareNotice: ShareNotice;
};

export function BattleScreenOverlays({
  showRoomGateModal,
  roomGateTitle,
  roomGateMessage,
  hasSocketIssue,
  onReconnect,
  cleanLobbyHref,
  onReturnToLobby,
  onDisconnectedReturnToLobby,
  showDisconnectedOverlay,
  isDeviceOffline,
  isRejoining,
  onConfirmSurrender,
  isMatchComplete,
  showSettlementOverlay,
  surrenderModalOpen,
  canSurrenderMatch,
  onCloseSurrenderModal,
  settlementText,
  isBotMatch,
  settlementOutcomeKind,
  settlementEmojiMood,
  settlementExpressionSrc,
  settlementStatus,
  settlementStatusStyle,
  winnerLineText,
  playerRoundsWon,
  opponentRoundsWon,
  correctCount,
  timeoutCount,
  wrongCount,
  settlementDetailsOpen,
  onToggleSettlementDetails,
  settlementPayload,
  onOpenShareModal,
  shareModalOpen,
  onCloseShareModal,
  address,
  arenaLabel,
  arenaToken,
  wagerUsd,
  regularMatchShareTitle,
  playerCharacterName,
  opponentCharacterName,
  playerAddressLabel,
  opponentAddressLabel,
  playerResultExpressionSrc,
  opponentResultExpressionSrc,
  challengeShareTitle,
  challengeStatusLabel,
  challengeCharacterExpressionSrc,
  createdBlinkChallenge,
  createBlinkBusy,
  onSaveMatchResultPng,
  onCreateBlinkFromResult,
  onCopyChallengeLink,
  onSaveChallengeJpg,
  onShareChallengeToX,
  shareNotice,
}: BattleScreenOverlaysProps) {
  const [failedExpressionSprites, setFailedExpressionSprites] = useState<Record<string, true>>({});
  const parsedWagerUsd = Number.parseFloat(wagerUsd);
  const wagerUsdDisplay =
    Number.isFinite(parsedWagerUsd) && parsedWagerUsd > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsedWagerUsd)
      : null;
  const payoutUsdDisplay =
    Number.isFinite(parsedWagerUsd) && parsedWagerUsd > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsedWagerUsd * 2 * 0.975)
      : null;
  const tokenLabel = arenaToken?.trim() ? arenaToken.toUpperCase() : "TOKEN";

  const payoutHighlight = isBotMatch
    ? settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender"
      ? "Practice win. No Solana payout in no-stakes rounds."
      : settlementOutcomeKind === "lose" || settlementOutcomeKind === "player_surrender"
        ? "Practice round complete. You did not lose Solana."
        : "Practice round complete. No Solana was won or lost."
    : settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender"
      ? payoutUsdDisplay
        ? `You win the ${payoutUsdDisplay} wager in ${tokenLabel}`
        : `You win the ${tokenLabel} wager`
      : settlementOutcomeKind === "lose"
      ? "Rival secured the wager for this match"
      : settlementOutcomeKind === "player_surrender"
      ? wagerUsdDisplay
        ? `You surrendered and forfeited your ${wagerUsdDisplay} wager`
        : "You surrendered and forfeited your wager"
      : settlementOutcomeKind === "draw"
      ? "Draw result: no winner payout"
      : settlementOutcomeKind === "invalidated"
      ? "Match invalidated: payout is pending the invalidation outcome"
      : settlementOutcomeKind === "cancelled"
      ? "Room cancelled before a final winner payout"
      : settlementOutcomeKind === "server_error"
      ? "Match closed safely. Wager resolution is pending review"
      : "Settlement is still being finalized";

  const isWinPayoutHighlight = settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender";

  const shouldShowResultOverlay = isMatchComplete && showSettlementOverlay;
  const isMobileDevice =
    typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  function onOpenDeviceConnectionSettings() {
    if (!isDeviceOffline || !isMobileDevice || typeof window === "undefined") return;
    window.location.href = "app-settings:";
  }

  function resetShareView() {
    onCloseShareModal();
  }

  return (
    <>
      {showRoomGateModal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(2,6,5,0.62)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-md p-4 md:p-5"
            style={{ border: "1px solid rgba(248,214,148,0.38)", background: "rgba(13,24,20,0.94)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">{roomGateTitle}</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{roomGateMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasSocketIssue && (
                <button
                  type="button"
                  onClick={onReconnect}
                  className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  Rejoin Room
                </button>
              )}
              <Link
                href={cleanLobbyHref}
                onClick={onReturnToLobby}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Return To Lobby
              </Link>
            </div>
          </div>
        </div>
      )}

      {showDisconnectedOverlay && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">You were disconnected</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Your match is still active. Rejoin now, or return to the lobby and manage it from the active match banner.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {isDeviceOffline ? (
                <button
                  type="button"
                  onClick={onOpenDeviceConnectionSettings}
                  disabled={!isMobileDevice}
                  className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    border: "1px solid rgba(248,214,148,0.26)",
                    color: "rgba(244,240,230,0.84)",
                    background: "rgba(19,32,26,0.72)",
                  }}
                >
                  No Internet Connection
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReconnect}
                  disabled={isRejoining}
                  className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  {isRejoining ? "Rejoining Room..." : "Rejoin Room"}
                </button>
              )}
              <button
                type="button"
                disabled
                className="frame-cut frame-cut-sm cursor-not-allowed px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide opacity-50"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Connect to Surrender
              </button>
            </div>
            {isDeviceOffline && !isMobileDevice && (
              <p className="mt-2 text-center font-gabarito text-xs text-[rgba(244,240,230,0.62)]">
                Check your connection, then tap Rejoin.
              </p>
            )}
            <Link
              href={cleanLobbyHref}
              onClick={onDisconnectedReturnToLobby}
              className="mt-2 block text-center font-gabarito text-xs font-bold uppercase tracking-[0.14em] text-[rgba(244,240,230,0.54)] underline decoration-dotted underline-offset-2 hover:text-[rgba(244,240,230,0.84)]"
            >
              Return to Lobby
            </Link>
          </div>
        </div>
      )}

      {surrenderModalOpen && canSurrenderMatch && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender match?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              {isBotMatch
                ? "Surrendering ends this practice round. You will not lose Solana, and you will return to the lobby."
                : "Surrendering means you forfeit this match. Your rival will receive the wager after settlement. You will return to lobby."}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCloseSurrenderModal}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={onConfirmSurrender}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {shouldShowResultOverlay && (
          <motion.div
            key="match-result-backdrop"
            className="battle-result-backdrop fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              key="match-result-card"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="battle-result-card frame-cut relative w-full max-w-2xl overflow-hidden p-4 md:p-5"
              style={{
                border: "1px solid rgba(248,214,148,0.42)",
                background:
                  "radial-gradient(circle at top, rgba(255,243,215,0.9) 0%, rgba(247,227,190,0.9) 34%, rgba(239,213,170,0.95) 100%)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
              }}
            >
              <div className="text-center">
                <p
                className="battle-result-title mx-auto max-w-[18ch] break-words font-caprasimo text-[clamp(2.2rem,6vw,4rem)] leading-[0.95] text-[#1f2b24]"
                  style={{ textWrap: "balance" }}
                >
                  {settlementText}
                </p>
                <div className="battle-result-payout mt-3 flex justify-center">
                  <span
                    className={`battle-result-payout-pill rounded-2xl px-4 py-2 text-center font-gabarito text-xs font-black uppercase tracking-[0.08em] md:text-sm ${
                      isWinPayoutHighlight ? "shadow-[0_10px_16px_rgba(39,65,55,0.2)]" : ""
                    }`}
                    style={
                      isWinPayoutHighlight
                        ? {
                            color: "#fff8e9",
                            border: "1px solid rgba(39,65,55,0.32)",
                            background: "linear-gradient(160deg, #274137 0%, #3b5d4f 100%)",
                          }
                        : {
                            color: "#486357",
                            border: "1px solid rgba(39,65,55,0.2)",
                            background: "rgba(255,248,236,0.9)",
                          }
                    }
                  >
                    {payoutHighlight}
                  </span>
                </div>
                {settlementEmojiMood && (
                  <div className="battle-result-expressions mt-4 flex w-full items-center justify-center gap-5 md:gap-10">
                    <div className="battle-result-expression relative">
                      <div
                        className="battle-result-expression-card relative rounded-[24px] border px-4 py-3"
                        style={{
                          borderColor: "rgba(39,65,55,0.22)",
                          background: "linear-gradient(150deg, rgba(255,251,244,0.98), rgba(244,229,200,0.98))",
                          boxShadow: "0 8px 14px rgba(33,67,53,0.14)",
                        }}
                      >
                        <div className="battle-result-expression-image relative h-24 w-24 overflow-hidden rounded-[16px] border border-[rgba(39,65,55,0.2)] md:h-28 md:w-28">
                          {settlementExpressionSrc?.player && !failedExpressionSprites[settlementExpressionSrc.player] ? (
                            <Image
                              src={settlementExpressionSrc.player}
                              alt={`You ${settlementEmojiMood.player} expression`}
                              fill
                              sizes="(max-width: 768px) 96px, 112px"
                              className="object-cover object-center"
                              onError={() =>
                                setFailedExpressionSprites((prev) => ({
                                  ...prev,
                                  [settlementExpressionSrc.player!]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <span className="font-gabarito text-[10px] font-bold uppercase text-[#4f6759]">
                                {settlementEmojiMood.player}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="battle-result-expression-label mt-2 font-gabarito text-[11px] font-black uppercase tracking-[0.12em] text-[#4f6759]">YOU</p>
                      </div>
                      <span
                        className="absolute -left-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-l border-b"
                        style={{
                          borderColor: "rgba(39,65,55,0.22)",
                          background: "rgba(246,232,206,0.98)",
                        }}
                      />
                    </div>
                    <div className="battle-result-expression relative">
                      <div
                        className="battle-result-expression-card relative rounded-[24px] border px-4 py-3"
                        style={{
                          borderColor: "rgba(111,58,40,0.22)",
                          background: "linear-gradient(150deg, rgba(255,251,244,0.98), rgba(244,229,200,0.98))",
                          boxShadow: "0 8px 14px rgba(111,58,40,0.14)",
                        }}
                      >
                        <div className="battle-result-expression-image relative h-24 w-24 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.2)] md:h-28 md:w-28">
                          {settlementExpressionSrc?.opponent && !failedExpressionSprites[settlementExpressionSrc.opponent] ? (
                            <Image
                              src={settlementExpressionSrc.opponent}
                              alt={`Your rival ${settlementEmojiMood.opponent} expression`}
                              fill
                              sizes="(max-width: 768px) 96px, 112px"
                              className="object-cover object-center"
                              onError={() =>
                                setFailedExpressionSprites((prev) => ({
                                  ...prev,
                                  [settlementExpressionSrc.opponent!]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <span className="font-gabarito text-[10px] font-bold uppercase text-[#6f3a28]">
                                {settlementEmojiMood.opponent}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="battle-result-expression-label mt-2 font-gabarito text-[11px] font-black uppercase tracking-[0.12em] text-[#6f3a28]">
                          YOUR RIVAL
                        </p>
                      </div>
                      <span
                        className="absolute -right-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-r border-t"
                        style={{
                          borderColor: "rgba(111,58,40,0.22)",
                          background: "rgba(246,232,206,0.98)",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="battle-result-status mt-3 flex justify-center">
                  <span
                    className="battle-result-status-pill rounded-full px-3 py-1 font-gabarito text-[10px] font-extrabold uppercase tracking-[0.14em]"
                    style={settlementStatusStyle}
                  >
                    {settlementStatus}
                  </span>
                </div>
                {winnerLineText && (
                  <p className="battle-result-winner-line mt-2 font-gabarito text-xs text-[#5e7768]">{winnerLineText}</p>
                )}
              </div>

              <div className="battle-result-stats mt-4 flex flex-wrap items-center justify-center gap-1.5 p-1">
                <span
                  className="battle-result-stat-pill rounded-full px-2.5 py-1 font-gabarito text-[10px] font-black uppercase tracking-[0.1em] text-[#274137]"
                  style={{ background: "rgba(225,238,219,0.96)" }}
                >
                  Rounds {playerRoundsWon}-{opponentRoundsWon}
                </span>
                <span
                  className="battle-result-stat-pill rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a4a3c]"
                  style={{ background: "rgba(233,243,228,0.96)" }}
                >
                  Correct {correctCount}
                </span>
                <span
                  className="battle-result-stat-pill rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#6f3a28]"
                  style={{ background: "rgba(246,238,224,0.96)" }}
                >
                  Timeout {timeoutCount}
                </span>
                <span
                  className="battle-result-stat-pill rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#7c4a36]"
                  style={{ background: "rgba(245,234,228,0.96)" }}
                >
                  Wrong {wrongCount}
                </span>
              </div>

              <div className="battle-result-actions mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenShareModal();
                  }}
                  className="battle-result-action btn-game btn-game-primary min-w-[146px] px-4 py-2 text-xs shadow-xl"
                >
                  Share Match
                </button>
                <Link
                  href="/lobby"
                  onClick={onReturnToLobby}
                  className="battle-result-action btn-game btn-game-secondary min-w-[146px] px-4 py-2 text-center text-xs shadow-xl"
                  style={{
                    background: "linear-gradient(140deg, #3f6c57 0%, #274137 100%)",
                    borderColor: "rgba(248,214,148,0.34)",
                    boxShadow:
                      "0 4px 0 #1c3128, 0 10px 24px rgba(39,65,55,0.34), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  Back To Lobby
                </Link>
              </div>

              <div className="battle-result-details-toggle mt-4 text-center">
                <button
                  type="button"
                  onClick={onToggleSettlementDetails}
                  className="battle-result-details-button font-gabarito text-xs font-bold uppercase tracking-[0.14em] text-[#4f6759] underline decoration-dotted underline-offset-2"
                >
                  {settlementDetailsOpen ? "Hide Settlement Details" : "Show Settlement Details"}
                </button>
              </div>

              {settlementDetailsOpen && (
                <div
                  className="battle-result-details mt-2 frame-cut frame-cut-sm space-y-1 p-3"
                  style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,248,236,0.95)" }}
                >
                  <p className="font-gabarito text-xs font-bold uppercase tracking-[0.1em] text-[#274137]">
                    Settlement Details
                  </p>
                  {settlementPayload ? (
                    <>
                      <p className="font-gabarito text-xs text-[#5e7768]">
                        Result signed by backend oracle and submitted by backend settlement flow.
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Match ID: {settlementPayload.matchId}
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Server Signer: {settlementPayload.serverAddress}
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Settlement Signature: {settlementPayload.settlementSignature}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-gabarito text-xs text-[#5e7768]">
                        Waiting for server settlement payload...
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Match ID: unavailable</p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Server Pubkey: unavailable</p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Settlement Signature: unavailable
                      </p>
                    </>
                  )}
                </div>
              )}
              {settlementStatus === "Pending" && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-[rgba(39,65,55,0.08)]">
                  <div className="shimmer-bar h-full w-full" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {shareModalOpen && shouldShowResultOverlay && (
        <div className="battle-share-backdrop fixed inset-0 z-[70] grid place-items-center bg-[rgba(7,12,10,0.72)] p-4">
          <div className="battle-share-panel w-full max-w-3xl">
            {!createdBlinkChallenge && (
              <div className="battle-share-stack space-y-4">
                <div className="battle-share-close-row flex justify-end px-1">
                  <button
                    type="button"
                    onClick={resetShareView}
                    className="battle-share-close z-10 shrink-0 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                    style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,248,236,0.95)" }}
                  >
                    Close
                  </button>
                </div>
                <div className="battle-share-preview-frame">
                  <div className="battle-share-preview-scale">
                    <MatchResultShareCard
                      title={regularMatchShareTitle}
                      arenaLabel={arenaLabel}
                      wagerUsd={wagerUsd}
                      playerCharacterName={playerCharacterName}
                      opponentCharacterName={opponentCharacterName}
                      playerAddressLabel={playerAddressLabel}
                      opponentAddressLabel={opponentAddressLabel}
                      playerExpressionSrc={playerResultExpressionSrc}
                      opponentExpressionSrc={opponentResultExpressionSrc}
                      roundsLabel={`${playerRoundsWon}-${opponentRoundsWon}`}
                      correctCount={correctCount}
                      wrongCount={wrongCount}
                      timeoutCount={timeoutCount}
                    />
                  </div>
                </div>
                <div className="battle-share-actions flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveMatchResultPng()}
                    className="battle-share-action rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5"
                    style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
                  >
                    Save As PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCreateBlinkFromResult()}
                    disabled={createBlinkBusy}
                    className="battle-share-action rounded-lg border px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-[0.1em] text-[#1f1b18] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    style={{ borderColor: "rgba(34,34,34,0.26)", background: "rgba(255,255,255,0.76)" }}
                  >
                    {createBlinkBusy ? "Opening Phantom..." : "Create Blink"}
                  </button>
                </div>
                {createBlinkBusy && (
                  <div
                    className="battle-share-busy inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{
                      border: "1px solid rgba(248,214,148,0.26)",
                      background: "linear-gradient(145deg, rgba(248,214,148,0.14), rgba(203,227,193,0.1))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#f8d694] animate-pulse" />
                    <span className="font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[#f8d694]">
                      Opening Phantom...
                    </span>
                  </div>
                )}
                {shareNotice && (
                  <p className="battle-share-notice font-gabarito text-xs" style={{ color: shareNotice.tone === "success" ? "#2f6249" : "#8a3f2b" }}>
                    {shareNotice.text}
                  </p>
                )}
              </div>
            )}

            {createdBlinkChallenge && (
              <div className="battle-share-stack space-y-3">
                <div className="battle-share-close-row flex justify-end px-1">
                  <button
                    type="button"
                    onClick={resetShareView}
                    className="battle-share-close z-10 shrink-0 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                    style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,248,236,0.95)" }}
                  >
                    Close
                  </button>
                </div>
                <div className="battle-share-preview-frame">
                  <div className="battle-share-preview-scale">
                    <ChallengeShareCard
                      title={challengeShareTitle}
                      challengerAddress={address}
                      arenaLabel={arenaLabel}
                      token={arenaToken}
                      wagerUsd={wagerUsd}
                      challengeLink={createdBlinkChallenge.blinkUrl}
                      description={null}
                      statusLabel={challengeStatusLabel}
                      characterExpressionSrc={challengeCharacterExpressionSrc}
                      characterExpressionAlt="Your scientist expression"
                    />
                  </div>
                </div>
                <div className="battle-share-challenge-actions">
                  <ChallengeShareActions
                    challengeLink={createdBlinkChallenge.blinkUrl}
                    notice={shareNotice}
                    actionCopyLabel="Copy Blink URL"
                    onCopy={onCopyChallengeLink}
                    onSaveJpg={onSaveChallengeJpg}
                    onShareX={onShareChallengeToX}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

