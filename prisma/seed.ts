// Running this script directly (npx tsx prisma/seed.ts) doesn't go through
// Prisma CLI, which is what normally loads .env via prisma.config.ts's own
// "dotenv/config" import -- src/lib/prisma.ts reads process.env.DATABASE_URL
// directly with no loading of its own, relying on Next.js's built-in .env
// handling in the app itself. Without this import here, DATABASE_URL is
// undefined for a standalone run, surfacing as a confusing SASL/password
// error from the Postgres driver rather than a clear "env var missing" one.
import "dotenv/config";
import * as genshindb from "genshin-db";
import { prisma } from "../src/lib/prisma";
import { ASCENSION_BREAKPOINTS } from "../src/lib/ascension";
import { Element, WeaponType, TalentSlot, ArtifactSetPiece } from "../src/generated/prisma/enums";

// ---------------------------------------------------------------------------
// StatType: fixed canonical vocabulary, not sourced from genshin-db.
// ---------------------------------------------------------------------------

const STAT_TYPE_NAMES = [
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

type StatTypeName = (typeof STAT_TYPE_NAMES)[number];

// Maps genshin-db's FIGHT_PROP_* keys (used for weapon secondary stats) to
// our StatType.name values.
const FIGHT_PROP_TO_STAT_TYPE: Record<string, StatTypeName> = {
  FIGHT_PROP_ATTACK_PERCENT: "ATK%",
  FIGHT_PROP_CHARGE_EFFICIENCY: "Energy Recharge%",
  FIGHT_PROP_CRITICAL: "Crit Rate%",
  FIGHT_PROP_CRITICAL_HURT: "Crit DMG%",
  FIGHT_PROP_DEFENSE_PERCENT: "DEF%",
  FIGHT_PROP_ELEC_ADD_HURT: "Electro DMG Bonus%",
  FIGHT_PROP_ELEMENT_MASTERY: "Elemental Mastery",
  FIGHT_PROP_FIRE_ADD_HURT: "Pyro DMG Bonus%",
  FIGHT_PROP_GRASS_ADD_HURT: "Dendro DMG Bonus%",
  FIGHT_PROP_HEAL_ADD: "Healing Bonus%",
  FIGHT_PROP_HP_PERCENT: "HP%",
  FIGHT_PROP_ICE_ADD_HURT: "Cryo DMG Bonus%",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "Physical DMG Bonus%",
  FIGHT_PROP_ROCK_ADD_HURT: "Geo DMG Bonus%",
  FIGHT_PROP_WATER_ADD_HURT: "Hydro DMG Bonus%",
  FIGHT_PROP_WIND_ADD_HURT: "Anemo DMG Bonus%",
};

// genshin-db's character stats() function returns each character's
// ascension-stat as a TOTAL, not just the bonus from ascending -- but only
// for Crit Rate and Crit DMG, where every character already has a fixed
// baseline regardless of ascension (5% Crit Rate, 50% Crit DMG) folded
// into `specialized`. Verified directly: a level-1, unascended character
// (no ascension bonus unlocked yet) still reports specialized: 0.05/0.5
// for these two, sampled across 5 characters each.
//
// Energy Recharge does NOT work this way, despite every character also
// having a 100% ER baseline in-game -- genshin-db's `specialized` for it
// is already bonus-only. Verified across all 7 ER-ascension characters
// (Bennett, Kaeya, Mona, Raiden Shogun, Alyosha, ...): every one reports 0
// at level 1/unascended, not 1. Treating it like the other two subtracted
// a phantom 100% baseline from an already-bonus-only value, producing
// negative results once a character actually ascended (e.g. Bennett
// showing -73.3% ER at level 81 before this was caught). Every other
// ascension-stat type (Elemental Mastery, HP%/ATK%/DEF%, elemental DMG
// Bonus%, Healing Bonus%) has no baseline either, same as ER.
//
// Subtracted in seedCharacterLevelStats so CharacterLevelStat.
// ascensionStatValue always stores the bonus alone, matching what the game
// itself shows on the character's stat screen.
const ASCENSION_STAT_BASELINE: Partial<Record<StatTypeName, number>> = {
  "Crit Rate%": 0.05,
  "Crit DMG%": 0.5,
};

const ELEMENT_TYPE_MAP: Record<string, Element> = {
  ELEMENT_PYRO: Element.Pyro,
  ELEMENT_HYDRO: Element.Hydro,
  ELEMENT_ELECTRO: Element.Electro,
  ELEMENT_CRYO: Element.Cryo,
  ELEMENT_ANEMO: Element.Anemo,
  ELEMENT_GEO: Element.Geo,
  ELEMENT_DENDRO: Element.Dendro,
};

const WEAPON_TYPE_MAP: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: WeaponType.Sword,
  WEAPON_CLAYMORE: WeaponType.Claymore,
  WEAPON_POLE: WeaponType.Polearm,
  WEAPON_BOW: WeaponType.Bow,
  WEAPON_CATALYST: WeaponType.Catalyst,
};

