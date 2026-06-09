export type PrivateChallengeStatus =
  | "PENDING"
  | "EXPIRED"
  | "CHALLENGED"
  | "ACTIVE"
  | "COMPLETED"
  | "FORFEITED";

export type CreatePrivateChallengeResponse = {
  roomId: string;
  matchId: string;
  escrowAddress: string;
  chainId: number;
  token: string;
  wagerWei: string;
  challengeUrl: string;
  role: "playerA";
  roomType: "private";
};

export type PrivateChallenge = {
  roomId: string;
  roomType: "private";
  status: PrivateChallengeStatus;
  creatorWallet: string;
  opponentWallet: string | null;
  tokenMint: string;
  wagerAmount: string;
  expiresAt: string;
  joinDeadline: string | null;
};

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, "");
}

export function resolveApiBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (explicit) return trimTrailingSlash(explicit);

  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim();
  if (wsUrl.startsWith("wss://")) return trimTrailingSlash(`https://${wsUrl.slice("wss://".length)}`);
  if (wsUrl.startsWith("ws://")) return trimTrailingSlash(`http://${wsUrl.slice("ws://".length)}`);
  return trimTrailingSlash(wsUrl);
}

export async function createPrivateChallenge({
  address,
  token,
}: {
  address: string;
  token: string;
}): Promise<CreatePrivateChallengeResponse> {
  const response = await fetch(`${resolveApiBaseUrl()}/match/private`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, token }),
  });

  const payload = (await response.json().catch(() => null)) as Partial<CreatePrivateChallengeResponse> & {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Private challenge creation failed (${response.status}).`);
  }

  if (!payload?.roomId || !payload.escrowAddress || payload.wagerWei === undefined) {
    throw new Error("Private challenge response missing roomId, escrowAddress, or wagerWei.");
  }

  return {
    roomId: payload.roomId,
    matchId: payload.matchId ?? "",
    escrowAddress: payload.escrowAddress,
    chainId: payload.chainId ?? 84532,
    token: payload.token ?? "ETH",
    wagerWei: payload.wagerWei,
    challengeUrl: payload.challengeUrl ?? "",
    role: "playerA",
    roomType: "private",
  };
}

export async function confirmPrivateChallenge({
  roomId,
  address,
  txHash,
  token,
  wagerWei,
}: {
  roomId: string;
  address: string;
  txHash: string;
  token: string;
  wagerWei: string;
}) {
  const response = await fetch(`${resolveApiBaseUrl()}/match/private/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, address, txHash, token, wagerAmount: wagerWei }),
  });
  const payload = (await response.json().catch(() => null)) as { status?: string; roomId?: string; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Private challenge confirmation failed (${response.status}).`);
  }

  return {
    roomId: payload?.roomId ?? roomId,
    status: payload?.status ?? "PENDING",
  };
}

export async function acceptPrivateChallenge({
  roomId,
  address,
  txHash,
}: {
  roomId: string;
  address: string;
  txHash: string;
}) {
  const response = await fetch(`${resolveApiBaseUrl()}/match/private/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, address, txHash }),
  });
  const payload = (await response.json().catch(() => null)) as { status?: string; roomId?: string; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Challenge accept failed (${response.status}).`);
  }

  return { roomId: payload?.roomId ?? roomId, status: payload?.status ?? "CHALLENGED" };
}

export async function getPrivateChallenge(roomId: string, signal?: AbortSignal): Promise<PrivateChallenge> {
  const response = await fetch(`${resolveApiBaseUrl()}/match/private/${encodeURIComponent(roomId)}`, { signal });
  const payload = (await response.json().catch(() => null)) as Partial<PrivateChallenge> & { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Private challenge lookup failed (${response.status}).`);
  }

  if (!payload?.roomId || payload.roomType !== "private" || !payload.status) {
    throw new Error("Private challenge response missing required fields.");
  }

  return {
    roomId: payload.roomId,
    roomType: "private",
    status: payload.status,
    creatorWallet: payload.creatorWallet ?? "",
    opponentWallet: payload.opponentWallet ?? null,
    tokenMint: payload.tokenMint ?? "",
    wagerAmount: payload.wagerAmount ?? "0",
    expiresAt: payload.expiresAt ?? "",
    joinDeadline: payload.joinDeadline ?? null,
  };
}

export function getWebChallengeUrl(origin: string | null | undefined, roomId: string) {
  const safeOrigin = (origin ?? "").trim();
  if (!safeOrigin || !roomId) return null;
  return new URL(`/challenge/${encodeURIComponent(roomId)}`, safeOrigin).toString();
}
