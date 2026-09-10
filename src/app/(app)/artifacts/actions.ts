"use server";

import { ArtifactSlot } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { MAX_SUBSTATS, MIN_LEVEL, MAX_LEVEL, maxLevelForRarity } from "./artifact-rules";
import { toOwnedArtifactItem, type OwnedArtifactItem } from "./filter-sort";

type SubstatInput = { statTypeId: number; value: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// Defense-in-depth only — the UI already prevents duplicates, the main stat
// being re-picked as a substat, and going over the cap.
function sanitizeSubstats(substats: SubstatInput[], mainStatId: number): SubstatInput[] {
  const seen = new Set<number>();
  const result: SubstatInput[] = [];

  for (const substat of substats) {
    if (substat.statTypeId === mainStatId) continue;
    if (seen.has(substat.statTypeId)) continue;
    if (result.length >= MAX_SUBSTATS) break;
    seen.add(substat.statTypeId);
    result.push(substat);
  }

  return result;
}

export async function addArtifact(
  artifactSetId: number,
  slot: ArtifactSlot,
  level: number,
  mainStatId: number,
  substats: SubstatInput[]
): Promise<OwnedArtifactItem> {
  const profile = await requireActiveProfile();

  // Level's real cap depends on the set's rarity (4-star maxes at +16,
  // 5-star at +20) -- defense-in-depth behind the UI's own rarity-aware slider.
  const artifactSet = await prisma.artifactSet.findUnique({
    where: { id: artifactSetId },
    select: { rarity: true },
  });
  const maxLevel = artifactSet ? maxLevelForRarity(artifactSet.rarity) : MAX_LEVEL;

  const created = await prisma.ownedArtifact.create({
    data: {
      gameProfileId: profile.id,
      artifactSetId,
      slot,
      level: clamp(level, MIN_LEVEL, maxLevel),
      mainStatId,
      substats: {
        create: sanitizeSubstats(substats, mainStatId).map((s) => ({
          statTypeId: s.statTypeId,
          value: s.value,
        })),
      },
    },
    include: { artifactSet: true, mainStat: true, substats: { include: { statType: true } } },
  });

  return toOwnedArtifactItem(created);
}

// One call for the whole edit form (level + all substats), mirroring
// addArtifact -- the edit modal drafts changes locally and commits them in a
// batch, same as the add flow, rather than firing a request per keystroke.
// Substats are replaced wholesale: a piece's substats carry no identity
// beyond their stat + value, so delete-and-recreate is invisible to the user
// and simpler than diffing.
export async function updateArtifact(
  ownedArtifactId: number,
  level: number,
  mainStatId: number,
  substats: SubstatInput[]
): Promise<OwnedArtifactItem | null> {
  const profile = await requireActiveProfile();

  const existing = await prisma.ownedArtifact.findFirst({
    where: { id: ownedArtifactId, gameProfileId: profile.id },
    select: { artifactSet: { select: { rarity: true } } },
  });
  if (!existing) return null;

  const maxLevel = maxLevelForRarity(existing.artifactSet.rarity);

  const updated = await prisma.ownedArtifact.update({
    where: { id: ownedArtifactId },
    data: {
      level: clamp(level, MIN_LEVEL, maxLevel),
      mainStatId,
      substats: {
        deleteMany: {},
        create: sanitizeSubstats(substats, mainStatId).map((s) => ({
          statTypeId: s.statTypeId,
          value: s.value,
        })),
      },
    },
    include: { artifactSet: true, mainStat: true, substats: { include: { statType: true } } },
  });

  return toOwnedArtifactItem(updated);
}

export async function removeArtifact(ownedArtifactId: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedArtifact.deleteMany({
    where: { id: ownedArtifactId, gameProfileId: profile.id },
  });
}