// Enka Network mirrors the game's own UI asset files directly, keyed by the
// same raw filename genshin-db exposes as filename_icon/filename_flower/etc.
// Verified 0 dead links across all 224 weapons, 117 characters, and 270
// artifact pieces this seed keeps — unlike HoYoLAB's live-API-backed
// mihoyo_icon/hoyowiki_icon fields, which lag or 404 for a meaningful
// fraction of items (36% of weapons at time of writing) since they depend on
// HoYoverse's own CDN population rather than a straight asset mirror.
function enkaIconUrl(filename: string | undefined): string | null {
  return filename ? `https://enka.network/ui/${filename}.png` : null;
}

// genshin-db has no per-vision breakdown for the Traveler (Aether/Lumine both
// come back with elementType ELEMENT_NONE) — seeded manually instead. Gender
// is cosmetic only and not tracked in the schema, so each vision is one row.
// All 6 rows share exclusivityGroup "traveler" so only one can ever be in a
// team/roster at a time, matching how the character actually plays. If a
// field is ever sourced from genshin-db's per-gender data (e.g. an icon),
// default to the female variant (Lumine).
const TRAVELER_VISIONS: Element[] = [
  Element.Anemo,
  Element.Geo,
  Element.Electro,
  Element.Dendro,
  Element.Hydro,
  Element.Pyro,
  Element.Cryo,
];
const TRAVELER_EXCLUSIVITY_GROUP = "traveler";

// Non-playable / placeholder entries that show up in genshin-db's characters
// folder but aren't real playable characters.
const EXCLUDED_CHARACTER_NAMES = new Set(["Aether", "Lumine", "Manekin", "Manekina"]);

// Story-quest-only weapon (a corrupted/possessed blade with a 50% self-damage
// penalty) — never obtainable as a real player weapon.
const EXCLUDED_WEAPON_NAMES = new Set(["Prized Isshin Blade"]);

// No meaningful build relevance at these rarities — excluded from seeding.
const MIN_WEAPON_RARITY = 3;
const MIN_ARTIFACT_SET_RARITY = 4;

// ---------------------------------------------------------------------------

async function seedStatTypes() {
  const statTypeIds = new Map<StatTypeName, number>();
  for (const name of STAT_TYPE_NAMES) {
    const statType = await prisma.statType.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    statTypeIds.set(name, statType.id);
  }
  console.log(`Seeded ${statTypeIds.size} stat types`);
  return statTypeIds;
}

// ASCENSION_BREAKPOINTS is shared with src/lib/ascension.ts (used by the
// owned-character/weapon level-editing UI) so seeding and validation can't
// drift apart. genshin-db's stats() infers the correct phase regardless of
// which ascension flag is passed at a non-breakpoint level (verified
// directly: passing '-' or '+' there returns the same, correct result) --
// only the 6 breakpoint levels are actually ambiguous (pre- vs.
// post-ascension, same level, different stats).

// Samples genshin-db's own stats(level, ascension) at every (level, phase)
// pair a character/weapon can actually be at, rather than reimplementing
// Genshin's growth-curve formulas ourselves -- see CLAUDE.md's Key
// decisions for why. Always trusts the function's own returned `ascension`
// field for the phase number, never our own guess.
async function seedCharacterLevelStats(
  characterId: number,
  statFn: genshindb.StatFunction,
  ascensionStatName: StatTypeName | undefined
) {
  const baseline = ascensionStatName ? (ASCENSION_STAT_BASELINE[ascensionStatName] ?? 0) : 0;
  // genshin-db's `specialized` is a raw fraction (0.384 for 38.4%) for every
  // percent-type stat -- but every other stat-bonus value in this schema
  // (TalentStatBonus/ConstellationStatBonus/WeaponStatBonus, all prose-
  // parsed from literal percentages like "Gain 12% ATK") is already stored
  // percent-scaled (12, not 0.12), same convention the artifact substat
  // roll tables use. Rescaled here so ascensionStatValue matches that
  // existing convention instead of being the one column in a different
  // unit. Elemental Mastery is the only non-percent ascension stat and
  // genshin-db already reports it as a flat number, so it's left alone.
  const isPercentStat = ascensionStatName?.endsWith("%") ?? false;
  const rows = [];
  for (let level = 1; level <= 90; level++) {
    const flags: ("-" | "+")[] = ASCENSION_BREAKPOINTS.includes(level) ? ["-", "+"] : ["-"];
    for (const flag of flags) {
      const result = statFn(level, flag);
      const specialized = (result.specialized ?? 0) - baseline;
      rows.push({
        characterId,
        level: result.level,
        ascensionPhase: result.ascension,
        hp: result.hp ?? 0,
        attack: result.attack ?? 0,
        defense: result.defense ?? 0,
        ascensionStatValue: isPercentStat ? specialized * 100 : specialized,
      });
    }
  }

  // Delete-and-recreate rather than 96 individual upserts -- this data is
  // wholly owned by the seed (never user-edited), so there's nothing to
  // preserve across a re-run.
  await prisma.characterLevelStat.deleteMany({ where: { characterId } });
  await prisma.characterLevelStat.createMany({ data: rows });
}

