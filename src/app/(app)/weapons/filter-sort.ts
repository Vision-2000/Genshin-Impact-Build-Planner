import { WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";

export type { SortDirection };

export const REFINEMENTS = [1, 2, 3, 4, 5];

export type WeaponCatalogItem = {
  id: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
};

export type OwnedWeaponItem = {
  id: number;
  weaponId: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  refinement: number;
  level: number;
  ascensionPhase: number;
};

export type CatalogSortKey = "name" | "rarity";
export type OwnedSortKey = "name" | "rarity" | "refinement";

export type CatalogFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
};

export type OwnedFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: OwnedSortKey;
  sortDirection: SortDirection;
};

function matchesSearchTypeAndRarity<T extends { name: string; weaponType: WeaponType; rarity: number }>(
  items: T[],
  search: string,
  weaponTypeFilter: ReadonlySet<WeaponType>,
  rarityFilter: ReadonlySet<number>
): T[] {
  let result = items;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((item) => item.name.toLowerCase().includes(query));
  }
  if (weaponTypeFilter.size > 0) {
    result = result.filter((item) => weaponTypeFilter.has(item.weaponType));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((item) => rarityFilter.has(item.rarity));
  }

  return result;
}

export function filterAndSortWeaponCatalog(
  weapons: WeaponCatalogItem[],
  { search, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: CatalogFilters
): WeaponCatalogItem[] {
  const result = matchesSearchTypeAndRarity(weapons, search, weaponTypeFilter, rarityFilter);
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}

export function filterAndSortOwnedWeapons(
  weapons: OwnedWeaponItem[],
  { search, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: OwnedFilters
): OwnedWeaponItem[] {
  const result = matchesSearchTypeAndRarity(weapons, search, weaponTypeFilter, rarityFilter);
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    if (sortKey === "refinement") {
      return direction * (a.refinement - b.refinement) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
