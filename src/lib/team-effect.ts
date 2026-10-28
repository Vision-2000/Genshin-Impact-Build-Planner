import { Element } from "@/generated/prisma/enums";

// Shared shape for any "active based on the team's current composition"
// bonus shown in a TeamCard's own effect box(es) -- Elemental Resonance
// (elemental-resonance.ts) and the Moonsign/Hexerei character-trait
// effects (moonsign-hexerei.ts) are genuinely different game systems with
// different trigger logic, kept in their own modules, but both return
// this same {name, effect, element} shape so a caller can combine and
// render them uniformly without a discriminated union. element is null
// for anything not tied to showing one specific element's own icon (e.g.
// Protective Canopy, Moonsign, Hexerei).
export type TeamEffect = {
  name: string;
  effect: string;
  element: Element | null;
};
