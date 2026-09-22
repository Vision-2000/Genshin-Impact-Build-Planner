import { Element, WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";

export type { SortDirection };

// Shown on /characters/roster -- every playable character, with just enough
// to render the card and toggle ownership.
export type CharacterRosterItem = {
  id: number;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  isOwned: boolean;
};

// Shown on /characters -- owned characters only, with their full
// progression state.
export type OwnedCharacterItem = {
  id: number;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  level: number;
  ascensionPhase: number;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
};

export type OwnershipFilter = "all" | "owned" | "unowned";
export type RosterSortKey = "name" | "rarity";
export type OwnedSortKey = "name" | "rarity" | "level";

export type RosterFilters = {
  search: string;
  elementFilter: ReadonlySet<Element>;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  ownershipFilter: OwnershipFilter;
  sortKey: RosterSortKey;
  sortDirection: SortDirection;
};

export type OwnedFilters = {
  search: string;
  elementFilter: ReadonlySet<Element>;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: OwnedSortKey;
  sortDirection: SortDirection;
};

function matchesSearchElementTypeAndRarity<
  T extends { name: string; element: Element; weaponType: WeaponType; rarity: number },
>(
  items: T[],
  search: string,
  elementFilter: ReadonlySet<Element>,
  weaponTypeFilter: ReadonlySet<WeaponType>,
  rarityFilter: ReadonlySet<number>
): T[] {
  let result = items;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((item) => item.name.toLowerCase().includes(query));
  }
  if (elementFilter.size > 0) {
    result = result.filter((item) => elementFilter.has(item.element));
  }
  if (weaponTypeFilter.size > 0) {
    result = result.filter((item) => weaponTypeFilter.has(item.weaponType));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((item) => rarityFilter.has(item.rarity));
  }

  return result;
}

export function filterAndSortCharacterRoster(
  characters: CharacterRosterItem[],
  { search, elementFilter, weaponTypeFilter, rarityFilter, ownershipFilter, sortKey, sortDirection }: RosterFilters
): CharacterRosterItem[] {
  let result = matchesSearchElementTypeAndRarity(characters, search, elementFilter, weaponTypeFilter, rarityFilter);
  if (ownershipFilter === "owned") {
    result = result.filter((character) => character.isOwned);
  } else if (ownershipFilter === "unowned") {
    result = result.filter((character) => !character.isOwned);
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}

export function filterAndSortOwnedCharacters(
  characters: OwnedCharacterItem[],
  { search, elementFilter, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: OwnedFilters
): OwnedCharacterItem[] {
  const result = matchesSearchElementTypeAndRarity(characters, search, elementFilter, weaponTypeFilter, rarityFilter);
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    if (sortKey === "level") {
      return direction * (a.level - b.level) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
