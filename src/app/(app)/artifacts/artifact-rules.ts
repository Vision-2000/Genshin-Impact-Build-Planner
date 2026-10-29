import { ArtifactSlot } from "@/generated/prisma/enums";
import { roundHalfUp } from "@/lib/round";
import { displayDecimals } from "@/lib/stat-format";

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

// Substat rolls: the "highest roll" (the biggest of the 4 possible values a
// single roll can land on) is stored per stat type and rarity. Only 4-5 star
// are covered, since that's all this app ever seeds.
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

// The other 3 tiers' own values -- NOT derived as roundTo2(multiplier x
// highest). That derivation is exactly right at the 1.0 (highest) tier
// trivially (nothing to multiply), but can land one hundredth off at the
// 0.7/0.8/0.9 tiers: the real in-game base value carries more precision
// than the 2 decimals SUBSTAT_HIGHEST_ROLL itself displays at, so
// multiplying that already-rounded number by a fraction and rounding again
// doesn't always land on the same hundredth the game's own (more precise)
// internal value does. Confirmed directly against a community-sourced roll
// table covering all 4 tiers at 4-5 star: 5 of 40 values differed by
// exactly 0.01 from the derived ones (DEF 5★'s 90% tier, HP%/ATK% 4★'s 90%
// tier, Energy Recharge% 5★'s 70% tier, Crit DMG% 4★'s 80% tier) -- always
// at a non-1.0 tier, never at the highest-roll tier itself, consistent with
// that tier never actually being derived in the first place. [low,
// mid-low, mid-high] -- SUBSTAT_HIGHEST_ROLL above already covers the 4th
// (high) tier, so it isn't repeated here.
export const SUBSTAT_LOWER_ROLL_TIERS: Record<SubstatTypeName, Record<number, readonly [number, number, number]>> = {
  HP: { 4: [167.3, 191.2, 215.1], 5: [209.13, 239.0, 268.88] },
  ATK: { 4: [10.89, 12.45, 14.0], 5: [13.62, 15.56, 17.51] },
  DEF: { 4: [12.96, 14.82, 16.67], 5: [16.2, 18.52, 20.83] },
  "HP%": { 4: [3.26, 3.73, 4.2], 5: [4.08, 4.66, 5.25] },
  "ATK%": { 4: [3.26, 3.73, 4.2], 5: [4.08, 4.66, 5.25] },
  "DEF%": { 4: [4.08, 4.66, 5.25], 5: [5.1, 5.83, 6.56] },
  "Elemental Mastery": { 4: [13.06, 14.92, 16.79], 5: [16.32, 18.65, 20.98] },
  "Energy Recharge%": { 4: [3.63, 4.14, 4.66], 5: [4.53, 5.18, 5.83] },
  "Crit Rate%": { 4: [2.18, 2.49, 2.8], 5: [2.72, 3.11, 3.5] },
  "Crit DMG%": { 4: [4.35, 4.97, 5.6], 5: [5.44, 6.22, 6.99] },
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

// The 4 individual roll values this stat/rarity can land on, [low,
// mid-low, mid-high, high] -- SUBSTAT_LOWER_ROLL_TIERS' own 3 plus
// SUBSTAT_HIGHEST_ROLL's one, read directly rather than derived by
// multiplying a fraction against the highest roll (see
// SUBSTAT_LOWER_ROLL_TIERS's own comment on why that derivation isn't
// always exact). Each is already the actual number added to the piece's
// displayed stat for one roll -- summing several of these (done by
// achievableSumsForRollCount below) is summing already-rounded roll
// values, not raw fractions rounded only once at the end.
export function rollTierValues(statName: SubstatTypeName, rarity: number): readonly number[] {
  const lower = SUBSTAT_LOWER_ROLL_TIERS[statName][rarity] ?? SUBSTAT_LOWER_ROLL_TIERS[statName][5];
  const highest = SUBSTAT_HIGHEST_ROLL[statName][rarity] ?? SUBSTAT_HIGHEST_ROLL[statName][5];
  return [...lower, highest];
}

// Every achievable sum across EXACTLY `rolls` rolls (order doesn't matter,
// repeats allowed) -- each individual roll already rounded via
// rollTierValues above before being summed. Shared by substatValidValues
// (unions this across every roll count up to a cap) and substatRollCount
// (searches it per roll count to invert a stored value back to how many
// rolls produced it). `rolls` never exceeds 6 (a 5-star's max), so this
// whole search is tiny regardless -- no need to memoize.
function achievableSumsForRollCount(statName: SubstatTypeName, rarity: number, rolls: number): Set<number> {
  const tierValues = rollTierValues(statName, rarity);
  const sums = new Set<number>();
  function pick(startTier: number, rollsLeft: number, sumSoFar: number) {
    if (rollsLeft === 0) {
      // Re-rounded here too: summing already-2-decimal numbers as binary
      // floats can still land a hair off (e.g. 4.66 + 5.25 as doubles),
      // which would otherwise produce a near-duplicate value one ULP away
      // from a real one -- the same silent-slider-snap-back bug the old
      // single dedupe-after-rounding step existed to prevent.
      sums.add(roundTo2(sumSoFar));
      return;
    }
    for (let tier = startTier; tier < tierValues.length; tier++) {
      pick(tier, rollsLeft - 1, sumSoFar + tierValues[tier]);
    }
  }
  pick(0, rolls, 0);
  return sums;
}

// Every value a substat could actually land on, as a player would actually
// see it -- one slider stop per DISTINCT displayed number (see
// displayDecimals: 1 decimal for a %-stat, a whole number for a flat one),
// not one per distinct 2-decimal stored number. Two different exact sums
// can display identically (e.g. Crit Rate% 5★'s 13.99, only achievable at
// 5 rolls, and 14.00, only achievable at 4, both read "14.0%") -- the
// player was never shown a 2-decimal number to begin with, so a second
// slider stop that LOOKS identical to one already offered isn't a real
// extra choice, just internal storage precision leaking into the UI. Once
// a displayed value is reached by some roll count, any later (necessarily
// higher, since roll counts are walked ascending) roll count that merely
// reproduces the same displayed value contributes nothing new and is
// skipped outright -- whichever exact number got there first is kept as
// that display value's one representative, which is always the SAME
// smallest roll count substatRollCount would resolve that display value to
// anyway (see its own comment).
export function substatValidValues(statName: SubstatTypeName, rarity: number, level: number): number[] {
  const maxRolls = maxRollCount(rarity, level);
  const decimals = displayDecimals(statName);

  const exactValueByDisplayValue = new Map<number, number>();
  for (let rolls = 1; rolls <= maxRolls; rolls++) {
    for (const sum of achievableSumsForRollCount(statName, rarity, rolls)) {
      const displayValue = roundHalfUp(sum, decimals);
      if (!exactValueByDisplayValue.has(displayValue)) exactValueByDisplayValue.set(displayValue, sum);
    }
  }
  return [...exactValueByDisplayValue.values()].sort((a, b) => a - b);
}

// Snaps to the closest of a set of valid values -- used when a substat's
// stored value no longer appears in its (possibly just-changed) valid list,
// e.g. after the level slider moves.
export function nearestValidValue(validValues: number[], value: number): number {
  return validValues.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  );
}

