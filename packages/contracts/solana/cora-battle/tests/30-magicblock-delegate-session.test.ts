// @ts-nocheck
import { expect } from "chai";

import {
  assertMagicBlockLocalStackEnv,
  describeMagicBlockLocalStack,
  ephemeralProgram,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  assertBaseAccountsOwnedByProgram,
  createMagicBlockBattleFixture,
  delegateBattleSessionOnly,
  waitForDelegatedSession,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock delegate_battle_session", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("delegates a battle session to ER", async () => {
    const { sessionPda } = await createMagicBlockBattleFixture();
    await assertBaseAccountsOwnedByProgram({ sessionPda });

    await delegateBattleSessionOnly(sessionPda);
    await waitForDelegatedSession(sessionPda);

    const delegatedSession =
      await ephemeralProgram.account.battleSession.fetch(sessionPda);
    expect(delegatedSession.currentRound).to.equal(1);
  });
});
