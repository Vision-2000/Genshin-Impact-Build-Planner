import { describe, it, expect } from "vitest";
import { roundHalfUp, roundHalfUpFixed } from "./round";

describe("roundHalfUp / roundHalfUpFixed", () => {
  it("rounds a genuine tie up, where Number.prototype.toFixed gets it wrong", () => {
    // 0.01275*100 = 1.2749999999999999 in IEEE754 -- toFixed(2) wrongly
    // gives "1.27"; the intended decimal value is an exact tie at 1.275,
    // which rounds half-up to 1.28.
    expect((0.01275 * 100).toFixed(2)).toBe("1.27"); // the bug, for contrast
    expect(roundHalfUp(0.01275 * 100, 2)).toBe(1.28);
    expect(roundHalfUpFixed(0.01275 * 100, 2)).toBe("1.28");
  });

  it("fixes The Catch's Lv15 secondary stat (10 * 1.565, 1dp)", () => {
    expect((10 * 1.565).toFixed(1)).toBe("15.6"); // the bug, for contrast
    expect(roundHalfUpFixed(10 * 1.565, 1)).toBe("15.7");
  });

  it("still gets The Black Sword's Lv40 secondary stat right (6 * 2.575, 1dp)", () => {
    expect(roundHalfUpFixed(6 * 2.575, 1)).toBe("15.5");
  });

  it("cleans up float noise already baked into source data", () => {
    expect(roundHalfUp(6.6667000000000005, 4)).toBe(6.6667);
    expect(roundHalfUpFixed(6.6667000000000005, 4)).toBe("6.6667");
  });

  it("pads with trailing zeros to the requested decimal count", () => {
    expect(roundHalfUpFixed(15, 1)).toBe("15.0");
    expect(roundHalfUpFixed(5, 0)).toBe("5");
  });

  it("behaves like ordinary rounding for non-tie values", () => {
    expect(roundHalfUp(298.749, 0)).toBe(299);
    expect(roundHalfUpFixed(3.889, 1)).toBe("3.9");
  });
});
