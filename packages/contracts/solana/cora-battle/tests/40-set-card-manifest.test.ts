// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  authority,
  createSession,
  expectAnchorError,
  fetchSession,
  packManifest,
  program,
  setCardManifest,
} from "./helpers/battleTestUtils";

describe("set_card_manifest", () => {
  it("stores player manifests inline on the battle session", async () => {
    const { sessionPda } = await createSession();

    await setCardManifest({
      sessionPda,
      isPlayerA: true,
      entries: [
        { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
        { effectType: TEST_CONSTANTS.effectHeal, maxValue: TEST_CONSTANTS.maxHealEffectValue },
      ],
    });
    await setCardManifest({
      sessionPda,
      isPlayerA: false,
      entries: [{ effectType: TEST_CONSTANTS.effectNone, maxValue: 0 }],
    });

    const session = await fetchSession(sessionPda);
    expect(session.totalSlotsA).to.equal(2);
    expect(session.totalSlotsB).to.equal(1);
    expect(session.manifestCommittedA).to.equal(true);
    expect(session.manifestCommittedB).to.equal(true);
    expect(Array.from(session.cardManifestA.slice(0, 6))).to.deep.equal(
      packManifest([
        { effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue },
        { effectType: TEST_CONSTANTS.effectHeal, maxValue: TEST_CONSTANTS.maxHealEffectValue },
      ])
    );
    expect(Array.from(session.cardManifestB.slice(0, 3))).to.deep.equal(
      packManifest([{ effectType: TEST_CONSTANTS.effectNone, maxValue: 0 }])
    );
  });

  it("rejects double commit for the same player", async () => {
    const { sessionPda } = await createSession();

    await setCardManifest({
      sessionPda,
      isPlayerA: true,
      entries: [{ effectType: TEST_CONSTANTS.effectAttack, maxValue: TEST_CONSTANTS.maxEffectValue }],
    });

    await expectAnchorError(
      program.methods
        .setCardManifest(
          true,
          1,
          Buffer.from(
            packManifest([{ effectType: TEST_CONSTANTS.effectHeal, maxValue: 20 }])
          )
        )
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidManifest"
    );
  });

  it("rejects invalid manifest payloads", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .setCardManifest(
          true,
          1,
          Buffer.from([TEST_CONSTANTS.effectAttack, TEST_CONSTANTS.maxEffectValue])
        )
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidManifest"
    );

    await expectAnchorError(
      program.methods
        .setCardManifest(true, 1, Buffer.from([99, 10, 0]))
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidEffectType"
    );
  });
});
