"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { OwnedWeaponItem } from "./filter-sort";
import { UpdateWeaponProgressionInputSchema, type UpdateWeaponProgressionErrors } from "./schemas";

const MIN_REFINEMENT = 1;
const MAX_REFINEMENT = 5;

function clampRefinement(refinement: number) {
  return Math.min(MAX_REFINEMENT, Math.max(MIN_REFINEMENT, Math.trunc(refinement)));
}

export async function addWeapon(weaponId: number, refinement: number): Promise<OwnedWeaponItem> {
  const profile = await requireActiveProfile();

  const created = await prisma.ownedWeapon.create({
    data: { gameProfileId: profile.id, weaponId, refinement: clampRefinement(refinement) },
    include: { weapon: { include: { secondaryStat: true } } },
  });

  return {
    id: created.id,
    weaponId: created.weaponId,
    name: created.weapon.name,
    weaponType: created.weapon.weaponType,
    rarity: created.weapon.rarity,
    secondaryStatName: created.weapon.secondaryStat?.name ?? null,
    iconUrl: created.weapon.iconUrl,
    refinement: created.refinement,
    level: created.level,
    ascensionPhase: created.ascensionPhase,
  };
}

export async function updateWeaponRefinement(ownedWeaponId: number, refinement: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedWeapon.updateMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
    data: { refinement: clampRefinement(refinement) },
  });
}

export type UpdateWeaponProgressionResult = { ok: true } | { errors: UpdateWeaponProgressionErrors };

export async function updateWeaponProgression(
  ownedWeaponId: number,
  input: { level: number; ascensionPhase: number }
): Promise<UpdateWeaponProgressionResult> {
  const profile = await requireActiveProfile();

  const validated = UpdateWeaponProgressionInputSchema.safeParse(input);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await prisma.ownedWeapon.updateMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
    data: { level: validated.data.level, ascensionPhase: validated.data.ascensionPhase },
  });
  return { ok: true };
}

export async function removeWeapon(ownedWeaponId: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedWeapon.deleteMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
  });
}
