// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  assertMagicBlockLocalStackEnv,
  baseProgram,
  describeMagicBlockLocalStack,
  fetchOwner,
  waitForCondition,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  applyEffectOnErWithRetry,
  commitCardAndSession,
  createMagicBlockBattleFixture,
  delegateBattleSessionAndCard,
  undelegateCardAndSession,
  waitForDelegatedSessionAndCard,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock undelegate lifecycle", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("restores account owners to program after undelegation", async () => {
    const { sessionPda, cardId, cardPda } = await createMagicBlockBattleFixture();
    await delegateBattleSessionAndCard({ sessionPda, cardPda, cardId });
    await waitForDelegatedSessionAndCard({ sessionPda, cardPda });
    await applyEffectOnErWithRetry({
      sessionPda,
      cardPda,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 120,
    });
    await commitCardAndSession({ sessionPda, cardPda });

    await undelegateCardAndSession({ sessionPda, cardPda });

    await waitForCondition("battle session owner restored on base", async () => {
      const owner = await fetchOwner(baseProgram, sessionPda);
      return owner?.equals(baseProgram.programId) ?? false;
    });
    await waitForCondition("registered card owner restored on base", async () => {
      const owner = await fetchOwner(baseProgram, cardPda);
      return owner?.equals(baseProgram.programId) ?? false;
    });

    const restoredSessionOwner = await fetchOwner(baseProgram, sessionPda);
    const restoredCardOwner = await fetchOwner(baseProgram, cardPda);
    expect(restoredSessionOwner?.toBase58()).to.equal(baseProgram.programId.toBase58());
    expect(restoredCardOwner?.toBase58()).to.equal(baseProgram.programId.toBase58());
  });
});
