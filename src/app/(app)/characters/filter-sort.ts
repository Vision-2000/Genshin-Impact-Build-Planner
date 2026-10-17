import { Element, WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import { travelerGenderGroup, travelerDisplayName } from "@/lib/character-scaling";

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
  // Set only by collapseTravelerRosterRows below, on the single synthetic
  // row standing in for a gender's 7 elemental rows -- tells CharacterCard
  // to skip the element badge, since no single element applies anymore.
  isTravelerGroup?: boolean;
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
  // Gacha/profile splash art, distinct from iconUrl -- used as the
  // progression editor's background. See Character.splashUrl in
  // schema.prisma.
  splashUrl: string | null;
  level: number;
  ascensionPhase: number;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
  // Set only by collapseTravelerOwnedRows below -- see CharacterRosterItem's
  // own flag of the same name.
  isTravelerGroup?: boolean;
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

// Collapses each Traveler gender's (up to 7) elemental rows still surviving
// the per-row filters above into one synthetic row, keyed by the shared
// name prefix from travelerGenderGroup -- so "show only 1 card per gender,
// even if more than one of its elements matches the current filter" falls
// out of running this AFTER the element/weapon-type/rarity filter, not
// before (a collapsed row can't be checked against a single Element). The
// representative row (whichever sibling happens to come first) donates its
// id/weaponType/rarity/iconUrl/isOwned -- level/ascension/ownership are
// already synced identically across all 7 by setCharacterOwnership, so any
// one of them is as correct as another; clicking the resulting card still
// works, since that action resolves the whole gender group from any single
// id in it.
export function collapseTravelerRosterRows(items: CharacterRosterItem[]): CharacterRosterItem[] {
  const result: CharacterRosterItem[] = [];
  const seenGenderGroups = new Set<string>();

  for (const item of items) {
    const genderGroup = travelerGenderGroup(item.name);
    if (!genderGroup) {
      result.push(item);
      continue;
    }
    if (seenGenderGroups.has(genderGroup)) continue;
    seenGenderGroups.add(genderGroup);
    // Displayed as plain "Traveler" for both genders -- the card already
    // has nothing gender-specific left to show (no element badge either),
    // and the two cards are still distinct rows/ids under the hood.
    result.push({ ...item, name: travelerDisplayName(item.name), isTravelerGroup: true });
  }

  return result;
}

export function filterAndSortCharacterRoster(
  characters: CharacterRosterItem[],
  { search, elementFilter, weaponTypeFilter, rarityFilter, ownershipFilter, sortKey, sortDirection }: RosterFilters
): CharacterRosterItem[] {
  let result = matchesSearchElementTypeAndRarity(characters, search, elementFilter, weaponTypeFilter, rarityFilter);
  result = collapseTravelerRosterRows(result);
  if (ownershipFilter === "owned") {
    result = result.filter((character) => character.isOwned);
  } else if (ownershipFilter === "unowned") {
    result = result.filter((character) => !character.isOwned);
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    // Flipped (-direction, not direction) -- forward is highest rarity
    // first, the more intuitive default for browsing a roster, same
    // "flip the shared direction multiplier" treatment Artifacts' own
    // "release" sortKey and Weapons' own "obtained" sortKey use.
    if (sortKey === "rarity") {
      return -direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}

// Same collapsing as collapseTravelerRosterRows above, applied to the owned
// page instead -- an owned Traveler gender has up to 7 OwnedCharacter rows
// (one per element, all isOwned together), which would otherwise show as 7
// separate cards. The card opens the editor on whichever element happens to
// be the representative; the editor's own element picker (see
// owned-character-manager.tsx) is how the other 6 get viewed/edited.
export function collapseTravelerOwnedRows(items: OwnedCharacterItem[]): OwnedCharacterItem[] {
  const result: OwnedCharacterItem[] = [];
  const seenGenderGroups = new Set<string>();

  for (const item of items) {
    const genderGroup = travelerGenderGroup(item.name);
    if (!genderGroup) {
      result.push(item);
      continue;
    }
    if (seenGenderGroups.has(genderGroup)) continue;
    seenGenderGroups.add(genderGroup);
    result.push({ ...item, name: travelerDisplayName(item.name), isTravelerGroup: true });
  }

  return result;
}

export function filterAndSortOwnedCharacters(
  characters: OwnedCharacterItem[],
  { search, elementFilter, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: OwnedFilters
): OwnedCharacterItem[] {
  let result = matchesSearchElementTypeAndRarity(characters, search, elementFilter, weaponTypeFilter, rarityFilter);
  result = collapseTravelerOwnedRows(result);
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    // Both flipped (-direction) -- forward is highest rarity/level first,
    // same reasoning as filterAndSortCharacterRoster's own rarity sort above.
    if (sortKey === "rarity") {
      return -direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    if (sortKey === "level") {
      return -direction * (a.level - b.level) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
