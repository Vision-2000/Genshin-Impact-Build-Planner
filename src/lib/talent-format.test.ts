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

  it("formats plain P as a whole percent, rounded half-up (not fractional)", () => {
    // Xiao's Plunge DMG at talent level 1
    expect(formatTalentValue(0.818335, "P")).toBe("82%");
  });
});

// Fixtures use curveType "Constant" throughout -- computeTalentAttributeValue
// returns baseValue unchanged for it regardless of level, which is all
// groupTalentAttributes needs to exercise here (it's tested against real
// curve-fitting/round-trip behavior separately in
// data-source/verify-talent-scaling-roundtrip.mts).
function constantAttribute(
  label: string,
  formatCode: string,
  value: number,
  options: { order?: number; hitCount?: number; prefix?: string | null; suffix?: string | null } = {}
) {
  return {
    label,
    formatCode,
    curveType: "Constant",
    baseValue: value,
    linearSlope: null,
    capLevel: null,
    customValues: [],
    order: options.order ?? 0,
    hitCount: options.hitCount ?? 1,
    prefix: options.prefix ?? null,
    suffix: options.suffix ?? null,
  };
}

describe("groupTalentAttributes", () => {
  it("merges a (1)/(2)-suffixed pair into one row with slash-joined values", () => {
    const attributes = [
      constantAttribute("Low/High Plunge DMG (1)", "F1P", 1.136, { order: 0 }),
      constantAttribute("Low/High Plunge DMG (2)", "F1P", 1.419, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
    ]);
  });

  it("merges a plain-P pair into whole-percent slash-joined values", () => {
    // Xiao's Low/High Plunge DMG
    const attributes = [
      constantAttribute("Low/High Plunge DMG (1)", "P", 1.638, { order: 0 }),
      constantAttribute("Low/High Plunge DMG (2)", "P", 2.044, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "Low/High Plunge DMG", display: "164%/204%" }]);
  });

  it("leaves an unsuffixed single-param label alone", () => {
    const attributes = [constantAttribute("1-Hit DMG", "F1P", 0.44548)];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "1-Hit DMG", display: "44.5%" }]);
  });

  it("doesn't merge two different labels that both happen to be suffixed", () => {
    const attributes = [
      constantAttribute("Low/High Plunge DMG (1)", "F1P", 1.136, { order: 0 }),
      constantAttribute("Low/High Plunge DMG (2)", "F1P", 1.419, { order: 1 }),
      constantAttribute("Plunge DMG (1)", "F1P", 2.0, { order: 2 }),
      constantAttribute("Plunge DMG (2)", "F1P", 2.5, { order: 3 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
      { label: "Plunge DMG", display: "200.0%/250.0%" },
    ]);
  });

  it("joins a (Part N) pair with + instead of /", () => {
    // Albedo's Charged Attack DMG
    const attributes = [
      constantAttribute("Charged Attack DMG (Part 1)", "F1P", 0.5, { order: 0 }),
      constantAttribute("Charged Attack DMG (Part 2)", "F1P", 0.3, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "Charged Attack DMG", display: "50.0%+30.0%" }]);
  });

  it("factors out a uniform, non-1 hitCount on a + row into (A+B)×N", () => {
    // Alhaitham's 3-Mirror Projection Attack DMG
    const attributes = [
      constantAttribute("3-Mirror Projection Attack DMG (Part 1)", "F0P", 0.5, { order: 0, hitCount: 3, suffix: " ATK" }),
      constantAttribute("3-Mirror Projection Attack DMG (Part 2)", "F0", 10, { order: 1, hitCount: 3, suffix: " Elemental Mastery" }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "3-Mirror Projection Attack DMG", display: "(50% ATK+10 Elemental Mastery)×3" },
    ]);
  });

  it("leaves a + row with hitCount uniformly 1 as a plain join (no ×1)", () => {
    // Alhaitham's 1-Mirror Projection Attack DMG
    const attributes = [
      constantAttribute("1-Mirror Projection Attack DMG (Part 1)", "F0P", 0.5, { order: 0, suffix: " ATK" }),
      constantAttribute("1-Mirror Projection Attack DMG (Part 2)", "F0", 10, { order: 1, suffix: " Elemental Mastery" }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "1-Mirror Projection Attack DMG", display: "50% ATK+10 Elemental Mastery" },
    ]);
  });

  it("puts ×N on each part of a / row individually, not factored out", () => {
    // Clorinde's Impale the Night DMG (1)/(2)/(3) -- only the 3rd part hits 3 times
    const attributes = [
      constantAttribute("Impale the Night DMG (1)", "F0P", 0.5, { order: 0 }),
      constantAttribute("Impale the Night DMG (2)", "F0P", 0.6, { order: 1 }),
      constantAttribute("Impale the Night DMG (3)", "F0P", 0.4, { order: 2, hitCount: 3 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Impale the Night DMG", display: "50%/60%/40%×3" },
    ]);
  });

  it("shows ×N for a standalone (ungrouped) attribute, with no parens", () => {
    // Aino's Normal Attack 3-Hit DMG
    const attributes = [constantAttribute("3-Hit DMG", "F0P", 0.5, { hitCount: 2 })];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "3-Hit DMG", display: "50%×2" }]);
  });

  it("joins an (N Character)/(N Characters) pair with /, keeping the qualifier as a per-part prefix", () => {
    // Nahida's Burst Pyro: DMG Bonus
    const attributes = [
      constantAttribute("Pyro: DMG Bonus (1 Character)", "F0P", 0.1, { order: 0 }),
      constantAttribute("Pyro: DMG Bonus (2 Characters)", "F0P", 0.2, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Pyro: DMG Bonus", display: "1 Character 10%/2 Characters 20%" },
    ]);
  });

  it("joins a literal (min)/(max) pair with a dash", () => {
    // Kirara/Sayu/Tartaglia's Skill CD
    const attributes = [
      constantAttribute("CD (min)", "F1", 4, { order: 0, suffix: "s" }),
      constantAttribute("CD (max)", "F1", 8, { order: 1, suffix: "s" }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "CD", display: "4.0s-8.0s" }]);
  });

  it("treats any other trailing bracket as part of the name, never grouping", () => {
    // Charlotte's Skill Photo DMG (Press)/(Hold)
    const attributes = [
      constantAttribute("Photo DMG (Press)", "F0P", 0.5, { order: 0 }),
      constantAttribute("Photo DMG (Hold)", "F0P", 0.8, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Photo DMG (Press)", display: "50%" },
      { label: "Photo DMG (Hold)", display: "80%" },
    ]);
  });

  it("only treats the LAST bracket as a marker when a label has two", () => {
    // Nefer's Skill Phantasm Performance 1-Hit DMG (Nefer) (Part 1)/(Part 2)
    const attributes = [
      constantAttribute("Phantasm Performance 1-Hit DMG (Nefer) (Part 1)", "F0P", 0.3, { order: 0 }),
      constantAttribute("Phantasm Performance 1-Hit DMG (Nefer) (Part 2)", "F0P", 0.2, { order: 1 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Phantasm Performance 1-Hit DMG (Nefer)", display: "30%+20%" },
    ]);
  });

  it("renders prefix and suffix around the value, unaffected by grouping", () => {
    // Traveler's Skill Hold Duration
    const attributes = [constantAttribute("Hold Duration", "F1", 5, { prefix: "Max ", suffix: "s" })];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "Hold Duration", display: "Max 5.0s" }]);
  });

  it("sorts parts by `order`, independent of input array position", () => {
    const attributes = [
      constantAttribute("Low/High Plunge DMG (2)", "F0P", 0.6, { order: 1 }),
      constantAttribute("Low/High Plunge DMG (1)", "F0P", 0.5, { order: 0 }),
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "Low/High Plunge DMG", display: "50%/60%" }]);
  });
});
