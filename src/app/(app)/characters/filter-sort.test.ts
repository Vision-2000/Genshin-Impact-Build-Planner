import { describe, it, expect } from "vitest";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { filterAndSortCharacters, type CharacterListItem } from "./filter-sort";

function character(overrides: Partial<CharacterListItem>): CharacterListItem {
  return {
    id: 1,
    name: "Test Character",
    element: Element.Pyro,
    weaponType: WeaponType.Sword,
    rarity: 4,
    iconUrl: null,
    isOwned: false,
    ...overrides,
  };
}

const baseFilters = {
  search: "",
  elementFilter: new Set<Element>(),
  weaponTypeFilter: new Set<WeaponType>(),
  ownershipFilter: "all" as const,
  sortKey: "name" as const,
};

const characters: CharacterListItem[] = [
  character({ id: 1, name: "Hu Tao", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 5, isOwned: true }),
  character({ id: 2, name: "Kaeya", element: Element.Cryo, weaponType: WeaponType.Sword, rarity: 4, isOwned: false }),
  character({ id: 3, name: "Xiangling", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 4, isOwned: true }),
  character({ id: 4, name: "Amber", element: Element.Pyro, weaponType: WeaponType.Bow, rarity: 4, isOwned: false }),
];

describe("filterAndSortCharacters", () => {
  it("returns everything, sorted by name, with no filters applied", () => {
    const result = filterAndSortCharacters(characters, baseFilters);
    expect(result.map((c) => c.name)).toEqual(["Amber", "Hu Tao", "Kaeya", "Xiangling"]);
  });

  it("filters by case-insensitive name substring", () => {
    const result = filterAndSortCharacters(characters, { ...baseFilters, search: "  hu ta  " });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao"]);
  });

  it("filters by element, matching any element in the set", () => {
    const result = filterAndSortCharacters(characters, {
      ...baseFilters,
      elementFilter: new Set([Element.Cryo]),
    });
    expect(result.map((c) => c.name)).toEqual(["Kaeya"]);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortCharacters(characters, {
      ...baseFilters,
      weaponTypeFilter: new Set([WeaponType.Polearm]),
    });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("filters to owned only", () => {
    const result = filterAndSortCharacters(characters, { ...baseFilters, ownershipFilter: "owned" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("filters to unowned only", () => {
    const result = filterAndSortCharacters(characters, { ...baseFilters, ownershipFilter: "unowned" });
    expect(result.map((c) => c.name)).toEqual(["Amber", "Kaeya"]);
  });

  it("combines multiple filters (AND, not OR)", () => {
    const result = filterAndSortCharacters(characters, {
      ...baseFilters,
      elementFilter: new Set([Element.Pyro]),
      ownershipFilter: "owned",
    });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("sorts by rarity descending, breaking ties by name", () => {
    const result = filterAndSortCharacters(characters, { ...baseFilters, sortKey: "rarity" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Amber", "Kaeya", "Xiangling"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortCharacters(characters, { ...baseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
