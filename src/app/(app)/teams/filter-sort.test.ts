import { describe, it, expect } from "vitest";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import {
  filterTeams,
  filterAndSortBuildOptions,
  combinedOverlapBuilds,
  computeTeamConflicts,
  buildConflictFlags,
  describeTeamConflict,
  type TeamItem,
  type TeamMemberItem,
  type BuildOption,
} from "./filter-sort";

function member(overrides: Partial<TeamMemberItem>): TeamMemberItem {
  return { buildId: 1, name: "Main DPS", characterName: "Hu Tao", characterIconUrl: null, ...overrides };
}

function team(overrides: Partial<TeamItem>): TeamItem {
  return { id: 1, name: "Test Team", members: [], ...overrides };
}

function buildOption(overrides: Partial<BuildOption>): BuildOption {
  return {
    buildId: 1,
    name: "Main DPS",
    characterName: "Hu Tao",
    characterIconUrl: null,
    element: Element.Pyro,
    rarity: 5,
    weaponType: WeaponType.Polearm,
    isMoonsignCharacter: false,
    isHexereiCharacter: false,
    ownedCharacterId: 1,
    exclusivityGroup: null,
    ownedWeaponId: null,
    ownedArtifacts: [],
    weaponIconUrl: null,
    weaponRarity: null,
    activeSetEffects: [],
    createdAt: 0,
    ...overrides,
  };
}

