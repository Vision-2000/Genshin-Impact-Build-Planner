import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HelpButton } from "@/components/help-button";
import { PlusIcon } from "@/components/plus-icon";
import { OwnedArtifactManager } from "./owned-artifact-manager";
import { toOwnedArtifactItem, type StatTypeOption } from "./filter-sort";

export const metadata: Metadata = {
  title: "Artifacts",
};

const HELP_TEXT = `This page shows the artifacts you currently own. Hover a card to see its main stat and substats, or click it to edit its level/main stat/substats (and delete it from there, if needed). Use the trash-can button to select multiple pieces and delete them all at once.`;

export default async function ArtifactsPage() {
  const profile = await requireActiveProfile();

  const [statTypes, ownedArtifacts] = await Promise.all([
    prisma.statType.findMany({ orderBy: { name: "asc" } }),
    prisma.ownedArtifact.findMany({
      where: { gameProfileId: profile.id },
      orderBy: { createdAt: "asc" },
      include: { artifactSet: true, mainStat: true, substats: { include: { statType: true } } },
    }),
  ]);

  const statTypeOptions: StatTypeOption[] = statTypes.map((statType) => ({
    id: statType.id,
    name: statType.name,
  }));

  const owned = ownedArtifacts.map(toOwnedArtifactItem);

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Artifacts</h1>
            <HelpButton title="Artifacts page help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-300">Managing artifacts for {profile.name}</p>
        </div>
        <Link
          href="/artifacts/add"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
        >
          {/* PlusIcon, not the Unicode "+" -- see its own comment on why
              a Unicode glyph can't be reliably centered against plain
              text via CSS alone. */}
          <PlusIcon />
          <span className="leading-none">Add artifact</span>
        </Link>
      </div>
      <OwnedArtifactManager statTypes={statTypeOptions} initialOwnedArtifacts={owned} />
      </div>
    </div>
  );
}
