import type { LandingAccent } from "./content";

export type LandingAccentStyle = {
  accent: string;
  dim: string;
  glow: string;
};

export function getLandingAccentStyle(accent: LandingAccent): LandingAccentStyle {
  if (accent === "secondary") {
    return {
      accent: "var(--accent-secondary)",
      dim: "var(--accent-secondary-dim)",
      glow: "var(--accent-secondary-glow)",
    };
  }

  return {
    accent: "var(--accent-primary)",
    dim: "var(--accent-primary-dim)",
    glow: "var(--accent-primary-glow)",
  };
}

export const LANDING_TICKER_ACCENT_COLOR = {
  primary:   "#f8d694",
  secondary: "#fcd8c0",
  neutral:   "#dbb98b",
} as const;