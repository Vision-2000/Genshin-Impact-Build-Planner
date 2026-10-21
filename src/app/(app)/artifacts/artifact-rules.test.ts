import { describe, it, expect } from "vitest";
import { roundHalfUp } from "@/lib/round";
import {
  computeArtifactMainStatValue,
  substatRollCount,
  substatValidValues,
  validateSubstatRollTotal,
  SUBSTAT_HIGHEST_ROLL,
  SUBSTAT_LOWER_ROLL_TIERS,
  SUBSTAT_ROLL_MULTIPLIERS,
  type SubstatTypeName,
} from "./artifact-rules";

// Mirrors artifact-rules.ts's own private rollTierValues -- builds a
// substat value that's the result of `rolls` rolls each landing on
// `multiplier` (one of SUBSTAT_ROLL_MULTIPLIERS), for exercising
// substatRollCount/validateSubstatRollTotal without needing production's
// own roll-combination search. Reads the per-roll value straight out of
// SUBSTAT_LOWER_ROLL_TIERS/SUBSTAT_HIGHEST_ROLL -- the same tables
// production itself reads -- rather than re-deriving it by multiplying
// `multiplier x highest`, since that derivation is known to be off by
// 0.01 at some (stat, rarity, tier) combinations (see
// SUBSTAT_LOWER_ROLL_TIERS's own comment).
function rollValue(statName: SubstatTypeName, rarity: number, rolls: number, multiplier: number): number {
  const tierIndex = SUBSTAT_ROLL_MULTIPLIERS.indexOf(multiplier as (typeof SUBSTAT_ROLL_MULTIPLIERS)[number]);
  const tierValues = [...SUBSTAT_LOWER_ROLL_TIERS[statName][rarity], SUBSTAT_HIGHEST_ROLL[statName][rarity]];
  const perRoll = tierValues[tierIndex];
  return roundHalfUp(rolls * perRoll, 2);
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

  // Regression guard for a real bug: a 2-roll sum must be the sum of each
  // roll's OWN rounded value (4.08 + 4.66 = 8.74 for ATK%'s low+mid-low
  // tiers), not round(1.5 x highest, 2) = 8.75 -- summing the raw unrounded
  // multiplier fractions and rounding only once at the end offers a value
  // (8.75, which displays as "8.8%") no real roll combination ever
  // produces, while omitting the real one (8.74, "8.7%").
  it("offers the sum of each roll's own rounded value, not a once-at-the-end rounding of the raw fraction sum", () => {
    const values = substatValidValues("ATK%", 5, 20);
    expect(values).toContain(8.74);
    expect(values).not.toContain(8.75);
  });

  // Regression guard: these 4 tier values can't be reproduced by
  // multiplying SUBSTAT_HIGHEST_ROLL by each of SUBSTAT_ROLL_MULTIPLIERS
  // and rounding -- that derivation gives 20.84 for DEF 5★'s 90% tier, not
  // the real 20.83 (confirmed against a community-sourced roll table
  // covering all 4 tiers) -- which is exactly why each tier is now its own
  // stored value (SUBSTAT_LOWER_ROLL_TIERS) rather than a derived one.
  it("uses DEF 5★'s real 90%-tier value (20.83), not the derived one (20.84)", () => {
    const values = substatValidValues("DEF", 5, 20);
    expect(values).toContain(20.83);
    expect(values).not.toContain(20.84);
  });

  // Crit Rate% 5★'s 13.99 (5 rolls) and 14.00 (4 rolls) are two genuinely
  // different exact sums that both display as "14.0%" -- the player was
  // never shown a 2-decimal number, so offering both as separate slider
  // stops would be exposing internal storage precision nobody asked for.
  // Only one survives, and it's 14.00 -- the smaller (4) roll count's own
  // value, reached first since roll counts are walked ascending.
  it("collapses two exact values that display identically into a single slider stop", () => {
    const values = substatValidValues("Crit Rate%", 5, 20);
    const matchingDisplay14 = values.filter((v) => roundHalfUp(v, 1) === 14.0);
    expect(matchingDisplay14).toEqual([14.0]);
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

  // Regression guard: 77.80 flat ATK on a 5★ piece is genuinely ambiguous
  // -- 4 rolls all at the 100% tier (19.45 x 4) lands on the exact same
  // value as 5 rolls all at the 80% tier (15.56 x 5). substatRollCount must
  // deliberately resolve this to the SMALLER count (see its own comment on
  // why) -- not whichever happens to be found first by iteration order.
  it("resolves a value ambiguous between two roll counts to the smaller one", () => {
    const fourRollsAtMax = rollValue("ATK", 5, 4, 1.0);
    const fiveRollsAtMidLow = rollValue("ATK", 5, 5, 0.8);
    expect(fourRollsAtMax).toBe(fiveRollsAtMidLow);
    expect(substatRollCount("ATK", 5, fourRollsAtMax)).toBe(4);
  });

  // substatValidValues itself never offers 13.99 any more (see its own
  // comment -- it's collapsed into 14.00's slider stop, since both read
  // "14.0%"), but substatRollCount must still resolve 13.99 correctly if
  // it's ever handed one anyway -- a piece saved before this collapsing
  // existed could still have 13.99 sitting in the database. Matched at
  // display precision (1 decimal for a %-stat), not the full 2-decimal
  // stored value, it still reports the smaller roll count (4) either way.
  it("still resolves a pre-existing, non-canonical value to the smaller roll count its display value implies", () => {
    expect(substatRollCount("Crit Rate%", 5, 13.99)).toBe(4);
    expect(substatRollCount("Crit Rate%", 5, 14.0)).toBe(4);
  });
});

// rolls/multipliers chosen (mostly 1.0, the highest tier) so each
// substat's value is unambiguously inside one roll-count bracket -- see
// possibleSubstatRollCounts's own comment on why that's usually, but not
// always, the case. The actual multiplier tier used doesn't matter to
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

  // Regression guard for the exact bug the "always take the smallest roll
  // count" policy caused: a 5★ level 20 piece with 3 initial substats (CR
  // + 2 others) has 5 total upgrades -- 1 forced to reveal the still-
  // missing 4th substat, the other 4 all landing on Crit Rate%. CR's own
  // TRUE roll count is then 5 (1 initial + 4 upgrades), landing on 13.99 --
  // which displays identically to the 4-roll value (14.00), so it's
  // AMBIGUOUS between "3 upgrades" and "4 upgrades" worth of rolls. The
  // true total here is 5 (CR) + 1 + 1 + 1 = 8, one of this piece's own two
  // valid totals (8 or 9) -- but summing every substat's own SMALLEST
  // possible reading instead (CR=4, not the true 5) gives 7, matching
  // neither, and would wrongly reject this real, valid piece.
  it("accepts a piece whose true roll history needs a substat's LARGER ambiguous reading, not just its smallest", () => {
    const substats: { statTypeName: SubstatTypeName; value: number }[] = [
      { statTypeName: "Crit Rate%", value: 13.99 },
      { statTypeName: "ATK%", value: substatValidValues("ATK%", 5, 20)[0] },
      { statTypeName: "DEF%", value: substatValidValues("DEF%", 5, 20)[0] },
      { statTypeName: "Energy Recharge%", value: substatValidValues("Energy Recharge%", 5, 20)[0] },
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
