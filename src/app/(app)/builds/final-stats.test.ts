import { describe, it, expect } from "vitest";
import { WeaponType } from "@/generated/prisma/enums";
import { DEFAULT_WEAPON } from "@/lib/default-weapon";
import { computeFinalStats, type FinalStatsCharacterInput } from "./final-stats";

// Deliberately zeroed-out base stats/bonuses everywhere a real value isn't
// the point of a given test -- isolates whatever this test actually cares
// about (here, the weapon's own ATK contribution) from character-side noise.
function blankCharacter(overrides: Partial<FinalStatsCharacterInput> = {}): FinalStatsCharacterInput {
  return {
    name: "Test Character",
    rarity: 5,
    weaponType: WeaponType.Sword,
    baseHp: null,
    baseAttack: null,
    baseDefense: null,
    maxAscensionHp: null,
    maxAscensionAttack: null,
    maxAscensionDefense: null,
    baseElementalMastery: 0,
    ascensionStatName: null,
    level: 1,
    ascensionPhase: 0,
    constellation: 0,
    talentStatBonuses: [],
    constellationStatBonuses: [],
    ...overrides,
  };
}

// A build's weapon is required in-game -- there's no "unarmed" state -- so
// a build with no real OwnedWeapon chosen represents the character's own
// type's basic 1-star starter weapon, not a blank slot, and must total ATK
// accordingly (see DEFAULT_WEAPON's own comment on why this exists at all,
// and final-stats.ts's own weaponBaseAttack branch).
describe("computeFinalStats", () => {
  it("contributes the default 1-star weapon's base ATK when no real weapon is chosen", () => {
    const character = blankCharacter({ weaponType: WeaponType.Sword });
    const result = computeFinalStats({ character, weapon: null, artifacts: [] });
    expect(result.totals.ATK).toBe(DEFAULT_WEAPON[WeaponType.Sword].baseAttack);
  });

  it("looks up the default by the character's own weapon type, not a hardcoded one", () => {
    const character = blankCharacter({ weaponType: WeaponType.Catalyst });
    const result = computeFinalStats({ character, weapon: null, artifacts: [] });
    expect(result.totals.ATK).toBe(DEFAULT_WEAPON[WeaponType.Catalyst].baseAttack);
  });

  it("ignores the default weapon table once a real weapon is chosen", () => {
    const character = blankCharacter({ weaponType: WeaponType.Sword });
    const result = computeFinalStats({
      character,
      weapon: {
        attackTier: null,
        rarity: 5,
        attackCurveRarity: null,
        baseSecondaryStatValue: null,
        secondaryStatName: null,
        level: 1,
        ascensionPhase: 0,
        refinement: 1,
        statBonuses: [],
      },
      artifacts: [],
    });
    // attackTier null means this particular real weapon contributes 0 ATK
    // of its own (see FinalStatsWeaponInput's own comment) -- the point
    // here is just that it's 0, not DEFAULT_WEAPON's 23, confirming the
    // default table is never consulted once `weapon` is non-null.
    expect(result.totals.ATK).toBe(0);
  });

  it("exposes ATK/HP/DEF's own base portion separately from the full total", () => {
    const character = blankCharacter({ weaponType: WeaponType.Sword });
    const result = computeFinalStats({ character, weapon: null, artifacts: [] });
    // Blank character contributes 0 base HP/ATK/DEF of its own (null
    // baseHp/baseAttack/baseDefense) -- ATK's base is still the default
    // weapon's own base ATK, same value totals.ATK already asserts above.
    expect(result.baseStats).toEqual({ ATK: DEFAULT_WEAPON[WeaponType.Sword].baseAttack, HP: 0, DEF: 0 });
  });
});
