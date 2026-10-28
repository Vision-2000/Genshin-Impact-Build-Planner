import { Element } from "@/generated/prisma/enums";
import type { TeamEffect } from "./team-effect";

// Wiki-documented Elemental Resonance effects -- not derived from any
// per-character data (these are fixed, global party-composition bonuses,
// independent of which characters/builds are actually in the slots), so
// this is hand-maintained text here rather than seeded master data. Scoped
// to Teams for now (see elementalResonances' own comment); Rosters would
// reuse this unchanged if it ever wants the same display, since a
// resonance only cares about which elements are present, not team size
// beyond that.
export type ElementalResonanceEffect = TeamEffect;

// name/effect only here -- `element` isn't repeated per entry (it'd just
// be duplicating the record's own key); computeElementalResonances fills
// it in from the key itself when building its result below.
const SAME_ELEMENT_RESONANCE: Record<Element, Omit<ElementalResonanceEffect, "element">> = {
  [Element.Pyro]: {
    name: "Fervent Flames",
    effect: "Affected by Cryo for 40% less time. Increases ATK by 25%.",
  },
  [Element.Hydro]: {
    name: "Soothing Water",
    effect: "Affected by Pyro for 40% less time. Increases Max HP by 25%.",
  },
  [Element.Electro]: {
    name: "High Voltage",
    effect:
      "Affected by Hydro for 40% less time. Superconduct, Stellar-Conduct, Overloaded, Electro-Charged, Lunar-Charged, Quicken, Aggravate, or Hyperbloom have a 100% chance to generate an Electro Elemental Particle (CD: 5s).",
  },
  [Element.Cryo]: {
    name: "Shattering Ice",
    effect:
      "Affected by Electro for 40% less time. Increases CRIT Rate against enemies that are Frozen or affected by Cryo by 15%.",
  },
  [Element.Anemo]: {
    name: "Impetuous Winds",
    effect: "Decreases Stamina Consumption by 15%. Increases Movement SPD by 10%. Shortens Skill CD by 5%.",
  },
  [Element.Geo]: {
    name: "Enduring Rock",
    effect:
      "Increases shield strength by 15%. Additionally, when characters protected by a shield or when Moondrifts formed by Lunar-Crystallize reactions are nearby, the following special characteristics will take effect: DMG dealt increased by 15%, dealing DMG to enemies will decrease their Geo RES by 20% for 15s.",
  },
  [Element.Dendro]: {
    name: "Sprawling Greenery",
    effect:
      "Elemental Mastery increased by 50. After triggering Burning, Quicken, Bloom, or Lunar-Bloom reactions, all nearby party members gain 30 Elemental Mastery for 6s. After triggering Aggravate, Spread, Hyperbloom, or Burgeon reactions, all nearby party members gain 20 Elemental Mastery for 6s. The durations of the aforementioned effects will be counted independently.",
  },
};

// The one resonance that isn't keyed by a single element -- needs all 4
// team slots filled, each with a DIFFERENT element (any 4 of the 7),
// which by construction can never also satisfy any SAME_ELEMENT_RESONANCE
// entry above (that needs 2+ of the SAME element, impossible once all 4
// are already distinct) -- so this and the per-element resonances are
// mutually exclusive, never shown together.
const PROTECTIVE_CANOPY: ElementalResonanceEffect = {
  name: "Protective Canopy",
  effect: "All Elemental RES +15%, Physical RES +15%.",
  element: null,
};

// A full 4-build team can have at most 2 elements with 2+ members each
// (e.g. a 2/2 split) -- 3 such elements would need at least 6 slots, more
// than MAX_TEAM_SIZE ever allows -- so the result here is always 0, 1, or
// 2 entries, same practical ceiling as BuildStatsSummary's own Artifact
// Set Effects box.
export function computeElementalResonances(elements: Element[]): ElementalResonanceEffect[] {
  const resonances: ElementalResonanceEffect[] = [];

  const counts = new Map<Element, number>();
  for (const element of elements) counts.set(element, (counts.get(element) ?? 0) + 1);

  // Object.values(Element) (not Map iteration order) -- a fixed,
  // wiki-matching element order (Pyro/Hydro/Electro/Cryo/Anemo/Geo/Dendro,
  // the enum's own declaration order), so the result's own order doesn't
  // depend on which order members happen to be in.
  for (const element of Object.values(Element)) {
    if ((counts.get(element) ?? 0) >= 2) resonances.push({ ...SAME_ELEMENT_RESONANCE[element], element });
  }

  if (elements.length === 4 && counts.size === 4) resonances.push(PROTECTIVE_CANOPY);

  return resonances;
}
