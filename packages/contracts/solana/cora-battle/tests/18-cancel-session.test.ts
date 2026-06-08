// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  activateSession,
  authority,
  battleStatusName,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
} from "./helpers/battleTestUtils";

describe("cancel_session", () => {
  it("cancels an active session", async () => {
    const { sessionPda } = await createSession();
    await activateSession(sessionPda);

    await program.methods
      .cancelSession(TEST_CONSTANTS.endReasonServerCancelled)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(battleStatusName(session.status)).to.equal("cancelled");
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonServerCancelled);
  });

  it("also cancels during waiting_cards", async () => {
    const { sessionPda } = await createSession();

    await program.methods
      .cancelSession(TEST_CONSTANTS.endReasonBothPlayersTimeout)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(battleStatusName(session.status)).to.equal("cancelled");
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonBothPlayersTimeout);
  });

  it("rejects an invalid end reason", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .cancelSession(TEST_CONSTANTS.endReasonCheaterFlagged)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidEndReason"
    );
  });

  it("rejects force-ended reason in cancel_session", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .cancelSession(TEST_CONSTANTS.endReasonForceEnded)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidEndReason"
    );
  });
});
