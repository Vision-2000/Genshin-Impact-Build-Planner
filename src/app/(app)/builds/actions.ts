"use server";

import { ArtifactSlot, ArtifactSetPiece } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { travelerDisplayName } from "@/lib/character-scaling";
import { computeWeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { slotIconUrl } from "../artifacts/filter-sort";
import { CreateBuildInputSchema, type CreateBuildInput, type CreateBuildErrors } from "./schemas";
import {
  toBuildItem,
  type BuildItem,
  type OwnedCharacterOption,
  type OwnedWeaponOption,
  type OwnedArtifactOption,
} from "./filter-sort";

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

export type BuildDetail = {
  name: string;
  character: OwnedCharacterOption;
  weapon: OwnedWeaponOption | null;
  artifacts: OwnedArtifactOption[];
};

export type GetBuildDetailResult = { detail: BuildDetail } | { error: string };

// Fetches exactly one build's own character/weapon/artifacts, mapped into
// the same OwnedCharacterOption/OwnedWeaponOption/OwnedArtifactOption
// shapes page.tsx already builds for the WHOLE owned catalog (so the result
// plugs straight into BuildStatsSummary with zero adaptation) -- but scoped
// to this one build's own relations via a single findFirst, not the
// catalog-wide findMany queries those pickers need. Built for the Teams
// page's own "view build details" modal, which only ever wants to read one
// build on demand, not hold the whole owned-builds editing dataset (that
// stays specific to the Builds page itself).
export async function getBuildDetail(buildId: number): Promise<GetBuildDetailResult> {
  const profile = await requireActiveProfile();

  const build = await prisma.build.findFirst({
    where: { id: buildId, ownedCharacter: { gameProfileId: profile.id } },
    include: {
      ownedCharacter: {
        include: {
          character: {
            include: {
              ascensionStat: true,
              talents: { include: { statBonuses: { include: { statType: true } } } },
              constellations: { include: { statBonuses: { include: { statType: true } } } },
            },
          },
        },
      },
      ownedWeapon: {
        include: {
          weapon: {
            include: {
              secondaryStat: true,
              statBonuses: { include: { statType: true } },
              refinementEffects: { orderBy: { refinement: "asc" } },
              refinementValues: { orderBy: { slotIndex: "asc" } },
            },
          },
        },
      },
      buildArtifacts: {
        include: {
          ownedArtifact: {
            include: {
              artifactSet: { include: { statBonuses: { include: { statType: true } } } },
              mainStat: true,
              substats: { include: { statType: true } },
            },
          },
        },
      },
    },
  });
  if (!build) return { error: "Build not found." };

  const owned = build.ownedCharacter;
  const character: OwnedCharacterOption = {
    ownedCharacterId: owned.id,
    characterId: owned.characterId,
    name: travelerDisplayName(owned.character.name),
    iconUrl: owned.character.iconUrl,
    splashUrl: owned.character.splashUrl,
    weaponType: owned.character.weaponType,
    element: owned.character.element,
    rarity: owned.character.rarity,
    baseHp: owned.character.baseHp,
    baseAttack: owned.character.baseAttack,
    baseDefense: owned.character.baseDefense,
    maxAscensionHp: owned.character.maxAscensionHp,
    maxAscensionAttack: owned.character.maxAscensionAttack,
    maxAscensionDefense: owned.character.maxAscensionDefense,
    baseElementalMastery: owned.character.baseElementalMastery,
    ascensionStatName: owned.character.ascensionStat?.name ?? null,
    level: owned.level,
    ascensionPhase: owned.ascensionPhase,
    constellation: owned.constellation,
    normalAttackLevel: owned.normalAttackLevel,
    skillLevel: owned.skillLevel,
    burstLevel: owned.burstLevel,
    talentStatBonuses: owned.character.talents.flatMap((talent) =>
      talent.statBonuses.map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value }))
    ),
    constellationStatBonuses: owned.character.constellations.flatMap((constellation) =>
      constellation.statBonuses.map((bonus) => ({
        statTypeName: bonus.statType.name,
        value: bonus.value,
        number: constellation.number,
      }))
    ),
    talents: owned.character.talents.map((talent) => ({
      slot: talent.slot,
      name: talent.name,
      iconUrl: talent.iconUrl,
      description: talent.description,
    })),
    constellations: owned.character.constellations.map((c) => ({
      number: c.number,
      name: c.name,
      iconUrl: c.iconUrl,
      description: c.description,
    })),
  };

  const weapon: OwnedWeaponOption | null = build.ownedWeapon
    ? {
        ownedWeaponId: build.ownedWeapon.id,
        name: build.ownedWeapon.weapon.name,
        iconUrl: build.ownedWeapon.weapon.iconUrl,
        weaponType: build.ownedWeapon.weapon.weaponType,
        refinement: build.ownedWeapon.refinement,
        rarity: build.ownedWeapon.weapon.rarity,
        secondaryStatName: build.ownedWeapon.weapon.secondaryStat?.name ?? null,
        attackTier: build.ownedWeapon.weapon.attackTier,
        attackCurveRarity: build.ownedWeapon.weapon.attackCurveRarity,
        baseSecondaryStatValue: build.ownedWeapon.weapon.baseSecondaryStatValue,
        level: build.ownedWeapon.level,
        ascensionPhase: build.ownedWeapon.ascensionPhase,
        statBonuses: build.ownedWeapon.weapon.statBonuses.map((bonus) => ({
          statTypeName: bonus.statType.name,
          curveType: bonus.curveType,
          baseValue: bonus.baseValue,
          slope: bonus.slope,
          customValues: bonus.customValues,
        })),
        hoverDetail: computeWeaponHoverDetail(
          build.ownedWeapon.weapon,
          build.ownedWeapon.level,
          build.ownedWeapon.ascensionPhase,
          build.ownedWeapon.refinement
        ),
        createdAt: build.ownedWeapon.createdAt.getTime(),
      }
    : null;

  const artifacts: OwnedArtifactOption[] = build.buildArtifacts.map((ba) => {
    const owned = ba.ownedArtifact;
    return {
      ownedArtifactId: owned.id,
      slot: owned.slot,
      artifactSetId: owned.artifactSetId,
      setName: owned.artifactSet.name,
      mainStatName: owned.mainStat.name,
      iconUrl: slotIconUrl(owned.artifactSet, owned.slot),
      flowerIconUrl: owned.artifactSet.flowerIconUrl,
      rarity: owned.artifactSet.rarity,
      level: owned.level,
      substats: owned.substats.map((s) => ({ statTypeName: s.statType.name, value: s.value })),
      twoPieceStatBonuses: owned.artifactSet.statBonuses
        .filter((bonus) => bonus.piece === ArtifactSetPiece.Two)
        .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
      fourPieceStatBonuses: owned.artifactSet.statBonuses
        .filter((bonus) => bonus.piece === ArtifactSetPiece.Four)
        .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
      twoPieceEffect: owned.artifactSet.twoPieceEffect,
      fourPieceEffect: owned.artifactSet.fourPieceEffect,
      createdAt: owned.createdAt.getTime(),
    };
  });

  return { detail: { name: build.name, character, weapon, artifacts } };
}
