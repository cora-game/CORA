// @ts-nocheck
import { expect } from "chai";

import { TEST_CONSTANTS } from "./helpers/battleTestUtils";
import {
  assertMagicBlockLocalStackEnv,
  describeMagicBlockLocalStack,
  ephemeralProgram,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  createMagicBlockBattleFixture,
  delegateBattleSessionAndCard,
  waitForDelegatedSessionAndCard,
  applyEffectOnErWithRetry,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock apply_card_effect on ER", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("executes apply_card_effect on delegated ER accounts", async () => {
    const { sessionPda, cardId, cardPda } = await createMagicBlockBattleFixture();
    await delegateBattleSessionAndCard({ sessionPda, cardPda, cardId });
    await waitForDelegatedSessionAndCard({ sessionPda, cardPda });

    await applyEffectOnErWithRetry({
      sessionPda,
      cardPda,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 120,
    });

    const session = await ephemeralProgram.account.battleSession.fetch(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue);
    expect(session.gameScoreA).to.equal(120);
    expect(session.totalPlays).to.equal(1);
  });
});
