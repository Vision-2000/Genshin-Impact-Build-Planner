import { Element, WeaponType } from "@/generated/prisma/enums";
import type { OverlapCheckBuild } from "@/lib/overlap";
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
  ownedArtifactIds: number[];
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

export function toOverlapCheckBuild(build: BuildOption): OverlapCheckBuild {
  return {
    buildId: build.buildId,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.ownedArtifactIds,
  };
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
