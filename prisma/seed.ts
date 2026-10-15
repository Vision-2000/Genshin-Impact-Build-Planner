// Running this script directly (npx tsx prisma/seed.ts) doesn't go through
// Prisma CLI, which is what normally loads .env via prisma.config.ts's own
// "dotenv/config" import -- src/lib/prisma.ts reads process.env.DATABASE_URL
// directly with no loading of its own, relying on Next.js's built-in .env
// handling in the app itself. Without this import here, DATABASE_URL is
// undefined for a standalone run, surfacing as a confusing SASL/password
// error from the Postgres driver rather than a clear "env var missing" one.
import "dotenv/config";
import fs from "fs";
import path from "path";
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

// ---------------------------------------------------------------------------
// This script no longer talks to genshin-db (or any live data source) at
// all. The 4 JSON files in data-source/ ARE the master data -- a separate
// Claude session maintains them against Lunaris/Project Amber/HoYoWiki for
// each game update (see CLAUDE.md's Key decisions and
// data-source/master-data-formulas.txt), and this script's only job is to
// import them into Postgres faithfully, with no re-derivation of anything.
// That session marks a genuinely new row's `id` (and every id field that
// points at it) "UNKNOWN", since it has no way to know what the DB will
// assign; resolveId() below is the one place that distinction matters.
// ---------------------------------------------------------------------------

type JsonId = number | "UNKNOWN";

function readJson<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data-source", fileName), "utf-8"));
}

// A real number when the external session already knows this row's id
// (every pre-existing row); undefined for a brand-new row it marked
// "UNKNOWN" -- passing `id: undefined` to a Prisma create() is treated as
// "not specified," which is exactly what we want: let the column's own
// `@default(autoincrement())` assign a fresh one (verified directly, not
// assumed -- an explicit id and an omitted one coexist fine in the same
// createMany call).
function resolveId(raw: JsonId): number | undefined {
  return raw === "UNKNOWN" ? undefined : raw;
}

// Only tables we insert explicit ids into (every table below) need this --
// an explicit id from this patch's "UNKNOWN" rows could otherwise be lower
// than a LATER autoincrement-assigned id from a row inserted earlier in
// this same run, or collide with one on the next run entirely.
const TABLES_WITH_EXPLICIT_IDS = [
  "stat_types",
  "characters",
  "talents",
  "talent_attributes",
  "talent_stat_bonuses",
  "constellations",
  "constellation_stat_bonuses",
  "weapons",
  "weapon_refinement_effects",
  "weapon_refinement_values",
  "weapon_stat_bonuses",
  "artifact_sets",
  "artifact_set_stat_bonuses",
] as const;

async function resetSequences() {
  for (const table of TABLES_WITH_EXPLICIT_IDS) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
    );
  }
}

// ---------------------------------------------------------------------------
// JSON shapes -- deliberately loose (the external session's own tooling is
// what validates these in depth, per data-source/master-data-formulas.txt);
// this is just enough typing to catch a renamed/missing field at compile time.
// ---------------------------------------------------------------------------

type StatTypeJson = { id: JsonId; name: string };
type StatTypeRefJson = { id: number; name: string };

type TalentAttributeJson = {
  id: JsonId;
  label: string;
  formatCode: string;
  curveType: string;
  baseValue: number;
  linearSlope: number | null;
  capLevel: number | null;
  customValues: number[];
  order: number;
  hitCount: number;
  prefix: string | null;
  suffix: string | null;
};

type StatBonusJson = { id: JsonId; value: number; statType: StatTypeRefJson };

type TalentJson = {
  id: JsonId;
  slot: string;
  name: string;
  description: string;
  iconUrl: string | null;
  attributes: TalentAttributeJson[];
  statBonuses: StatBonusJson[];
};

type ConstellationJson = {
  id: JsonId;
  number: number;
  name: string;
  description: string;
  iconUrl: string | null;
  boostedTalentSlot: string | null;
  statBonuses: StatBonusJson[];
};

