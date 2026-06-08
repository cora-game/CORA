// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  activateSession,
  authority,
  createSession,
  registerEffectCard,
  setCardManifest,
} from "./battleTestUtils";
import {
  baseProgram,
  confirmEphemeralAccountVisible,
  ephemeralProgram,
  fetchOwner,
  localValidatorIdentity,
  sendMagicRouterTransaction,
  waitForCondition,
} from "./magicblockLocalStackUtils";

export async function createMagicBlockBattleFixture() {
  const { sessionPda, playerA } = await createSession();
  const { cardId, cardPda } = await registerEffectCard({
    sessionPda,
    cardIndex: 0,
    owner: playerA.publicKey,
    effectType: TEST_CONSTANTS.effectAttack,
    maxValue: TEST_CONSTANTS.maxEffectValue,
  });

  await activateSession(sessionPda);
  return { sessionPda, cardId, cardPda };
}

export async function createInlineManifestMagicBlockFixture() {
  const session = await createSession();
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: true,
    entries: [{ effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue }],
  });
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: false,
    entries: [{ effectType: TEST_CONSTANTS.effectNone, maxValue: 0 }],
  });
  await activateSession(session.sessionPda);

  return session;
}

export async function assertBaseAccountsOwnedByProgram(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda?: anchor.web3.PublicKey;
}) {
  const sessionOwner = await fetchOwner(baseProgram, params.sessionPda);
  expect(sessionOwner?.toBase58()).to.equal(baseProgram.programId.toBase58());

  if (params.cardPda) {
    const cardOwner = await fetchOwner(baseProgram, params.cardPda);
    expect(cardOwner?.toBase58()).to.equal(baseProgram.programId.toBase58());
  }
}

export async function delegateBattleSessionOnly(sessionPda: anchor.web3.PublicKey) {
  const delegateSessionIx = await baseProgram.methods
    .delegateBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: sessionPda,
    })
    .remainingAccounts([
      {
        pubkey: localValidatorIdentity,
        isSigner: false,
        isWritable: false,
      },
    ])
    .instruction();

  const transaction = new anchor.web3.Transaction().add(delegateSessionIx);
  await baseProgram.provider.sendAndConfirm(transaction, []);
}

export async function delegateBattleSessionAndCard(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda: anchor.web3.PublicKey;
  cardId: number[];
}) {
  const delegateSessionIx = await baseProgram.methods
    .delegateBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .remainingAccounts([
      {
        pubkey: localValidatorIdentity,
        isSigner: false,
        isWritable: false,
      },
    ])
    .instruction();

  const delegateCardIx = await baseProgram.methods
    .delegateRegisteredCard(params.cardId)
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: params.cardPda,
    })
    .remainingAccounts([
      {
        pubkey: localValidatorIdentity,
        isSigner: false,
        isWritable: false,
      },
    ])
    .instruction();

  const transaction = new anchor.web3.Transaction().add(
    delegateSessionIx,
    delegateCardIx
  );
  await baseProgram.provider.sendAndConfirm(transaction, []);
}

export async function waitForDelegatedSession(sessionPda: anchor.web3.PublicKey) {
  await confirmEphemeralAccountVisible(sessionPda, "battleSession");
  await waitForCondition("delegated battle session ownership on ER", async () => {
    const owner = await fetchOwner(ephemeralProgram, sessionPda);
    return owner?.equals(ephemeralProgram.programId) ?? false;
  });
}

export async function waitForDelegatedSessionAndCard(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda: anchor.web3.PublicKey;
}) {
  await confirmEphemeralAccountVisible(params.sessionPda, "battleSession");
  await confirmEphemeralAccountVisible(params.cardPda, "registeredCard");
  await waitForCondition("delegated session+card ownership on ER", async () => {
    const sessionOwner = await fetchOwner(ephemeralProgram, params.sessionPda);
    const cardOwner = await fetchOwner(ephemeralProgram, params.cardPda);
    return (
      sessionOwner?.equals(ephemeralProgram.programId) &&
      cardOwner?.equals(ephemeralProgram.programId)
    );
  });
}

