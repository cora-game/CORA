import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  confirmPrivateChallenge,
  createPrivateChallenge,
  getWebChallengeUrl,
} from "@/lib/matchmaking/privateChallenge";
import type { ActiveBlinkChallengeSession } from "@/lib/session/matchSession";
import { signBackendTransaction } from "@/lib/solana/signBackendTransaction";

type CreateBlinkChallengeSessionInput = {
  connection: Connection;
  wallet: WalletContextState;
  walletAddress: string;
  tokenMint: string;
  wagerAmount: number;
  wagerUsd: string;
  arenaId: string;
  scientistId?: string | null;
  origin?: string | null;
};

export async function createBlinkChallengeSession({
  connection,
  wallet,
  walletAddress,
  tokenMint,
  wagerAmount,
  wagerUsd,
  arenaId,
  scientistId,
  origin,
}: CreateBlinkChallengeSessionInput): Promise<ActiveBlinkChallengeSession> {
  const created = await createPrivateChallenge({
    address: walletAddress,
    tokenMint,
    wagerAmount,
  });
  const signature = await signBackendTransaction({
    connection,
    wallet,
    base64Transaction: created.transaction,
  });
  const confirmed = await confirmPrivateChallenge({
    roomId: created.roomId,
    address: walletAddress,
    signature,
    tokenMint,
    wagerAmount,
  });

  return {
    walletAddress,
    roomId: created.roomId,
    blinkUrl: created.blinkUrl,
    webChallengeUrl: getWebChallengeUrl(origin ?? null, created.roomId),
    createSignature: signature,
    role: "playerA",
    arenaId,
    scientistId: scientistId ?? null,
    token: tokenMint,
    wagerUsd,
    wagerAmount,
    status: confirmed.status,
    createdAt: new Date().toISOString(),
  };
}
