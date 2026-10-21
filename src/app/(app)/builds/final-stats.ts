import type { WeaponType } from "@/generated/prisma/enums";
import {
  characterScalingRarity,
  computeCharacterBonusStat,
  computeCharacterMainStat,
  travelerStoryBuffBonus,
} from "@/lib/character-scaling";
import { computeWeaponAttack, computeWeaponSecondaryStat } from "@/lib/weapon-scaling";
import { computeWeaponValueCurve, type WeaponValueCurveType } from "@/lib/weapon-refinement-scaling";
import { DEFAULT_WEAPON } from "@/lib/default-weapon";
import { computeArtifactMainStatValue } from "../artifacts/artifact-rules";

// CLAUDE.md's own build-order step 8 ("Final-stats calculation module (pure
// function: build -> aggregate stat totals)") -- not full damage-per-hit
// output (that needs talent multiplier tables, enemy RES, and the
// elemental reaction system, well outside this scope, see CLAUDE.md's own
// Deferred section).
//
// ATK/HP/DEF are each (base) x (1 + %-bonus-of-that-stat) + (flat-bonus-of-
// that-stat) -- base is JUST the character's own level/ascension-scaled
// growth (+ the weapon's own base ATK, for ATK only; weapons never
// contribute a base HP/DEF), kept entirely separate from the generic
// per-stat-name totals below so it's never accidentally summed in twice.
// "No real weapon chosen" still contributes a base ATK, not zero -- see
// DEFAULT_WEAPON's own comment on why a build always has SOME weapon
// equipped, same as in-game.
// Every other contribution (ascension stat, talents, constellations,
// weapon secondary stat/passive, artifact main stat/substats/set bonuses)
// is just added under whichever real StatType name it already is --
// "ATK%"/"HP%"/"DEF%" naturally end up in their own bucket this way,
// without needing a special case anywhere a bonus is actually read.
//
// Crit Rate%/Crit DMG%/Energy Recharge% start from their real in-game
// baseline (5%/50%/100%) plus whatever's accumulated on top -- unlike
// ATK/HP/DEF, nothing here scales these multiplicatively.
//
// Elemental Mastery is purely additive (character's own flat floor +
// ascension bonus, if EM, + every other EM source) -- there's no "EM%"
// stat in this game.
//
// Healing Bonus%/Incoming Healing Bonus%/Shield Strength%/each elemental +
// Physical DMG Bonus%/each RES% are purely additive and OMITTED entirely
// when their total is 0 or less, rather than shown as a 0% row -- these
// are "only matters if you actually have some" stats, unlike the 7 above
// which are always relevant.

const BASE_CRIT_RATE = 5;
const BASE_CRIT_DMG = 50;
const BASE_ENERGY_RECHARGE = 100;

// Purely additive, shown only when their total is above 0 -- see this
// file's own top comment.
const CONDITIONAL_STAT_NAMES = [
  "Healing Bonus%",
  "Incoming Healing Bonus%",
  "Shield Strength%",
  "Physical DMG Bonus%",
  "Pyro DMG Bonus%",
  "Hydro DMG Bonus%",
  "Electro DMG Bonus%",
  "Cryo DMG Bonus%",
  "Anemo DMG Bonus%",
  "Geo DMG Bonus%",
  "Dendro DMG Bonus%",
  "Physical RES%",
  "Pyro RES%",
  "Hydro RES%",
  "Electro RES%",
  "Cryo RES%",
  "Anemo RES%",
  "Geo RES%",
  "Dendro RES%",
] as const;

export type StatBonusItem = { statTypeName: string; value: number };

export type FinalStatsCharacterInput = {
  name: string;
  rarity: number;
  // Only used to look up DEFAULT_WEAPON when `weapon` below is null -- see
  // that constant's own comment on why a build with no real weapon chosen
  // still contributes ATK, not zero.
  weaponType: WeaponType;
  baseHp: number | null;
  baseAttack: number | null;
  baseDefense: number | null;
  maxAscensionHp: number | null;
  maxAscensionAttack: number | null;
  maxAscensionDefense: number | null;
  baseElementalMastery: number;
  ascensionStatName: string | null;
  level: number;
  ascensionPhase: number;
  constellation: number;
  // Every Passive talent's own unconditional stat bonus, unfiltered -- a
  // Passive has no level/ascension gate of its own in this schema (see
  // CLAUDE.md's Talent model), so every row here is always active once the
  // character is owned.
  talentStatBonuses: StatBonusItem[];
  // Every constellation's own unconditional stat bonus, filtered by
  // `number` below (constellations 1..constellation are unlocked, see
  // OwnedCharacter.constellation).
  constellationStatBonuses: (StatBonusItem & { number: number })[];
};

