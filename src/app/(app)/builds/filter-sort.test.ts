import { describe, it, expect } from "vitest";
import { filterAndSortBuilds, type BuildItem } from "./filter-sort";

function buildItem(overrides: Partial<BuildItem>): BuildItem {
  return {
    id: 1,
    name: "Test Build",
    ownedCharacterId: 1,
    characterName: "Test Character",
    characterIconUrl: null,
    ownedWeaponId: null,
    weaponName: null,
    weaponIconUrl: null,
    weaponRefinement: null,
    artifacts: [],
    ...overrides,
  };
}

const baseFilters = { search: "", sortKey: "name" as const };

describe("filterAndSortBuilds", () => {
  const builds: BuildItem[] = [
    buildItem({ id: 1, name: "Main DPS", characterName: "Hu Tao" }),
    buildItem({ id: 2, name: "Support", characterName: "Kazuha" }),
    buildItem({ id: 3, name: "Alt Build", characterName: "Hu Tao" }),
  ];

  it("returns everything sorted by name with no filters applied", () => {
    const result = filterAndSortBuilds(builds, baseFilters);
    expect(result.map((b) => b.name)).toEqual(["Alt Build", "Main DPS", "Support"]);
  });

  it("filters by case-insensitive, whitespace-trimmed build name", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, search: "  main  " });
    expect(result.map((b) => b.name)).toEqual(["Main DPS"]);
  });

  it("filters by character name too, not just build name", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, search: "kazuha" });
    expect(result.map((b) => b.name)).toEqual(["Support"]);
  });

  it("sorts by character, breaking ties by build name", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, sortKey: "character" });
    // Hu Tao's two builds tie on character name and fall back to build name order.
    expect(result.map((b) => `${b.characterName}: ${b.name}`)).toEqual([
      "Hu Tao: Alt Build",
      "Hu Tao: Main DPS",
      "Kazuha: Support",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
