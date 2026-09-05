import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { OwnedWeaponManager } from "./owned-weapon-manager";
import type { OwnedWeaponItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Weapons",
};

const HELP_TEXT = `This page shows the weapons you currently own. Search by name, or use the badges below to filter by weapon type or rarity -- click a badge to toggle it on, and combine as many as you like.

Change a weapon's refinement with its dropdown, or remove it entirely.

To add a new weapon, use the "Add weapon" button -- it opens the full weapon catalog on its own page.`;

export default async function WeaponsPage() {
  const profile = await requireActiveProfile();

  const ownedWeapons = await prisma.ownedWeapon.findMany({
    where: { gameProfileId: profile.id },
    orderBy: { createdAt: "asc" },
    include: { weapon: { include: { secondaryStat: true } } },
  });

  const owned: OwnedWeaponItem[] = ownedWeapons.map((ownedWeapon) => ({
    id: ownedWeapon.id,
    weaponId: ownedWeapon.weaponId,
    name: ownedWeapon.weapon.name,
    weaponType: ownedWeapon.weapon.weaponType,
    rarity: ownedWeapon.weapon.rarity,
    secondaryStatName: ownedWeapon.weapon.secondaryStat?.name ?? null,
    iconUrl: ownedWeapon.weapon.iconUrl,
    refinement: ownedWeapon.refinement,
  }));

  return (
    <div className="mx-auto max-w-[90rem] space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Weapons</h1>
            <HelpButton title="Weapons page help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500">Managing weapons for {profile.name}</p>
        </div>
        <Link href="/weapons/add" className="rounded bg-black px-3 py-2 text-sm text-white">
          Add weapon
        </Link>
      </div>
      <OwnedWeaponManager initialOwnedWeapons={owned} />
    </div>
  );
}
