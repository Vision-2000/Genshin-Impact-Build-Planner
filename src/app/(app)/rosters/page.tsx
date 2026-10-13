import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { RosterManager } from "./roster-manager";
import type { BuildOption, RosterItem } from "./filter-sort";

export const metadata: Metadata = {
  title: "Rosters",
};

export default async function RostersPage() {
  const profile = await requireActiveProfile();

  const [builds, rosters] = await Promise.all([
    prisma.build.findMany({
      where: { ownedCharacter: { gameProfileId: profile.id, isOwned: true } },
      include: { ownedCharacter: { include: { character: true } }, buildArtifacts: true },
      orderBy: { name: "asc" },
    }),
    prisma.roster.findMany({
      where: { gameProfileId: profile.id },
      include: {
        rosterBuilds: {
          include: { build: { include: { ownedCharacter: { include: { character: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const buildOptions: BuildOption[] = builds.map((build) => ({
    buildId: build.id,
    name: build.name,
    characterName: travelerDisplayName(build.ownedCharacter.character.name),
    characterIconUrl: build.ownedCharacter.character.iconUrl,
    ownedCharacterId: build.ownedCharacterId,
    exclusivityGroup: build.ownedCharacter.character.exclusivityGroup,
    ownedWeaponId: build.ownedWeaponId,
    ownedArtifactIds: build.buildArtifacts.map((ba) => ba.ownedArtifactId),
  }));

  const rosterItems: RosterItem[] = rosters.map((roster) => ({
    id: roster.id,
    name: roster.name,
    members: roster.rosterBuilds.map((rb) => ({
      buildId: rb.build.id,
      name: rb.build.name,
      characterName: travelerDisplayName(rb.build.ownedCharacter.character.name),
      characterIconUrl: rb.build.ownedCharacter.character.iconUrl,
    })),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Rosters</h1>
        <p className="text-sm text-gray-500">Managing rosters for {profile.name}</p>
      </div>
      <RosterManager builds={buildOptions} initialRosters={rosterItems} />
    </div>
  );
}
