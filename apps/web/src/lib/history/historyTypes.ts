export type MatchHistoryItem = {
  id: string;
  signature: string;
  timestamp: string;
  arenaId: string;
  token: string;
  wagerUsd?: string;
  result?: "win" | "loss" | "draw" | "unknown";
  opponent?: string;
  settlementStatus?: "settled" | "pending" | "failed" | "unknown";
  explorerUrl?: string;
};

export type WalletPlayability = {
  playable: boolean;
  reason?: string;
  tokenBalance?: string;
  requiredBalance?: string;
  lastCheckedAt?: string;
  reliable?: boolean;
};

