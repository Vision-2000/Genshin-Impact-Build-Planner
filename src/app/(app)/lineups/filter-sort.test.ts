import { describe, it, expect } from "vitest";
import {
  filterLineups,
  combinedOverlapBuilds,
  type LineupItem,
  type LineupMemberItem,
  type TeamOption,
} from "./filter-sort";
import type { OverlapCheckBuild } from "@/lib/overlap";

function buildCheck(overrides: Partial<OverlapCheckBuild>): OverlapCheckBuild {
  return {
    buildId: 1,
    ownedCharacterId: 1,
    exclusivityGroup: null,
    ownedWeaponId: null,
    ownedArtifactIds: [],
    ...overrides,
  };
}

function member(overrides: Partial<LineupMemberItem>): LineupMemberItem {
  return { teamId: 1, teamName: "National Team", ...overrides };
}

function lineup(overrides: Partial<LineupItem>): LineupItem {
  return { id: 1, name: "Test Lineup", members: [], ...overrides };
}

describe("filterLineups", () => {
  const lineups: LineupItem[] = [
    lineup({ id: 1, name: "Floor 12 Lineup", members: [member({ teamName: "National Team" })] }),
    lineup({ id: 2, name: "Floor 11 Lineup", members: [member({ teamName: "Freeze Team" })] }),
    lineup({ id: 3, name: "Farming Lineup", members: [member({ teamName: "Overworld Team" })] }),
  ];

  it("returns everything sorted by name with no search", () => {
    const result = filterLineups(lineups, "");
    expect(result.map((l) => l.name)).toEqual(["Farming Lineup", "Floor 11 Lineup", "Floor 12 Lineup"]);
  });

  it("filters by case-insensitive, whitespace-trimmed lineup name", () => {
    const result = filterLineups(lineups, "  floor 12  ");
    expect(result.map((l) => l.name)).toEqual(["Floor 12 Lineup"]);
  });

  it("filters by a member's team name too, not just the lineup name", () => {
    const result = filterLineups(lineups, "freeze");
    expect(result.map((l) => l.name)).toEqual(["Floor 11 Lineup"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterLineups(lineups, "nonexistent");
    expect(result).toEqual([]);
  });
});

describe("combinedOverlapBuilds", () => {
  const teams: TeamOption[] = [
    { teamId: 1, name: "Team A", builds: [buildCheck({ buildId: 1, ownedCharacterId: 1 })] },
    { teamId: 2, name: "Team B", builds: [buildCheck({ buildId: 2, ownedCharacterId: 2 })] },
    { teamId: 3, name: "Team C", builds: [buildCheck({ buildId: 3, ownedCharacterId: 3 })] },
  ];

  it("flattens builds only from the given team ids", () => {
    const result = combinedOverlapBuilds(teams, [1, 3]);
    expect(result.map((b) => b.buildId)).toEqual([1, 3]);
  });

  it("returns an empty list when no team ids are given", () => {
    expect(combinedOverlapBuilds(teams, [])).toEqual([]);
  });
});
