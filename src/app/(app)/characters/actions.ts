"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { Element, TalentSlot } from "@/generated/prisma/enums";
import { characterScalingRarity, travelerGenderGroup } from "@/lib/character-scaling";
import {
  createUpdateCharacterProgressionSchema,
  computeTalentLevelBounds,
  type UpdateCharacterProgressionInput,
  type UpdateCharacterProgressionErrors,
} from "./schemas";

// Every other elemental form of the same Traveler protagonist (by shared
// name prefix, see travelerGenderGroup) -- level, ascension phase, and
// ownership move together across all of them; null for a non-Traveler,
// where nothing needs to move beyond the one character itself.
async function travelerSiblingIds(characterId: number): Promise<number[] | null> {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId }, select: { name: true } });
  const genderGroup = travelerGenderGroup(character.name);
  if (!genderGroup) return null;

  const siblings = await prisma.character.findMany({
    where: { name: { startsWith: `${genderGroup} ` } },
    select: { id: true },
  });
  return siblings.map((c) => c.id);
}

export async function setCharacterOwnership(characterId: number, isOwned: boolean) {
  const profile = await requireActiveProfile();
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId }, select: { name: true } });
  const genderGroup = travelerGenderGroup(character.name);

  let characterIds = [characterId];
  let otherGenderIds: number[] = [];

  if (genderGroup) {
    const travelers = await prisma.character.findMany({
      where: { name: { startsWith: "Traveler (" } },
      select: { id: true, name: true },
    });
    characterIds = travelers.filter((c) => c.name.startsWith(`${genderGroup} `)).map((c) => c.id);
    otherGenderIds = travelers.filter((c) => !c.name.startsWith(`${genderGroup} `)).map((c) => c.id);
  }

  await prisma.$transaction([
    // Only one Traveler gender can ever be owned at a time -- owning this
    // one un-owns the other. A plain ownership flip, same as un-owning any
    // other character: builds just hide, nothing is deleted or migrated.
    ...(isOwned && otherGenderIds.length > 0
      ? [
          prisma.ownedCharacter.updateMany({
            where: { gameProfileId: profile.id, characterId: { in: otherGenderIds } },
            data: { isOwned: false },
          }),
        ]
      : []),
    // There's only one protagonist per gender -- owning any one elemental
    // form means owning all 7 (the others just start at level 1/phase 0,
    // same as any other fresh ownership toggle).
    ...characterIds.map((id) =>
      prisma.ownedCharacter.upsert({
        where: { gameProfileId_characterId: { gameProfileId: profile.id, characterId: id } },
        create: { gameProfileId: profile.id, characterId: id, isOwned },
        update: { isOwned },
      })
    ),
  ]);
}

// The editor's element picker needs every elemental form of a Traveler to
// render a badge for -- null for a non-Traveler, where there's nothing to
// pick between. Master data only (id/element/name); the owned-side numbers
// for whichever one gets picked come from getOwnedCharacterProgression
// below, fetched only on an actual switch.
export async function getTravelerElementSiblings(
  characterId: number
): Promise<{ id: number; element: Element; name: string }[] | null> {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId }, select: { name: true } });
  const genderGroup = travelerGenderGroup(character.name);
  if (!genderGroup) return null;

  return prisma.character.findMany({
    where: { name: { startsWith: `${genderGroup} ` } },
    select: { id: true, element: true, name: true },
    orderBy: { element: "asc" },
  });
}

export type OwnedCharacterProgressionSnapshot = {
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
};

// Fetched when the editor's element picker switches to a different
// elemental form -- level/ascensionPhase are shared across all of them
// already (see setCharacterOwnership/updateCharacterProgression), so the
// editor just keeps its current in-progress value for those rather than
// re-fetching; only constellation and the 3 talent levels are genuinely
// per-element and need a fresh read.
export async function getOwnedCharacterProgression(characterId: number): Promise<OwnedCharacterProgressionSnapshot> {
  const profile = await requireActiveProfile();
  return prisma.ownedCharacter.findUniqueOrThrow({
    where: { gameProfileId_characterId: { gameProfileId: profile.id, characterId } },
    select: { constellation: true, normalAttackLevel: true, skillLevel: true, burstLevel: true },
  });
}

export type CharacterConstellationBoost = { number: number; boostedTalentSlot: TalentSlot | null };

// Lazily fetched by the progression editor when it opens, rather than
// bundled into the main roster query for every character up front -- only
// the character currently being edited needs this.
export async function getCharacterConstellationBoosts(characterId: number): Promise<CharacterConstellationBoost[]> {
  return prisma.constellation.findMany({
    where: { characterId },
    select: { number: true, boostedTalentSlot: true },
    orderBy: { number: "asc" },
  });
}