export async function applyEffectOnErWithRetry(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda: anchor.web3.PublicKey;
  finalValue?: number;
  scoreDelta?: number;
}) {
  const finalValue = params.finalValue ?? TEST_CONSTANTS.maxEffectValue;
  const scoreDelta = params.scoreDelta ?? 120;

  const builder = ephemeralProgram.methods
    .applyCardEffect(finalValue, scoreDelta)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: params.cardPda,
    });

  try {
    await builder.simulate();
  } catch {
    // The local stack can reject warm-up simulation before ER routing stabilizes.
  }

  await waitForCondition(
    "first ER apply_card_effect transaction",
    async () => {
      try {
        const tx = await builder.transaction();
        await sendMagicRouterTransaction(tx);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("cannot be written") ||
          message.includes("InvalidWritableAccount")
        ) {
          return false;
        }
        throw error;
      }
    },
    15_000,
    500
  );
}

export async function commitCardAndSession(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda: anchor.web3.PublicKey;
}) {
  const commitCardTx = await ephemeralProgram.methods
    .commitRegisteredCard()
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: params.cardPda,
    })
    .transaction();
  await sendMagicRouterTransaction(commitCardTx);

  const commitSessionTx = await ephemeralProgram.methods
    .commitBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .transaction();
  await sendMagicRouterTransaction(commitSessionTx);
}

export async function commitAndUndelegateSessionOnly(
  sessionPda: anchor.web3.PublicKey
) {
  const commitSessionTx = await ephemeralProgram.methods
    .commitBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: sessionPda,
    })
    .transaction();
  await sendMagicRouterTransaction(commitSessionTx);

  const undelegateSessionTx = await ephemeralProgram.methods
    .undelegateBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: sessionPda,
    })
    .transaction();
  await sendMagicRouterTransaction(undelegateSessionTx);
}

export async function undelegateCardAndSession(params: {
  sessionPda: anchor.web3.PublicKey;
  cardPda: anchor.web3.PublicKey;
}) {
  const undelegateCardTx = await ephemeralProgram.methods
    .undelegateRegisteredCard()
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: params.cardPda,
    })
    .transaction();
  await sendMagicRouterTransaction(undelegateCardTx);

  const undelegateSessionTx = await ephemeralProgram.methods
    .undelegateBattleSession()
    .accounts({
      payer: authority.publicKey,
      battleSession: params.sessionPda,
    })
    .transaction();
  await sendMagicRouterTransaction(undelegateSessionTx);
}

export async function applyInlineEffectOnErWithRetry(params: {
  sessionPda: anchor.web3.PublicKey;
  slot?: number;
  actorIsA?: boolean;
  finalValue?: number;
  scoreDelta?: number;
}) {
  const slot = params.slot ?? 0;
  const actorIsA = params.actorIsA ?? true;
  const finalValue = params.finalValue ?? TEST_CONSTANTS.maxEffectValue;
  const scoreDelta = params.scoreDelta ?? 120;

  const builder = ephemeralProgram.methods
    .applyEffect(slot, actorIsA, finalValue, scoreDelta)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
    });

  try {
    await builder.simulate();
  } catch {
    // The local stack can reject warm-up simulation before ER routing stabilizes.
  }

  await waitForCondition(
    "first ER apply_effect transaction",
    async () => {
      try {
        const tx = await builder.transaction();
        await sendMagicRouterTransaction(tx);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("cannot be written") ||
          message.includes("InvalidWritableAccount")
        ) {
          return false;
        }
        throw error;
      }
    },
    15_000,
    500
  );
}

export async function surrenderMatchOnErWithRetry(params: {
  sessionPda: anchor.web3.PublicKey;
  surrenderingPlayer: anchor.web3.PublicKey;
}) {
  const builder = ephemeralProgram.methods
    .surrenderMatch(params.surrenderingPlayer)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
    });

  try {
    await builder.simulate();
  } catch {
    // Warm-up simulation can fail before routing settles.
  }

  await waitForCondition(
    "ER surrender_match transaction",
    async () => {
      try {
        const tx = await builder.transaction();
        await sendMagicRouterTransaction(tx);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("cannot be written") ||
          message.includes("InvalidWritableAccount")
        ) {
          return false;
        }
        throw error;
      }
    },
    15_000,
    500
  );
}
