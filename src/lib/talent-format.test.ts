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
});

describe("groupTalentAttributes", () => {
  it("merges a (1)/(2)-suffixed pair into one row with slash-joined values", () => {
    const attributes = [
      { label: "Low/High Plunge DMG (1)", formatCode: "F1P", values: [1.136] },
      { label: "Low/High Plunge DMG (2)", formatCode: "F1P", values: [1.419] },
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
    ]);
  });

  it("leaves an unsuffixed single-param label alone", () => {
    const attributes = [{ label: "1-Hit DMG", formatCode: "F1P", values: [0.44548] }];
    expect(groupTalentAttributes(attributes, 1)).toEqual([{ label: "1-Hit DMG", display: "44.5%" }]);
  });

  it("doesn't merge two different labels that both happen to be suffixed", () => {
    const attributes = [
      { label: "Low/High Plunge DMG (1)", formatCode: "F1P", values: [1.136] },
      { label: "Low/High Plunge DMG (2)", formatCode: "F1P", values: [1.419] },
      { label: "Plunge DMG (1)", formatCode: "F1P", values: [2.0] },
      { label: "Plunge DMG (2)", formatCode: "F1P", values: [2.5] },
    ];
    expect(groupTalentAttributes(attributes, 1)).toEqual([
      { label: "Low/High Plunge DMG", display: "113.6%/141.9%" },
      { label: "Plunge DMG", display: "200.0%/250.0%" },
    ]);
  });
});
