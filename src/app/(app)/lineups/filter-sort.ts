import type { OverlapCheckBuild } from "@/lib/overlap";

// A team as available for selection, carrying its builds' overlap data plus
// what the UI needs to display it.
export type TeamOption = {
  teamId: number;
  name: string;
  builds: OverlapCheckBuild[];
};

export type LineupMemberItem = {
  teamId: number;
  teamName: string;
};

export type LineupItem = {
  id: number;
  name: string;
  members: LineupMemberItem[];
};

// Flattens the builds of every given team into one list, so detectOverlaps
// can be run once across the whole lineup (a build can conflict with a build
// from another team, not just another build in the same team).
export function combinedOverlapBuilds(teams: TeamOption[], teamIds: number[]): OverlapCheckBuild[] {
  const idSet = new Set(teamIds);
  return teams.filter((team) => idSet.has(team.teamId)).flatMap((team) => team.builds);
}

export function filterLineups(lineups: LineupItem[], search: string): LineupItem[] {
  const query = search.trim().toLowerCase();
  const result = query
    ? lineups.filter(
        (lineup) =>
          lineup.name.toLowerCase().includes(query) ||
          lineup.members.some((member) => member.teamName.toLowerCase().includes(query))
      )
    : lineups;

  return [...result].sort((a, b) => a.name.localeCompare(b.name));
}
