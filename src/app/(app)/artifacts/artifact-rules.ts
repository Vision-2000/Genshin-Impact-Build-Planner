import { ArtifactSlot } from "@/generated/prisma/enums";

// Which StatType names each slot can actually roll as a main stat in-game.
// Flower/Feather are fixed and never vary; Sands/Goblet/Circlet each draw
// from their own subset. Not enforced by the schema (mainStatId is just an
// FK to StatType) — this is the frontend rule CLAUDE.md calls for elsewhere
// with "main stat excludes substat": real game constraints belong here, not
// the DB.
export const SLOT_MAIN_STATS: Record<ArtifactSlot, readonly string[]> = {
  [ArtifactSlot.Flower]: ["HP"],
  [ArtifactSlot.Feather]: ["ATK"],
  [ArtifactSlot.Sands]: ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Energy Recharge%"],
  [ArtifactSlot.Goblet]: [
    "HP%",
    "ATK%",
    "DEF%",
    "Elemental Mastery",
    "Physical DMG Bonus%",
    "Pyro DMG Bonus%",
    "Hydro DMG Bonus%",
    "Electro DMG Bonus%",
    "Cryo DMG Bonus%",
    "Anemo DMG Bonus%",
    "Geo DMG Bonus%",
    "Dendro DMG Bonus%",
  ],
  [ArtifactSlot.Circlet]: ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Crit Rate%", "Crit DMG%", "Healing Bonus%"],
};

// The only StatType names that can ever appear as a substat — elemental DMG
// bonuses, Healing Bonus%, and Physical DMG Bonus% are Goblet/Circlet main
// stats only and never roll as substats.
export const SUBSTAT_TYPE_NAMES = [
  "HP",
  "ATK",
  "DEF",
  "HP%",
  "ATK%",
  "DEF%",
  "Elemental Mastery",
  "Energy Recharge%",
  "Crit Rate%",
  "Crit DMG%",
] as const;

export type SubstatTypeName = (typeof SUBSTAT_TYPE_NAMES)[number];

export const MAX_SUBSTATS = 4;
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 20;

// An artifact's max level is 4x its rarity (5-star -> +20, 4-star -> +16).
// This app only ever seeds 4-5 star artifact sets (see prisma/seed.ts), so
// callers can pass any ArtifactSet.rarity here safely.
export function maxLevelForRarity(rarity: number): number {
  return rarity * 4;
}

// Substat rolls: only the "highest roll" (the biggest of the 4 possible
// values a single roll can land on) is stored per stat type and rarity --
// the other 3 tiers are always 70%/80%/90% of that highest value (verified
// against a community-sourced roll table). Only 4-5 star are covered, since
// that's all this app ever seeds.
export const SUBSTAT_ROLL_MULTIPLIERS = [0.7, 0.8, 0.9, 1] as const;

export const SUBSTAT_HIGHEST_ROLL: Record<SubstatTypeName, Record<number, number>> = {
  HP: { 4: 239.0, 5: 298.75 },
  ATK: { 4: 15.56, 5: 19.45 },
  DEF: { 4: 18.52, 5: 23.15 },
  "HP%": { 4: 4.66, 5: 5.83 },
  "ATK%": { 4: 4.66, 5: 5.83 },
  "DEF%": { 4: 5.83, 5: 7.29 },
  "Elemental Mastery": { 4: 18.65, 5: 23.31 },
  "Energy Recharge%": { 4: 5.18, 5: 6.48 },
  "Crit Rate%": { 4: 3.11, 5: 3.89 },
  "Crit DMG%": { 4: 6.22, 5: 7.77 },
};

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The most rolls a substat present since the artifact's first appearance
// (this app always assumes it was, since it doesn't track when a 4th
// substat was unlocked -- see CLAUDE.md) could have received by a given
// level: 1 guaranteed initial roll, plus one more every 4 levels -- capped
// at the rarity's own total upgrade count, since a 5-star artifact only
// ever gets 5 upgrades over its lifetime (+4/+8/+12/+16/+20). The actual
// roll count could be anywhere from 1 (never touched by an upgrade) up to
// this maximum, since upgrades are distributed randomly among a piece's
// existing substats -- not always this one.
function maxRollCount(rarity: number, level: number): number {
  return 1 + Math.min(rarity, Math.floor(level / 4));
}

// Every value a substat could actually have landed on: each individual roll
// independently picks one of the 4 multiplier tiers, and the substat could
// have received anywhere from 1 up to maxRollCount rolls -- so the
// achievable totals are every distinct SUM across every roll count in that
// range (order doesn't matter, repeats allowed), not a continuous range.
// Different combinations can tie (0.7+1.0 == 0.8+0.9), so this is usually
// fewer than the raw combination count. maxRollCount never exceeds 6 (a
// 5-star's max), so this whole search is tiny regardless -- no need to
// memoize.
export function substatValidValues(statName: SubstatTypeName, rarity: number, level: number): number[] {
  const highest = SUBSTAT_HIGHEST_ROLL[statName][rarity] ?? SUBSTAT_HIGHEST_ROLL[statName][5];
  const maxRolls = maxRollCount(rarity, level);

  const multiplierSums = new Set<number>();
  function pick(startTier: number, rollsLeft: number, sumSoFar: number) {
    if (rollsLeft === 0) {
      multiplierSums.add(sumSoFar);
      return;
    }
    for (let tier = startTier; tier < SUBSTAT_ROLL_MULTIPLIERS.length; tier++) {
      pick(tier, rollsLeft - 1, sumSoFar + SUBSTAT_ROLL_MULTIPLIERS[tier]);
    }
  }
  for (let rolls = 1; rolls <= maxRolls; rolls++) {
    pick(0, rolls, 0);
  }

  // Distinct multiplier sums can still round to the same 2-decimal value
  // once multiplied by `highest` -- dedupe again after rounding, otherwise
  // the returned array can contain repeats. That matters beyond tidiness:
  // the UI finds a value's slider index via indexOf, which always resolves
  // to a repeat's first occurrence, so a slider sitting on a later repeat
  // gets silently snapped back a step on every render -- invisible when
  // dragging past it, but it makes the right-arrow key look stuck.
  const roundedValues = new Set([...multiplierSums].map((sum) => roundTo2(sum * highest)));
  return [...roundedValues].sort((a, b) => a - b);
}

// Snaps to the closest of a set of valid values -- used when a substat's
// stored value no longer appears in its (possibly just-changed) valid list,
// e.g. after the level slider moves.
export function nearestValidValue(validValues: number[], value: number): number {
  return validValues.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  );
}
