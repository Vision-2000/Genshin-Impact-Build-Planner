import type { Metadata } from "next";
import { ArtifactSetPiece } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { computeWeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { HelpButton } from "@/components/help-button";
import { slotIconUrl } from "../artifacts/filter-sort";
import { OwnedBuildManager } from "./owned-build-manager";
import {
  toBuildItem,
  type OwnedCharacterOption,
  type OwnedWeaponOption,
  type OwnedArtifactOption,
} from "./filter-sort";

export const metadata: Metadata = {
  title: "Builds",
};

const HELP_TEXT = `This page shows the builds you've assembled for your owned characters. Click "Create build" to assemble a new one; click an existing card to rename it, change its weapon/artifacts, or delete it (deleting pulls it out of any team or roster it's in).`;

export default async function BuildsPage({
  searchParams,
}: {
  // Set by BuildDetailModal's own "Edit build" button (Teams page), which
  // links here as /builds?edit=<buildId> -- same query-param-driven
  // "open this on load" pattern AddWeaponPage's own weaponType param
  // already uses. Only trusted as a real number below; an invalid/missing
  // value just leaves the editor closed, same as a normal page load.
  searchParams: Promise<{ edit?: string }>;
}) {
  const profile = await requireActiveProfile();
  const { edit } = await searchParams;
  const initialEditBuildId = edit !== undefined && Number.isInteger(Number(edit)) ? Number(edit) : null;

  const [ownedCharacters, ownedWeapons, ownedArtifacts, builds] = await Promise.all([
    prisma.ownedCharacter.findMany({
      where: { gameProfileId: profile.id, isOwned: true },
      include: {
        character: {
          include: {
            ascensionStat: true,
            // Passives have no level/ascension gate in this schema (see
            // final-stats.ts's own comment) -- every talent's own bonus
            // rows are always active once the character is owned.
            talents: { include: { statBonuses: { include: { statType: true } } } },
            // Filtered by OwnedCharacter.constellation at compute time
            // (final-stats.ts), not here -- every row is fetched regardless
            // of how many are actually unlocked.
            constellations: { include: { statBonuses: { include: { statType: true } } } },
          },
        },
      },
      orderBy: { character: { name: "asc" } },
    }),
    prisma.ownedWeapon.findMany({
      where: { gameProfileId: profile.id },
      include: {
        weapon: {
          include: {
            secondaryStat: true,
            statBonuses: { include: { statType: true } },
            refinementEffects: { orderBy: { refinement: "asc" } },
            refinementValues: { orderBy: { slotIndex: "asc" } },
          },
        },
      },
      orderBy: { weapon: { name: "asc" } },
    }),
    prisma.ownedArtifact.findMany({
      where: { gameProfileId: profile.id },
      include: {
        artifactSet: { include: { statBonuses: { include: { statType: true } } } },
        mainStat: true,
        substats: { include: { statType: true } },
      },
      orderBy: { artifactSet: { name: "asc" } },
    }),
    prisma.build.findMany({
      where: { ownedCharacter: { gameProfileId: profile.id, isOwned: true } },
      include: {
        ownedCharacter: { include: { character: true } },
        ownedWeapon: { include: { weapon: true } },
        buildArtifacts: { include: { ownedArtifact: { include: { artifactSet: true, mainStat: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const characterOptions: OwnedCharacterOption[] = ownedCharacters.map((owned) => ({
    ownedCharacterId: owned.id,
    characterId: owned.characterId,
    name: travelerDisplayName(owned.character.name),
    iconUrl: owned.character.iconUrl,
    splashUrl: owned.character.splashUrl,
    weaponType: owned.character.weaponType,
    element: owned.character.element,
    rarity: owned.character.rarity,
    baseHp: owned.character.baseHp,
    baseAttack: owned.character.baseAttack,
    baseDefense: owned.character.baseDefense,
    maxAscensionHp: owned.character.maxAscensionHp,
    maxAscensionAttack: owned.character.maxAscensionAttack,
    maxAscensionDefense: owned.character.maxAscensionDefense,
    baseElementalMastery: owned.character.baseElementalMastery,
    ascensionStatName: owned.character.ascensionStat?.name ?? null,
    level: owned.level,
    ascensionPhase: owned.ascensionPhase,
    constellation: owned.constellation,
    normalAttackLevel: owned.normalAttackLevel,
    skillLevel: owned.skillLevel,
    burstLevel: owned.burstLevel,
    talentStatBonuses: owned.character.talents.flatMap((talent) =>
      talent.statBonuses.map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value }))
    ),
    constellationStatBonuses: owned.character.constellations.flatMap((constellation) =>
      constellation.statBonuses.map((bonus) => ({
        statTypeName: bonus.statType.name,
        value: bonus.value,
        number: constellation.number,
      }))
    ),
    talents: owned.character.talents.map((talent) => ({
      slot: talent.slot,
      name: talent.name,
      iconUrl: talent.iconUrl,
      description: talent.description,
    })),
    constellations: owned.character.constellations.map((c) => ({
      number: c.number,
      name: c.name,
      iconUrl: c.iconUrl,
      description: c.description,
    })),
  }));

  const weaponOptions: OwnedWeaponOption[] = ownedWeapons.map((owned) => ({
    ownedWeaponId: owned.id,
    name: owned.weapon.name,
    iconUrl: owned.weapon.iconUrl,
    weaponType: owned.weapon.weaponType,
    refinement: owned.refinement,
    rarity: owned.weapon.rarity,
    secondaryStatName: owned.weapon.secondaryStat?.name ?? null,
    attackTier: owned.weapon.attackTier,
    attackCurveRarity: owned.weapon.attackCurveRarity,
    baseSecondaryStatValue: owned.weapon.baseSecondaryStatValue,
    level: owned.level,
    ascensionPhase: owned.ascensionPhase,
    statBonuses: owned.weapon.statBonuses.map((bonus) => ({
      statTypeName: bonus.statType.name,
      curveType: bonus.curveType,
      baseValue: bonus.baseValue,
      slope: bonus.slope,
      customValues: bonus.customValues,
    })),
    hoverDetail: computeWeaponHoverDetail(owned.weapon, owned.level, owned.ascensionPhase, owned.refinement),
    createdAt: owned.createdAt.getTime(),
  }));

  const artifactOptions: OwnedArtifactOption[] = ownedArtifacts.map((owned) => ({
    ownedArtifactId: owned.id,
    slot: owned.slot,
    artifactSetId: owned.artifactSetId,
    setName: owned.artifactSet.name,
    mainStatName: owned.mainStat.name,
    iconUrl: slotIconUrl(owned.artifactSet, owned.slot),
    flowerIconUrl: owned.artifactSet.flowerIconUrl,
    rarity: owned.artifactSet.rarity,
    level: owned.level,
    substats: owned.substats.map((s) => ({ statTypeName: s.statType.name, value: s.value })),
    twoPieceStatBonuses: owned.artifactSet.statBonuses
      .filter((bonus) => bonus.piece === ArtifactSetPiece.Two)
      .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
    fourPieceStatBonuses: owned.artifactSet.statBonuses
      .filter((bonus) => bonus.piece === ArtifactSetPiece.Four)
      .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
    twoPieceEffect: owned.artifactSet.twoPieceEffect,
    fourPieceEffect: owned.artifactSet.fourPieceEffect,
    createdAt: owned.createdAt.getTime(),
  }));

  const buildItems = builds.map(toBuildItem);

  return (
    <div className="min-h-full bg-primary-page">
      <div className="mx-auto max-w-[110rem] p-4">
        {/* The title block is handed to OwnedBuildManager rather than
            rendered here -- unlike the other pages' header-row button (a
            plain <Link> to a sibling route), "Create build" opens a modal
            driven by client state, so the row that holds both has to live
            inside the client component. */}
        <OwnedBuildManager
          header={
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">Builds</h1>
                <HelpButton title="Builds page help" text={HELP_TEXT} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-300">Managing builds for {profile.name}</p>
            </div>
          }
          characters={characterOptions}
          weapons={weaponOptions}
          artifacts={artifactOptions}
          initialBuilds={buildItems}
          initialEditBuildId={initialEditBuildId}
        />
      </div>
    </div>
  );
}
