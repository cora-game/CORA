import { createHash } from 'crypto';
import type { Question } from '@shared/question';

/**
 * Derives a deterministic 32-byte question hash from a match deck.
 *
 * Sorts question IDs lexicographically and hashes the concatenation.
 * This produces a unique, verifiable fingerprint of the question set
 * that can be committed on-chain via the ER session.
 */
export function deriveQuestionHash(questions: Question[]): Uint8Array {
  const sortedIds = questions.map(q => q.id).sort();
  const hash = createHash('sha256').update(sortedIds.join(',')).digest();
  return new Uint8Array(hash);
}
