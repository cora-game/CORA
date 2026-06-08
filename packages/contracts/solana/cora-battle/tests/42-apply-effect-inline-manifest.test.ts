// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  activateSession,
  applyInlineEffect,
  authority,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
  setCardManifest,
  toSafeNumber,
  waitUntilUnixTimestamp,
  warpPastUnixTimestamp,
} from "./helpers/battleTestUtils";

async function createInlineBattle() {
  const session = await createSession();
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: true,
    entries: [
      { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
      { effectType: TEST_CONSTANTS.effectHeal, maxValue: TEST_CONSTANTS.maxHealEffectValue },
      { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
      { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
      { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
    ],
  });
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: false,
    entries: [{ effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue }],
  });
  await activateSession(session.sessionPda);
  return session;
}

describe("apply_effect", () => {
  it("applies an inline attack effect and updates gameplay state", async () => {
    const { sessionPda } = await createInlineBattle();

    await applyInlineEffect({
      sessionPda,
      slot: 0,
      actorIsA: true,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 500,
    });

    const session = await fetchSession(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue);
    expect(session.roundDamageA).to.equal(TEST_CONSTANTS.maxEffectValue);
    expect(session.gameScoreA).to.equal(500);
    expect(session.totalPlays).to.equal(1);
    expect(session.cardsUsedA.toString()).to.equal("1");
    expect(session.scoreA).to.equal(0);
  });

  it("consumes an attack slot with zero effect for wrong-answer style flow", async () => {
    const { sessionPda } = await createInlineBattle();

    await applyInlineEffect({
      sessionPda,
      slot: 2,
      actorIsA: true,
      finalValue: 0,
      scoreDelta: 0,
    });

    const session = await fetchSession(sessionPda);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.gameScoreA).to.equal(0);
    expect(session.totalPlays).to.equal(1);
    expect(session.cardsUsedA.toString()).to.equal((1n << 2n).toString());
  });

  it("applies a heal effect without exceeding max health", async () => {
    const { sessionPda } = await createInlineBattle();

    await applyInlineEffect({
      sessionPda,
      slot: 0,
      actorIsA: false,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 100,
    });
    await applyInlineEffect({
      sessionPda,
      slot: 1,
      actorIsA: true,
      finalValue: TEST_CONSTANTS.maxHealEffectValue,
      scoreDelta: 75,
    });

    const session = await fetchSession(sessionPda);
    expect(session.healthA).to.equal(
      TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue + TEST_CONSTANTS.maxHealEffectValue
    );
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.gameScoreA).to.equal(75);
    expect(session.gameScoreB).to.equal(100);
  });

  it("awards the round after an inline KO", async () => {
    const { sessionPda } = await createInlineBattle();

    for (const slot of [0, 2, 3]) {
      await applyInlineEffect({
        sessionPda,
        slot,
        actorIsA: true,
        finalValue: TEST_CONSTANTS.maxEffectValue,
        scoreDelta: 1_000,
      });
    }

    const session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(1);
    expect(session.roundsWonA).to.equal(1);
    expect(session.currentRound).to.equal(2);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
  });

  it("rejects slot replay and slot out of bounds", async () => {
    const { sessionPda } = await createInlineBattle();

    await applyInlineEffect({
      sessionPda,
      slot: 0,
      actorIsA: true,
      finalValue: TEST_CONSTANTS.maxEffectValue,
      scoreDelta: 150,
    });

    await expectAnchorError(
      program.methods
        .applyEffect(0, true, TEST_CONSTANTS.maxEffectValue, 150)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "CardAlreadyUsed"
    );

    await expectAnchorError(
      program.methods
        .applyEffect(9, true, TEST_CONSTANTS.maxEffectValue, 150)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "SlotOutOfBounds"
    );
  });

  it("rejects values that exceed manifest or score multiplier limits", async () => {
    const { sessionPda } = await createInlineBattle();

    await expectAnchorError(
      program.methods
        .applyEffect(0, true, TEST_CONSTANTS.maxEffectValue + 1, 100)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidEffectValue"
    );

    await expectAnchorError(
      program.methods
        .applyEffect(0, true, TEST_CONSTANTS.maxEffectValue, TEST_CONSTANTS.maxEffectValue * TEST_CONSTANTS.maxScoreMultiplier + 1)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "ScoreDeltaExceedsMultiplier"
    );
  });

  it("rejects apply_effect after the round deadline", async function () {
    this.timeout(420_000);
    const { sessionPda } = await createInlineBattle();

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
        .applyEffect(0, true, TEST_CONSTANTS.maxEffectValue, 150)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "RoundDeadlinePassed"
    );
  });
});
