"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { DiamondSelector } from "@/components/diamond-selector";
import { BoldHighlightedText } from "@/components/bold-highlighted-text";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_ASCENSION_PHASE,
  validAscensionPhasesForLevel,
  maxLevelForAscensionPhase,
  minLevelForAscensionPhase,
} from "@/lib/ascension";
import { formatStatValue } from "@/lib/stat-format";
import { roundHalfUp } from "@/lib/round";
import { computeWeaponAttack, computeWeaponSecondaryStat, isExaiphanesBlade, EXAIPHANES_BLADE_STATES } from "@/lib/weapon-scaling";
import { renderWeaponPassiveDescription, type WeaponRefinementCurveType } from "@/lib/weapon-refinement-scaling";
import { getWeaponProgressionData, type WeaponProgressionData } from "./actions";
import { MIN_REFINEMENT, MAX_REFINEMENT, type UpdateWeaponProgressionInput } from "./schemas";

function BaseStatsSection({
  data,
  level,
  ascensionPhase,
  secondaryStatName,
}: {
  data: WeaponProgressionData;
  level: number;
  ascensionPhase: number;
  secondaryStatName: string | null;
}) {
  if (data.attackTier === null) return null;

  const attack = computeWeaponAttack(data.attackTier, data.rarity, level, ascensionPhase, data.attackCurveRarity ?? undefined);
  const secondaryStatValue =
    secondaryStatName && data.baseSecondaryStatValue !== null
      ? computeWeaponSecondaryStat(data.baseSecondaryStatValue, level)
      : null;

  return (
    <div className="rounded border p-3 text-sm">
      <p className="font-medium">Stats</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-300">
        <li>Base ATK: {roundHalfUp(attack, 0)}</li>
        {secondaryStatName && secondaryStatValue !== null && (
          <li>
            {secondaryStatName}: {formatStatValue(secondaryStatName, secondaryStatValue)}
          </li>
        )}
      </ul>
    </div>
  );
}

// The weapon's passive (if it has one -- low-rarity weapons don't), shown
// with the current refinement's text. The common case renders
// passiveDescriptionTemplate's {0}/{1}/... placeholders via
// @/lib/weapon-refinement-scaling; the one weapon whose refinement text is
// structurally different between tiers (not just reworded numbers) has no
// template at all and falls back to its raw per-refinement row instead --
// see WeaponProgressionData's own comment. Deliberately no stat-bonus
// restatement below the text -- the passive's own description already
// says it, same reasoning the add-catalog hover tooltip already applies.
function PassiveSection({ data, refinement }: { data: WeaponProgressionData; refinement: number }) {
  if (!data.passiveName) return null;
  const description = data.passiveDescriptionTemplate
    ? renderWeaponPassiveDescription(
        data.passiveDescriptionTemplate,
        data.refinementValues.map((v) => ({ ...v, curveType: v.curveType as WeaponRefinementCurveType })),
        refinement
      )
    : data.refinementEffects.find((e) => e.refinement === refinement)?.description;
  if (!description) return null;

  return (
    <div className="rounded border p-3 text-sm">
      <p className="font-medium text-yellow-100">{data.passiveName}</p>
      <p className="mt-1 whitespace-pre-line text-gray-300">
        <BoldHighlightedText text={description} />
      </p>
    </div>
  );
}

