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
import {
  Element,
  WeaponType,
  TalentSlot,
  ArtifactSetPiece,
  TalentCurveType,
  WeaponRefinementCurveType,
  WeaponStatBonusCurveType,
} from "../src/generated/prisma/enums";
import { characterLevelMultiplier } from "../src/lib/character-scaling";
import { WEAPON_ATTACK_TIER_BASE } from "../src/lib/weapon-scaling";
import { classifyTalentAttributeCurve } from "../src/lib/talent-scaling";
import { buildWeaponPassiveTemplate, classifyWeaponValueCurve } from "../src/lib/weapon-refinement-scaling";

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
  "Incoming Healing Bonus%",
  "Cooldown Reduction%",
  "Shield Strength%",
  "Physical DMG Bonus%",
  "Pyro DMG Bonus%",
  "Hydro DMG Bonus%",
  "Electro DMG Bonus%",
  "Cryo DMG Bonus%",
  "Anemo DMG Bonus%",
  "Geo DMG Bonus%",
  "Dendro DMG Bonus%",
  // RES%: the full wiki-listed vocabulary, kept for master-data completeness
  // (a character's own detail screen always shows all 8, defaulting to a
  // flat 10% each with no gear ever raising it -- see genshin-db's own
  // FIGHT_PROP enums, which never expose RES as a weapon secondary stat, an
  // artifact main/substat, or a character ascension stat). No StatBonus rows
  // reference these yet: verified directly against every 2pc effect and
  // every constellation/refinement exact-match stat phrase already seeded
  // (see PROSE_STAT_TEXT_TO_STAT_TYPE / TWO_PIECE_STAT_TEXT_TO_STAT_TYPE
  // below) -- none of them ever grant a RES/Shield Strength/Cooldown
  // Reduction/Incoming Healing Bonus bonus, so there's nothing to wire up
  // yet, just the vocabulary for whenever the Final Stats display (build
  // order step 8) needs to show these baseline categories.
  "Physical RES%",
  "Pyro RES%",
  "Hydro RES%",
  "Electro RES%",
  "Cryo RES%",
  "Anemo RES%",
  "Geo RES%",
  "Dendro RES%",
] as const;
// Stamina (the wiki's other "Basic Stat") is deliberately excluded: it's a
// global player resource raised only by world exploration (Oculi), never by
// a character/weapon/artifact/talent/constellation, so no owned-inventory
// row could ever reference it.

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

// A handful of characters have a flat, always-on Elemental Mastery floor
// entirely outside the normal ascension system -- confirmed on the wiki
// (https://genshin-impact.fandom.com/wiki/Attribute, see
// data-export/Stat_type_report.txt): "Elemental Mastery starts at 0 for
// most playable characters, excluding Lauma and Nefer whose Elemental
// Mastery begin at 200 and 100 respectively." Not present anywhere in
// genshin-db's data (confirmed directly against both characters' raw
// object and stats() output), so hardcoded here rather than sourced --
// same reasoning as the exceptions already handled in character-scaling.ts
// (Traveler) and weapon-scaling.ts (Sword of Descension). Default is 0 for
// every character not listed.
const CHARACTER_BASE_ELEMENTAL_MASTERY: Record<string, number> = {
  Lauma: 200,
  Nefer: 100,
};

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

