// @ts-nocheck
import { Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  airdropSol,
  authority,
  createSession,
  expectAnchorError,
  fetchCard,
  findCardPda,
  makeCardId,
  program,
  registerLegacyCard,
  activateSession,
} from "./helpers/battleTestUtils";

describe("register_card", () => {
  it("registers a card successfully", async () => {
    const { sessionPda } = await createSession();
    const { cardPda } = await registerLegacyCard({
      sessionPda,
      cardIndex: 0,
      damage: 25,
    });

    const card = await fetchCard(cardPda);
    expect(card.damage).to.equal(25);
    expect(card.maxValue).to.equal(25);
    expect(card.effectType).to.equal(TEST_CONSTANTS.effectAttack);
    expect(card.isUsed).to.equal(false);
  });

  it("rejects zero damage", async () => {
    const { sessionPda } = await createSession();
    const cardId = makeCardId(0);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCard(cardId, 0)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidDamage"
    );
  });

  it("rejects damage over 100", async () => {
    const { sessionPda } = await createSession();
    const cardId = makeCardId(0);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await expectAnchorError(
      program.methods
        .registerCard(cardId, 101)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidDamage"
    );
  });

  it("rejects unauthorized signer", async () => {
    const { sessionPda } = await createSession();
    const impostor = Keypair.generate();
    const cardId = makeCardId(0);
    const [cardPda] = findCardPda(sessionPda, cardId);

    await airdropSol(impostor.publicKey);

    await expectAnchorError(
      program.methods
        .registerCard(cardId, 25)
        .accounts({
          authority: impostor.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc(),
      "UnauthorizedAuthority"
    );
  });

  it("rejects registration after activation", async () => {
    const { sessionPda } = await createSession();
    await activateSession(sessionPda);

    await expectAnchorError(
      registerLegacyCard({
        sessionPda,
        cardIndex: 0,
        damage: 25,
      }),
      "InvalidStatus"
    );
  });
});
