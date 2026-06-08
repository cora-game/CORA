// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  battleStatusName,
  createSession,
  expectAnchorError,
  fetchSession,
  makeMatchId,
} from "./helpers/battleTestUtils";

describe("create_session", () => {
  it("creates a session with correct state", async () => {
    const { playerA, playerB, questionHash, sessionPda } = await createSession();
    const session = await fetchSession(sessionPda);

    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.currentRound).to.equal(0);
    expect(session.scoreA).to.equal(0);
    expect(session.scoreB).to.equal(0);
    expect(session.roundsWonA).to.equal(0);
    expect(session.roundsWonB).to.equal(0);
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonNone);
    expect(battleStatusName(session.status)).to.equal("waitingCards");
    expect(session.playerA.toBase58()).to.equal(playerA.publicKey.toBase58());
    expect(session.playerB.toBase58()).to.equal(playerB.publicKey.toBase58());
    expect(Array.from(session.questionHash)).to.deep.equal(questionHash);
  });

  it("rejects same player for A and B", async () => {
    const { playerA } = await createSession();

    await expectAnchorError(
      createSession({
        matchId: makeMatchId(),
        playerA,
        playerB: playerA,
      }),
      "SamePlayer"
    );
  });

  it("rejects duplicate match_id", async () => {
    const matchId = makeMatchId();
    await createSession({ matchId });

    await expectAnchorError(createSession({ matchId }), "already in use");
  });
});
