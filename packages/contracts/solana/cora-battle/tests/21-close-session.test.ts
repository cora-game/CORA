// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  createFinishedKoBattle,
  createSession,
  expectAnchorError,
  program,
} from "./helpers/battleTestUtils";

describe("close_session", () => {
  it("closes a finished session", async () => {
    const { sessionPda } = await createFinishedKoBattle();

    await program.methods
      .closeSession()
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const info = await program.provider.connection.getAccountInfo(sessionPda);
    expect(info).to.equal(null);
  });

  it("closes a cancelled session", async () => {
    const { sessionPda } = await createSession();

    await program.methods
      .cancelSession(TEST_CONSTANTS.endReasonServerCancelled)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    await program.methods
      .closeSession()
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const info = await program.provider.connection.getAccountInfo(sessionPda);
    expect(info).to.equal(null);
  });

  it("rejects closing an active session", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .closeSession()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });
});
