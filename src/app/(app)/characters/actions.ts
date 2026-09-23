"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { TalentSlot } from "@/generated/prisma/enums";
import {
  createUpdateCharacterProgressionSchema,
  computeTalentLevelBounds,
  type UpdateCharacterProgressionInput,
  type UpdateCharacterProgressionErrors,
} from "./schemas";

export async function setCharacterOwnership(characterId: number, isOwned: boolean) {
  const profile = await requireActiveProfile();

  await prisma.ownedCharacter.upsert({
    where: { gameProfileId_characterId: { gameProfileId: profile.id, characterId } },
    create: { gameProfileId: profile.id, characterId, isOwned },
    update: { isOwned },
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

export type CharacterProgressionData = {
  ascensionStatName: string | null;
  levelStats: { level: number; ascensionPhase: number; hp: number; attack: number; defense: number; ascensionStatValue: number }[];
  talents: {
    id: number;
    slot: TalentSlot;
    name: string;
    description: string;
    iconUrl: string | null;
    attributes: { label: string; formatCode: string; values: number[] }[];
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
// boosts already fetched by getCharacterConstellationBoosts -- base stat
// lookup table, full talent data (all slots, including non-leveled
// passives), and constellation name/description/icon/stat-bonus. Fetched
// lazily when the editor opens, same reasoning as getCharacterConstellationBoosts.
export async function getCharacterProgressionData(characterId: number): Promise<CharacterProgressionData> {
  const character = await prisma.character.findUniqueOrThrow({
    where: { id: characterId },
    include: {
      ascensionStat: true,
      levelStats: true,
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
    levelStats: character.levelStats.map((s) => ({
      level: s.level,
      ascensionPhase: s.ascensionPhase,
      hp: s.hp,
      attack: s.attack,
      defense: s.defense,
      ascensionStatValue: s.ascensionStatValue,
    })),
    talents: character.talents.map((t) => ({
      id: t.id,
      slot: t.slot,
      name: t.name,
      description: t.description,
      iconUrl: t.iconUrl,
      attributes: t.attributes.map((a) => ({ label: a.label, formatCode: a.formatCode, values: a.values })),
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

  await prisma.ownedCharacter.updateMany({
    where: { gameProfileId: profile.id, characterId },
    data: validated.data,
  });
  return { ok: true };
}
