import { describe, it, expect } from "vitest";
import { roundHalfUp } from "@/lib/round";
import {
  computeArtifactMainStatValue,
  substatRollCount,
  substatValidValues,
  validateSubstatRollTotal,
  SUBSTAT_HIGHEST_ROLL,
  type SubstatTypeName,
} from "./artifact-rules";

// Mirrors artifact-rules.ts's own private roundTo2 -- builds a substat value
// that's unambiguously the result of `rolls` rolls each landing on
// `multiplier`, for exercising substatRollCount/validateSubstatRollTotal
// without needing production's own roll-combination search.
function rollValue(statName: SubstatTypeName, rarity: number, rolls: number, multiplier: number): number {
  const highest = SUBSTAT_HIGHEST_ROLL[statName][rarity];
  return roundHalfUp(rolls * multiplier * highest, 2);
}

// Values transcribed directly from
// data-source/Artifact_Stats_Scaling_report.txt -- a regression guard
// against reintroducing a closed-form formula (see
// MAIN_STAT_VALUE_BY_LEVEL's own comment on why one doesn't reproduce
// this table exactly).
describe("computeArtifactMainStatValue", () => {
  it("looks up a flat stat (HP) at its min and max level", () => {
    expect(computeArtifactMainStatValue("HP", 5, 0)).toBe(717);
    expect(computeArtifactMainStatValue("HP", 5, 20)).toBe(4780);
  });

  it("looks up a percentage stat at a 4-star piece's max level", () => {
    expect(computeArtifactMainStatValue("ATK", 4, 16)).toBe(232);
  });

  it("matches the table exactly at a level a naive closed-form formula gets wrong", () => {
    // A single end-to-end multiply-and-round reconstruction of this curve
    // gives 44.0 here, not the real 44.1 -- confirmed directly before
    // switching to a plain lookup table.
    expect(computeArtifactMainStatValue("Crit DMG%", 4, 15)).toBe(44.1);
  });

  it("shares one curve across every stat in the HP%/ATK%/elemental-DMG% group", () => {
    const expected = computeArtifactMainStatValue("HP%", 5, 10);
    expect(expected).toBe(26.8);
    expect(computeArtifactMainStatValue("ATK%", 5, 10)).toBe(expected);
    expect(computeArtifactMainStatValue("Pyro DMG Bonus%", 5, 10)).toBe(expected);
    expect(computeArtifactMainStatValue("Dendro DMG Bonus%", 5, 10)).toBe(expected);
  });

  it("shares one curve across DEF% and Physical DMG Bonus%", () => {
    const expected = computeArtifactMainStatValue("DEF%", 4, 8);
    expect(expected).toBe(25.7);
    expect(computeArtifactMainStatValue("Physical DMG Bonus%", 4, 8)).toBe(expected);
  });
});

describe("substatValidValues", () => {
  // Regression guard for a real bug: a 4-star's best-case initial substat
  // count (rarity-1 = 3) is one short of the full 4 slots, so at least 1 of
  // its (up to 4) upgrades is always spent revealing the still-missing 4th
  // substat -- the true max for any ONE substat is 4 rolls at max level,
  // not 5 (1 + every upgrade, which wrongly assumed none of them was ever
  // forced into a reveal).
  it("caps a maxed 4-star substat's highest value at 4 rolls, not 5", () => {
    const values = substatValidValues("Crit Rate%", 4, 16);
    const highest = SUBSTAT_HIGHEST_ROLL["Crit Rate%"][4];
    expect(Math.max(...values)).toBe(roundHalfUp(4 * 1.0 * highest, 2));
  });

  // A 5-star's best-case initial count (rarity-1 = 4) already fills all 4
  // slots, so none of its 5 upgrades is ever forced into a reveal -- every
  // one of them really could land on a single substat.
  it("doesn't cap a maxed 5-star substat the same way -- all 5 upgrades can land on one", () => {
    const values = substatValidValues("Crit Rate%", 5, 20);
    const highest = SUBSTAT_HIGHEST_ROLL["Crit Rate%"][5];
    expect(Math.max(...values)).toBe(roundHalfUp(6 * 1.0 * highest, 2));
  });
});

describe("substatRollCount", () => {
  it("identifies a single roll at its lowest and highest tier", () => {
    expect(substatRollCount("Crit Rate%", 5, rollValue("Crit Rate%", 5, 1, 0.7))).toBe(1);
    expect(substatRollCount("Crit Rate%", 5, rollValue("Crit Rate%", 5, 1, 1.0))).toBe(1);
  });

  it("identifies a value that could only come from multiple rolls", () => {
    expect(substatRollCount("Crit Rate%", 5, rollValue("Crit Rate%", 5, 2, 0.7))).toBe(2);
    expect(substatRollCount("Energy Recharge%", 4, rollValue("Energy Recharge%", 4, 3, 1.0))).toBe(3);
  });

  it("identifies the max possible rolls for a 5-star piece (1 + rarity)", () => {
    expect(substatRollCount("ATK%", 5, rollValue("ATK%", 5, 6, 1.0))).toBe(6);
  });
});

