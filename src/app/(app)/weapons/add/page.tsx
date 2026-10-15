import type { Metadata } from "next";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { computeWeaponAttack, computeWeaponSecondaryStat, defaultWeaponProgression } from "@/lib/weapon-scaling";
import { renderWeaponPassiveDescription, type WeaponRefinementCurveType } from "@/lib/weapon-refinement-scaling";
import { roundHalfUp } from "@/lib/round";
import { WeaponCatalog } from "./weapon-catalog";
import type { WeaponCatalogItem, WeaponHoverDetail } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Weapon",
};

const HELP_TEXT = `Browse every weapon in the game. Hover a card to see its stats and passive at level 90/R1 (its default), click Add to add it as-is, or click anywhere else on the card to customize the level/refinement before adding. You can add the same weapon more than once.`;

// Exact stats/passive at this weapon's own defaultWeaponProgression()
// state -- computed once here rather than shipped as raw curve data for
// the client to recompute, since the hover card always shows this same
// fixed state regardless of what the user does with it (see
// WeaponHoverDetail's own comment). No stat-bonus computation here --
// the hover tooltip deliberately doesn't show it (see that comment too),
// so there's nothing to compute it for.
function computeHoverDetail(weapon: {
  name: string;
  rarity: number;
  attackTier: number | null;
  attackCurveRarity: number | null;
  baseSecondaryStatValue: number | null;
  secondaryStat: { name: string } | null;
  passiveName: string | null;
  passiveDescriptionTemplate: string | null;
  refinementValues: { slotIndex: number; curveType: string; baseValue: number; slope: number | null; customValues: number[] }[];
  refinementEffects: { refinement: number; description: string }[];
}): WeaponHoverDetail {
  const { level, ascensionPhase, refinement } = defaultWeaponProgression(weapon.name);

  const attack =
    weapon.attackTier === null
      ? 0
      : roundHalfUp(
          computeWeaponAttack(weapon.attackTier, weapon.rarity, level, ascensionPhase, weapon.attackCurveRarity ?? undefined),
          0
        );
  const secondaryStatValue =
    weapon.secondaryStat && weapon.baseSecondaryStatValue !== null
      ? computeWeaponSecondaryStat(weapon.baseSecondaryStatValue, level)
      : null;

  const passiveDescription = weapon.passiveDescriptionTemplate
    ? renderWeaponPassiveDescription(
        weapon.passiveDescriptionTemplate,
        weapon.refinementValues.map((v) => ({ ...v, curveType: v.curveType as WeaponRefinementCurveType })),
        refinement
      )
    : (weapon.refinementEffects.find((e) => e.refinement === refinement)?.description ?? null);

  return { attack, secondaryStatValue, passiveName: weapon.passiveName, passiveDescription };
}

export default async function AddWeaponPage({
  searchParams,
}: {
  searchParams: Promise<{ weaponType?: string }>;
}) {
  const profile = await requireActiveProfile();
  const { weaponType } = await searchParams;
  // Only trust the query param if it's a real WeaponType -- e.g. a build's
  // "add weapon" link pre-filters to the character's weapon type.
  const initialWeaponType = (Object.values(WeaponType) as string[]).includes(weaponType ?? "")
    ? (weaponType as WeaponType)
    : undefined;

  const weapons = await prisma.weapon.findMany({
    orderBy: { name: "asc" },
    include: {
      secondaryStat: true,
      refinementEffects: { orderBy: { refinement: "asc" } },
      refinementValues: { orderBy: { slotIndex: "asc" } },
    },
  });

  const catalog: WeaponCatalogItem[] = weapons.map((weapon) => ({
    id: weapon.id,
    name: weapon.name,
    weaponType: weapon.weaponType,
    rarity: weapon.rarity,
    secondaryStatName: weapon.secondaryStat?.name ?? null,
    iconUrl: weapon.iconUrl,
    maxRefinement: weapon.maxRefinement,
    hoverDetail: computeHoverDetail({
      name: weapon.name,
      rarity: weapon.rarity,
      attackTier: weapon.attackTier,
      attackCurveRarity: weapon.attackCurveRarity,
      baseSecondaryStatValue: weapon.baseSecondaryStatValue,
      secondaryStat: weapon.secondaryStat,
      passiveName: weapon.passiveName,
      passiveDescriptionTemplate: weapon.passiveDescriptionTemplate,
      refinementValues: weapon.refinementValues,
      refinementEffects: weapon.refinementEffects,
    }),
  }));

  return (
    <div className="min-h-full bg-secondary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Add a weapon</h1>
            <HelpButton title="Add weapon help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-300">Adding weapons for {profile.name}</p>
        </div>
        <Link
          href="/weapons"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          ← Back to my weapons
        </Link>
      </div>
      <WeaponCatalog catalog={catalog} initialWeaponType={initialWeaponType} />
      </div>
    </div>
  );
}
