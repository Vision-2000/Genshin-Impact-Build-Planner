import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { detectOverlaps, type OverlapCheckBuild, type OverlapConflict } from "@/lib/overlap";
import type { ActiveSetEffectItem } from "@/lib/active-set-effects";
import type { SortDirection } from "@/lib/sort";
import type { BuildSortKey } from "../builds/filter-sort";

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
  // Derived server-side from the character's own Passive 3 talent name
  // (see moonsign-hexerei.ts's own comment) -- not a stored field of its
  // own, just carried here so TeamCard can count them without a second
  // lookup, same reasoning as element/rarity/weaponType above.
  isMoonsignCharacter: boolean;
  isHexereiCharacter: boolean;
  ownedCharacterId: number;
  exclusivityGroup: string | null;
  ownedWeaponId: number | null;
  // slot alongside each id (not a flat ownedArtifactId[] the way this used
  // to be) -- computeTeamConflicts needs it to name WHICH slot a shared
  // artifact occupies in its own warning text. A physical artifact piece's
  // own slot is fixed forever (OwnedArtifact.slot never changes once
  // created), so this is the same single value regardless of which build
  // it's looked up through.
  ownedArtifacts: { ownedArtifactId: number; slot: ArtifactSlot }[];
  // Backs the filled build-slot card's own weapon/artifact-set-effect
  // badges (build-slot-picker.tsx) -- same "show at a glance" reasoning as
  // the Builds page's own BuildCard, just at a small circular badge size
  // instead of a full tile. weaponRarity is null exactly when
  // ownedWeaponId/weaponIconUrl are -- no real weapon equipped.
  weaponIconUrl: string | null;
  weaponRarity: number | null;
  activeSetEffects: ActiveSetEffectItem[];
  // Backs filterAndSortBuildOptions' own "obtained" sort (below), the same
  // field BuildItem (builds/filter-sort.ts) already carries for its own
  // identical sort key.
  createdAt: number;
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

// A saved combination of Teams (formerly its own "Lineup" entity/page, now
// managed entirely from "group mode" on this page -- see team-manager.tsx's
// own top comment). teamIds is already in the group's own saved order
// (GroupTeam rows ordered by id asc -- see that model's own schema
// comment on why id order IS selection order), so a caller never needs to
// re-derive it.
export type GroupItem = {
  id: number;
  name: string;
  teamIds: number[];
};

// A team's own members, resolved against the full owned-builds list --
// team.members only carries buildId/name/characterName/characterIconUrl
// (TeamMemberItem, enough for the plain member list), not the full
// BuildOption shape computeTeamConflicts/elemental-resonance/etc. need, so
// this is the one place that join happens. A member whose build no longer
// exists in `builds` (shouldn't happen in practice -- deleting a Build
// cascades it out of any team, per CLAUDE.md) is silently dropped rather
// than crashing.
export function memberBuildsForTeam(team: TeamItem, builds: BuildOption[]): BuildOption[] {
  return team.members
    .map((member) => builds.find((build) => build.buildId === member.buildId))
    .filter((build): build is BuildOption => build !== undefined);
}

export function toOverlapCheckBuild(build: BuildOption): OverlapCheckBuild {
  return {
    buildId: build.buildId,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.ownedArtifacts.map((a) => a.ownedArtifactId),
  };
}