// Replaces the old per-(level, ascension phase) sampling loop: base values
// come straight from genshin-db's own level-1 sample, and each stat's max
// ascension bonus is back-solved from the level-90/phase-6 sample (where
// the ascension multiplier is exactly 1.0, see src/lib/character-scaling.ts)
// rather than storing all 96 sampled points. scalingRarity is the rarity to
// use for the level-multiplier curve specifically -- always the same as the
// character's own stored rarity, except Traveler (see its call site).
async function seedCharacterBaseStats(characterId: number, statFn: genshindb.StatFunction, scalingRarity: number) {
  const level1 = statFn(1, "-");
  const level90 = statFn(90, "+");
  const mult90 = characterLevelMultiplier(scalingRarity, 90);

  const baseHp = level1.hp ?? 0;
  const baseAttack = level1.attack ?? 0;
  const baseDefense = level1.defense ?? 0;

  await prisma.character.update({
    where: { id: characterId },
    data: {
      baseHp,
      baseAttack,
      baseDefense,
      maxAscensionHp: (level90.hp ?? 0) - baseHp * mult90,
      maxAscensionAttack: (level90.attack ?? 0) - baseAttack * mult90,
      maxAscensionDefense: (level90.defense ?? 0) - baseDefense * mult90,
    },
  });
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
  const rows: {
    talentId: number;
    label: string;
    formatCode: string;
    curveType: TalentCurveType;
    baseValue: number;
    linearSlope: number | null;
    capLevel: number | null;
    customValues: number[];
    order: number;
  }[] = [];
  let order = 0;
  for (const rawLabel of attributes.labels) {
    for (const { name, paramKey, formatCode } of parseAttributeLabel(rawLabel)) {
      const values = attributes.parameters[paramKey];
      if (!values) continue;
      // Classifies genshin-db's own 15 raw per-level values into the
      // compact curve representation -- see src/lib/talent-scaling.ts.
      // Verified as an exact round-trip (0 mismatches across all 43,200
      // values in all 2880 previously-seeded attributes) before this
      // replaced storing the raw array directly.
      const curve = classifyTalentAttributeCurve(values);
      rows.push({
        talentId,
        label: name,
        formatCode,
        curveType: curve.curveType as TalentCurveType,
        baseValue: curve.baseValue,
        linearSlope: curve.linearSlope,
        capLevel: curve.capLevel,
        customValues: curve.customValues ?? [],
        order: order++,
      });
    }
  }

  // Delete-and-recreate: wholly seed-owned data, never user-edited.
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
    const baseElementalMastery = CHARACTER_BASE_ELEMENTAL_MASTERY[character.name] ?? 0;

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
        baseElementalMastery,
      },
      update: { element, weaponType, rarity: character.rarity, ascensionStatId, iconUrl, baseElementalMastery },
    });
    await seedCharacterBaseStats(dbCharacter.id, character.stats, character.rarity);
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
    // Traveler is a documented exception: stored as rarity 5 (correct for
    // banner/catalog purposes), but its actual stat GROWTH follows the
    // 4-star curve entirely, since it's a free character -- verified
    // directly, see character-scaling.ts's own comment.
    await seedCharacterBaseStats(dbCharacter.id, lumine.stats, 4);
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
// outside this app's tracked final-stats list (e.g. Elemental Skill/Burst/
// Normal/Charged/Plunging Attack DMG Bonus% -- not in scope, see CLAUDE.md's
// Key decisions on calculation scope). A phrase naming more than one stat at
// once (Tiny Miracle's "All Elemental RES") is handled separately via
// MULTI_STAT_TEXT_TO_STAT_TYPES below, producing one row per named stat.
// RES%/Shield Strength% themselves ARE tracked StatTypes
// (Lavawalker/Thundersoother/Retracing Bolide's single-element/single-stat
// 2pc effects resolve fine), even though nothing sums them into a
// final-stats total yet.

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
  "Physical RES": "Physical RES%",
  "Pyro RES": "Pyro RES%",
  "Hydro RES": "Hydro RES%",
  "Electro RES": "Electro RES%",
  "Cryo RES": "Cryo RES%",
  "Anemo RES": "Anemo RES%",
  "Geo RES": "Geo RES%",
  "Dendro RES": "Dendro RES%",
  "Shield Strength": "Shield Strength%",
};

