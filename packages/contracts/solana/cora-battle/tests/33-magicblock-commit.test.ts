// @ts-nocheck
import { expect } from "chai";

import { TEST_CONSTANTS, fetchSession } from "./helpers/battleTestUtils";
import {
  assertMagicBlockLocalStackEnv,
  describeMagicBlockLocalStack,
  waitForCondition,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  applyEffectOnErWithRetry,
  commitCardAndSession,
  createMagicBlockBattleFixture,
  delegateBattleSessionAndCard,
  waitForDelegatedSessionAndCard,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock commit state to base", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("commits ER session+card updates back to base layer", async () => {
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

    await waitForCondition("committed battle session values on base", async () => {
      const baseSession = await fetchSession(sessionPda);
      return (
        baseSession.healthB === TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue &&
        baseSession.gameScoreA === 120 &&
        baseSession.totalPlays === 1
      );
    });

    const committed = await fetchSession(sessionPda);
    expect(committed.healthB).to.equal(TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue);
  });
});
