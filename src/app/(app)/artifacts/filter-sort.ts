import { ArtifactSlot } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import { OTHER_TWO_PIECE_BONUS, SUBSTAT_TYPE_NAMES, type SubstatTypeName } from "./artifact-rules";

export type { SortDirection };

export type StatTypeOption = {
  id: number;
  name: string;
};

export type ArtifactSetCatalogItem = {
  id: number;
  name: string;
  rarity: number;
  twoPieceEffect: string;
  fourPieceEffect: string | null;
  // The 2pc effect's own unconditional stat bonus (see
  // TWO_PIECE_BONUS_STAT_NAMES in artifact-rules.ts), null for the sets
  // whose 2pc effect is conditional/proc-based and stays text-only --
  // backs the add-catalog's 2pc-effect filter.
  twoPieceStatName: string | null;
  flowerIconUrl: string | null;
  featherIconUrl: string | null;
  sandsIconUrl: string | null;
  gobletIconUrl: string | null;
  circletIconUrl: string | null;
};

export type OwnedArtifactSubstatItem = {
  id: number;
  statTypeId: number;
  statTypeName: string;
  value: number;
};

export type OwnedArtifactItem = {
  id: number;
  artifactSetId: number;
  setName: string;
  slot: ArtifactSlot;
  rarity: number;
  level: number;
  mainStatId: number;
  mainStatName: string;
  iconUrl: string | null;
  // Shown below the piece image in the edit modal's own splash column
  // (see ArtifactProgressionForm) -- same set-level text the add-catalog's
  // own hover tooltip already shows.
  twoPieceEffect: string;
  fourPieceEffect: string | null;
  substats: OwnedArtifactSubstatItem[];
};

export function slotIconUrl(
  set: {
    flowerIconUrl: string | null;
    featherIconUrl: string | null;
    sandsIconUrl: string | null;
    gobletIconUrl: string | null;
    circletIconUrl: string | null;
  },
  slot: ArtifactSlot
): string | null {
  switch (slot) {
    case ArtifactSlot.Flower:
      return set.flowerIconUrl;
    case ArtifactSlot.Feather:
      return set.featherIconUrl;
    case ArtifactSlot.Sands:
      return set.sandsIconUrl;
    case ArtifactSlot.Goblet:
      return set.gobletIconUrl;
    case ArtifactSlot.Circlet:
      return set.circletIconUrl;
  }
}

type OwnedArtifactRow = {
  id: number;
  artifactSetId: number;
  slot: ArtifactSlot;
  level: number;
  mainStatId: number;
  artifactSet: {
    name: string;
    rarity: number;
    twoPieceEffect: string;
    fourPieceEffect: string | null;
    flowerIconUrl: string | null;
    featherIconUrl: string | null;
    sandsIconUrl: string | null;
    gobletIconUrl: string | null;
    circletIconUrl: string | null;
  };
  mainStat: { name: string };
  substats: { id: number; statTypeId: number; value: number; statType: { name: string } }[];
};

export function toOwnedArtifactItem(row: OwnedArtifactRow): OwnedArtifactItem {
  return {
    id: row.id,
    artifactSetId: row.artifactSetId,
    setName: row.artifactSet.name,
    slot: row.slot,
    // Rarity is a fixed property of the set, not the individual piece.
    rarity: row.artifactSet.rarity,
    level: row.level,
    mainStatId: row.mainStatId,
    mainStatName: row.mainStat.name,
    iconUrl: slotIconUrl(row.artifactSet, row.slot),
    twoPieceEffect: row.artifactSet.twoPieceEffect,
    fourPieceEffect: row.artifactSet.fourPieceEffect,
    substats: row.substats.map((s) => ({
      id: s.id,
      statTypeId: s.statTypeId,
      statTypeName: s.statType.name,
      value: s.value,
    })),
  };
}

export type OwnedSortKey = "name" | "rarity" | "level" | SubstatTypeName;

export type OwnedFilters = {
  search: string;
  slotFilter: ReadonlySet<ArtifactSlot>;
  rarityFilter: ReadonlySet<number>;
  substatFilter: ReadonlySet<SubstatTypeName>;
  // Empty string means "any main stat" -- a single-select dropdown rather
  // than badges, since filtering by more than one main stat at once is a
  // rare enough case not to be worth a multi-select UI.
  mainStatFilter: string;
  sortKey: OwnedSortKey;
  sortDirection: SortDirection;
};