describe("filterTeams", () => {
  const teams: TeamItem[] = [
    team({ id: 1, name: "National Team", members: [member({ characterName: "Xingqiu" })] }),
    team({ id: 2, name: "Vaporize Team", members: [member({ characterName: "Hu Tao" })] }),
    team({ id: 3, name: "Anemo Team", members: [member({ characterName: "Kazuha" })] }),
  ];

  it("returns everything in its given order with both queries empty, not sorted by name", () => {
    // TeamManager hands this whatever order it's already maintaining
    // (most-recently-created-first, from the server's own orderBy) --
    // filterTeams has no sort of its own and must preserve that, not
    // re-sort by name.
    const result = filterTeams(teams, "", "");
    expect(result.map((t) => t.name)).toEqual(["National Team", "Vaporize Team", "Anemo Team"]);
  });

  it("filters by case-insensitive, whitespace-trimmed team name", () => {
    const result = filterTeams(teams, "  national  ", "");
    expect(result.map((t) => t.name)).toEqual(["National Team"]);
  });

  it("filters by a member's character name via the separate character query", () => {
    const result = filterTeams(teams, "", "kazuha");
    expect(result.map((t) => t.name)).toEqual(["Anemo Team"]);
  });

  it("combines both queries as AND, not OR", () => {
    // "National" matches team 1's own name; "Hu Tao" is team 2's member,
    // not team 1's -- so a team has to satisfy BOTH to show up, and here
    // none do.
    const result = filterTeams(teams, "national", "hu tao");
    expect(result).toEqual([]);

    // Team 1 does satisfy both of its own queries at once.
    const matching = filterTeams(teams, "national", "xingqiu");
    expect(matching.map((t) => t.name)).toEqual(["National Team"]);
  });

  it("preserves original relative order across multiple matches, not alphabetical", () => {
    const result = filterTeams(teams, "team", "");
    expect(result.map((t) => t.name)).toEqual(["National Team", "Vaporize Team", "Anemo Team"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterTeams(teams, "nonexistent", "");
    expect(result).toEqual([]);
  });
});

describe("combinedOverlapBuilds", () => {
  const teamsWithMembers: TeamItem[] = [
    team({ id: 1, name: "Team A", members: [member({ buildId: 1 })] }),
    team({ id: 2, name: "Team B", members: [member({ buildId: 2 })] }),
    team({ id: 3, name: "Team C", members: [member({ buildId: 3 })] }),
  ];
  const builds: BuildOption[] = [
    buildOption({ buildId: 1, ownedCharacterId: 1, ownedWeaponId: 10 }),
    buildOption({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 20 }),
    buildOption({ buildId: 3, ownedCharacterId: 3, ownedWeaponId: 30 }),
  ];

  it("flattens builds only from the given team ids", () => {
    const result = combinedOverlapBuilds(teamsWithMembers, builds, [1, 3]);
    expect(result.map((b) => b.buildId)).toEqual([1, 3]);
  });

  it("returns an empty list when no team ids are given", () => {
    expect(combinedOverlapBuilds(teamsWithMembers, builds, [])).toEqual([]);
  });

  it("carries each build's own overlap-relevant fields through", () => {
    const [result] = combinedOverlapBuilds(teamsWithMembers, builds, [1]);
    expect(result).toEqual({
      buildId: 1,
      ownedCharacterId: 1,
      exclusivityGroup: null,
      ownedWeaponId: 10,
      ownedArtifactIds: [],
    });
  });
});

// Mirrors builds/filter-sort.test.ts's own filterAndSortBuilds suite --
// see filterAndSortBuildOptions' own comment on why this is a separate,
// hand-kept-in-sync function rather than the same one.
describe("filterAndSortBuildOptions", () => {
  const baseFilters = {
    buildNameSearch: "",
    characterNameSearch: "",
    elementFilter: new Set<Element>(),
    weaponTypeFilter: new Set<WeaponType>(),
    rarityFilter: new Set<number>(),
    sortKey: "obtained" as const,
    sortDirection: "asc" as const,
  };

  const builds: BuildOption[] = [
    buildOption({ buildId: 1, name: "Main DPS", characterName: "Hu Tao", createdAt: 100 }),
    buildOption({ buildId: 2, name: "Support", characterName: "Kazuha", createdAt: 300 }),
    buildOption({ buildId: 3, name: "Alt Build", characterName: "Hu Tao", createdAt: 200 }),
  ];

  it("returns everything sorted by obtained (newest first) with no filters applied", () => {
    const result = filterAndSortBuildOptions(builds, baseFilters);
    expect(result.map((b) => b.name)).toEqual(["Support", "Alt Build", "Main DPS"]);
  });

  it("filters by case-insensitive, whitespace-trimmed build name", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, buildNameSearch: "  main  " });
    expect(result.map((b) => b.name)).toEqual(["Main DPS"]);
  });

  it("filters by character name via the separate character query", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, characterNameSearch: "kazuha" });
    expect(result.map((b) => b.name)).toEqual(["Support"]);
  });

  it("combines both queries as AND, not OR", () => {
    const result = filterAndSortBuildOptions(builds, {
      ...baseFilters,
      buildNameSearch: "alt",
      characterNameSearch: "hu tao",
    });
    expect(result.map((b) => b.name)).toEqual(["Alt Build"]);

    const none = filterAndSortBuildOptions(builds, {
      ...baseFilters,
      buildNameSearch: "alt",
      characterNameSearch: "kazuha",
    });
    expect(none).toEqual([]);
  });

  it("sorts by character, breaking ties by build name", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, sortKey: "character" });
    expect(result.map((b) => `${b.characterName}: ${b.name}`)).toEqual([
      "Hu Tao: Alt Build",
      "Hu Tao: Main DPS",
      "Kazuha: Support",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, buildNameSearch: "nonexistent" });
    expect(result).toEqual([]);
  });

  it("sorts by obtained oldest-first when direction is desc", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, sortDirection: "desc" });
    expect(result.map((b) => b.name)).toEqual(["Main DPS", "Alt Build", "Support"]);
  });

  it("sorts by character descending, breaking ties by build name ascending", () => {
    const result = filterAndSortBuildOptions(builds, { ...baseFilters, sortKey: "character", sortDirection: "desc" });
    expect(result.map((b) => `${b.characterName}: ${b.name}`)).toEqual([
      "Kazuha: Support",
      "Hu Tao: Alt Build",
      "Hu Tao: Main DPS",
    ]);
  });

  describe("character-page filters", () => {
    const mixedBuilds: BuildOption[] = [
      buildOption({ buildId: 1, name: "Pyro Polearm 5-star", element: Element.Pyro, weaponType: WeaponType.Polearm, rarity: 5 }),
      buildOption({ buildId: 2, name: "Hydro Sword 4-star", element: Element.Hydro, weaponType: WeaponType.Sword, rarity: 4 }),
    ];

    it("filters by element", () => {
      const result = filterAndSortBuildOptions(mixedBuilds, { ...baseFilters, elementFilter: new Set([Element.Hydro]) });
      expect(result.map((b) => b.name)).toEqual(["Hydro Sword 4-star"]);
    });

    it("filters by weapon type", () => {
      const result = filterAndSortBuildOptions(mixedBuilds, {
        ...baseFilters,
        weaponTypeFilter: new Set([WeaponType.Polearm]),
      });
      expect(result.map((b) => b.name)).toEqual(["Pyro Polearm 5-star"]);
    });

    it("filters by rarity", () => {
      const result = filterAndSortBuildOptions(mixedBuilds, { ...baseFilters, rarityFilter: new Set([4]) });
      expect(result.map((b) => b.name)).toEqual(["Hydro Sword 4-star"]);
    });
  });
});

