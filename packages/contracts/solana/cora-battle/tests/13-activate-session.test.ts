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
  setCardManifest,
} from "./helpers/battleTestUtils";

describe("activate_session", () => {
  it("activates and sets round 1 state", async () => {
    const { sessionPda } = await createSession();
    await activateSession(sessionPda);

    const session = await fetchSession(sessionPda);
    expect(session.currentRound).to.equal(1);
    expect(session.roundStartedAt.toNumber()).to.be.greaterThan(0);
    expect(session.roundDeadline.toNumber()).to.be.greaterThan(
      session.roundStartedAt.toNumber()
    );
    expect(session.roundDeadline.toNumber() - session.roundStartedAt.toNumber()).to.equal(
      TEST_CONSTANTS.roundDurationSeconds
    );
    expect(session.roundDamageA).to.equal(0);
    expect(session.roundDamageB).to.equal(0);
    expect(battleStatusName(session.status)).to.equal("active");
  });

  it("rejects activation before both manifests are committed", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .activateSession()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "ManifestNotCommitted"
    );
  });

  it("rejects double activation", async () => {
    const { sessionPda } = await createSession();
    await activateSession(sessionPda);

    await expectAnchorError(activateSession(sessionPda), "InvalidStatus");
  });

  it("rejects activation when only one manifest is committed", async () => {
    const { sessionPda } = await createSession();
    await setCardManifest({
      sessionPda,
      isPlayerA: true,
      entries: [{ effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue }],
    });

    await expectAnchorError(
      program.methods
        .activateSession()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "ManifestNotCommitted"
    );
  });
});
