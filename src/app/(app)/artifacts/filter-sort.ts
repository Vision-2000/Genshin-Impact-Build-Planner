import { ArtifactSlot } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import { SUBSTAT_TYPE_NAMES, type SubstatTypeName } from "./artifact-rules";

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
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
};

export function filterArtifactSetCatalog(
  sets: ArtifactSetCatalogItem[],
  { search, rarityFilter, sortKey, sortDirection }: CatalogFilters
): ArtifactSetCatalogItem[] {
  let result = sets;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((set) => set.name.toLowerCase().includes(query));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((set) => rarityFilter.has(set.rarity));
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "release") {
      return -direction * (a.id - b.id) || a.name.localeCompare(b.name);
    }
    if (sortKey === "rarity") {
      return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
