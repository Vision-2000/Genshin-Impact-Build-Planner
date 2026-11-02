import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import type { ActiveSetEffectItem } from "@/lib/active-set-effects";

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
