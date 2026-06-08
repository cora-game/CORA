// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { authority, fetchSession, formatAnchorError } from "./helpers/battleTestUtils";
import {
  assertMagicBlockLocalStackEnv,
  baseProgram,
  describeMagicBlockLocalStack,
  fetchOwner,
  localValidatorIdentity,
  waitForCondition,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  applyEffectOnErWithRetry,
  createMagicBlockBattleFixture,
  delegateBattleSessionAndCard,
  undelegateCardAndSession,
  waitForDelegatedSessionAndCard,
} from "./helpers/magicblockFlowUtils";

async function expectTxError(
  run: () => Promise<unknown>,
  expectedText: string
): Promise<void> {
  try {
    await run();
    expect.fail(`Expected error including "${expectedText}"`);
  } catch (error: any) {
    expect(formatAnchorError(error)).to.include(expectedText);
  }
}

describeMagicBlockLocalStack("magicblock authz + edge guards", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("rejects unauthorized payer on delegate_battle_session", async () => {
    const outsider = Keypair.generate();
    const { sessionPda } = await createMagicBlockBattleFixture();

    const instruction = await baseProgram.methods
      .delegateBattleSession()
      .accounts({
        payer: outsider.publicKey,
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

    const transaction = new anchor.web3.Transaction().add(instruction);
    await expectTxError(
      () => baseProgram.provider.sendAndConfirm(transaction, [outsider]),
      "UnauthorizedAuthority"
    );
  });

  it("rejects unauthorized payer on delegate_registered_card", async () => {
    const outsider = Keypair.generate();
    const { sessionPda, cardId, cardPda } = await createMagicBlockBattleFixture();

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

    await baseProgram.provider.sendAndConfirm(
      new anchor.web3.Transaction().add(delegateSessionIx),
      []
    );

    const delegateCardIx = await baseProgram.methods
      .delegateRegisteredCard(cardId)
      .accounts({
        payer: outsider.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .remainingAccounts([
        {
          pubkey: localValidatorIdentity,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const transaction = new anchor.web3.Transaction().add(delegateCardIx);
    await expectTxError(
      () => baseProgram.provider.sendAndConfirm(transaction, [outsider]),
      "UnauthorizedAuthority"
    );
  });

  it("undelegate path commits state even without explicit commit calls", async () => {
    const { sessionPda, cardId, cardPda } = await createMagicBlockBattleFixture();
    await delegateBattleSessionAndCard({ sessionPda, cardPda, cardId });
    await waitForDelegatedSessionAndCard({ sessionPda, cardPda });
    await applyEffectOnErWithRetry({ sessionPda, cardPda, finalValue: 25, scoreDelta: 90 });

    await undelegateCardAndSession({ sessionPda, cardPda });

    await waitForCondition("undelegate should restore base owners", async () => {
      const sessionOwner = await fetchOwner(baseProgram, sessionPda);
      const cardOwner = await fetchOwner(baseProgram, cardPda);
      return (
        sessionOwner?.equals(baseProgram.programId) &&
        cardOwner?.equals(baseProgram.programId)
      );
    });

    await waitForCondition("undelegate should persist ER state", async () => {
      const baseSession = await fetchSession(sessionPda);
      return (
        baseSession.healthB === 75 &&
        baseSession.gameScoreA === 90 &&
        baseSession.totalPlays === 1
      );
    });
  });
});
