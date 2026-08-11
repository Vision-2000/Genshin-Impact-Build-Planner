import type { OverlapCheckBuild } from "@/lib/overlap";

export const MAX_TEAM_SIZE = 4;

// A build as available for selection, carrying everything detectOverlaps
// needs plus what the UI needs to display it.
export type BuildOption = {
  buildId: number;
  name: string;
  characterName: string;
  characterIconUrl: string | null;
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

export function filterTeams(teams: TeamItem[], search: string): TeamItem[] {
  const query = search.trim().toLowerCase();
  const result = query
    ? teams.filter(
        (team) =>
          team.name.toLowerCase().includes(query) ||
          team.members.some((member) => member.characterName.toLowerCase().includes(query))
      )
    : teams;

  return [...result].sort((a, b) => a.name.localeCompare(b.name));
}
