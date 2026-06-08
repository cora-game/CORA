export const LOBBY_DRAFT_STORAGE_KEY = "cora:lobby-draft";
export const ACTIVE_ROOM_STORAGE_KEY = "cora:active-room";
export const ACTIVE_BLINK_CHALLENGE_STORAGE_KEY = "cora:active-blink-challenge";

const ACTIVE_DEPOSIT_INTENT_STORAGE_KEY = "cora:active-deposit-intent";

export type LobbyDraftSnapshot = {
  arenaId?: string | null;
  scientistId?: string | null;
};

export type ActiveMatchSession = {
  walletAddress?: string | null;
  address?: string | null;
  displayAddress?: string | null;
  displayAsGuest?: boolean;
  roomId: string;
  role?: "playerA" | "playerB" | null;
  roomType?: "public" | "private" | "bot" | null;
  isGuest?: boolean;
  isTutorial?: boolean;
  arenaId?: string | null;
  scientistId?: string | null;
  status?: string | null;
  token?: string | null;
  arenaToken?: string | null;
  wagerUsd?: string | null;
  canSurrenderByState?: boolean;
};

export type ActiveBlinkChallengeSession = {
  walletAddress: string;
  roomId: string;
  blinkUrl: string;
  webChallengeUrl?: string | null;
  createSignature: string;
  role: "playerA";
  arenaId?: string | null;
  scientistId?: string | null;
  token?: string | null;
  wagerUsd?: string | null;
  wagerAmount?: number | null;
  status?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  joinDeadline?: string | null;
};

type ActiveDepositIntent = {
  roomId: string;
  address: string;
  signature: string;
};

export function normalizeActiveBlinkChallengeSession(value: unknown): ActiveBlinkChallengeSession | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const walletAddress = typeof snapshot.walletAddress === "string" ? snapshot.walletAddress : "";
  const roomId = typeof snapshot.roomId === "string" ? snapshot.roomId : "";
  const blinkUrl = typeof snapshot.blinkUrl === "string" ? snapshot.blinkUrl : "";
  const createSignature = typeof snapshot.createSignature === "string" ? snapshot.createSignature : "";
  if (!walletAddress || !roomId || !blinkUrl || !createSignature) return null;

  return {
    walletAddress,
    roomId,
    blinkUrl,
    webChallengeUrl: typeof snapshot.webChallengeUrl === "string" ? snapshot.webChallengeUrl : null,
    createSignature,
    role: "playerA",
    arenaId: typeof snapshot.arenaId === "string" ? snapshot.arenaId : null,
    scientistId: typeof snapshot.scientistId === "string" ? snapshot.scientistId : null,
    token: typeof snapshot.token === "string" ? snapshot.token : null,
    wagerUsd: typeof snapshot.wagerUsd === "string" ? snapshot.wagerUsd : null,
    wagerAmount: typeof snapshot.wagerAmount === "number" ? snapshot.wagerAmount : null,
    status: typeof snapshot.status === "string" ? snapshot.status : null,
    createdAt: typeof snapshot.createdAt === "string" ? snapshot.createdAt : null,
    expiresAt: typeof snapshot.expiresAt === "string" ? snapshot.expiresAt : null,
    joinDeadline: typeof snapshot.joinDeadline === "string" ? snapshot.joinDeadline : null,
  };
}

export function readActiveBlinkChallengeSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_BLINK_CHALLENGE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeActiveBlinkChallengeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeActiveBlinkChallengeSession(snapshot: ActiveBlinkChallengeSession | null) {
  if (typeof window === "undefined") return;
  if (!snapshot) {
    window.localStorage.removeItem(ACTIVE_BLINK_CHALLENGE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_BLINK_CHALLENGE_STORAGE_KEY, JSON.stringify(snapshot));
}

export function normalizeActiveMatchSession(value: unknown): ActiveMatchSession | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const roomId = typeof snapshot.roomId === "string" ? snapshot.roomId : "";
  if (!roomId) return null;

  return {
    walletAddress:
      typeof snapshot.walletAddress === "string"
        ? snapshot.walletAddress
        : typeof snapshot.address === "string"
          ? snapshot.address
          : null,
    address:
      typeof snapshot.address === "string"
        ? snapshot.address
        : typeof snapshot.walletAddress === "string"
          ? snapshot.walletAddress
          : null,
    displayAddress: typeof snapshot.displayAddress === "string" ? snapshot.displayAddress : null,
    displayAsGuest: typeof snapshot.displayAsGuest === "boolean" ? snapshot.displayAsGuest : undefined,
    roomId,
    role: snapshot.role === "playerA" || snapshot.role === "playerB" ? snapshot.role : null,
    roomType:
      snapshot.roomType === "public" || snapshot.roomType === "private" || snapshot.roomType === "bot"
        ? snapshot.roomType
        : null,
    isGuest: snapshot.isGuest === true,
    isTutorial: snapshot.isTutorial === true,
    arenaId: typeof snapshot.arenaId === "string" ? snapshot.arenaId : null,
    scientistId: typeof snapshot.scientistId === "string" ? snapshot.scientistId : null,
    status: typeof snapshot.status === "string" ? snapshot.status : null,
    token:
      typeof snapshot.token === "string"
        ? snapshot.token
        : typeof snapshot.arenaToken === "string"
          ? snapshot.arenaToken
          : null,
    arenaToken:
      typeof snapshot.arenaToken === "string"
        ? snapshot.arenaToken
        : typeof snapshot.token === "string"
          ? snapshot.token
          : null,
    wagerUsd: typeof snapshot.wagerUsd === "string" ? snapshot.wagerUsd : null,
    canSurrenderByState: typeof snapshot.canSurrenderByState === "boolean" ? snapshot.canSurrenderByState : undefined,
  };
}

export function readActiveMatchSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    if (!raw) return null;
    return normalizeActiveMatchSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeActiveMatchSession(snapshot: ActiveMatchSession | null) {
  if (typeof window === "undefined") return;
  if (!snapshot) {
    window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    clearActiveDepositIntent();
    return;
  }
  window.localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearActiveMatchRoomSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
}

export function getMatchSessionAddress(snapshot: ActiveMatchSession | null) {
  if (!snapshot) return "";
  return snapshot.walletAddress?.trim() || snapshot.address?.trim() || "";
}

export function getMatchSessionToken(snapshot: ActiveMatchSession | null) {
  if (!snapshot) return null;
  return snapshot.token?.trim() || snapshot.arenaToken?.trim() || null;
}

export function isGuestBotMatchSession(snapshot: ActiveMatchSession | null) {
  return snapshot?.isGuest === true && snapshot.roomType === "bot";
}

export function isLiveMatchSession(snapshot: ActiveMatchSession | null) {
  if (!snapshot?.roomId) return false;
  return snapshot.status === "playing" || typeof snapshot.canSurrenderByState === "boolean";
}

export function readLobbyDraftSnapshot(): LobbyDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LOBBY_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as LobbyDraftSnapshot;
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

export function writeLobbyDraftSnapshot(snapshot: LobbyDraftSnapshot) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOBBY_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearMatchSessionState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_BLINK_CHALLENGE_STORAGE_KEY);
  window.sessionStorage.removeItem(LOBBY_DRAFT_STORAGE_KEY);
  clearActiveDepositIntent();
}

export function writeActiveDepositIntent(intent: ActiveDepositIntent) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function readActiveDepositIntent(roomId: string, address: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as Partial<ActiveDepositIntent>;
    if (intent.roomId !== roomId || intent.address !== address) return null;
    return typeof intent.signature === "string" && intent.signature ? intent.signature : null;
  } catch {
    return null;
  }
}

export function clearActiveDepositIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY);
}
