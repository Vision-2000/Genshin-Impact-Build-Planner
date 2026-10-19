"use server";

import { ArtifactSlot } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireActiveProfile } from "@/lib/session";
import {
  MAX_SUBSTATS,
  MIN_LEVEL,
  MAX_LEVEL,
  maxLevelForRarity,
  substatValidValues,
  nearestValidValue,
  validateSubstatRollTotal,
  SUBSTAT_TYPE_NAMES,
  type SubstatTypeName,
} from "./artifact-rules";
import { toOwnedArtifactItem, type OwnedArtifactItem } from "./filter-sort";

type SubstatInput = { statTypeId: number; value: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// Defense-in-depth only — the UI already prevents duplicates, the main stat
// being re-picked as a substat, going over the cap, and ever setting a value
// off the roll-based slider in the first place (substatValidValues/
// nearestValidValue, see artifact-rules.ts). rarity/level are the artifact's
// own already-clamped values, not whatever the caller claims, since the
// achievable value set depends on them. Needs a DB round-trip (statTypeId ->
// name) since the caller only sends ids, not names — artifact-rules.ts's
// value tables are keyed by name.
async function sanitizeSubstats(
  substats: SubstatInput[],
  mainStatId: number,
  rarity: number,
  level: number
): Promise<SubstatInput[]> {
  const seen = new Set<number>();
  const deduped: SubstatInput[] = [];

  for (const substat of substats) {
    if (substat.statTypeId === mainStatId) continue;
    if (seen.has(substat.statTypeId)) continue;
    if (deduped.length >= MAX_SUBSTATS) break;
    seen.add(substat.statTypeId);
    deduped.push(substat);
  }

  if (deduped.length === 0) return deduped;

  const statTypes = await prisma.statType.findMany({
    where: { id: { in: deduped.map((s) => s.statTypeId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(statTypes.map((s) => [s.id, s.name]));
  const substatNames: readonly string[] = SUBSTAT_TYPE_NAMES;

  const named: { statTypeId: number; statTypeName: SubstatTypeName; value: number }[] = [];
  for (const substat of deduped) {
    const name = nameById.get(substat.statTypeId);
    // Not a real substat-eligible stat (e.g. a deleted StatType id, or one
    // that only ever appears as a main stat) — drop rather than save a
    // value this app has no roll table for.
    if (!name || !substatNames.includes(name)) continue;

    const validValues = substatValidValues(name as SubstatTypeName, rarity, level);
    named.push({
      statTypeId: substat.statTypeId,
      statTypeName: name as SubstatTypeName,
      value: nearestValidValue(validValues, substat.value),
    });
  }

  // Also defense-in-depth only — ArtifactProgressionForm.handleSubmit
  // already blocks a save whose substats add up to an impossible total roll
  // count (see validateSubstatRollTotal's own comment) before this action is
  // ever called on the normal save path.
  const validation = validateSubstatRollTotal(rarity, level, named);
  if (!validation.valid) throw new Error(validation.reason);

  return named.map(({ statTypeId, value }) => ({ statTypeId, value }));
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
  const clampedLevel = clamp(level, MIN_LEVEL, maxLevel);
  // Default to 5-star when the set lookup somehow misses — matches maxLevel's
  // own fallback above (MAX_LEVEL == maxLevelForRarity(5)).
  const sanitizedSubstats = await sanitizeSubstats(substats, mainStatId, artifactSet?.rarity ?? 5, clampedLevel);

  const created = await prisma.ownedArtifact.create({
    data: {
      gameProfileId: profile.id,
      artifactSetId,
      slot,
      level: clampedLevel,
      mainStatId,
      substats: {
        create: sanitizedSubstats.map((s) => ({
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
  const clampedLevel = clamp(level, MIN_LEVEL, maxLevel);
  const sanitizedSubstats = await sanitizeSubstats(substats, mainStatId, existing.artifactSet.rarity, clampedLevel);

  const updated = await prisma.ownedArtifact.update({
    where: { id: ownedArtifactId },
    data: {
      level: clampedLevel,
      mainStatId,
      substats: {
        deleteMany: {},
        create: sanitizedSubstats.map((s) => ({
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

// Bulk variant for the owned-artifacts page's multi-select delete -- one
// deleteMany scoped to the profile (never trusting a caller-supplied id list
// alone to belong to this profile) rather than one removeArtifact call per id.
export async function removeArtifacts(ownedArtifactIds: number[]) {
  const profile = await requireActiveProfile();

  await prisma.ownedArtifact.deleteMany({
    where: { id: { in: ownedArtifactIds }, gameProfileId: profile.id },
  });
}
