"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import type { OwnedWeaponItem } from "./filter-sort";
import { UpdateWeaponProgressionInputSchema, type UpdateWeaponProgressionErrors } from "./schemas";

export type AddWeaponResult = { weapon: OwnedWeaponItem } | { errors: UpdateWeaponProgressionErrors };

// Takes the full (level, ascensionPhase, refinement) triple now, not just
// refinement -- a freshly-added weapon used to always start at the
// OwnedWeapon schema's own level 1/phase 0 defaults; the catalog now adds
// at a representative default state instead (see
// defaultWeaponProgression in @/lib/weapon-scaling), or whatever the user
// customized via the "add with details" modal. Same validation path as
// updateWeaponProgression -- never trust client input, even though the
// quick-add button's own values are always correct by construction.
export async function addWeapon(
  weaponId: number,
  input: { level: number; ascensionPhase: number; refinement: number }
): Promise<AddWeaponResult> {
  const profile = await requireActiveProfile();

  const validated = UpdateWeaponProgressionInputSchema.safeParse(input);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const weapon = await prisma.weapon.findUniqueOrThrow({ where: { id: weaponId }, select: { maxRefinement: true } });
  if (validated.data.refinement > weapon.maxRefinement) {
    return { errors: { refinement: [`This weapon can only be refined up to R${weapon.maxRefinement}.`] } };
  }

  const created = await prisma.ownedWeapon.create({
    data: { gameProfileId: profile.id, weaponId, ...validated.data },
    include: { weapon: { include: { secondaryStat: true } } },
  });

  return {
    weapon: {
      id: created.id,
      weaponId: created.weaponId,
      name: created.weapon.name,
      weaponType: created.weapon.weaponType,
      rarity: created.weapon.rarity,
      secondaryStatName: created.weapon.secondaryStat?.name ?? null,
      iconUrl: created.weapon.iconUrl,
      splashUrl: created.weapon.splashUrl,
      refinement: created.refinement,
      level: created.level,
      ascensionPhase: created.ascensionPhase,
    },
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
    },
  });

  return {
    passiveName: weapon.passiveName,
    rarity: weapon.rarity,
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
