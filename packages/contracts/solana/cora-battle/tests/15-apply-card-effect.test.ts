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
  registerEffectCard,
  toSafeNumber,
  waitUntilUnixTimestamp,
  warpPastUnixTimestamp,
} from "./helpers/battleTestUtils";

describe("apply_card_effect", () => {
  it("applies an attack effect and updates gameplay state", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(TEST_CONSTANTS.maxEffectValue, 100)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue);
    expect(session.roundDamageA).to.equal(TEST_CONSTANTS.maxEffectValue);
    expect(session.gameScoreA).to.equal(100);
    expect(session.totalPlays).to.equal(1);
  });

  it("applies a heal effect without exceeding max health", async () => {
    const { sessionPda, playerA, playerB } = await createSession();
    const attackCard = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerB.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });
    const healCard = await registerEffectCard({
      sessionPda,
      cardIndex: 1,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectHeal,
      maxValue: 20,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(TEST_CONSTANTS.maxEffectValue, 50)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: attackCard.cardPda,
      })
      .rpc();

    await program.methods
      .applyCardEffect(20, 25)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: healCard.cardPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.healthA).to.equal(
      TEST_CONSTANTS.initialHealth - TEST_CONSTANTS.maxEffectValue + 20
    );
    expect(session.gameScoreA).to.equal(25);
    expect(session.gameScoreB).to.equal(50);
  });

  it("rejects effect value exceeding max", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .applyCardEffect(TEST_CONSTANTS.maxEffectValue + 1, 100)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "InvalidEffectValue"
    );
  });

  it("rejects score delta exceeding max", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectNone,
      maxValue: 0,
    });
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .applyCardEffect(0, TEST_CONSTANTS.maxScoreDelta + 1)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "InvalidScoreDelta"
    );
  });

  it("prevents replay with the same effect card", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 2,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(25, 80)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .rpc();

    await expectAnchorError(
      program.methods
        .applyCardEffect(25, 80)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "CardAlreadyUsed"
    );
  });

  it("awards the round after an effect-based KO", async () => {
    const { sessionPda, playerA } = await createSession();
    const cards = await Promise.all(
      [3, 4, 5].map((cardIndex) =>
        registerEffectCard({
          sessionPda,
          cardIndex,
          owner: playerA.publicKey,
          effectType: TEST_CONSTANTS.effectAttack,
          maxValue: TEST_CONSTANTS.maxEffectValue,
        }),
      ),
    );
    await activateSession(sessionPda);

    for (const card of cards) {
      await program.methods
        .applyCardEffect(TEST_CONSTANTS.maxEffectValue, 150)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: card.cardPda,
        })
        .rpc();
    }

    const session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(1);
    expect(session.roundsWonA).to.equal(1);
    expect(session.currentRound).to.equal(2);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
  });

  it("rejects apply_card_effect after round deadline", async function () {
    this.timeout(420_000);
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 4,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });
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

    await expectAnchorError(
      program.methods
        .applyCardEffect(10, 20)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "RoundDeadlinePassed"
    );
  });
});