export type FinalStatsWeaponInput = {
  // Nullable in the schema (Weapon.attackTier) -- every currently-seeded
  // weapon has one, but computeFinalStats skips the ATK contribution
  // entirely rather than assume it for whatever edge case doesn't.
  attackTier: number | null;
  rarity: number;
  attackCurveRarity: number | null;
  baseSecondaryStatValue: number | null;
  secondaryStatName: string | null;
  level: number;
  ascensionPhase: number;
  refinement: number;
  // Not a StatBonusItem -- these are curve-based (see
  // computeWeaponValueCurve), not a stored flat value.
  statBonuses: {
    statTypeName: string;
    curveType: WeaponValueCurveType;
    baseValue: number;
    slope: number | null;
    customValues: number[] | null;
  }[];
};

export type FinalStatsArtifactInput = {
  artifactSetId: number;
  rarity: number;
  level: number;
  mainStatName: string;
  substats: StatBonusItem[];
  // The set's own 2pc/4pc stat bonuses -- duplicated across every piece
  // from the same set (each piece doesn't know what else is equipped), so
  // computeFinalStats dedupes by artifactSetId before applying either.
  twoPieceStatBonuses: StatBonusItem[];
  fourPieceStatBonuses: StatBonusItem[];
};

export type FinalStatsInput = {
  character: FinalStatsCharacterInput;
  weapon: FinalStatsWeaponInput | null;
  artifacts: FinalStatsArtifactInput[];
};

