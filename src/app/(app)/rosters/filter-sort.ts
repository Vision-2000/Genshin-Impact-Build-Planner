import type { OverlapCheckBuild } from "@/lib/overlap";

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

export type RosterMemberItem = {
  buildId: number;
  name: string;
  characterName: string;
  characterIconUrl: string | null;
};

export type RosterItem = {
  id: number;
  name: string;
  members: RosterMemberItem[];
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

export function filterRosters(rosters: RosterItem[], search: string): RosterItem[] {
  const query = search.trim().toLowerCase();
  const result = query
    ? rosters.filter(
        (roster) =>
          roster.name.toLowerCase().includes(query) ||
          roster.members.some((member) => member.characterName.toLowerCase().includes(query))
      )
    : rosters;

  return [...result].sort((a, b) => a.name.localeCompare(b.name));
}
