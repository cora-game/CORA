export type DepositStatus =
  | "idle"
  | "insufficient_funds"
  | "wallet_required"
  | "signing"
  | "submitted"
  | "practice"
  | "confirmed"
  | "waiting_opponent"
  | "opponent_failed"
  | "expired"
  | "error";

export type DepositStatusMeta = {
  label: string;
  helper: string;
};

export const DEPOSIT_STATUS_META: Record<DepositStatus, DepositStatusMeta> = {
  idle: {
    label: "Sign Deposit",
    helper: "Ready to sign your wager intent.",
  },
  insufficient_funds: {
    label: "Insufficient Balance",
    helper: "Your wallet doesn't have enough funds to cover the wager and fees.",
  },
  wallet_required: {
    label: "Connect Wallet",
    helper: "Connect Phantom wallet before signing.",
  },
  signing: {
    label: "Signing In Wallet...",
    helper: "Confirm this transaction in Phantom.",
  },
  submitted: {
    label: "Deposit Submitted",
    helper: "Deposit signature captured. Verifying room state.",
  },
  practice: {
    label: "Practice Match",
    helper: "No deposit needed. Preparing the arena.",
  },
  confirmed: {
    label: "Deposit Confirmed",
    helper: "Deposit acknowledged. Waiting for match start.",
  },
  waiting_opponent: {
    label: "Waiting For Opponent...",
    helper: "Your deposit is signed. Waiting for opponent.",
  },
  opponent_failed: {
    label: "Opponent Failed Deposit",
    helper: "Opponent did not deposit in time.",
  },
  expired: {
    label: "Deposit Window Expired",
    helper: "Deposit phase expired. Return to queue.",
  },
  error: {
    label: "Retry Deposit",
    helper: "Deposit signing failed. Retry when ready.",
  },
};
