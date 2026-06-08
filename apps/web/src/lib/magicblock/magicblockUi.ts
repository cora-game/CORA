export type MagicBlockUiTone = "magicblock" | "standard" | "neutral";

export type MagicBlockUiState = {
  tone: MagicBlockUiTone;
  badgeLabel: string;
  title: string;
  detail: string;
  progress: number | null;
  showPulse: boolean;
};

type DepositMagicBlockUiParams = {
  erEnabled?: boolean;
  erStatus?: string | null;
  status?: string | null;
  effectiveRole?: "playerA" | "playerB" | null;
  signingState?: "idle" | "signing" | "waiting" | "error";
  depositUnlockedAt?: number | null;
};

type SettlementMagicBlockUiParams = {
  erEnabled?: boolean;
  erStatus?: string | null;
  isMatchComplete?: boolean;
  hasSettlementResult?: boolean;
};

function normalizeErStatus(erStatus?: string | null) {
  return erStatus?.trim().toLowerCase() || null;
}

function isFailedErStatus(erStatus?: string | null) {
  const status = normalizeErStatus(erStatus);
  return status === "failed" || status === "cancelled";
}

function isActiveMagicBlockStatus(erStatus?: string | null) {
  const status = normalizeErStatus(erStatus);
  return Boolean(status && status !== "none" && !isFailedErStatus(status));
}

function getStandardDepositUi(params: DepositMagicBlockUiParams): MagicBlockUiState {
  const { status, effectiveRole, signingState, depositUnlockedAt } = params;

  if (effectiveRole === "playerB" && !depositUnlockedAt && signingState !== "signing") {
    return {
      tone: "standard",
      badgeLabel: "Standard Arena",
      title: "Waiting for Player A",
      detail: "Your deposit slot unlocks once the first wager is confirmed.",
      progress: 25,
      showPulse: false,
    };
  }

  return {
    tone: "standard",
    badgeLabel: "Standard Arena",
    title: status === "playing" ? "Battle ready" : "Preparing the duel",
    detail:
      status === "playing"
        ? "Both deposits are confirmed."
        : "Verifying both wager intents before battle start.",
    progress: status === "playing" ? 100 : 55,
    showPulse: status !== "playing",
  };
}

export function getDepositMagicBlockUi(params: DepositMagicBlockUiParams): MagicBlockUiState {
  const { erEnabled, erStatus, status } = params;
  const normalizedStatus = normalizeErStatus(erStatus);

  if (!erEnabled || isFailedErStatus(erStatus)) {
    return getStandardDepositUi(params);
  }

  if (!isActiveMagicBlockStatus(erStatus)) {
    return {
      tone: "neutral",
      badgeLabel: "Arena Sync",
      title: status === "playing" ? "Battle ready" : "Preparing the duel",
      detail:
        status === "playing"
          ? "Both deposits are confirmed."
          : "Waiting for the arena state to settle.",
      progress: status === "playing" ? 100 : 50,
      showPulse: status !== "playing",
    };
  }

  const phaseMap: Record<string, Omit<MagicBlockUiState, "tone" | "badgeLabel">> = {
    creating: {
      title: "Sealing the arena",
      detail: "Creating the battle session.",
      progress: 24,
      showPulse: true,
    },
    registering: {
      title: "Preparing the duel",
      detail: "Locking in the opening cards.",
      progress: 46,
      showPulse: true,
    },
    activating: {
      title: "Powering the arena",
      detail: "Starting the battle session.",
      progress: 68,
      showPulse: true,
    },
    delegating: {
      title: "Syncing the arena",
      detail: "Moving battle state into the fast lane.",
      progress: 86,
      showPulse: true,
    },
    active: {
      title: "Arena ready",
      detail: "Fast battle state is live.",
      progress: 100,
      showPulse: false,
    },
  };

  const phase = normalizedStatus && phaseMap[normalizedStatus]
    ? phaseMap[normalizedStatus]
    : {
        title: status === "playing" ? "Arena ready" : "Preparing the duel",
        detail: status === "playing" ? "Fast battle state is live." : "Syncing battle state.",
        progress: status === "playing" ? 100 : 60,
        showPulse: status !== "playing",
      };

  return {
    tone: "magicblock",
    badgeLabel: "Fast Arena",
    ...phase,
  };
}

export function getSettlementMagicBlockUi(params: SettlementMagicBlockUiParams): MagicBlockUiState {
  const { erEnabled, erStatus, isMatchComplete, hasSettlementResult } = params;
  const normalizedStatus = normalizeErStatus(erStatus);

  if (!erEnabled || isFailedErStatus(erStatus)) {
    return {
      tone: "standard",
      badgeLabel: "Standard Arena",
      title: hasSettlementResult ? "Result secured" : "Settling the result",
      detail:
        hasSettlementResult
          ? "Match outcome is finalized."
          : "Finalizing the match outcome.",
      progress: hasSettlementResult ? 100 : 72,
      showPulse: !hasSettlementResult,
    };
  }

  if (!isActiveMagicBlockStatus(erStatus)) {
    return {
      tone: "neutral",
      badgeLabel: "Arena Sync",
      title: hasSettlementResult ? "Result secured" : "Securing the result",
      detail:
        hasSettlementResult
          ? "Match outcome is finalized."
          : "Finalizing the match outcome.",
      progress: hasSettlementResult ? 100 : 70,
      showPulse: !hasSettlementResult,
    };
  }

  if (normalizedStatus === "committing") {
    return {
      tone: "magicblock",
      badgeLabel: "Fast Arena",
      title: "Settling the duel",
      detail: "Writing the final battle state.",
      progress: 78,
      showPulse: true,
    };
  }

  if (normalizedStatus === "finished" || isMatchComplete) {
    return {
      tone: "magicblock",
      badgeLabel: "Fast Arena",
      title: "Result secured",
      detail: "Fast proof and settlement are finalized.",
      progress: 100,
      showPulse: false,
    };
  }

  return {
    tone: "magicblock",
    badgeLabel: "Fast Arena",
    title: "Securing the result",
    detail: "Finalizing proof and payout.",
    progress: hasSettlementResult ? 92 : 70,
    showPulse: !hasSettlementResult,
  };
}
