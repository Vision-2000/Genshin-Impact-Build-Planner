import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { CharacterRoster, type CharacterListItem } from "./character-roster";

export const metadata: Metadata = {
  title: "Characters",
};

const HELP_TEXT = `Click anywhere on a character's card to mark it owned or not owned. A green border means it's in your owned roster; the border stays gray otherwise. Once owned, use the pencil icon to edit level, ascension, constellation, and talent levels.`;

export default async function CharactersPage() {
  const profile = await requireActiveProfile();

  const [characters, ownedCharacters] = await Promise.all([
    prisma.character.findMany({ orderBy: { name: "asc" } }),
    // Not filtered to isOwned: true here (unlike before) -- a character
    // toggled off still keeps its progression row (see CLAUDE.md's Key
    // decisions), and the roster needs it either way to prefill the editor
    // correctly if it's toggled back on.
    prisma.ownedCharacter.findMany({ where: { gameProfileId: profile.id } }),
  ]);

  const ownedByCharacterId = new Map(ownedCharacters.map((owned) => [owned.characterId, owned]));

  const characterList: CharacterListItem[] = characters.map((character) => {
    const owned = ownedByCharacterId.get(character.id);
    return {
      id: character.id,
      name: character.name,
      element: character.element,
      weaponType: character.weaponType,
      rarity: character.rarity,
      iconUrl: character.iconUrl,
      isOwned: owned?.isOwned ?? false,
      level: owned?.level ?? 1,
      ascensionPhase: owned?.ascensionPhase ?? 0,
      constellation: owned?.constellation ?? 0,
      normalAttackLevel: owned?.normalAttackLevel ?? 1,
      skillLevel: owned?.skillLevel ?? 1,
      burstLevel: owned?.burstLevel ?? 1,
    };
  });

  return (
    <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Characters</h1>
          <HelpButton title="Characters page help" text={HELP_TEXT} />
        </div>
        <p className="text-sm text-gray-500">Managing characters for {profile.name}</p>
      </div>
      <CharacterRoster initialCharacters={characterList} />
    </div>
  );
}
