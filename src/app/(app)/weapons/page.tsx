import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { WeaponManager } from "./weapon-manager";
import type { WeaponCatalogItem, OwnedWeaponItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Weapons",
};

export default async function WeaponsPage() {
  const profile = await requireActiveProfile();

  const [weapons, ownedWeapons] = await Promise.all([
    prisma.weapon.findMany({ orderBy: { name: "asc" }, include: { secondaryStat: true } }),
    prisma.ownedWeapon.findMany({
      where: { gameProfileId: profile.id },
      orderBy: { createdAt: "asc" },
      include: { weapon: { include: { secondaryStat: true } } },
    }),
  ]);

  const catalog: WeaponCatalogItem[] = weapons.map((weapon) => ({
    id: weapon.id,
    name: weapon.name,
    weaponType: weapon.weaponType,
    rarity: weapon.rarity,
    secondaryStatName: weapon.secondaryStat?.name ?? null,
    iconUrl: weapon.iconUrl,
  }));

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
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Weapons</h1>
        <p className="text-sm text-gray-500">Managing weapons for {profile.name}</p>
      </div>
      <WeaponManager initialOwnedWeapons={owned} catalog={catalog} />
    </div>
  );
}
