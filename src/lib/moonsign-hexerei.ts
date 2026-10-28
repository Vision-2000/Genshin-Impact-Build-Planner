import type { TeamEffect } from "./team-effect";

// Moonsign/Hexerei are character TRAITS, not master data fields of their
// own (no Character.isMoonsign/isHexerei column, no schema change) --
// derived instead from each character's own Passive 3 talent name, which
// already encodes this directly: every Moonsign character's Passive 3 is
// named "Moonsign Benediction: <flavor>", every Hexerei character's is
// "Witch's Eve Rite: <flavor>" (verified directly against
// data-source/characters.json: 10 "Moonsign Benediction" names, 12
// "Witch's Eve Rite" names -- a 13th match there is just Fischl's own
// talent DESCRIPTION text cross-referencing her own Witch's Eve Rite by
// name, not a 13th character). page.tsx derives the boolean per build
// from that same Passive 3 talent (fetched specifically for this, see its
// own comment) rather than this module reaching into character data
// itself -- this module only turns "how many of each trait are in the
// team" into the matching effect text.
export function isMoonsignTalentName(name: string): boolean {
  return name.startsWith("Moonsign Benediction");
}

export function isHexereiTalentName(name: string): boolean {
  return name.startsWith("Witch's Eve Rite");
}

const NASCENT_GLEAM: TeamEffect = {
  name: "Nascent Gleam",
  effect: 'All characters in the party will gain the "Moonsign: Nascent Gleam" effect.',
  element: null,
};

// Shown alongside (not instead of) Nascent Gleam once Moonsign Level
// reaches 2 -- same "show every threshold reached, not just the highest"
// choice already made for artifact set 2pc/4pc effects (see
// build-stats-summary.tsx's own activeSetEffects comment), and the wiki
// text itself says Ascendant Gleam's own effects are on top of Nascent
// Gleam's, not a replacement for them.
const ASCENDANT_GLEAM: TeamEffect = {
  name: "Ascendant Gleam",
  effect:
    'All characters in the party will gain the "Moonsign: Ascendant Gleam" effect, enhancing certain Talents and Skills of Moonsign characters. Unless otherwise stated, when Moonsign Level reaches Ascendant Gleam, the effects of Nascent Gleam will also apply.\n\nIn addition, for 20s after a non-Moonsign character casts an Elemental Skill or Elemental Burst, they will increase the Lunar Reaction DMG dealt by all nearby characters based on their own Elemental Type, up to a maximum of 36%. This effect cannot stack.\nIf the character\'s Elemental Type is:\nPyro, Electro, or Cryo: Increases this DMG by 0.9% for every 100 ATK.\nHydro: Increases this DMG by 0.6% for every 1,000 Max HP.\nGeo: Increases this DMG by 1% for every 100 DEF.\nAnemo or Dendro: Increases this DMG by 2.25% for every 100 Elemental Mastery.',
  element: null,
};

const HEXEREI_SECRET_RITE: TeamEffect = {
  name: "Hexerei: Secret Rite",
  effect: "The Hexerei characters in your party have been further enhanced.",
  element: null,
};

// Moonsign Level is just "how many Moonsign characters are in the
// party", 1 for Nascent Gleam and 2+ for Ascendant Gleam (no higher tier
// documented) -- Hexerei only has the one 2+ threshold, no Hexerei
// equivalent of Nascent Gleam at count 1.
export function computeMoonsignHexereiEffects({
  moonsignCount,
  hexereiCount,
}: {
  moonsignCount: number;
  hexereiCount: number;
}): TeamEffect[] {
  const effects: TeamEffect[] = [];
  if (moonsignCount >= 1) effects.push(NASCENT_GLEAM);
  if (moonsignCount >= 2) effects.push(ASCENDANT_GLEAM);
  if (hexereiCount >= 2) effects.push(HEXEREI_SECRET_RITE);
  return effects;
}
