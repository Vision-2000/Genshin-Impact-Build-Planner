import { Element, WeaponType } from "@/generated/prisma/enums";

export type CharacterListItem = {
  id: number;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  isOwned: boolean;
};

export type OwnershipFilter = "all" | "owned" | "unowned";
export type SortKey = "name" | "rarity";
export type SortDirection = "asc" | "desc";

export type CharacterFilters = {
  search: string;
  elementFilter: ReadonlySet<Element>;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  ownershipFilter: OwnershipFilter;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

export function filterAndSortCharacters(
  characters: CharacterListItem[],
  { search, elementFilter, weaponTypeFilter, rarityFilter, ownershipFilter, sortKey, sortDirection }: CharacterFilters
): CharacterListItem[] {
  let result = characters;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((character) => character.name.toLowerCase().includes(query));
  }
  if (elementFilter.size > 0) {
    result = result.filter((character) => elementFilter.has(character.element));
  }
  if (weaponTypeFilter.size > 0) {
    result = result.filter((character) => weaponTypeFilter.has(character.weaponType));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((character) => rarityFilter.has(character.rarity));
  }
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
