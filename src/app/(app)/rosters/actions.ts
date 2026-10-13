"use server";

import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import { travelerDisplayName } from "@/lib/character-scaling";
import { CreateRosterSchema, type CreateRosterErrors } from "./schemas";
import type { RosterMemberItem } from "./filter-sort";

export type CreateRosterResult = { roster: { id: number; name: string } } | { errors: CreateRosterErrors };

export async function createRoster(name: string): Promise<CreateRosterResult> {
  const profile = await requireActiveProfile();

  const validated = CreateRosterSchema.safeParse({ name });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const roster = await prisma.roster.create({
    data: { gameProfileId: profile.id, name: validated.data.name },
  });

  return { roster: { id: roster.id, name: roster.name } };
}

export async function updateRosterName(rosterId: number, name: string) {
  const profile = await requireActiveProfile();

  const roster = await prisma.roster.findFirst({ where: { id: rosterId, gameProfileId: profile.id } });
  if (!roster) return;

  await prisma.roster.update({ where: { id: rosterId }, data: { name } });
}

export async function deleteRoster(rosterId: number) {
  const profile = await requireActiveProfile();

  await prisma.roster.deleteMany({ where: { id: rosterId, gameProfileId: profile.id } });
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

export type AddRosterBuildResult = { member: RosterMemberItem } | { error: string };

export async function addRosterBuild(rosterId: number, buildId: number): Promise<AddRosterBuildResult> {
  const profile = await requireActiveProfile();

  const roster = await prisma.roster.findFirst({
    where: { id: rosterId, gameProfileId: profile.id },
    include: {
      rosterBuilds: {
        include: {
          build: {
            include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
          },
        },
      },
    },
  });
  if (!roster) return { error: "Roster not found." };

  const candidateBuild = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
    include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
  });
  if (!candidateBuild) return { error: "Build not found." };

  const existing = roster.rosterBuilds.map((rb) => toOverlapCheckBuild(rb.build));
  const candidate = toOverlapCheckBuild(candidateBuild);

  if (detectOverlaps([...existing, candidate]).length > 0) {
    return { error: "This build conflicts with another build already in the roster." };
  }

  await prisma.rosterBuild.create({
    data: { rosterId, buildId: candidateBuild.id, ownedCharacterId: candidateBuild.ownedCharacterId },
  });

  return {
    member: {
      buildId: candidateBuild.id,
      name: candidateBuild.name,
      characterName: travelerDisplayName(candidateBuild.ownedCharacter.character.name),
      characterIconUrl: candidateBuild.ownedCharacter.character.iconUrl,
    },
  };
}

export async function removeRosterBuild(rosterId: number, buildId: number) {
  const profile = await requireActiveProfile();

  await prisma.rosterBuild.deleteMany({
    where: { rosterId, buildId, roster: { gameProfileId: profile.id } },
  });
}
