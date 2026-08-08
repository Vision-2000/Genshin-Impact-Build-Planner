"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";

export async function setCharacterOwnership(characterId: number, isOwned: boolean) {
  const profile = await requireActiveProfile();

  await prisma.ownedCharacter.upsert({
    where: { gameProfileId_characterId: { gameProfileId: profile.id, characterId } },
    create: { gameProfileId: profile.id, characterId, isOwned },
    update: { isOwned },
  });
}
