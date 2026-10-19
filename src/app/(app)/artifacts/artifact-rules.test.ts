import { describe, it, expect } from "vitest";
import { computeArtifactMainStatValue } from "./artifact-rules";

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
