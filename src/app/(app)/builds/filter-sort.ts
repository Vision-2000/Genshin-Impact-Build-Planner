import { ArtifactSlot, Element, TalentSlot, WeaponType } from "@/generated/prisma/enums";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import type { SortDirection } from "@/lib/sort";
import { travelerDisplayName } from "@/lib/character-scaling";
import type { WeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { computeActiveSetEffects, type ActiveSetEffectItem } from "@/lib/active-set-effects";
import { slotIconUrl } from "../artifacts/filter-sort";

export type { SortDirection, WeaponHoverDetail, ActiveSetEffectItem };

export type StatBonusItem = { statTypeName: string; value: number };

export type OwnedCharacterOption = {
  ownedCharacterId: number;
  characterId: number;
  name: string;
  iconUrl: string | null;
  // Backs CharacterSlotPicker's own left-column splash-art display (see its
  // own comment) -- unlike iconUrl, this can be null for a character that
  // genuinely has no splash art on record.
  splashUrl: string | null;
  weaponType: WeaponType;
  element: Element;
  rarity: number;
  // Everything below backs final-stats.ts's own computeFinalStats, fetched
  // once up front here rather than lazily per selection -- every owned
  // character's own bonus data is small, and the picker already needs the
  // whole list in memory regardless.
  baseHp: number | null;
  baseAttack: number | null;
  baseDefense: number | null;
  maxAscensionHp: number | null;
  maxAscensionAttack: number | null;
  maxAscensionDefense: number | null;
  baseElementalMastery: number;
  ascensionStatName: string | null;
  level: number;
  ascensionPhase: number;
  constellation: number;
  // Hover-only (CharacterCard's own `progression` prop, see the character
  // picker modal) -- not used by final-stats.ts, which only needs the
  // three fields above.
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
  talentStatBonuses: StatBonusItem[];
  constellationStatBonuses: (StatBonusItem & { number: number })[];
  // Every talent's own name/slot (all 4-7 of them, Passives included) --
  // backs BuildCatalog's own "Character" summary box -- an icon row shown
  // the same lit/unlit way the progression editor's own TooltipIcon/
  // ConstellationIcons show them, not a plain name list. Passives are
  // included too (iconUrl/description cover them the same as combat
  // talents; only normalAttackLevel/skillLevel/burstLevel above don't
  // apply to them, same as the editor's own PassiveTalentIcon). description
  // carries the raw <gold>/<element> tags (see TaggedText) -- rendered,
  // never shown raw.
  talents: { slot: TalentSlot; name: string; iconUrl: string | null; description: string }[];
  // Every constellation's own data (all 6, same "already fetched for the
  // stat bonuses above" reasoning) -- BuildCatalog's own "Character"
  // summary box shows all 6 as icons, lit (number <= constellation) vs
  // unlit, same as the editor's own ConstellationIcons, not just a
  // filtered name list.
  constellations: { number: number; name: string; iconUrl: string | null; description: string }[];
};

export type OwnedWeaponOption = {
  ownedWeaponId: number;
  name: string;
  iconUrl: string | null;
  weaponType: WeaponType;
  refinement: number;
  rarity: number;
  secondaryStatName: string | null;
  // final-stats.ts inputs -- see OwnedCharacterOption's own comment on why
  // these are fetched up front rather than lazily. attackTier is nullable
  // in the schema (Weapon.attackTier) -- every currently-seeded weapon has
  // one, but final-stats.ts skips the ATK contribution entirely rather
  // than assume it for whatever edge case doesn't.
  attackTier: number | null;
  attackCurveRarity: number | null;
  baseSecondaryStatValue: number | null;
  level: number;
  ascensionPhase: number;
  // Not a StatBonusItem -- these are curve-based (see
  // computeWeaponValueCurve in final-stats.ts), not a stored flat value.
  statBonuses: {
    statTypeName: string;
    curveType: "Constant" | "Linear" | "Custom";
    baseValue: number;
    slope: number | null;
    customValues: number[] | null;
  }[];
  // Hover-only (WeaponCard's own `hoverDetail` prop, see the weapon picker
  // modal) -- this copy's own current stats/passive text, computed
  // server-side the same way the owned-weapons page's own hover tooltip is
  // (see computeWeaponHoverDetail).
  hoverDetail: WeaponHoverDetail;
  // "obtained" sort parity with the owned-weapons page (see OwnedSortKey
  // there) -- epoch ms, same as OwnedWeaponItem.createdAt.
  createdAt: number;
};

export type OwnedArtifactOption = {
  ownedArtifactId: number;
  slot: ArtifactSlot;
  // final-stats.ts groups same-set pieces by this to know when a 2pc/4pc
  // bonus is actually active -- setName alone isn't a stable grouping key
  // (two differently-seeded sets could in principle share a display name;
  // the id can't).
  artifactSetId: number;
  setName: string;
  mainStatName: string;
  iconUrl: string | null;
  // The set's own flower icon specifically -- distinct from `iconUrl`
  // above, which is this PIECE's own slot icon (e.g. a Feather's own art
  // for a Feather piece). Backs the owned-builds card's own flower-icon
  // active-set-effects summary, which always shows a set's flower art
  // regardless of which slot the build actually has equipped from it --
  // see activeSetEffectsFromArtifacts below.
  flowerIconUrl: string | null;
  rarity: number;
  level: number;
  substats: StatBonusItem[];
  // The set's own 2pc/4pc stat bonuses -- see FinalStatsArtifactInput's own
  // comment on why these are duplicated per-piece rather than looked up
  // separately.
  twoPieceStatBonuses: StatBonusItem[];
  fourPieceStatBonuses: StatBonusItem[];
  // The set's own 2pc/4pc effect TEXT (not just its stat-bonus subset) --
  // backs BuildCatalog's own "Active Set Effects" summary box, which shows
  // the real in-game description even for a conditional/proc-based effect
  // that has no stat-bonus row at all (most 4pc effects, and some 2pc
  // ones). fourPieceEffect is null for the handful of sets with no 4pc
  // effect of their own (see ArtifactSet.fourPieceEffect).
  twoPieceEffect: string;
  fourPieceEffect: string | null;
  // "obtained" sort parity with the owned-artifacts page (see OwnedSortKey
  // there) -- epoch ms, same as OwnedArtifactItem.createdAt.
  createdAt: number;
};

export type BuildArtifactSlotItem = {
  slot: ArtifactSlot;
  ownedArtifactId: number | null;
  setName: string | null;
  mainStatName: string | null;
  iconUrl: string | null;
};

// One entry per distinct equipped set that's reached its 2pc threshold --
// backs the owned-builds card's own flower-icon summary (1 icon for a
// single active 4pc set, 2 for two different active 2pc sets, etc.),
// mirroring the same consolidation BuildCatalog's own activeSetEffects
// already does for the create-build page. Grouped by artifactSetId, not
// setName, same "id is the stable key" reasoning as OwnedArtifactOption.
export type BuildItem = {
  id: number;
  name: string;
  ownedCharacterId: number;
  characterName: string;
  characterIconUrl: string | null;
  characterElement: Element;
  characterRarity: number;
  characterWeaponType: WeaponType;
  // Null for nearly every character; shared (e.g. "traveler") across the
  // handful that can never coexist in the same party -- see Character's
  // own schema comment. Backs availableCollectionBuilds' own candidate
  // exclusion below, the same signal detectOverlaps already uses for
  // Team/Group composition elsewhere in this app.
  exclusivityGroup: string | null;
  ownedWeaponId: number | null;
  weaponName: string | null;
  weaponIconUrl: string | null;
  weaponRefinement: number | null;
  weaponRarity: number | null;
  artifacts: BuildArtifactSlotItem[];
  activeSetEffects: ActiveSetEffectItem[];
  // "obtained" sort -- epoch ms, same convention as every owned page's own
  // createdAt.
  createdAt: number;
};

const SLOTS = Object.values(ArtifactSlot);

type ArtifactSetIcons = {
  flowerIconUrl: string | null;
  featherIconUrl: string | null;
  sandsIconUrl: string | null;
  gobletIconUrl: string | null;
  circletIconUrl: string | null;
};

type BuildRow = {
  id: number;
  name: string;
  ownedCharacterId: number;
  ownedWeaponId: number | null;
  createdAt: Date;
  ownedCharacter: {
    character: {
      name: string;
      iconUrl: string | null;
      element: Element;
      rarity: number;
      weaponType: WeaponType;
      exclusivityGroup: string | null;
    };
  };
  ownedWeapon: {
    refinement: number;
    weapon: { name: string; iconUrl: string | null; rarity: number };
  } | null;
  buildArtifacts: {
    slot: ArtifactSlot;
    ownedArtifact: {
      id: number;
      artifactSet: { id: number; name: string; rarity: number } & ArtifactSetIcons;
      mainStat: { name: string };
    };
  }[];
};

export function toBuildItem(row: BuildRow): BuildItem {
  return {
    id: row.id,
    name: row.name,
    ownedCharacterId: row.ownedCharacterId,
    characterName: travelerDisplayName(row.ownedCharacter.character.name),
    characterIconUrl: row.ownedCharacter.character.iconUrl,
    characterElement: row.ownedCharacter.character.element,
    characterRarity: row.ownedCharacter.character.rarity,
    characterWeaponType: row.ownedCharacter.character.weaponType,
    exclusivityGroup: row.ownedCharacter.character.exclusivityGroup,
    ownedWeaponId: row.ownedWeaponId,
    weaponName: row.ownedWeapon?.weapon.name ?? null,
    weaponIconUrl: row.ownedWeapon?.weapon.iconUrl ?? null,
    weaponRefinement: row.ownedWeapon?.refinement ?? null,
    weaponRarity: row.ownedWeapon?.weapon.rarity ?? null,
    artifacts: SLOTS.map((slot) => {
      const buildArtifact = row.buildArtifacts.find((ba) => ba.slot === slot);
      const artifact = buildArtifact?.ownedArtifact;
      return {
        slot,
        ownedArtifactId: artifact?.id ?? null,
        setName: artifact?.artifactSet.name ?? null,
        mainStatName: artifact?.mainStat.name ?? null,
        iconUrl: artifact ? slotIconUrl(artifact.artifactSet, slot) : null,
      };
    }),
    activeSetEffects: computeActiveSetEffects(row.buildArtifacts),
    createdAt: row.createdAt.getTime(),
  };
}

// Same grouping as computeActiveSetEffects (src/lib/active-set-effects.ts),
// but over already-flattened OwnedArtifactOption rows instead of a Prisma
// row shape -- used client-side (owned-build-manager.tsx's own save handler) to
// recompute a build's activeSetEffects optimistically right after an edit,
// without waiting on a server refetch.
export function activeSetEffectsFromArtifacts(artifacts: OwnedArtifactOption[]): ActiveSetEffectItem[] {
  const setPieceCounts = new Map<
    number,
    { setName: string; flowerIconUrl: string | null; rarity: number; count: number }
  >();
  for (const artifact of artifacts) {
    const existing = setPieceCounts.get(artifact.artifactSetId);
    if (existing) {
      existing.count += 1;
    } else {
      setPieceCounts.set(artifact.artifactSetId, {
        setName: artifact.setName,
        flowerIconUrl: artifact.flowerIconUrl,
        rarity: artifact.rarity,
        count: 1,
      });
    }
  }
  return [...setPieceCounts.values()]
    .filter((s) => s.count >= 2)
    .map((s) => ({
      setName: s.setName,
      flowerIconUrl: s.flowerIconUrl,
      rarity: s.rarity,
      maxPiece: (s.count >= 4 ? 4 : 2) as 2 | 4,
    }));
}

// "name" (build name) dropped in favor of "obtained" -- a user-typed build
// name isn't a very meaningful thing to alphabetize, unlike when it was
// created or which character it's for.
export type BuildSortKey = "obtained" | "character";

export type BuildFilters = {
  // Two independent queries, not one shared box -- each narrows the
  // result further when non-empty (AND, not OR), same convention
  // filterTeams (teams/filter-sort.ts) already uses for its own team-name/
  // character-name split: searching "Main DPS" + "Hu Tao" means "a build
  // named Main DPS that's also for Hu Tao", not "anything matching either
  // word". Replaced an earlier single search box that OR'd a query against
  // both fields at once, which made it impossible to narrow by one
  // specifically (e.g. every "Hu Tao"-matching build regardless of name).
  buildNameSearch: string;
  characterNameSearch: string;
  // Same character-page filters (element/weapon type/rarity), matched
  // against the build's own character -- a build IS a character, so
  // filtering by the character's own attributes is exactly filtering the
  // build list by them too.
  elementFilter: ReadonlySet<Element>;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: BuildSortKey;
  sortDirection: SortDirection;
};

export type BuildFilterCriteria = Omit<BuildFilters, "sortKey" | "sortDirection">;

// The filtering half of filterAndSortBuilds, split out so collection mode
// (owned-build-manager.tsx) can apply the same search/element/weapon-type/
// rarity narrowing to a build list whose ORDER already means something
// (a saved collection's own order, or the selected-first order while
// editing one) without filterAndSortBuilds's own sort silently overriding
// it -- same "filter-only, caller controls order" split filterTeams
// (teams/filter-sort.ts) already has, there because Teams never had a
// sort control to begin with.
export function filterBuilds(
  builds: BuildItem[],
  { buildNameSearch, characterNameSearch, elementFilter, weaponTypeFilter, rarityFilter }: BuildFilterCriteria
): BuildItem[] {
  let result = builds;

  const nameQuery = buildNameSearch.trim().toLowerCase();
  const characterQuery = characterNameSearch.trim().toLowerCase();
  if (nameQuery) {
    result = result.filter((build) => build.name.toLowerCase().includes(nameQuery));
  }
  if (characterQuery) {
    result = result.filter((build) => build.characterName.toLowerCase().includes(characterQuery));
  }
  if (elementFilter.size > 0) {
    result = result.filter((build) => elementFilter.has(build.characterElement));
  }
  if (weaponTypeFilter.size > 0) {
    result = result.filter((build) => weaponTypeFilter.has(build.characterWeaponType));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((build) => rarityFilter.has(build.characterRarity));
  }

  return result;
}

export function filterAndSortBuilds(builds: BuildItem[], filters: BuildFilters): BuildItem[] {
  const result = filterBuilds(builds, filters);
  const direction = filters.sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (filters.sortKey === "character") {
      return direction * a.characterName.localeCompare(b.characterName) || a.name.localeCompare(b.name);
    }
    // "obtained" -- same -direction (forward = newest first) convention
    // every other owned page's own "obtained" sort uses.
    return -direction * (a.createdAt - b.createdAt) || a.name.localeCompare(b.name);
  });
}

