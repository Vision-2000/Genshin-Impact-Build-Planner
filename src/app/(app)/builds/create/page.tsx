import type { Metadata } from "next";
import Link from "next/link";
import { ArtifactSetPiece } from "@/generated/prisma/enums";
import { requireActiveProfile } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { travelerDisplayName } from "@/lib/character-scaling";
import { computeWeaponHoverDetail } from "@/lib/weapon-hover-detail";
import { HelpButton } from "@/components/help-button";
import { slotIconUrl } from "../../artifacts/filter-sort";
import { BuildCatalog } from "./build-catalog";
import type { OwnedCharacterOption, OwnedWeaponOption, OwnedArtifactOption } from "../filter-sort";

export const metadata: Metadata = {
  title: "Create Build",
};

const HELP_TEXT = `Pick one of your owned characters, give the build a name, and optionally assign a weapon and up to 5 artifacts. Only weapons matching the character's weapon type are offered, and each artifact slot only offers pieces you own for that slot.`;

export default async function CreateBuildPage() {
  const profile = await requireActiveProfile();

  const [ownedCharacters, ownedWeapons, ownedArtifacts] = await Promise.all([
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
    // This copy's own current state, not defaultWeaponProgression() -- see
    // the weapons page's own identical call.
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
    rarity: owned.artifactSet.rarity,
    level: owned.level,
    substats: owned.substats.map((s) => ({ statTypeName: s.statType.name, value: s.value })),
    twoPieceStatBonuses: owned.artifactSet.statBonuses
      .filter((bonus) => bonus.piece === ArtifactSetPiece.Two)
      .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
    fourPieceStatBonuses: owned.artifactSet.statBonuses
      .filter((bonus) => bonus.piece === ArtifactSetPiece.Four)
      .map((bonus) => ({ statTypeName: bonus.statType.name, value: bonus.value })),
    createdAt: owned.createdAt.getTime(),
  }));

  return (
    <div className="min-h-full bg-secondary-page">
      <div className="mx-auto max-w-[110rem] space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Create a build</h1>
            <HelpButton title="Create build help" text={HELP_TEXT} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-300">Creating builds for {profile.name}</p>
        </div>
        <Link
          href="/builds"
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          ← Back to my builds
        </Link>
      </div>
      <BuildCatalog characters={characterOptions} weapons={weaponOptions} artifacts={artifactOptions} />
      </div>
    </div>
  );
}
