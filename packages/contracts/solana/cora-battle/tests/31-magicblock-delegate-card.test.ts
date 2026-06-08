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
  delegateBattleSessionAndCard,
  waitForDelegatedSessionAndCard,
} from "./helpers/magicblockFlowUtils";

describeMagicBlockLocalStack("magicblock delegate_registered_card", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("delegates a registered card to ER after session delegation", async () => {
    const { sessionPda, cardId, cardPda } = await createMagicBlockBattleFixture();
    await assertBaseAccountsOwnedByProgram({ sessionPda, cardPda });

    await delegateBattleSessionAndCard({ sessionPda, cardPda, cardId });
    await waitForDelegatedSessionAndCard({ sessionPda, cardPda });

    const delegatedCard = await ephemeralProgram.account.registeredCard.fetch(cardPda);
    expect(Array.from(delegatedCard.cardId)).to.deep.equal(cardId);
  });
});
