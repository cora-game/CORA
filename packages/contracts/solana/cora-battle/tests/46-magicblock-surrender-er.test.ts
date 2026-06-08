// @ts-nocheck
import { expect } from "chai";

import { TEST_CONSTANTS, fetchSession } from "./helpers/battleTestUtils";
import {
  assertMagicBlockLocalStackEnv,
  describeMagicBlockLocalStack,
  ephemeralProgram,
  waitForMagicBlockRpcReady,
} from "./helpers/magicblockLocalStackUtils";
import {
  commitAndUndelegateSessionOnly,
  createInlineManifestMagicBlockFixture,
  delegateBattleSessionOnly,
  surrenderMatchOnErWithRetry,
  waitForDelegatedSession,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock surrender_match on ER", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("finishes on ER and syncs the winner back to base after commit", async () => {
    const { sessionPda, playerA, playerB } = await createInlineManifestMagicBlockFixture();
    await delegateBattleSessionOnly(sessionPda);
    await waitForDelegatedSession(sessionPda);

    await surrenderMatchOnErWithRetry({
      sessionPda,
      surrenderingPlayer: playerA.publicKey,
    });

    const erSession = await ephemeralProgram.account.battleSession.fetch(sessionPda);
    expect(Object.keys(erSession.status)[0]).to.equal("finished");
    expect(erSession.winner.toBase58()).to.equal(playerB.publicKey.toBase58());
    expect(erSession.endReason).to.equal(TEST_CONSTANTS.endReasonSurrender);

    await commitAndUndelegateSessionOnly(sessionPda);

    const baseSession = await fetchSession(sessionPda);
    expect(Object.keys(baseSession.status)[0]).to.equal("finished");
    expect(baseSession.winner.toBase58()).to.equal(playerB.publicKey.toBase58());
    expect(baseSession.endReason).to.equal(TEST_CONSTANTS.endReasonSurrender);
  });
});
