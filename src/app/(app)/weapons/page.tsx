import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { computeWeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { OwnedWeaponManager } from "./owned-weapon-manager";
import type { OwnedWeaponItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Weapons",
};

const HELP_TEXT = `This page shows the weapons you currently own. Click a card to edit its level, ascension, and refinement, or use the Remove button on the card to delete it.`;

export default async function WeaponsPage() {
  const profile = await requireActiveProfile();

  const ownedWeapons = await prisma.ownedWeapon.findMany({
    where: { gameProfileId: profile.id },
    orderBy: { createdAt: "asc" },
    include: {
      weapon: {
        include: {
          secondaryStat: true,
          refinementEffects: { orderBy: { refinement: "asc" } },
          refinementValues: { orderBy: { slotIndex: "asc" } },
        },
      },
    },
  });

  const owned: OwnedWeaponItem[] = ownedWeapons.map((ownedWeapon) => ({
    id: ownedWeapon.id,
    weaponId: ownedWeapon.weaponId,
    name: ownedWeapon.weapon.name,
    weaponType: ownedWeapon.weapon.weaponType,
    rarity: ownedWeapon.weapon.rarity,
    secondaryStatName: ownedWeapon.weapon.secondaryStat?.name ?? null,
    iconUrl: ownedWeapon.weapon.iconUrl,
    splashUrl: ownedWeapon.weapon.splashUrl,
    refinement: ownedWeapon.refinement,
    level: ownedWeapon.level,
    ascensionPhase: ownedWeapon.ascensionPhase,
    // This copy's own current state, not defaultWeaponProgression() --
    // see OwnedWeaponItem.hoverDetail's own comment.
    hoverDetail: computeWeaponHoverDetail(
      ownedWeapon.weapon,
      ownedWeapon.level,
      ownedWeapon.ascensionPhase,
      ownedWeapon.refinement
    ),
    createdAt: ownedWeapon.createdAt.getTime(),
  }));

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Weapons</h1>
            <HelpButton title="Weapons page help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-300">Managing weapons for {profile.name}</p>
        </div>
        {/* pt-3/pb-2 (not py-2.5) -- same Arial line-height fix as every
            other text-centered control in this app, see
            build-stats-summary.tsx's own comment on the root cause. */}
        <Link
          href="/weapons/add"
          className="flex items-center gap-1.5 rounded-lg border px-4 pb-2 pt-3 text-sm font-semibold hover:bg-black/5"
        >
          {/* "+" and this text are flex siblings at different font
              sizes/line-heights, so items-center centers each
              independently -- mt-0.5/-mt-0.5 nudge the two to meet in
              the middle, see owned-build-manager.tsx's own "Create
              build" comment on why. */}
          <span className="-mt-0.5 text-base leading-none">+</span>
          <span className="mt-0.5">Add weapon</span>
        </Link>
      </div>
      <OwnedWeaponManager initialOwnedWeapons={owned} />
      </div>
    </div>
  );
}
