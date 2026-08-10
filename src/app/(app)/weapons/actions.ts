"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { OwnedWeaponItem } from "./filter-sort";

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
  };
}

export async function updateWeaponRefinement(ownedWeaponId: number, refinement: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedWeapon.updateMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
    data: { refinement: clampRefinement(refinement) },
  });
}

export async function removeWeapon(ownedWeaponId: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedWeapon.deleteMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
  });
}
