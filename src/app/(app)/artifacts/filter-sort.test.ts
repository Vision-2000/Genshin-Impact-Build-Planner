import { describe, it, expect } from "vitest";
import { ArtifactSlot } from "@/generated/prisma/enums";
import type { SubstatTypeName } from "./artifact-rules";
import {
  filterAndSortOwnedArtifacts,
  filterArtifactSetCatalog,
  type ArtifactSetCatalogItem,
  type OwnedArtifactItem,
  type OwnedArtifactSubstatItem,
} from "./filter-sort";

function substat(overrides: Partial<OwnedArtifactSubstatItem>): OwnedArtifactSubstatItem {
  return { id: 1, statTypeId: 1, statTypeName: "Crit Rate%", value: 3.9, ...overrides };
}

function ownedItem(overrides: Partial<OwnedArtifactItem>): OwnedArtifactItem {
  return {
    id: 1,
    artifactSetId: 1,
    setName: "Test Set",
    slot: ArtifactSlot.Flower,
    rarity: 5,
    level: 0,
    mainStatId: 1,
    mainStatName: "HP",
    iconUrl: null,
    substats: [],
    ...overrides,
  };
}

function catalogItem(overrides: Partial<ArtifactSetCatalogItem>): ArtifactSetCatalogItem {
  return {
    id: 1,
    name: "Test Set",
    rarity: 5,
    twoPieceEffect: "2pc effect",
    fourPieceEffect: "4pc effect",
    flowerIconUrl: null,
    featherIconUrl: null,
    sandsIconUrl: null,
    gobletIconUrl: null,
    circletIconUrl: null,
    ...overrides,
  };
}

const baseFilters = {
  search: "",
  slotFilter: new Set<ArtifactSlot>(),
  rarityFilter: new Set<number>(),
  substatFilter: new Set<SubstatTypeName>(),
  mainStatFilter: "",
  sortKey: "name" as const,
  sortDirection: "asc" as const,
};

