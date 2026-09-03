import * as genshindb from "genshin-db";
import { prisma } from "../src/lib/prisma";
import { Element, WeaponType } from "../src/generated/prisma/enums";

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

async function seedCharacters() {
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

    await prisma.character.upsert({
      where: { name: character.name },
      create: {
        name: character.name,
        element,
        weaponType,
        rarity: character.rarity,
        exclusivityGroup: null,
        iconUrl,
      },
      update: { element, weaponType, rarity: character.rarity, iconUrl },
    });
    count++;
  }

  // All 6 visions share Lumine's icon: genshin-db has no per-vision icon
  // breakdown, and the base Traveler icon doesn't actually change with
  // element in-game.
  const lumine = genshindb.characters("Lumine", { verboseCategories: true });
  const travelerIconUrl = enkaIconUrl(lumine?.images.filename_icon);

  for (const element of TRAVELER_VISIONS) {
    const name = `Traveler (${element})`;
    await prisma.character.upsert({
      where: { name },
      create: {
        name,
        element,
        weaponType: WeaponType.Sword,
        rarity: 5,
        exclusivityGroup: TRAVELER_EXCLUSIVITY_GROUP,
        iconUrl: travelerIconUrl,
      },
      update: {
        element,
        weaponType: WeaponType.Sword,
        rarity: 5,
        exclusivityGroup: TRAVELER_EXCLUSIVITY_GROUP,
        iconUrl: travelerIconUrl,
      },
    });
    count++;
  }

  console.log(`Seeded ${count} characters`);
}

async function seedArtifactSets() {
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
    if (Math.max(...artifactSet.rarityList) < MIN_ARTIFACT_SET_RARITY) {
      skipped++;
      continue;
    }

    const flowerIconUrl = enkaIconUrl(artifactSet.images.filename_flower);
    const featherIconUrl = enkaIconUrl(artifactSet.images.filename_plume);
    const sandsIconUrl = enkaIconUrl(artifactSet.images.filename_sands);
    const gobletIconUrl = enkaIconUrl(artifactSet.images.filename_goblet);
    const circletIconUrl = enkaIconUrl(artifactSet.images.filename_circlet);

    await prisma.artifactSet.upsert({
      where: { name: artifactSet.name },
      create: {
        name: artifactSet.name,
        twoPieceEffect: artifactSet.effect2Pc,
        fourPieceEffect: artifactSet.effect4Pc ?? null,
        flowerIconUrl,
        featherIconUrl,
        sandsIconUrl,
        gobletIconUrl,
        circletIconUrl,
      },
      update: {
        twoPieceEffect: artifactSet.effect2Pc,
        fourPieceEffect: artifactSet.effect4Pc ?? null,
        flowerIconUrl,
        featherIconUrl,
        sandsIconUrl,
        gobletIconUrl,
        circletIconUrl,
      },
    });
    count++;
  }

  console.log(`Seeded ${count} artifact sets (skipped ${skipped} single-piece or low-rarity sets)`);
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

    const secondaryStatId = weapon.mainStatType
      ? statTypeIds.get(FIGHT_PROP_TO_STAT_TYPE[weapon.mainStatType]) ?? null
      : null;

    // R1 refinement text is used as the reference passive description;
    // low-rarity weapons have no passive at all.
    const passiveText = weapon.r1?.description ?? null;
    const iconUrl = enkaIconUrl(weapon.images.filename_icon);

    await prisma.weapon.upsert({
      where: { name: weapon.name },
      create: { name: weapon.name, weaponType, rarity: weapon.rarity, secondaryStatId, passiveText, iconUrl },
      update: { weaponType, rarity: weapon.rarity, secondaryStatId, passiveText, iconUrl },
    });
    count++;
  }

  console.log(`Seeded ${count} weapons (skipped ${skipped} below ${MIN_WEAPON_RARITY}★)`);
}

async function main() {
  const statTypeIds = await seedStatTypes();
  await seedCharacters();
  await seedArtifactSets();
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