// Stat name -> final display value. Always includes ATK/HP/DEF/Elemental
// Mastery/Crit Rate%/Crit DMG%/Energy Recharge%; every other stat is
// included only when its total is above 0 (see CONDITIONAL_STAT_NAMES).
export function computeFinalStats({ character, weapon, artifacts }: FinalStatsInput): Record<string, number> {
  // Per-StatType-name running totals for every contribution that ISN'T
  // part of the ATK/HP/DEF base (ascension stat, talents, constellations,
  // weapon secondary stat/passive, artifact main stat/substats/set
  // bonuses) -- "ATK%"/"HP%"/"DEF%" land here like any other stat, read
  // back out explicitly below rather than being summed into a flat total.
  const totals = new Map<string, number>();
  function add(statName: string | null | undefined, value: number) {
    if (!statName || value === 0) return;
    totals.set(statName, (totals.get(statName) ?? 0) + value);
  }

  const scalingRarity = characterScalingRarity(character.name, character.rarity);

  // Base HP/ATK/DEF -- the character's own level/ascension-scaled growth
  // only (no %/flat bonuses folded in here), per computeCharacterMainStat's
  // own contract. Traveler's story buff is a flat bonus (added after the
  // growth curve, never multiplied by %), so it's added via the generic
  // `add` call below as plain "HP"/"ATK"/flat EM, not mixed into these.
  let baseHp = 0;
  let baseAttack = 0;
  let baseDefense = 0;
  if (character.baseHp !== null && character.maxAscensionHp !== null) {
    baseHp = computeCharacterMainStat(
      character.baseHp,
      character.maxAscensionHp,
      scalingRarity,
      character.level,
      character.ascensionPhase,
      "hp"
    );
  }
  if (character.baseAttack !== null && character.maxAscensionAttack !== null) {
    baseAttack = computeCharacterMainStat(
      character.baseAttack,
      character.maxAscensionAttack,
      scalingRarity,
      character.level,
      character.ascensionPhase,
      "attack"
    );
  }
  if (character.baseDefense !== null && character.maxAscensionDefense !== null) {
    baseDefense = computeCharacterMainStat(
      character.baseDefense,
      character.maxAscensionDefense,
      scalingRarity,
      character.level,
      character.ascensionPhase,
      "defense"
    );
  }
  add("HP", travelerStoryBuffBonus(character.name, "hp"));
  add("ATK", travelerStoryBuffBonus(character.name, "attack"));
  add("Elemental Mastery", character.baseElementalMastery + travelerStoryBuffBonus(character.name, "elementalMastery"));
  if (character.ascensionStatName) {
    add(character.ascensionStatName, computeCharacterBonusStat(character.ascensionStatName, scalingRarity, character.ascensionPhase));
  }
  for (const bonus of character.talentStatBonuses) add(bonus.statTypeName, bonus.value);
  for (const bonus of character.constellationStatBonuses) {
    if (bonus.number <= character.constellation) add(bonus.statTypeName, bonus.value);
  }

  let weaponBaseAttack: number;
  if (weapon) {
    weaponBaseAttack = weapon.attackTier !== null
      ? computeWeaponAttack(
          weapon.attackTier,
          weapon.rarity,
          weapon.level,
          weapon.ascensionPhase,
          weapon.attackCurveRarity ?? weapon.rarity
        )
      : 0;
    if (weapon.secondaryStatName && weapon.baseSecondaryStatValue !== null) {
      add(weapon.secondaryStatName, computeWeaponSecondaryStat(weapon.baseSecondaryStatValue, weapon.level));
    }
    for (const bonus of weapon.statBonuses) {
      add(bonus.statTypeName, computeWeaponValueCurve(bonus, weapon.refinement));
    }
  } else {
    // No real weapon chosen -- every character always has SOME weapon
    // equipped in-game (see DEFAULT_WEAPON's own comment), so this
    // contributes that type's starter weapon's own fixed base ATK instead
    // of nothing. No secondary stat/passive to add -- true for every
    // default weapon.
    weaponBaseAttack = DEFAULT_WEAPON[character.weaponType].baseAttack;
  }

  const setPieceCounts = new Map<number, number>();
  for (const artifact of artifacts) {
    setPieceCounts.set(artifact.artifactSetId, (setPieceCounts.get(artifact.artifactSetId) ?? 0) + 1);
    add(artifact.mainStatName, computeArtifactMainStatValue(artifact.mainStatName, artifact.rarity, artifact.level));
    for (const substat of artifact.substats) add(substat.statTypeName, substat.value);
  }
  const countedSets = new Set<number>();
  for (const artifact of artifacts) {
    if (countedSets.has(artifact.artifactSetId)) continue;
    countedSets.add(artifact.artifactSetId);
    const count = setPieceCounts.get(artifact.artifactSetId) ?? 0;
    if (count >= 2) for (const bonus of artifact.twoPieceStatBonuses) add(bonus.statTypeName, bonus.value);
    if (count >= 4) for (const bonus of artifact.fourPieceStatBonuses) add(bonus.statTypeName, bonus.value);
  }

  const result: Record<string, number> = {
    ATK: (baseAttack + weaponBaseAttack) * (1 + (totals.get("ATK%") ?? 0) / 100) + (totals.get("ATK") ?? 0),
    HP: baseHp * (1 + (totals.get("HP%") ?? 0) / 100) + (totals.get("HP") ?? 0),
    DEF: baseDefense * (1 + (totals.get("DEF%") ?? 0) / 100) + (totals.get("DEF") ?? 0),
    "Elemental Mastery": totals.get("Elemental Mastery") ?? 0,
    "Crit Rate%": BASE_CRIT_RATE + (totals.get("Crit Rate%") ?? 0),
    "Crit DMG%": BASE_CRIT_DMG + (totals.get("Crit DMG%") ?? 0),
    "Energy Recharge%": BASE_ENERGY_RECHARGE + (totals.get("Energy Recharge%") ?? 0),
  };

  for (const statName of CONDITIONAL_STAT_NAMES) {
    const value = totals.get(statName) ?? 0;
    if (value > 0) result[statName] = value;
  }

  return result;
}

// Fixed display order -- ATK/HP/DEF/EM/Crit/ER first (always present),
// then every conditional stat that actually made it into the result
// (see CONDITIONAL_STAT_NAMES), in that same fixed order.
const FINAL_STATS_PRIMARY_ORDER = ["HP", "ATK", "DEF", "Elemental Mastery", "Crit Rate%", "Crit DMG%", "Energy Recharge%"];

export function orderedFinalStats(totals: Record<string, number>): { statName: string; value: number }[] {
  const ordered: { statName: string; value: number }[] = [];
  for (const statName of FINAL_STATS_PRIMARY_ORDER) {
    if (statName in totals) ordered.push({ statName, value: totals[statName] });
  }
  for (const statName of CONDITIONAL_STAT_NAMES) {
    if (statName in totals) ordered.push({ statName, value: totals[statName] });
  }
  return ordered;
}
