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

  it("returns everything sorted by name with no search", () => {
    const result = filterTeams(teams, "");
    expect(result.map((t) => t.name)).toEqual(["Anemo Team", "National Team", "Vaporize Team"]);
  });

  it("filters by case-insensitive, whitespace-trimmed team name", () => {
    const result = filterTeams(teams, "  national  ");
    expect(result.map((t) => t.name)).toEqual(["National Team"]);
  });

  it("filters by a member's character name too, not just the team name", () => {
    const result = filterTeams(teams, "kazuha");
    expect(result.map((t) => t.name)).toEqual(["Anemo Team"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterTeams(teams, "nonexistent");
    expect(result).toEqual([]);
  });
});
