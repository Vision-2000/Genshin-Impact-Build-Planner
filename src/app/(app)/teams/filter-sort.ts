import { Element, WeaponType } from "@/generated/prisma/enums";
import type { OverlapCheckBuild } from "@/lib/overlap";

export const MAX_TEAM_SIZE = 4;

// A build as available for selection, carrying everything detectOverlaps
// needs plus what the UI needs to display it. element/rarity/weaponType
// (the character's own, not stored on Build itself) are here so
// BuildSlotPicker can render each candidate as a CharacterCard without a
// second lookup -- the owned-builds page's own BuildItem doesn't need
// these (it uses BuildCard, not CharacterCard), which is why this is its
// own type rather than reusing that one.
export type BuildOption = {
  buildId: number;
  name: string;
  characterName: string;
  characterIconUrl: string | null;
  element: Element;
  rarity: number;
  weaponType: WeaponType;
  ownedCharacterId: number;
  exclusivityGroup: string | null;
  ownedWeaponId: number | null;
  ownedArtifactIds: number[];
};

export type TeamMemberItem = {
  buildId: number;
  name: string;
  characterName: string;
  characterIconUrl: string | null;
};

export type TeamItem = {
  id: number;
  name: string;
  members: TeamMemberItem[];
};

export function toOverlapCheckBuild(build: BuildOption): OverlapCheckBuild {
  return {
    buildId: build.buildId,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.ownedArtifactIds,
  };
}

// No sort of its own -- teams arrive (and stay) in most-recently-updated-
// first order, both from the server's own orderBy and from TeamManager's
// own optimistic reordering on every local mutation (see its touchTeam),
// so filtering just needs to preserve whatever order it's handed rather
// than re-sorting by name the way this used to.
export function filterTeams(teams: TeamItem[], search: string): TeamItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return teams;

  return teams.filter(
    (team) =>
      team.name.toLowerCase().includes(query) ||
      team.members.some((member) => member.characterName.toLowerCase().includes(query))
  );
}