// A saved combination of Builds (the build-level equivalent of Teams' own
// Group -- see Collection's own schema comment) -- managed entirely from
// this page via "collection mode" (owned-build-manager.tsx), rather than a
// dedicated route. buildIds is already in the collection's own saved
// order (CollectionBuild rows ordered by id asc -- same "id order = slot
// order" convention GroupTeam/TeamBuild already rely on).
export type CollectionItem = {
  id: number;
  name: string;
  buildIds: number[];
};

export function toOverlapCheckBuild(build: BuildItem): OverlapCheckBuild {
  return {
    buildId: build.id,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.artifacts.flatMap((a) => (a.ownedArtifactId !== null ? [a.ownedArtifactId] : [])),
  };
}

// Narrows the full owned-builds list down to the ones actually pickable
// into the in-progress collection draft, given which builds are already
// selected. Unlike weapon/artifact reuse (flagged but never blocked, same
// as a Team/Group can drift into after the fact -- see
// computeCollectionConflicts below), a duplicate-character or
// exclusivityGroup conflict (e.g. two Traveler elements) is prevented
// from ever being CREATED in the first place: a not-yet-selected build is
// removed from the list entirely, not just dimmed, once its own character
// (or exclusivity group) already has a build selected -- the user's own
// explicit call: showing it anyway "just adds unnecessary info". An
// ALREADY-selected build always stays in the list regardless (so it can
// still be deselected), even in the hypothetical case its own character
// somehow conflicts with another already-selected one (shouldn't happen,
// since this same exclusion is what prevents that selection from ever
// being made to begin with).
export function availableCollectionBuilds(allBuilds: BuildItem[], selectedBuildIds: number[]): BuildItem[] {
  const selectedIdSet = new Set(selectedBuildIds);
  const selectedOverlapBuilds = allBuilds.filter((build) => selectedIdSet.has(build.id)).map(toOverlapCheckBuild);

  return allBuilds.filter((build) => {
    if (selectedIdSet.has(build.id)) return true;
    const conflicts = detectOverlaps([...selectedOverlapBuilds, toOverlapCheckBuild(build)]);
    return !conflicts.some(
      (conflict) =>
        (conflict.type === "duplicate-character" || conflict.type === "exclusivity-conflict") &&
        conflict.buildIds.includes(build.id)
    );
  });
}

