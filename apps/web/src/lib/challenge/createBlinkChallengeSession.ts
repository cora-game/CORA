import {
  confirmPrivateChallenge,
  createPrivateChallenge,
  getWebChallengeUrl,
} from "@/lib/matchmaking/privateChallenge";
import type { ActiveBlinkChallengeSession } from "@/lib/session/matchSession";
import { createOpenChallengeTx } from "@/lib/evm/deposit";

type CreateBlinkChallengeSessionInput = {
  walletAddress: string;
  tokenMint: string;
  /** Display wager amount (kept for the session snapshot/UI). */
  wagerAmount: number;
  wagerUsd: string;
  arenaId: string;
  scientistId?: string | null;
  origin?: string | null;
};

/**
 * Creates an open challenge on Base Sepolia:
 *   1. Ask the API for a roomId + the on-chain params (escrow address, wager wei).
 *   2. Call `createOpenChallenge(matchId)` on-chain with value = wager wei.
 *   3. Confirm with the API (it verifies the tx receipt and writes the DB row).
 */
export async function createBlinkChallengeSession({
  walletAddress,
  tokenMint,
  wagerAmount,
  wagerUsd,
  arenaId,
  scientistId,
  origin,
}: CreateBlinkChallengeSessionInput): Promise<ActiveBlinkChallengeSession> {
  // The API resolves the per-token default wager (ETH or USDC) and returns it.
  const created = await createPrivateChallenge({
    address: walletAddress,
    token: tokenMint,
  });

  const wagerWei = BigInt(created.wagerWei || "1000000000000000");

  const txHash = await createOpenChallengeTx({ roomId: created.roomId, wagerWei, token: created.token });

  const confirmed = await confirmPrivateChallenge({
    roomId: created.roomId,
    address: walletAddress,
    txHash,
    token: created.token,
    wagerWei: wagerWei.toString(),
  });

  return {
    walletAddress,
    roomId: created.roomId,
    blinkUrl: created.challengeUrl,
    webChallengeUrl: getWebChallengeUrl(origin ?? null, created.roomId),
    createSignature: txHash,
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
