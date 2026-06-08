// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program, IdlAccounts } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { expect } from "chai";

import idl from "../../target/idl/cora_battle.json";
import { CoraBattle } from "../../target/types/cora_battle";

export const DECLARED_BATTLE_PROGRAM_ID =
  "Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic";

const correctedIdl = {
  ...idl,
  address: DECLARED_BATTLE_PROGRAM_ID,
};

export const TEST_CONSTANTS = {
  initialHealth: 100,
  maxRounds: 3,
  roundsToWin: 2,
  roundDurationSeconds: 180,
  minDamage: 1,
  maxDamage: 100,
  baseDamage: 16,
  baseHeal: 8,
  maxEffectMultiplier: 3,
  maxAttackEffectValue: 48,
  maxHealEffectValue: 24,
  maxEffectValue: 48,
  maxScoreDelta: 10_000,
  maxCardSlots: 128,
  manifestEntrySize: 3,
  maxScoreMultiplier: 100,
  sessionTimeout: 900,
  effectAttack: 1,
  effectHeal: 2,
  effectNone: 3,
  endReasonNone: 0,
  endReasonNormalWin: 1,
  endReasonSinglePlayerTimeout: 2,
  endReasonBothPlayersTimeout: 3,
  endReasonServerCancelled: 4,
  endReasonCheaterFlagged: 5,
  endReasonForceEnded: 6,
  endReasonDrawNoContest: 7,
  endReasonSurrender: 8,
} as const;

export type BattleSessionAccount = IdlAccounts<CoraBattle>["battleSession"];
export type RegisteredCardAccount = IdlAccounts<CoraBattle>["registeredCard"];

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = new anchor.Program<CoraBattle>(
  correctedIdl as CoraBattle,
  provider
);
export const authority = provider.wallet as anchor.Wallet;

export function makeMatchId(): number[] {
  return Array.from(Keypair.generate().publicKey.toBytes());
}

export function makeQuestionHash(fill = 7): number[] {
  return Array(32).fill(fill);
}

export function makeCardId(index: number): number[] {
  const cardId = Array(16).fill(0);
  cardId[0] = index;
  return cardId;
}

export function findBattlePda(matchId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("battle"), Buffer.from(matchId)],
    program.programId
  );
}

export function findCardPda(
  sessionPda: PublicKey,
  cardId: number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("card"), sessionPda.toBuffer(), Buffer.from(cardId)],
    program.programId
  );
}

export function battleStatusName(status: BattleSessionAccount["status"]): string {
  return Object.keys(status)[0] ?? "";
}

export function packManifestSlot(effectType: number, maxValue: number): number[] {
  const normalizedMaxValue = Math.max(0, Math.min(0xffff, maxValue));
  return [
    effectType,
    normalizedMaxValue & 0xff,
    (normalizedMaxValue >> 8) & 0xff,
  ];
}

export function packManifest(
  entries: Array<{ effectType: number; maxValue: number }>
): number[] {
  return entries.flatMap((entry) =>
    packManifestSlot(entry.effectType, entry.maxValue)
  );
}

