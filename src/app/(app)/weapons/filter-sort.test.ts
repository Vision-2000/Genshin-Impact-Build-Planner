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
    refinement: 1,
    ...overrides,
  };
}

const catalogBaseFilters = {
  search: "",
  weaponTypeFilter: new Set<WeaponType>(),
  sortKey: "name" as const,
};

const ownedBaseFilters = {
  search: "",
  weaponTypeFilter: new Set<WeaponType>(),
  sortKey: "name" as const,
};

describe("filterAndSortWeaponCatalog", () => {
  const catalog: WeaponCatalogItem[] = [
    catalogItem({ id: 1, name: "Aquila Favonia", weaponType: WeaponType.Sword, rarity: 5 }),
    catalogItem({ id: 2, name: "Widsith", weaponType: WeaponType.Catalyst, rarity: 4 }),
    catalogItem({ id: 3, name: "Amos' Bow", weaponType: WeaponType.Bow, rarity: 5 }),
    catalogItem({ id: 4, name: "Favonius Sword", weaponType: WeaponType.Sword, rarity: 4 }),
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

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Amos' Bow", "Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortWeaponCatalog(catalog, { ...catalogBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("filterAndSortOwnedWeapons", () => {
  const owned: OwnedWeaponItem[] = [
    ownedItem({ id: 1, name: "Aquila Favonia", weaponType: WeaponType.Sword, rarity: 5, refinement: 1 }),
    ownedItem({ id: 2, name: "Widsith", weaponType: WeaponType.Catalyst, rarity: 4, refinement: 5 }),
    ownedItem({ id: 3, name: "Favonius Sword", weaponType: WeaponType.Sword, rarity: 4, refinement: 3 }),
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

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "rarity" });
    expect(result.map((w) => w.name)).toEqual(["Aquila Favonia", "Favonius Sword", "Widsith"]);
  });

  it("sorts by refinement descending, breaking ties by name", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, sortKey: "refinement" });
    expect(result.map((w) => w.name)).toEqual(["Widsith", "Favonius Sword", "Aquila Favonia"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortOwnedWeapons(owned, { ...ownedBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