// A handful of phrases name a whole category rather than one stat -- e.g.
// Tiny Miracle's 2pc "All Elemental RES increased by 20%." grants all 7
// elemental RES stats at once (never Physical), which needs 7 rows instead
// of the 1 every other phrase produces. Checked directly: this is the only
// such phrase across all currently-seeded 2pc effects.
const MULTI_STAT_TEXT_TO_STAT_TYPES: Record<string, StatTypeName[]> = {
  "All Elemental RES": [
    "Pyro RES%",
    "Hydro RES%",
    "Electro RES%",
    "Cryo RES%",
    "Anemo RES%",
    "Geo RES%",
    "Dendro RES%",
  ],
};

// Tried in order -- matches the 6 phrasings actually seen across all 56
// currently-seeded 2pc effects (verified directly, not assumed):
// "<Stat> +N%.", "Gain a N% <Stat>.", "Increases <Stat> by N[%].",
// "<Stat> is increased by N%." (Pale Flame is the only current set phrased
// this way -- everything else granting a DMG% bonus uses "<Stat> +N%.",
// e.g. Bloodstained Chivalry's otherwise-identical Physical DMG bonus), and
// "<Stat> increased by N%." (Lavawalker/Thundersoother's RES bonuses --
// same as the "is increased by" phrasing minus the "is").
function parseTwoPieceEffect(text: string): { statText: string; value: number } | null {
  const suffixMatch = text.match(/^(.+?)\s*\+(\d+(?:\.\d+)?)%\.?$/);
  if (suffixMatch) return { statText: suffixMatch[1].trim(), value: Number(suffixMatch[2]) };

  const gainMatch = text.match(/^Gain a (\d+(?:\.\d+)?)% (.+?)\.?$/);
  if (gainMatch) return { statText: gainMatch[2].trim(), value: Number(gainMatch[1]) };

  const increasesMatch = text.match(/^Increases (.+?) by (\d+(?:\.\d+)?)%?\.?$/);
  if (increasesMatch) return { statText: increasesMatch[1].trim(), value: Number(increasesMatch[2]) };

  const isIncreasedMatch = text.match(/^(.+?) is increased by (\d+(?:\.\d+)?)%\.?$/);
  if (isIncreasedMatch) return { statText: isIncreasedMatch[1].trim(), value: Number(isIncreasedMatch[2]) };

  const increasedMatch = text.match(/^(.+?) increased by (\d+(?:\.\d+)?)%\.?$/);
  if (increasedMatch) return { statText: increasedMatch[1].trim(), value: Number(increasedMatch[2]) };

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

  const multiStatNames = MULTI_STAT_TEXT_TO_STAT_TYPES[parsed.statText];
  if (multiStatNames) {
    await prisma.artifactSetStatBonus.createMany({
      data: multiStatNames.map((name) => ({
        artifactSetId,
        piece: ArtifactSetPiece.Two,
        statTypeId: statTypeIds.get(name)!,
        value: parsed.value,
      })),
    });
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
// Replaces the old per-(level, ascension phase) sampling loop. Base ATK
// comes from genshin-db's own level-1 sample; which shared tier it uses is
// resolved by matching that base value against WEAPON_ATTACK_TIER_BASE --
// tried within the weapon's own rarity first (true for all but one weapon),
// falling back to searching every rarity for Sword of Descension's own
// documented exception (a real, player-obtainable PS-exclusive weapon
// whose base ATK/level curve is drawn from the 3-star tier 2 table despite
// being flagged 4-star everywhere else -- see attackCurveRarity's own
// schema comment). Secondary stat has no ascension component, so its base
// is just the level-1 sample, percent-rescaled the same way as everywhere
// else stat-bonus values are stored in this schema.
async function seedWeaponBaseStats(
  weaponId: number,
  weaponName: string,
  statFn: genshindb.StatFunction,
  rarity: number,
  secondaryStatName: StatTypeName | undefined
) {
  const level1 = statFn(1, "-");
  const baseAttack = level1.attack ?? 0;

  function findTier(searchRarity: number): number | null {
    const tiers = WEAPON_ATTACK_TIER_BASE[searchRarity];
    if (!tiers) return null;
    for (const [tier, base] of Object.entries(tiers)) {
      if (Math.abs(base - baseAttack) < 0.01) return Number(tier);
    }
    return null;
  }

  let attackTier = findTier(rarity);
  let attackCurveRarity: number | null = null;
  if (attackTier === null) {
    for (let searchRarity = 1; searchRarity <= 5; searchRarity++) {
      if (searchRarity === rarity) continue;
      const tier = findTier(searchRarity);
      if (tier !== null) {
        attackTier = tier;
        attackCurveRarity = searchRarity;
        console.warn(
          `"${weaponName}": base ATK ${baseAttack} doesn't match any ${rarity}-star tier -- using ${searchRarity}-star tier ${tier}'s curve instead (attackCurveRarity override)`
        );
        break;
      }
    }
  }
  if (attackTier === null) {
    console.warn(`"${weaponName}": base ATK ${baseAttack} doesn't match any known tier at any rarity -- attackTier left null`);
  }

  const isPercentStat = secondaryStatName?.endsWith("%") ?? false;
  const rawSecondary = level1.specialized ?? 0;
  const baseSecondaryStatValue = secondaryStatName ? (isPercentStat ? rawSecondary * 100 : rawSecondary) : null;

  await prisma.weapon.update({
    where: { id: weaponId },
    data: { attackTier, attackCurveRarity, baseSecondaryStatValue },
  });
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

// How many refinement levels genshin-db actually has text for -- 5 for
// every weapon except a documented few (Kagotsurube Isshin, Predator,
// Sword of Descension) whose source data stops at R1. This is purely a
// data-availability gap, not a real in-game restriction (all 3 are
// normally refinable 1-5 like any other weapon) -- see
// Weapon.maxRefinement's own comment for why capping the app at what we
// actually have text for is still the right call.
function maxKnownRefinement(weapon: genshindb.Weapon): number {
  let highest = 0;
  for (let r = 1; r <= 5; r++) {
    if (getRefinementDescription(weapon, r as 1 | 2 | 3 | 4 | 5)) highest = r;
  }
  return highest > 0 ? highest : 5; // no passive text at all -- refinement is still a real 1-5 axis regardless
}

// Builds the compact template + WeaponRefinementValue rows for a weapon's
// passive (see src/lib/weapon-refinement-scaling.ts), falling back to the
// original per-refinement WeaponRefinementEffect rows for the one weapon
// whose text doesn't reduce to a template at all (a genuine structural
// difference between refinements, not just reworded numbers).
async function seedWeaponPassive(weaponId: number, weapon: genshindb.Weapon) {
  await prisma.weaponRefinementValue.deleteMany({ where: { weaponId } });
  await prisma.weaponRefinementEffect.deleteMany({ where: { weaponId } });

  const maxRefinement = maxKnownRefinement(weapon);
  const descriptions: string[] = [];
  for (let r = 1; r <= maxRefinement; r++) {
    const description = getRefinementDescription(weapon, r as 1 | 2 | 3 | 4 | 5);
    if (description) descriptions.push(description);
  }

  if (descriptions.length === 0) {
    await prisma.weapon.update({ where: { id: weaponId }, data: { maxRefinement, passiveDescriptionTemplate: null } });
    return;
  }

  const built = buildWeaponPassiveTemplate(descriptions);
  await prisma.weapon.update({
    where: { id: weaponId },
    data: { maxRefinement, passiveDescriptionTemplate: built?.template ?? null },
  });

  if (built) {
    if (built.slots.length > 0) {
      await prisma.weaponRefinementValue.createMany({
        data: built.slots.map((slot) => ({
          weaponId,
          slotIndex: slot.slotIndex,
          curveType: slot.curveType === "Linear" ? WeaponRefinementCurveType.Linear : WeaponRefinementCurveType.Custom,
          baseValue: slot.baseValue,
          slope: slot.slope,
          customValues: slot.customValues ?? [],
        })),
      });
    }
  } else {
    // Numeric token count differs between refinements -- a genuine
    // structural exception (currently only Exaiphanes Blade, which gains
    // an entire extra clause starting at R2 that R1 simply doesn't have).
    // Can't template; keep the original per-refinement text instead.
    console.warn(`"${weapon.name}": refinement text isn't templatable (differing numeric token counts) -- keeping raw per-refinement rows`);
    await prisma.weaponRefinementEffect.createMany({
      data: descriptions.map((description, i) => ({ weaponId, refinement: i + 1, description })),
    });
  }
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

// One row per (weapon, statType) rather than per refinement -- same
// base+slope compaction as WeaponRefinementValue (see
// classifyWeaponValueCurve), except Constant is a real stored curveType
// here rather than "no row at all": a stat bonus is a queryable fact
// regardless of whether its value happens to scale.
async function seedWeaponStatBonuses(weaponId: number, weaponName: string, weapon: genshindb.Weapon, statTypeIds: Map<StatTypeName, number>) {
  await prisma.weaponStatBonus.deleteMany({ where: { weaponId } });

  const maxRefinement = maxKnownRefinement(weapon);
  const valuesByStatTypeId = new Map<number, number[]>();
  let refinementsWithAMatch = 0;

  for (let refinement = 1; refinement <= maxRefinement; refinement++) {
    const description = getRefinementDescription(weapon, refinement as 1 | 2 | 3 | 4 | 5);
    if (!description) continue;

    for (const sentence of splitSentences(description)) {
      const parsed = parseStatBonusSentence(sentence);
      if (!parsed) continue;
      const statTypeName = PROSE_STAT_TEXT_TO_STAT_TYPE[parsed.statText];
      const statTypeId = statTypeName ? statTypeIds.get(statTypeName) : undefined;
      if (!statTypeId) continue;
      if (!valuesByStatTypeId.has(statTypeId)) valuesByStatTypeId.set(statTypeId, []);
      valuesByStatTypeId.get(statTypeId)!.push(parsed.value);
      refinementsWithAMatch++;
      break; // first qualifying sentence per refinement -- every weapon seen so far has at most one
    }
  }

  if (valuesByStatTypeId.size === 0) return;
  // A weapon matching on only some refinements would mean either a
  // genshin-db data gap or a bug in this parser -- every known refinement
  // of the same weapon shares the same sentence structure, just different
  // numbers, so a real match should appear on every one of them.
  if (refinementsWithAMatch !== maxRefinement) {
    console.warn(`"${weaponName}" only matched a stat bonus on ${refinementsWithAMatch}/${maxRefinement} refinements -- check manually`);
  }

  await prisma.weaponStatBonus.createMany({
    data: [...valuesByStatTypeId.entries()].map(([statTypeId, values]) => {
      const classified = classifyWeaponValueCurve(values);
      return {
        weaponId,
        statTypeId,
        curveType: WeaponStatBonusCurveType[classified.curveType],
        baseValue: classified.baseValue,
        slope: classified.slope,
        customValues: classified.customValues ?? [],
      };
    }),
  });
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

    // Low-rarity weapons have no passive at all. Passive text is seeded
    // separately into passiveDescriptionTemplate/WeaponRefinementValue --
    // see seedWeaponPassive.
    const passiveName = weapon.effectName ?? null;
    const iconUrl = enkaIconUrl(weapon.images.filename_icon);

    const dbWeapon = await prisma.weapon.upsert({
      where: { name: weapon.name },
      create: { name: weapon.name, weaponType, rarity: weapon.rarity, secondaryStatId, passiveName, iconUrl },
      update: { weaponType, rarity: weapon.rarity, secondaryStatId, passiveName, iconUrl },
    });
    await seedWeaponBaseStats(dbWeapon.id, weapon.name, weapon.stats, weapon.rarity, secondaryStatName);
    await seedWeaponPassive(dbWeapon.id, weapon);
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