type CharacterJson = {
  id: JsonId;
  name: string;
  element: string;
  weaponType: string;
  rarity: number;
  exclusivityGroup: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
  baseHp: number | null;
  baseAttack: number | null;
  baseDefense: number | null;
  maxAscensionHp: number | null;
  maxAscensionAttack: number | null;
  maxAscensionDefense: number | null;
  baseElementalMastery: number;
  ascensionStat: StatTypeRefJson | null;
  talents: TalentJson[];
  constellations: ConstellationJson[];
};

type WeaponRefinementEffectJson = { id: JsonId; refinement: number; description: string };
type WeaponRefinementValueJson = {
  id: JsonId;
  slotIndex: number;
  curveType: string;
  baseValue: number;
  slope: number | null;
  customValues: number[];
};
type WeaponStatBonusJson = {
  id: JsonId;
  curveType: string;
  baseValue: number;
  slope: number | null;
  customValues: number[];
  statType: StatTypeRefJson;
};

type WeaponJson = {
  id: JsonId;
  name: string;
  weaponType: string;
  rarity: number;
  passiveName: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
  attackTier: number | null;
  baseSecondaryStatValue: number | null;
  attackCurveRarity: number | null;
  maxRefinement: number;
  passiveDescriptionTemplate: string | null;
  secondaryStat: StatTypeRefJson | null;
  refinementEffects: WeaponRefinementEffectJson[];
  refinementValues: WeaponRefinementValueJson[];
  statBonuses: WeaponStatBonusJson[];
};

type ArtifactSetStatBonusJson = { id: JsonId; piece: string; value: number; statType: StatTypeRefJson };

type ArtifactSetJson = {
  id: JsonId;
  name: string;
  rarity: number;
  twoPieceEffect: string;
  fourPieceEffect: string | null;
  flowerIconUrl: string | null;
  featherIconUrl: string | null;
  sandsIconUrl: string | null;
  gobletIconUrl: string | null;
  circletIconUrl: string | null;
  statBonuses: ArtifactSetStatBonusJson[];
};

// ---------------------------------------------------------------------------

// StatType is small and stable enough that upsert-by-id (not wipe-and-
// recreate) is safe and simplest -- same reasoning as Character/Weapon/
// ArtifactSet below, just with no children of its own.
async function seedStatTypes(statTypes: StatTypeJson[]): Promise<Map<string, number>> {
  const idByName = new Map<string, number>();
  for (const st of statTypes) {
    const id = resolveId(st.id);
    const row =
      id !== undefined
        ? await prisma.statType.upsert({ where: { id }, create: { id, name: st.name }, update: { name: st.name } })
        : await prisma.statType.create({ data: { name: st.name } });
    idByName.set(st.name, row.id);
  }
  console.log(`Seeded ${idByName.size} stat types`);
  return idByName;
}

// Talent/Constellation (and everything under them) are wiped and recreated
// fresh per character on every run -- safe because nothing in owned-data
// references them by id (OwnedCharacter's talent levels and constellation
// count are plain integers, not foreign keys into these tables; see
// CLAUDE.md). This is also what correctly handles a row the JSON removed
// (e.g. a talent restructured away) without any extra "diff" logic: the
// JSON's current shape is simply the only truth that survives each run.
async function seedTalents(characterId: number, talents: TalentJson[], statTypeIdByName: Map<string, number>) {
  await prisma.talent.deleteMany({ where: { characterId } });

  for (const t of talents) {
    const dbTalent = await prisma.talent.create({
      data: {
        id: resolveId(t.id),
        characterId,
        slot: t.slot as TalentSlot,
        name: t.name,
        description: t.description,
        iconUrl: t.iconUrl,
      },
    });

    if (t.attributes.length > 0) {
      await prisma.talentAttribute.createMany({
        data: t.attributes.map((a) => ({
          id: resolveId(a.id),
          talentId: dbTalent.id,
          label: a.label,
          formatCode: a.formatCode,
          curveType: a.curveType as TalentCurveType,
          baseValue: a.baseValue,
          linearSlope: a.linearSlope,
          capLevel: a.capLevel,
          customValues: a.customValues,
          order: a.order,
          hitCount: a.hitCount,
          prefix: a.prefix,
          suffix: a.suffix,
        })),
      });
    }

    if (t.statBonuses.length > 0) {
      await prisma.talentStatBonus.createMany({
        data: t.statBonuses.map((sb) => ({
          id: resolveId(sb.id),
          talentId: dbTalent.id,
          statTypeId: statTypeIdByName.get(sb.statType.name)!,
          value: sb.value,
        })),
      });
    }
  }
}

