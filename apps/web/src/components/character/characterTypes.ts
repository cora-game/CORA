

export type CharacterOption = {
  id: string;
  name: string;
  base: string;
  accentColor: string;
  portraitBg: string;
  initial: string;
};

export type CharacterSelectMode = "pre_queue" | "post_deposit";

export type OpponentCharacterStatus =
  | "hidden"
  | "waiting"
  | "picked"
  | "locked"
  | "auto_assigned";

export type CharacterSelectionState =
  | "idle"
  | "selected"
  | "locked"
  | "auto_assigned"
  | "expired";
