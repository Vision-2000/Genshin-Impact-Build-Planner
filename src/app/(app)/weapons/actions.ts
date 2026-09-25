"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { OwnedWeaponItem } from "./filter-sort";
import {
  UpdateWeaponProgressionInputSchema,
  MIN_REFINEMENT,
  MAX_REFINEMENT,
  type UpdateWeaponProgressionErrors,
} from "./schemas";

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

export type WeaponProgressionData = {
  passiveName: string | null;
  rarity: number;
  baseAttack: number;
  attackTier: number | null;
  attackCurveRarity: number | null;
  baseSecondaryStatValue: number | null;
  refinementEffects: { refinement: number; description: string }[];
  statBonusesByRefinement: { refinement: number; statTypeName: string; value: number }[];
};

// Everything the progression editor needs beyond the OwnedWeaponItem it
// already has (name/rarity/secondaryStatName/etc, from the main owned-list
// query) -- base/tier stat data (the actual ATK/secondary value at any
// level/phase is computed client-side via @/lib/weapon-scaling, not looked
// up) and per-refinement passive text/stat bonus. Fetched lazily when the
// editor opens, same reasoning as getCharacterProgressionData.
export async function getWeaponProgressionData(weaponId: number): Promise<WeaponProgressionData> {
  const weapon = await prisma.weapon.findUniqueOrThrow({
    where: { id: weaponId },
    include: {
      refinementEffects: { orderBy: { refinement: "asc" } },
      statBonuses: { include: { statType: true }, orderBy: { refinement: "asc" } },
    },
  });

  return {
    passiveName: weapon.passiveName,
    rarity: weapon.rarity,
    baseAttack: weapon.baseAttack ?? 0,
    attackTier: weapon.attackTier,
    attackCurveRarity: weapon.attackCurveRarity,
    baseSecondaryStatValue: weapon.baseSecondaryStatValue,
    refinementEffects: weapon.refinementEffects.map((r) => ({ refinement: r.refinement, description: r.description })),
    statBonusesByRefinement: weapon.statBonuses.map((b) => ({
      refinement: b.refinement,
      statTypeName: b.statType.name,
      value: b.value,
    })),
  };
}

export type UpdateWeaponProgressionResult = { ok: true } | { errors: UpdateWeaponProgressionErrors };

export async function updateWeaponProgression(
  ownedWeaponId: number,
  input: { level: number; ascensionPhase: number; refinement: number }
): Promise<UpdateWeaponProgressionResult> {
  const profile = await requireActiveProfile();

  const validated = UpdateWeaponProgressionInputSchema.safeParse(input);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await prisma.ownedWeapon.updateMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
    data: validated.data,
  });
  return { ok: true };
}

export async function removeWeapon(ownedWeaponId: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedWeapon.deleteMany({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
  });
}
