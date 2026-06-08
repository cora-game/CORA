// @ts-nocheck
import { expect } from "chai";

import { TEST_CONSTANTS } from "./helpers/battleTestUtils";

describe("constants spec alignment", () => {
  it("rounds_to_win_less_than_max_rounds", () => {
    expect(TEST_CONSTANTS.roundsToWin).to.be.at.most(TEST_CONSTANTS.maxRounds);
  });

  it("best_of_3_requires_2_wins", () => {
    expect(TEST_CONSTANTS.maxRounds).to.equal(3);
    expect(TEST_CONSTANTS.roundsToWin).to.equal(2);
  });

  it("damage_range_valid", () => {
    expect(TEST_CONSTANTS.minDamage).to.be.greaterThan(0);
    expect(TEST_CONSTANTS.minDamage).to.be.at.most(TEST_CONSTANTS.maxDamage);
    expect(TEST_CONSTANTS.maxDamage).to.be.at.most(TEST_CONSTANTS.initialHealth);
  });

  it("effect_types_are_distinct", () => {
    expect(TEST_CONSTANTS.effectAttack).to.not.equal(TEST_CONSTANTS.effectHeal);
    expect(TEST_CONSTANTS.effectAttack).to.not.equal(TEST_CONSTANTS.effectNone);
    expect(TEST_CONSTANTS.effectHeal).to.not.equal(TEST_CONSTANTS.effectNone);
  });

  it("session_timeout_exceeds_max_round_time", () => {
    const maxGameTime =
      TEST_CONSTANTS.maxRounds * TEST_CONSTANTS.roundDurationSeconds;
    expect(TEST_CONSTANTS.sessionTimeout).to.be.at.least(maxGameTime);
  });

  it("end_reasons_are_unique", () => {
    const reasons = [
      TEST_CONSTANTS.endReasonNone,
      TEST_CONSTANTS.endReasonNormalWin,
      TEST_CONSTANTS.endReasonSinglePlayerTimeout,
      TEST_CONSTANTS.endReasonBothPlayersTimeout,
      TEST_CONSTANTS.endReasonServerCancelled,
      TEST_CONSTANTS.endReasonCheaterFlagged,
      TEST_CONSTANTS.endReasonForceEnded,
      TEST_CONSTANTS.endReasonDrawNoContest,
      TEST_CONSTANTS.endReasonSurrender,
    ];

    expect(new Set(reasons).size).to.equal(reasons.length);
  });

  it("max_effect_value_supports_game_attack_ceiling", () => {
    expect(TEST_CONSTANTS.maxAttackEffectValue).to.equal(
      TEST_CONSTANTS.baseDamage * TEST_CONSTANTS.maxEffectMultiplier
    );
    expect(TEST_CONSTANTS.maxHealEffectValue).to.equal(
      TEST_CONSTANTS.baseHeal * TEST_CONSTANTS.maxEffectMultiplier
    );
    expect(TEST_CONSTANTS.maxEffectValue).to.equal(TEST_CONSTANTS.maxAttackEffectValue);
    expect(TEST_CONSTANTS.maxEffectValue).to.be.lessThan(TEST_CONSTANTS.maxDamage);
  });

  it("inline_manifest_limits_are_consistent", () => {
    expect(TEST_CONSTANTS.maxCardSlots).to.equal(128);
    expect(TEST_CONSTANTS.manifestEntrySize).to.equal(3);
    expect(TEST_CONSTANTS.maxScoreMultiplier).to.be.greaterThan(0);
  });
});
