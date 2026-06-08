// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  activateSession,
  authority,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
  waitUntilUnixTimestamp,
  toSafeNumber,
  warpPastUnixTimestamp,
} from "./helpers/battleTestUtils";

describe("timeout_player_for_round", () => {
  it("rejects when the session is not active", async () => {
    const { sessionPda, playerA } = await createSession();

    await expectAnchorError(
      program.methods
        .timeoutPlayerForRound(playerA.publicKey)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });

  it("rejects before the round deadline", async () => {
    const { sessionPda, playerA } = await createSession();
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .timeoutPlayerForRound(playerA.publicKey)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "TimeoutNotReached"
    );
  });

  it("resolves timeout after deadline when validator supports clock warp", async function () {
    this.timeout(420_000);
    const { sessionPda, playerA } = await createSession();
    await activateSession(sessionPda);

    const sessionBefore = await fetchSession(sessionPda);
    const deadline = toSafeNumber(sessionBefore.roundDeadline);
    let reachedDeadline = await warpPastUnixTimestamp(deadline + 1, {
      slotsPerStep: 1200,
      maxAttempts: 25,
    });

    if (!reachedDeadline && process.env.ENABLE_REALTIME_TIMEOUT_TESTS === "1") {
      reachedDeadline = await waitUntilUnixTimestamp(deadline + 1, {
        pollIntervalMs: 1_000,
        timeoutMs: 240_000,
      });
    }

    if (!reachedDeadline) {
      this.skip();
    }

    await program.methods
      .timeoutPlayerForRound(playerA.publicKey)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const sessionAfter = await fetchSession(sessionPda);
    expect(sessionAfter.scoreB).to.equal(1);
    expect(sessionAfter.currentRound).to.equal(2);
    expect(sessionAfter.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(sessionAfter.healthB).to.equal(TEST_CONSTANTS.initialHealth);
  });
});
