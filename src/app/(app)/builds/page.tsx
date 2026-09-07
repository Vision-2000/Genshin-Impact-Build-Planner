import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { slotIconUrl } from "../artifacts/filter-sort";
import { BuildManager } from "./build-manager";
import { toBuildItem, type OwnedCharacterOption, type OwnedWeaponOption, type OwnedArtifactOption } from "./filter-sort";

export const metadata: Metadata = {
  title: "Builds",
};

export default async function BuildsPage() {
  const profile = await requireActiveProfile();

  const [ownedCharacters, ownedWeapons, ownedArtifacts, builds] = await Promise.all([
    prisma.ownedCharacter.findMany({
      where: { gameProfileId: profile.id, isOwned: true },
      include: { character: true },
      orderBy: { character: { name: "asc" } },
    }),
    prisma.ownedWeapon.findMany({
      where: { gameProfileId: profile.id },
      include: { weapon: true },
      orderBy: { weapon: { name: "asc" } },
    }),
    prisma.ownedArtifact.findMany({
      where: { gameProfileId: profile.id },
      include: { artifactSet: true, mainStat: true },
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

  const characterOptions: OwnedCharacterOption[] = ownedCharacters.map((owned) => ({
    ownedCharacterId: owned.id,
    characterId: owned.characterId,
    name: owned.character.name,
    iconUrl: owned.character.iconUrl,
    weaponType: owned.character.weaponType,
  }));

  const weaponOptions: OwnedWeaponOption[] = ownedWeapons.map((owned) => ({
    ownedWeaponId: owned.id,
    name: owned.weapon.name,
    iconUrl: owned.weapon.iconUrl,
    weaponType: owned.weapon.weaponType,
    refinement: owned.refinement,
  }));

  const artifactOptions: OwnedArtifactOption[] = ownedArtifacts.map((owned) => ({
    ownedArtifactId: owned.id,
    slot: owned.slot,
    setName: owned.artifactSet.name,
    mainStatName: owned.mainStat.name,
    iconUrl: slotIconUrl(owned.artifactSet, owned.slot),
    rarity: owned.artifactSet.rarity,
    level: owned.level,
  }));

  const buildItems = builds.map(toBuildItem);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Builds</h1>
        <p className="text-sm text-gray-500">Managing builds for {profile.name}</p>
      </div>
      <BuildManager
        characters={characterOptions}
        weapons={weaponOptions}
        artifacts={artifactOptions}
        initialBuilds={buildItems}
      />
    </div>
  );
}
