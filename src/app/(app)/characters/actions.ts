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
