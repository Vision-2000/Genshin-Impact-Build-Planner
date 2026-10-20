import { ArtifactSlot } from "@/generated/prisma/enums";
import { roundHalfUp } from "@/lib/round";

// Artifact sets are seeded at 4-5 star only (see prisma/seed.ts), so this is
// every rarity a set (or a piece from it) can ever be -- shared by the
// catalog's and the owned list's rarity filter badges.
export const ARTIFACT_RARITIES = [5, 4];

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

// Every main-stat name that can appear on any slot, deduplicated -- backs the
// owned-artifacts page's main-stat filter dropdown (a piece could have any of
// these depending on its slot, so the filter isn't scoped to one slot).
export const MAIN_STAT_NAMES = [...new Set(Object.values(SLOT_MAIN_STATS).flat())];

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

// Every StatType name sortable on the owned-artifacts page -- the union of
// SUBSTAT_TYPE_NAMES and MAIN_STAT_NAMES, so a stat that can ONLY ever be a
// main stat (Healing Bonus%, every elemental/Physical DMG Bonus%) still gets
// its own sortKey, not just the 10 that can also roll as a substat.
// Hardcoded rather than computed from the other two (MAIN_STAT_NAMES isn't
// literal-typed, so spreading it wouldn't produce a narrow union here) --
// same "hardcode the known values" treatment SUBSTAT_TYPE_NAMES itself
// already gets.
export const SORTABLE_STAT_NAMES = [
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
  "Healing Bonus%",
  "Physical DMG Bonus%",
  "Pyro DMG Bonus%",
  "Hydro DMG Bonus%",
  "Electro DMG Bonus%",
  "Cryo DMG Bonus%",
  "Anemo DMG Bonus%",
  "Geo DMG Bonus%",
  "Dendro DMG Bonus%",
] as const;

export type SortableStatName = (typeof SORTABLE_STAT_NAMES)[number];

// Every StatType name that currently appears as a 2-piece effect's
// unconditional stat bonus (ArtifactSetStatBonus, piece: Two) across all
// seeded sets -- backs the add-catalog's own 2pc-effect filter. Same
// "hardcode the known values" treatment as MAIN_STAT_NAMES/
// SUBSTAT_TYPE_NAMES above (fixed/slow-changing game data), not derived
// from whatever happens to be in the current catalog. A handful of sets
// (Obsidian Codex, Noblesse Oblige, Golden Troupe, ...) have no 2pc stat
// bonus row at all -- their 2pc effect is conditional/proc-based and stays
// text-only -- so the filter groups those under OTHER_TWO_PIECE_BONUS
// instead of leaving them unfilterable.
export const TWO_PIECE_BONUS_STAT_NAMES = [
  "ATK%",
  "DEF%",
  "HP%",
  "Crit Rate%",
  "Energy Recharge%",
  "Elemental Mastery",
  "Healing Bonus%",
  "Physical DMG Bonus%",
  "Pyro DMG Bonus%",
  "Hydro DMG Bonus%",
  "Electro DMG Bonus%",
  "Cryo DMG Bonus%",
  "Anemo DMG Bonus%",
  "Geo DMG Bonus%",
  "Dendro DMG Bonus%",
  "Pyro RES%",
  "Electro RES%",
  "Shield Strength%",
] as const;

export type TwoPieceBonusStatName = (typeof TWO_PIECE_BONUS_STAT_NAMES)[number];

// Sentinel filter value for sets with no 2pc stat bonus row (see
// TWO_PIECE_BONUS_STAT_NAMES's own comment) -- not a real StatType name,
// so it's kept out of that list and checked for separately wherever a
// set's own twoPieceStatName is null.
export const OTHER_TWO_PIECE_BONUS = "Others";

export type TwoPieceBonusFilterValue = TwoPieceBonusStatName | typeof OTHER_TWO_PIECE_BONUS;

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

