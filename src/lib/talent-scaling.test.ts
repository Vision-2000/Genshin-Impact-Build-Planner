import { describe, it, expect } from "vitest";
import { computeTalentAttributeValue } from "./talent-scaling";

describe("computeTalentAttributeValue", () => {
  it("rounds a named curve's result to 6 decimal places", () => {
    // Physical1 ratio at level 2 is 93/86 = 1.0813953488..., which would
    // leave floating-point noise past 6dp if not rounded.
    const value = computeTalentAttributeValue(
      { curveType: "Physical1", baseValue: 0.5, linearSlope: null, capLevel: null, customValues: null },
      2
    );
    expect(value).toBe(0.540698);
  });

  it("uses the exact fraction, not a 4dp-rounded approximation", () => {
    // Physical1 level 11 ratio is 182/86 -- a 4dp rounding (2.1163) would
    // under-shoot the true fraction (2.116279...).
    const value = computeTalentAttributeValue(
      { curveType: "Physical1", baseValue: 1, linearSlope: null, capLevel: null, customValues: null },
      11
    );
    expect(value).toBeCloseTo(182 / 86, 6);
  });

  it("doesn't round Constant/Linear/Custom curves", () => {
    expect(
      computeTalentAttributeValue({ curveType: "Constant", baseValue: 7.123456789, linearSlope: null, capLevel: null, customValues: null }, 5)
    ).toBe(7.123456789);
  });
});