// Narrowed, display-ready version of detectOverlaps' own OverlapConflict --
// same shape and same reasoning as TeamConflict (teams/filter-sort.ts):
// only shared-weapon/shared-artifact ever come back, since
// availableCollectionBuilds above already prevents a duplicate-character/
// exclusivityGroup conflict from ever being selected into a collection to
// begin with -- there's nothing here for describeCollectionConflict to
// ever need to describe for those two types. Hand-kept-in-sync with
// TeamConflict rather than shared directly -- BuildItem and BuildOption
// (teams/filter-sort.ts) are different types for the rest of their own
// fields, same reason filterAndSortBuilds/filterAndSortBuildOptions are
// also two separate functions rather than one.
export type CollectionConflict =
  | { type: "shared-weapon"; ownedWeaponId: number; buildIds: number[] }
  | { type: "shared-artifact"; ownedArtifactId: number; slot: ArtifactSlot; buildIds: number[] };

// Detects conflicts WITHIN an already-saved collection's own current
// builds (a build's weapon/artifacts can change later, from this same
// page, after it's already sitting in a collection -- same drift
// computeTeamConflicts' own comment describes for Teams) -- not the
// live "would adding this build create one" check availableCollectionBuilds
// already does before a pick is ever committed.
export function computeCollectionConflicts(members: BuildItem[]): CollectionConflict[] {
  const overlapBuilds = members.map(toOverlapCheckBuild);
  const conflicts: CollectionConflict[] = [];

  for (const conflict of detectOverlaps(overlapBuilds)) {
    if (conflict.type === "shared-weapon") {
      conflicts.push({ type: "shared-weapon", ownedWeaponId: conflict.ownedWeaponId, buildIds: conflict.buildIds });
    } else if (conflict.type === "shared-artifact") {
      const slot = members.flatMap((member) => member.artifacts).find((a) => a.ownedArtifactId === conflict.ownedArtifactId)?.slot;
      if (slot) conflicts.push({ type: "shared-artifact", ownedArtifactId: conflict.ownedArtifactId, slot, buildIds: conflict.buildIds });
    }
  }

  return conflicts;
}