describe("filterAndSortOwnedArtifacts", () => {
  const artifacts: OwnedArtifactItem[] = [
    ownedItem({
      id: 1,
      setName: "Gladiator's Finale",
      slot: ArtifactSlot.Flower,
      rarity: 5,
      level: 20,
      substats: [
        substat({ id: 1, statTypeName: "Crit Rate%", value: 7.8 }),
        substat({ id: 2, statTypeName: "ATK%", value: 5.8 }),
      ],
    }),
    ownedItem({
      id: 2,
      setName: "Wanderer's Troupe",
      slot: ArtifactSlot.Feather,
      rarity: 4,
      level: 4,
      mainStatName: "Crit DMG%",
      substats: [substat({ id: 3, statTypeName: "Crit DMG%", value: 15.5 })],
    }),
    ownedItem({
      id: 3,
      setName: "Noblesse Oblige",
      slot: ArtifactSlot.Flower,
      rarity: 5,
      level: 8,
      substats: [],
    }),
  ];

  it("returns everything sorted by name with no filters applied", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, baseFilters);
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("filters by case-insensitive, whitespace-trimmed set name search", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, search: "  wanderer  " });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe"]);
  });

  it("filters by slot", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, {
      ...baseFilters,
      slotFilter: new Set([ArtifactSlot.Flower]),
    });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige"]);
  });

  it("filters to artifacts that have a given substat", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, {
      ...baseFilters,
      substatFilter: new Set(["Crit Rate%"]),
    });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale"]);
  });

  it("combines multiple substat filters as AND, not OR", () => {
    // id 1 has Crit Rate% but not Crit DMG%; id 2 has Crit DMG% but not Crit Rate%.
    // Requiring both should match neither.
    const result = filterAndSortOwnedArtifacts(artifacts, {
      ...baseFilters,
      substatFilter: new Set(["Crit Rate%", "Crit DMG%"]),
    });
    expect(result).toEqual([]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, rarityFilter: new Set([4]) });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe"]);
  });

  it("filters by main stat", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, mainStatFilter: "Crit DMG%" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe"]);
  });

  it("sorts by rarity ascending, breaking ties by name", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "rarity" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe", "Gladiator's Finale", "Noblesse Oblige"]);
  });

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "rarity", sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("sorts by level ascending, breaking ties by name", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "level" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe", "Noblesse Oblige", "Gladiator's Finale"]);
  });

  it("sorts by level descending, breaking ties by name", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "level", sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("sorts by a substat's value ascending, treating artifacts without that substat as lowest", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "Crit Rate%" });
    // Only id 1 has Crit Rate%; the other two tie at "absent" and fall back to name order.
    expect(result.map((a) => a.setName)).toEqual(["Noblesse Oblige", "Wanderer's Troupe", "Gladiator's Finale"]);
  });

  it("sorts by a substat's value descending, treating artifacts without that substat as lowest", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, {
      ...baseFilters,
      sortKey: "Crit Rate%",
      sortDirection: "desc",
    });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe", "Noblesse Oblige", "Gladiator's Finale"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("filterArtifactSetCatalog", () => {
  const catalogBaseFilters = {
    search: "",
    rarityFilter: new Set<number>(),
    sortKey: "name" as const,
    sortDirection: "asc" as const,
  };

  const catalog: ArtifactSetCatalogItem[] = [
    catalogItem({ id: 1, name: "Viridescent Venerer", rarity: 5 }),
    catalogItem({ id: 2, name: "Crimson Witch of Flames", rarity: 5 }),
    catalogItem({ id: 3, name: "Emblem of Severed Fate", rarity: 5 }),
    catalogItem({ id: 4, name: "Instructor", rarity: 4 }),
  ];

  it("returns everything sorted by name with no filters applied", () => {
    const result = filterArtifactSetCatalog(catalog, catalogBaseFilters);
    expect(result.map((s) => s.name)).toEqual([
      "Crimson Witch of Flames",
      "Emblem of Severed Fate",
      "Instructor",
      "Viridescent Venerer",
    ]);
  });

  it("filters by case-insensitive, whitespace-trimmed name search", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, search: "  crimson  " });
    expect(result.map((s) => s.name)).toEqual(["Crimson Witch of Flames"]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, rarityFilter: new Set([4]) });
    expect(result.map((s) => s.name)).toEqual(["Instructor"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("sorts by release forward (newest id first), breaking ties by name", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, sortKey: "release" });
    expect(result.map((s) => s.name)).toEqual([
      "Instructor",
      "Emblem of Severed Fate",
      "Crimson Witch of Flames",
      "Viridescent Venerer",
    ]);
  });

  it("sorts by release reversed (oldest id first), breaking ties by name", () => {
    const result = filterArtifactSetCatalog(catalog, {
      ...catalogBaseFilters,
      sortKey: "release",
      sortDirection: "desc",
    });
    expect(result.map((s) => s.name)).toEqual([
      "Viridescent Venerer",
      "Crimson Witch of Flames",
      "Emblem of Severed Fate",
      "Instructor",
    ]);
  });

  it("sorts by rarity ascending, breaking ties by name", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, sortKey: "rarity" });
    expect(result.map((s) => s.name)).toEqual([
      "Instructor",
      "Crimson Witch of Flames",
      "Emblem of Severed Fate",
      "Viridescent Venerer",
    ]);
  });

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterArtifactSetCatalog(catalog, {
      ...catalogBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((s) => s.name)).toEqual([
      "Crimson Witch of Flames",
      "Emblem of Severed Fate",
      "Viridescent Venerer",
      "Instructor",
    ]);
  });

  it("sorts by name descending", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, sortDirection: "desc" });
    expect(result.map((s) => s.name)).toEqual([
      "Viridescent Venerer",
      "Instructor",
      "Emblem of Severed Fate",
      "Crimson Witch of Flames",
    ]);
  });
});
