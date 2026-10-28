"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import { travelerDisplayName } from "@/lib/character-scaling";
import { CreateTeamSchema, type CreateTeamErrors } from "./schemas";
import { MAX_TEAM_SIZE, type TeamMemberItem } from "./filter-sort";

export type CreateTeamResult = { team: { id: number; name: string } } | { errors: CreateTeamErrors };

export async function createTeam(name: string): Promise<CreateTeamResult> {
  const profile = await requireActiveProfile();

  const validated = CreateTeamSchema.safeParse({ name });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const team = await prisma.team.create({
    data: { gameProfileId: profile.id, name: validated.data.name },
  });

  return { team: { id: team.id, name: team.name } };
}

export async function updateTeamName(teamId: number, name: string) {
  const profile = await requireActiveProfile();

  const team = await prisma.team.findFirst({ where: { id: teamId, gameProfileId: profile.id } });
  if (!team) return;

  await prisma.team.update({ where: { id: teamId }, data: { name } });
}

export async function deleteTeam(teamId: number) {
  const profile = await requireActiveProfile();

  await prisma.team.deleteMany({ where: { id: teamId, gameProfileId: profile.id } });
}

// Builds a fresh OverlapCheckBuild list from the DB rather than trusting
// whatever the client sent, since this is the defense-in-depth check behind
// the live client-side one that already prevents conflicting picks in the UI.
function toOverlapCheckBuild(build: {
  id: number;
  ownedCharacterId: number;
  ownedWeaponId: number | null;
  ownedCharacter: { character: { exclusivityGroup: string | null } };
  buildArtifacts: { ownedArtifactId: number }[];
}): OverlapCheckBuild {
  return {
    buildId: build.id,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.ownedCharacter.character.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.buildArtifacts.map((ba) => ba.ownedArtifactId),
  };
}

export type AddTeamBuildResult = { member: TeamMemberItem } | { error: string };

export async function addTeamBuild(teamId: number, buildId: number): Promise<AddTeamBuildResult> {
  const profile = await requireActiveProfile();

  const team = await prisma.team.findFirst({
    where: { id: teamId, gameProfileId: profile.id },
    include: {
      teamBuilds: {
        include: {
          build: {
            include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
          },
        },
      },
    },
  });
  if (!team) return { error: "Team not found." };
  if (team.teamBuilds.length >= MAX_TEAM_SIZE) return { error: "This team already has 4 builds." };

  const candidateBuild = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
    include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
  });
  if (!candidateBuild) return { error: "Build not found." };

  const existing = team.teamBuilds.map((tb) => toOverlapCheckBuild(tb.build));
  const candidate = toOverlapCheckBuild(candidateBuild);

  if (detectOverlaps([...existing, candidate]).length > 0) {
    return { error: "This build conflicts with another build already in the team." };
  }

  // Touches Team.updatedAt too (an empty updateMany still bumps the
  // @updatedAt field) -- TeamBuild is a separate join table, so creating
  // a row here wouldn't otherwise move this team to the top of the
  // "most recently updated" ordering the page sorts by. updateMany (not
  // update) re-scopes by gameProfileId for the same reason deleteTeam
  // does -- ownership was already checked once above when `team` was
  // fetched, but this keeps the guarantee local to the call that needs
  // it instead of relying on that earlier check never being refactored
  // away.
  await prisma.$transaction([
    prisma.teamBuild.create({
      data: { teamId, buildId: candidateBuild.id, ownedCharacterId: candidateBuild.ownedCharacterId },
    }),
    prisma.team.updateMany({ where: { id: teamId, gameProfileId: profile.id }, data: {} }),
  ]);

  return {
    member: {
      buildId: candidateBuild.id,
      name: candidateBuild.name,
      characterName: travelerDisplayName(candidateBuild.ownedCharacter.character.name),
      characterIconUrl: candidateBuild.ownedCharacter.character.iconUrl,
    },
  };
}

export async function removeTeamBuild(teamId: number, buildId: number) {
  const profile = await requireActiveProfile();

  // Same Team.updatedAt touch as addTeamBuild, same reason.
  await prisma.$transaction([
    prisma.teamBuild.deleteMany({ where: { teamId, buildId, team: { gameProfileId: profile.id } } }),
    prisma.team.updateMany({ where: { id: teamId, gameProfileId: profile.id }, data: {} }),
  ]);
}
