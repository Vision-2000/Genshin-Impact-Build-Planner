import { WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import type { WeaponHoverDetail } from "@/lib/weapon-hover-detail";

export type { SortDirection };
// Hover-tooltip shape/computation now lives in @/lib/weapon-hover-detail,
// shared by the add-catalog's hover tooltip (always this weapon's own
// defaultWeaponProgression() state) and the owned-weapons page's own
// hover tooltip (always that physical copy's current state) -- re-exported
// here since every call site already imports item types from this file.
export type { WeaponHoverDetail };

export type WeaponCatalogItem = {
  id: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  // Gacha-art portrait, shown in WeaponProgressionForm's own splash-art
  // column (the "customize before adding" modal) -- included here, not
  // lazily fetched, so that column shows up immediately the same way
  // Character.splashUrl does for the character editor.
  splashUrl: string | null;
  // A documented few weapons cap below 5 (see Weapon.maxRefinement) --
  // caps the refinement slider in the add-catalog card's own "customize
  // before adding" modal.
  maxRefinement: number;
  hoverDetail: WeaponHoverDetail;
};

export type OwnedWeaponItem = {
  id: number;
  weaponId: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
  refinement: number;
  level: number;
  ascensionPhase: number;
  // This copy's own exact stats/passive at its current level/ascension/
  // refinement -- unlike the catalog's hoverDetail (always the same fixed
  // default state), this varies per owned copy, so it's recomputed from
  // that copy's own fields rather than defaultWeaponProgression().
  hoverDetail: WeaponHoverDetail;
};

export type CatalogSortKey = "name" | "rarity";
export type OwnedSortKey = "name" | "rarity" | "refinement" | "level";

// The full set of secondary stats any seeded weapon can roll (see
// data-source/weapons.json) -- fixed/slow-changing game data, same
// "hardcode the known values" treatment RARITIES gets in both manager
// components, not derived from whatever happens to be in the current
// catalog/owned list (which would make the filter row's own contents
// shift depending on what's currently filtered/owned).
export const WEAPON_SECONDARY_STAT_NAMES = [
  "ATK%",
  "Crit DMG%",
  "Crit Rate%",
  "DEF%",
  "Elemental Mastery",
  "Energy Recharge%",
  "HP%",
  "Physical DMG Bonus%",
] as const;

export type CatalogFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  // "" means no filter -- a single exact-match dropdown (like Artifacts'
  // own main-stat filter), not a multi-select set, since a weapon only
  // ever has one secondary stat.
  secondaryStatFilter: string;
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
};

export type OwnedFilters = {
  search: string;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  secondaryStatFilter: string;
  sortKey: OwnedSortKey;
  sortDirection: SortDirection;
};

function matchesSearchTypeRarityAndSecondaryStat<
  T extends { name: string; weaponType: WeaponType; rarity: number; secondaryStatName: string | null },
>(
  items: T[],
  search: string,
  weaponTypeFilter: ReadonlySet<WeaponType>,
  rarityFilter: ReadonlySet<number>,
  secondaryStatFilter: string
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
  if (secondaryStatFilter) {
    result = result.filter((item) => item.secondaryStatName === secondaryStatFilter);
  }

  return result;
}

export function filterAndSortWeaponCatalog(
  weapons: WeaponCatalogItem[],
  { search, weaponTypeFilter, rarityFilter, secondaryStatFilter, sortKey, sortDirection }: CatalogFilters
): WeaponCatalogItem[] {
  const result = matchesSearchTypeRarityAndSecondaryStat(
    weapons,
    search,
    weaponTypeFilter,
    rarityFilter,
    secondaryStatFilter
  );
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
  { search, weaponTypeFilter, rarityFilter, secondaryStatFilter, sortKey, sortDirection }: OwnedFilters
): OwnedWeaponItem[] {
  const result = matchesSearchTypeRarityAndSecondaryStat(
    weapons,
    search,
    weaponTypeFilter,
    rarityFilter,
    secondaryStatFilter
  );
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    if (sortKey === "refinement") {
      return direction * (a.refinement - b.refinement) || a.name.localeCompare(b.name);
    }
    if (sortKey === "level") {
      return direction * (a.level - b.level) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