describe("computeTeamConflicts", () => {
  it("returns nothing for a team with no shared weapon/artifact", () => {
    const members = [
      buildOption({ buildId: 1, ownedWeaponId: 10 }),
      buildOption({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 11 }),
    ];
    expect(computeTeamConflicts(members)).toEqual([]);
  });

  it("flags two builds sharing the same owned weapon", () => {
    const members = [
      buildOption({ buildId: 1, ownedWeaponId: 10 }),
      buildOption({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: 10 }),
    ];
    expect(computeTeamConflicts(members)).toEqual([{ type: "shared-weapon", ownedWeaponId: 10, buildIds: [1, 2] }]);
  });

  it("flags two builds sharing the same owned artifact, with that artifact's own slot attached", () => {
    const members = [
      buildOption({ buildId: 1, ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Flower }] }),
      buildOption({
        buildId: 2,
        ownedCharacterId: 2,
        ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Flower }],
      }),
    ];
    expect(computeTeamConflicts(members)).toEqual([
      { type: "shared-artifact", ownedArtifactId: 20, slot: ArtifactSlot.Flower, buildIds: [1, 2] },
    ]);
  });

  it("ignores a shared null weapon -- no real weapon equipped isn't a real conflict", () => {
    const members = [
      buildOption({ buildId: 1, ownedWeaponId: null }),
      buildOption({ buildId: 2, ownedCharacterId: 2, ownedWeaponId: null }),
    ];
    expect(computeTeamConflicts(members)).toEqual([]);
  });
});

describe("buildConflictFlags", () => {
  const conflicts = computeTeamConflicts([
    buildOption({ buildId: 1, ownedWeaponId: 10, ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Flower }] }),
    buildOption({
      buildId: 2,
      ownedCharacterId: 2,
      ownedWeaponId: 10,
      ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Flower }],
    }),
    buildOption({ buildId: 3, ownedCharacterId: 3, ownedWeaponId: 11 }),
  ]);

  it("flags both the weapon and artifact conflicts for a build involved in both", () => {
    expect(buildConflictFlags(1, conflicts)).toEqual({ weaponConflict: true, conflictingArtifactIds: [20] });
  });

  it("returns no conflicts for a build that isn't involved in any", () => {
    expect(buildConflictFlags(3, conflicts)).toEqual({ weaponConflict: false, conflictingArtifactIds: [] });
  });
});

describe("describeTeamConflict", () => {
  const members = [
    buildOption({ buildId: 1, name: "Main DPS", characterName: "Hu Tao", ownedWeaponId: 10 }),
    buildOption({ buildId: 2, name: "Support", characterName: "Xingqiu", ownedCharacterId: 2, ownedWeaponId: 10 }),
  ];

  it("names both builds for a shared weapon", () => {
    const [conflict] = computeTeamConflicts(members);
    expect(describeTeamConflict(conflict, members)).toEqual([
      { type: "build", characterName: "Hu Tao", buildName: "Main DPS" },
      { type: "text", text: " and " },
      { type: "build", characterName: "Xingqiu", buildName: "Support" },
      { type: "text", text: " have the same weapon equipped" },
    ]);
  });

  it("names both builds and the artifact's own slot (with a dash before it) for a shared artifact", () => {
    const artifactMembers = [
      buildOption({
        buildId: 1,
        name: "Main DPS",
        characterName: "Hu Tao",
        ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Circlet }],
      }),
      buildOption({
        buildId: 2,
        name: "Support",
        characterName: "Xingqiu",
        ownedCharacterId: 2,
        ownedArtifacts: [{ ownedArtifactId: 20, slot: ArtifactSlot.Circlet }],
      }),
    ];
    const [conflict] = computeTeamConflicts(artifactMembers);
    expect(describeTeamConflict(conflict, artifactMembers)).toEqual([
      { type: "build", characterName: "Hu Tao", buildName: "Main DPS" },
      { type: "text", text: " and " },
      { type: "build", characterName: "Xingqiu", buildName: "Support" },
      { type: "text", text: " have the same artifact - Circlet equipped" },
    ]);
  });
});