// Matches every {paramN:formatCode} placeholder in one of genshin-db's
// "Label Name|{param1:F1P}" attribute-label strings. Most labels reference
// exactly one param, but a few combine two (e.g.
// "Low/High Plunge DMG|{param10:P}/{param11:P}") -- those get split into
// multiple TalentAttribute rows (suffixed "(1)", "(2)", ...) since this
// schema stores one number series per row, not per label.
const TALENT_PARAM_REGEX = /\{(\w+):(\w+)\}/g;

function parseAttributeLabel(rawLabel: string): { name: string; paramKey: string; formatCode: string }[] {
  const [name, template] = rawLabel.split("|");
  const matches = [...template.matchAll(TALENT_PARAM_REGEX)];
  return matches.map((match, index) => ({
    name: matches.length > 1 ? `${name} (${index + 1})` : name,
    paramKey: match[1],
    formatCode: match[2],
  }));
}

async function seedTalentAttributes(talentId: number, attributes: genshindb.CombatTalentDetail["attributes"]) {
  const rows: { talentId: number; label: string; formatCode: string; values: number[]; order: number }[] = [];
  let order = 0;
  for (const rawLabel of attributes.labels) {
    for (const { name, paramKey, formatCode } of parseAttributeLabel(rawLabel)) {
      const values = attributes.parameters[paramKey];
      if (!values) continue;
      rows.push({ talentId, label: name, formatCode, values, order: order++ });
    }
  }

  // Delete-and-recreate, same reasoning as CharacterLevelStat: wholly
  // seed-owned data, never user-edited.
  await prisma.talentAttribute.deleteMany({ where: { talentId } });
  if (rows.length > 0) await prisma.talentAttribute.createMany({ data: rows });
}

// One Talent row per slot this character actually has. combatsp/combatju
// (Mona/Ayaka/Ororon's extra special-move slot, layered on top of the
// normal Normal Attack/Skill/Burst 3) is deliberately not seeded -- it's a
// genuine 4th leveled combat move that doesn't fit this schema's 3-slot
// model, a rare kit quirk affecting a handful of characters rather than
// core to "which talent do I invest in."
async function seedTalents(characterId: number, characterName: string) {
  const talent = genshindb.talents(characterName, { verboseCategories: true });
  if (!talent) {
    console.warn(`No talent data for "${characterName}"`);
    return;
  }

  const slots: {
    slot: TalentSlot;
    detail: genshindb.CombatTalentDetail | genshindb.PassiveTalentDetail | undefined;
    iconFilename: string | undefined;
  }[] = [
    { slot: TalentSlot.NormalAttack, detail: talent.combat1, iconFilename: talent.images?.filename_combat1 },
    { slot: TalentSlot.Skill, detail: talent.combat2, iconFilename: talent.images?.filename_combat2 },
    { slot: TalentSlot.Burst, detail: talent.combat3, iconFilename: talent.images?.filename_combat3 },
    { slot: TalentSlot.Passive1, detail: talent.passive1, iconFilename: talent.images?.filename_passive1 },
    { slot: TalentSlot.Passive2, detail: talent.passive2, iconFilename: talent.images?.filename_passive2 },
    { slot: TalentSlot.Passive3, detail: talent.passive3, iconFilename: talent.images?.filename_passive3 },
    { slot: TalentSlot.Passive4, detail: talent.passive4, iconFilename: talent.images?.filename_passive4 },
  ];

  for (const { slot, detail, iconFilename } of slots) {
    if (!detail) continue;
    const iconUrl = enkaIconUrl(iconFilename);

    const dbTalent = await prisma.talent.upsert({
      where: { characterId_slot: { characterId, slot } },
      create: { characterId, slot, name: detail.name, description: detail.description, iconUrl },
      update: { name: detail.name, description: detail.description, iconUrl },
    });

    // Only combat talents (Normal Attack/Skill/Burst) have level-scaling
    // attributes -- Passives are a fixed effect, no `attributes` field.
    if ("attributes" in detail) {
      await seedTalentAttributes(dbTalent.id, detail.attributes);
    }
  }
}

// Constellations 3 and 5 always grant +3 to one of the 3 combat talents --
// checked directly against all 750 seeded constellations before writing
// this: every match lands on exactly constellation 3 or 5, never any other
// number, confirming that's a fixed game rule rather than something to
// derive per-character. WHICH talent varies by character and isn't always
// Skill-at-C3/Burst-at-C5 as might be assumed -- 8 real characters boost
// Normal Attack instead -- so this resolves it from the actual text rather
// than hardcoding that assumption.
//
// The exact phrasing varies more than artifact/weapon text does ("Increases
// the Level of X by 3.", "Increases Elemental Skill X Level by 3.", "X
// increases by 3 Levels."), so rather than enumerating every sentence
// template this uses a loose trigger (the sentence mentions both "Level"
// and "by 3") plus a verbatim substring match against the character's own
// Talent.name values -- more robust than precisely regexing out the name's
// position, and confirmed empirically to produce zero false positives
// across the full seeded set. The one real gap: Aloy's constellation text
// is entirely placeholder ("The time has not yet come..."), not real data
// genshin-db has for her -- correctly resolves to no boost at all.
function findBoostedTalentSlot(
  description: string,
  combatTalents: { name: string; slot: TalentSlot }[]
): TalentSlot | null {
  for (const sentence of splitSentences(description)) {
    if (!/\blevels?\b/i.test(sentence) || !/\bby 3\b/i.test(sentence)) continue;
    const cleaned = sentence.replace(/\*\*/g, "");
    const match = combatTalents.find((t) => cleaned.includes(t.name));
    if (match) return match.slot;
  }
  return null;
}

