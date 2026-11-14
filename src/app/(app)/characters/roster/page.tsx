import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ArrowLeftIcon } from "@/components/arrow-left-icon";
import { HelpButton } from "@/components/help-button";
import { CharacterRoster } from "./character-roster";
import type { CharacterRosterItem } from "../filter-sort";

export const metadata: Metadata = {
  title: "Character Roster",
};

const HELP_TEXT = `Click anywhere on a character's card to mark it owned or not owned. A green border means it's already in your owned roster.`;

export default async function CharacterRosterPage() {
  const profile = await requireActiveProfile();

  const [characters, ownedCharacters] = await Promise.all([
    prisma.character.findMany({ orderBy: { name: "asc" } }),
    prisma.ownedCharacter.findMany({
      where: { gameProfileId: profile.id, isOwned: true },
      select: { characterId: true },
    }),
  ]);

  const ownedIds = new Set(ownedCharacters.map((owned) => owned.characterId));

  const roster: CharacterRosterItem[] = characters.map((character) => ({
    id: character.id,
    name: character.name,
    element: character.element,
    weaponType: character.weaponType,
    rarity: character.rarity,
    iconUrl: character.iconUrl,
    isOwned: ownedIds.has(character.id),
  }));

  return (
    <div className="min-h-full bg-secondary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Character roster</h1>
            <HelpButton title="Character roster help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-300">Managing ownership for {profile.name}</p>
        </div>
        <Link
          href="/characters"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
        >
          {/* ArrowLeftIcon, not the Unicode "←" -- see its own comment
              on why a Unicode arrow can't be reliably centered against
              plain text via CSS alone. */}
          <ArrowLeftIcon />
          <span className="leading-none">Back to my characters</span>
        </Link>
      </div>
      <CharacterRoster roster={roster} />
      </div>
    </div>
  );
}
