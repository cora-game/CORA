/**
 * Character specialty definitions — single source of truth for both
 * backend (GameEngine) and frontend (CharacterSelect).
 *
 * Each character has a specialty category. When a player answers a question
 * from their specialty category correctly, damage/heal is multiplied by the
 * specialtyMultiplier (1.5x). This stacks multiplicatively with the
 * extra-point phase multiplier (2x), yielding up to 3x.
 */

export type QuestionCategory = 'sequence' | 'logical' | 'math';

export interface CharacterDef {
  id: string;
  name: string;
  specialty: QuestionCategory;
  /** Multiplier applied when the question category matches this character's specialty */
  specialtyMultiplier: number;
}

export const CHARACTER_DEFS: Record<string, CharacterDef> = {
  turing: { id: 'turing', name: 'Alan Turing',   specialty: 'sequence', specialtyMultiplier: 1.5 },
  curie:  { id: 'curie',  name: 'Marie Curie',   specialty: 'logical',  specialtyMultiplier: 1.5 },
  einstein: { id: 'einstein', name: 'Albert Einstein', specialty: 'math',     specialtyMultiplier: 1.5 },
};

export const MAX_SPECIALTY_MULTIPLIER = Math.max(
  1,
  ...Object.values(CHARACTER_DEFS).map((character) => character.specialtyMultiplier),
);

/**
 * Returns the specialty multiplier for a character answering a question
 * from a given category. Returns 1 if no specialty match.
 */
export function getSpecialtyMultiplier(characterId: string, questionCategory: QuestionCategory): number {
  const def = CHARACTER_DEFS[characterId];
  if (!def) return 1;
  return def.specialty === questionCategory ? def.specialtyMultiplier : 1;
}
