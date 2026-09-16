import { describe, it, expect } from "vitest";
import { formatTalentValue } from "./talent-format";

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
