import { describe, it, expect } from "vitest";
import { weaponAttackLevelMultiplier } from "./weapon-scaling";

describe("weaponAttackLevelMultiplier", () => {
  it("matches the corrected rarity-5 tier-4 values (previously lost a trailing digit)", () => {
    expect(weaponAttackLevelMultiplier(5, 4, 7)).toBe(1.591);
    expect(weaponAttackLevelMultiplier(5, 4, 9)).toBe(1.793);
    expect(weaponAttackLevelMultiplier(5, 4, 18)).toBe(2.734);
    expect(weaponAttackLevelMultiplier(5, 4, 34)).toBe(4.499);
    expect(weaponAttackLevelMultiplier(5, 4, 47)).toBe(6.001);
    expect(weaponAttackLevelMultiplier(5, 4, 57)).toBe(7.189);
    expect(weaponAttackLevelMultiplier(5, 4, 59)).toBe(7.429);
    expect(weaponAttackLevelMultiplier(5, 4, 70)).toBe(8.769);
  });

  it("leaves surrounding untouched levels as they were", () => {
    expect(weaponAttackLevelMultiplier(5, 4, 6)).toBe(1.49);
    expect(weaponAttackLevelMultiplier(5, 4, 8)).toBe(1.692);
    expect(weaponAttackLevelMultiplier(5, 4, 90)).toBe(11.272);
  });
});
