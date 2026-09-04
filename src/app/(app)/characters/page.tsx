import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CharacterRoster, type CharacterListItem } from "./character-roster";
import { HelpButton } from "./help-button";

export const metadata: Metadata = {
  title: "Characters",
};

export default async function CharactersPage() {
  const profile = await requireActiveProfile();

  const [characters, ownedCharacters] = await Promise.all([
    prisma.character.findMany({ orderBy: { name: "asc" } }),
    prisma.ownedCharacter.findMany({ where: { gameProfileId: profile.id, isOwned: true } }),
  ]);

  const ownedIds = new Set(ownedCharacters.map((owned) => owned.characterId));

  const characterList: CharacterListItem[] = characters.map((character) => ({
    id: character.id,
    name: character.name,
    element: character.element,
    weaponType: character.weaponType,
    rarity: character.rarity,
    iconUrl: character.iconUrl,
    isOwned: ownedIds.has(character.id),
  }));

  return (
    <div className="mx-auto max-w-[90rem] space-y-3 p-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Characters</h1>
          <HelpButton />
        </div>
        <p className="text-sm text-gray-500">Managing characters for {profile.name}</p>
      </div>
      <CharacterRoster initialCharacters={characterList} />
    </div>
  );
}