async function seedConstellations(characterId: number, characterName: string, statTypeIds: Map<StatTypeName, number>) {
  const constellation = genshindb.constellations(characterName, { verboseCategories: true });
  if (!constellation) {
    console.warn(`No constellation data for "${characterName}"`);
    return;
  }

  const combatTalents = await prisma.talent.findMany({
    where: { characterId, slot: { in: [TalentSlot.NormalAttack, TalentSlot.Skill, TalentSlot.Burst] } },
    select: { name: true, slot: true },
  });

  const numbers = [1, 2, 3, 4, 5, 6] as const;
  for (const number of numbers) {
    const detail = constellation[`c${number}`];
    const iconUrl = enkaIconUrl(constellation.images?.[`filename_c${number}`]);
    const boostedTalentSlot = findBoostedTalentSlot(detail.description, combatTalents);

    const dbConstellation = await prisma.constellation.upsert({
      where: { characterId_number: { characterId, number } },
      create: {
        characterId,
        number,
        name: detail.name,
        description: detail.description,
        iconUrl,
        boostedTalentSlot,
      },
      update: { name: detail.name, description: detail.description, iconUrl, boostedTalentSlot },
    });
    await seedConstellationStatBonuses(dbConstellation.id, detail.description, statTypeIds);
  }
}

async function seedCharacters(statTypeIds: Map<StatTypeName, number>) {
  const characters = genshindb.characters("names", {
    matchCategories: true,
    verboseCategories: true,
  });

  let count = 0;
  for (const character of characters) {
    if (EXCLUDED_CHARACTER_NAMES.has(character.name)) continue;

    const element = ELEMENT_TYPE_MAP[character.elementType];
    const weaponType = WEAPON_TYPE_MAP[character.weaponType];
    if (!element || !weaponType) {
      console.warn(
        `Skipping character "${character.name}": unmapped elementType/weaponType (${character.elementType}/${character.weaponType})`
      );
      continue;
    }

    const iconUrl = enkaIconUrl(character.images.filename_icon);
    const ascensionStatName = FIGHT_PROP_TO_STAT_TYPE[character.substatType];
    const ascensionStatId = statTypeIds.get(ascensionStatName) ?? null;

    const dbCharacter = await prisma.character.upsert({
      where: { name: character.name },
      create: {
        name: character.name,
        element,
        weaponType,
        rarity: character.rarity,
        exclusivityGroup: null,
        ascensionStatId,
        iconUrl,
      },
      update: { element, weaponType, rarity: character.rarity, ascensionStatId, iconUrl },
    });
    await seedCharacterLevelStats(dbCharacter.id, character.stats, ascensionStatName);
    await seedTalents(dbCharacter.id, character.name);
    await seedConstellations(dbCharacter.id, character.name, statTypeIds);
    count++;
  }

  // All 6 visions share Lumine's icon and base stats: genshin-db has no
  // per-vision breakdown for either (a vision's kit differs, but HP/ATK/DEF
  // growth and the ascension stat don't), and neither actually changes with
  // element in-game. "Traveler (Anemo)" etc. aren't valid characters()
  // query names in genshin-db (only Lumine/Aether are), so Lumine's own
  // stats function is reused for every vision row.
  const lumine = genshindb.characters("Lumine", { verboseCategories: true })!;
  const travelerIconUrl = enkaIconUrl(lumine.images.filename_icon);
  const travelerAscensionStatName = FIGHT_PROP_TO_STAT_TYPE[lumine.substatType];
  const travelerAscensionStatId = statTypeIds.get(travelerAscensionStatName) ?? null;

  for (const element of TRAVELER_VISIONS) {
    const name = `Traveler (${element})`;
    const dbCharacter = await prisma.character.upsert({
      where: { name },
      create: {
        name,
        element,
        weaponType: WeaponType.Sword,
        rarity: 5,
        exclusivityGroup: TRAVELER_EXCLUSIVITY_GROUP,
        ascensionStatId: travelerAscensionStatId,
        iconUrl: travelerIconUrl,
      },
      update: {
        element,
        weaponType: WeaponType.Sword,
        rarity: 5,
        exclusivityGroup: TRAVELER_EXCLUSIVITY_GROUP,
        ascensionStatId: travelerAscensionStatId,
        iconUrl: travelerIconUrl,
      },
    });
    await seedCharacterLevelStats(dbCharacter.id, lumine.stats, travelerAscensionStatName);
    // Unlike base stats, genshin-db DOES have per-vision talent/
    // constellation data, queryable under this same "Traveler (Element)"
    // name -- each vision's kit genuinely differs, unlike its stat growth.
    await seedTalents(dbCharacter.id, name);
    await seedConstellations(dbCharacter.id, name, statTypeIds);
    count++;
  }

  console.log(`Seeded ${count} characters (with level stats)`);
}

