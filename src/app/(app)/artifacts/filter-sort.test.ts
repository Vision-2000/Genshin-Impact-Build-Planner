import { describe, it, expect } from "vitest";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { computeArtifactMainStatValue, type SubstatTypeName } from "./artifact-rules";
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
    twoPieceEffect: "2pc effect",
    fourPieceEffect: "4pc effect",
    substats: [],
    createdAt: 0,
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
    twoPieceStatName: "ATK%",
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
      createdAt: 100,
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
      createdAt: 200,
      substats: [substat({ id: 3, statTypeName: "Crit DMG%", value: 15.5 })],
    }),
    ownedItem({
      id: 3,
      setName: "Noblesse Oblige",
      slot: ArtifactSlot.Flower,
      rarity: 5,
      level: 8,
      createdAt: 300,
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

  it("sorts by rarity forward (highest first), breaking ties by added (newest first)", () => {
    // Gladiator's Finale and Noblesse Oblige tie at rarity 5 -- Noblesse
    // Oblige (createdAt 300) is more recently added than Gladiator's Finale
    // (createdAt 100), so it sorts first despite "Gladiator's" coming first
    // alphabetically.
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "rarity" });
    expect(result.map((a) => a.setName)).toEqual(["Noblesse Oblige", "Gladiator's Finale", "Wanderer's Troupe"]);
  });

  it("sorts by rarity reversed (lowest first), still breaking ties by added (newest first)", () => {
    // The tiebreaker's own direction is fixed (always newest-first),
    // independent of whether the primary rarity sort itself is forward or
    // reversed.
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "rarity", sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe", "Noblesse Oblige", "Gladiator's Finale"]);
  });

  it("sorts by level forward (highest first) (no tie here -- every level is distinct)", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "level" });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("sorts by level reversed (lowest first) (no tie here -- every level is distinct)", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "level", sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Wanderer's Troupe", "Noblesse Oblige", "Gladiator's Finale"]);
  });

  it("sorts by obtained forward (newest createdAt first)", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "obtained" });
    expect(result.map((a) => a.setName)).toEqual(["Noblesse Oblige", "Wanderer's Troupe", "Gladiator's Finale"]);
  });

  it("sorts by obtained reversed (oldest createdAt first)", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "obtained", sortDirection: "desc" });
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Wanderer's Troupe", "Noblesse Oblige"]);
  });

  it("breaks a name tie (two pieces from the same set) by added, newest first", () => {
    const duplicates: OwnedArtifactItem[] = [
      ownedItem({ id: 10, setName: "Gladiator's Finale", createdAt: 400 }),
      ownedItem({ id: 11, setName: "Gladiator's Finale", createdAt: 500 }),
    ];
    const result = filterAndSortOwnedArtifacts(duplicates, baseFilters);
    expect(result.map((a) => a.id)).toEqual([11, 10]);
  });

  it("sorts by a stat's value forward (highest first), treating artifacts without it as lowest", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, { ...baseFilters, sortKey: "Crit Rate%" });
    // Only id 1 has Crit Rate%; the other two tie at "absent" and fall back
    // to added (newest first) -- Noblesse Oblige (id 3, createdAt 300) is
    // newer than Wanderer's Troupe (id 2, createdAt 200).
    expect(result.map((a) => a.setName)).toEqual(["Gladiator's Finale", "Noblesse Oblige", "Wanderer's Troupe"]);
  });

  it("sorts by a stat's value reversed (lowest first), treating artifacts without it as lowest", () => {
    const result = filterAndSortOwnedArtifacts(artifacts, {
      ...baseFilters,
      sortKey: "Crit Rate%",
      sortDirection: "desc",
    });
    expect(result.map((a) => a.setName)).toEqual(["Noblesse Oblige", "Wanderer's Troupe", "Gladiator's Finale"]);
  });

  it("sorting by a stat includes the piece's main stat, not just its substats", () => {
    const circletMainStatOnly = ownedItem({
      id: 20,
      setName: "Main Stat Only",
      rarity: 5,
      level: 0,
      mainStatName: "Crit Rate%",
      substats: [],
    });
    const circletMainStatAndSubstat = ownedItem({
      id: 21,
      setName: "Main Stat Plus Substat",
      rarity: 5,
      level: 0,
      mainStatName: "Crit Rate%",
      substats: [substat({ statTypeName: "Crit Rate%", value: 3.89 })],
    });
    const noCritRateAtAll = ownedItem({ id: 22, setName: "Neither", rarity: 5, level: 0 });

    const result = filterAndSortOwnedArtifacts(
      [noCritRateAtAll, circletMainStatOnly, circletMainStatAndSubstat],
      { ...baseFilters, sortKey: "Crit Rate%" }
    );

    // Main-stat-only sorts by its own main stat value (not "absent") --
    // Crit Rate%'s 5-star level-0 main stat value is 4.7 (see
    // artifact-rules.test.ts). Main stat + substat sorts by their SUM
    // (4.7 + 3.89 = 8.59), ahead of main-stat-only.
    expect(result.map((a) => a.setName)).toEqual(["Main Stat Plus Substat", "Main Stat Only", "Neither"]);
    expect(computeArtifactMainStatValue("Crit Rate%", 5, 0)).toBe(4.7);
  });

  it("sorts by a main-stat-only stat (never a substat), not just the 10 substat-eligible names", () => {
    const healingBonusCirclet = ownedItem({
      id: 30,
      setName: "Healing Circlet",
      rarity: 5,
      level: 0,
      mainStatName: "Healing Bonus%",
    });
    const noHealingBonus = ownedItem({ id: 31, setName: "No Healing Bonus", rarity: 5, level: 0 });

    const result = filterAndSortOwnedArtifacts([noHealingBonus, healingBonusCirclet], {
      ...baseFilters,
      sortKey: "Healing Bonus%",
    });

    expect(result.map((a) => a.setName)).toEqual(["Healing Circlet", "No Healing Bonus"]);
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
    twoPieceStatFilter: "",
    sortKey: "name" as const,
    sortDirection: "asc" as const,
  };

  const catalog: ArtifactSetCatalogItem[] = [
    catalogItem({ id: 1, name: "Viridescent Venerer", rarity: 5, twoPieceStatName: "Anemo DMG Bonus%" }),
    catalogItem({ id: 2, name: "Crimson Witch of Flames", rarity: 5, twoPieceStatName: "Pyro DMG Bonus%" }),
    catalogItem({ id: 3, name: "Emblem of Severed Fate", rarity: 5, twoPieceStatName: "Energy Recharge%" }),
    catalogItem({ id: 4, name: "Instructor", rarity: 4, twoPieceStatName: null }),
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

  it("filters by exact 2pc stat", () => {
    const result = filterArtifactSetCatalog(catalog, {
      ...catalogBaseFilters,
      twoPieceStatFilter: "Pyro DMG Bonus%",
    });
    expect(result.map((s) => s.name)).toEqual(["Crimson Witch of Flames"]);
  });

  it('groups sets with no 2pc stat bonus under "Others"', () => {
    const result = filterArtifactSetCatalog(catalog, {
      ...catalogBaseFilters,
      twoPieceStatFilter: "Others",
    });
    expect(result.map((s) => s.name)).toEqual(["Instructor"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("sorts by release forward (newest id first)", () => {
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, sortKey: "release" });
    expect(result.map((s) => s.name)).toEqual([
      "Instructor",
      "Emblem of Severed Fate",
      "Crimson Witch of Flames",
      "Viridescent Venerer",
    ]);
  });

  it("sorts by release reversed (oldest id first)", () => {
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

  it("sorts by rarity forward (highest first), breaking ties by release (newest first)", () => {
    // Viridescent Venerer (id 1), Crimson Witch of Flames (id 2), and
    // Emblem of Severed Fate (id 3) all tie at rarity 5 -- the newest
    // (highest id) of the three sorts first, not the alphabetically first.
    const result = filterArtifactSetCatalog(catalog, { ...catalogBaseFilters, sortKey: "rarity" });
    expect(result.map((s) => s.name)).toEqual([
      "Emblem of Severed Fate",
      "Crimson Witch of Flames",
      "Viridescent Venerer",
      "Instructor",
    ]);
  });

  it("sorts by rarity reversed (lowest first), still breaking ties by release (newest first)", () => {
    // The tiebreaker's own direction is fixed (always newest-first),
    // independent of whether the primary rarity sort itself is forward or
    // reversed.
    const result = filterArtifactSetCatalog(catalog, {
      ...catalogBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((s) => s.name)).toEqual([
      "Instructor",
      "Emblem of Severed Fate",
      "Crimson Witch of Flames",
      "Viridescent Venerer",
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
