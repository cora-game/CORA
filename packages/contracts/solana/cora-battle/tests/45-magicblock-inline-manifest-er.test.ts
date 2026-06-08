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
  applyInlineEffectOnErWithRetry,
  createInlineManifestMagicBlockFixture,
  delegateBattleSessionOnly,
  waitForDelegatedSession,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock apply_effect inline manifest on ER", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("executes apply_effect on a delegated battle session", async () => {
    const { sessionPda } = await createInlineManifestMagicBlockFixture();
    await delegateBattleSessionOnly(sessionPda);
    await waitForDelegatedSession(sessionPda);

    await applyInlineEffectOnErWithRetry({
      sessionPda,
      slot: 0,
      actorIsA: true,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 120,
    });

    const session = await ephemeralProgram.account.battleSession.fetch(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue);
    expect(session.gameScoreA).to.equal(120);
    expect(session.totalPlays).to.equal(1);
  });
});
