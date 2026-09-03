"use server";

import { ArtifactSlot } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { CreateBuildInputSchema, type CreateBuildInput, type CreateBuildErrors } from "./schemas";
import { toBuildItem, type BuildItem } from "./filter-sort";

export type CreateBuildResult = { build: BuildItem } | { errors: CreateBuildErrors };

export async function createBuild(input: CreateBuildInput): Promise<CreateBuildResult> {
  const profile = await requireActiveProfile();

  const validated = CreateBuildInputSchema.safeParse(input);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { ownedCharacterId, name, ownedWeaponId, artifacts } = validated.data;

  const ownedCharacter = await prisma.ownedCharacter.findFirst({
    where: { id: ownedCharacterId, gameProfileId: profile.id, isOwned: true },
  });
  if (!ownedCharacter) {
    return { errors: { ownedCharacterId: ["That character isn't in your owned roster."] } };
  }

  // Defense-in-depth: only accept weapon/artifact ids that actually belong to
  // this profile and, for artifacts, actually match the slot claimed.
  const [ownedWeaponIds, ownedArtifacts] = await Promise.all([
    prisma.ownedWeapon.findMany({ where: { gameProfileId: profile.id }, select: { id: true } }),
    prisma.ownedArtifact.findMany({ where: { gameProfileId: profile.id }, select: { id: true, slot: true } }),
  ]);
  const validWeaponIds = new Set(ownedWeaponIds.map((w) => w.id));
  const artifactSlotById = new Map(ownedArtifacts.map((a) => [a.id, a.slot]));

  const artifactEntries = artifacts.filter(
    (entry) => artifactSlotById.get(entry.ownedArtifactId) === (entry.slot as ArtifactSlot)
  );

  let createdId: number;
  try {
    const created = await prisma.build.create({
      data: {
        ownedCharacterId,
        name,
        ownedWeaponId: ownedWeaponId && validWeaponIds.has(ownedWeaponId) ? ownedWeaponId : null,
        buildArtifacts: { create: artifactEntries },
      },
    });
    createdId = created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { name: ["You already have a build with this name for this character."] } };
    }
    throw error;
  }

  const build = await prisma.build.findUniqueOrThrow({
    where: { id: createdId },
    include: {
      ownedCharacter: { include: { character: true } },
      ownedWeapon: { include: { weapon: true } },
      buildArtifacts: { include: { ownedArtifact: { include: { artifactSet: true, mainStat: true } } } },
    },
  });

  return { build: toBuildItem(build) };
}

export async function updateBuildName(buildId: number, name: string) {
  const profile = await requireActiveProfile();

  const build = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
  });
  if (!build) return;

  await prisma.build.update({ where: { id: buildId }, data: { name } });
}

export async function updateBuildWeapon(buildId: number, ownedWeaponId: number | null) {
  const profile = await requireActiveProfile();

  const build = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
  });
  if (!build) return;

  if (ownedWeaponId !== null) {
    const weapon = await prisma.ownedWeapon.findFirst({
      where: { id: ownedWeaponId, gameProfileId: profile.id },
    });
    if (!weapon) return;
  }

  await prisma.build.update({ where: { id: buildId }, data: { ownedWeaponId } });
}

export async function setBuildArtifact(buildId: number, slot: ArtifactSlot, ownedArtifactId: number | null) {
  const profile = await requireActiveProfile();

  const build = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
  });
  if (!build) return;

  if (ownedArtifactId === null) {
    await prisma.buildArtifact.deleteMany({ where: { buildId, slot } });
    return;
  }

  const artifact = await prisma.ownedArtifact.findFirst({
    where: { id: ownedArtifactId, gameProfileId: profile.id, slot },
  });
  if (!artifact) return;

  await prisma.buildArtifact.upsert({
    where: { buildId_slot: { buildId, slot } },
    create: { buildId, slot, ownedArtifactId },
    update: { ownedArtifactId },
  });
}

// Deleting a build cascades out of any team/roster it's in (DB-level, via
// TeamBuild/RosterBuild's onDelete: Cascade) -- this lets the confirm prompt
// name the affected teams/rosters first, per CLAUDE.md.
export async function getBuildContainerNames(buildId: number): Promise<{ teamNames: string[]; rosterNames: string[] }> {
  const profile = await requireActiveProfile();

  const [teamBuilds, rosterBuilds] = await Promise.all([
    prisma.teamBuild.findMany({
      where: { buildId, team: { gameProfileId: profile.id } },
      include: { team: true },
    }),
    prisma.rosterBuild.findMany({
      where: { buildId, roster: { gameProfileId: profile.id } },
      include: { roster: true },
    }),
  ]);

  return {
    teamNames: teamBuilds.map((teamBuild) => teamBuild.team.name),
    rosterNames: rosterBuilds.map((rosterBuild) => rosterBuild.roster.name),
  };
}

export async function deleteBuild(buildId: number) {
  const profile = await requireActiveProfile();

  await prisma.build.deleteMany({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
  });
}
