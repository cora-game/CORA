// @ts-nocheck
import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import {
  TEST_CONSTANTS,
  authority,
  createActivatedLegacyBattle,
  expectAnchorError,
  fetchSession,
  program,
  toSafeNumber,
  waitUntilUnixTimestamp,
  warpPastUnixTimestamp,
} from "./helpers/battleTestUtils";

describe("apply_damage", () => {
  it("applies damage and updates health", async () => {
    const { sessionPda, cardPdas, playerA } = await createActivatedLegacyBattle();

    await program.methods
      .applyDamage(playerA.publicKey)
      .accounts({
        battleSession: sessionPda,
        authority: authority.publicKey,
        registeredCard: cardPdas[0],
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - 25);
    expect(session.roundDamageA).to.equal(25);
    expect(session.gameScoreA).to.equal(25);
    expect(session.totalPlays).to.equal(1);
  });

  it("prevents replay with the same card", async () => {
    const { sessionPda, cardPdas, playerA } = await createActivatedLegacyBattle();

    await program.methods
      .applyDamage(playerA.publicKey)
      .accounts({
        battleSession: sessionPda,
        authority: authority.publicKey,
        registeredCard: cardPdas[0],
      })
      .rpc();

    await expectAnchorError(
      program.methods
        .applyDamage(playerA.publicKey)
        .accounts({
          battleSession: sessionPda,
          authority: authority.publicKey,
          registeredCard: cardPdas[0],
        })
        .rpc(),
      "CardAlreadyUsed"
    );
  });

  it("rejects invalid attacker", async () => {
    const { sessionPda, cardPdas } = await createActivatedLegacyBattle();
    const outsider = Keypair.generate();

    await expectAnchorError(
      program.methods
        .applyDamage(outsider.publicKey)
        .accounts({
          battleSession: sessionPda,
          authority: authority.publicKey,
          registeredCard: cardPdas[0],
        })
        .rpc(),
      "InvalidTarget"
    );
  });

  it("awards the round after a KO", async () => {
    const { sessionPda, cardPdas, playerA } = await createActivatedLegacyBattle({
      cardDamages: [100, 100],
    });

    await program.methods
      .applyDamage(playerA.publicKey)
      .accounts({
        battleSession: sessionPda,
        authority: authority.publicKey,
        registeredCard: cardPdas[0],
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(1);
    expect(session.roundsWonA).to.equal(1);
    expect(session.currentRound).to.equal(2);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
  });

  it("rejects apply_damage after round deadline", async function () {
    this.timeout(420_000);
    const { sessionPda, cardPdas, playerA } = await createActivatedLegacyBattle();
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

    await expectAnchorError(
      program.methods
        .applyDamage(playerA.publicKey)
        .accounts({
          battleSession: sessionPda,
          authority: authority.publicKey,
          registeredCard: cardPdas[0],
        })
        .rpc(),
      "RoundDeadlinePassed"
    );
  });
});
