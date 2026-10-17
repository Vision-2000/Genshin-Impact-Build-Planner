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

  it("sorts by rarity ascending, breaking ties by name", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Favonius Sword", "Widsith", "Amos' Bow", "Aquila Favonia"]);
  });

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortWeaponCatalog(catalog, {
      ...catalogBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Amos' Bow", "Aquila Favonia", "Favonius Sword", "Widsith"]);
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
    }),
    ownedItem({
      id: 2,
      name: "Widsith",
      weaponType: WeaponType.Catalyst,
      rarity: 4,
      refinement: 5,
      level: 90,
      secondaryStatName: "Elemental Mastery",
    }),
    ownedItem({
      id: 3,
      name: "Favonius Sword",
      weaponType: WeaponType.Sword,
      rarity: 4,
      refinement: 3,
      level: 70,
      secondaryStatName: "Energy Recharge%",
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

  it("sorts by rarity ascending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Favonius Sword", "Widsith", "Aquila Favonia"]);
  });

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by refinement ascending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "refinement" });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by refinement descending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "refinement",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by level ascending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "level" });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by level descending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, {
      ...ownedBaseFilters,
      sortKey: "level",
      sortDirection: "desc",
    });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortDirection: "desc" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
