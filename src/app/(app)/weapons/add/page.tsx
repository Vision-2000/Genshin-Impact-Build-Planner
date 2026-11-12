import type { Metadata } from "next";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { defaultWeaponProgression } from "@/lib/weapon-scaling";
import { computeWeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { WeaponCatalog } from "./weapon-catalog";
import type { WeaponCatalogItem } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Weapon",
};

const HELP_TEXT = `Browse every weapon in the game. Hover a card to see its stats and passive at level 90/R1 (its default), click Add to add it as-is, or click anywhere else on the card to customize the level/refinement before adding. You can add the same weapon more than once.`;

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

  const catalog: WeaponCatalogItem[] = weapons.map((weapon) => {
    const { level, ascensionPhase, refinement } = defaultWeaponProgression(weapon.name);
    return {
      id: weapon.id,
      name: weapon.name,
      weaponType: weapon.weaponType,
      rarity: weapon.rarity,
      secondaryStatName: weapon.secondaryStat?.name ?? null,
      iconUrl: weapon.iconUrl,
      splashUrl: weapon.splashUrl,
      maxRefinement: weapon.maxRefinement,
      hoverDetail: computeWeaponHoverDetail(weapon, level, ascensionPhase, refinement),
    };
  });

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
          {/* leading-none on BOTH the arrow and the text -- same
              flex-sibling line-height-mismatch fix as owned-build-manager.tsx's
              own "Create build" comment. */}
          <span className="leading-none">←</span>
          <span className="leading-none">Back to my weapons</span>
        </Link>
      </div>
      <WeaponCatalog catalog={catalog} initialWeaponType={initialWeaponType} />
      </div>
    </div>
  );
}
