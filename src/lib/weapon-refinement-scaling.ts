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
// value is wrapped in **markers** -- every caller of this function
// renders its result through BoldHighlightedText, which highlights
// exactly this: a value that scales with refinement, the only thing a
// weapon's passive text actually highlights in-game.
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

// The widest a single slot's rendered string ever gets across every real
// refinement -- NOT necessarily at maxRefinement. formatWeaponRefinementNumber
// drops trailing zeros (via Number->string conversion), so a Linear slot
// that happens to land on a whole number at a high refinement can render
// SHORTER than one that lands on a decimal at a lower one -- e.g. a slot
// worth 5.5/6.5 at R2/R4 but a bare 7 at R5. Only ever used for ghost-text
// sizing (see tokenizeWeaponPassiveDescription below), never for a real
// display value.
function widestRenderedValue(
  slot: Pick<WeaponRefinementSlot, "curveType" | "baseValue" | "slope" | "customValues">,
  maxRefinement: number
): string {
  let widest = "";
  for (let refinement = 1; refinement <= maxRefinement; refinement++) {
    const rendered = formatWeaponRefinementNumber(computeWeaponValueCurve(slot, refinement));
    if (rendered.length > widest.length) widest = rendered;
  }
  return widest;
}

export type WeaponPassiveToken =
  | { kind: "text"; text: string }
  | { kind: "value"; current: string; widest: string };

// Splits a passive template into literal-text segments and per-placeholder
// (current, widest-ever) pairs, instead of a single rendered string --
// lets the caller reserve each number's OWN worst-case width inline (see
// PassiveSection in weapon-progression-form.tsx), rather than just
// pre-sizing the paragraph's overall height.
//
// A paragraph-level ghost (an earlier version of this fix: render the
// whole description once more with every placeholder at its own
// widestRenderedValue, overlaid invisibly to reserve height) turned out
// not to be enough: it keeps the BOX from resizing, but the real paragraph
// still re-wraps internally using its own actual content, so a word well
// after a scaling number can still visibly jump to the next line whenever
// that number's own width changes between refinements (confirmed: Beyond
// the Chrysalis's "Winds of Plenty" passive has "equipping" wrap at R2/R4
// but not R1/R3/R5, purely because of that refinement's own Elemental
// Mastery value being wider). Pinning each number's OWN width to its own
// worst case, independent of the rest of the paragraph, is what actually
// keeps every wrap point identical across every refinement -- the
// surrounding literal text never changes, and now neither does the
// rendered width of anything in between.
export function tokenizeWeaponPassiveDescription(
  template: string,
  slots: Pick<WeaponRefinementSlot, "slotIndex" | "curveType" | "baseValue" | "slope" | "customValues">[],
  refinement: number,
  maxRefinement: number
): WeaponPassiveToken[] {
  const bySlot = new Map(slots.map((s) => [s.slotIndex, s]));
  const tokens: WeaponPassiveToken[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(/\{(\d+)\}/g)) {
    const index = match.index!;
    if (index > lastIndex) tokens.push({ kind: "text", text: template.slice(lastIndex, index) });

    const slot = bySlot.get(Number(match[1]));
    if (slot) {
      tokens.push({
        kind: "value",
        current: formatWeaponRefinementNumber(computeWeaponValueCurve(slot, refinement)),
        widest: widestRenderedValue(slot, maxRefinement),
      });
    } else {
      tokens.push({ kind: "text", text: match[0] });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < template.length) tokens.push({ kind: "text", text: template.slice(lastIndex) });

  return tokens;
}