export async function expectAnchorError(
  promise: Promise<unknown>,
  expectedText: string
): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected error including "${expectedText}"`);
  } catch (error: any) {
    const errorText = formatAnchorError(error);

    expect(errorText).to.include(expectedText);
  }
}

export function formatAnchorError(error: any): string {
  return [
    error?.error?.errorCode?.code,
    error?.error?.errorMessage,
    error?.logs?.join("\n"),
    error?.toString?.(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value && typeof (value as any).toNumber === "function") {
    return (value as any).toNumber();
  }
  if (value && typeof (value as any).toString === "function") {
    return Number((value as any).toString());
  }
  return Number(value);
}

export async function tryWarpForwardSlots(slotsToAdvance: number): Promise<boolean> {
  const connection: any = provider.connection as any;
  const currentSlot = await provider.connection.getSlot("processed");
  const targetSlot = currentSlot + Math.max(1, Math.floor(slotsToAdvance));

  for (const method of ["warpSlot", "warp_slot"]) {
    try {
      const response = await connection._rpcRequest(method, [targetSlot]);
      if (!response?.error) {
        return true;
      }
    } catch {
      // Keep trying alternative method names.
    }
  }

  return false;
}

export async function getChainUnixTimestamp(): Promise<number | null> {
  const slot = await provider.connection.getSlot("processed");
  const blockTime = await provider.connection.getBlockTime(slot);
  return blockTime ?? null;
}

export async function warpPastUnixTimestamp(
  targetUnixTimestamp: number,
  options?: {
    slotsPerStep?: number;
    maxAttempts?: number;
  }
): Promise<boolean> {
  const slotsPerStep = options?.slotsPerStep ?? 800;
  const maxAttempts = options?.maxAttempts ?? 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const now = await getChainUnixTimestamp();
    if (now !== null && now >= targetUnixTimestamp) {
      return true;
    }

    const warped = await tryWarpForwardSlots(slotsPerStep);
    if (!warped) {
      return false;
    }
  }

  const now = await getChainUnixTimestamp();
  return now !== null && now >= targetUnixTimestamp;
}

export async function waitUntilUnixTimestamp(
  targetUnixTimestamp: number,
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
  }
): Promise<boolean> {
  const pollIntervalMs = options?.pollIntervalMs ?? 1_000;
  const timeoutMs = options?.timeoutMs ?? 1_200_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const now = await getChainUnixTimestamp();
    if (now !== null && now >= targetUnixTimestamp) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

export async function airdropSol(
  publicKey: PublicKey,
  lamports = LAMPORTS_PER_SOL
): Promise<void> {
  try {
    const signature = await provider.connection.requestAirdrop(publicKey, lamports);
    await provider.connection.confirmTransaction(signature, "confirmed");
    return;
  } catch (error) {
    const payer = (authority as any).payer as Keypair | undefined;
    if (!payer) {
      throw error;
    }

    const transferTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: publicKey,
        lamports,
      })
    );

    await provider.sendAndConfirm(transferTx, [payer]);
  }
}

export async function createSession(params?: {
  matchId?: number[];
  questionHash?: number[];
  playerA?: Keypair;
  playerB?: Keypair;
}) {
  const matchId = params?.matchId ?? makeMatchId();
  const questionHash = params?.questionHash ?? makeQuestionHash();
  const playerA = params?.playerA ?? Keypair.generate();
  const playerB = params?.playerB ?? Keypair.generate();
  const [sessionPda] = findBattlePda(matchId);

  await program.methods
    .createSession(matchId, questionHash)
    .accounts({
      authority: authority.publicKey,
      playerA: playerA.publicKey,
      playerB: playerB.publicKey,
      battleSession: sessionPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { matchId, questionHash, playerA, playerB, sessionPda };
}

export async function activateSession(sessionPda: PublicKey): Promise<void> {
  await ensureInlineManifestCommitted(sessionPda);

  await program.methods
    .activateSession()
    .accounts({
      authority: authority.publicKey,
      battleSession: sessionPda,
    })
    .rpc();
}

export async function registerLegacyCard(params: {
  sessionPda: PublicKey;
  cardIndex: number;
  damage: number;
}) {
  const cardId = makeCardId(params.cardIndex);
  const [cardPda] = findCardPda(params.sessionPda, cardId);

  await program.methods
    .registerCard(cardId, params.damage)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: cardPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { cardId, cardPda };
}

export async function registerEffectCard(params: {
  sessionPda: PublicKey;
  cardIndex: number;
  owner: PublicKey;
  effectType: number;
  maxValue: number;
}) {
  const cardId = makeCardId(params.cardIndex);
  const [cardPda] = findCardPda(params.sessionPda, cardId);

  await program.methods
    .registerCardV2(
      cardId,
      params.owner,
      params.effectType,
      params.maxValue
    )
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: cardPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { cardId, cardPda };
}

export async function setCardManifest(params: {
  sessionPda: PublicKey;
  isPlayerA: boolean;
  entries: Array<{ effectType: number; maxValue: number }>;
}) {
  const manifest = Buffer.from(packManifest(params.entries));

  await program.methods
    .setCardManifest(params.isPlayerA, params.entries.length, manifest)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .rpc();
}

export async function applyInlineEffect(params: {
  sessionPda: PublicKey;
  slot: number;
  actorIsA: boolean;
  finalValue: number;
  scoreDelta: number;
}) {
  await program.methods
    .applyEffect(
      params.slot,
      params.actorIsA,
      params.finalValue,
      params.scoreDelta
    )
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .rpc();
}

export async function surrenderMatch(params: {
  sessionPda: PublicKey;
  surrenderingPlayer: PublicKey;
}) {
  await program.methods
    .surrenderMatch(params.surrenderingPlayer)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .rpc();
}

export async function fetchSession(
  sessionPda: PublicKey
): Promise<BattleSessionAccount> {
  return program.account.battleSession.fetch(sessionPda);
}

export async function fetchCard(
  cardPda: PublicKey
): Promise<RegisteredCardAccount> {
  return program.account.registeredCard.fetch(cardPda);
}

export async function createActivatedLegacyBattle(params?: {
  playerA?: Keypair;
  playerB?: Keypair;
  cardDamages?: number[];
}) {
  const session = await createSession({
    playerA: params?.playerA,
    playerB: params?.playerB,
  });
  const cardDamages = params?.cardDamages ?? [25, 25, 25, 25];
  const cardPdas: PublicKey[] = [];

  for (const [index, damage] of cardDamages.entries()) {
    const { cardPda } = await registerLegacyCard({
      sessionPda: session.sessionPda,
      cardIndex: index,
      damage,
    });
    cardPdas.push(cardPda);
  }

  await activateSession(session.sessionPda);

  return {
    ...session,
    cardPdas,
  };
}

export async function createFinishedKoBattle() {
  const playerA = Keypair.generate();
  const playerB = Keypair.generate();
  const session = await createActivatedLegacyBattle({
    playerA,
    playerB,
    cardDamages: [100, 100],
  });

  await program.methods
    .applyDamage(playerA.publicKey)
    .accounts({
      authority: authority.publicKey,
      battleSession: session.sessionPda,
      registeredCard: session.cardPdas[0],
    })
    .rpc();

  await program.methods
    .applyDamage(playerA.publicKey)
    .accounts({
      authority: authority.publicKey,
      battleSession: session.sessionPda,
      registeredCard: session.cardPdas[1],
    })
    .rpc();

  return {
    ...session,
    playerA,
    playerB,
  };
}

async function ensureInlineManifestCommitted(sessionPda: PublicKey): Promise<void> {
  const session = await fetchSession(sessionPda);

  if (!session.manifestCommittedA) {
    await setCardManifest({
      sessionPda,
      isPlayerA: true,
      entries: [{ effectType: TEST_CONSTANTS.effectNone, maxValue: 0 }],
    });
  }

  if (!session.manifestCommittedB) {
    await setCardManifest({
      sessionPda,
      isPlayerA: false,
      entries: [{ effectType: TEST_CONSTANTS.effectNone, maxValue: 0 }],
    });
  }
}
