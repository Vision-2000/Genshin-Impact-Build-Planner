import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { slotIconUrl } from "../artifacts/filter-sort";
import { OwnedBuildManager } from "./owned-build-manager";
import { toBuildItem, type OwnedWeaponOption, type OwnedArtifactOption } from "./filter-sort";

export const metadata: Metadata = {
  title: "Builds",
};

const HELP_TEXT = `This page shows the builds you've assembled for your owned characters. Click a card to rename it or change its weapon/artifacts; delete removes it (and pulls it out of any team or roster it's in).`;

export default async function BuildsPage() {
  const profile = await requireActiveProfile();

  const [ownedWeapons, ownedArtifacts, builds] = await Promise.all([
    prisma.ownedWeapon.findMany({
      where: { gameProfileId: profile.id },
      include: { weapon: true },
      orderBy: { weapon: { name: "asc" } },
    }),
    prisma.ownedArtifact.findMany({
      where: { gameProfileId: profile.id },
      include: { artifactSet: true, mainStat: true, substats: { include: { statType: true } } },
      orderBy: { artifactSet: { name: "asc" } },
    }),
    prisma.build.findMany({
      where: { ownedCharacter: { gameProfileId: profile.id, isOwned: true } },
      include: {
        ownedCharacter: { include: { character: true } },
        ownedWeapon: { include: { weapon: true } },
        buildArtifacts: { include: { ownedArtifact: { include: { artifactSet: true, mainStat: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const weaponOptions: OwnedWeaponOption[] = ownedWeapons.map((owned) => ({
    ownedWeaponId: owned.id,
    name: owned.weapon.name,
    iconUrl: owned.weapon.iconUrl,
    weaponType: owned.weapon.weaponType,
    refinement: owned.refinement,
    rarity: owned.weapon.rarity,
  }));

  const artifactOptions: OwnedArtifactOption[] = ownedArtifacts.map((owned) => ({
    ownedArtifactId: owned.id,
    slot: owned.slot,
    setName: owned.artifactSet.name,
    mainStatName: owned.mainStat.name,
    iconUrl: slotIconUrl(owned.artifactSet, owned.slot),
    rarity: owned.artifactSet.rarity,
    level: owned.level,
    substats: owned.substats.map((s) => ({ statTypeName: s.statType.name, value: s.value })),
  }));

  const buildItems = builds.map(toBuildItem);

  return (
    <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Builds</h1>
            <HelpButton title="Builds page help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500">Managing builds for {profile.name}</p>
        </div>
        <Link
          href="/builds/add"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          <span className="text-base leading-none">+</span> Add build
        </Link>
      </div>
      <OwnedBuildManager weapons={weaponOptions} artifacts={artifactOptions} initialBuilds={buildItems} />
    </div>
  );
}
