import { ArtifactSlot, Element, TalentSlot, WeaponType } from "@/generated/prisma/enums";
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
    character: { name: string; iconUrl: string | null; element: Element; rarity: number; weaponType: WeaponType };
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

export function filterAndSortBuilds(
  builds: BuildItem[],
  { buildNameSearch, characterNameSearch, elementFilter, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: BuildFilters
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

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "character") {
      return direction * a.characterName.localeCompare(b.characterName) || a.name.localeCompare(b.name);
    }
    // "obtained" -- same -direction (forward = newest first) convention
    // every other owned page's own "obtained" sort uses.
    return -direction * (a.createdAt - b.createdAt) || a.name.localeCompare(b.name);
  });
}