// Flattens every given team's own builds into one list, so detectOverlaps
// can be run once across the whole group -- a build can conflict with a
// build from ANOTHER team, not just another build in the same team. Used
// both for group-mode's own live validation (an in-progress draft
// selection) and for flagging an already-saved group that's drifted into
// conflict since it was last saved (a team's own builds can change after
// the fact, same reasoning computeTeamConflicts above already has for a
// single team). Order of `teamIds` doesn't matter here -- detectOverlaps
// itself doesn't care which build came from which team, only that none of
// them collide.
// Deliberately NOT deduped by buildId -- unlike reusing the same build
// across unrelated Teams (fine on its own, per CLAUDE.md: "a build can be
// reused across multiple teams/rosters simultaneously"), a GROUP exists
// specifically to bundle teams meant to be used TOGETHER. The same build
// sitting in two of a group's own teams means the same real character/
// weapon/artifacts would need to be active in two places simultaneously
// -- not something any actual in-game content allows -- so this has to
// stay flagged as a genuine conflict (duplicate-character, structurally,
// since it's the same ownedCharacterId appearing twice) rather than
// silently deduped away. See describeCharacterConflict's own
// teamsForBuild for the other half of this: correctly naming BOTH
// teams a reused build sits in, not just whichever one happens to be
// found first.
export function combinedOverlapBuilds(teams: TeamItem[], builds: BuildOption[], teamIds: number[]): OverlapCheckBuild[] {
  const idSet = new Set(teamIds);
  return teams
    .filter((team) => idSet.has(team.id))
    .flatMap((team) => memberBuildsForTeam(team, builds).map(toOverlapCheckBuild));
}

// Same structured-parts shape as TeamConflictPart, plus teamName on each
// build -- the one thing a single team's own conflict message
// (describeTeamConflict) never needed to say, since everything there was
// already understood to be in the same team.
export type GroupConflictPart =
  | { type: "build"; characterName: string; buildName: string; teamName: string }
  | { type: "text"; text: string };

function teamNameForBuild(buildId: number, teams: TeamItem[]): string {
  return teams.find((team) => team.members.some((member) => member.buildId === buildId))?.name ?? "Unknown team";
}

// EVERY team containing this build, not just the first -- needed
// specifically for the "same build reused across two of the group's own
// teams" case (combinedOverlapBuilds' own comment on why that stays a
// real conflict): detectOverlaps sees that as the same ownedCharacterId
// appearing twice, so conflict.buildIds comes back as [X, X] -- two
// IDENTICAL ids, not two different builds. teamNameForBuild's own
// .find() would then return the SAME (first-matching) team for both
// occurrences, collapsing the message down to just one team once
// deduped -- which is exactly the bug this fixes, by finding every team
// a given id sits in instead of stopping at the first. Returns the
// TEAMS themselves, not their names -- describeCharacterConflict needs
// to dedupe by team IDENTITY (id), not by display name, since two
// genuinely different teams can share the same name (a team's own name
// is a plain user-typed label, not unique -- nothing in this app
// enforces that it is).
function teamsForBuild(buildId: number, teams: TeamItem[]): TeamItem[] {
  return teams.filter((team) => team.members.some((member) => member.buildId === buildId));
}

// Character-level conflicts (duplicate-character, and exclusivity-conflict
// -- currently always Traveler, the only exclusivityGroup value this app
// ever sets, see Character's own schema comment) take priority over
// weapon/artifact conflicts in the group-mode UI -- see
// prioritizeGroupConflicts below. Deliberately a flat sentence, not the
// build-enumeration shape describeGroupConflict's own weapon/artifact
// branch uses below it -- which build within the group happens to hold
// that character isn't the useful part of this message, which team(s)
// it's duplicated across is.
function describeCharacterConflict(
  conflict: Extract<OverlapConflict, { type: "duplicate-character" | "exclusivity-conflict" }>,
  teams: TeamItem[],
  builds: BuildOption[]
): GroupConflictPart[] {
  const characterName =
    conflict.type === "duplicate-character"
      ? builds.find((b) => b.ownedCharacterId === conflict.ownedCharacterId)?.characterName ?? "This character"
      : // exclusivityGroup itself (e.g. "traveler"), not any one involved
        // build's own characterName -- the two conflicting builds can be
        // DIFFERENT Traveler elements/genders, so there's no single
        // "the character" to name; the shared group identity is what's
        // actually being duplicated.
        conflict.exclusivityGroup.charAt(0).toUpperCase() + conflict.exclusivityGroup.slice(1);

  // flatMap (not map) -- a conflict between the SAME build reused across
  // two teams comes back as buildIds [X, X], so mapping to one team per
  // id would only ever find one team per (identical) id; flatMap over
  // teamsForBuild's own per-id list of every team that build sits in is
  // what actually recovers both. Deduped by id (a Map, not a Set of
  // names) -- two DIFFERENT teams that happen to share the same name
  // must still both show up here, once each; deduping on the name string
  // itself would wrongly collapse them into one.
  const involvedTeams = conflict.buildIds.flatMap((id) => teamsForBuild(id, teams));
  const uniqueTeams = [...new Map(involvedTeams.map((team) => [team.id, team])).values()];

  return [
    { type: "text", text: `${characterName} is present in multiple teams: ${uniqueTeams.map((team) => team.name).join(", ")}` },
  ];
}

