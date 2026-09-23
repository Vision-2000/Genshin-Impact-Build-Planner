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
});
