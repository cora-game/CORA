type QueueMatchParams = {
  address: string;
  tokenMint?: string;
  wagerAmount?: number;
  characterId?: string;
  signal?: AbortSignal;
};

type QueueMatchResponse = {
  roomId: string;
  role?: "playerA" | "playerB";
  tokenMint?: string;
  wagerAmount?: string;
  roomType?: "public" | "private" | "bot";
  alreadyInRoom?: boolean;
  status?: string;
  opponentAddress?: string | null;
};

type ActiveMatchResponse = {
  inRoom: boolean;
  roomId?: string;
  role?: "playerA" | "playerB";
  roomType?: "public" | "private" | "bot";
  status?: string;
  playerA?: string | null;
  playerB?: string | null;
};

type MatchPresenceResponse = {
  inRoom: boolean;
  queued: boolean;
  roomId?: string;
  role?: "playerA" | "playerB";
  roomType?: "public" | "private" | "bot";
  status?: string;
};

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim();
  if (wsUrl.startsWith("wss://")) {
    return trimTrailingSlash(`https://${wsUrl.slice("wss://".length)}`);
  }
  if (wsUrl.startsWith("ws://")) {
    return trimTrailingSlash(`http://${wsUrl.slice("ws://".length)}`);
  }
  return trimTrailingSlash(wsUrl);
}

export async function queueMatch({ address, tokenMint, wagerAmount, signal }: QueueMatchParams): Promise<QueueMatchResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const body: {
    address: string;
    tokenMint?: string;
    wagerAmount?: number;
  } = { address };
  if (tokenMint) body.tokenMint = tokenMint;
  if (wagerAmount !== undefined) body.wagerAmount = wagerAmount;

  const response = await fetch(`${apiBaseUrl}/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as {
    roomId?: string;
    role?: "playerA" | "playerB";
    tokenMint?: string;
    wagerAmount?: string;
    roomType?: "public" | "private" | "bot";
    alreadyInRoom?: boolean;
    status?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Matchmaking failed (${response.status}).`);
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    throw new Error("Matchmaking response missing roomId.");
  }

  return {
    roomId,
    role: payload?.role,
    tokenMint: payload?.tokenMint,
    wagerAmount: payload?.wagerAmount,
    roomType: payload?.roomType,
    alreadyInRoom: payload?.alreadyInRoom,
    status: payload?.status,
  };
}

export async function createBotMatch({
  address,
  tokenMint,
  wagerAmount,
  characterId,
  signal,
}: QueueMatchParams): Promise<QueueMatchResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const body: {
    address: string;
    tokenMint?: string;
    wagerAmount?: number;
    characterId?: string;
  } = { address };
  if (tokenMint) body.tokenMint = tokenMint;
  if (wagerAmount !== undefined) body.wagerAmount = wagerAmount;
  if (characterId) body.characterId = characterId;

  const response = await fetch(`${apiBaseUrl}/match/bot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as {
    roomId?: string;
    role?: "playerA" | "playerB";
    roomType?: "public" | "private" | "bot";
    status?: string;
    opponentAddress?: string | null;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Bot matchmaking failed (${response.status}).`);
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    throw new Error("Bot matchmaking response missing roomId.");
  }

  return {
    roomId,
    role: payload?.role,
    roomType: payload?.roomType,
    status: payload?.status,
    opponentAddress: payload?.opponentAddress ?? null,
  };
}

export async function getActiveMatchForAddress(address: string, signal?: AbortSignal): Promise<ActiveMatchResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/match/active/${encodeURIComponent(address)}`, { signal });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return { inRoom: false };
  }
  const payload = (await response.json().catch(() => null)) as ActiveMatchResponse | { error?: string } | null;

  if (!response.ok) {
    throw new Error((payload as { error?: string } | null)?.error ?? `Active match lookup failed (${response.status}).`);
  }

  if (!payload || typeof (payload as ActiveMatchResponse).inRoom !== "boolean") {
    throw new Error("Active match response missing inRoom.");
  }

  return payload as ActiveMatchResponse;
}

export async function getMatchPresenceForAddress(address: string, signal?: AbortSignal): Promise<MatchPresenceResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/match/presence/${encodeURIComponent(address)}`, { signal });
  const payload = (await response.json().catch(() => null)) as MatchPresenceResponse | { error?: string } | null;

  if (!response.ok) {
    throw new Error((payload as { error?: string } | null)?.error ?? `Match presence lookup failed (${response.status}).`);
  }

  if (!payload || typeof (payload as MatchPresenceResponse).inRoom !== "boolean" || typeof (payload as MatchPresenceResponse).queued !== "boolean") {
    throw new Error("Match presence response missing queue state.");
  }

  return payload as MatchPresenceResponse;
}
