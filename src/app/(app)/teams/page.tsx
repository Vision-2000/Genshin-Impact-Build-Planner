import type { Metadata } from "next";
import { TalentSlot } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { isMoonsignTalentName, isHexereiTalentName } from "@/lib/moonsign-hexerei";
import { computeActiveSetEffects } from "@/lib/active-set-effects";
import { HelpButton } from "@/components/help-button";
import { TeamManager } from "./team-manager";
import type { BuildOption, TeamItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Teams",
};

const HELP_TEXT = `This page shows the teams you've assembled from your builds. Click "Create team" to start a new one; click an empty slot on a team to assign a build to it, or a filled slot to swap/remove it. A team holds up to 4 builds, and a build can't be reused across two slots in the same team if doing so would duplicate a character, share a weapon, or share an artifact -- those builds simply won't show up as candidates.`;

export default async function TeamsPage() {
  const profile = await requireActiveProfile();

  const [builds, teams] = await Promise.all([
    prisma.build.findMany({
      where: { ownedCharacter: { gameProfileId: profile.id, isOwned: true } },
      include: {
        ownedCharacter: {
          include: {
            character: {
              include: {
                // Moonsign/Hexerei membership is derived from this one
                // talent's own name, not a stored Character field (see
                // moonsign-hexerei.ts's own comment on why) -- scoped to
                // just Passive3 and just the name, since that's the only
                // part of it this page needs.
                talents: { where: { slot: TalentSlot.Passive3 }, select: { name: true } },
              },
            },
          },
        },
        // weapon/artifactSet are here for the filled build-slot card's own
        // weapon/set-effect badges (build-slot-picker.tsx), same data
        // shape the Builds page's own BuildItem already fetches for its
        // BuildCard.
        ownedWeapon: { include: { weapon: { select: { iconUrl: true, rarity: true } } } },
        buildArtifacts: {
          include: { ownedArtifact: { include: { artifactSet: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { gameProfileId: profile.id },
      include: {
        teamBuilds: {
          include: { build: { include: { ownedCharacter: { include: { character: true } } } } },
        },
      },
      // Most recently updated first -- renaming a team or changing its
      // builds (addTeamBuild/removeTeamBuild both touch Team.updatedAt
      // too, see their own comment) bumps it back to the top, same as a
      // fresh create.
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const buildOptions: BuildOption[] = builds.map((build) => {
    // At most one row (Passive3 is a single fixed slot per character),
    // and plenty of characters have no Passive3 at all (e.g. 4-star
    // characters, who only have 2 passives) -- isMoonsignTalentName/
    // isHexereiTalentName both correctly return false for undefined via
    // the ?. below either way.
    const passive3Name = build.ownedCharacter.character.talents[0]?.name;
    return {
      buildId: build.id,
      name: build.name,
      characterName: travelerDisplayName(build.ownedCharacter.character.name),
      characterIconUrl: build.ownedCharacter.character.iconUrl,
      element: build.ownedCharacter.character.element,
      rarity: build.ownedCharacter.character.rarity,
      weaponType: build.ownedCharacter.character.weaponType,
      isMoonsignCharacter: passive3Name !== undefined && isMoonsignTalentName(passive3Name),
      isHexereiCharacter: passive3Name !== undefined && isHexereiTalentName(passive3Name),
      ownedCharacterId: build.ownedCharacterId,
      exclusivityGroup: build.ownedCharacter.character.exclusivityGroup,
      ownedWeaponId: build.ownedWeaponId,
      ownedArtifactIds: build.buildArtifacts.map((ba) => ba.ownedArtifactId),
      weaponIconUrl: build.ownedWeapon?.weapon.iconUrl ?? null,
      weaponRarity: build.ownedWeapon?.weapon.rarity ?? null,
      activeSetEffects: computeActiveSetEffects(build.buildArtifacts),
    };
  });

  const teamItems: TeamItem[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    members: team.teamBuilds.map((tb) => ({
      buildId: tb.build.id,
      name: tb.build.name,
      characterName: travelerDisplayName(tb.build.ownedCharacter.character.name),
      characterIconUrl: tb.build.ownedCharacter.character.iconUrl,
    })),
  }));

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] p-4">
        {/* Same reasoning as the Builds page's own header -- "Create team"
            opens a modal driven by client state, so the row holding both
            the title and that button has to live inside the client
            component rather than here. */}
        <TeamManager
          header={
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">Teams</h1>
                <HelpButton title="Teams page help" text={HELP_TEXT} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-300">Managing teams for {profile.name}</p>
            </div>
          }
          builds={buildOptions}
          initialTeams={teamItems}
        />
      </div>
    </div>
  );
}
