import type { Metadata } from "next";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { WeaponCatalog } from "./weapon-catalog";
import type { WeaponCatalogItem } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Weapon",
};

const HELP_TEXT = `Browse every weapon in the game. Pick a refinement and add a copy to your owned weapons. You can add the same weapon more than once.`;

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

  const weapons = await prisma.weapon.findMany({ orderBy: { name: "asc" }, include: { secondaryStat: true } });

  const catalog: WeaponCatalogItem[] = weapons.map((weapon) => ({
    id: weapon.id,
    name: weapon.name,
    weaponType: weapon.weaponType,
    rarity: weapon.rarity,
    secondaryStatName: weapon.secondaryStat?.name ?? null,
    iconUrl: weapon.iconUrl,
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
