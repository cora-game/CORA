"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { HydratedWalletButton } from "@/components/wallet/HydratedWalletButton";
import { BlinkCharacterGate } from "@/components/challenge/BlinkCharacterGate";
import { BlinkRoomJoiner } from "@/components/challenge/BlinkRoomJoiner";
import { BlinkSurrenderBridge } from "@/components/challenge/BlinkSurrenderBridge";
import { getPrivateChallenge, type PrivateChallenge } from "@/lib/matchmaking/privateChallenge";
import { DepositIntentError, signDepositIntent } from "@/lib/solana/signDepositIntent";
import {
  clearActiveDepositIntent,
  getMatchSessionAddress,
  readActiveDepositIntent,
  readActiveMatchSession,
  writeActiveDepositIntent,
  writeActiveMatchSession,
} from "@/lib/session/matchSession";
import { SCIENTISTS } from "@/components/lobby/LobbyScreen";

type BlinkChallengeAcceptProps = {
  roomId: string;
};

type AcceptState = "idle" | "loading" | "signing" | "accepted" | "error";
const FIXED_WAGER_USD = "1.00";
const SOL_WRAPPED_MINT = "So11111111111111111111111111111111111111112";
const BLINK_TERMINAL_STATUSES = new Set(["EXPIRED", "FORFEITED", "COMPLETED"]);

function getTokenLabel(tokenMint: string | null | undefined) {
  const token = (tokenMint || "SOL");
  if (token === SOL_WRAPPED_MINT) return "SOL";
  return token;
}

function getArenaLabel(tokenMint: string | null | undefined) {
  const token = getTokenLabel(tokenMint);
  if (token === SOL_WRAPPED_MINT) return "SOL";
  if (token === "SOL") return "SOL Arena";
  if (token === "BONK") return "BONK Arena";
  if (token === "MEW") return "MEW Arena";
  return `${token} Arena`;
}