// Describes one detectOverlaps conflict across a GROUP's own draft/saved
// selection of teams (team-manager.tsx's own groupDraftConflicts) --
// unlike describeTeamConflict, which only ever has to handle shared-
// weapon/shared-artifact (a single already-SAVED team structurally can't
// have a duplicate-character or exclusivityGroup conflict -- see
// TeamConflict's own comment on why), a GROUP spans multiple teams, so
// both of those ARE genuinely reachable here: the same character's build
// sitting in two different teams, or two Traveler elements each in their
// own team. Takes the raw, unnarrowed OverlapConflict (not TeamConflict)
// for exactly that reason -- the character-level branch is split out into
// describeCharacterConflict above, since its message shape is genuinely
// different (no build enumeration at all), not just a different suffix.
export function describeGroupConflict(conflict: OverlapConflict, teams: TeamItem[], builds: BuildOption[]): GroupConflictPart[] {
  if (conflict.type === "duplicate-character" || conflict.type === "exclusivity-conflict") {
    return describeCharacterConflict(conflict, teams, builds);
  }

  const involved = conflict.buildIds
    .map((id) => {
      const build = builds.find((b) => b.buildId === id);
      return build ? { build, teamName: teamNameForBuild(id, teams) } : undefined;
    })
    .filter((entry): entry is { build: BuildOption; teamName: string } => entry !== undefined);

  const parts: GroupConflictPart[] = [];
  involved.forEach(({ build, teamName }, index) => {
    if (index > 0) parts.push({ type: "text", text: " and " });
    parts.push({ type: "build", characterName: build.characterName, buildName: build.name, teamName });
  });

  if (conflict.type === "shared-weapon") {
    parts.push({ type: "text", text: " have the same weapon equipped" });
  } else {
    // shared-artifact -- the slot (OverlapConflict itself only carries the
    // raw ownedArtifactId) is looked up from whichever involved build
    // actually has it, same technique computeTeamConflicts uses for its
    // own enriched TeamConflict.
    const slot = builds.flatMap((b) => b.ownedArtifacts).find((a) => a.ownedArtifactId === conflict.ownedArtifactId)?.slot;
    parts.push({ type: "text", text: ` have the same artifact${slot ? ` - ${slot}` : ""} equipped` });
  }

  return parts;
}

// Character-level conflicts (duplicate-character/exclusivity-conflict)
// take priority over shared-weapon/shared-artifact ones, per the user's
// own explicit request: once a build is already flagged for being the
// wrong CHARACTER for this group (present in multiple teams, or sharing
// Traveler's own exclusivity slot with another team), a weapon/artifact
// it also happens to share is redundant noise on top of that -- the
// character conflict is the one actually worth fixing, and showing both
// at once read as more confusing, not more informative. Keeps every
// character-level conflict unconditionally; drops a shared-weapon/
// shared-artifact one only if it shares a build with some character-
// level conflict (not necessarily the SAME pair -- any one of its own
// builds already being character-flagged is enough to suppress it).
export function prioritizeGroupConflicts(conflicts: OverlapConflict[]): OverlapConflict[] {
  const characterConflicts = conflicts.filter(
    (conflict) => conflict.type === "duplicate-character" || conflict.type === "exclusivity-conflict"
  );
  const flaggedBuildIds = new Set(characterConflicts.flatMap((conflict) => conflict.buildIds));

  const otherConflicts = conflicts.filter(
    (conflict) =>
      conflict.type !== "duplicate-character" &&
      conflict.type !== "exclusivity-conflict" &&
      !conflict.buildIds.some((id) => flaggedBuildIds.has(id))
  );

  return [...characterConflicts, ...otherConflicts];
}

