import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LineupManager } from "./lineup-manager";
import type { TeamOption, LineupItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Lineups",
};

export default async function LineupsPage() {
  const profile = await requireActiveProfile();

  const [teams, lineups] = await Promise.all([
    prisma.team.findMany({
      where: { gameProfileId: profile.id },
      include: {
        teamBuilds: {
          include: {
            build: {
              include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lineup.findMany({
      where: { gameProfileId: profile.id },
      include: { lineupTeams: { include: { team: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Fetched fresh on every request, so this always reflects each team's
  // current builds -- a saved lineup that has drifted into conflict (e.g. a
  // member team's weapon got reassigned elsewhere) shows that live, not a
  // stale pass/fail from when it was saved.
  const teamOptions: TeamOption[] = teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    builds: team.teamBuilds.map((tb) => ({
      buildId: tb.build.id,
      ownedCharacterId: tb.build.ownedCharacterId,
      exclusivityGroup: tb.build.ownedCharacter.character.exclusivityGroup,
      ownedWeaponId: tb.build.ownedWeaponId,
      ownedArtifactIds: tb.build.buildArtifacts.map((ba) => ba.ownedArtifactId),
    })),
  }));

  const lineupItems: LineupItem[] = lineups.map((lineup) => ({
    id: lineup.id,
    name: lineup.name,
    members: lineup.lineupTeams.map((lt) => ({ teamId: lt.team.id, teamName: lt.team.name })),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Lineups</h1>
        <p className="text-sm text-gray-500">Managing lineups for {profile.name}</p>
      </div>
      <LineupManager teams={teamOptions} initialLineups={lineupItems} />
    </div>
  );
}