// genshin-db gives 2pc/4pc effects as plain prose, with no structured
// breakdown at all. Checked directly against all 56 currently-seeded sets
// before writing this: every single 4pc effect is genuinely conditional/
// proc-based (stacks, on-field, HP thresholds, reaction triggers -- not one
// is a simple stat bonus), so no parser is attempted for 4pc at all. 2pc
// effects are far more regular -- most follow one of a handful of
// near-identical phrasings -- so a small pattern-based parser handles the
// common case, falling back to "no bonus row" (same as any conditional
// effect) for anything that doesn't match or references a stat category
// outside this app's tracked final-stats list (e.g. Elemental Skill/Burst
// DMG Bonus%, RES%, Shield Strength% -- not in scope, see CLAUDE.md's Key
// decisions on calculation scope).

// English-phrase equivalent of FIGHT_PROP_TO_STAT_TYPE above, since 2pc
// effect text has no FIGHT_PROP_* keys to key off of at all.
const TWO_PIECE_STAT_TEXT_TO_STAT_TYPE: Record<string, StatTypeName> = {
  ATK: "ATK%",
  DEF: "DEF%",
  HP: "HP%",
  "CRIT Rate": "Crit Rate%",
  "CRIT DMG": "Crit DMG%",
  "Energy Recharge": "Energy Recharge%",
  "Physical DMG": "Physical DMG Bonus%",
  "Healing Bonus": "Healing Bonus%",
  "Character Healing Effectiveness": "Healing Bonus%",
  "Elemental Mastery": "Elemental Mastery",
  "Pyro DMG Bonus": "Pyro DMG Bonus%",
  "Hydro DMG Bonus": "Hydro DMG Bonus%",
  "Electro DMG Bonus": "Electro DMG Bonus%",
  "Cryo DMG Bonus": "Cryo DMG Bonus%",
  "Anemo DMG Bonus": "Anemo DMG Bonus%",
  "Geo DMG Bonus": "Geo DMG Bonus%",
  "Dendro DMG Bonus": "Dendro DMG Bonus%",
};

// Tried in order -- matches the 4 phrasings actually seen across all 56
// currently-seeded 2pc effects (verified directly, not assumed):
// "<Stat> +N%.", "Gain a N% <Stat>.", "Increases <Stat> by N.",
// "<Stat> is increased by N%." (Pale Flame is the only current set phrased
// this way -- everything else granting a DMG% bonus uses "<Stat> +N%.",
// e.g. Bloodstained Chivalry's otherwise-identical Physical DMG bonus).
function parseTwoPieceEffect(text: string): { statText: string; value: number } | null {
  const suffixMatch = text.match(/^(.+?)\s*\+(\d+(?:\.\d+)?)%\.?$/);
  if (suffixMatch) return { statText: suffixMatch[1].trim(), value: Number(suffixMatch[2]) };

  const gainMatch = text.match(/^Gain a (\d+(?:\.\d+)?)% (.+?)\.?$/);
  if (gainMatch) return { statText: gainMatch[2].trim(), value: Number(gainMatch[1]) };

  const increasesMatch = text.match(/^Increases (.+?) by (\d+(?:\.\d+)?)\.?$/);
  if (increasesMatch) return { statText: increasesMatch[1].trim(), value: Number(increasesMatch[2]) };

  const isIncreasedMatch = text.match(/^(.+?) is increased by (\d+(?:\.\d+)?)%\.?$/);
  if (isIncreasedMatch) return { statText: isIncreasedMatch[1].trim(), value: Number(isIncreasedMatch[2]) };

  return null;
}

async function seedArtifactSetTwoPieceBonus(
  artifactSetId: number,
  setName: string,
  twoPieceEffect: string,
  statTypeIds: Map<StatTypeName, number>
) {
  await prisma.artifactSetStatBonus.deleteMany({ where: { artifactSetId, piece: ArtifactSetPiece.Two } });

  const parsed = parseTwoPieceEffect(twoPieceEffect);
  if (!parsed) {
    console.warn(`"${setName}" 2pc effect didn't match a known pattern, left unbonused: "${twoPieceEffect}"`);
    return;
  }

  const statTypeName = TWO_PIECE_STAT_TEXT_TO_STAT_TYPE[parsed.statText];
  const statTypeId = statTypeName ? statTypeIds.get(statTypeName) : undefined;
  if (!statTypeId) {
    console.warn(
      `"${setName}" 2pc effect references an untracked stat ("${parsed.statText}"), left unbonused: "${twoPieceEffect}"`
    );
    return;
  }

  await prisma.artifactSetStatBonus.create({
    data: { artifactSetId, piece: ArtifactSetPiece.Two, statTypeId, value: parsed.value },
  });
}

