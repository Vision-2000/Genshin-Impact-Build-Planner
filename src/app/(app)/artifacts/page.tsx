import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ArtifactManager } from "./artifact-manager";
import { toOwnedArtifactItem, type ArtifactSetCatalogItem, type StatTypeOption } from "./filter-sort";

export const metadata: Metadata = {
  title: "Artifacts",
};

export default async function ArtifactsPage() {
  const profile = await requireActiveProfile();

  const [artifactSets, statTypes, ownedArtifacts] = await Promise.all([
    prisma.artifactSet.findMany({ orderBy: { name: "asc" } }),
    prisma.statType.findMany({ orderBy: { name: "asc" } }),
    prisma.ownedArtifact.findMany({
      where: { gameProfileId: profile.id },
      orderBy: { createdAt: "asc" },
      include: { artifactSet: true, mainStat: true, substats: { include: { statType: true } } },
    }),
  ]);

  const catalog: ArtifactSetCatalogItem[] = artifactSets.map((set) => ({
    id: set.id,
    name: set.name,
    twoPieceEffect: set.twoPieceEffect,
    fourPieceEffect: set.fourPieceEffect,
    flowerIconUrl: set.flowerIconUrl,
    featherIconUrl: set.featherIconUrl,
    sandsIconUrl: set.sandsIconUrl,
    gobletIconUrl: set.gobletIconUrl,
    circletIconUrl: set.circletIconUrl,
  }));

  const statTypeOptions: StatTypeOption[] = statTypes.map((statType) => ({
    id: statType.id,
    name: statType.name,
  }));

  const owned = ownedArtifacts.map(toOwnedArtifactItem);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        <p className="text-sm text-gray-500">Managing artifacts for {profile.name}</p>
      </div>
      <ArtifactManager catalog={catalog} statTypes={statTypeOptions} initialOwnedArtifacts={owned} />
    </div>
  );
}