// Every roll count a substat's stored value is consistent with -- matched
// at DISPLAY precision (see displayDecimals: 1 decimal for a %-stat, a
// whole number for a flat one), not the full 2 decimals
// substatValidValues/achievableSumsForRollCount compute the sum at. Two
// genuinely different roll histories can land on exact values that are
// only 0.01 apart and round to the exact same displayed number (e.g. Crit
// Rate% 5★'s 13.99, only achievable at 5 rolls, and 14.00, only achievable
// at 4 -- both read "14.0%" on screen); from the player's own perspective
// those are indistinguishable, so this rounds the achievable sum for EVERY
// roll count to display precision too, and collects every one whose
// rounded sum matches the target's own rounded value. This is on top of
// (not instead of) the plain exact-value ambiguity that already exists one
// precision level down (a value near the top of N rolls' own exact range
// can coincide with one near the bottom of (N+1) rolls' range even before
// any display rounding, e.g. flat ATK 5★'s 77.80 is exactly either 4 rolls
// at the 100% tier or 5 at the 80% tier) -- display-rounding only ever
// surfaces MORE ties than that, never fewer.
//
// Returns MULTIPLE roll counts (ascending) rather than picking one,
// specifically so validateSubstatRollTotal can search every combination
// across a whole piece's substats instead of committing each one to a
// single guess up front -- see that function's own comment on why
// optimistically assuming the smallest count for every substat
// independently can wrongly reject a real piece (e.g. a value that's
// ambiguous between "3 upgrades" and "4 upgrades" might only sum to a
// valid total with the 4 reading, not the 3 everywhere-smallest one would
// force).
//
// Expects a value that actually came from substatValidValues (true for
// every value this app ever saves, once actions.ts's own
// snap-to-nearest-valid-value runs first) -- a value matching no roll count
// at all falls through to [the highest possible roll count] rather than
// throwing.
export function possibleSubstatRollCounts(statName: SubstatTypeName, rarity: number, value: number): number[] {
  const maxRolls = 1 + rarity;
  const decimals = displayDecimals(statName);
  const target = roundHalfUp(value, decimals);

  const matches: number[] = [];
  for (let rolls = 1; rolls <= maxRolls; rolls++) {
    for (const sum of achievableSumsForRollCount(statName, rarity, rolls)) {
      if (roundHalfUp(sum, decimals) === target) {
        matches.push(rolls);
        break;
      }
    }
  }
  return matches.length > 0 ? matches : [maxRolls];
}