async function seedArtifactSets(statTypeIds: Map<StatTypeName, number>) {
  const artifactSets = genshindb.artifacts("names", {
    matchCategories: true,
    verboseCategories: true,
  });

  let count = 0;
  let skipped = 0;
  for (const artifactSet of artifactSets) {
    // Circlet-only single-piece artifacts (e.g. the "Prayers for..." family)
    // have no 2pc/4pc set bonus and are excluded from seeding.
    if (!artifactSet.effect2Pc) {
      skipped++;
      continue;
    }

    // Sets that never drop above 3★ (Adventurer, Lucky Dog, Traveling
    // Doctor) have no meaningful build relevance — same reasoning as
    // excluding 1-2★ weapons.
    const rarity = Math.max(...artifactSet.rarityList);
    if (rarity < MIN_ARTIFACT_SET_RARITY) {
      skipped++;
      continue;
    }

    const flowerIconUrl = enkaIconUrl(artifactSet.images.filename_flower);
    const featherIconUrl = enkaIconUrl(artifactSet.images.filename_plume);
    const sandsIconUrl = enkaIconUrl(artifactSet.images.filename_sands);
    const gobletIconUrl = enkaIconUrl(artifactSet.images.filename_goblet);
    const circletIconUrl = enkaIconUrl(artifactSet.images.filename_circlet);

    const dbArtifactSet = await prisma.artifactSet.upsert({
      where: { name: artifactSet.name },
      create: {
        name: artifactSet.name,
        rarity,
        twoPieceEffect: artifactSet.effect2Pc,
        fourPieceEffect: artifactSet.effect4Pc ?? null,
        flowerIconUrl,
        featherIconUrl,
        sandsIconUrl,
        gobletIconUrl,
        circletIconUrl,
      },
      update: {
        rarity,
        twoPieceEffect: artifactSet.effect2Pc,
        fourPieceEffect: artifactSet.effect4Pc ?? null,
        flowerIconUrl,
        featherIconUrl,
        sandsIconUrl,
        gobletIconUrl,
        circletIconUrl,
      },
    });
    await seedArtifactSetTwoPieceBonus(dbArtifactSet.id, artifactSet.name, artifactSet.effect2Pc, statTypeIds);
    count++;
  }

  console.log(`Seeded ${count} artifact sets (skipped ${skipped} single-piece or low-rarity sets)`);
}

// Same idea and sourcing as seedCharacterLevelStats -- weapons have no
// hp/defense, just attack and their secondary stat's value. Unlike
// characters' ascensionStatValue, there's no universal per-weapon baseline
// to subtract (verified directly against genshin-db: a level-1 weapon's
// `specialized` starts at its own real low value, e.g. ~13% for a Crit
// Rate weapon, not offset by some fixed 5%/50%/100% the way Crit Rate/Crit
// DMG/Energy Recharge are for characters) -- but it's still a raw fraction
// needing the same percent rescale as everything else in this schema (see
// ASCENSION_STAT_BASELINE's comment for the general convention).
async function seedWeaponLevelStats(weaponId: number, statFn: genshindb.StatFunction, secondaryStatName: StatTypeName | undefined) {
  const isPercentStat = secondaryStatName?.endsWith("%") ?? false;
  const rows = [];
  for (let level = 1; level <= 90; level++) {
    const flags: ("-" | "+")[] = ASCENSION_BREAKPOINTS.includes(level) ? ["-", "+"] : ["-"];
    for (const flag of flags) {
      const result = statFn(level, flag);
      const specialized = result.specialized ?? 0;
      rows.push({
        weaponId,
        level: result.level,
        ascensionPhase: result.ascension,
        attack: result.attack ?? 0,
        secondaryStatValue: isPercentStat ? specialized * 100 : specialized,
      });
    }
  }

  await prisma.weaponLevelStat.deleteMany({ where: { weaponId } });
  await prisma.weaponLevelStat.createMany({ data: rows });
}

// One-off, hand-verified data quirks in genshin-db's raw text -- e.g.
// Skyward Blade's R2 uses a comma where every other refinement (and every
// other weapon) uses a period ("CRIT Rate increased by 5%, Gains
// Skypiercing Might..." instead of "...5%. Gains..."), merging what should
// be two sentences into one. Caught by seedWeaponStatBonuses's own
// partial-match warning below, not assumed -- fixed narrowly here (both
// for the displayed text and for sentence-splitting) rather than loosening
// sentence-splitting in a way that could misparse other, correctly-
// punctuated descriptions.
const WEAPON_TEXT_FIXES: Record<string, (text: string) => string> = {
  "Skyward Blade": (text) => text.replace("increased by 5%, Gains", "increased by 5%. Gains"),
};

function getRefinementDescription(weapon: genshindb.Weapon, refinement: 1 | 2 | 3 | 4 | 5): string | undefined {
  const description = weapon[`r${refinement}`]?.description;
  if (!description) return description;
  const fix = WEAPON_TEXT_FIXES[weapon.name];
  return fix ? fix(description) : description;
}