async function seedConstellations(
  characterId: number,
  constellations: ConstellationJson[],
  statTypeIdByName: Map<string, number>
) {
  await prisma.constellation.deleteMany({ where: { characterId } });

  for (const c of constellations) {
    const dbConstellation = await prisma.constellation.create({
      data: {
        id: resolveId(c.id),
        characterId,
        number: c.number,
        name: c.name,
        description: c.description,
        iconUrl: c.iconUrl,
        boostedTalentSlot: c.boostedTalentSlot as TalentSlot | null,
      },
    });

    if (c.statBonuses.length > 0) {
      await prisma.constellationStatBonus.createMany({
        data: c.statBonuses.map((sb) => ({
          id: resolveId(sb.id),
          constellationId: dbConstellation.id,
          statTypeId: statTypeIdByName.get(sb.statType.name)!,
          value: sb.value,
        })),
      });
    }
  }
}

// Character (like Weapon/ArtifactSet below) is upserted by id, never wiped
// -- OwnedCharacter.characterId is a real foreign key with no cascade, so
// deleting and recreating this row would either fail outright (if anyone
// owns it) or silently orphan their progression. Matching by id rather
// than by name is what correctly handles the Traveler gender split: the
// 7 existing "Traveler (Element)" rows were simply RENAMED to
// "Traveler (Female) (Element)" by the external session, same id -- a
// name-keyed upsert would have missed that match and created 7 duplicates
// instead. The 7 new "Traveler (Male) (Element)" rows are brand new
// (id "UNKNOWN") and fall through to plain create.
async function seedCharacter(character: CharacterJson, statTypeIdByName: Map<string, number>) {
  const ascensionStatId = character.ascensionStat ? statTypeIdByName.get(character.ascensionStat.name) ?? null : null;
  const data = {
    name: character.name,
    element: character.element as Element,
    weaponType: character.weaponType as WeaponType,
    rarity: character.rarity,
    exclusivityGroup: character.exclusivityGroup,
    ascensionStatId,
    iconUrl: character.iconUrl,
    splashUrl: character.splashUrl,
    baseHp: character.baseHp,
    baseAttack: character.baseAttack,
    baseDefense: character.baseDefense,
    maxAscensionHp: character.maxAscensionHp,
    maxAscensionAttack: character.maxAscensionAttack,
    maxAscensionDefense: character.maxAscensionDefense,
    baseElementalMastery: character.baseElementalMastery,
  };

  const id = resolveId(character.id);
  const dbCharacter =
    id !== undefined
      ? await prisma.character.upsert({ where: { id }, create: { id, ...data }, update: data })
      : await prisma.character.create({ data });

  await seedTalents(dbCharacter.id, character.talents, statTypeIdByName);
  await seedConstellations(dbCharacter.id, character.constellations, statTypeIdByName);
}

