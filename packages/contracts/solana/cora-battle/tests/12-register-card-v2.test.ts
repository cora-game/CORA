// @ts-nocheck
import { Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  createSession,
  expectAnchorError,
  fetchCard,
  findCardPda,
  makeCardId,
  program,
  registerEffectCard,
} from "./helpers/battleTestUtils";

describe("register_card_v2", () => {
  it("registers an attack card with owner metadata", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: TEST_CONSTANTS.maxEffectValue,
    });

    const card = await fetchCard(cardPda);
    expect(card.owner.toBase58()).to.equal(playerA.publicKey.toBase58());
    expect(card.effectType).to.equal(TEST_CONSTANTS.effectAttack);
    expect(card.maxValue).to.equal(TEST_CONSTANTS.maxEffectValue);
    expect(card.damage).to.equal(TEST_CONSTANTS.maxEffectValue);
  });

  it("registers a heal card with zero legacy damage", async () => {
    const { sessionPda, playerB } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 1,
      owner: playerB.publicKey,
      effectType: TEST_CONSTANTS.effectHeal,
      maxValue: 20,
    });

    const card = await fetchCard(cardPda);
    expect(card.owner.toBase58()).to.equal(playerB.publicKey.toBase58());
    expect(card.effectType).to.equal(TEST_CONSTANTS.effectHeal);
    expect(card.maxValue).to.equal(20);
    expect(card.damage).to.equal(0);
  });

  it("rejects invalid owner", async () => {
    const { sessionPda } = await createSession();
    const cardId = makeCardId(0);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCardV2(
          cardId,
          Keypair.generate().publicKey,
          TEST_CONSTANTS.effectAttack,
          TEST_CONSTANTS.maxEffectValue
        )
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidCardOwner"
    );
  });

  it("rejects invalid effect type", async () => {
    const { sessionPda, playerA } = await createSession();
    const cardId = makeCardId(2);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCardV2(cardId, playerA.publicKey, 99, TEST_CONSTANTS.maxEffectValue)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidEffectType"
    );
  });

  it("rejects attack or heal cards with zero max value", async () => {
    const { sessionPda, playerA } = await createSession();
    const cardId = makeCardId(3);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCardV2(cardId, playerA.publicKey, TEST_CONSTANTS.effectAttack, 0)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidEffectValue"
    );
  });

  it("rejects heal cards above gameplay heal ceiling", async () => {
    const { sessionPda, playerA } = await createSession();
    const cardId = makeCardId(5);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCardV2(
          cardId,
          playerA.publicKey,
          TEST_CONSTANTS.effectHeal,
          TEST_CONSTANTS.maxHealEffectValue + 1
        )
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidEffectValue"
    );
  });

  it("rejects effect_none cards with max value above protocol limit", async () => {
    const { sessionPda, playerA } = await createSession();
    const cardId = makeCardId(4);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCardV2(
          cardId,
          playerA.publicKey,
          TEST_CONSTANTS.effectNone,
          TEST_CONSTANTS.maxEffectValue + 1
        )
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidEffectValue"
    );
  });
});
