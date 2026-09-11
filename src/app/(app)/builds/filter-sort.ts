import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import type { SortDirection } from "@/lib/sort";
import { slotIconUrl } from "../artifacts/filter-sort";

export type { SortDirection };

export type OwnedCharacterOption = {
  ownedCharacterId: number;
  characterId: number;
  name: string;
  iconUrl: string | null;
  weaponType: WeaponType;
  element: Element;
  rarity: number;
};

export type OwnedWeaponOption = {
  ownedWeaponId: number;
  name: string;
  iconUrl: string | null;
  weaponType: WeaponType;
  refinement: number;
  rarity: number;
  secondaryStatName: string | null;
};

export type OwnedArtifactOption = {
  ownedArtifactId: number;
  slot: ArtifactSlot;
  setName: string;
  mainStatName: string;
  iconUrl: string | null;
  rarity: number;
  level: number;
  substats: { statTypeName: string; value: number }[];
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
    characterName: row.ownedCharacter.character.name,
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