// Shared level/ascension/refinement form, used both by the owned-weapons
// page (editing an existing copy, submitLabel="Save") and the add-weapon
// catalog's "customize before adding" modal (submitLabel="Add", starting
// from defaultWeaponProgression() instead of a saved copy's own values) --
// same UI either way, just a different starting point and what happens on
// submit. Ascension is constrained by level in both directions: the level
// slider snaps ascension to the closest still-valid phase, and clicking an
// ascension diamond pulls the level into whatever's valid at that phase.
// Progression data (base stats/passive) is fetched lazily here rather than
// passed in -- only the weapon actually being viewed/added needs it, and
// it's a much heavier query than either call site's own list/catalog one.
//
// Laid out as a two-column, rarity-tinted panel -- the same splash-art/
// form-column split CharacterProgressionEditor uses (see
// owned-character-manager.tsx), just with the weapon's own icon standing in
// for a character's splash art (weapons have no portrait art to show) and
// rarityGradientClasses standing in for element-tinted background (weapons
// have no element either).
export function WeaponProgressionForm({
  weaponId,
  name,
  weaponType,
  rarity,
  iconUrl,
  secondaryStatName,
  initialLevel,
  initialAscensionPhase,
  initialRefinement,
  submitLabel,
  onSubmit,
}: {
  weaponId: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  secondaryStatName: string | null;
  initialLevel: number;
  initialAscensionPhase: number;
  initialRefinement: number;
  submitLabel: string;
  onSubmit: (input: UpdateWeaponProgressionInput) => void;
}) {
  const [level, setLevel] = useState(initialLevel);
  const [ascensionPhase, setAscensionPhase] = useState(initialAscensionPhase);
  const [refinement, setRefinement] = useState(initialRefinement);
  const [data, setData] = useState<WeaponProgressionData | null>(null);

  // Exaiphanes Blade: level/ascensionPhase/refinement are driven together
  // by this one selector instead of independently -- see
  // EXAIPHANES_BLADE_STATES. Falls back to state 0 if the starting values
  // don't exactly match any state (shouldn't happen in practice -- both
  // call sites' starting values are always one of the 7 states already).
  const [statuesUnlocked, setStatuesUnlocked] = useState(() => {
    const index = EXAIPHANES_BLADE_STATES.findIndex(
      (s) => s.level === initialLevel && s.ascensionPhase === initialAscensionPhase && s.refinement === initialRefinement
    );
    return index === -1 ? 0 : index;
  });

  function handleStatuesUnlockedChange(newStatuesUnlocked: number) {
    setStatuesUnlocked(newStatuesUnlocked);
    const state = EXAIPHANES_BLADE_STATES[newStatuesUnlocked];
    setLevel(state.level);
    setAscensionPhase(state.ascensionPhase);
    setRefinement(state.refinement);
  }

  useEffect(() => {
    let cancelled = false;
    getWeaponProgressionData(weaponId).then((result) => {
      if (cancelled) return;
      setData(result);
      // A documented few weapons cap below the universal MAX_REFINEMENT
      // (see Weapon.maxRefinement) -- pull an already-set refinement down
      // to whatever this specific weapon actually supports.
      setRefinement((prev) => Math.min(prev, result.maxRefinement));
    });
    return () => {
      cancelled = true;
    };
  }, [weaponId]);

  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    const phases = validAscensionPhasesForLevel(newLevel);
    if (!phases.includes(ascensionPhase)) {
      setAscensionPhase(phases[phases.length - 1]);
    }
  }

  function handleAscensionPhaseChange(newPhase: number) {
    setAscensionPhase(newPhase);
    const min = minLevelForAscensionPhase(newPhase);
    const max = maxLevelForAscensionPhase(newPhase);
    setLevel((prev) => Math.min(max, Math.max(min, prev)));
  }

  return (
    // -m-5 bleeds back out over the Modal's own padding so this fills the
    // whole rounded panel, same as CharacterProgressionEditor. text-white
    // is forced site-wide for the same reason as there: most labels here
    // rely on the default (theme-dependent) foreground color, which isn't
    // reliably legible over a dark rarity-tinted panel.
    <div className={`relative -m-5 flex flex-col overflow-hidden rounded-lg text-white sm:flex-row ${rarityGradientClasses(rarity)}`}>
      <div className="relative flex h-56 w-full shrink-0 flex-col sm:h-auto sm:w-72">
        <div className="px-3 pt-3">
          <p className="pl-2 text-2xl font-medium">{name}</p>
          <div className="mt-1 flex items-center gap-2 pl-2">
            <Image src={WEAPON_TYPE_ICON_URL[weaponType]} alt={weaponType} title={weaponType} width={32} height={32} />
            <div className="flex items-center gap-0.5" aria-label={`Rarity ${rarity}`}>
              {Array.from({ length: rarity }, (_, i) => i).map((i) => (
                <span key={i} className="text-xl text-amber-400">
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 p-6">{iconUrl && <Image src={iconUrl} alt="" fill className="object-contain" />}</div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center p-5 pr-14">
        <div className="w-fit space-y-4">
          {isExaiphanesBlade(name) ? (
            <div className="space-y-1">
              <p className="text-sm">Statues Unlocked</p>
              <DiamondSelector
                count={EXAIPHANES_BLADE_STATES.length - 1}
                value={statuesUnlocked}
                onChange={handleStatuesUnlockedChange}
                litClassName="border-amber-400 bg-amber-400"
                ariaLabel={(n) => `${n} statues unlocked`}
              />
              <p className="text-xs text-gray-300">
                Level {level}, Ascension {ascensionPhase}, Refinement R{refinement}
              </p>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                Level
                <input
                  type="range"
                  min={MIN_LEVEL}
                  max={MAX_LEVEL}
                  value={level}
                  onChange={(event) => handleLevelChange(Number(event.target.value))}
                  className="-mt-1 w-32"
                />
                <span className="w-14 text-gray-300">
                  {level}/{maxLevelForAscensionPhase(ascensionPhase)}
                </span>
              </label>

              <div className="space-y-1">
                <p className="text-sm">Ascension</p>
                <DiamondSelector
                  count={MAX_ASCENSION_PHASE}
                  value={ascensionPhase}
                  onChange={handleAscensionPhaseChange}
                  litClassName="border-amber-400 bg-amber-400"
                  ariaLabel={(phase) => `Ascension phase ${phase}`}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                Refinement
                <input
                  type="range"
                  min={MIN_REFINEMENT}
                  max={data?.maxRefinement ?? MAX_REFINEMENT}
                  value={refinement}
                  onChange={(event) => setRefinement(Number(event.target.value))}
                  className="w-32"
                />
                <span className="w-8 text-gray-300">R{refinement}</span>
              </label>
            </>
          )}

          {!data ? (
            <p className="text-sm text-gray-300">Loading...</p>
          ) : (
            <>
              <BaseStatsSection data={data} level={level} ascensionPhase={ascensionPhase} secondaryStatName={secondaryStatName} />
              <PassiveSection data={data} refinement={refinement} />
            </>
          )}

          <div className="flex justify-end border-t pt-3">
            <button
              type="button"
              onClick={() => onSubmit({ level, ascensionPhase, refinement })}
              className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
