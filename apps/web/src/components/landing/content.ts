export type LandingAccent = "primary" | "secondary";

export type ScientistStat = {
  label: string;
  value: number;
};

export type ScientistProfile = {
  id: string;
  name: string;
  short: string;
  detail: string;
  archetype: string;
  baseConcept: string;
  baseEmoji: string;
  emoji: string;
  accent: LandingAccent;
  stats: ScientistStat[];
};

export type LandingStage = {
  id: string;
  label: string;
  domain: string;
  accent: LandingAccent;
  title: string;
  summary: string;
  stat: string;
};

export type LandingTickerItem = {
  label: string;
  detail: string;
  accent: LandingAccent | "neutral";
};

export const LANDING_SCIENTISTS: ScientistProfile[] = [
  {
    id: "einstein",
    name: "Albert Einstein",
    short: "Math Specialty and High-Damage Timing",
    detail:
      "Specializes in math questions. Correct math answers trigger a 1.5x specialty multiplier, which can stack with the extra-point phase for up to 3x total power.",
    archetype: "Mathematician",
    baseConcept: "The Equation Board",
    baseEmoji: "🌀",
    emoji: "🧠",
    accent: "primary",
    stats: [
      { label: "Logic", value: 92 },
      { label: "Memory", value: 74 },
      { label: "Focus", value: 78 },
      { label: "Speed", value: 58 },
    ],
  },
  {
    id: "curie",
    name: "Marie Curie",
    short: "Logical Specialty and Reliable Pressure",
    detail:
      "Specializes in logical questions. Correct logical answers trigger a 1.5x specialty multiplier, making her strongest when the category matches her specialty.",
    archetype: "Logician",
    baseConcept: "The Laboratory",
    baseEmoji: "☢️",
    emoji: "🧪",
    accent: "secondary",
    stats: [
      { label: "Logic", value: 76 },
      { label: "Memory", value: 94 },
      { label: "Focus", value: 86 },
      { label: "Speed", value: 52 },
    ],
  },
  {
    id: "turing",
    name: "Alan Turing",
    short: "Sequence Specialty and Fast Conversion",
    detail:
      "Specializes in sequence questions. Correct sequence answers trigger a 1.5x specialty multiplier, which can combine with the extra-point phase for bigger swings.",
    archetype: "Pattern Runner",
    baseConcept: "The Computer",
    baseEmoji: "💻",
    emoji: "⚡",
    accent: "primary",
    stats: [
      { label: "Logic", value: 89 },
      { label: "Memory", value: 81 },
      { label: "Focus", value: 72 },
      { label: "Speed", value: 88 },
    ],
  },
];

export const LANDING_STAGES: LandingStage[] = [
  {
    id: "01",
    label: "Enter the Queue",
    domain: "Arena",
    accent: "primary",
    title: "Find your rival",
    summary:
      "Step into the arena queue and get matched with a worthy opponent. The arena pairs two minds and opens the battlefield.",
    stat: "Matchmaking",
  },
  {
    id: "02",
    label: "Lock Your Wager",
    domain: "Blockchain",
    accent: "secondary",
    title: "Stake your confidence",
    summary:
      "Both players lock tokens into the arena vault. A smart contract seals the wager until the duel is settled.",
    stat: "Vault Sealed",
  },
  {
    id: "03",
    label: "Battle Begins",
    domain: "Arena",
    accent: "primary",
    title: "Three rounds of mind games",
    summary:
      "Attack, heal, outsmart. Use action cards fueled by your scientist's abilities. Correct answers deal damage — wrong ones leave you exposed.",
    stat: "3 Rounds",
  },
  {
    id: "04",
    label: "Victor Takes All",
    domain: "Blockchain",
    accent: "secondary",
    title: "The arena settles the score",
    summary:
      "The result is signed and verified on-chain. The winner claims the prize pool, and the arena takes its cut.",
    stat: "Settled",
  },
];

export const LANDING_TICKER_ITEMS: LandingTickerItem[] = [
  { label: "Einstein", detail: "Equation Board ready", accent: "primary" },
  { label: "Curie", detail: "Laboratory charged", accent: "secondary" },
  { label: "Turing", detail: "Computer active", accent: "primary" },
  { label: "Arena", detail: "2 minds matched", accent: "neutral" },
  { label: "Vault", detail: "Wager locked", accent: "secondary" },
  { label: "Battle", detail: "3 rounds live", accent: "primary" },
];

export type WagerToken = {
  symbol: string;
  name: string;
  icon: string;
  /** Tailwind-compatible hex or CSS colour used for the pill glow + border */
  color: string;
};

export const WAGER_TOKENS: WagerToken[] = [
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", color: "#627EEA" },
  { symbol: "USDC", name: "USD Coin", icon: "$", color: "#2775CA" },
];
