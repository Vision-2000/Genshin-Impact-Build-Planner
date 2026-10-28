import { describe, it, expect } from "vitest";
import { filterTeams, type TeamItem, type TeamMemberItem } from "./filter-sort";

function member(overrides: Partial<TeamMemberItem>): TeamMemberItem {
  return { buildId: 1, name: "Main DPS", characterName: "Hu Tao", characterIconUrl: null, ...overrides };
}

function team(overrides: Partial<TeamItem>): TeamItem {
  return { id: 1, name: "Test Team", members: [], ...overrides };
}

describe("filterTeams", () => {
  const teams: TeamItem[] = [
    team({ id: 1, name: "National Team", members: [member({ characterName: "Xingqiu" })] }),
    team({ id: 2, name: "Vaporize Team", members: [member({ characterName: "Hu Tao" })] }),
    team({ id: 3, name: "Anemo Team", members: [member({ characterName: "Kazuha" })] }),
  ];

  it("returns everything in its given order with no search, not sorted by name", () => {
    // TeamManager hands this whatever order it's already maintaining
    // (most-recently-updated-first, from the server's own orderBy and its
    // own optimistic reordering) -- filterTeams has no sort of its own
    // and must preserve that, not re-sort by name.
    const result = filterTeams(teams, "");
    expect(result.map((t) => t.name)).toEqual(["National Team", "Vaporize Team", "Anemo Team"]);
  });

  it("filters by case-insensitive, whitespace-trimmed team name", () => {
    const result = filterTeams(teams, "  national  ");
    expect(result.map((t) => t.name)).toEqual(["National Team"]);
  });

  it("filters by a member's character name too, not just the team name", () => {
    const result = filterTeams(teams, "kazuha");
    expect(result.map((t) => t.name)).toEqual(["Anemo Team"]);
  });

  it("preserves original relative order across multiple matches, not alphabetical", () => {
    const result = filterTeams(teams, "team");
    expect(result.map((t) => t.name)).toEqual(["National Team", "Vaporize Team", "Anemo Team"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterTeams(teams, "nonexistent");
    expect(result).toEqual([]);
  });
});