// rolls/multipliers chosen so each substat's value is unambiguously inside
// one roll-count bracket (see substatRollCount's own comment on why that's
// always possible) -- the actual multiplier tier used doesn't matter to
// validateSubstatRollTotal, only the resulting roll count does.
describe("validateSubstatRollTotal", () => {
  it("accepts a maxed 5-star piece with the lucky 4th initial substat (4+5 = 9 total rolls)", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 3, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 2, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 2, 1.0) },
      { statTypeName: "Energy Recharge%", value: rollValue("Energy Recharge%", 5, 2, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 20, substats)).toEqual({ valid: true });
  });

  it("accepts a maxed 5-star piece without the lucky 4th initial substat (3+5 = 8 total rolls)", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 2, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 2, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 2, 1.0) },
      { statTypeName: "Energy Recharge%", value: rollValue("Energy Recharge%", 5, 2, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 20, substats)).toEqual({ valid: true });
  });

  it("rejects a maxed 5-star piece whose substats add up to more rolls than physically possible", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 3, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 3, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 3, 1.0) },
      { statTypeName: "Energy Recharge%", value: rollValue("Energy Recharge%", 5, 3, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 20, substats).valid).toBe(false);
  });

  it("rejects fewer substats than a piece could ever drop with", () => {
    const result = validateSubstatRollTotal(5, 0, [{ statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 1, 1.0) }]);
    expect(result.valid).toBe(false);
  });

  it("accepts a fresh 4-star piece at its minimum initial substat count", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "ATK%", value: rollValue("ATK%", 4, 1, 1.0) },
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 4, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(4, 0, substats)).toEqual({ valid: true });
  });

  // Regression: a 5-star piece with only 3 substats (one already upgraded)
  // at level 4 was wrongly accepted -- a 5-star's first upgrade is always
  // spent revealing its 4th substat if it doesn't have one yet, so from
  // level 4 onward it must show exactly 4 substats, never 3, regardless of
  // which initial count (3 or 4) it actually had.
  it("rejects a level-4 5-star piece still showing only 3 substats", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 2, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 1, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 4, substats).valid).toBe(false);
  });

  it("accepts a level-4 5-star piece with exactly 4 substats either way (3+1 revealed, or 4+1 boosted)", () => {
    const allFirstRoll: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 1, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 1, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 1, 1.0) },
      { statTypeName: "Energy Recharge%", value: rollValue("Energy Recharge%", 5, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 4, allFirstRoll)).toEqual({ valid: true });

    const oneBoosted: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 5, 2, 1.0) },
      { statTypeName: "Crit DMG%", value: rollValue("Crit DMG%", 5, 1, 1.0) },
      { statTypeName: "ATK%", value: rollValue("ATK%", 5, 1, 1.0) },
      { statTypeName: "Energy Recharge%", value: rollValue("Energy Recharge%", 5, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(5, 4, oneBoosted)).toEqual({ valid: true });
  });

  it("accepts either 3 or 4 substats on a 4-star piece at level 4, depending on initial count", () => {
    const threeSubstats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "ATK%", value: rollValue("ATK%", 4, 1, 1.0) },
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 4, 1, 1.0) },
      { statTypeName: "DEF%", value: rollValue("DEF%", 4, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(4, 4, threeSubstats)).toEqual({ valid: true });

    const fourSubstats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "ATK%", value: rollValue("ATK%", 4, 1, 1.0) },
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 4, 1, 1.0) },
      { statTypeName: "DEF%", value: rollValue("DEF%", 4, 1, 1.0) },
      { statTypeName: "Elemental Mastery", value: rollValue("Elemental Mastery", 4, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(4, 4, fourSubstats)).toEqual({ valid: true });
  });

  it("rejects a 4-star piece already showing 4 substats before its 2nd upgrade could have revealed both missing ones", () => {
    // Exercised at level 0 (0 upgrades so far) rather than level 4, since a
    // 3-initial 4-star piece already reaches 4 substats by level 4 (see the
    // test above) -- but no initial count ever starts at 4, so 4 substats
    // at level 0 is impossible either way.
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "ATK%", value: rollValue("ATK%", 4, 1, 1.0) },
      { statTypeName: "Crit Rate%", value: rollValue("Crit Rate%", 4, 1, 1.0) },
      { statTypeName: "DEF%", value: rollValue("DEF%", 4, 1, 1.0) },
      { statTypeName: "Elemental Mastery", value: rollValue("Elemental Mastery", 4, 1, 1.0) },
    ];
    expect(validateSubstatRollTotal(4, 0, substats).valid).toBe(false);
  });
});
