// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  battleStatusName,
  createFinishedKoBattle,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
  waitUntilUnixTimestamp,
  toSafeNumber,
  warpPastUnixTimestamp,
} from "./helpers/battleTestUtils";

describe("force_end", () => {
  it("rejects force_end before timeout", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .forceEnd()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "TimeoutNotReached"
    );
  });

  it("rejects force_end on a finished session", async () => {
    const { sessionPda } = await createFinishedKoBattle();

    await expectAnchorError(
      program.methods
        .forceEnd()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });

  it("force-ends stale sessions after timeout when validator supports clock warp", async function () {
    this.timeout(1_260_000);
    const { sessionPda } = await createSession();
    const before = await fetchSession(sessionPda);
    const targetUnix = toSafeNumber(before.createdAt) + TEST_CONSTANTS.sessionTimeout + 1;
    let reachedTimeout = await warpPastUnixTimestamp(targetUnix, {
      slotsPerStep: 2400,
      maxAttempts: 40,
    });

    if (!reachedTimeout && process.env.ENABLE_REALTIME_TIMEOUT_TESTS === "1") {
      reachedTimeout = await waitUntilUnixTimestamp(targetUnix, {
        pollIntervalMs: 1_000,
        timeoutMs: 1_020_000,
      });
    }

    if (!reachedTimeout) {
      this.skip();
    }

    await program.methods
      .forceEnd()
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
      })
      .rpc();

    const after = await fetchSession(sessionPda);
    expect(battleStatusName(after.status)).to.equal("cancelled");
    expect(after.endReason).to.equal(TEST_CONSTANTS.endReasonForceEnded);
  });
});
