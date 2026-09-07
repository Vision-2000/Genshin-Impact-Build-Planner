import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { ArtifactCatalog } from "./artifact-catalog";
import type { ArtifactSetCatalogItem, StatTypeOption } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Artifact",
};

const HELP_TEXT = `Browse every artifact set in the game. Search by name, then click Add on a set to fill in the piece's slot, rarity, level, main stat, and up to 4 substats.

You can add as many pieces as you like -- each is tracked as its own physical piece.`;

export default async function AddArtifactPage() {
  const profile = await requireActiveProfile();

  const [artifactSets, statTypes] = await Promise.all([
    prisma.artifactSet.findMany({ orderBy: { name: "asc" } }),
    prisma.statType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const catalog: ArtifactSetCatalogItem[] = artifactSets.map((set) => ({
    id: set.id,
    name: set.name,
    rarity: set.rarity,
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

  return (
    <div className="mx-auto max-w-[90rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Add an artifact</h1>
            <HelpButton title="Add artifact help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500">Adding artifacts for {profile.name}</p>
        </div>
        <Link
          href="/artifacts"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          ← Back to my artifacts
        </Link>
      </div>
      <ArtifactCatalog catalog={catalog} statTypes={statTypeOptions} />
    </div>
  );
}
