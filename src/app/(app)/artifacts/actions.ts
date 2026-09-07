"use server";

import { ArtifactSlot } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import { MAX_SUBSTATS, MIN_LEVEL, MAX_LEVEL } from "./artifact-rules";
import { toOwnedArtifactItem, type OwnedArtifactItem, type OwnedArtifactSubstatItem } from "./filter-sort";

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

  const created = await prisma.ownedArtifact.create({
    data: {
      gameProfileId: profile.id,
      artifactSetId,
      slot,
      level: clamp(level, MIN_LEVEL, MAX_LEVEL),
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

export async function updateArtifactLevel(ownedArtifactId: number, level: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedArtifact.updateMany({
    where: { id: ownedArtifactId, gameProfileId: profile.id },
    data: { level: clamp(level, MIN_LEVEL, MAX_LEVEL) },
  });
}

export async function removeArtifact(ownedArtifactId: number) {
  const profile = await requireActiveProfile();

  await prisma.ownedArtifact.deleteMany({
    where: { id: ownedArtifactId, gameProfileId: profile.id },
  });
}

// Ownership is verified via a join through OwnedArtifact.gameProfileId,
// since OwnedArtifactSubstat has no gameProfileId of its own.
async function ownedArtifactIdFor(ownedArtifactSubstatId: number, gameProfileId: number) {
  const substat = await prisma.ownedArtifactSubstat.findFirst({
    where: { id: ownedArtifactSubstatId, ownedArtifact: { gameProfileId } },
    select: { ownedArtifactId: true },
  });
  return substat?.ownedArtifactId ?? null;
}

export async function addSubstat(
  ownedArtifactId: number,
  statTypeId: number,
  value: number
): Promise<OwnedArtifactSubstatItem | null> {
  const profile = await requireActiveProfile();

  const artifact = await prisma.ownedArtifact.findFirst({
    where: { id: ownedArtifactId, gameProfileId: profile.id },
    include: { substats: true },
  });
  if (!artifact) return null;
  if (artifact.substats.length >= MAX_SUBSTATS) return null;
  if (statTypeId === artifact.mainStatId) return null;
  if (artifact.substats.some((s) => s.statTypeId === statTypeId)) return null;

  const created = await prisma.ownedArtifactSubstat.create({
    data: { ownedArtifactId, statTypeId, value },
    include: { statType: true },
  });

  return { id: created.id, statTypeId: created.statTypeId, statTypeName: created.statType.name, value: created.value };
}

export async function updateSubstatValue(ownedArtifactSubstatId: number, value: number) {
  const profile = await requireActiveProfile();
  const ownedArtifactId = await ownedArtifactIdFor(ownedArtifactSubstatId, profile.id);
  if (!ownedArtifactId) return;

  await prisma.ownedArtifactSubstat.update({
    where: { id: ownedArtifactSubstatId },
    data: { value },
  });
}

export async function removeSubstat(ownedArtifactSubstatId: number) {
  const profile = await requireActiveProfile();
  const ownedArtifactId = await ownedArtifactIdFor(ownedArtifactSubstatId, profile.id);
  if (!ownedArtifactId) return;

  await prisma.ownedArtifactSubstat.delete({ where: { id: ownedArtifactSubstatId } });
}
