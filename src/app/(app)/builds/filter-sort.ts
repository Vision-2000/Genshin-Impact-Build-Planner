import { ArtifactSlot, WeaponType } from "@/generated/prisma/enums";
import { slotIconUrl } from "../artifacts/filter-sort";

export type OwnedCharacterOption = {
  ownedCharacterId: number;
  characterId: number;
  name: string;
  iconUrl: string | null;
  weaponType: WeaponType;
};

export type OwnedWeaponOption = {
  ownedWeaponId: number;
  name: string;
  iconUrl: string | null;
  weaponType: WeaponType;
  refinement: number;
};

export type OwnedArtifactOption = {
  ownedArtifactId: number;
  slot: ArtifactSlot;
  setName: string;
  mainStatName: string;
  iconUrl: string | null;
  rarity: number;
  level: number;
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
  ownedWeaponId: number | null;
  weaponName: string | null;
  weaponIconUrl: string | null;
  weaponRefinement: number | null;
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
  ownedCharacter: { character: { name: string; iconUrl: string | null } };
  ownedWeapon: { refinement: number; weapon: { name: string; iconUrl: string | null } } | null;
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
    ownedWeaponId: row.ownedWeaponId,
    weaponName: row.ownedWeapon?.weapon.name ?? null,
    weaponIconUrl: row.ownedWeapon?.weapon.iconUrl ?? null,
    weaponRefinement: row.ownedWeapon?.refinement ?? null,
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
};

export function filterAndSortBuilds(builds: BuildItem[], { search, sortKey }: BuildFilters): BuildItem[] {
  let result = builds;

  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter(
      (build) => build.name.toLowerCase().includes(query) || build.characterName.toLowerCase().includes(query)
    );
  }

  return [...result].sort((a, b) => {
    if (sortKey === "character") {
      return a.characterName.localeCompare(b.characterName) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}
