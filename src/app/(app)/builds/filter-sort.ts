import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import { travelerDisplayName } from "@/lib/character-scaling";
import type { WeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { slotIconUrl } from "../artifacts/filter-sort";

export type { SortDirection, WeaponHoverDetail };

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
  rarity: number;
  level: number;
  substats: StatBonusItem[];
  // The set's own 2pc/4pc stat bonuses -- see FinalStatsArtifactInput's own
  // comment on why these are duplicated per-piece rather than looked up
  // separately.
  twoPieceStatBonuses: StatBonusItem[];
  fourPieceStatBonuses: StatBonusItem[];
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
  ownedCharacter: {
    character: { name: string; iconUrl: string | null; element: Element; rarity: number; weaponType: WeaponType };
  };
  ownedWeapon: {
    refinement: number;
    weapon: { name: string; iconUrl: string | null; rarity: number };
  } | null;
  buildArtifacts: {
    slot: ArtifactSlot;
    ownedArtifact: { id: number; artifactSet: { name: string } & ArtifactSetIcons; mainStat: { name: string } };
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
  };
}

export type BuildSortKey = "name" | "character";

export type BuildFilters = {
  search: string;
  sortKey: BuildSortKey;
  sortDirection: SortDirection;
};

export function filterAndSortBuilds(
  builds: BuildItem[],
  { search, sortKey, sortDirection }: BuildFilters
): BuildItem[] {
  let result = builds;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter(
      (build) => build.name.toLowerCase().includes(query) || build.characterName.toLowerCase().includes(query)
    );
  }

  const direction = sortDirection === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    if (sortKey === "character") {
      return direction * a.characterName.localeCompare(b.characterName) || a.name.localeCompare(b.name);
    }
    return direction * a.name.localeCompare(b.name);
  });
}
