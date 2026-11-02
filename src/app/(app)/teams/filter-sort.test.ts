import { describe, it, expect } from "vitest";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import {
  filterTeams,
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
