import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { TeamManager } from "./team-manager";
import type { BuildOption, TeamItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Teams",
};

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
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="text-sm text-gray-500">Managing teams for {profile.name}</p>
      </div>
      <TeamManager builds={buildOptions} initialTeams={teamItems} />
    </div>
  );
}