export type BuildOptionFilters = {
  // Two independent queries, not one shared box -- same AND-combined
  // convention filterAndSortBuilds (builds/filter-sort.ts) and filterTeams
  // (above) both already use for their own name-search splits.
  buildNameSearch: string;
  characterNameSearch: string;
  elementFilter: ReadonlySet<Element>;
  weaponTypeFilter: ReadonlySet<WeaponType>;
  rarityFilter: ReadonlySet<number>;
  sortKey: BuildSortKey;
  sortDirection: SortDirection;
};

// Same filter/sort semantics as the Builds page's own filterAndSortBuilds
// (builds/filter-sort.ts) -- BuildSlotPicker's own "Choose build" modal
// imports the exact same search/filter/sort options that page offers, so
// picking from a long owned-builds list works the same way in both
// places. Not literally the same function: BuildOption's own element/
// weaponType/rarity fields are deliberately named differently from
// BuildItem's characterElement/characterWeaponType/characterRarity (see
// BuildOption's own top comment -- it backs BuildPortrait/CharacterCard
// display, not BuildCard, which is why the two types were never unified),
// so the two are kept in sync by hand rather than sharing one
// implementation. A behavior change to one's semantics should be mirrored
// in the other.
export function filterAndSortBuildOptions(
  builds: BuildOption[],
  { buildNameSearch, characterNameSearch, elementFilter, weaponTypeFilter, rarityFilter, sortKey, sortDirection }: BuildOptionFilters
): BuildOption[] {
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
    result = result.filter((build) => elementFilter.has(build.element));
  }
  if (weaponTypeFilter.size > 0) {
    result = result.filter((build) => weaponTypeFilter.has(build.weaponType));
  }
  if (rarityFilter.size > 0) {
    result = result.filter((build) => rarityFilter.has(build.rarity));
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

// Narrowed, display-ready version of detectOverlaps' own OverlapConflict --
// only the two types that can actually occur in an ALREADY-SAVED team (see
// this function's own comment below on why duplicate-character/
// exclusivity-conflict can't), enriched with the artifact's own slot (so
// describeTeamConflict can name it) since OverlapConflict itself only
// carries the raw id.
export type TeamConflict =
  | { type: "shared-weapon"; ownedWeaponId: number; buildIds: number[] }
  | { type: "shared-artifact"; ownedArtifactId: number; slot: ArtifactSlot; buildIds: number[] };

// Detects conflicts WITHIN an already-saved team's own current builds --
// not the live "would adding this build create one" check BuildSlotPicker
// already does before a swap/add is ever committed (see detectOverlaps'
// own comment: both reuse the same generic function). This one exists
// because that add-time check can't catch everything: a build's weapon/
// artifacts can be changed later, from the Builds page, by a user who has
// no reason to know that build is also sitting in a team alongside another
// one that now shares the same physical weapon or artifact piece. Rather
// than trying to prevent that edit-time collision outright (see CLAUDE.md's
// own deferred "copy vs. force-edit" note), this accepts it can happen and
// surfaces it here instead, so a team that's drifted into an invalid state
// is visibly flagged rather than silently wrong.
//
// Only shared-weapon/shared-artifact ever come back -- a build's own
// character is fixed at creation (see Build's own schema comment) and
// already checked at add-time, so duplicate-character/exclusivity-conflict
// can never arise from a LATER edit the way weapon/artifact reuse can; they
// structurally cannot occur in a team that's already saved, so there's no
// UI built for them here.
export function computeTeamConflicts(members: BuildOption[]): TeamConflict[] {
  const overlapBuilds = members.map(toOverlapCheckBuild);
  const conflicts: TeamConflict[] = [];

  for (const conflict of detectOverlaps(overlapBuilds)) {
    if (conflict.type === "shared-weapon") {
      conflicts.push({ type: "shared-weapon", ownedWeaponId: conflict.ownedWeaponId, buildIds: conflict.buildIds });
    } else if (conflict.type === "shared-artifact") {
      const slot = members
        .flatMap((member) => member.ownedArtifacts)
        .find((a) => a.ownedArtifactId === conflict.ownedArtifactId)?.slot;
      // Always found in practice (the conflict came FROM these same
      // members' own ownedArtifacts in the first place) -- guarded rather
      // than asserted, since a missing slot would otherwise crash
      // TeamCard's own render entirely over a display-only feature.
      if (slot) {
        conflicts.push({
          type: "shared-artifact",
          ownedArtifactId: conflict.ownedArtifactId,
          slot,
          buildIds: conflict.buildIds,
        });
      }
    }
  }

  return conflicts;
}

// Which of ONE build's own weapon/artifacts are involved in the team's
// current conflicts -- feeds the red-border highlight on that build's own
// BuildPortrait tiles (team-manager.tsx) and, when "View" is opened from
// that slot, the matching WeaponCard/ArtifactCard in BuildViewer.
export function buildConflictFlags(
  buildId: number,
  conflicts: TeamConflict[]
): { weaponConflict: boolean; conflictingArtifactIds: number[] } {
  let weaponConflict = false;
  const conflictingArtifactIds: number[] = [];
  for (const conflict of conflicts) {
    if (!conflict.buildIds.includes(buildId)) continue;
    if (conflict.type === "shared-weapon") weaponConflict = true;
    else conflictingArtifactIds.push(conflict.ownedArtifactId);
  }
  return { weaponConflict, conflictingArtifactIds };
}

// One piece of the warning text shown below a conflicted team's own build
// slots -- "build" names a specific build (team-manager.tsx renders its
// own buildName italicized, in parens, e.g. "Hu Tao (Main DPS)"), "text" is
// everything else, rendered plain. A structured array (not a flat string)
// specifically so the italics is real markup, not something baked into
// the string itself.
export type TeamConflictPart =
  | { type: "build"; characterName: string; buildName: string }
  | { type: "text"; text: string };

// e.g. [build Hu Tao/Main DPS, text " and ", build Xingqiu/Support, text
// " have the same weapon equipped"].
export function describeTeamConflict(conflict: TeamConflict, members: BuildOption[]): TeamConflictPart[] {
  const involved = conflict.buildIds
    .map((id) => members.find((member) => member.buildId === id))
    .filter((member): member is BuildOption => member !== undefined);

  const parts: TeamConflictPart[] = [];
  involved.forEach((member, index) => {
    if (index > 0) parts.push({ type: "text", text: " and " });
    parts.push({ type: "build", characterName: member.characterName, buildName: member.name });
  });
  parts.push({
    type: "text",
    text:
      conflict.type === "shared-weapon"
        ? " have the same weapon equipped"
        : ` have the same artifact - ${conflict.slot} equipped`,
  });
  return parts;
}

// No sort of its own -- teams arrive (and stay) in most-recently-created-
// first order, from the server's own orderBy (see page.tsx) and from
// TeamManager's own optimistic updates (updateTeamInPlace/
// handleBumpToFront, neither of which filterTeams needs to know about), so
// filtering just needs to preserve whatever order it's handed rather than
// re-sorting by name the way this used to.
//
// Two independent queries, not one shared box -- each narrows the result
// further when non-empty (AND, not OR): teamNameQuery against the team's
// own name, characterNameQuery against any one of its members' character
// names. Searching "National" + "Xingqiu" means "the team named National
// that also has Xingqiu in it", not "anything matching either word".
export function filterTeams(teams: TeamItem[], teamNameQuery: string, characterNameQuery: string): TeamItem[] {
  const nameQuery = teamNameQuery.trim().toLowerCase();
  const characterQuery = characterNameQuery.trim().toLowerCase();
  if (!nameQuery && !characterQuery) return teams;

  return teams.filter((team) => {
    if (nameQuery && !team.name.toLowerCase().includes(nameQuery)) return false;
    if (characterQuery && !team.members.some((member) => member.characterName.toLowerCase().includes(characterQuery))) {
      return false;
    }
    return true;
  });
}
