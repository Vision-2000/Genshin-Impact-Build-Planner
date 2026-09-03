"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import { CreateLineupSchema, type CreateLineupErrors } from "./schemas";
import type { LineupMemberItem } from "./filter-sort";

export type CreateLineupResult = { lineup: { id: number; name: string } } | { errors: CreateLineupErrors };

export async function createLineup(name: string): Promise<CreateLineupResult> {
  const profile = await requireActiveProfile();

  const validated = CreateLineupSchema.safeParse({ name });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const lineup = await prisma.lineup.create({
    data: { gameProfileId: profile.id, name: validated.data.name },
  });

  return { lineup: { id: lineup.id, name: lineup.name } };
}

export async function updateLineupName(lineupId: number, name: string) {
  const profile = await requireActiveProfile();

  const lineup = await prisma.lineup.findFirst({ where: { id: lineupId, gameProfileId: profile.id } });
  if (!lineup) return;

  await prisma.lineup.update({ where: { id: lineupId }, data: { name } });
}

export async function deleteLineup(lineupId: number) {
  const profile = await requireActiveProfile();

  await prisma.lineup.deleteMany({ where: { id: lineupId, gameProfileId: profile.id } });
}

type BuildWithOverlapData = {
  id: number;
  ownedCharacterId: number;
  ownedWeaponId: number | null;
  ownedCharacter: { character: { exclusivityGroup: string | null } };
  buildArtifacts: { ownedArtifactId: number }[];
};

function toOverlapCheckBuild(build: BuildWithOverlapData): OverlapCheckBuild {
  return {
    buildId: build.id,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.ownedCharacter.character.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.buildArtifacts.map((ba) => ba.ownedArtifactId),
  };
}

function teamOverlapBuilds(team: { teamBuilds: { build: BuildWithOverlapData }[] }): OverlapCheckBuild[] {
  return team.teamBuilds.map((tb) => toOverlapCheckBuild(tb.build));
}

const TEAM_OVERLAP_INCLUDE = {
  teamBuilds: {
    include: {
      build: {
        include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
      },
    },
  },
} as const;

export type AddLineupTeamResult = { member: LineupMemberItem } | { error: string };

export async function addLineupTeam(lineupId: number, teamId: number): Promise<AddLineupTeamResult> {
  const profile = await requireActiveProfile();

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, gameProfileId: profile.id },
    include: { lineupTeams: { include: { team: { include: TEAM_OVERLAP_INCLUDE } } } },
  });
  if (!lineup) return { error: "Lineup not found." };

  if (lineup.lineupTeams.some((lt) => lt.teamId === teamId)) {
    return { error: "This team is already in the lineup." };
  }

  const candidateTeam = await prisma.team.findFirst({
    where: { id: teamId, gameProfileId: profile.id },
    include: TEAM_OVERLAP_INCLUDE,
  });
  if (!candidateTeam) return { error: "Team not found." };

  const existing = lineup.lineupTeams.flatMap((lt) => teamOverlapBuilds(lt.team));
  const candidate = teamOverlapBuilds(candidateTeam);

  if (detectOverlaps([...existing, ...candidate]).length > 0) {
    return { error: "This team conflicts with another team already in the lineup." };
  }

  await prisma.lineupTeam.create({ data: { lineupId, teamId: candidateTeam.id } });

  return { member: { teamId: candidateTeam.id, teamName: candidateTeam.name } };
}

export async function removeLineupTeam(lineupId: number, teamId: number) {
  const profile = await requireActiveProfile();

  await prisma.lineupTeam.deleteMany({
    where: { lineupId, teamId, lineup: { gameProfileId: profile.id } },
  });
}
