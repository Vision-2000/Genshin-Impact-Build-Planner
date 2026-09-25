"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { OwnedWeaponItem } from "./filter-sort";
import {
  UpdateWeaponProgressionInputSchema,
  MIN_REFINEMENT,
  type UpdateWeaponProgressionErrors,
} from "./schemas";

// maxRefinement is per-weapon (see Weapon.maxRefinement) -- 5 for almost
// every weapon, but a documented few (see prisma/seed.ts's
// maxKnownRefinement) cap lower, so the ceiling can't be the flat
// MAX_REFINEMENT constant alone.
function clampRefinement(refinement: number, maxRefinement: number) {
  return Math.min(maxRefinement, Math.max(MIN_REFINEMENT, Math.trunc(refinement)));
}

export async function addWeapon(weaponId: number, refinement: number): Promise<OwnedWeaponItem> {
  const profile = await requireActiveProfile();

  const weapon = await prisma.weapon.findUniqueOrThrow({ where: { id: weaponId }, select: { maxRefinement: true } });

  const created = await prisma.ownedWeapon.create({
    data: { gameProfileId: profile.id, weaponId, refinement: clampRefinement(refinement, weapon.maxRefinement) },
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

export type WeaponRefinementValueData = {
  slotIndex: number;
  curveType: string;
  baseValue: number;
  slope: number | null;
  customValues: number[];
};

export type WeaponProgressionData = {
  passiveName: string | null;
  rarity: number;
  baseAttack: number;
  attackTier: number | null;
  attackCurveRarity: number | null;
  baseSecondaryStatValue: number | null;
  // How many refinement levels this weapon actually has passive data for --
  // 5 for almost every weapon, less for a documented few (see
  // Weapon.maxRefinement's schema comment). Caps the progression editor's
  // refinement control.
  maxRefinement: number;
  // The common case: a shared template + the numbers that scale by
  // refinement, rendered via @/lib/weapon-refinement-scaling. Null for
  // weapons with no passive at all, or the one weapon whose text is
  // structurally different between tiers (falls back to
  // refinementEffects below instead).
  passiveDescriptionTemplate: string | null;
  refinementValues: WeaponRefinementValueData[];
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
      refinementValues: { orderBy: { slotIndex: "asc" } },
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
    maxRefinement: weapon.maxRefinement,
    passiveDescriptionTemplate: weapon.passiveDescriptionTemplate,
    refinementValues: weapon.refinementValues.map((v) => ({
      slotIndex: v.slotIndex,
      curveType: v.curveType,
      baseValue: v.baseValue,
      slope: v.slope,
      customValues: v.customValues,
    })),
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

  // MAX_REFINEMENT above is only the universal ceiling -- some weapons cap
  // lower (see Weapon.maxRefinement), so that needs its own check here
  // rather than folding into the static Zod schema, which has no way to
  // know which weapon it's validating for.
  const ownedWeapon = await prisma.ownedWeapon.findFirst({
    where: { id: ownedWeaponId, gameProfileId: profile.id },
    select: { weapon: { select: { maxRefinement: true } } },
  });
  if (ownedWeapon && validated.data.refinement > ownedWeapon.weapon.maxRefinement) {
    return {
      errors: { refinement: [`This weapon can only be refined up to R${ownedWeapon.weapon.maxRefinement}.`] },
    };
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
