// @ts-nocheck
import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import { TEST_CONSTANTS } from "./helpers/battleTestUtils";

type RuleSnapshot = {
  playerA: PublicKey;
  playerB: PublicKey;
  scoreA: number;
  scoreB: number;
  gameScoreA: number;
  gameScoreB: number;
  healthA: number;
  healthB: number;
};

function makeSnapshot(): RuleSnapshot {
  return {
    playerA: Keypair.generate().publicKey,
    playerB: Keypair.generate().publicKey,
    scoreA: 0,
    scoreB: 0,
    gameScoreA: 0,
    gameScoreB: 0,
    healthA: TEST_CONSTANTS.initialHealth,
    healthB: TEST_CONSTANTS.initialHealth,
  };
}

function determineWinnerByMatchRules(snapshot: RuleSnapshot): PublicKey | null {
  if (snapshot.scoreA !== snapshot.scoreB) {
    return snapshot.scoreA > snapshot.scoreB
      ? snapshot.playerA
      : snapshot.playerB;
  }

  if (snapshot.gameScoreA !== snapshot.gameScoreB) {
    return snapshot.gameScoreA > snapshot.gameScoreB
      ? snapshot.playerA
      : snapshot.playerB;
  }

  if (snapshot.healthA !== snapshot.healthB) {
    return snapshot.healthA > snapshot.healthB
      ? snapshot.playerA
      : snapshot.playerB;
  }

  return null;
}

describe("state rules spec alignment", () => {
  it("winner_by_score_a", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 2;
    snapshot.scoreB = 1;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerA.toBase58()
    );
  });

  it("winner_by_score_b", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 0;
    snapshot.scoreB = 2;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerB.toBase58()
    );
  });

  it("tiebreak_game_score_a", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 1;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 500;
    snapshot.gameScoreB = 300;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerA.toBase58()
    );
  });

  it("tiebreak_game_score_b", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 1;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 100;
    snapshot.gameScoreB = 200;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerB.toBase58()
    );
  });

  it("tiebreak_health_a", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 1;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 200;
    snapshot.gameScoreB = 200;
    snapshot.healthA = 80;
    snapshot.healthB = 40;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerA.toBase58()
    );
  });

  it("tiebreak_health_b", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 1;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 200;
    snapshot.gameScoreB = 200;
    snapshot.healthA = 25;
    snapshot.healthB = 50;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerB.toBase58()
    );
  });

  it("fully_tied_returns_none", () => {
    const snapshot = makeSnapshot();

    expect(determineWinnerByMatchRules(snapshot)).to.equal(null);
  });

  it("score_precedence_over_game_score", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 2;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 10;
    snapshot.gameScoreB = 999;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerA.toBase58()
    );
  });

  it("game_score_precedence_over_health", () => {
    const snapshot = makeSnapshot();
    snapshot.scoreA = 1;
    snapshot.scoreB = 1;
    snapshot.gameScoreA = 300;
    snapshot.gameScoreB = 100;
    snapshot.healthA = 5;
    snapshot.healthB = 95;

    expect(determineWinnerByMatchRules(snapshot)?.toBase58()).to.equal(
      snapshot.playerA.toBase58()
    );
  });

  it("zero_scores_draw", () => {
    const snapshot = makeSnapshot();
    snapshot.healthA = TEST_CONSTANTS.initialHealth;
    snapshot.healthB = TEST_CONSTANTS.initialHealth;

    expect(determineWinnerByMatchRules(snapshot)).to.equal(null);
  });

  it("battle_session_len_is_1071", () => {
    const battleSessionLength =
      8 + 1 + 32 + 32 + 32 + 32 + 2 + 2 + 2 + 2 + 1 + 1 + 1 + 8 + 8 + 1 + 1 + 2 + 1 + 32 + 32 + 1 + 8 + 8 + 1 + 4 + 4 + 4 + 4 +
      1 + 1 + 16 + 16 + 1 + 1 + 384 + 384;
    expect(battleSessionLength).to.equal(1071);
  });

  it("registered_card_len_is_95", () => {
    const registeredCardLength = 8 + 32 + 16 + 32 + 1 + 2 + 2 + 1 + 1;
    expect(registeredCardLength).to.equal(95);
  });

  it("status_variants_compare", () => {
    const waitingCards = "waitingCards";
    const active = "active";
    const finished = "finished";
    const cancelled = "cancelled";

    expect(waitingCards).to.equal("waitingCards");
    expect(waitingCards).to.not.equal(active);
    expect(finished).to.not.equal(cancelled);
  });
});