function shortAddress(address: string | null | undefined) {
  if (!address) return "Unknown";
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function classifyError(error: unknown) {
  if (error instanceof DepositIntentError) {
    if (error.code === "wallet_declined") return "You cancelled the transaction in your wallet.";
    if (error.code === "insufficient_balance") return "Insufficient Balance";
    return error.message;
  }
  return error instanceof Error ? error.message : "Challenge accept failed.";
}

export function BlinkChallengeAccept({ roomId }: BlinkChallengeAcceptProps) {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [challenge, setChallenge] = useState<PrivateChallenge | null>(null);
  const [state, setState] = useState<AcceptState>("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [acceptedSignature, setAcceptedSignature] = useState<string | null>(null);
  const [selectedScientistId, setSelectedScientistId] = useState<string | null>(null);
  const [scientistConfirmed, setScientistConfirmed] = useState(false);
  const [surrendering, setSurrendering] = useState(false);
  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const isCreator = Boolean(walletAddress && challenge?.creatorWallet === walletAddress);
  const isAcceptedByWallet = Boolean(walletAddress && challenge?.opponentWallet === walletAddress);
  const canAccept = Boolean(wallet.publicKey) && challenge?.status === "PENDING" && !isCreator && state !== "signing";
  const isTerminalChallenge = challenge?.status ? BLINK_TERMINAL_STATUSES.has(challenge.status) : false;
  const tokenLabel = getTokenLabel(challenge?.tokenMint);
  const arenaLabel = useMemo(() => getArenaLabel(challenge?.tokenMint), [challenge?.tokenMint]);
  const characterOptions = useMemo(() => SCIENTISTS.map((scientist) => ({ ...scientist })), []);
  const joinSignature = acceptedSignature ?? (walletAddress ? readActiveDepositIntent(roomId, walletAddress) : null);
  const hasAcceptedContext = Boolean(
    walletAddress &&
    !isCreator &&
    !isTerminalChallenge &&
    (
      state === "accepted" ||
      Boolean(joinSignature && isAcceptedByWallet)
    ),
  );
  const recoveredMatchSnapshot = useMemo(() => {
    if (!walletAddress) return null;
    const snapshot = readActiveMatchSession();
    if (!snapshot || snapshot.roomId !== roomId) return null;
    if (getMatchSessionAddress(snapshot) !== walletAddress) return null;
    return snapshot;
  }, [roomId, walletAddress]);
  const effectiveScientistId = selectedScientistId ?? recoveredMatchSnapshot?.scientistId ?? null;
  const effectiveScientistConfirmed =
    scientistConfirmed || (recoveredMatchSnapshot?.status === "depositing" && Boolean(recoveredMatchSnapshot.scientistId));
  const wagerUsd = FIXED_WAGER_USD;

  useEffect(() => {
    const controller = new AbortController();
    getPrivateChallenge(roomId, controller.signal)
      .then((next) => {
        setChallenge(next);
        setState("idle");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setErrorText(error instanceof Error ? error.message : "Challenge not found.");
        setState("error");
      });
    return () => controller.abort();
  }, [roomId]);

  useEffect(() => {
    if (!isTerminalChallenge) return;
    // Clear any stale local recovery state for this room if it's terminal
    const snapshot = readActiveMatchSession();
    if (snapshot?.roomId === roomId) {
      writeActiveMatchSession(null);
      clearActiveDepositIntent();
    }
  }, [isTerminalChallenge, roomId]);

  function handleBackToLobby() {
    writeActiveMatchSession(null);
    clearActiveDepositIntent();
    router.replace("/lobby");
  }

  async function onAcceptChallenge() {
    if (!canAccept || !challenge) return;
    setState("signing");
    setErrorText(null);
    try {
      const signature = await signDepositIntent({
        connection,
        wallet,
        roomId,
        token: challenge.tokenMint,
        wagerUsd,
      });
      setAcceptedSignature(signature);
      writeActiveDepositIntent({ roomId, address: walletAddress, signature });
      setState("accepted");
    } catch (error) {
      setErrorText(classifyError(error));
      setState("error");
    }
  }

  if (hasAcceptedContext) {
    if (surrendering) {
      return (
        <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(145deg,#10231b_0%,#18392d_52%,#0d1a14_100%)]">
          <BlinkSurrenderBridge
            roomId={roomId}
            address={walletAddress}
            characterId={effectiveScientistId}
            confirmSignature={joinSignature}
            onSettled={() => {
              writeActiveMatchSession(null);
              router.replace("/lobby");
            }}
            onError={(message) => {
              setErrorText(message);
              setSurrendering(false);
            }}
          />
        </div>
      );
    }

    if (!effectiveScientistConfirmed) {
      return (
        <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(145deg,#10231b_0%,#18392d_52%,#0d1a14_100%)]">
          <BlinkCharacterGate
            title="Choose your scientist"
            subtitle={errorText ?? "Your wager is locked. Pick your scientist before joining the Blink room."}
            characters={characterOptions}
            selectedCharacterId={effectiveScientistId}
            onSelect={(characterId) => {
              setErrorText(null);
              setSelectedScientistId(characterId);
              setScientistConfirmed(false);
            }}
            onContinue={() => {
              if (!effectiveScientistId) return;
              setScientistConfirmed(true);
            }}
            onSurrender={() => setSurrendering(true)}
          />
        </div>
      );
    }

    return (
      <BlinkRoomJoiner
        roomId={roomId}
        address={walletAddress}
        role="playerB"
        arenaId="sol"
        scientistId={effectiveScientistId}
        token={challenge?.tokenMint}
        wagerUsd={wagerUsd}
        depositConfirmSignature={joinSignature}
        title="Challenge Accepted"
        subtitle={joinSignature ? "Your wager is locked. Waiting for creator to join." : "Rejoining your accepted Blink match."}
      />
    );
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(145deg,#10231b_0%,#18392d_52%,#0d1a14_100%)] px-4 py-8 md:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="paper-grain absolute inset-0 opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(8,15,12,0.64)_100%)]" />
        <div className="absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tone-sage)] opacity-16 blur-[150px]" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center">
        <section
          className="game-card w-full p-6 shadow-2xl md:p-8"
          style={{ border: "2px solid var(--tone-bark)", background: "linear-gradient(180deg, #fff8e8 0%, #f3e6c9 100%)" }}
        >
          <p className="font-gabarito text-[11px] font-black uppercase tracking-[0.22em] text-[var(--tone-clay)]">
            CORA Blink Challenge
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[var(--tone-bark)] md:text-5xl">
            {isTerminalChallenge ? "Challenge Closed" : "Accept The Challenge"}
          </h1>
          <p className="mt-3 font-gabarito text-sm text-[var(--warm-text)]">
            {isTerminalChallenge
              ? "This Blink challenge is no longer available. It may have expired or been forfeited."
              : "Sign once to lock your wager. The creator already funded the open challenge."}
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-[rgba(111,58,40,0.24)] bg-[rgba(255,255,255,0.36)] p-4 font-gabarito text-sm text-[var(--warm-text)]">
            <p><span className="font-bold text-[var(--tone-bark)]">Room:</span> {roomId}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Creator:</span> {shortAddress(challenge?.creatorWallet)}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Arena:</span> {arenaLabel}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Token:</span> {tokenLabel}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Status:</span> {challenge?.status ?? state}</p>
            <p><span className="font-bold text-[var(--tone-bark)]">Wager:</span> ${wagerUsd}</p>
          </div>

          {errorText && (
            <div className="mt-4 frame-cut px-4 py-3" style={{ border: "2px solid var(--tone-clay)", background: "#fff4dd" }}>
              <p className="font-gabarito text-sm font-bold text-[var(--tone-bark)]">{errorText}</p>
            </div>
          )}

          {isCreator && (
            <div className="mt-4 frame-cut px-4 py-3" style={{ border: "2px solid var(--tone-clay)", background: "#fff4dd" }}>
              <p className="font-gabarito text-sm font-bold text-[var(--tone-bark)]">
                This is your own challenge. Share it with another wallet to accept.
              </p>
            </div>
          )}

          {!hasAcceptedContext && isAcceptedByWallet && !isTerminalChallenge && challenge?.status !== "PENDING" && (
            <div className="mt-4 frame-cut px-4 py-3" style={{ border: "2px solid var(--tone-clay)", background: "#fff4dd" }}>
              <p className="font-gabarito text-sm font-bold text-[var(--tone-bark)]">
                This wallet already accepted the challenge, but the local Blink recovery context is gone.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!wallet.publicKey && <HydratedWalletButton />}
            <button
              type="button"
              onClick={handleBackToLobby}
              className="btn-game btn-game-secondary ml-auto px-5 py-3 text-xs"
              style={{
                borderColor: "rgba(111,58,40,0.42)",
                boxShadow: "0 4px 0 rgba(111,58,40,0.22)",
                color: "rgba(111,58,40,0.42)",
              }}
            >
              Back To Lobby
            </button>
            <button
              type="button"
              onClick={onAcceptChallenge}
              disabled={!canAccept}
              className={`btn-game btn-game-primary px-5 py-3 text-xs ${!canAccept ? "cursor-not-allowed opacity-50 grayscale" : ""}`}
            >
              {state === "signing" ? "Signing In Wallet..." : "Accept & Lock Wager"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
