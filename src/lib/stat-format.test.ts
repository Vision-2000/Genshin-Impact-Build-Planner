import { describe, it, expect } from "vitest";
import { formatStatValue } from "./stat-format";

describe("formatStatValue", () => {
  it("shows flat stats as whole numbers", () => {
    expect(formatStatValue("Elemental Mastery", 23.31)).toBe("23");
    expect(formatStatValue("HP", 298.75)).toBe("299");
  });

  it("shows percent stats with 1 decimal", () => {
    expect(formatStatValue("Crit Rate%", 3.889)).toBe("3.9");
    expect(formatStatValue("Energy Recharge%", 6.48)).toBe("6.5");
  });

  it("rounds a genuine tie up, not whichever way native toFixed's float noise happens to fall", () => {
    // The Catch's Lv15 secondary stat (10 * 1.565) -- toFixed(1) alone
    // gives "15.6"; the correct half-up answer is "15.7".
    expect(formatStatValue("Crit Rate%", 10 * 1.565)).toBe("15.7");
  });

  it("never shows raw float noise from source data", () => {
    // weapons.json has baseSecondaryStatValue entries like this.
    expect(formatStatValue("Elemental Mastery", 6.6667000000000005)).toBe("7");
  });
});
