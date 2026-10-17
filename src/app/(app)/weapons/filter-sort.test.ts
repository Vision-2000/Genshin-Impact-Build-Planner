import { describe, it, expect } from "vitest";
import { WeaponType } from "@/generated/prisma/enums";
import {
  filterAndSortWeaponCatalog,
  filterAndSortOwnedWeapons,
  type WeaponCatalogItem,
  type OwnedWeaponItem,
} from "./filter-sort";

function catalogItem(overrides: Partial<WeaponCatalogItem>): WeaponCatalogItem {
  return {
    id: 1,
    name: "Test Weapon",
    weaponType: WeaponType.Sword,
    rarity: 4,
    secondaryStatName: null,
    iconUrl: null,
    splashUrl: null,
    maxRefinement: 5,
    hoverDetail: { attack: 0, secondaryStatValue: null, passiveName: null, passiveDescription: null },
    ...overrides,
  };
}

function ownedItem(overrides: Partial<OwnedWeaponItem>): OwnedWeaponItem {
  return {
    id: 1,
    weaponId: 1,
    name: "Test Weapon",
    weaponType: WeaponType.Sword,
    rarity: 4,
    secondaryStatName: null,
    iconUrl: null,
    splashUrl: null,
    refinement: 1,
    level: 1,
    ascensionPhase: 0,
    hoverDetail: { attack: 0, secondaryStatValue: null, passiveName: null, passiveDescription: null },
    createdAt: 0,
    ...overrides,
  };
}

const catalogBaseFilters = {
  search: "",
  weaponTypeFilter: new Set<WeaponType>(),
  rarityFilter: new Set<number>(),
  secondaryStatFilter: "",
  sortKey: "name" as const,
  sortDirection: "asc" as const,
};

const ownedBaseFilters = {
  search: "",
  weaponTypeFilter: new Set<WeaponType>(),
  rarityFilter: new Set<number>(),
  secondaryStatFilter: "",
  sortKey: "name" as const,
  sortDirection: "asc" as const,
};

describe("filterAndSortWeaponCatalog", () => {
  const catalog: WeaponCatalogItem[] = [
    catalogItem({ id: 1, name: "Aquila Favonia", weaponType: WeaponType.Sword, rarity: 5, secondaryStatName: "Physical DMG Bonus%" }),
    catalogItem({ id: 2, name: "Widsith", weaponType: WeaponType.Catalyst, rarity: 4, secondaryStatName: "Elemental Mastery" }),
    catalogItem({ id: 3, name: "Amos' Bow", weaponType: WeaponType.Bow, rarity: 5, secondaryStatName: "Crit DMG%" }),
    catalogItem({ id: 4, name: "Favonius Sword", weaponType: WeaponType.Sword, rarity: 4, secondaryStatName: "Energy Recharge%" }),
  ];

  it("returns everything sorted by name with no filters applied", () => {
    const result = filterAndSortWeaponCatalog(catalog, catalogBaseFilters);
    expect(result.map((w) => w.name)).toEqual(["Amos' Bow", "Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("filters by case-insensitive, whitespace-trimmed name substring", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, search: "  favo  " });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword"]);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortWeaponCatalog(catalog, {
      ...catalogBaseFilters,
      weaponTypeFilter: new Set([WeaponType.Sword]),
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword"]);
  });

  it("combines search and weapon type filters", () => {
    const result = filterAndSortWeaponCatalog(catalog, {
      ...catalogBaseFilters,
      search: "sword",
      weaponTypeFilter: new Set([WeaponType.Sword]),
    });
    expect(result.map((w) => w.name)).toEqual(["Favonius Sword"]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, rarityFilter: new Set([5]) });
    expect(result.map((w) => w.name)).toEqual(["Amos' Bow", "Aquila Favonia"]);
  });

  it("filters by exact secondary stat", () => {
    const result = filterAndSortWeaponCatalog(catalog, {
      ...catalogBaseFilters,
      secondaryStatFilter: "Elemental Mastery",
    });
    expect(result.map((w) => w.name)).toEqual(["Widsith"]);
  });

  it("sorts by rarity forward (highest first), breaking ties by name", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Amos' Bow", "Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by rarity reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortWeaponCatalog(catalog, {
      ...catalogBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Favonius Sword", "Widsith", "Amos' Bow", "Aquila Favonia"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, sortDirection: "desc" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia", "Amos' Bow"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("filterAndSortOwnedWeapons", () => {
  const owned: OwnedWeaponItem[] = [
    ownedItem({
      id: 1,
      name: "Aquila Favonia",
      weaponType: WeaponType.Sword,
      rarity: 5,
      refinement: 1,
      level: 40,
      secondaryStatName: "Physical DMG Bonus%",
      createdAt: 100,
    }),
    ownedItem({
      id: 2,
      name: "Widsith",
      weaponType: WeaponType.Catalyst,
      rarity: 4,
      refinement: 5,
      level: 90,
      secondaryStatName: "Elemental Mastery",
      createdAt: 300,
    }),
    ownedItem({
      id: 3,
      name: "Favonius Sword",
      weaponType: WeaponType.Sword,
      rarity: 4,
      refinement: 3,
      level: 70,
      secondaryStatName: "Energy Recharge%",
      createdAt: 200,
    }),
  ];

  it("returns everything sorted by name with no filters applied", () => {
    const result = filterAndSortOwnedWeapons(owned, ownedBaseFilters);
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("filters by name search", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, search: "widsith" });
    expect(result.map((w) => w.name)).toEqual(["Widsith"]);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      weaponTypeFilter: new Set([WeaponType.Sword]),
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword"]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, rarityFilter: new Set([5]) });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia"]);
  });

  it("filters by exact secondary stat", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      secondaryStatFilter: "Elemental Mastery",
    });
    expect(result.map((w) => w.name)).toEqual(["Widsith"]);
  });

  it("sorts by rarity forward (highest first), breaking ties by added (newest first)", () => {
    // Widsith and Favonius Sword tie at rarity 4 -- Widsith (createdAt 300)
    // is more recently added than Favonius Sword (createdAt 200), so it
    // sorts first despite "Favonius" coming first alphabetically.
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Widsith", "Favonius Sword"]);
  });

  it("sorts by rarity reversed (lowest first), still breaking ties by added (newest first)", () => {
    // The tiebreaker's own direction is fixed (always newest-first),
    // independent of whether the primary rarity sort itself is forward or
    // reversed.
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by refinement forward (highest first), breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "refinement" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by refinement reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "refinement",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by level forward (highest first), breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "level" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by level reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "level",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortDirection: "desc" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("breaks a name tie (two copies of the same weapon) by added, newest first", () => {
    const duplicates: OwnedWeaponItem[] = [
      ownedItem({ id: 10, name: "Widsith", createdAt: 400 }),
      ownedItem({ id: 11, name: "Widsith", createdAt: 500 }),
    ];
    const result = filterAndSortOwnedWeapons(duplicates, ownedBaseFilters);
    expect(result.map((w) => w.id)).toEqual([11, 10]);
  });

  it("sorts by obtained forward (newest createdAt first)", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "obtained" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by obtained reversed (oldest createdAt first)", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "obtained",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
