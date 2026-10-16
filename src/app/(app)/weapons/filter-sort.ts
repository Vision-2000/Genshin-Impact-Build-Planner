import { WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";

export type { SortDirection };

// The add-catalog card's hover tooltip -- exact stats/passive at this
// weapon's own defaultWeaponProgression() state (see @/lib/weapon-scaling),
// computed once server-side in page.tsx rather than per-render client-side:
// it's always the same fixed state regardless of what the user does with
// the card, so there's no reason to ship the raw curve data down and
// recompute it, the way the owned-weapon editor's live sliders need to.
// Deliberately no statBonuses here -- the tooltip shows the passive's own
// text only, not a separate restatement of the bonus it describes.
export type WeaponHoverDetail = {
  attack: number;
  secondaryStatValue: number | null;
  passiveName: string | null;
  passiveDescription: string | null;
};

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
};

export type CatalogSortKey = "name" | "rarity";
export type OwnedSortKey = "name" | "rarity" | "refinement";

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
    return direction * a.name.localeCompare(b.name);
  });
}