// genshin-db's own pre-rendered passive description per refinement -- no
// templating needed on our side. Some weapons (typically very low rarity,
// already excluded by MIN_WEAPON_RARITY) have no refinements at all.
async function seedWeaponRefinementEffects(weaponId: number, weapon: genshindb.Weapon) {
  const refinements = [1, 2, 3, 4, 5] as const;
  const rows: { weaponId: number; refinement: number; description: string }[] = [];
  for (const refinement of refinements) {
    const description = getRefinementDescription(weapon, refinement);
    if (!description) continue;
    rows.push({ weaponId, refinement, description });
  }

  await prisma.weaponRefinementEffect.deleteMany({ where: { weaponId } });
  if (rows.length > 0) await prisma.weaponRefinementEffect.createMany({ data: rows });
}

// Same problem as ArtifactSetStatBonus -- genshin-db gives weapon passive
// and constellation text as plain prose, no structured breakdown (see
// WeaponRefinementEffect above). Unlike artifact 2pc effects (almost
// always one clean sentence), both of these are usually COMPOUND: an
// unconditional stat bonus in one sentence (e.g. Absolution's "CRIT DMG
// increased by 20%."), followed by one or more conditional/proc sentences
// in the same description. So this parses sentence-by-sentence rather
// than the whole text at once, and only extracts a bonus when a single
// sentence's captured stat text is an EXACT match against a short, known
// vocabulary of stat phrases -- checked directly against all ~230
// weapons' and all 750 seeded constellations' actual text before relying
// on this: that exact-match requirement is what correctly rejects a long
// conditional/scaling clause without needing to separately detect every
// conditional phrasing. For example Redhorn Stonethresher's "Normal and
// Charged Attack DMG is increased by 40% of DEF." doesn't match at all
// (the trailing "of DEF" breaks the pattern), Akuoumaru's "For every point
// of the entire party's combined maximum Energy capacity, the Elemental
// Burst DMG ... is increased by 0.12%." matches the regex shape but
// captures that whole clause as the "stat text," which isn't equal to any
// known stat name, and -- the single most common near-miss among
// constellations -- "Increases the Level of <Talent> by 3." (C3/C5's
// universal talent-level-up mechanic, not a stat bonus at all) never
// matches a real stat name either. All of these are correctly skipped
// rather than misread. Constellations turned out to almost never grant an
// unconditional bonus to the character's own general stats at all -- of
// all 750 seeded, only one survived this check for real: Traveler
// (Anemo)'s C2, a flat +16% Energy Recharge with no conditions attached.
const PROSE_STAT_TEXT_TO_STAT_TYPE: Record<string, StatTypeName> = {
  ATK: "ATK%",
  DEF: "DEF%",
  HP: "HP%",
  "CRIT Rate": "Crit Rate%",
  "CRIT DMG": "Crit DMG%",
  "Energy Recharge": "Energy Recharge%",
  "Physical DMG": "Physical DMG Bonus%",
  "Healing Bonus": "Healing Bonus%",
  "Elemental Mastery": "Elemental Mastery",
  "Pyro DMG Bonus": "Pyro DMG Bonus%",
  "Hydro DMG Bonus": "Hydro DMG Bonus%",
  "Electro DMG Bonus": "Electro DMG Bonus%",
  "Cryo DMG Bonus": "Cryo DMG Bonus%",
  "Anemo DMG Bonus": "Anemo DMG Bonus%",
  "Geo DMG Bonus": "Geo DMG Bonus%",
  "Dendro DMG Bonus": "Dendro DMG Bonus%",
};

// Tried per sentence, in order -- the phrasings actually seen across all
// seeded weapons' refinement text, most commonly "<Stat> is increased by
// N%." / "<Stat> increased by N%." (more common here than the "<Stat>
// +N%." style that dominated artifact 2pc effects).
function parseStatBonusSentence(sentence: string): { statText: string; value: number } | null {
  const isIncreasedMatch = sentence.match(/^(.+?) is increased by (\d+(?:\.\d+)?)%\.?$/);
  if (isIncreasedMatch) return { statText: isIncreasedMatch[1].trim(), value: Number(isIncreasedMatch[2]) };

  const increasedMatch = sentence.match(/^(.+?) increased by (\d+(?:\.\d+)?)%\.?$/);
  if (increasedMatch) return { statText: increasedMatch[1].trim(), value: Number(increasedMatch[2]) };

  const increasesMatch = sentence.match(/^Increases (.+?) by (\d+(?:\.\d+)?)%?\.?$/);
  if (increasesMatch) return { statText: increasesMatch[1].trim(), value: Number(increasesMatch[2]) };

  const suffixMatch = sentence.match(/^(.+?)\s*\+(\d+(?:\.\d+)?)%\.?$/);
  if (suffixMatch) return { statText: suffixMatch[1].trim(), value: Number(suffixMatch[2]) };

  const gainMatch = sentence.match(/^Gain (?:a |an )?(\d+(?:\.\d+)?)% (.+?)\.?$/);
  if (gainMatch) return { statText: gainMatch[2].trim(), value: Number(gainMatch[1]) };

  return null;
}

