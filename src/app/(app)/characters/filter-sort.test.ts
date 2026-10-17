import { describe, it, expect } from "vitest";
import { Element, WeaponType } from "@/generated/prisma/enums";
import {
  collapseTravelerOwnedRows,
  collapseTravelerRosterRows,
  filterAndSortCharacterRoster,
  filterAndSortOwnedCharacters,
  type CharacterRosterItem,
  type OwnedCharacterItem,
} from "./filter-sort";

function rosterItem(overrides: Partial<CharacterRosterItem>): CharacterRosterItem {
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

function ownedItem(overrides: Partial<OwnedCharacterItem>): OwnedCharacterItem {
  return {
    id: 1,
    name: "Test Character",
    element: Element.Pyro,
    weaponType: WeaponType.Sword,
    rarity: 4,
    iconUrl: null,
    splashUrl: null,
    level: 1,
    ascensionPhase: 0,
    constellation: 0,
    normalAttackLevel: 1,
    skillLevel: 1,
    burstLevel: 1,
    ...overrides,
  };
}

const rosterBaseFilters = {
  search: "",
  elementFilter: new Set<Element>(),
  weaponTypeFilter: new Set<WeaponType>(),
  rarityFilter: new Set<number>(),
  ownershipFilter: "all" as const,
  sortKey: "name" as const,
  sortDirection: "asc" as const,
};

const ownedBaseFilters = {
  search: "",
  elementFilter: new Set<Element>(),
  weaponTypeFilter: new Set<WeaponType>(),
  rarityFilter: new Set<number>(),
  sortKey: "name" as const,
  sortDirection: "asc" as const,
};

const roster: CharacterRosterItem[] = [
  rosterItem({ id: 1, name: "Hu Tao", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 5, isOwned: true }),
  rosterItem({ id: 2, name: "Kaeya", element: Element.Cryo, weaponType: WeaponType.Sword, rarity: 4, isOwned: false }),
  rosterItem({ id: 3, name: "Xiangling", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 4, isOwned: true }),
  rosterItem({ id: 4, name: "Amber", element: Element.Pyro, weaponType: WeaponType.Bow, rarity: 4, isOwned: false }),
];

describe("filterAndSortCharacterRoster", () => {
  it("returns everything, sorted by name, with no filters applied", () => {
    const result = filterAndSortCharacterRoster(roster, rosterBaseFilters);
    expect(result.map((c) => c.name)).toEqual(["Amber", "Hu Tao", "Kaeya", "Xiangling"]);
  });

  it("filters by case-insensitive name substring", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, search: "  hu ta  " });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao"]);
  });

  it("filters by element, matching any element in the set", () => {
    const result = filterAndSortCharacterRoster(roster, {
      ...rosterBaseFilters,
      elementFilter: new Set([Element.Cryo]),
    });
    expect(result.map((c) => c.name)).toEqual(["Kaeya"]);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortCharacterRoster(roster, {
      ...rosterBaseFilters,
      weaponTypeFilter: new Set([WeaponType.Polearm]),
    });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, rarityFilter: new Set([5]) });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao"]);
  });

  it("filters to owned only", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, ownershipFilter: "owned" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("filters to unowned only", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, ownershipFilter: "unowned" });
    expect(result.map((c) => c.name)).toEqual(["Amber", "Kaeya"]);
  });

  it("combines multiple filters (AND, not OR)", () => {
    const result = filterAndSortCharacterRoster(roster, {
      ...rosterBaseFilters,
      elementFilter: new Set([Element.Pyro]),
      ownershipFilter: "owned",
    });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("sorts by rarity forward (highest first), breaking ties by name", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, sortKey: "rarity" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Amber", "Kaeya", "Xiangling"]);
  });

  it("sorts by rarity reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortCharacterRoster(roster, {
      ...rosterBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((c) => c.name)).toEqual(["Amber", "Kaeya", "Xiangling", "Hu Tao"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, sortDirection: "desc" });
    expect(result.map((c) => c.name)).toEqual(["Xiangling", "Kaeya", "Hu Tao", "Amber"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortCharacterRoster(roster, { ...rosterBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("collapseTravelerRosterRows", () => {
  const travelers: CharacterRosterItem[] = [
    rosterItem({ id: 10, name: "Traveler (Female) (Anemo)", element: Element.Anemo, isOwned: true }),
    rosterItem({ id: 11, name: "Traveler (Female) (Pyro)", element: Element.Pyro, isOwned: true }),
    rosterItem({ id: 20, name: "Traveler (Male) (Anemo)", element: Element.Anemo, isOwned: false }),
    rosterItem({ id: 21, name: "Traveler (Male) (Hydro)", element: Element.Hydro, isOwned: false }),
  ];

  it("collapses every surviving elemental row of a gender into one synthetic row, displayed as plain Traveler", () => {
    const result = collapseTravelerRosterRows(travelers);
    expect(result.map((c) => c.id)).toEqual([10, 20]);
    expect(result.every((c) => c.name === "Traveler")).toBe(true);
  });

  it("marks the synthetic row so the card can skip the element badge", () => {
    const result = collapseTravelerRosterRows(travelers);
    expect(result.every((c) => c.isTravelerGroup)).toBe(true);
  });

  it("keeps the representative row's id and ownership", () => {
    const result = collapseTravelerRosterRows(travelers);
    expect(result.find((c) => c.id === 10)).toMatchObject({ isOwned: true });
    expect(result.find((c) => c.id === 20)).toMatchObject({ isOwned: false });
  });

  it("leaves non-Traveler rows untouched", () => {
    const result = collapseTravelerRosterRows([...travelers, rosterItem({ id: 1, name: "Kaeya" })]);
    expect(result.map((c) => c.id)).toEqual([10, 20, 1]);
    expect(result.map((c) => c.name)).toEqual(["Traveler", "Traveler", "Kaeya"]);
  });

  it("still collapses to one card when only one element of a gender survives an earlier filter", () => {
    const onlyOneElement = travelers.filter((c) => c.name === "Traveler (Female) (Pyro)");
    const result = collapseTravelerRosterRows(onlyOneElement);
    expect(result.map((c) => c.name)).toEqual(["Traveler"]);
  });
});

describe("collapseTravelerOwnedRows", () => {
  const ownedTravelers: OwnedCharacterItem[] = [
    ownedItem({ id: 10, name: "Traveler (Female) (Anemo)", element: Element.Anemo, constellation: 2 }),
    ownedItem({ id: 11, name: "Traveler (Female) (Pyro)", element: Element.Pyro, constellation: 4 }),
    ownedItem({ id: 20, name: "Traveler (Male) (Hydro)", element: Element.Hydro, constellation: 1 }),
  ];

  it("collapses every surviving elemental row of a gender into one synthetic row, displayed as plain Traveler", () => {
    const result = collapseTravelerOwnedRows(ownedTravelers);
    expect(result.map((c) => c.id)).toEqual([10, 20]);
    expect(result.every((c) => c.name === "Traveler" && c.isTravelerGroup)).toBe(true);
  });

  it("keeps the representative row's own progression", () => {
    const result = collapseTravelerOwnedRows(ownedTravelers);
    expect(result.find((c) => c.id === 10)).toMatchObject({ constellation: 2 });
  });

  it("leaves non-Traveler rows untouched", () => {
    const result = collapseTravelerOwnedRows([...ownedTravelers, ownedItem({ id: 1, name: "Kaeya" })]);
    expect(result.map((c) => c.id)).toEqual([10, 20, 1]);
  });
});

describe("filterAndSortOwnedCharacters", () => {
  const owned: OwnedCharacterItem[] = [
    ownedItem({ id: 1, name: "Hu Tao", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 5, level: 80 }),
    ownedItem({ id: 2, name: "Kaeya", element: Element.Cryo, weaponType: WeaponType.Sword, rarity: 4, level: 40 }),
    ownedItem({ id: 3, name: "Xiangling", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 4, level: 80 }),
    ownedItem({ id: 4, name: "Amber", element: Element.Pyro, weaponType: WeaponType.Bow, rarity: 4, level: 1 }),
  ];

  it("returns everything, sorted by name, with no filters applied", () => {
    const result = filterAndSortOwnedCharacters(owned, ownedBaseFilters);
    expect(result.map((c) => c.name)).toEqual(["Amber", "Hu Tao", "Kaeya", "Xiangling"]);
  });

  it("filters by case-insensitive name substring", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, search: "  hu ta  " });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao"]);
  });

  it("filters by element, matching any element in the set", () => {
    const result = filterAndSortOwnedCharacters(owned, {
      ...ownedBaseFilters,
      elementFilter: new Set([Element.Cryo]),
    });
    expect(result.map((c) => c.name)).toEqual(["Kaeya"]);
  });

  it("filters by weapon type", () => {
    const result = filterAndSortOwnedCharacters(owned, {
      ...ownedBaseFilters,
      weaponTypeFilter: new Set([WeaponType.Polearm]),
    });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling"]);
  });

  it("filters by rarity, matching any rarity in the set", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, rarityFilter: new Set([5]) });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao"]);
  });

  it("sorts by rarity forward (highest first), breaking ties by name", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, sortKey: "rarity" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Amber", "Kaeya", "Xiangling"]);
  });

  it("sorts by rarity reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortOwnedCharacters(owned, {
      ...ownedBaseFilters,
      sortKey: "rarity",
      sortDirection: "desc",
    });
    expect(result.map((c) => c.name)).toEqual(["Amber", "Kaeya", "Xiangling", "Hu Tao"]);
  });

  it("sorts by level forward (highest first), breaking ties by name", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, sortKey: "level" });
    expect(result.map((c) => c.name)).toEqual(["Hu Tao", "Xiangling", "Kaeya", "Amber"]);
  });

  it("sorts by level reversed (lowest first), breaking ties by name", () => {
    const result = filterAndSortOwnedCharacters(owned, {
      ...ownedBaseFilters,
      sortKey: "level",
      sortDirection: "desc",
    });
    expect(result.map((c) => c.name)).toEqual(["Amber", "Kaeya", "Hu Tao", "Xiangling"]);
  });

  it("sorts by name descending", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, sortDirection: "desc" });
    expect(result.map((c) => c.name)).toEqual(["Xiangling", "Kaeya", "Hu Tao", "Amber"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortOwnedCharacters(owned, { ...ownedBaseFilters, search: "nonexistent" });
    expect(result).toEqual([]);
  });
});