export type TalentAttributeCurveData = {
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

export type CharacterProgressionData = {
  ascensionStatName: string | null;
  // The rarity to use for stat-scaling formulas specifically -- always the
  // character's own stored rarity, except Traveler (stored as 5 for
  // banner/catalog purposes, but actually scales as 4-star). See
  // characterScalingRarity in @/lib/character-scaling.
  scalingRarity: number;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  maxAscensionHp: number;
  maxAscensionAttack: number;
  maxAscensionDefense: number;
  // Flat, always-on EM floor outside the ascension system -- 0 for nearly
  // every character. See Character.baseElementalMastery in schema.prisma.
  baseElementalMastery: number;
  talents: {
    id: number;
    slot: TalentSlot;
    name: string;
    description: string;
    iconUrl: string | null;
    attributes: TalentAttributeCurveData[];
    statBonuses: { statTypeName: string; value: number }[];
  }[];
  constellations: {
    number: number;
    name: string;
    description: string;
    iconUrl: string | null;
    boostedTalentSlot: TalentSlot | null;
    statBonuses: { statTypeName: string; value: number }[];
  }[];
};

// Everything the detailed progression editor needs beyond the constellation
// boosts already fetched by getCharacterConstellationBoosts -- base/max-
// ascension stat values (the actual number at any level/phase is computed
// client-side via @/lib/character-scaling, not looked up), full talent data
// (all slots, including non-leveled passives, each attribute's compact
// curve representation instead of 15 raw values -- see
// @/lib/talent-scaling), and constellation name/description/icon/stat-
// bonus. Fetched lazily when the editor opens, same reasoning as
// getCharacterConstellationBoosts.
export async function getCharacterProgressionData(characterId: number): Promise<CharacterProgressionData> {
  const character = await prisma.character.findUniqueOrThrow({
    where: { id: characterId },
    include: {
      ascensionStat: true,
      // Postgres native enums (what Prisma maps TalentSlot to) sort by
      // declaration order, not alphabetically -- so this naturally comes
      // back NormalAttack, Skill, Burst, Passive1..4, matching schema.prisma.
      talents: {
        orderBy: { slot: "asc" },
        include: {
          attributes: { orderBy: { order: "asc" } },
          statBonuses: { include: { statType: true } },
        },
      },
      constellations: {
        orderBy: { number: "asc" },
        include: { statBonuses: { include: { statType: true } } },
      },
    },
  });

  return {
    ascensionStatName: character.ascensionStat?.name ?? null,
    scalingRarity: characterScalingRarity(character.name, character.rarity),
    baseHp: character.baseHp ?? 0,
    baseAttack: character.baseAttack ?? 0,
    baseDefense: character.baseDefense ?? 0,
    maxAscensionHp: character.maxAscensionHp ?? 0,
    maxAscensionAttack: character.maxAscensionAttack ?? 0,
    maxAscensionDefense: character.maxAscensionDefense ?? 0,
    baseElementalMastery: character.baseElementalMastery,
    talents: character.talents.map((t) => ({
      id: t.id,
      slot: t.slot,
      name: t.name,
      description: t.description,
      iconUrl: t.iconUrl,
      attributes: t.attributes.map((a) => ({
        label: a.label,
        formatCode: a.formatCode,
        curveType: a.curveType,
        baseValue: a.baseValue,
        linearSlope: a.linearSlope,
        capLevel: a.capLevel,
        customValues: a.customValues,
        order: a.order,
        hitCount: a.hitCount,
        prefix: a.prefix,
        suffix: a.suffix,
      })),
      statBonuses: t.statBonuses.map((b) => ({ statTypeName: b.statType.name, value: b.value })),
    })),
    constellations: character.constellations.map((c) => ({
      number: c.number,
      name: c.name,
      description: c.description,
      iconUrl: c.iconUrl,
      boostedTalentSlot: c.boostedTalentSlot,
      statBonuses: c.statBonuses.map((b) => ({ statTypeName: b.statType.name, value: b.value })),
    })),
  };
}

export type UpdateCharacterProgressionResult = { ok: true } | { errors: UpdateCharacterProgressionErrors };

export async function updateCharacterProgression(
  characterId: number,
  input: UpdateCharacterProgressionInput
): Promise<UpdateCharacterProgressionResult> {
  const profile = await requireActiveProfile();

  // Talent-level bounds depend on the submitted constellation count, so the
  // validation schema is built fresh per request rather than being a fixed
  // constant -- and always recomputed from the character's own seeded
  // constellation data server-side, never trusting client-computed bounds.
  const constellations = await getCharacterConstellationBoosts(characterId);
  const talentLevelBounds = computeTalentLevelBounds(input.constellation, constellations);

  const validated = createUpdateCharacterProgressionSchema(talentLevelBounds).safeParse(input);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const siblingIds = await travelerSiblingIds(characterId);
  if (siblingIds) {
    // Level/ascension belong to the protagonist as a whole -- every
    // elemental form moves together. Constellation and the 3 talent
    // levels stay per-element (each element has its own kit), so those
    // only ever apply to the character actually being edited.
    const { level, ascensionPhase, ...perElementFields } = validated.data;
    await prisma.$transaction([
      prisma.ownedCharacter.updateMany({
        where: { gameProfileId: profile.id, characterId: { in: siblingIds } },
        data: { level, ascensionPhase },
      }),
      prisma.ownedCharacter.updateMany({
        where: { gameProfileId: profile.id, characterId },
        data: perElementFields,
      }),
    ]);
  } else {
    await prisma.ownedCharacter.updateMany({
      where: { gameProfileId: profile.id, characterId },
      data: validated.data,
    });
  }
  return { ok: true };
}
