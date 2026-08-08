import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CharacterRoster, type CharacterListItem } from "./character-roster";

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
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Characters</h1>
        <p className="text-sm text-gray-500">Managing roster for {profile.name}</p>
      </div>
      <CharacterRoster initialCharacters={characterList} />
    </div>
  );
}
