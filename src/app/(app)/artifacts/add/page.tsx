import type { Metadata } from "next";
import Link from "next/link";
import { ArtifactSetPiece } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { ArtifactCatalog } from "./artifact-catalog";
import type { ArtifactSetCatalogItem, StatTypeOption } from "../filter-sort";

export const metadata: Metadata = {
  title: "Add Artifact",
};

const HELP_TEXT = `Browse every artifact set in the game. Hover a card to see its 2-piece/4-piece set effects, or click it to fill in a new piece's slot, level, main stat, and up to 4 substats.`;

// null both when there's no 2pc stat bonus row at all, and when there's
// more than one (currently just Tiny Miracle, whose 2pc effect is +RES%
// to all 7 elements, one row each) -- the 2pc-stat filter is a single
// exact-match dropdown (see CatalogFilters.twoPieceStatFilter), so a set
// with several simultaneous bonuses can't be represented as one value
// without silently dropping the rest. Both cases fall into the catalog's
// "Others" bucket rather than picking one bonus arbitrarily.
function twoPieceStatName(set: { statBonuses: { piece: ArtifactSetPiece; statType: { name: string } }[] }): string | null {
  const twoPieceBonuses = set.statBonuses.filter((sb) => sb.piece === ArtifactSetPiece.Two);
  return twoPieceBonuses.length === 1 ? twoPieceBonuses[0].statType.name : null;
}

export default async function AddArtifactPage() {
  const profile = await requireActiveProfile();

  const [artifactSets, statTypes] = await Promise.all([
    prisma.artifactSet.findMany({
      orderBy: { name: "asc" },
      include: { statBonuses: { include: { statType: true } } },
    }),
    prisma.statType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const catalog: ArtifactSetCatalogItem[] = artifactSets.map((set) => ({
    id: set.id,
    name: set.name,
    rarity: set.rarity,
    twoPieceEffect: set.twoPieceEffect,
    fourPieceEffect: set.fourPieceEffect,
    twoPieceStatName: twoPieceStatName(set),
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
    <div className="min-h-full bg-secondary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Add an artifact</h1>
            <HelpButton title="Add artifact help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-300">Adding artifacts for {profile.name}</p>
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
    </div>
  );
}