// Same flags shape as buildConflictFlags (teams/filter-sort.ts), for the
// same reason -- BuildPortrait/BuildCard's own weaponConflict/
// artifactConflict props need a plain boolean/id-list, not the raw
// conflict objects.
export function buildCollectionConflictFlags(
  buildId: number,
  conflicts: CollectionConflict[]
): { weaponConflict: boolean; conflictingArtifactIds: number[] } {
  let weaponConflict = false;
  const conflictingArtifactIds: number[] = [];
  for (const conflict of conflicts) {
    if (!conflict.buildIds.includes(buildId)) continue;
    if (conflict.type === "shared-weapon") weaponConflict = true;
    else conflictingArtifactIds.push(conflict.ownedArtifactId);
  }
  return { weaponConflict, conflictingArtifactIds };
}

export type CollectionConflictPart =
  | { type: "build"; characterName: string; buildName: string }
  | { type: "text"; text: string };

// Same shape and wording as describeTeamConflict (teams/filter-sort.ts)
// -- see CollectionConflict's own comment on why this is a hand-kept-in-
// sync duplicate rather than a shared function.
export function describeCollectionConflict(conflict: CollectionConflict, members: BuildItem[]): CollectionConflictPart[] {
  const involved = conflict.buildIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BuildItem => member !== undefined);

  const parts: CollectionConflictPart[] = [];
  involved.forEach((member, index) => {
    if (index > 0) parts.push({ type: "text", text: " and " });
    parts.push({ type: "build", characterName: member.characterName, buildName: member.name });
  });
  parts.push({
    type: "text",
    text:
      conflict.type === "shared-weapon"
        ? " have the same weapon equipped"
        : ` have the same artifact - ${conflict.slot} equipped`,
  });

  return parts;
}