function substatValue(artifact: OwnedArtifactItem, statName: string): number | null {
  const substat = artifact.substats.find((s) => s.statTypeName === statName);
  return substat ? substat.value : null;
}

export function filterAndSortOwnedArtifacts(
  artifacts: OwnedArtifactItem[],
  { search, slotFilter, rarityFilter, substatFilter, mainStatFilter, sortKey, sortDirection }: OwnedFilters
): OwnedArtifactItem[] {
  let result = artifacts;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((artifact) => artifact.setName.toLowerCase().includes(query));
  }
  if (slotFilter.size > 0) {
    result = result.filter((artifact) => slotFilter.has(artifact.slot));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((artifact) => rarityFilter.has(artifact.rarity));
  }
  if (mainStatFilter) {
    result = result.filter((artifact) => artifact.mainStatName === mainStatFilter);
  }
  for (const statName of substatFilter) {
    result = result.filter((artifact) => substatValue(artifact, statName) !== null);
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.setName.localeCompare(b.setName);
    }
    if (sortKey === "level") {
      return direction * (a.level - b.level) || a.setName.localeCompare(b.setName);
    }
    if ((SUBSTAT_TYPE_NAMES as readonly string[]).includes(sortKey)) {
      const aValue = substatValue(a, sortKey) ?? -Infinity;
      const bValue = substatValue(b, sortKey) ?? -Infinity;
      return direction * (aValue - bValue) || a.setName.localeCompare(b.setName);
    }
    return direction * a.setName.localeCompare(b.setName);
  });
}

// "release" sorts by ArtifactSet.id, which now matches each set's real
// release order (see CLAUDE.md) -- the most intuitive default for browsing
// the catalog, so it's the default sortKey below rather than "name". Its
// forward direction is newest-first (id descending) rather than oldest-
// first -- more intuitive for browsing new content first -- so its own
// comparison below flips the shared direction multiplier rather than
// using it as-is like every other sortKey.
export type CatalogSortKey = "release" | "name" | "rarity";

export type CatalogFilters = {
  search: string;
  rarityFilter: ReadonlySet<number>;
  // "" means no filter -- a single exact-match dropdown (like Weapons'
  // own secondaryStatFilter), not a multi-select set, since a set's 2pc
  // effect is at most one stat, never several at once. A set with a null
  // twoPieceStatName (no unconditional 2pc stat bonus) matches only
  // OTHER_TWO_PIECE_BONUS.
  twoPieceStatFilter: string;
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
};

// Breaks a tie by release order (id), newest first -- fixed regardless of
// the primary sort's own direction toggle, same "the tiebreaker always
// uses its own default direction, independent of whatever the primary
// sort is doing" convention Weapons' own "added" tiebreaker uses on its
// owned list. id is unique per set (see CLAUDE.md's artifact-set id
// renumbering), so this can never itself tie.
function tiebreakByRelease(a: ArtifactSetCatalogItem, b: ArtifactSetCatalogItem): number {
  return b.id - a.id;
}

export function filterArtifactSetCatalog(
  sets: ArtifactSetCatalogItem[],
  { search, rarityFilter, twoPieceStatFilter, sortKey, sortDirection }: CatalogFilters
): ArtifactSetCatalogItem[] {
  let result = sets;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((set) => set.name.toLowerCase().includes(query));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((set) => rarityFilter.has(set.rarity));
  }
  if (twoPieceStatFilter) {
    result = result.filter((set) => (set.twoPieceStatName ?? OTHER_TWO_PIECE_BONUS) === twoPieceStatFilter);
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "release") {
      return -direction * (a.id - b.id) || tiebreakByRelease(a, b);
    }
    // Flipped (-direction) -- forward is highest rarity first, same "flip
    // the shared direction multiplier" treatment this file's own
    // "release" sortKey and Weapons' rarity/level/refinement sortKeys use.
    if (sortKey === "rarity") {
      return -direction * (a.rarity - b.rarity) || tiebreakByRelease(a, b);
    }
    return direction * a.name.localeCompare(b.name) || tiebreakByRelease(a, b);
  });
}
