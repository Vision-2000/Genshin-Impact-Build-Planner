import { describe, it, expect } from "vitest";
import { tokenizeWeaponPassiveDescription } from "./weapon-refinement-scaling";

describe("tokenizeWeaponPassiveDescription", () => {
  it("splits literal text from a single placeholder's current/widest pair", () => {
    // R1=5, R2=5.5, R3=6, R4=6.5, R5=7 -- formatWeaponRefinementNumber
    // drops trailing zeros, so R5 renders as the short "7" while R2/R4
    // render as the wider "5.5"/"6.5" (matches a real seeded weapon's
    // Elemental Mastery slot, which is shorter at max refinement than at
    // two earlier ones -- the whole reason "widest" isn't just "value at
    // maxRefinement").
    const slot = { slotIndex: 0, curveType: "Custom" as const, baseValue: 0, slope: null, customValues: [5, 5.5, 6, 6.5, 7] };

    const atR5 = tokenizeWeaponPassiveDescription("Elemental Mastery +{0}.", [slot], 5, 5);
    expect(atR5).toEqual([
      { kind: "text", text: "Elemental Mastery +" },
      { kind: "value", current: "7", widest: "5.5" },
      { kind: "text", text: "." },
    ]);

    const atR2 = tokenizeWeaponPassiveDescription("Elemental Mastery +{0}.", [slot], 2, 5);
    expect(atR2[1]).toEqual({ kind: "value", current: "5.5", widest: "5.5" });
  });

  it("computes each placeholder's widest independently of the others", () => {
    const slots = [
      // Widest at R1 ("10").
      { slotIndex: 0, curveType: "Custom" as const, baseValue: 0, slope: null, customValues: [10, 9, 8, 7, 6] },
      // Widest at R5 ("5.5").
      { slotIndex: 1, curveType: "Custom" as const, baseValue: 0, slope: null, customValues: [4, 4, 4, 4, 5.5] },
    ];
    const tokens = tokenizeWeaponPassiveDescription("A: {0}, B: {1}", slots, 1, 5);
    expect(tokens).toEqual([
      { kind: "text", text: "A: " },
      { kind: "value", current: "10", widest: "10" },
      { kind: "text", text: ", B: " },
      { kind: "value", current: "4", widest: "5.5" },
    ]);
  });

  it("leaves a placeholder with no matching slot as literal text", () => {
    const tokens = tokenizeWeaponPassiveDescription("Unscaled {0} text.", [], 1, 5);
    expect(tokens).toEqual([
      { kind: "text", text: "Unscaled " },
      { kind: "text", text: "{0}" },
      { kind: "text", text: " text." },
    ]);
  });
});
