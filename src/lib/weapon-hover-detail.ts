import { computeWeaponAttack, computeWeaponSecondaryStat } from "./weapon-scaling";
import { renderWeaponPassiveDescription, type WeaponRefinementCurveType } from "./weapon-refinement-scaling";
import { roundHalfUp } from "./round";

// Exact stats/passive at a specific (level, ascensionPhase, refinement) --
// shared by the add-catalog's hover tooltip (always this weapon's own
// defaultWeaponProgression() state, see weapon-scaling.ts) and the
// owned-weapons page's hover tooltip (always that physical copy's own
// current state). Computed once server-side in each page.tsx rather than
// shipped as raw curve data for the client to recompute. Deliberately no
// statBonuses here -- the tooltip shows the passive's own text only, not a
// separate restatement of the bonus it describes.
export type WeaponHoverDetail = {
  attack: number;
  secondaryStatValue: number | null;
  passiveName: string | null;
  passiveDescription: string | null;
};

export function computeWeaponHoverDetail(
  weapon: {
    rarity: number;
    attackTier: number | null;
    attackCurveRarity: number | null;
    baseSecondaryStatValue: number | null;
    secondaryStat: { name: string } | null;
    passiveName: string | null;
    passiveDescriptionTemplate: string | null;
    refinementValues: {
      slotIndex: number;
      curveType: string;
      baseValue: number;
      slope: number | null;
      customValues: number[];
    }[];
    refinementEffects: { refinement: number; description: string }[];
  },
  level: number,
  ascensionPhase: number,
  refinement: number
): WeaponHoverDetail {
  const attack =
    weapon.attackTier === null
      ? 0
      : roundHalfUp(
          computeWeaponAttack(weapon.attackTier, weapon.rarity, level, ascensionPhase, weapon.attackCurveRarity ?? undefined),
          0
        );
  const secondaryStatValue =
    weapon.secondaryStat && weapon.baseSecondaryStatValue !== null
      ? computeWeaponSecondaryStat(weapon.baseSecondaryStatValue, level)
      : null;

  const passiveDescription = weapon.passiveDescriptionTemplate
    ? renderWeaponPassiveDescription(
        weapon.passiveDescriptionTemplate,
        weapon.refinementValues.map((v) => ({ ...v, curveType: v.curveType as WeaponRefinementCurveType })),
        refinement
      )
    : (weapon.refinementEffects.find((e) => e.refinement === refinement)?.description ?? null);

  return { attack, secondaryStatValue, passiveName: weapon.passiveName, passiveDescription };
}
