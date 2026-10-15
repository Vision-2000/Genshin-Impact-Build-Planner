import { roundHalfUp } from "./round";

// Weapon passive text is stored as a single template (Weapon.
// passiveDescriptionTemplate) with {0}, {1}, ... placeholders, plus one
// WeaponRefinementValue row per placeholder describing how that number
// scales from refinement 1 to Weapon.maxRefinement -- instead of up to 5
// full pre-rendered description strings per weapon (WeaponRefinementEffect,
// still used but only for the one weapon this can't handle, Exaiphanes
// Blade, whose passive gains an entire extra clause at R2+ that R1 doesn't
// have -- a genuine structural difference, not a reworded number).
//
// The classification into template + per-placeholder curve happens
// upstream, in weapons.json itself (hand-maintained against Lunaris/
// Project Amber/HoYoWiki) -- this module only reconstructs display text
// from the already-classified template + curves at read time.
//
// The same "a number that scales by refinement is base+slope, or a raw
// fallback" idea is shared with WeaponStatBonus (see computeWeaponValueCurve
// below) -- the one difference is that a stat bonus always gets a row even
// when its value is Constant (a stat bonus is a queryable fact regardless
// of whether it scales), whereas a constant passive-text number never gets
// a WeaponRefinementSlot at all (it's already correct as plain template
// text, so there's nothing to compute).
export type WeaponValueCurveType = "Constant" | "Linear" | "Custom";

export type WeaponValueCurve = {
  curveType: WeaponValueCurveType;
  baseValue: number;
  slope: number | null;
  customValues: number[] | null;
};

export type WeaponRefinementCurveType = Exclude<WeaponValueCurveType, "Constant">;

export type WeaponRefinementSlot = {
  slotIndex: number;
  curveType: WeaponRefinementCurveType;
  baseValue: number;
  slope: number | null;
  customValues: number[] | null;
};

// Given a stored curve + a refinement level, returns the actual value --
// used at read time instead of indexing into a stored per-refinement value.
export function computeWeaponValueCurve(
  curve: Pick<WeaponValueCurve, "curveType" | "baseValue" | "slope" | "customValues">,
  refinement: number
): number {
  if (curve.curveType === "Constant") return curve.baseValue;
  if (curve.curveType === "Custom") {
    return curve.customValues![Math.min(refinement - 1, curve.customValues!.length - 1)];
  }
  return curve.baseValue + curve.slope! * (refinement - 1);
}

// Numbers in this domain are always short, human-authored decimals (game
// balance values like 12, 24.5, 200) -- round away the floating-point
// noise a linear computation can introduce (e.g. 2.4000000000000004), then
// let JS's own number->string conversion drop the trailing zeros.
// roundHalfUp (not Math.round) since a value that lands exactly on a tie
// at the 4th decimal would otherwise round the wrong way depending on
// which side of 0 the representation noise happens to fall -- see
// src/lib/round.ts.
export function formatWeaponRefinementNumber(value: number): string {
  return String(roundHalfUp(value, 4));
}

// Inserts each slot's value at the given refinement into the template's
// {0}, {1}, ... placeholders. A regex replace rather than positional
// splicing, so it doesn't care about slot order or count. Each inserted
// value is wrapped in **markers** -- the same convention genshin-db's own
// raw text uses for an emphasized term -- so HighlightedText (every caller
// of this function renders its result through that) highlights it in the
// same neutral yellow as a talent/constellation name, with no separate
// rendering logic needed here: HighlightedText's bold-term pattern doesn't
// care whether the ** came from genshin-db's own data or from this
// function inserting a number.
export function renderWeaponPassiveDescription(
  template: string,
  slots: Pick<WeaponRefinementSlot, "slotIndex" | "curveType" | "baseValue" | "slope" | "customValues">[],
  refinement: number
): string {
  const bySlot = new Map(slots.map((s) => [s.slotIndex, s]));
  return template.replace(/\{(\d+)\}/g, (match, indexStr) => {
    const slot = bySlot.get(Number(indexStr));
    if (!slot) return match;
    return `**${formatWeaponRefinementNumber(computeWeaponValueCurve(slot, refinement))}**`;
  });
}
