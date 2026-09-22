import { describe, it, expect } from "vitest";
import { TalentSlot } from "@/generated/prisma/enums";
import { computeTalentLevelBounds } from "./schemas";

// Mirrors Bennett's real seeded data: C3 boosts Skill, C5 boosts Burst.
const BENNETT_CONSTELLATIONS = [
  { number: 1, boostedTalentSlot: null },
  { number: 2, boostedTalentSlot: null },
  { number: 3, boostedTalentSlot: TalentSlot.Skill },
  { number: 4, boostedTalentSlot: null },
  { number: 5, boostedTalentSlot: TalentSlot.Burst },
  { number: 6, boostedTalentSlot: null },
];

describe("computeTalentLevelBounds", () => {
  it("keeps every talent at 1-10 with no constellations unlocked", () => {
    const bounds = computeTalentLevelBounds(0, BENNETT_CONSTELLATIONS);
    expect(bounds.normalAttackLevel).toEqual({ min: 1, max: 10 });
    expect(bounds.skillLevel).toEqual({ min: 1, max: 10 });
    expect(bounds.burstLevel).toEqual({ min: 1, max: 10 });
  });

  it("shifts only the boosted talent's range once its constellation unlocks", () => {
    const bounds = computeTalentLevelBounds(3, BENNETT_CONSTELLATIONS);
    expect(bounds.skillLevel).toEqual({ min: 4, max: 13 });
    expect(bounds.burstLevel).toEqual({ min: 1, max: 10 });
    expect(bounds.normalAttackLevel).toEqual({ min: 1, max: 10 });
  });

  it("shifts both boosted talents once both constellations unlock", () => {
    const bounds = computeTalentLevelBounds(6, BENNETT_CONSTELLATIONS);
    expect(bounds.skillLevel).toEqual({ min: 4, max: 13 });
    expect(bounds.burstLevel).toEqual({ min: 4, max: 13 });
  });

  it("doesn't shift a talent whose constellation isn't unlocked yet, even if a later one is", () => {
    // Constellation 4 unlocked but not 5 -- Burst stays unboosted.
    const bounds = computeTalentLevelBounds(4, BENNETT_CONSTELLATIONS);
    expect(bounds.skillLevel).toEqual({ min: 4, max: 13 });
    expect(bounds.burstLevel).toEqual({ min: 1, max: 10 });
  });

  it("treats a character with no boosted constellations as always unboosted", () => {
    const noBoosts = [
      { number: 3, boostedTalentSlot: null },
      { number: 5, boostedTalentSlot: null },
    ];
    const bounds = computeTalentLevelBounds(6, noBoosts);
    expect(bounds.skillLevel).toEqual({ min: 1, max: 10 });
    expect(bounds.burstLevel).toEqual({ min: 1, max: 10 });
  });
});
