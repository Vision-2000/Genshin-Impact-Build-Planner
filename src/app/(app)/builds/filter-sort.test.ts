import { describe, it, expect } from "vitest";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { filterAndSortBuilds, type BuildItem } from "./filter-sort";

function buildItem(overrides: Partial<BuildItem>): BuildItem {
  return {
    id: 1,
    name: "Test Build",
    ownedCharacterId: 1,
    characterName: "Test Character",
    characterIconUrl: null,
    characterElement: Element.Pyro,
    characterRarity: 5,
    characterWeaponType: WeaponType.Polearm,
    ownedWeaponId: null,
    weaponName: null,
    weaponIconUrl: null,
    weaponRefinement: null,
    weaponRarity: null,
    artifacts: [],
    activeSetEffects: [],
    createdAt: 0,
    ...overrides,
  };
}

const baseFilters = {
  buildNameSearch: "",
  characterNameSearch: "",
  elementFilter: new Set<Element>(),
  weaponTypeFilter: new Set<WeaponType>(),
  rarityFilter: new Set<number>(),
  sortKey: "obtained" as const,
  sortDirection: "asc" as const,
};

describe("filterAndSortBuilds", () => {
  const builds: BuildItem[] = [
    buildItem({ id: 1, name: "Main DPS", characterName: "Hu Tao", createdAt: 100 }),
    buildItem({ id: 2, name: "Support", characterName: "Kazuha", createdAt: 300 }),
    buildItem({ id: 3, name: "Alt Build", characterName: "Hu Tao", createdAt: 200 }),
  ];

  it("returns everything sorted by obtained (newest first) with no filters applied", () => {
    const result = filterAndSortBuilds(builds, baseFilters);
    expect(result.map((b) => b.name)).toEqual(["Support", "Alt Build", "Main DPS"]);
  });

  it("filters by case-insensitive, whitespace-trimmed build name", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, buildNameSearch: "  main  " });
    expect(result.map((b) => b.name)).toEqual(["Main DPS"]);
  });

  it("filters by character name via the separate character query", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, characterNameSearch: "kazuha" });
    expect(result.map((b) => b.name)).toEqual(["Support"]);
  });

  it("combines both queries as AND, not OR", () => {
    // "Hu Tao" matches two builds' own character, but only one of them is
    // also named "Alt Build" -- a build has to satisfy BOTH to show up.
    const result = filterAndSortBuilds(builds, {
      ...baseFilters,
      buildNameSearch: "alt",
      characterNameSearch: "hu tao",
    });
    expect(result.map((b) => b.name)).toEqual(["Alt Build"]);

    const none = filterAndSortBuilds(builds, { ...baseFilters, buildNameSearch: "alt", characterNameSearch: "kazuha" });
    expect(none).toEqual([]);
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
    const result = filterAndSortBuilds(builds, { ...baseFilters, buildNameSearch: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("sorts by obtained oldest-first when direction is desc", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, sortDirection: "desc" });
    expect(result.map((b) => b.name)).toEqual(["Main DPS", "Alt Build", "Support"]);
  });

  it("sorts by character descending, breaking ties by build name ascending", () => {
    const result = filterAndSortBuilds(builds, { ...baseFilters, sortKey: "character", sortDirection: "desc" });
    expect(result.map((b) => `${b.characterName}: ${b.name}`)).toEqual([
      "Kazuha: Support",
      "Hu Tao: Alt Build",
      "Hu Tao: Main DPS",
    ]);
  });

  // Same character-page filters (element/weapon type/rarity) as the owned
  // characters page itself -- matched against each build's own character,
  // since a build IS a character (see filterAndSortBuilds's own comment).
  describe("character-page filters", () => {
    const mixedBuilds: BuildItem[] = [
      buildItem({
        id: 1,
        name: "Pyro Polearm 5-star",
        characterElement: Element.Pyro,
        characterWeaponType: WeaponType.Polearm,
        characterRarity: 5,
      }),
      buildItem({
        id: 2,
        name: "Hydro Sword 4-star",
        characterElement: Element.Hydro,
        characterWeaponType: WeaponType.Sword,
        characterRarity: 4,
      }),
    ];

    it("filters by element", () => {
      const result = filterAndSortBuilds(mixedBuilds, { ...baseFilters, elementFilter: new Set([Element.Hydro]) });
      expect(result.map((b) => b.name)).toEqual(["Hydro Sword 4-star"]);
    });

    it("filters by weapon type", () => {
      const result = filterAndSortBuilds(mixedBuilds, {
        ...baseFilters,
        weaponTypeFilter: new Set([WeaponType.Polearm]),
      });
      expect(result.map((b) => b.name)).toEqual(["Pyro Polearm 5-star"]);
    });

    it("filters by rarity", () => {
      const result = filterAndSortBuilds(mixedBuilds, { ...baseFilters, rarityFilter: new Set([4]) });
      expect(result.map((b) => b.name)).toEqual(["Hydro Sword 4-star"]);
    });

    it("combines multiple filters (AND, not OR)", () => {
      const result = filterAndSortBuilds(mixedBuilds, {
        ...baseFilters,
        elementFilter: new Set([Element.Pyro]),
        rarityFilter: new Set([4]),
      });
      expect(result).toEqual([]);
    });
  });
});
