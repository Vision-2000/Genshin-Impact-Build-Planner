import { WeaponType } from "@/generated/prisma/enums";

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
};

export type CatalogSortKey = "name" | "rarity";
export type OwnedSortKey = "name" | "rarity" | "refinement";

export type CatalogFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: CatalogSortKey;
};

export type OwnedFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: OwnedSortKey;
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
  { search, weaponTypeFilter, rarityFilter, sortKey }: CatalogFilters
): WeaponCatalogItem[] {
  const result = matchesSearchTypeAndRarity(weapons, search, weaponTypeFilter, rarityFilter);

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return b.rarity - a.rarity || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

export function filterAndSortOwnedWeapons(
  weapons: OwnedWeaponItem[],
  { search, weaponTypeFilter, rarityFilter, sortKey }: OwnedFilters
): OwnedWeaponItem[] {
  const result = matchesSearchTypeAndRarity(weapons, search, weaponTypeFilter, rarityFilter);

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return b.rarity - a.rarity || a.name.localeCompare(b.name);
    }
    if (sortKey === "refinement") {
      return b.refinement - a.refinement || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}
