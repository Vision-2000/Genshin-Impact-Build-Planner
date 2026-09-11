import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { slotIconUrl } from "../../artifacts/filter-sort";
import { BuildCatalog } from "./build-catalog";
import type { OwnedCharacterOption, OwnedWeaponOption, OwnedArtifactOption } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Build",
};

const HELP_TEXT = `Pick one of your owned characters, give the build a name, and optionally assign a weapon and up to 5 artifacts. Only weapons matching the character's weapon type are offered, and each artifact slot only offers pieces you own for that slot.`;

export default async function AddBuildPage() {
  const profile = await requireActiveProfile();

  const [ownedCharacters, ownedWeapons, ownedArtifacts] = await Promise.all([
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
  ]);

  const characterOptions: OwnedCharacterOption[] = ownedCharacters.map((owned) => ({
    ownedCharacterId: owned.id,
    characterId: owned.characterId,
    name: owned.character.name,
    iconUrl: owned.character.iconUrl,
    weaponType: owned.character.weaponType,
    element: owned.character.element,
    rarity: owned.character.rarity,
  }));

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
  }));

  return (
    <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Add a build</h1>
            <HelpButton title="Add build help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500">Adding builds for {profile.name}</p>
        </div>
        <Link
          href="/builds"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          ← Back to my builds
        </Link>
      </div>
      <BuildCatalog characters={characterOptions} weapons={weaponOptions} artifacts={artifactOptions} />
    </div>
  );
}
