import { describe, it, expect } from "vitest";
import { filterRosters, type RosterItem, type RosterMemberItem } from "./filter-sort";

function member(overrides: Partial<RosterMemberItem>): RosterMemberItem {
  return { buildId: 1, name: "Main DPS", characterName: "Hu Tao", characterIconUrl: null, ...overrides };
}

function roster(overrides: Partial<RosterItem>): RosterItem {
  return { id: 1, name: "Test Roster", members: [], ...overrides };
}

describe("filterRosters", () => {
  const rosters: RosterItem[] = [
    roster({ id: 1, name: "National Roster", members: [member({ characterName: "Xingqiu" })] }),
    roster({ id: 2, name: "Vaporize Roster", members: [member({ characterName: "Hu Tao" })] }),
    roster({ id: 3, name: "Anemo Roster", members: [member({ characterName: "Kazuha" })] }),
  ];

  it("returns everything sorted by name with no search", () => {
    const result = filterRosters(rosters, "");
    expect(result.map((r) => r.name)).toEqual(["Anemo Roster", "National Roster", "Vaporize Roster"]);
  });

  it("filters by case-insensitive, whitespace-trimmed roster name", () => {
    const result = filterRosters(rosters, "  national  ");
    expect(result.map((r) => r.name)).toEqual(["National Roster"]);
  });

  it("filters by a member's character name too, not just the roster name", () => {
    const result = filterRosters(rosters, "kazuha");
    expect(result.map((r) => r.name)).toEqual(["Anemo Roster"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterRosters(rosters, "nonexistent");
    expect(result).toEqual([]);
  });
});
