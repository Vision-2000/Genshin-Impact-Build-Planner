import { describe, it, expect } from "vitest";
import { detectOverlaps, type OverlapCheckBuild } from "./overlap";

function build(overrides: Partial<OverlapCheckBuild>): OverlapCheckBuild {
  return {
    buildId: 1,
    ownedCharacterId: 1,
    exclusivityGroup: null,
    ownedWeaponId: null,
    ownedArtifactIds: [],
    ...overrides,
  };
}

describe("detectOverlaps", () => {
  it("returns no conflicts for an empty list", () => {
    expect(detectOverlaps([])).toEqual([]);
  });

  it("returns no conflicts for a single build", () => {
    const result = detectOverlaps([build({ buildId: 1 })]);
    expect(result).toEqual([]);
  });

  it("returns no conflicts when builds share nothing", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, ownedWeaponId: 10, ownedArtifactIds: [100] }),
      build({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 20, ownedArtifactIds: [200] }),
    ]);
    expect(result).toEqual([]);
  });

  it("flags a duplicate character across builds", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 5 }),
      build({ buildId: 2, ownedCharacterId: 5 }),
    ]);
    expect(result).toEqual([{ type: "duplicate-character", ownedCharacterId: 5, buildIds: [1, 2] }]);
  });

  it("flags an exclusivityGroup collision even across different characters", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, exclusivityGroup: "traveler" }),
      build({ buildId: 2, ownedCharacterId: 2, exclusivityGroup: "traveler" }),
    ]);
    expect(result).toEqual([{ type: "exclusivity-conflict", exclusivityGroup: "traveler", buildIds: [1, 2] }]);
  });

  it("never treats multiple null exclusivityGroups as a collision", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, exclusivityGroup: null }),
      build({ buildId: 2, ownedCharacterId: 2, exclusivityGroup: null }),
    ]);
    expect(result).toEqual([]);
  });

  it("flags a shared weapon across builds", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, ownedWeaponId: 42 }),
      build({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 42 }),
    ]);
    expect(result).toEqual([{ type: "shared-weapon", ownedWeaponId: 42, buildIds: [1, 2] }]);
  });

  it("never treats multiple null weapons (no weapon equipped) as a collision", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, ownedWeaponId: null }),
      build({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: null }),
    ]);
    expect(result).toEqual([]);
  });

  it("flags a shared artifact across builds", () => {
    const result = detectOverlaps([
      build({ buildId: 1, ownedCharacterId: 1, ownedArtifactIds: [7, 8] }),
      build({ buildId: 2, ownedCharacterId: 2, ownedArtifactIds: [8, 9] }),
    ]);
    expect(result).toEqual([{ type: "shared-artifact", ownedArtifactId: 8, buildIds: [1, 2] }]);
  });

  it("does not false-positive when a build lists the same artifact id twice in its own list", () => {
    const result = detectOverlaps([build({ buildId: 1, ownedCharacterId: 1, ownedArtifactIds: [7, 7] })]);
    expect(result).toEqual([]);
  });

  it("reports every conflict when multiple builds collide in different ways at once", () => {
    const builds = [
      build({ buildId: 1, ownedCharacterId: 1, ownedWeaponId: 42, ownedArtifactIds: [100] }),
      build({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 42, ownedArtifactIds: [200] }),
      build({ buildId: 3, ownedCharacterId: 3, ownedWeaponId: 99, ownedArtifactIds: [100] }),
    ];
    const result = detectOverlaps(builds);

    expect(result).toContainEqual({ type: "shared-weapon", ownedWeaponId: 42, buildIds: [1, 2] });
    expect(result).toContainEqual({ type: "shared-artifact", ownedArtifactId: 100, buildIds: [1, 3] });
    expect(result).toHaveLength(2);
  });
});
