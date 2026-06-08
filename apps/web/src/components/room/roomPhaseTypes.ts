export type RoomPhase =
  | "setup"
  | "matchmaking"
  | "depositing"
  | "selecting_character"
  | "playing"
  | "finished"
  | "error";

export type RoomPhaseLabel = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export const ROOM_PHASE_LABELS: Record<RoomPhase, RoomPhaseLabel> = {
  setup: {
    eyebrow: "Setup",
    title: "Prepare your match",
    subtitle: "Choose arena and wager before entering the room flow.",
  },
  matchmaking: {
    eyebrow: "Matchmaking",
    title: "Finding opponent",
    subtitle: "We are pairing you with another player in the selected arena.",
  },
  depositing: {
    eyebrow: "Depositing",
    title: "Confirm wager",
    subtitle: "Sign deposit in wallet before the room can continue.",
  },
  selecting_character: {
    eyebrow: "Character Lock",
    title: "Lock your character",
    subtitle: "Both players must lock a character before the match starts.",
  },
  playing: {
    eyebrow: "Playing",
    title: "Battle in progress",
    subtitle: "Answer cards quickly and control the arena.",
  },
  finished: {
    eyebrow: "Finished",
    title: "Match complete",
    subtitle: "Review results and settlement status.",
  },
  error: {
    eyebrow: "Error",
    title: "Room interrupted",
    subtitle: "Something went wrong. Reconnect or return to lobby.",
  },
};
