import { describe, it, expect } from "vitest";
import { formatTalentValue, groupTalentAttributes } from "./talent-format";

describe("formatTalentValue", () => {
  it("formats F1P as a one-decimal percentage", () => {
    // Bennett's Normal Attack 1-Hit DMG at talent level 1 (real genshin-db value)
    expect(formatTalentValue(0.44548, "F1P")).toBe("44.5%");
  });

  it("formats F0P as a whole-number percentage", () => {
    expect(formatTalentValue(0.5, "F0P")).toBe("50%");
  });

  it("formats F1 (no percent) with one decimal and no % suffix", () => {
    // Bennett's Charged Attack Stamina Cost
    expect(formatTalentValue(7.5, "F1")).toBe("7.5");
  });

  it("formats I as a plain integer, unscaled", () => {
    expect(formatTalentValue(5, "I")).toBe("5");
  });

  it("formats I by rounding half-up, not truncating", () => {
    expect(formatTalentValue(770.3755, "I")).toBe("770");
    expect(formatTalentValue(930.89, "I")).toBe("931");
  });
});

// Fixtures use curveType "Constant" throughout -- computeTalentAttributeValue
// returns baseValue unchanged for it regardless of level, which is all
// groupTalentAttributes needs to exercise here (it's tested against real
// curve-fitting/round-trip behavior separately in
// data-source/verify-talent-scaling-roundtrip.mts).
function constantAttribute(label: string, formatCode: string, value: number) {
  return { label, formatCode, curveType: "Constant", baseValue: value, linearSlope: null, capLevel: null, customValues: [] };
}

describe("groupTalentAttributes", () => {
  it("merges a (1)/(2)-suffixed pair into one row with slash-joined values", () => {
    const attributes = [
      constantAttribute("Low/High Plunge DMG (1)", "F1P", 1.136),
      constantAttribute("Low/High Plunge DMG (2)", "F1P", 1.419),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
    ]);
  });

  it("leaves an unsuffixed single-param label alone", () => {
    const attributes = [constantAttribute("1-Hit DMG", "F1P", 0.44548)];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "1-Hit DMG", display: "44.5%" }]);
  });

  it("doesn't merge two different labels that both happen to be suffixed", () => {
    const attributes = [
      constantAttribute("Low/High Plunge DMG (1)", "F1P", 1.136),
      constantAttribute("Low/High Plunge DMG (2)", "F1P", 1.419),
      constantAttribute("Plunge DMG (1)", "F1P", 2.0),
      constantAttribute("Plunge DMG (2)", "F1P", 2.5),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
      { label: "Plunge DMG", display: "200.0%/250.0%" },
    ]);
  });
});