// Splits on a period followed by whitespace (or end of string) -- good
// enough for these short, simply-punctuated descriptions; there's no
// abbreviation-style text in this domain to trip it up.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function seedWeaponStatBonuses(weaponId: number, weaponName: string, weapon: genshindb.Weapon, statTypeIds: Map<StatTypeName, number>) {
  await prisma.weaponStatBonus.deleteMany({ where: { weaponId } });

  const refinements = [1, 2, 3, 4, 5] as const;
  const rows: { weaponId: number; statTypeId: number; refinement: number; value: number }[] = [];
  for (const refinement of refinements) {
    const description = getRefinementDescription(weapon, refinement);
    if (!description) continue;

    for (const sentence of splitSentences(description)) {
      const parsed = parseStatBonusSentence(sentence);
      if (!parsed) continue;
      const statTypeName = PROSE_STAT_TEXT_TO_STAT_TYPE[parsed.statText];
      const statTypeId = statTypeName ? statTypeIds.get(statTypeName) : undefined;
      if (!statTypeId) continue;
      rows.push({ weaponId, statTypeId, refinement, value: parsed.value });
      break; // first qualifying sentence per refinement -- every weapon seen so far has at most one
    }
  }

  if (rows.length === 0) return;
  // A weapon matching on only some refinements would mean either a
  // genshin-db data gap or a bug in this parser -- every refinement of the
  // same weapon shares the same sentence structure, just different
  // numbers, so a real match should appear on all 5.
  if (rows.length !== refinements.length) {
    console.warn(`"${weaponName}" only matched a stat bonus on ${rows.length}/${refinements.length} refinements -- check manually`);
  }
  await prisma.weaponStatBonus.createMany({ data: rows });
}

// Same parser as seedWeaponStatBonuses, applied to a constellation's own
// (single, level-less) description instead of 5 refinement variants -- see
// the comment above PROSE_STAT_TEXT_TO_STAT_TYPE for why constellations
// almost never actually produce a row here.
async function seedConstellationStatBonuses(
  constellationId: number,
  description: string,
  statTypeIds: Map<StatTypeName, number>
) {
  await prisma.constellationStatBonus.deleteMany({ where: { constellationId } });

  for (const sentence of splitSentences(description)) {
    const parsed = parseStatBonusSentence(sentence);
    if (!parsed) continue;
    const statTypeName = PROSE_STAT_TEXT_TO_STAT_TYPE[parsed.statText];
    const statTypeId = statTypeName ? statTypeIds.get(statTypeName) : undefined;
    if (!statTypeId) continue;
    await prisma.constellationStatBonus.create({ data: { constellationId, statTypeId, value: parsed.value } });
    return; // first qualifying sentence -- every constellation seen so far has at most one
  }
}

async function seedWeapons(statTypeIds: Map<StatTypeName, number>) {
  const weapons = genshindb.weapons("names", {
    matchCategories: true,
    verboseCategories: true,
  });

  let count = 0;
  let skipped = 0;
  for (const weapon of weapons) {
    if (weapon.rarity < MIN_WEAPON_RARITY || EXCLUDED_WEAPON_NAMES.has(weapon.name)) {
      skipped++;
      continue;
    }

    const weaponType = WEAPON_TYPE_MAP[weapon.weaponType];
    if (!weaponType) {
      console.warn(`Skipping weapon "${weapon.name}": unmapped weaponType (${weapon.weaponType})`);
      continue;
    }

    const secondaryStatName = weapon.mainStatType ? FIGHT_PROP_TO_STAT_TYPE[weapon.mainStatType] : undefined;
    const secondaryStatId = secondaryStatName ? statTypeIds.get(secondaryStatName) ?? null : null;

    // Low-rarity weapons have no passive at all. Per-refinement passive
    // text is seeded separately into WeaponRefinementEffect -- see
    // seedWeaponRefinementEffects.
    const passiveName = weapon.effectName ?? null;
    const iconUrl = enkaIconUrl(weapon.images.filename_icon);

    const dbWeapon = await prisma.weapon.upsert({
      where: { name: weapon.name },
      create: { name: weapon.name, weaponType, rarity: weapon.rarity, secondaryStatId, passiveName, iconUrl },
      update: { weaponType, rarity: weapon.rarity, secondaryStatId, passiveName, iconUrl },
    });
    await seedWeaponLevelStats(dbWeapon.id, weapon.stats, secondaryStatName);
    await seedWeaponRefinementEffects(dbWeapon.id, weapon);
    await seedWeaponStatBonuses(dbWeapon.id, weapon.name, weapon, statTypeIds);
    count++;
  }

  console.log(`Seeded ${count} weapons (with level stats/refinement effects, skipped ${skipped} below ${MIN_WEAPON_RARITY}★)`);
}

async function main() {
  const statTypeIds = await seedStatTypes();
  await seedCharacters(statTypeIds);
  await seedArtifactSets(statTypeIds);
  await seedWeapons(statTypeIds);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