// roundHalfUp (not Math.round) since these are the candidate values the
// substat slider actually offers -- a tie rounded the wrong way here
// wouldn't just display wrong, it'd let the user save the wrong number
// (see src/lib/round.ts).
function roundTo2(value: number): number {
  return roundHalfUp(value, 2);
}

// The most rolls a substat present since the artifact's first appearance
// (this app always assumes it was, since it doesn't track when a 4th
// substat was unlocked -- see CLAUDE.md) could have received by a given
// level: 1 guaranteed initial roll, plus one more per upgrade (+4 levels,
// capped at the rarity's own total upgrade count) -- MINUS however many of
// those upgrades are guaranteed to be spent revealing a missing substat
// instead of boosting an existing one (see validateSubstatRollTotal's own
// comment on why that's a fixed, not flexible, schedule). A piece's own
// best-case initial count is rarity-1 -- for a 5-star that's already 4 (the
// full slot count), so zero upgrades are ever forced into a reveal and
// every one of them COULD land on a single substat; for a 4-star it's only
// 3, so at least 1 upgrade is always spent revealing the still-missing 4th
// substat before any boosting even becomes possible. Getting this wrong
// previously let a single 4-star substat's slider reach a roll count
// (1 + upgrades) that validateSubstatRollTotal could never actually accept,
// since that count assumes no upgrade was ever spent on a reveal -- true
// only for 5-star.
function maxRollCount(rarity: number, level: number): number {
  const upgrades = Math.min(rarity, Math.floor(level / 4));
  const guaranteedReveals = Math.max(0, 4 - (rarity - 1));
  return 1 + Math.max(0, upgrades - guaranteedReveals);
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

const SUBSTAT_VALUE_EPSILON = 1e-6;

// Inverts a substat's stored value back to how many individual rolls
// produced it. Well-defined (not a guess) because the achievable-value
// range for N rolls -- [0.7N, 1.0N] x highest, from SUBSTAT_ROLL_MULTIPLIERS
// -- never overlaps the range for N+1 rolls: 0.7(N+1) exceeds 1.0N for every
// N >= 3, and the N=1/N=2 cases don't overlap either (1.4 > 1.0). So a value
// falls into exactly one N-roll bracket. Expects a value that actually came
// from substatValidValues (true for every value this app ever saves, once
// actions.ts's own snap-to-nearest-valid-value runs first) -- an
// out-of-bracket value falls through to the highest possible roll count
// rather than throwing.
export function substatRollCount(statName: SubstatTypeName, rarity: number, value: number): number {
  const highest = SUBSTAT_HIGHEST_ROLL[statName][rarity] ?? SUBSTAT_HIGHEST_ROLL[statName][5];
  const maxRolls = 1 + rarity;
  const lowestMultiplier = SUBSTAT_ROLL_MULTIPLIERS[0];
  const highestMultiplier = SUBSTAT_ROLL_MULTIPLIERS[SUBSTAT_ROLL_MULTIPLIERS.length - 1];

  for (let rolls = 1; rolls <= maxRolls; rolls++) {
    const low = roundTo2(rolls * lowestMultiplier * highest);
    const high = roundTo2(rolls * highestMultiplier * highest);
    if (value >= low - SUBSTAT_VALUE_EPSILON && value <= high + SUBSTAT_VALUE_EPSILON) return rolls;
  }
  return maxRolls;
}

export type SubstatRollValidation = { valid: true } | { valid: false; reason: string };

// A real piece always drops with either (rarity-2) or (rarity-1) initial
// substats (3 or 4 for a 5-star, 2 or 3 for a 4-star) -- there's no third
// option. From there, a missing substat is NOT unlocked at some flexible
// point before a cap -- it's unlocked by a FIXED upgrade: if the piece is
// short of 4, its first upgrade is always spent revealing the next missing
// one (never boosting an existing substat instead), and this repeats upgrade
// after upgrade until all 4 exist, only THEN do upgrades start boosting
// existing substats. That makes the filled substat COUNT an exact function
// of (initial count, upgrades so far) -- expectedCount(c) = min(4, c +
// upgrades) -- not a range a piece could sit anywhere within; e.g. a 5-star
// can only ever show 3 substats before its first upgrade (level < 4) --
// from level 4 onward it's always exactly 4, whichever initial count it
// actually had (3+1 or 4+1, both min(4, ...) = 4). Confirmed directly: a
// level-4 5-star piece reported with only 3 substats (one of them already
// upgraded) is impossible under this rule, since both candidate initial
// counts already require exactly 4 substats by then.
//
// Every upgrade still adds exactly one roll somewhere (never "wasted"), so
// the TOTAL roll count summed across every present substat remains a
// deterministic function of (rarity, level, initial count) too --
// initial + upgrades -- e.g. a maxed 5-star's substats must sum to exactly
// 8 or 9 total rolls, never more, never fewer. Checked here at save time
// rather than live in the slider UI since it needs every substat's value
// (and count) at once, not one slider in isolation -- too heavy for live UI
// feedback, same reasoning substatValidValues itself stays a per-stat
// approximation rather than a whole-piece one.
export function validateSubstatRollTotal(
  rarity: number,
  level: number,
  substats: { statTypeName: SubstatTypeName; value: number }[]
): SubstatRollValidation {
  const filledCount = substats.length;
  const minInitial = rarity - 2;
  const maxInitial = rarity - 1;
  const upgrades = Math.min(rarity, Math.floor(level / 4));

  // Exactly which initial count(s) (minInitial/maxInitial) are consistent
  // with the CURRENT filled count at this level -- not a range, an exact
  // match (see this function's own comment on why the unlock schedule is
  // fixed, not flexible). A single check covers both "too few to have ever
  // dropped at all" and "wrong for this specific level" -- both are the
  // same underlying problem (the count is wrong), so they get the same one
  // message, checked -- and reported -- before the upgrade-count check
  // below ever runs.
  const expectedCounts = [...new Set([minInitial, maxInitial].map((initial) => Math.min(4, initial + upgrades)))].sort(
    (a, b) => a - b
  );

  if (!expectedCounts.includes(filledCount)) {
    const countsPhrase = expectedCounts.length === 2 ? `${expectedCounts[0]} or ${expectedCounts[1]}` : `${expectedCounts[0]}`;
    return {
      valid: false,
      reason: `A level ${level} ${rarity}★ piece must have ${countsPhrase} substats, not ${filledCount}.`,
    };
  }

  const candidates = [minInitial, maxInitial].filter((initial) => Math.min(4, initial + upgrades) === filledCount);
  const totalRolls = substats.reduce((sum, s) => sum + substatRollCount(s.statTypeName, rarity, s.value), 0);
  const requiredTotals = candidates.map((initial) => initial + upgrades);

  if (requiredTotals.includes(totalRolls)) {
    return { valid: true };
  }

  // Expressed as "upgrades" (rolls beyond each filled substat's own first
  // appearance) rather than the raw roll total, matching how players
  // usually talk about this (e.g. "4 or 5 substat upgrades" for a maxed
  // 5-star, not "8 or 9 total rolls").
  const uniqueUpgradeCounts = [...new Set(requiredTotals.map((total) => total - filledCount))].sort((a, b) => a - b);
  const upgradesPhrase =
    uniqueUpgradeCounts.length === 2 ? `${uniqueUpgradeCounts[0]} or ${uniqueUpgradeCounts[1]}` : `${uniqueUpgradeCounts[0]}`;
  const word = uniqueUpgradeCounts.every((n) => n === 1) ? "substat upgrade" : "substat upgrades";
  const actualUpgradeCount = totalRolls - filledCount;

  return {
    valid: false,
    reason: `A level ${level} ${rarity}★ piece must have ${upgradesPhrase} ${word}, not ${actualUpgradeCount}.`,
  };
}

// Main stat value at every level, by rarity -- from
// data-source/Artifact_Stats_Scaling_report.txt (summarized from
// https://genshin-impact.fandom.com/wiki/Artifact/Scaling). A closed-form
// formula was tried first (the source itself describes the real mechanic as
// AffixValue_Current = AffixValue_Previous + (AffixValue_MainBase ×
// AffixMultiplier), i.e. linear in level) and rejected: that per-level step
// is rounded in-game before the NEXT step is computed, so a single
// end-to-end multiply-and-round does not reproduce the source table exactly
// -- verified directly (every stat/rarity combination in the source table,
// all 21 or 17 levels each): a closed-form reconstruction mismatches by one
// decimal unit in nearly every row (e.g. 4-star Crit DMG% at +15: table
// says 44.1, closed-form gives 44.0). A plain lookup table is the only way
// to show the exact value the game itself displays, same reasoning
// SUBSTAT_HIGHEST_ROLL above already follows for substats.
//
// Only 9 distinct curves exist, not one per stat name: HP%, ATK%, and
// every elemental DMG Bonus% share one curve, and DEF%/Physical DMG Bonus%
// share another (both confirmed by the source's own "Identical Affix
// Values" section) -- MAIN_STAT_VALUE_BY_LEVEL still has one entry per real
// StatType name below, for a plain `[statName][rarity][level]` lookup at
// call sites, but the shared groups point at the exact same array rather
// than duplicating it.
const GROUP_A_CURVE: Record<number, number[]> = {
  5: [7.0, 9.0, 11.0, 12.9, 14.9, 16.9, 18.9, 20.9, 22.8, 24.8, 26.8, 28.8, 30.8, 32.8, 34.7, 36.7, 38.7, 40.7, 42.7, 44.6, 46.6],
  4: [6.3, 8.1, 9.9, 11.6, 13.4, 15.2, 17.0, 18.8, 20.6, 22.3, 24.1, 25.9, 27.7, 29.5, 31.3, 33.0, 34.8],
};

const GROUP_B_CURVE: Record<number, number[]> = {
  5: [8.7, 11.2, 13.7, 16.2, 18.6, 21.1, 23.6, 26.1, 28.6, 31, 33.5, 36, 38.5, 40.9, 43.4, 45.9, 48.4, 50.8, 53.3, 55.8, 58.3],
  4: [7.9, 10.1, 12.3, 14.6, 16.8, 19.0, 21.2, 23.5, 25.7, 27.9, 30.2, 32.4, 34.6, 36.8, 39.1, 41.3, 43.5],
};

const HP_CURVE: Record<number, number[]> = {
  5: [717, 920, 1123, 1326, 1530, 1733, 1936, 2139, 2342, 2545, 2749, 2952, 3155, 3358, 3561, 3764, 3967, 4171, 4374, 4577, 4780],
  4: [645, 828, 1011, 1194, 1377, 1559, 1742, 1925, 2108, 2291, 2474, 2657, 2839, 3022, 3205, 3388, 3571],
};

const ATK_CURVE: Record<number, number[]> = {
  5: [47, 60, 73, 86, 100, 113, 126, 139, 152, 166, 179, 192, 205, 219, 232, 245, 258, 272, 285, 298, 311],
  4: [42, 54, 66, 78, 90, 102, 113, 125, 137, 149, 161, 173, 185, 197, 209, 221, 232],
};

const ELEMENTAL_MASTERY_CURVE: Record<number, number[]> = {
  5: [28.0, 35.9, 43.8, 51.8, 59.7, 67.6, 75.5, 83.5, 91.4, 99.3, 107.2, 115.2, 123.1, 131.0, 138.9, 146.9, 154.8, 162.7, 170.6, 178.6, 186.5],
  4: [25.2, 32.3, 39.4, 46.6, 53.7, 60.8, 68.0, 75.1, 82.2, 89.4, 96.5, 103.6, 110.8, 117.9, 125.0, 132.2, 139.3],
};

const ENERGY_RECHARGE_CURVE: Record<number, number[]> = {
  5: [7.8, 10.0, 12.2, 14.4, 16.6, 18.8, 21.0, 23.2, 25.4, 27.6, 29.8, 32.0, 34.2, 36.4, 38.6, 40.8, 43.0, 45.2, 47.4, 49.6, 51.8],
  4: [7.0, 9.0, 11.0, 12.9, 14.9, 16.9, 18.9, 20.9, 22.8, 24.8, 26.8, 28.8, 30.8, 32.8, 34.7, 36.7, 38.7],
};

const CRIT_RATE_CURVE: Record<number, number[]> = {
  5: [4.7, 6.0, 7.3, 8.6, 9.9, 11.3, 12.6, 13.9, 15.2, 16.6, 17.9, 19.2, 20.5, 21.8, 23.2, 24.5, 25.8, 27.1, 28.4, 29.8, 31.1],
  4: [4.2, 5.4, 6.6, 7.8, 9.0, 10.1, 11.3, 12.5, 13.7, 14.9, 16.1, 17.3, 18.5, 19.7, 20.8, 22.0, 23.2],
};

const CRIT_DMG_CURVE: Record<number, number[]> = {
  5: [9.3, 12.0, 14.6, 17.3, 19.9, 22.5, 25.2, 27.8, 30.5, 33.1, 35.7, 38.4, 41.0, 43.7, 46.3, 49.0, 51.6, 54.2, 56.9, 59.5, 62.2],
  4: [8.4, 10.8, 13.1, 15.5, 17.9, 20.3, 22.7, 25.0, 27.4, 29.8, 32.2, 34.5, 36.9, 39.3, 41.7, 44.1, 46.4],
};

const HEALING_BONUS_CURVE: Record<number, number[]> = {
  5: [5.4, 6.9, 8.4, 10.0, 11.5, 13.0, 14.5, 16.1, 17.6, 19.1, 20.6, 22.1, 23.7, 25.2, 26.7, 28.2, 29.8, 31.3, 32.8, 34.3, 35.9],
  4: [4.8, 6.2, 7.6, 9.0, 10.3, 11.7, 13.1, 14.4, 15.8, 17.2, 18.6, 19.9, 21.3, 22.7, 24.0, 25.4, 26.8],
};

export const MAIN_STAT_VALUE_BY_LEVEL: Record<string, Record<number, number[]>> = {
  HP: HP_CURVE,
  ATK: ATK_CURVE,
  "Elemental Mastery": ELEMENTAL_MASTERY_CURVE,
  "Energy Recharge%": ENERGY_RECHARGE_CURVE,
  "Crit Rate%": CRIT_RATE_CURVE,
  "Crit DMG%": CRIT_DMG_CURVE,
  "Healing Bonus%": HEALING_BONUS_CURVE,
  "HP%": GROUP_A_CURVE,
  "ATK%": GROUP_A_CURVE,
  "Pyro DMG Bonus%": GROUP_A_CURVE,
  "Hydro DMG Bonus%": GROUP_A_CURVE,
  "Electro DMG Bonus%": GROUP_A_CURVE,
  "Cryo DMG Bonus%": GROUP_A_CURVE,
  "Anemo DMG Bonus%": GROUP_A_CURVE,
  "Geo DMG Bonus%": GROUP_A_CURVE,
  "Dendro DMG Bonus%": GROUP_A_CURVE,
  "DEF%": GROUP_B_CURVE,
  "Physical DMG Bonus%": GROUP_B_CURVE,
};

// A plain lookup, not a computation -- see MAIN_STAT_VALUE_BY_LEVEL's own
// comment on why this can't be a formula.
export function computeArtifactMainStatValue(statName: string, rarity: number, level: number): number {
  return MAIN_STAT_VALUE_BY_LEVEL[statName][rarity][level];
}
