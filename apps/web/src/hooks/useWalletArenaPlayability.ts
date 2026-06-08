"use client";

import { useEffect, useMemo, useState } from "react";
import { getWalletArenaPlayability } from "@/lib/history/historyApi";
import type { WalletPlayability } from "@/lib/history/historyTypes";

type UseWalletArenaPlayabilityParams = {
  address: string;
  arenaId: string;
  token: string;
  enabled?: boolean;
};

type PlayabilityTone = "ready" | "warning" | "muted";

function resolvePlayabilityLabel(
  playability: WalletPlayability | null,
  loading: boolean,
  error: string | null,
  token: string,
  enabled: boolean,
) {
  if (!enabled) return { label: "Inspect wallet", tone: "muted" as PlayabilityTone };
  if (loading) return { label: "Inspecting Wallet...", tone: "muted" as PlayabilityTone };
  if (error) return { label: "Unable to inspect", tone: "warning" as PlayabilityTone };
  if (!playability) return { label: "Inspect wallet", tone: "muted" as PlayabilityTone };
  if (!playability.reliable) return { label: "Unable to inspect", tone: "warning" as PlayabilityTone };
  if (!playability.playable) return { label: `Needs ${token}`, tone: "warning" as PlayabilityTone };
  return { label: "Playable", tone: "ready" as PlayabilityTone };
}

export function useWalletArenaPlayability({
  address,
  arenaId,
  token,
  enabled = true,
}: UseWalletArenaPlayabilityParams) {
  const [playability, setPlayability] = useState<WalletPlayability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    getWalletArenaPlayability({ address, arenaId, token })
      .then((result) => {
        if (cancelled) return;
        setPlayability(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to inspect wallet right now.";
        setError(message);
        setPlayability(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, arenaId, token, enabled]);

  const playabilityStatus = useMemo(
    () => resolvePlayabilityLabel(playability, loading, error, token, enabled),
    [playability, loading, error, token, enabled],
  );

  return {
    playability: enabled ? playability : null,
    loading: enabled ? loading : false,
    error: enabled ? error : null,
    statusLabel: playabilityStatus.label,
    statusTone: playabilityStatus.tone,
  };
}
