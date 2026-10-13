import { describe, it, expect } from "vitest";
import {
  characterLevelMultiplier,
  travelerStoryBuffBonus,
  characterScalingRarity,
  travelerGenderGroup,
  travelerDisplayName,
} from "./character-scaling";

describe("characterLevelMultiplier", () => {
  it("matches the exact LEVEL_95_100_MULTIPLIER values at level 95/100", () => {
    expect(characterLevelMultiplier(4, 95, "hp")).toBe(8.761);
    expect(characterLevelMultiplier(4, 95, "attack")).toBe(9.87);
    expect(characterLevelMultiplier(5, 95, "hp")).toBe(9.195001);
    expect(characterLevelMultiplier(5, 95, "attack")).toBe(10.18398);
    expect(characterLevelMultiplier(4, 100, "hp")).toBe(9.174001);
    expect(characterLevelMultiplier(4, 100, "attack")).toBe(11.392);
    expect(characterLevelMultiplier(5, 100, "hp")).toBe(9.652001);
    expect(characterLevelMultiplier(5, 100, "attack")).toBe(11.629);
  });

  it("still uses the closed-form formula below level 95", () => {
    // base = (100 + 9*90) / 109 = 8.348623..., * (1990/1901), rounded to 3dp.
    expect(characterLevelMultiplier(5, 90, "hp")).toBe(8.739);
  });
});

describe("travelerStoryBuffBonus", () => {
  it("gives the flat +50 HP / +10 ATK / +15 EM bonus for any Traveler row", () => {
    expect(travelerStoryBuffBonus("Traveler (Female) (Anemo)", "hp")).toBe(50);
    expect(travelerStoryBuffBonus("Traveler (Male) (Pyro)", "attack")).toBe(10);
    expect(travelerStoryBuffBonus("Traveler (Female) (Dendro)", "elementalMastery")).toBe(15);
  });

  it("gives nothing for a non-Traveler character", () => {
    expect(travelerStoryBuffBonus("Aino", "hp")).toBe(0);
    expect(travelerStoryBuffBonus("Aino", "attack")).toBe(0);
    expect(travelerStoryBuffBonus("Aino", "elementalMastery")).toBe(0);
  });
});

describe("characterScalingRarity", () => {
  it("overrides Traveler's stored rarity to 4", () => {
    expect(characterScalingRarity("Traveler (Male) (Hydro)", 5)).toBe(4);
  });

  it("uses the stored rarity for everyone else", () => {
    expect(characterScalingRarity("Aino", 5)).toBe(5);
  });
});

describe("travelerGenderGroup", () => {
  it("returns the shared gender prefix for any Traveler row", () => {
    expect(travelerGenderGroup("Traveler (Female) (Anemo)")).toBe("Traveler (Female)");
    expect(travelerGenderGroup("Traveler (Male) (Pyro)")).toBe("Traveler (Male)");
  });

  it("returns null for a non-Traveler character", () => {
    expect(travelerGenderGroup("Aino")).toBeNull();
  });
});

describe("travelerDisplayName", () => {
  it("drops the gender and element brackets for any Traveler row", () => {
    expect(travelerDisplayName("Traveler (Female) (Anemo)")).toBe("Traveler");
    expect(travelerDisplayName("Traveler (Male) (Pyro)")).toBe("Traveler");
  });

  it("returns a non-Traveler name unchanged", () => {
    expect(travelerDisplayName("Aino")).toBe("Aino");
  });
});
