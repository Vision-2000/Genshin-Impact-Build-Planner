// Originally generated from Character_Stats_Scaling_report.txt (summarized
// from https://genshin-impact.fandom.com/wiki/Character/Level_Scaling, kept
// in data-source/ as a historical reference only, not regenerated from --
// see below).
//
// Main stat (HP/ATK/DEF): Stat = Base * LevelMultiplier(rarity, level) + MaxAscension * AscensionMultiplier(phase)
// Bonus stat (ascension stat): Stat = BonusBase(rarity, statType) * BonusAscensionMultiplier(phase)
//
// Verified to 100% agreement (12,000 rows, 125 characters) against our
// seeded data before being trusted as the compact schema's source of truth.
// Traveler is a documented exception: despite rarity=5 in the schema
// (correct for banner/catalog purposes), its actual stat GROWTH -- both
// curves below -- follows the 4-star scaling entirely, since it's a free
// character. Callers must pass 4 for Traveler's "scalingRarity", not its
// stored rarity.
//
// CHARACTER_BONUS_STAT_BASE_VALUE's Energy Recharge%/Healing Bonus% 4-star
// values (and Healing Bonus% 5-star) were corrected during manual audit --
// the wiki's own summary table only gives 1-2 decimal digits, not enough
// precision for these three specifically (every other entry below checked
// out exact). Corrected to match the wiki directly rather than v1 (v1's
// own values here are confirmed wrong) -- see
// data-source/master-data-formulas.txt. Main stat (HP/ATK/DEF) above is
// unaffected: its own 3dp rounding is a documented step of the wiki's
// real formula, not an approximation.

export const CHARACTER_ASCENSION_MULTIPLIER = [0, 38 / 182, 65 / 182, 101 / 182, 128 / 182, 155 / 182, 182 / 182];
export const CHARACTER_BONUS_STAT_ASCENSION_MULTIPLIER = [0, 0, 1, 2, 2, 3, 4];

export const CHARACTER_BONUS_STAT_BASE_VALUE: Record<string, { fourStar: number | null; fiveStar: number | null }> =
  {
  "ATK%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "HP%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "DEF%": {
    "fourStar": 7.5,
    "fiveStar": 9
  },
  "Physical DMG Bonus%": {
    "fourStar": 7.5,
    "fiveStar": 9
  },
  "Energy Recharge%": {
    "fourStar": 6.67,
    "fiveStar": 8
  },
  "Elemental Mastery": {
    "fourStar": 24,
    "fiveStar": 28.8
  },
  "Healing Bonus%": {
    "fourStar": 4.62,
    "fiveStar": 5.54
  },
  "Crit Rate%": {
    "fourStar": null,
    "fiveStar": 4.8
  },
  "Crit DMG%": {
    "fourStar": null,
    "fiveStar": 9.6
  },
  "Pyro DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Hydro DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Electro DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Cryo DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Anemo DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Geo DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  },
  "Dendro DMG Bonus%": {
    "fourStar": 6,
    "fiveStar": 7.2
  }
};

// Levels 95/100 only -- see the report's own caveat that the closed-form
// formula below doesn't hold there. Reachable via CHARACTER_EXTRA_LEVELS in
// src/lib/ascension.ts (character-only; weapons stop at 90).
const LEVEL_95_100_MULTIPLIER: Record<number, { fourStarHpDef: number; fourStarAtk: number; fiveStarHpDef: number; fiveStarAtk: number }> =
  {
  "95": {
    "fourStarHpDef": 8.761,
    "fourStarAtk": 9.87,
    "fiveStarHpDef": 9.195001,
    "fiveStarAtk": 10.18398
  },
  "100": {
    "fourStarHpDef": 9.174001,
    "fourStarAtk": 11.392,
    "fiveStarHpDef": 9.652001,
    "fiveStarAtk": 11.629
  }
};

export function characterLevelMultiplier(scalingRarity: number, level: number, stat: "hp" | "attack" | "defense" = "hp"): number {
  const exception = LEVEL_95_100_MULTIPLIER[level];
  if (exception) {
    if (scalingRarity >= 5) return stat === "attack" ? exception.fiveStarAtk : exception.fiveStarHpDef;
    return stat === "attack" ? exception.fourStarAtk : exception.fourStarHpDef;
  }
  const base = (100 + 9 * level) / 109;
  if (scalingRarity >= 5) return Math.round(base * ((1900 + level) / 1901) * 1000) / 1000;
  return Math.round(base * 1000) / 1000;
}

export function computeCharacterMainStat(
  base: number,
  maxAscension: number,
  scalingRarity: number,
  level: number,
  ascensionPhase: number,
  stat: "hp" | "attack" | "defense" = "hp"
): number {
  return base * characterLevelMultiplier(scalingRarity, level, stat) + maxAscension * CHARACTER_ASCENSION_MULTIPLIER[ascensionPhase];
}

export function computeCharacterBonusStat(statTypeName: string, scalingRarity: number, ascensionPhase: number): number {
  const entry = CHARACTER_BONUS_STAT_BASE_VALUE[statTypeName];
  if (!entry) return 0;
  const base = scalingRarity >= 5 ? entry.fiveStar : entry.fourStar;
  if (base === null) return 0;
  return base * CHARACTER_BONUS_STAT_ASCENSION_MULTIPLIER[ascensionPhase];
}

// Centralizes the Traveler exception in one place rather than duplicating
// the name check at every call site (seed.ts, server actions, UI).
function isTraveler(name: string): boolean {
  return name.startsWith("Traveler (");
}

export function characterScalingRarity(name: string, rarity: number): number {
  return isTraveler(name) ? 4 : rarity;
}

// After an early story quest, the Traveler permanently gains a flat +50
// base HP / +10 base ATK / +15 base Elemental Mastery -- NOT part of the
// level curve (never added to baseHp/baseAttack themselves, which get
// multiplied by characterLevelMultiplier above). Not stored in
// characters.json; handled here by name, the same treatment as Exaiphanes
// Blade's special leveling (see src/lib/weapon-scaling.ts). Values as given
// by the user, not independently verified against a game source -- see
// data-source/master-data-formulas.txt section 2.
const TRAVELER_STORY_BUFF = { hp: 50, attack: 10, elementalMastery: 15 };

export function travelerStoryBuffBonus(name: string, stat: "hp" | "attack" | "elementalMastery"): number {
  return isTraveler(name) ? TRAVELER_STORY_BUFF[stat] : 0;
}
