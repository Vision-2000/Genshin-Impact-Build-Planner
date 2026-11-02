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

// Teams are ordered by createdAt desc (see page.tsx) -- this is the only
// way a team's position in that order ever changes: a plain write to its
// own createdAt, same effect as deleting and recreating it but without
// losing its builds. No dedicated "sort order" column -- createdAt isn't
// displayed anywhere in this app (grepped before adding this), so
// repurposing it costs nothing real, and ordinary edits (rename, add/
// remove build) never touch it, so a team's position stays put until the
// user explicitly asks to move it here.
export async function bumpTeamToFront(teamId: number) {
  const profile = await requireActiveProfile();

  await prisma.team.updateMany({ where: { id: teamId, gameProfileId: profile.id }, data: { createdAt: new Date() } });
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

  // Only rejects conflicts the CANDIDATE is actually part of -- not just
  // "is detectOverlaps' result non-empty over the whole set", which would
  // also reject every add whenever two of the team's EXISTING builds
  // already conflict with each other (possible since a build's weapon/
  // artifacts can change after it's already in a team -- see
  // computeTeamConflicts in teams/filter-sort.ts). That pre-existing
  // conflict is real, but has nothing to do with whether this candidate
  // itself is safe to add.
  const conflicts = detectOverlaps([...existing, candidate]);
  if (conflicts.some((conflict) => conflict.buildIds.includes(candidate.buildId))) {
    return { error: "This build conflicts with another build already in the team." };
  }

  // No Team.updatedAt/createdAt touch here -- teams are ordered by
  // createdAt (see bumpTeamToFront's own comment), and adding a build
  // deliberately never moves a team's position; only the explicit "move
  // to front" action does that.
  await prisma.teamBuild.create({
    data: { teamId, buildId: candidateBuild.id, ownedCharacterId: candidateBuild.ownedCharacterId },
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

export async function removeTeamBuild(teamId: number, buildId: number) {
  const profile = await requireActiveProfile();

  // No Team.updatedAt/createdAt touch here either -- same reason as
  // addTeamBuild above.
  await prisma.teamBuild.deleteMany({ where: { teamId, buildId, team: { gameProfileId: profile.id } } });
}

// Swaps which build an OCCUPIED slot holds, in place -- updates the
// existing TeamBuild row's own buildId/ownedCharacterId rather than
// deleting it and creating a new one (the old remove+add sequence
// handleSlotChange used to use for a replace). That distinction matters:
// teamBuilds are rendered in `id` order (see page.tsx's own orderBy), so a
// brand-new row always lands at the END regardless of which slot it's
// conceptually replacing, while updating the row that was ALREADY there
// keeps its id -- and therefore its position -- exactly where it was.
// Same real-game behavior the user confirmed this should match: replacing
// a party member swaps them into that same slot, not the back of the line.
export async function replaceTeamBuild(teamId: number, oldBuildId: number, newBuildId: number): Promise<AddTeamBuildResult> {
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

  const candidateBuild = await prisma.build.findFirst({
    where: { id: newBuildId, ownedCharacter: { gameProfileId: profile.id } },
    include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
  });
  if (!candidateBuild) return { error: "Build not found." };

  // The slot being replaced is excluded from the overlap check -- it's
  // about to stop holding oldBuildId, so oldBuildId's own weapon/artifacts/
  // character no longer count as "already in the team" for this check.
  const existing = team.teamBuilds.filter((tb) => tb.buildId !== oldBuildId).map((tb) => toOverlapCheckBuild(tb.build));
  const candidate = toOverlapCheckBuild(candidateBuild);

  // Same "only reject conflicts the candidate itself is part of" fix as
  // addTeamBuild above, same reason.
  const conflicts = detectOverlaps([...existing, candidate]);
  if (conflicts.some((conflict) => conflict.buildIds.includes(candidate.buildId))) {
    return { error: "This build conflicts with another build already in the team." };
  }

  const result = await prisma.teamBuild.updateMany({
    where: { teamId, buildId: oldBuildId, team: { gameProfileId: profile.id } },
    data: { buildId: candidateBuild.id, ownedCharacterId: candidateBuild.ownedCharacterId },
  });
  if (result.count === 0) return { error: "Team not found." };

  return {
    member: {
      buildId: candidateBuild.id,
      name: candidateBuild.name,
      characterName: travelerDisplayName(candidateBuild.ownedCharacter.character.name),
      characterIconUrl: candidateBuild.ownedCharacter.character.iconUrl,
    },
  };
}

export type ReorderTeamBuildsResult = { success: true } | { error: string };

// Drag-reorders a team's own slots -- `orderedBuildIds` must be exactly the
// team's CURRENT build ids, just in a new order (this never adds, removes,
// or replaces which builds are in the team, only their positions).
//
// Can't just UPDATE each existing row's buildId/ownedCharacterId one at a
// time to its new position: TeamBuild has @@unique([teamId,
// ownedCharacterId]), and Postgres checks that constraint immediately (not
// deferred), so writing row A's new value before row B's old value has
// moved off it can transiently collide for any reorder that isn't a no-op
// (e.g. swapping two slots directly). Instead this deletes all the team's
// rows and recreates them in one transaction, passing each row's OWN
// original id back in explicitly -- the exact same "explicit id reuse on
// recreate" technique this app's own master-data seed script already
// relies on (see CLAUDE.md's Key decisions on why that's trusted). Delete-
// then-recreate (not interleaved updates) means the unique constraint
// never sees an intermediate conflicting state, and reusing the same ids
// keeps each row's own position (teamBuilds render in id order -- see
// page.tsx's own orderBy) exactly where the caller asked for it. No
// sequence reset needed afterward (unlike bulk master-data imports) --
// these ids already existed below the sequence's current counter; this
// never introduces a NEW id the counter doesn't already know about.
export async function reorderTeamBuilds(teamId: number, orderedBuildIds: number[]): Promise<ReorderTeamBuildsResult> {
  const profile = await requireActiveProfile();

  const team = await prisma.team.findFirst({
    where: { id: teamId, gameProfileId: profile.id },
    include: { teamBuilds: { orderBy: { id: "asc" } } },
  });
  if (!team) return { error: "Team not found." };

  const ownedCharacterIdByBuildId = new Map(team.teamBuilds.map((tb) => [tb.buildId, tb.ownedCharacterId]));
  const isSamePermutation =
    orderedBuildIds.length === team.teamBuilds.length && orderedBuildIds.every((id) => ownedCharacterIdByBuildId.has(id));
  if (!isSamePermutation) return { error: "That reorder no longer matches this team's own builds." };

  await prisma.$transaction([
    prisma.teamBuild.deleteMany({ where: { teamId } }),
    ...team.teamBuilds.map((row, index) =>
      prisma.teamBuild.create({
        data: {
          id: row.id,
          teamId,
          buildId: orderedBuildIds[index],
          ownedCharacterId: ownedCharacterIdByBuildId.get(orderedBuildIds[index])!,
        },
      })
    ),
  ]);

  return { success: true };
}