// Convenience for a caller that just wants ONE answer, not every
// possibility -- the smallest of possibleSubstatRollCounts (see its own
// comment on why that's the optimistic, piece-friendly default). Not used
// by validateSubstatRollTotal itself any more -- see that function's own
// comment on why always taking the smallest, independently per substat,
// isn't always correct for a whole-piece check.
export function substatRollCount(statName: SubstatTypeName, rarity: number, value: number): number {
  return possibleSubstatRollCounts(statName, rarity, value)[0];
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
//
// A substat's own stored value doesn't always pin down ONE roll count (see
// possibleSubstatRollCounts) -- so this doesn't just sum one guess per
// substat and check that single total. It instead computes every TOTAL
// reachable by picking one roll count from each substat's own
// possibleSubstatRollCounts (the Minkowski sum of those small sets -- at
// most a handful of values each, so this is tiny regardless of how many
// substats are ambiguous at once) and accepts the piece if ANY reachable
// total matches one of the few the level/rarity allow. Concretely: a Crit
// Rate% substat landing on a value ambiguous between "3 upgrades" (4
// rolls) and "4 upgrades" (5 rolls) is no longer forced to the smaller
// reading everywhere -- if only the 4-upgrade reading makes the piece's
// total add up, that's the reading this function finds. (Always summing
// each substat's own smallest possible count, independently, was tried
// first and is simpler, but provably wrong: it can reject a piece whose
// true history needed a substat's LARGER reading, even though that larger
// reading is itself a perfectly ordinary, physically possible roll
// outcome.)
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
  const requiredTotals = candidates.map((initial) => initial + upgrades);

  // Minkowski sum: every total reachable by picking ONE roll count from
  // each substat's own possibleSubstatRollCounts (see this function's own
  // comment on why that's not just each substat's smallest). Starts from
  // {0} so folding in the first substat's own possible counts gives
  // exactly that substat's own set, not an empty one.
  let achievableTotals = new Set<number>([0]);
  for (const substat of substats) {
    const possibleCounts = possibleSubstatRollCounts(substat.statTypeName, rarity, substat.value);
    const next = new Set<number>();
    for (const total of achievableTotals) {
      for (const count of possibleCounts) next.add(total + count);
    }
    achievableTotals = next;
  }

  if (requiredTotals.some((total) => achievableTotals.has(total))) {
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
  // The smallest reachable total (every substat's own smallest possible
  // reading, summed) is the most charitable total this piece could
  // possibly have -- reported as "what you actually have" now that there's
  // no single, forced totalRolls value to report instead.
  const actualUpgradeCount = Math.min(...achievableTotals) - filledCount;

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

// A one-click starting point for the add-artifact form's substat rows,
// instead of making the user pick & tune all 4 by hand every time. Each
// named substat is "+N upgrades" -- one guaranteed initial roll plus N more
// -- the same vocabulary players already use for a piece's roll history
// (see validateSubstatRollTotal's own comment).
export type SubstatTemplateEntry = {
  statTypeName: SubstatTypeName;
  upgrades: number;
};

export type SubstatTemplate = {
  name: string;
  entries: SubstatTemplateEntry[];
};

// Any entry left out of a template (e.g. "Full EM ER" only ever names 2 of
// the 4 rows) leaves that row on None/Flex for the user to fill in
// themselves -- not every template needs all 4 slots named, unlike the
// "Crit X ER" family below which does. `upgrades: 0` is different from
// leaving a stat out entirely: it still fills that row, just at the
// guaranteed initial roll with no upgrades on top (see templateEntryValue).
export const SUBSTAT_TEMPLATES: SubstatTemplate[] = [
  {
    name: "Crit ATK ER",
    entries: [
      { statTypeName: "Crit Rate%", upgrades: 1 },
      { statTypeName: "Crit DMG%", upgrades: 1 },
      { statTypeName: "ATK%", upgrades: 1 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Crit HP ER",
    entries: [
      { statTypeName: "Crit Rate%", upgrades: 1 },
      { statTypeName: "Crit DMG%", upgrades: 1 },
      { statTypeName: "HP%", upgrades: 1 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Crit DEF ER",
    entries: [
      { statTypeName: "Crit Rate%", upgrades: 1 },
      { statTypeName: "Crit DMG%", upgrades: 1 },
      { statTypeName: "DEF%", upgrades: 1 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Crit EM ER",
    entries: [
      { statTypeName: "Crit Rate%", upgrades: 1 },
      { statTypeName: "Crit DMG%", upgrades: 1 },
      { statTypeName: "Elemental Mastery", upgrades: 1 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Full ATK ER",
    entries: [
      { statTypeName: "ATK%", upgrades: 3 },
      { statTypeName: "ATK", upgrades: 0 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Full HP ER",
    entries: [
      { statTypeName: "HP%", upgrades: 3 },
      { statTypeName: "HP", upgrades: 0 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Full DEF ER",
    entries: [
      { statTypeName: "DEF%", upgrades: 3 },
      { statTypeName: "DEF", upgrades: 0 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Full EM ER",
    entries: [
      { statTypeName: "Elemental Mastery", upgrades: 3 },
      { statTypeName: "Energy Recharge%", upgrades: 1 },
    ],
  },
  {
    name: "Full Crit",
    entries: [
      { statTypeName: "Crit Rate%", upgrades: 2 },
      { statTypeName: "Crit DMG%", upgrades: 2 },
    ],
  },
  {
    name: "Full ER",
    entries: [{ statTypeName: "Energy Recharge%", upgrades: 4 }],
  },
];

// A template's own entries, minus whichever one(s) name the piece's current
// main stat -- the same "main stat excludes substat" rule the rest of this
// form already enforces, applied per-entry rather than used to hide the
// whole template. A template is always offered regardless of main stat; the
// main-stat-colliding entry (if any) just doesn't get applied, leaving that
// row (and any other unused row) on None/Flex -- e.g. "Crit Atk" applied
// under a Crit Rate% main stat still fills Crit DMG%/ATK%, just not Crit
// Rate% itself.
export function applicableTemplateEntries(template: SubstatTemplate, mainStatName: string): SubstatTemplateEntry[] {
  return template.entries.filter((entry) => entry.statTypeName !== mainStatName);
}

// The value a template's named substat starts at: one guaranteed initial
// roll at the 80% tier, plus one 90%-tier roll per upgrade -- both read from
// the authoritative SUBSTAT_LOWER_ROLL_TIERS/SUBSTAT_HIGHEST_ROLL lookup
// (via rollTierValues), never derived by multiplying a fraction against the
// highest roll (see SUBSTAT_LOWER_ROLL_TIERS's own comment on why that can
// land a hundredth off for a handful of stat/rarity combinations). Returns
// the raw summed value, not yet snapped to substatValidValues -- that
// depends on the level the caller has independently chosen, so the caller
// snaps it the same way it already does on every level change.
export function templateEntryValue(entry: SubstatTemplateEntry, rarity: number): number {
  const tiers = rollTierValues(entry.statTypeName, rarity);
  const initialRoll = tiers[1];
  const upgradeRoll = tiers[2];
  return roundTo2(initialRoll + entry.upgrades * upgradeRoll);
}
