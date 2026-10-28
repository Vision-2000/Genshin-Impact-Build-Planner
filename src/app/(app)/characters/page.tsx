import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { OwnedCharacterManager } from "./owned-character-manager";
import type { OwnedCharacterItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Characters",
};

const HELP_TEXT = `This page shows the characters you currently own. Click a card to edit its level, ascension, constellation, and talent levels.`;

export default async function CharactersPage() {
  const profile = await requireActiveProfile();

  const ownedCharacters = await prisma.ownedCharacter.findMany({
    where: { gameProfileId: profile.id, isOwned: true },
    orderBy: { character: { name: "asc" } },
    include: { character: true },
  });

  const owned: OwnedCharacterItem[] = ownedCharacters.map((ownedCharacter) => ({
    id: ownedCharacter.character.id,
    name: ownedCharacter.character.name,
    element: ownedCharacter.character.element,
    weaponType: ownedCharacter.character.weaponType,
    rarity: ownedCharacter.character.rarity,
    iconUrl: ownedCharacter.character.iconUrl,
    splashUrl: ownedCharacter.character.splashUrl,
    level: ownedCharacter.level,
    ascensionPhase: ownedCharacter.ascensionPhase,
    constellation: ownedCharacter.constellation,
    normalAttackLevel: ownedCharacter.normalAttackLevel,
    skillLevel: ownedCharacter.skillLevel,
    burstLevel: ownedCharacter.burstLevel,
  }));

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Characters</h1>
            <HelpButton title="Characters page help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-300">Managing characters for {profile.name}</p>
        </div>
        {/* pt-3/pb-2 (not py-2.5) -- same Arial line-height fix as every
            other text-centered control in this app, see
            build-stats-summary.tsx's own comment on the root cause. */}
        <Link
          href="/characters/roster"
          className="flex items-center gap-1.5 rounded-lg border px-4 pb-2 pt-3 text-sm font-semibold hover:bg-black/5"
        >
          Manage roster
        </Link>
      </div>
      <OwnedCharacterManager initialOwnedCharacters={owned} />
      </div>
    </div>
  );
}