// Same upsert-by-id reasoning as Character -- OwnedWeapon.weaponId has no
// cascade either.
async function seedWeapon(weapon: WeaponJson, statTypeIdByName: Map<string, number>) {
  const secondaryStatId = weapon.secondaryStat ? statTypeIdByName.get(weapon.secondaryStat.name) ?? null : null;
  const data = {
    name: weapon.name,
    weaponType: weapon.weaponType as WeaponType,
    rarity: weapon.rarity,
    secondaryStatId,
    passiveName: weapon.passiveName,
    iconUrl: weapon.iconUrl,
    splashUrl: weapon.splashUrl,
    attackTier: weapon.attackTier,
    baseSecondaryStatValue: weapon.baseSecondaryStatValue,
    attackCurveRarity: weapon.attackCurveRarity,
    maxRefinement: weapon.maxRefinement,
    passiveDescriptionTemplate: weapon.passiveDescriptionTemplate,
  };

  const id = resolveId(weapon.id);
  const dbWeapon =
    id !== undefined
      ? await prisma.weapon.upsert({ where: { id }, create: { id, ...data }, update: data })
      : await prisma.weapon.create({ data });

  // Refinement text/values and stat bonuses are wiped and recreated fresh
  // per weapon, same reasoning as Talent/Constellation above -- OwnedWeapon
  // only stores a plain refinement number, never a foreign key into these.
  await prisma.weaponRefinementEffect.deleteMany({ where: { weaponId: dbWeapon.id } });
  if (weapon.refinementEffects.length > 0) {
    await prisma.weaponRefinementEffect.createMany({
      data: weapon.refinementEffects.map((r) => ({
        id: resolveId(r.id),
        weaponId: dbWeapon.id,
        refinement: r.refinement,
        description: r.description,
      })),
    });
  }

  await prisma.weaponRefinementValue.deleteMany({ where: { weaponId: dbWeapon.id } });
  if (weapon.refinementValues.length > 0) {
    await prisma.weaponRefinementValue.createMany({
      data: weapon.refinementValues.map((v) => ({
        id: resolveId(v.id),
        weaponId: dbWeapon.id,
        slotIndex: v.slotIndex,
        curveType: v.curveType as WeaponRefinementCurveType,
        baseValue: v.baseValue,
        slope: v.slope,
        customValues: v.customValues,
      })),
    });
  }

  await prisma.weaponStatBonus.deleteMany({ where: { weaponId: dbWeapon.id } });
  if (weapon.statBonuses.length > 0) {
    await prisma.weaponStatBonus.createMany({
      data: weapon.statBonuses.map((sb) => ({
        id: resolveId(sb.id),
        weaponId: dbWeapon.id,
        statTypeId: statTypeIdByName.get(sb.statType.name)!,
        curveType: sb.curveType as WeaponStatBonusCurveType,
        baseValue: sb.baseValue,
        slope: sb.slope,
        customValues: sb.customValues,
      })),
    });
  }
}

// Same upsert-by-id reasoning again -- OwnedArtifact.artifactSetId has no
// cascade either.
async function seedArtifactSet(artifactSet: ArtifactSetJson, statTypeIdByName: Map<string, number>) {
  const data = {
    name: artifactSet.name,
    rarity: artifactSet.rarity,
    twoPieceEffect: artifactSet.twoPieceEffect,
    fourPieceEffect: artifactSet.fourPieceEffect,
    flowerIconUrl: artifactSet.flowerIconUrl,
    featherIconUrl: artifactSet.featherIconUrl,
    sandsIconUrl: artifactSet.sandsIconUrl,
    gobletIconUrl: artifactSet.gobletIconUrl,
    circletIconUrl: artifactSet.circletIconUrl,
  };

  const id = resolveId(artifactSet.id);
  const dbArtifactSet =
    id !== undefined
      ? await prisma.artifactSet.upsert({ where: { id }, create: { id, ...data }, update: data })
      : await prisma.artifactSet.create({ data });

  await prisma.artifactSetStatBonus.deleteMany({ where: { artifactSetId: dbArtifactSet.id } });
  if (artifactSet.statBonuses.length > 0) {
    await prisma.artifactSetStatBonus.createMany({
      data: artifactSet.statBonuses.map((sb) => ({
        id: resolveId(sb.id),
        artifactSetId: dbArtifactSet.id,
        piece: sb.piece as ArtifactSetPiece,
        statTypeId: statTypeIdByName.get(sb.statType.name)!,
        value: sb.value,
      })),
    });
  }
}

async function main() {
  const statTypes = readJson<StatTypeJson[]>("stat-types.json");
  const characters = readJson<CharacterJson[]>("characters.json");
  const weapons = readJson<WeaponJson[]>("weapons.json");
  const artifactSets = readJson<ArtifactSetJson[]>("artifact-sets.json");

  const statTypeIdByName = await seedStatTypes(statTypes);

  for (const character of characters) await seedCharacter(character, statTypeIdByName);
  console.log(`Seeded ${characters.length} characters`);

  for (const weapon of weapons) await seedWeapon(weapon, statTypeIdByName);
  console.log(`Seeded ${weapons.length} weapons`);

  for (const artifactSet of artifactSets) await seedArtifactSet(artifactSet, statTypeIdByName);
  console.log(`Seeded ${artifactSets.length} artifact sets`);

  await resetSequences();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
