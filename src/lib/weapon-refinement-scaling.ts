// Weapon passive text is stored as a single template (Weapon.
// passiveDescriptionTemplate) with {0}, {1}, ... placeholders, plus one
// WeaponRefinementValue row per placeholder describing how that number
// scales from refinement 1 to Weapon.maxRefinement -- replacing what used
// to be up to 5 full pre-rendered description strings per weapon
// (WeaponRefinementEffect, still used but only for the small minority of
// weapons this can't handle -- see buildWeaponPassiveTemplate below).
//
// Verified against every currently-seeded weapon's real refinement text
// before this replaced the old per-refinement snapshot: of 974 total
// numeric slots across 225 weapons with uniform wording, 525 never change
// at all (baked into the template as plain text, no row needed), 444
// scale perfectly linearly (of which 364 happen to exactly double from R1
// to max refinement -- consistent with the anecdotal "doubles by R5"
// observation, though nothing here assumes that), and only 5 are genuine
// irregular exceptions (kept as a raw per-refinement fallback via
// "Custom"). A further 13 weapons have pure copy-editing inconsistencies
// between refinement tiers (e.g. "an opponent" vs "an enemy", a missing
// "the") that don't affect any number -- the template's wording is always
// taken from the LAST known refinement, per-weapon decision to prefer the
// most current phrasing. Only 1 weapon (Exaiphanes Blade) is a genuine
// structural exception -- an entire clause exists at R2+ that's simply
// absent at R1 -- and keeps the original per-refinement rows. See
// data-export/verify-weapon-refinement-scaling.mts and
// data-export/diagnose-weapon-refinement-mismatches.mts.
export type WeaponRefinementCurveType = "Linear" | "Custom";

export type WeaponRefinementSlot = {
  slotIndex: number;
  curveType: WeaponRefinementCurveType;
  baseValue: number;
  slope: number | null;
  customValues: number[] | null;
};

function closeEnough(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance;
}

// Classifies one numeric slot's known refinement values (already confirmed
// to vary -- a slot whose value never changes never becomes a row at all,
// see buildWeaponPassiveTemplate) into Linear (evenly spaced) or Custom (a
// raw fallback for the small residual that isn't, e.g. the Sacrificial
// weapons' proc-chance value, which decreases in uneven steps).
function classifySlotValues(values: number[]): Omit<WeaponRefinementSlot, "slotIndex"> {
  const step = values[1] - values[0];
  const isLinear = values.every((v, i) => i === 0 || closeEnough(v, values[0] + step * i));
  if (isLinear) return { curveType: "Linear", baseValue: values[0], slope: step, customValues: null };
  return { curveType: "Custom", baseValue: values[0], slope: null, customValues: values };
}

// The inverse: given a stored slot + a refinement level, returns the
// actual value -- used at read time instead of indexing into a stored
// per-refinement description.
export function computeWeaponRefinementValue(
  slot: Pick<WeaponRefinementSlot, "curveType" | "baseValue" | "slope" | "customValues">,
  refinement: number
): number {
  if (slot.curveType === "Custom") {
    return slot.customValues![Math.min(refinement - 1, slot.customValues!.length - 1)];
  }
  return slot.baseValue + slot.slope! * (refinement - 1);
}

// Numbers in this domain are always short, human-authored decimals (game
// balance values like 12, 24.5, 200) -- round away the floating-point
// noise a linear computation can introduce (e.g. 2.4000000000000004), then
// let JS's own number->string conversion drop the trailing zeros.
export function formatWeaponRefinementNumber(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

// Inserts each slot's value at the given refinement into the template's
// {0}, {1}, ... placeholders. A regex replace rather than positional
// splicing, so it doesn't care about slot order or count.
export function renderWeaponPassiveDescription(
  template: string,
  slots: Pick<WeaponRefinementSlot, "slotIndex" | "curveType" | "baseValue" | "slope" | "customValues">[],
  refinement: number
): string {
  const bySlot = new Map(slots.map((s) => [s.slotIndex, s]));
  return template.replace(/\{(\d+)\}/g, (match, indexStr) => {
    const slot = bySlot.get(Number(indexStr));
    if (!slot) return match;
    return formatWeaponRefinementNumber(computeWeaponRefinementValue(slot, refinement));
  });
}

// Seed-time only: given a weapon's known refinement descriptions (ordered
// R1..Rn, one per known refinement level -- most weapons have 5, a few
// documented ones have fewer, see Weapon.maxRefinement), splits into a
// template string with {0}, {1}, ... placeholders plus one
// WeaponRefinementSlot per number that actually varies across them.
//
// A number identical at every known refinement is left as plain text in
// the template -- no slot needed, since it never needs computing (this is
// also what correctly handles a weapon with only 1 known description at
// all: every "slot" is trivially constant with nothing to compare
// against, so the whole text is baked in as-is with zero placeholders).
//
// The template's literal wording is always taken from the LAST
// description, not the first -- verified this is safe for the ~13 weapons
// whose wording drifts slightly between refinement tiers (see the module
// comment above): the drift is pure copy-editing noise (a swapped
// synonym, a missing article), never a meaning change, so preferring the
// most current phrasing loses nothing.
//
// Returns null if the descriptions can't be aligned at all -- a different
// COUNT of numbers between refinements, meaning the effect's actual
// STRUCTURE differs (a whole clause present at some refinements and not
// others), not just its wording or values. Callers should keep the
// original per-refinement text for these instead (see
// WeaponRefinementEffect) -- currently only Exaiphanes Blade.
export function buildWeaponPassiveTemplate(
  descriptions: string[]
): { template: string; slots: WeaponRefinementSlot[] } | null {
  const numberLists = descriptions.map((d) => (d.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  const slotCount = numberLists[0].length;
  if (!numberLists.every((n) => n.length === slotCount)) return null;

  const canonical = descriptions[descriptions.length - 1];
  const segments = canonical.split(/(\d+(?:\.\d+)?)/);

  const slots: WeaponRefinementSlot[] = [];
  let template = "";
  let numberSeen = 0;

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0) {
      template += segments[i]; // literal text
      continue;
    }
    const values = numberLists.map((n) => n[numberSeen]);
    numberSeen++;

    if (values.every((v) => closeEnough(v, values[0]))) {
      template += segments[i]; // constant across every known refinement -- keep literal, no slot
      continue;
    }

    const slotIndex = slots.length;
    slots.push({ slotIndex, ...classifySlotValues(values) });
    template += `{${slotIndex}}`;
  }

  return { template, slots };
}
