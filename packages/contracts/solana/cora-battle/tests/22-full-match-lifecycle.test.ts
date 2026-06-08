// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  createActivatedLegacyBattle,
  fetchSession,
  program,
} from "./helpers/battleTestUtils";

describe("full match lifecycle", () => {
  it("completes a two-round KO match end-to-end", async () => {
    const { sessionPda, cardPdas, playerA } = await createActivatedLegacyBattle({
      cardDamages: [100, 100, 100, 100],
    });

    await program.methods
      .applyDamage(playerA.publicKey)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPdas[0],
      })
      .rpc();

    let session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(1);
    expect(session.currentRound).to.equal(2);

    await program.methods
      .applyDamage(playerA.publicKey)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPdas[1],
      })
      .rpc();

    session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(TEST_CONSTANTS.roundsToWin);
    expect(session.roundsWonA).to.equal(TEST_CONSTANTS.roundsToWin);
    expect(session.winner.toBase58()).to.equal(playerA.publicKey.toBase58());

    await program.methods
      .finalizeMatch()
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
});
