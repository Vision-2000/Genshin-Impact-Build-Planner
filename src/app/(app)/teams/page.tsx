import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { HelpButton } from "@/components/help-button";
import { TeamManager } from "./team-manager";
import type { BuildOption, TeamItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Teams",
};

const HELP_TEXT = `This page shows the teams you've assembled from your builds. Click "Create team" to start a new one; click an empty slot on a team to assign a build to it, or a filled slot to swap/remove it. A team holds up to 4 builds, and a build can't be reused across two slots in the same team if doing so would duplicate a character, share a weapon, or share an artifact -- those builds simply won't show up as candidates.`;

export default async function TeamsPage() {
  const profile = await requireActiveProfile();

  const [builds, teams] = await Promise.all([
    prisma.build.findMany({
      where: { ownedCharacter: { gameProfileId: profile.id, isOwned: true } },
      include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { gameProfileId: profile.id },
      include: {
        teamBuilds: {
          include: { build: { include: { ownedCharacter: { include: { character: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const buildOptions: BuildOption[] = builds.map((build) => ({
    buildId: build.id,
    name: build.name,
    characterName: travelerDisplayName(build.ownedCharacter.character.name),
    characterIconUrl: build.ownedCharacter.character.iconUrl,
    element: build.ownedCharacter.character.element,
    rarity: build.ownedCharacter.character.rarity,
    weaponType: build.ownedCharacter.character.weaponType,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.ownedCharacter.character.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.buildArtifacts.map((ba) => ba.ownedArtifactId),
  }));

  const teamItems: TeamItem[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    members: team.teamBuilds.map((tb) => ({
      buildId: tb.build.id,
      name: tb.build.name,
      characterName: travelerDisplayName(tb.build.ownedCharacter.character.name),
      characterIconUrl: tb.build.ownedCharacter.character.iconUrl,
    })),
  }));

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] p-4">
        {/* Same reasoning as the Builds page's own header -- "Create team"
            opens a modal driven by client state, so the row holding both
            the title and that button has to live inside the client
            component rather than here. */}
        <TeamManager
          header={
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">Teams</h1>
                <HelpButton title="Teams page help" text={HELP_TEXT} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-300">Managing teams for {profile.name}</p>
            </div>
          }
          builds={buildOptions}
          initialTeams={teamItems}
        />
      </div>
    </div>
  );
}
