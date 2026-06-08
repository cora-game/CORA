import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';

export const CORA_ESCROW_PROGRAM_ID = new PublicKey(
  process.env.CORA_ESCROW_PROGRAM_ID || '8h5gHVN29FzmeJSbQXtrvEptxUmDKFag9BQCy3Ky1ZxN'
);

export const ESCROW_INSTRUCTION_DISCRIMINATORS = {
  depositWager: Buffer.from([234, 73, 235, 136, 168, 103, 239, 207]),
  initializeMatch: Buffer.from([156, 133, 52, 179, 176, 29, 64, 124]),
  settleMatch: Buffer.from([0x47, 0x7c, 0x75, 0x60, 0xbf, 0xd9, 0x74, 0x18]),
  createOpenChallenge: Buffer.from([238, 208, 117, 255, 0, 232, 161, 194]),
  acceptChallenge: Buffer.from([195, 227, 139, 241, 55, 193, 153, 105]),
  reclaimChallenge: Buffer.from([199, 39, 36, 43, 94, 134, 149, 57]),
} as const;

export const MATCH_STATE_LAYOUT = {
  playerA: [41, 73],
  playerB: [73, 105],
  tokenMint: [105, 137],
} as const;

export function anchorDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
