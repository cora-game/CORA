// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  createFinishedKoBattle,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
} from "./helpers/battleTestUtils";

describe("finalize_match", () => {
  it("finalizes a finished session", async () => {
    const { sessionPda, playerA } = await createFinishedKoBattle();

    await program.methods
      .finalizeMatch()
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(TEST_CONSTANTS.roundsToWin);
    expect(session.winner.toBase58()).to.equal(playerA.publicKey.toBase58());
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonNormalWin);
  });

  it("rejects finalize before the match is finished", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .finalizeMatch()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });
});
