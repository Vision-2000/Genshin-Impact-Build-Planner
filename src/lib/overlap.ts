// Generic overlap-detection over "a set of builds" — shared by team/roster
// live selection warnings, full validation, and saved Lineup display. Do not
// reimplement this per screen (see CLAUDE.md).
//
// All four conflict types are hard blocks, not advisory warnings: a
// duplicate character or a shared exclusivityGroup (e.g. two Traveler
// visions) can never both be in a party, and shared weapon/artifact reuse is
// blocked the same way, not just flagged.

export type OverlapCheckBuild = {
  buildId: number;
  ownedCharacterId: number;
  exclusivityGroup: string | null;
  ownedWeaponId: number | null;
  ownedArtifactIds: number[];
};

export type OverlapConflict =
  | { type: "duplicate-character"; ownedCharacterId: number; buildIds: number[] }
  | { type: "exclusivity-conflict"; exclusivityGroup: string; buildIds: number[] }
  | { type: "shared-weapon"; ownedWeaponId: number; buildIds: number[] }
  | { type: "shared-artifact"; ownedArtifactId: number; buildIds: number[] };

export function detectOverlaps(builds: OverlapCheckBuild[]): OverlapConflict[] {
  const conflicts: OverlapConflict[] = [];

  const byCharacter = new Map<number, number[]>();
  for (const build of builds) {
    const group = byCharacter.get(build.ownedCharacterId) ?? [];
    group.push(build.buildId);
    byCharacter.set(build.ownedCharacterId, group);
  }
  for (const [ownedCharacterId, buildIds] of byCharacter) {
    if (buildIds.length > 1) conflicts.push({ type: "duplicate-character", ownedCharacterId, buildIds });
  }

  const byExclusivityGroup = new Map<string, number[]>();
  for (const build of builds) {
    if (build.exclusivityGroup === null) continue;
    const group = byExclusivityGroup.get(build.exclusivityGroup) ?? [];
    group.push(build.buildId);
    byExclusivityGroup.set(build.exclusivityGroup, group);
  }
  for (const [exclusivityGroup, buildIds] of byExclusivityGroup) {
    if (buildIds.length > 1) conflicts.push({ type: "exclusivity-conflict", exclusivityGroup, buildIds });
  }

  const byWeapon = new Map<number, number[]>();
  for (const build of builds) {
    if (build.ownedWeaponId === null) continue;
    const group = byWeapon.get(build.ownedWeaponId) ?? [];
    group.push(build.buildId);
    byWeapon.set(build.ownedWeaponId, group);
  }
  for (const [ownedWeaponId, buildIds] of byWeapon) {
    if (buildIds.length > 1) conflicts.push({ type: "shared-weapon", ownedWeaponId, buildIds });
  }

  const byArtifact = new Map<number, Set<number>>();
  for (const build of builds) {
    for (const ownedArtifactId of build.ownedArtifactIds) {
      const group = byArtifact.get(ownedArtifactId) ?? new Set<number>();
      group.add(build.buildId);
      byArtifact.set(ownedArtifactId, group);
    }
  }
  for (const [ownedArtifactId, buildIdSet] of byArtifact) {
    if (buildIdSet.size > 1) conflicts.push({ type: "shared-artifact", ownedArtifactId, buildIds: [...buildIdSet] });
  }

  return conflicts;
}
